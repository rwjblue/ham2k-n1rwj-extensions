import type { FetchOptions, FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { normalizeCall } from '../../../../../packages/reception/src/callsign.ts'
import type {
  ReceptionDirection,
  ReceptionReport,
} from '../../../../../packages/reception/src/reports.ts'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { pskTopic } from '../data/subscriptions.ts'
import { historyLimit, parseHistoryXml } from './parser.ts'

export interface HistoryHost extends PersistentStorage {
  fetch: (url: string, options: FetchOptions) => Promise<FetchResponse>
}

export interface HistoryStatus {
  message: string
  pending: boolean
  warning?: string
  lastRequestDurationMs?: number
  lastRequestDurationUpperBound?: boolean
}

interface Entry {
  call: string
  direction: ReceptionDirection
  window: number
  seen: number
  connected: boolean
  revision: number
  needed: boolean
  loading: boolean
  warning?: string
  lastRequestDurationMs?: number
  lastRequestDurationUpperBound?: boolean
  pendingTiming?: { startedAt: number; sampleRevision: number }
}

const cooldown = 5 * 60_000
const maximumCooldown = 60 * 60_000
const storageKey = 'psk-history-next-request-v1'

function requestWarning(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : ''
  const detail = message
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Strip control characters from host-provided diagnostics.
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const bounded = detail.length > 300 ? `${detail.slice(0, 300)}…` : detail
  const timeout = /\b(?:TimeoutException|TimeoutError|ETIMEDOUT|timed?\s*out|timeout)\b/i.test(
    detail,
  )
  return `History unavailable: ${timeout ? 'request timed out in the host' : 'host request failed'}; no HTTP response was available.${bounded ? ` Host detail: ${bounded}` : ' The host supplied no error detail.'}`
}

export function historyUrl(call: string, direction: ReceptionDirection, window: number): string {
  const field = direction === 'outgoing' ? 'senderCallsign' : 'receiverCallsign'
  return `https://retrieve.pskreporter.info/query?${field}=${encodeURIComponent(call)}&flowStartSeconds=-${window * 60}&rptlimit=${historyLimit}&rronly=1&noactive=1&nolocator=1`
}

/** One extension-wide queue; timers wake eligible work without renewing visibility. */
export function createHistoryClient(
  host: HistoryHost,
  ingest: (reports: ReceptionReport[]) => void,
  now = Date.now,
  watched: (call: string, direction: ReceptionDirection) => boolean = () => true,
  timers?: TimerDriver,
) {
  const entries = new Map<string, Entry>()
  let nextRequest = 0
  let failures = 0
  let restored: Promise<void> | undefined
  let running: { entry: Entry; promise: Promise<void>; generation: number } | undefined
  const queued = new Map<Entry, Promise<void>>()
  let online = true
  let generation = 0
  let realClockSample: number | undefined
  let sampleRevision = 0
  let schedulingTime: number | undefined
  const wake = timers ? createTimerSlot(timers) : undefined
  const expiry = timers ? createTimerSlot(timers) : undefined
  let cooldownPending = false
  let cooldownRevision = 0
  let cooldownWrites: Promise<void> = Promise.resolve()
  let stopped = false
  const time = () => (timers ? (schedulingTime ?? realClockSample ?? now()) : now())
  const keyFor = (call: string, direction: ReceptionDirection) =>
    `${direction}:${normalizeCall(call)}`
  const current = (entry: Entry) => entries.get(keyFor(entry.call, entry.direction)) === entry
  const active = (entry: Entry) =>
    current(entry) && time() - entry.seen <= 30_000 && watched(entry.call, entry.direction)

  function arm() {
    wake?.cancel()
    if (!wake || !online || stopped || running || queued.size || cooldownPending) return
    const pending = [...entries.values()].find((entry) => entry.needed && active(entry))
    if (!pending) return
    wake.schedule(0, () => {
      if (!online || running || queued.size) return
      const entry = [...entries.values()].find((candidate) => candidate.needed && active(candidate))
      if (entry) void request(entry, false)
    })
  }

  function sampleClock(realNowMillis: number | undefined) {
    if (typeof realNowMillis !== 'number' || !Number.isFinite(realNowMillis)) return
    realClockSample = Math.max(realClockSample ?? realNowMillis, realNowMillis)
    if (timers) schedulingTime = Math.max(schedulingTime ?? realNowMillis, realNowMillis)
    sampleRevision++
    for (const entry of entries.values()) {
      const timing = entry.pendingTiming
      if (!timing || timing.sampleRevision === sampleRevision || realNowMillis < timing.startedAt)
        continue
      // The sandbox's Date may follow a virtual clock. A fresh host sample
      // bounds completion through this render without extrapolating from Date.
      entry.lastRequestDurationMs = Math.max(0, realClockSample - timing.startedAt)
      entry.lastRequestDurationUpperBound = true
      delete entry.pendingTiming
    }
  }

  function writeCooldown(value: JSONValue, revision: number): Promise<void> {
    const write = cooldownWrites
      .catch(() => {})
      .then(async () => {
        if (revision !== cooldownRevision) return
        await host.write(storageKey, value)
      })
    cooldownWrites = write
    return write
  }

  function scheduleExpiry(delay: number, revision: number) {
    if (!expiry || stopped || revision !== cooldownRevision) return
    const due = Math.max(nextRequest, time() + delay)
    nextRequest = due
    expiry.schedule(delay, () => {
      if (stopped || revision !== cooldownRevision) return
      // A fired relative timeout supplies only an epoch lower bound. It must
      // never masquerade as a fresh host clock sample for request durations.
      schedulingTime = Math.max(time(), due)
      cooldownPending = false
      // Persist an expired budget only after its real delay has elapsed. A
      // reload with an uncleared record waits conservatively for its full delay.
      void writeCooldown(nextRequest, revision).catch(() => {})
      arm()
    })
  }

  async function reserve(delay: number) {
    const revision = ++cooldownRevision
    nextRequest = time() + delay
    cooldownPending = Boolean(timers)
    wake?.cancel()
    expiry?.cancel()
    try {
      await writeCooldown(
        timers ? { version: 2, nextRequest, remainingMs: delay } : nextRequest,
        revision,
      )
    } finally {
      // Start the real delay after storage settles: a slow reservation must
      // not consume the budget before the network request has even started.
      scheduleExpiry(delay, revision)
    }
  }

  async function restore() {
    restored ??= host.read(storageKey).then((value) => {
      if (stopped) return
      let delay = 0
      if (typeof value === 'number' && Number.isFinite(value)) {
        delay = Math.max(0, Math.min(value - time(), maximumCooldown))
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.version === 2 &&
        typeof value.remainingMs === 'number' &&
        Number.isFinite(value.remainingMs)
      ) {
        // The saved epoch may be a lower bound from a delayed timer. The
        // pending real delay, rather than wall-clock subtraction, protects a
        // restart even after a clock jump or a long suspension.
        delay = Math.max(0, Math.min(value.remainingMs, maximumCooldown))
      }
      if (delay > 0 && !cooldownPending) {
        nextRequest = Math.max(nextRequest, time() + delay)
        if (timers) {
          cooldownPending = true
          scheduleExpiry(delay, ++cooldownRevision)
        }
      }
    })
    try {
      await restored
    } catch (error) {
      restored = undefined
      throw error
    }
  }

  function request(entry: Entry, force: boolean): Promise<void> {
    if (running) {
      if (!force || (running.entry === entry && running.generation === generation))
        return running.promise
      const previous = queued.get(entry)
      if (previous) return previous
      // Coalesce a different panel's forced reload while it waits its turn.
      const epoch = generation
      const pending = running.promise
        .then(() => {
          if (queued.get(entry) === pending) queued.delete(entry)
          if (epoch !== generation || !online || !active(entry)) return
          return request(entry, true)
        })
        .finally(() => {
          if (queued.get(entry) === pending) queued.delete(entry)
          arm()
        })
      queued.set(entry, pending)
      return pending
    }
    const epoch = generation
    const task = (async () => {
      try {
        await restore()
        if (epoch !== generation || !online || !active(entry)) return
        if (!force && (timers ? cooldownPending : time() < nextRequest)) return
        const started = time()
        const revision = entry.revision
        const window = entry.window
        entry.loading = true
        // Save before sending, so a reload cannot reset the automatic budget.
        await reserve(cooldown)
        if (epoch !== generation || !online || !active(entry)) return
        const sampled = Boolean(timers) || realClockSample !== undefined
        const requestStarted = timers ? time() : (realClockSample ?? time())
        let response: FetchResponse
        try {
          response = await host.fetch(historyUrl(entry.call, entry.direction, window), {
            headers: { Accept: 'application/xml, text/xml' },
          })
        } catch (error) {
          throw new Error(requestWarning(error))
        } finally {
          if (epoch === generation && current(entry)) {
            if (sampled) {
              delete entry.lastRequestDurationMs
              delete entry.lastRequestDurationUpperBound
              if (realClockSample !== undefined)
                entry.pendingTiming = { startedAt: requestStarted, sampleRevision }
            } else {
              entry.lastRequestDurationMs = Math.max(0, now() - requestStarted)
              entry.lastRequestDurationUpperBound = false
            }
          }
        }
        if (epoch !== generation || !online || !active(entry)) return
        if (response.status !== 200)
          throw new Error(`History unavailable: HTTP ${response.status}.`)
        const parsed = parseHistoryXml(response.body)
        const reports = parsed.reports.filter(
          (report) =>
            (entry.direction === 'outgoing' ? report.transmitter.call : report.receiver.call) ===
              entry.call &&
            report.timeMs >= started - window * 60_000 &&
            report.timeMs <= time() + 60_000,
        )
        ingest(reports)
        failures = 0
        entry.needed = entry.revision !== revision
        entry.warning = parsed.incomplete
          ? 'History may be incomplete: the response limit was reached or some records were unsupported.'
          : undefined
      } catch (error) {
        if (epoch !== generation) return
        entry.needed = true
        entry.warning =
          error instanceof Error && error.message.startsWith('History unavailable:')
            ? error.message
            : 'History unavailable: request or cooldown storage failed.'
        const delay = Math.max(
          nextRequest - time(),
          Math.min(maximumCooldown, cooldown * 2 ** Math.min(failures++, 4)),
        )
        // Storage failure still consumes the in-memory budget, never a tight retry loop.
        try {
          await reserve(delay)
        } catch {
          /* In-memory backoff remains. */
        }
      } finally {
        entry.loading = false
        // Rotate attempted work so one failing callsign cannot starve another panel.
        if (current(entry)) {
          entries.delete(keyFor(entry.call, entry.direction))
          entries.set(keyFor(entry.call, entry.direction), entry)
        }
      }
    })()
    const promise = task.finally(() => {
      if (running?.promise === promise) running = undefined
      arm()
    })
    running = { entry, promise, generation: epoch }
    return promise
  }

  function observe(
    call: string,
    direction: ReceptionDirection,
    window: number,
    connected: boolean,
    isOnline: boolean,
    realNowMillis?: number,
  ): HistoryStatus {
    sampleClock(realNowMillis)
    online = isOnline
    if (!pskTopic(call, direction)) return { message: '', pending: false }
    const observedAt = time()
    const key = keyFor(call, direction)
    for (const [id, entry] of entries) if (observedAt - entry.seen > 60 * 60_000) entries.delete(id)
    let entry = entries.get(key)
    const minutes = [15, 30, 60].includes(window) ? window : 15
    if (!entry) {
      entry = {
        call: normalizeCall(call),
        direction,
        window: minutes,
        seen: observedAt,
        connected,
        revision: 0,
        needed: true,
        loading: false,
      }
      entries.set(key, entry)
      if (entries.size > 32) entries.delete(entries.keys().next().value as string)
    } else {
      if (
        observedAt - entry.seen > 30_000 ||
        observedAt < entry.seen ||
        entry.connected !== connected ||
        minutes > entry.window
      ) {
        entry.needed = true
        entry.revision++
      }
      entry.window = Math.max(entry.window, minutes)
      entry.seen = observedAt
      entry.connected = connected
    }
    if (
      online &&
      !stopped &&
      !running &&
      !queued.size &&
      (timers ? !cooldownPending : observedAt >= nextRequest)
    ) {
      const pending = [...entries.values()].find(
        (candidate) => candidate.needed && active(candidate),
      )
      if (pending) void request(pending, false)
    }
    arm()
    const pending = entry.loading || running?.entry === entry || queued.has(entry)
    const message = pending
      ? 'Loading recent reports'
      : entry.needed
        ? !online
          ? 'History paused while offline'
          : entry.warning
            ? 'History unavailable'
            : 'Collection gap · history queued'
        : entry.warning
          ? 'History may be incomplete'
          : 'Recent history loaded'
    return {
      message,
      pending,
      warning: pending ? undefined : entry.warning,
      lastRequestDurationMs: pending ? undefined : entry.lastRequestDurationMs,
      lastRequestDurationUpperBound: pending ? undefined : entry.lastRequestDurationUpperBound,
    }
  }

  return {
    observe,
    async force(
      call: string,
      direction: ReceptionDirection,
      window: number,
      isOnline: boolean,
      realNowMillis?: number,
    ) {
      sampleClock(realNowMillis)
      online = isOnline
      if (!online || stopped || !pskTopic(call, direction)) return
      const entry = entries.get(keyFor(call, direction))
      if (!entry) return
      const minutes = [15, 30, 60].includes(window) ? window : 15
      if (minutes > entry.window) entry.revision++
      entry.window = Math.max(entry.window, minutes)
      entry.seen = time()
      entry.needed = true
      await request(entry, true)
    },
    reconcile: arm,
    pause() {
      generation++
      online = false
      queued.clear()
      wake?.cancel()
      for (const entry of entries.values()) {
        entry.needed = true
        entry.revision++
      }
    },
    stop() {
      generation++
      stopped = true
      cooldownRevision++
      entries.clear()
      queued.clear()
      online = false
      wake?.cancel()
      expiry?.cancel()
    },
  }
}
