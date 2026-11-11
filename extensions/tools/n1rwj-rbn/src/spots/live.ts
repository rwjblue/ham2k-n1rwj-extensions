import type { Spot } from '@ham2k/extension-sdk'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import type { RbnCluster } from '../cluster/index.ts'

const spotLeaseMs = 150_000
const silenceMs = 300_000
const publishDelayMs = 250
export const maxLiveBoardSpots = 5000

interface SpotDemand {
  enabled: boolean
  mode: string
  render(): Spot[] | undefined
  fallback(): Promise<void>
  nextVailRequestAt(): number
}

export function createLiveSpots(
  cluster: RbnCluster,
  timers: TimerDriver,
  now: () => number,
  publish: (spots: Spot[]) => Promise<void>,
) {
  const lease = createTimerSlot(timers)
  const silence = createTimerSlot(timers)
  const delivery = createTimerSlot(timers)
  let demand: SpotDemand | undefined
  let leaseEnd = 0
  let latest: number | undefined
  let fresh = false
  let running = false
  let queued = false
  let lastDelivery: string | undefined

  function queueDelivery() {
    if (!demand || queued) return
    queued = true
    if (!running) delivery.schedule(publishDelayMs, () => void deliver())
  }

  async function deliver() {
    const active = demand
    queued = false
    if (!active) return
    running = true
    try {
      const spots = active.render()
      if (!spots) return
      const signature = JSON.stringify(spots)
      if (signature !== lastDelivery) {
        await publish(spots)
        lastDelivery = signature
      }
    } catch {
      // The next board fetch can restore the snapshot if the host refused a push.
    } finally {
      running = false
      if (queued && demand) delivery.schedule(publishDelayMs, () => void deliver())
    }
  }

  function attemptFallback() {
    const active = demand
    if (!active?.enabled || fresh) return
    void active.fallback().then(queueDelivery, queueDelivery)
  }

  function stopUsingLive() {
    if (!demand || !fresh) return
    fresh = false
    const delay = demand.nextVailRequestAt() - now()
    if (delay > 0) silence.schedule(delay, attemptFallback)
    else attemptFallback()
  }

  function observe() {
    if (!demand?.enabled) return
    const snapshot = cluster.getSnapshot()
    const arrivals = snapshot.lastSpotsReportAt ?? snapshot.lastReportAt
    const next = snapshot.state === 'connected' ? arrivals[demand.mode] : undefined
    if (next !== latest) {
      latest = next
      silence.cancel()
      const age = next === undefined ? Infinity : now() - next
      if (age >= 0 && age < silenceMs) {
        fresh = true
        silence.schedule(silenceMs - age, stopUsingLive)
      } else {
        stopUsingLive()
      }
    }
    queueDelivery()
  }

  cluster.observe(observe)

  function pause() {
    if (!demand) return
    const enabled = demand.enabled
    demand = undefined
    latest = undefined
    fresh = false
    queued = false
    lastDelivery = undefined
    lease.cancel()
    silence.cancel()
    delivery.cancel()
    if (enabled) cluster.release('spots')
  }

  function configure(active: SpotDemand, duration: number) {
    const previous = demand
    if (previous?.mode !== active.mode || previous?.enabled !== active.enabled) {
      latest = undefined
      fresh = false
      silence.cancel()
    }
    demand = active
    if (active.enabled) {
      cluster.renew('spots', duration)
      observe()
    } else if (previous?.enabled) {
      cluster.release('spots')
    }
  }

  return {
    renew(active: SpotDemand) {
      // The board's refresh replaces this source's previous publication.
      lastDelivery = undefined
      leaseEnd = now() + spotLeaseMs
      lease.schedule(spotLeaseMs, pause)
      configure(active, spotLeaseMs)
    },
    change(active: SpotDemand) {
      if (!demand) return
      configure(active, Math.max(1, leaseEnd - now()))
      queueDelivery()
    },
    pause,
    queueDelivery,
    get active() {
      return demand !== undefined
    },
    get fresh() {
      return fresh
    },
  }
}
