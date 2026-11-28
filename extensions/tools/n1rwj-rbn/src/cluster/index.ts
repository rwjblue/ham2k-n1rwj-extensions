import type { ClusterHook, ClusterStatus } from '@ham2k/extension-sdk'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { normalizeCall, type RbnReport } from '../model.ts'
import { bands, spotKey } from '../spots/model.ts'
import { type ClusterRbnMode, clusterSkimmerLines, parseClusterReport } from './parser.ts'
import { type ClusterSetupHost, createClusterFeedSetup } from './skimmer-setup.ts'

interface ClusterHost extends TimerDriver, ClusterSetupHost {
  clusterSubscribe(args: { match: RegExp[] }): Promise<ClusterStatus>
  clusterUnsubscribe(): Promise<ClusterStatus>
}

interface RbnClusterStatus {
  state: 'idle' | 'connecting' | 'connected' | 'unavailable'
  error?: string
  lastReportAt: Readonly<Partial<Record<string, number>>>
  lastSpotsReportAt?: Readonly<Partial<Record<string, number>>>
}

export interface RbnClusterSnapshot extends RbnClusterStatus {
  reports: readonly RbnReport[]
}

export type RbnClusterChange = { keys: ReadonlySet<string> } | { reset: true }

export interface RbnCluster {
  renew(key: string, leaseMs: number, call?: string): void
  release(key: string): void
  pause(): void
  resume(): void
  getStatus(): RbnClusterStatus
  getSnapshot(call?: string, maxAgeMs?: number): RbnClusterSnapshot
  reportsForSpot(key: string): Iterable<RbnReport>
  observe(listener: (change?: RbnClusterChange) => void): () => void
  hook: ClusterHook
}

const pollMs = 5_000
const reportAgeMs = 60 * 60_000
const maxDeliveryAgeMs = 30_000
const maxClockLeadMs = 5_000
// Give contest CW ten minutes at about 167 reports/second before board filters.
const maxReportsPerMode: Record<ClusterRbnMode, number> = {
  CW: 100_000,
  RTTY: 12_500,
  FT4: 12_500,
  FT8: 12_500,
}
const maxWatchedCalls = 8
const maxReportsPerCall = 500
const spotsBands = new Set<string>(bands.map(({ name }) => name))

type ReportTimes = Partial<Record<ClusterRbnMode | 'all', number>>

function noteReceipt(times: ReportTimes, mode: ClusterRbnMode, at: number) {
  times[mode] = Math.max(times[mode] ?? 0, at)
  times.all = Math.max(times.all ?? 0, at)
}

function retain(reports: Map<string, RbnReport>, key: string, report: RbnReport, limit: number) {
  reports.set(key, report)
  if (reports.size <= limit) return
  const oldest = reports.entries().next().value
  if (oldest === undefined) return
  reports.delete(oldest[0])
  return oldest[1]
}

