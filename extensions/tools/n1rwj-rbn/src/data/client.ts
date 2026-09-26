import type { FetchOptions, FetchResponse } from '@ham2k/extension-sdk'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import type { RbnSnapshot } from '../model.ts'
import { isValidCall, normalizeCall } from '../model.ts'
import { decodeSnapshots, encodeSnapshots, snapshotKey } from './cache.ts'
import { RbnRequestError, requestFailure } from './errors.ts'
import { parseRbnPayload, record } from './parser.ts'

const endpoint = 'https://vailrerbn.com/api/v1/spots'
const maxReports = 500
const maxEntries = 8
const maxResponseLength = 1_000_000
const rateLimitMessage = 'Vail ReRBN rate limit reached (HTTP 429). Waiting before retrying.'

export interface RbnQuery {
  call: string
  windowMinutes: number
}

export interface RbnClientOptions {
  fetch: (url: string, options?: FetchOptions) => Promise<FetchResponse>
  now?: () => number
  refreshIntervalMs?: number
  storage?: PersistentStorage
}

export interface RbnClient {
  getSnapshot(query: RbnQuery, options?: RbnRequestOptions): Promise<RbnSnapshot>
}

interface RbnRequestOptions {
  force?: boolean
  online?: boolean
  realNowMillis?: number
  /** Return the current cache while a shared request continues independently. */
  waitForRequest?: boolean
}

interface Entry {
  snapshot: RbnSnapshot
  inFlight?: Promise<RbnSnapshot>
  timingSampleRevision?: number
}

