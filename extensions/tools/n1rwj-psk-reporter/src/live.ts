import { normalizeCall } from '../../../../packages/reception/src/callsign.ts'
import type {
  ReceptionDirection,
  ReceptionReport,
} from '../../../../packages/reception/src/reports.ts'
import { createTimerSlot, type TimerDriver } from '../../../../packages/reception/src/timers.ts'
import { createReportCache } from './data/cache.ts'
import { parsePskPayload } from './data/parser.ts'
import { createReportStore } from './data/store.ts'
import { decodePskCall, pskTopic } from './data/subscriptions.ts'
import { createHistoryClient, type HistoryHost, type HistoryStatus } from './history/client.ts'
import { type ConnectionState, createMqttClient } from './transport/client.ts'
import type { OpenSocket } from './transport/socket.ts'

export interface LiveSnapshot {
  reports: ReceptionReport[]
  capped: boolean
  state: ConnectionState | 'invalid' | 'limit' | 'offline'
  message: string
  retryAt?: number
  history?: HistoryStatus
  cacheWarning?: string
}

/** One socket per extension; placements lease narrow subscriptions while rendering. */
export function createLiveReception(
  open: OpenSocket,
  now = Date.now,
  random = Math.random,
  historyHost?: HistoryHost,
  timers?: TimerDriver,
) {
  // Host samples are epoch timestamps. Relative timer delays, not the sandbox's
  // virtual Date, own protocol deadlines and the lifetime of a visible view.
  let realSample: number | undefined
  const reportNow = () => (timers ? (realSample ?? now()) : now())
  function observeTime(value?: number) {
    if (typeof value === 'number' && Number.isFinite(value))
      realSample = Math.max(realSample ?? value, value)
  }
  const leases = new Map<
    string,
    { call: string; direction: ReceptionDirection; topic: string; seen: number }
  >()
  const expiry = new Map<string, ReturnType<typeof createTimerSlot>>()
  const store = createReportStore()
  const cache = historyHost ? createReportCache(historyHost, store, reportNow, timers) : undefined
  const history = historyHost
    ? createHistoryClient(
        historyHost,
        (reports) => {
          for (const report of reports) store.ingestReport(report, reportNow())
          cache?.changed()
        },
        reportNow,
        (call, direction) =>
          [...leases.values()].some(
            (lease) =>
              lease.call === call &&
              lease.direction === direction &&
              (timers || now() - lease.seen <= 30_000),
          ),
      )
    : undefined
  const prune = () => {
    if (timers && realSample === undefined) return
    const time = reportNow()
    for (const [id, lease] of leases) {
      if (time - lease.seen > 30_000 || time < lease.seen) leases.delete(id)
    }
  }
  const client = createMqttClient({
    open,
    now: reportNow,
    timers,
    random,
    onReport(topic, payload) {
      prune()
      const report = parsePskPayload(payload)
      if (!report) return
      const parts = topic.split('/')
      if (
        parts.length !== 11 ||
        parts.slice(0, 3).join('/') !== 'pskr/filter/v2' ||
        parts[3] !== report.band ||
        parts[4].toUpperCase() !== report.mode ||
        decodePskCall(parts[5]) !== report.transmitter.call ||
        decodePskCall(parts[6]) !== report.receiver.call
      )
        return
      if (
        [...leases.values()].some(
          (lease) =>
            (lease.direction === 'incoming' ? report.receiver.call : report.transmitter.call) ===
            lease.call,
        )
      ) {
        if (store.ingest(payload, reportNow())) cache?.changed()
      }
    },
  })
  function subscriptions(renew?: string) {
    const topics = new Set([...leases.values()].map((lease) => lease.topic))
    for (const [topic, timer] of expiry) {
      if (!topics.has(topic)) {
        timer.cancel()
        expiry.delete(topic)
      }
    }
    // One expiry per distinct topic, shared by every placement watching it.
    // Eight topics plus protocol/cache/history deadlines fit the host budget.
    if (timers && renew && topics.has(renew)) {
      const timer = expiry.get(renew) ?? createTimerSlot(timers)
      expiry.set(renew, timer)
      timer.schedule(30_000, () => {
        expiry.delete(renew)
        for (const [id, lease] of leases) if (lease.topic === renew) leases.delete(id)
        subscriptions()
        if (!leases.size) void cache?.flush()
      })
    }
    client.tick([...topics])
  }
  function pause() {
    for (const timer of expiry.values()) timer.cancel()
    expiry.clear()
    leases.clear()
    client.stop()
    void cache?.flush()
  }
  return {
    restore(realNowMillis?: number) {
      observeTime(realNowMillis)
      return cache?.ready() ?? Promise.resolve()
    },
    snapshot(
      instance: string,
      call: string,
      direction: ReceptionDirection,
      windowMinutes: number,
      online: boolean,
      realNowMillis?: number,
    ): LiveSnapshot {
      observeTime(realNowMillis)
      prune()
      leases.delete(instance)
      const topic = pskTopic(call, direction)
      const topics = new Set([...leases.values()].map((lease) => lease.topic))
      let error: LiveSnapshot['state'] | undefined
      if (!online) error = 'offline'
      else if (!topic) error = 'invalid'
      else if (leases.size >= 32 || (!topics.has(topic) && topics.size >= 8)) error = 'limit'
      else leases.set(instance, { call: normalizeCall(call), direction, topic, seen: reportNow() })
      if (!online) leases.clear()
      subscriptions(error ? undefined : topic)
      const historyStatus = history?.observe(
        call,
        direction,
        windowMinutes,
        !error && client.status().state === 'live',
        online,
        realNowMillis,
      )
      const stored = {
        ...store.snapshot(reportNow(), windowMinutes),
        history: historyStatus,
        cacheWarning: cache?.warning,
      }
      cache?.tick()
      // The map's filter is also pure, but do not hand another call's data to a placement.
      stored.reports = stored.reports.filter(
        (report) =>
          (direction === 'incoming' ? report.receiver.call : report.transmitter.call) ===
          normalizeCall(call),
      )
      if (error)
        return {
          ...stored,
          state: error,
          message:
            error === 'invalid'
              ? 'Set a valid callsign to receive reports.'
              : error === 'limit'
                ? 'At most eight callsign/direction subscriptions can be active.'
                : 'Offline · reception paused',
        }
      return { ...stored, ...client.status() }
    },
    pause,
    forceHistory(
      call: string,
      direction: ReceptionDirection,
      window: number,
      online: boolean,
      realNowMillis?: number,
    ): void {
      // HTTP completion updates the shared store/status independently of the event.
      void history?.force(call, direction, window, online, realNowMillis)
    },
    stop: () => {
      cache?.stop()
      history?.stop()
      pause()
      store.clear()
    },
  }
}

export type LiveReception = ReturnType<typeof createLiveReception>