/** One read subscription shared by all interested views in this extension. */
export function createRbnCluster(host: ClusterHost, now = Date.now): RbnCluster {
  const wake = createTimerSlot(host)
  const configure = createClusterFeedSetup(host, now)
  const leases = new Map<string, { expires: number; call?: string }>()
  const cache = new Map<ClusterRbnMode, Map<string, RbnReport>>()
  const reportsBySpot = new Map<string, Set<RbnReport>>()
  const watched = new Map<string, Map<string, RbnReport>>()
  const listeners = new Set<(change?: RbnClusterChange) => void>()
  let paused = false
  let leaseClock = 0
  let wakeAt: number | undefined
  let pollAt = 0
  let generation = 0
  let subscribedAt: number | undefined
  let reconciling = false
  let pending = false
  let lastSeq = 0
  let node: string | undefined
  let loginCall: string | undefined
  let unsupported = false
  let manuallyDisconnected = false
  let state: RbnClusterSnapshot['state'] = 'idle'
  let error: string | undefined
  let lastReportAt: ReportTimes = {}
  let lastSpotsReportAt: ReportTimes = {}

  const wanted = () => !paused && leases.size > 0
  const current = (request: number) => request === generation && wanted()

  function notify(change?: RbnClusterChange) {
    for (const listener of [...listeners]) {
      try {
        listener(change)
      } catch {
        // Each view observes the same cache independently.
      }
    }
  }

  function resetFreshness() {
    lastReportAt = {}
    lastSpotsReportAt = {}
  }

  function readStatus(at: number): RbnClusterStatus {
    const clockRewound = (lastReportAt.all ?? 0) > at + maxClockLeadMs
    return {
      state,
      error,
      lastReportAt: clockRewound ? {} : { ...lastReportAt },
      lastSpotsReportAt: clockRewound ? {} : { ...lastSpotsReportAt },
    }
  }

  function update(
    next: RbnClusterSnapshot['state'],
    reason?: string,
    reset = false,
    change?: RbnClusterChange,
  ) {
    const changed = next !== state || reason !== error || reset
    state = next
    error = reason
    if (state !== 'connected' || reset) resetFreshness()
    if (changed || change) notify(change)
  }

  function unlinkReport(report: RbnReport) {
    const key = spotKey(report.call, report.band, report.mode)
    const reports = reportsBySpot.get(key)
    reports?.delete(report)
    if (reports?.size === 0) reportsBySpot.delete(key)
    return key
  }

  function pruneReports() {
    const cutoff = now() - reportAgeMs
    for (const reports of cache.values()) {
      for (const [key, report] of reports) {
        if (report.timeMs >= cutoff) continue
        reports.delete(key)
        unlinkReport(report)
      }
    }
    for (const reports of watched.values()) {
      for (const [key, report] of reports) {
        if (report.timeMs < cutoff) reports.delete(key)
      }
    }
  }

  function updateWatchedCalls() {
    const calls = new Set([...leases.values()].map(({ call }) => call))
    for (const call of watched.keys()) {
      if (!calls.has(call)) watched.delete(call)
    }
    for (const call of calls) {
      if (!call || watched.has(call) || watched.size >= maxWatchedCalls) continue
      const reports = new Map<string, RbnReport>()
      for (const source of cache.values()) {
        for (const [key, report] of source) {
          if (report.call === call) retain(reports, key, report, maxReportsPerCall)
        }
      }
      watched.set(call, reports)
    }
  }

  function applyStatus(status: ClusterStatus, request: number) {
    if (status.error === 'unsupported') unsupported = true
    const nextNode = status.node && `${status.node.host}:${status.node.port}`
    const nodeChanged = Boolean(node && nextNode && node !== nextNode)
    const callChanged = Boolean(loginCall && status.call && loginCall !== status.call)
    node = nextNode || node
    loginCall = status.call || loginCall
    if (nodeChanged) {
      cache.clear()
      reportsBySpot.clear()
      for (const reports of watched.values()) reports.clear()
    }
    if (nodeChanged || callChanged || status.state !== 'connected') {
      lastSeq = Math.max(lastSeq, status.lastSeq || 0)
    }
    if (status.state === 'idle' && !status.error && subscribedAt !== undefined) {
      // The host parks a manually disconnected session. Calling subscribe again
      // would unpark it, even when the operator still wants it disconnected.
      manuallyDisconnected = true
    }
    if (status.state === 'connected') manuallyDisconnected = false
    const next =
      status.state === 'connected' || status.state === 'connecting' ? status.state : 'unavailable'
    update(
      next,
      status.error,
      nodeChanged || callChanged,
      nodeChanged ? { reset: true } : undefined,
    )
    if (status.state === 'connected') {
      // Setup runs beside live delivery and the initial Vail request.
      void configure(
        status,
        () => current(request) && subscribedAt === request && state === 'connected',
      )
    }
  }

  async function reconcile() {
    if (subscribedAt !== undefined && (subscribedAt !== generation || !wanted())) {
      subscribedAt = undefined
      try {
        await host.clusterUnsubscribe()
      } catch {
        // The host clears the subscription on runtime replacement as well.
      }
    }
    if (!wanted() || unsupported) return
    const request = generation
    try {
      const status = await host.clusterStatus()
      if (!current(request)) return
      if (
        subscribedAt !== undefined ||
        status.error === 'unsupported' ||
        status.error === 'off' ||
        (manuallyDisconnected && status.state !== 'connected')
      ) {
        applyStatus(status, request)
        return
      }
      lastSeq = Math.max(lastSeq, status.lastSeq || 0)
      update('connecting')
      if (!current(request)) return
      // Record the attempt before awaiting it. Even a failed request may have
      // registered with the host and must be released once demand expires.
      subscribedAt = request
      const result = await host.clusterSubscribe({ match: [clusterSkimmerLines] })
      if (current(request)) applyStatus(result, request)
    } catch {
      if (current(request)) update('unavailable')
    }
  }

  function requestReconcile() {
    pending = true
    if (reconciling) return
    reconciling = true
    void drainReconcile()
  }

  async function drainReconcile() {
    try {
      while (pending) {
        pending = false
        await reconcile()
      }
    } finally {
      reconciling = false
    }
  }

  function stop() {
    generation++
    wake.cancel()
    wakeAt = undefined
    watched.clear()
    update('idle')
    requestReconcile()
  }

  function schedule() {
    if (!wanted() || wakeAt !== undefined) return
    const next = Math.min(pollAt, ...[...leases.values()].map(({ expires }) => expires))
    wakeAt = next
    wake.schedule(next - leaseClock, () => {
      wakeAt = undefined
      leaseClock = next
      const previousSize = leases.size
      for (const [key, { expires }] of leases) {
        if (expires <= leaseClock) leases.delete(key)
      }
      if (!wanted()) {
        stop()
        return
      }
      if (previousSize !== leases.size) updateWatchedCalls()
      if (pollAt <= leaseClock) {
        pollAt = leaseClock + pollMs
        pruneReports()
        requestReconcile()
      }
      schedule()
    })
  }

  const hook: ClusterHook = {
    async onLines({ lines }, ctx) {
      if (!ctx.online || !wanted() || subscribedAt !== generation || state !== 'connected') return
      const at = now()
      const clockRewound = (lastReportAt.all ?? 0) > at + maxClockLeadMs
      if (clockRewound) resetFreshness()
      const changedKeys = new Set<string>()
      for (const line of lines) {
        if (!Number.isSafeInteger(line.seq) || line.seq <= lastSeq) continue
        lastSeq = line.seq
        const deliveryAge = at - line.at
        if (deliveryAge > maxDeliveryAgeMs || deliveryAge < -maxClockLeadMs) continue
        const report = parseClusterReport(line)
        if (!report) continue
        const reports = cache.get(report.mode) ?? new Map<string, RbnReport>()
        cache.set(report.mode, reports)
        // Real decodes can change signal or speed in the same UTC minute.
        const key = [
          report.call,
          report.receiver,
          report.mode,
          report.frequencyKhz,
          report.timeMs,
          report.snrDb,
          report.wpm,
        ].join('|')
        if (reports.has(key)) continue
        const evicted = retain(reports, key, report, maxReportsPerMode[report.mode])
        if (evicted) changedKeys.add(unlinkReport(evicted))
        const stationKey = spotKey(report.call, report.band, report.mode)
        const stationReports = reportsBySpot.get(stationKey) ?? new Set<RbnReport>()
        reportsBySpot.set(stationKey, stationReports)
        stationReports.add(report)
        changedKeys.add(stationKey)
        const callReports = watched.get(report.call)
        if (callReports?.has(key)) continue
        if (callReports) retain(callReports, key, report, maxReportsPerCall)
        noteReceipt(lastReportAt, report.mode, line.at)
        if (spotsBands.has(report.band)) noteReceipt(lastSpotsReportAt, report.mode, line.at)
      }
      if (changedKeys.size) notify({ keys: changedKeys })
      else if (clockRewound) notify()
    },
  }

  return {
    renew(key, leaseMs, call) {
      if (paused || !Number.isFinite(leaseMs) || leaseMs <= 0) return
      const watch = call ? normalizeCall(call) : undefined
      const starting = !leases.size
      // Expiration uses host delays, independent of the app's developer clock.
      // Renewing between wakes rounds up by at most one polling interval.
      const prior = leases.get(key)
      leases.set(key, { expires: (wakeAt ?? leaseClock) + leaseMs, call: watch })
      if (prior?.call !== watch) updateWatchedCalls()
      if (starting) {
        pollAt = leaseClock + pollMs
        if (unsupported) update('unavailable', 'unsupported')
        else {
          update('connecting')
          requestReconcile()
        }
      }
      schedule()
    },
    release(key) {
      if (!leases.delete(key)) return
      if (!leases.size) stop()
      else updateWatchedCalls()
    },
    pause() {
      if (paused) return
      paused = true
      leases.clear()
      stop()
    },
    resume() {
      paused = false
    },
    getStatus: () => readStatus(now()),
    getSnapshot(call, maxAgeMs = reportAgeMs) {
      const at = now()
      const watch = call ? normalizeCall(call) : undefined
      const callReports = watch ? watched.get(watch) : undefined
      const sources = callReports ? [callReports] : cache.values()
      return {
        ...readStatus(at),
        reports: [...sources].flatMap((reports) => {
          const recent = []
          for (const report of reports.values()) {
            if (
              report.timeMs >= at - maxAgeMs &&
              report.timeMs <= at + maxClockLeadMs &&
              (!watch || report.call === watch)
            ) {
              recent.push(report)
            }
          }
          return recent.reverse()
        }),
      }
    },
    reportsForSpot(key) {
      const reports = reportsBySpot.get(key)
      return reports ? [...reports].reverse() : []
    },
    observe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    hook,
  }
}
