import type { FetchOptions, FetchResponse } from '@ham2k/extension-sdk'
import { normalizeCall } from '../../../../../packages/reception/src/callsign.ts'
import type {
  ReceptionDirection,
  ReceptionReport,
} from '../../../../../packages/reception/src/reports.ts'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
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

/** One extension-wide queue. Visible render ticks drive automatic work; no timers. */
export function createHistoryClient(
  host: HistoryHost,
  ingest: (reports: ReceptionReport[]) => void,
  now = Date.now,
  watched: (call: string, direction: ReceptionDirection) => boolean = () => true,
) {
  const entries = new Map<string, Entry>()
  let nextRequest = 0
  let failures = 0
  let restored: Promise<void> | undefined
  let running: { entry: Entry; promise: Promise<void> } | undefined
  const queued = new Map<Entry, Promise<void>>()
  let online = true
  let generation = 0
  let realClockSample: number | undefined
  let sampleRevision = 0
  const keyFor = (call: string, direction: ReceptionDirection) =>
    `${direction}:${normalizeCall(call)}`
  const current = (entry: Entry) => entries.get(keyFor(entry.call, entry.direction)) === entry
  const active = (entry: Entry) =>
    current(entry) && now() - entry.seen <= 30_000 && watched(entry.call, entry.direction)

  function sampleClock(realNowMillis: number | undefined) {
    if (typeof realNowMillis !== 'number' || !Number.isFinite(realNowMillis)) return
    realClockSample = Math.max(realClockSample ?? realNowMillis, realNowMillis)
    sampleRevision++
    for (const entry of entries.values()) {
      const timing = entry.pendingTiming
      if (!timing || timing.sampleRevision === sampleRevision) continue
      // The sandbox's Date may follow a virtual clock. A fresh host sample
      // bounds completion through this render without extrapolating from Date.
      entry.lastRequestDurationMs = Math.max(0, realClockSample - timing.startedAt)
      entry.lastRequestDurationUpperBound = true
      delete entry.pendingTiming
    }
  }

  async function restore() {
    restored ??= host.read(storageKey).then((value) => {
      if (typeof value === 'number' && Number.isFinite(value))
        nextRequest = Math.max(nextRequest, Math.min(value, now() + 60 * 60_000))
    })
    await restored
  }

  function request(entry: Entry, force: boolean): Promise<void> {
    if (running) {
      if (!force || running.entry === entry) return running.promise
      const previous = queued.get(entry)
      if (previous) return previous
      // Coalesce a different panel's forced reload while it waits its turn.
      const epoch = generation
      const pending = running.promise
        .then(() => {
          queued.delete(entry)
          if (epoch !== generation || !online || !active(entry)) return
          return request(entry, true)
        })
        .finally(() => {
          if (queued.get(entry) === pending) queued.delete(entry)
        })
      queued.set(entry, pending)
      return pending
    }
    const epoch = generation
    const task = (async () => {
      try {
        await restore()
        if (epoch !== generation || !online || !active(entry)) return
        if (!force && now() < nextRequest) return
        const started = now()
        const revision = entry.revision
        const window = entry.window
        entry.loading = true
        nextRequest = started + cooldown
        // Save before sending, so a reload cannot reset the automatic budget.
        await host.write(storageKey, nextRequest)
        if (epoch !== generation || !online || !active(entry)) return
        const sampled = realClockSample !== undefined
        const requestStarted = realClockSample ?? now()
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
            report.timeMs <= now() + 60_000,
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
        nextRequest = Math.max(
          nextRequest,
          now() + Math.min(60 * 60_000, cooldown * 2 ** Math.min(failures++, 4)),
        )
        // Failed reads may recover later; never let storage failure create a request loop.
        restored = undefined
        try {
          await host.write(storageKey, nextRequest)
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
    })
    running = { entry, promise }
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
    const time = now()
    const key = keyFor(call, direction)
    for (const [id, entry] of entries) if (time - entry.seen > 60 * 60_000) entries.delete(id)
    let entry = entries.get(key)
    const minutes = [15, 30, 60].includes(window) ? window : 15
    if (!entry) {
      entry = {
        call: normalizeCall(call),
        direction,
        window: minutes,
        seen: time,
        connected,
        revision: 0,
        needed: true,
        loading: false,
      }
      entries.set(key, entry)
      if (entries.size > 32) entries.delete(entries.keys().next().value as string)
    } else {
      if (
        time - entry.seen > 30_000 ||
        time < entry.seen ||
        entry.connected !== connected ||
        minutes > entry.window
      ) {
        entry.needed = true
        entry.revision++
      }
      entry.window = Math.max(entry.window, minutes)
      entry.seen = time
      entry.connected = connected
    }
    if (online && !running && !queued.size && time >= nextRequest) {
      const pending = [...entries.values()].find(
        (candidate) => candidate.needed && active(candidate),
      )
      if (pending) void request(pending, false)
    }
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
      if (!online || !pskTopic(call, direction)) return
      const entry = entries.get(keyFor(call, direction))
      if (!entry) return
      const minutes = [15, 30, 60].includes(window) ? window : 15
      if (minutes > entry.window) entry.revision++
      entry.window = Math.max(entry.window, minutes)
      entry.seen = now()
      entry.needed = true
      await request(entry, true)
    },
    stop() {
      generation++
      entries.clear()
      queued.clear()
      online = false
    },
  }
}