export function createRbnClient(options: RbnClientOptions): RbnClient {
  const now = options.now ?? Date.now
  const refreshIntervalMs = Math.max(30_000, options.refreshIntervalMs ?? 60_000)
  const cache = new Map<string, Entry>()
  let rateLimitedUntil = 0
  let pendingRetryDelayMs = 0
  let pendingRetrySampleRevision: number | undefined
  let restored = !options.storage
  let restoring: Promise<void> | undefined
  let restoreAfter = 0
  let storageWarning: string | undefined
  let writing = Promise.resolve()
  let realClockSample: number | undefined
  let sampleRevision = 0
  // Date follows the developer's virtual clock and cannot measure real elapsed
  // time between host samples. Completion timing is finalized by the next sample.
  const requestNow = () => realClockSample ?? now()

  function finalizeTiming(time: number, newSample: boolean): boolean {
    if (realClockSample !== undefined && !newSample) return false
    let changed = false
    for (const entry of cache.values()) {
      const timing = entry.snapshot.pendingRequestTiming
      if (!timing || entry.timingSampleRevision === sampleRevision) continue
      entry.snapshot.lastRequestDurationMs = Math.max(0, time - timing.startedAtMs)
      entry.snapshot.lastRequestDurationUpperBound = true
      if (timing.succeeded) entry.snapshot.lastSuccessMs = time
      delete entry.snapshot.pendingRequestTiming
      delete entry.timingSampleRevision
      changed = true
    }
    if (pendingRetryDelayMs > 0 && pendingRetrySampleRevision !== sampleRevision) {
      rateLimitedUntil = Math.max(rateLimitedUntil, time + pendingRetryDelayMs)
      pendingRetryDelayMs = 0
      pendingRetrySampleRevision = undefined
      changed = true
    }
    return changed
  }

  async function restore(time: number) {
    const storage = options.storage
    if (!storage || restored || time < restoreAfter) return
    restoring ??= (async () => {
      try {
        const value = await storage.read(snapshotKey)
        try {
          const saved = decodeSnapshots(value, time)
          rateLimitedUntil = Math.max(rateLimitedUntil, saved.rateLimitedUntil)
          pendingRetryDelayMs = Math.max(pendingRetryDelayMs, saved.pendingRetryDelayMs)
          for (const snapshot of saved.snapshots) {
            const key = `${snapshot.call}|${snapshot.windowMinutes}`
            const current = cache.get(key)
            if (
              !current ||
              (!current.inFlight &&
                (current.snapshot.lastAttemptMs ?? 0) < (snapshot.lastAttemptMs ?? 0))
            )
              cache.set(key, { snapshot })
          }
          pruneCache()
          storageWarning = undefined
        } catch {
          storageWarning = 'Saved RBN reports could not be restored.'
        }
        restored = true
      } catch {
        storageWarning = 'RBN storage unavailable; reports are kept only for this session.'
        restoreAfter = time + 60_000
      }
    })().finally(() => {
      restoring = undefined
    })
    await restoring
  }

  async function save(time: number) {
    if (!options.storage || !restored) return
    const storage = options.storage
    const value = encodeSnapshots(
      [...cache.values()].map((entry) => entry.snapshot),
      rateLimitedUntil,
      time,
      pendingRetryDelayMs,
    )
    writing = writing.then(async () => {
      try {
        await storage.write(snapshotKey, value)
        storageWarning = undefined
      } catch {
        storageWarning =
          'RBN reports or request timing could not be saved; they may be lost on restart.'
      }
    })
    await writing
  }

  async function getJson(url: string) {
    let response: FetchResponse
    try {
      response = await options.fetch(url)
    } catch (error) {
      throw requestFailure(error)
    }
    if (response.status === 429) {
      let retryAfter: unknown
      // The host does not expose Retry-After headers; Vail documents this JSON field.
      if (response.body.length <= maxResponseLength) {
        try {
          retryAfter = record(record(JSON.parse(response.body))?.error)?.retryAfter
        } catch {
          // Non-JSON rate-limit responses still pause every panel using this client.
        }
      }
      const delay =
        typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(30_000, retryAfter * 1000)
          : 60_000
      rateLimitedUntil = Math.max(rateLimitedUntil, requestNow() + delay)
      if (realClockSample !== undefined) {
        pendingRetryDelayMs = Math.max(pendingRetryDelayMs, Math.ceil(delay))
        pendingRetrySampleRevision = sampleRevision
      }
      throw new RbnRequestError('rate-limit', rateLimitMessage, { retryAtMs: rateLimitedUntil })
    }
    const success = response.status >= 200 && response.status < 300
    if (!success)
      throw new RbnRequestError('http', `Vail ReRBN request failed (HTTP ${response.status}).`)
    if (response.body.length > maxResponseLength)
      throw new RbnRequestError(
        'response',
        `Vail ReRBN response was too large (HTTP ${response.status}; limit ${maxResponseLength} characters).`,
      )
    try {
      return { payload: JSON.parse(response.body) as unknown, status: response.status }
    } catch {
      throw new RbnRequestError(
        'response',
        `Vail ReRBN returned invalid JSON (HTTP ${response.status}).`,
      )
    }
  }

  function getReports(query: RbnQuery) {
    const since = Math.floor(requestNow() / 1000) - query.windowMinutes * 60
    // Vail's call search is partial; the parser enforces an exact callsign match.
    // Fetch a fresh, bounded window across modes instead of accumulating a stream.
    return getJson(
      `${endpoint}?call=${encodeURIComponent(query.call)}&since=${since}&limit=${maxReports}`,
    )
  }

  function clip(
    snapshot: RbnSnapshot,
    at: number,
    state: NonNullable<RbnSnapshot['refresh']>['state'] = snapshot.refresh?.state ?? 'attempted',
  ): RbnSnapshot {
    const reports = snapshot.reports.filter(
      (report) => report.timeMs >= at - snapshot.windowMinutes * 60_000,
    )
    return {
      ...snapshot,
      storageWarning,
      refresh: {
        state,
        manualAtMs: state === 'offline' || state === 'pending' ? null : rateLimitedUntil,
        automaticAtMs:
          state === 'offline' || state === 'pending'
            ? null
            : Math.max(rateLimitedUntil, (snapshot.lastAttemptMs ?? 0) + refreshIntervalMs),
      },
      reports,
      status:
        snapshot.status === 'ready' || snapshot.status === 'empty'
          ? reports.length
            ? 'ready'
            : 'empty'
          : snapshot.status,
    }
  }

  function pendingSnapshot(entry: Entry): RbnSnapshot {
    return clip(
      {
        ...entry.snapshot,
        status: entry.snapshot.lastSuccessMs === null ? 'empty' : 'stale',
        error: null,
        failureKind: undefined,
      },
      requestNow(),
      'pending',
    )
  }

  function pruneCache(): void {
    for (const [key, entry] of cache) {
      if (cache.size <= maxEntries) break
      if (!entry.inFlight) cache.delete(key)
    }
  }

  async function getSnapshot(
    query: RbnQuery,
    requestOptions: RbnRequestOptions = {},
  ): Promise<RbnSnapshot> {
    // SDK panel clocks supply real epoch milliseconds independently of developer
    // time travel. Older hosts omit this field, so retain the injected fallback.
    const suppliedTime = requestOptions.realNowMillis
    const newSample = typeof suppliedTime === 'number' && Number.isFinite(suppliedTime)
    if (newSample) {
      realClockSample = Math.max(realClockSample ?? suppliedTime, suppliedTime)
      sampleRevision++
    }
    const call = normalizeCall(query.call)
    const windowMinutes = Number.isFinite(query.windowMinutes)
      ? Math.min(120, Math.max(5, Math.round(query.windowMinutes)))
      : 30
    const normalized = { call, windowMinutes }
    const time = requestNow()
    const initial: RbnSnapshot = {
      ...normalized,
      reports: [],
      status: 'error',
      lastAttemptMs: null,
      lastSuccessMs: null,
      error: null,
      capped: false,
    }
    if (!isValidCall(call))
      return { ...initial, error: 'Set a valid station callsign to see RBN reports.' }
    if (options.storage) await restore(time)
    const key = `${call}|${windowMinutes}`
    const wasAwaitingTiming = cache.get(key)?.snapshot.pendingRequestTiming !== undefined
    if (finalizeTiming(requestNow(), newSample) && options.storage) await save(requestNow())
    let entry = cache.get(key)
    // Offline/backoff prevent new requests; neither cancels a request already
    // running. Keep its pending status so the panel continues its short tick.
    if (entry?.inFlight)
      return requestOptions.waitForRequest === false
        ? pendingSnapshot(entry)
        : entry.inFlight.then((snapshot) => clip(snapshot, requestNow()))
    if (requestOptions.online === false) {
      const previous = entry?.snapshot ?? initial
      return clip(
        {
          ...previous,
          status: previous.lastSuccessMs === null ? 'error' : 'stale',
          error: 'RBN is offline. Cached reports are shown when available.',
          failureKind: 'offline',
        },
        requestNow(),
        'offline',
      )
    }
    if (time < rateLimitedUntil) {
      const previous = entry?.snapshot ?? initial
      return clip(
        {
          ...previous,
          status: previous.lastSuccessMs === null ? 'error' : 'stale',
          error: rateLimitMessage,
          failureKind: 'rate-limit',
        },
        requestNow(),
        'rate-limit',
      )
    }
    if (entry) {
      cache.delete(key)
      cache.set(key, entry)
      if (wasAwaitingTiming && !entry.snapshot.pendingRequestTiming && !requestOptions.force)
        return clip(entry.snapshot, requestNow(), 'attempted')
      if (
        !requestOptions.force &&
        entry.snapshot.lastAttemptMs !== null &&
        time >= entry.snapshot.lastAttemptMs &&
        time - entry.snapshot.lastAttemptMs < refreshIntervalMs
      ) {
        return clip(entry.snapshot, requestNow(), 'cooldown')
      }
    } else {
      // Concurrent calls for many different queries cannot grow this cache indefinitely.
      pruneCache()
      if (
        cache.size >= maxEntries &&
        [...cache.values()].every((candidate) => candidate.inFlight)
      ) {
        return { ...initial, error: 'RBN is refreshing other station views. Try again shortly.' }
      }
      entry = { snapshot: initial }
      cache.set(key, entry)
      pruneCache()
    }
    const current = entry
    const previousAttempt = current.snapshot.lastAttemptMs
    current.inFlight = (async () => {
      let fetchStartedAt: number | undefined
      let succeeded = false
      let requestSent = true
      try {
        // Persist the attempt before sending so restarting cannot reset the budget.
        // Keep the old attempt if the shared transport reports no request was sent.
        current.snapshot = { ...current.snapshot, lastAttemptMs: time }
        if (options.storage) await save(time)
        fetchStartedAt = requestNow()
        const response = await getReports(normalized)
        let result: ReturnType<typeof parseRbnPayload>
        try {
          result = parseRbnPayload(response.payload, call, windowMinutes, requestNow(), maxReports)
        } catch {
          throw new RbnRequestError(
            'response',
            `Vail ReRBN returned an unsupported data format (HTTP ${response.status}).`,
          )
        }
        current.snapshot = {
          ...normalized,
          ...result,
          status: result.reports.length ? 'ready' : 'empty',
          lastAttemptMs: time,
          lastSuccessMs: requestNow(),
          error: null,
        }
        succeeded = true
      } catch (error) {
        const failure = requestFailure(error)
        requestSent = failure.requestSent
        if (failure.retryAtMs !== undefined)
          rateLimitedUntil = Math.max(rateLimitedUntil, failure.retryAtMs)
        current.snapshot = {
          ...current.snapshot,
          status: current.snapshot.lastSuccessMs === null ? 'error' : 'stale',
          lastAttemptMs: failure.requestSent ? time : previousAttempt,
          failureKind: failure.kind,
          error: failure.message,
        }
      } finally {
        if (fetchStartedAt !== undefined && requestSent) {
          if (realClockSample === undefined) {
            current.snapshot.lastRequestDurationMs = Math.max(0, requestNow() - fetchStartedAt)
            current.snapshot.lastRequestDurationUpperBound = false
          } else {
            delete current.snapshot.lastRequestDurationMs
            delete current.snapshot.lastRequestDurationUpperBound
            current.snapshot.pendingRequestTiming = { startedAtMs: fetchStartedAt, succeeded }
            current.timingSampleRevision = sampleRevision
          }
        }
        if (options.storage) await save(requestNow())
        current.inFlight = undefined
        pruneCache()
      }
      return clip(
        current.snapshot,
        requestNow(),
        requestNow() < rateLimitedUntil ? 'rate-limit' : 'attempted',
      )
    })()
    return requestOptions.waitForRequest === false ? pendingSnapshot(current) : current.inFlight
  }

  return { getSnapshot }
}
