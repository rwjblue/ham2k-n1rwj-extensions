import type { JSONValue } from '@ham2k/extension-sdk'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import type { TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { parsePskPayload } from './parser.ts'
import type { createReportStore } from './store.ts'

export const reportCacheKey = 'psk-reports-v1'
const interval = 30_000
type Store = ReturnType<typeof createReportStore>

function encode(store: Store, now: number): string {
  const { reports, droppedAt } = store.checkpoint(now)
  return JSON.stringify({
    version: 1,
    droppedAt,
    reports: reports.map((report) => ({
      id: report.id,
      sc: report.transmitter.call,
      rc: report.receiver.call,
      sl: report.transmitter.location?.grid,
      rl: report.receiver.location?.grid,
      t: report.timeMs / 1000,
      f: report.frequencyHz,
      md: report.mode,
      b: report.band,
      rp: report.snrDb,
    })),
  })
}

function restore(value: JSONValue | null, store: Store, now: number) {
  if (value === null) return
  // Freeform receiver IDs also lengthen the parser's fallback report IDs.
  if (typeof value !== 'string' || value.length > 2_000_000) throw new Error('Invalid cache')
  const saved = JSON.parse(value)
  if (saved?.version !== 1 || !Array.isArray(saved.reports) || saved.reports.length > 1000)
    throw new Error('Invalid cache')
  for (const raw of saved.reports) {
    const report = parsePskPayload(JSON.stringify(raw))
    if (report && typeof raw.id === 'string' && raw.id.length <= 640) {
      report.id = raw.id
      store.ingestReport(report, now)
    }
  }
  store.restoreCapacityLoss(saved.droppedAt, now)
}

/** Batch dirty reports even when no panel renders again. */
export function createReportCache(
  storage: PersistentStorage,
  store: Store,
  now = Date.now,
  timers?: TimerDriver,
) {
  let loaded = false
  let loading: Promise<void> | undefined
  let saving = false
  let stopped = false
  let savedRevision = 0
  let nextAttempt = 0
  let warning: string | undefined
  let timer: number | undefined
  let timerGeneration = 0
  let coolingDown = false
  let failures = 0
  const maxFailures = 3

  function cancelTimer() {
    if (timer !== undefined) timers?.clearTimeout(timer)
    timer = undefined
    timerGeneration++
  }

  function arm(delay: number) {
    if (!timers || stopped || timer !== undefined) return
    const generation = ++timerGeneration
    timer = timers.setTimeout(() => {
      if (stopped || generation !== timerGeneration) return
      timer = undefined
      coolingDown = false
      if (failures < maxFailures) void checkpoint()
    }, delay)
  }

  function postpone() {
    nextAttempt = now() + interval
    if (!timers) return
    cancelTimer()
    coolingDown = true
    arm(interval)
  }

  function canAttempt() {
    return timers ? !coolingDown : now() >= nextAttempt
  }

  function schedule(delay = interval) {
    if (!saving && savedRevision !== store.revision && failures < maxFailures) arm(delay)
  }

  function ready(): Promise<void> {
    if (loaded || stopped || !canAttempt()) return Promise.resolve()
    loading ??= (async () => {
      const before = store.revision
      try {
        const value = await storage.read(reportCacheKey)
        if (stopped) return
        const unchanged = before === store.revision
        try {
          restore(value, store, now())
          if (unchanged && before === 0) savedRevision = store.revision
          warning = undefined
        } catch {
          // Corrupt/unknown snapshots are replaceable; unavailable storage is not.
          savedRevision = -1
          warning = 'Saved reports could not be restored.'
        }
        loaded = true
        failures = 0
      } catch {
        if (stopped) return
        warning = 'Report storage unavailable; reports are kept only for this session.'
        failures++
        postpone()
      }
    })().finally(() => {
      loading = undefined
      if (loaded) schedule()
    })
    return loading
  }

  async function checkpoint() {
    await ready()
    if (!loaded || stopped || saving || !canAttempt() || savedRevision === store.revision) return
    const value = encode(store, now())
    const revision = store.revision
    saving = true
    postpone()
    try {
      await storage.write(reportCacheKey, value)
      if (stopped) return
      savedRevision = revision
      failures = 0
      warning = undefined
    } catch {
      if (stopped) return
      failures++
      warning = 'Reports could not be saved; recent reports may be lost on restart.'
    } finally {
      saving = false
      // A slow write can outlast its cooldown. Persist later revisions as soon
      // as that write finishes, without overlapping writes or losing changes.
      schedule(0)
    }
  }

  function changed() {
    if (stopped) return
    // Exhausted background attempts stay idle until activity resumes. Changes
    // during a retry window never shorten the existing cooldown.
    if (failures >= maxFailures) failures = 0
    if (timers) {
      void ready().then(() => schedule())
    } else {
      void checkpoint()
    }
  }

  return {
    ready,
    changed,
    async flush() {
      if (failures >= maxFailures) failures = 0
      await checkpoint()
    },
    get warning() {
      return warning
    },
    tick() {
      changed()
    },
    stop() {
      stopped = true
      cancelTimer()
    },
  }
}
