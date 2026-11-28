import type { Spot } from '@ham2k/extension-sdk'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import type { RbnCluster } from '../cluster/index.ts'

declare const performance: { now(): number }

const spotLeaseMs = 150_000
const silenceMs = 300_000
const publishDelayMs = 250
// HaLo allows timers 10% of elapsed time. Use at most about half of that for
// board delivery so the cluster's housekeeping and other RBN timers have room.
const publishCooldownMultiplier = 20
export const maxLiveBoardSpots = 5000

export interface SpotPublisher {
  replace(spots: Spot[]): Promise<void>
  put(spots: Spot[]): Promise<void>
  remove(keys: string[]): Promise<void>
}

interface SpotDemand {
  enabled: boolean
  mode: string
  render(): Spot[] | undefined
  fallback(): Promise<void>
  nextVailRequestAt(): number
}

interface PublishedSpot {
  spot: Spot
  signature?: string
}

function signatureOf(entry: PublishedSpot): string {
  entry.signature ??= JSON.stringify(entry.spot)
  return entry.signature
}

export function createLiveSpots(
  cluster: RbnCluster,
  timers: TimerDriver,
  now: () => number,
  publisher: SpotPublisher,
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
  let published: Map<string, PublishedSpot> | undefined
  let publication: Promise<void> | undefined
  let lifecycle = 0
  let nextDeliveryAt = 0

  function scheduleDelivery() {
    const delay = Math.max(publishDelayMs, nextDeliveryAt - performance.now())
    delivery.schedule(Math.ceil(delay), () => void deliver())
  }

  function queueDelivery() {
    if (!demand || queued) return
    queued = true
    if (!running) scheduleDelivery()
  }

  async function serialize(write: () => Promise<void>) {
    const previous = publication
    let release!: () => void
    const completion = new Promise<void>((resolve) => {
      release = resolve
    })
    publication = completion
    try {
      if (previous) await previous
      await write()
    } finally {
      if (publication === completion) publication = undefined
      release()
    }
  }

  function snapshotOf(spots: Spot[]) {
    const snapshot = new Map<string, PublishedSpot>()
    for (const spot of spots) {
      const key = spot.key
      // An unkeyed or ambiguous snapshot can only be replaced as a whole.
      if (!key || snapshot.has(key)) return undefined
      const previous = published?.get(key)
      snapshot.set(key, previous?.spot === spot ? previous : { spot })
    }
    return snapshot
  }

  async function publish(spots: Spot[], replace = false) {
    const started = lifecycle
    const before = published
    const after = snapshotOf(spots)
    try {
      if (replace || !before || !after) {
        await publisher.replace(spots)
      } else {
        const remove = [...before.keys()].filter((key) => !after.has(key))
        const put: Spot[] = []
        for (const [key, entry] of after) {
          const previous = before.get(key)
          if (!previous || (previous !== entry && signatureOf(previous) !== signatureOf(entry))) {
            put.push(entry.spot)
          }
        }
        // Make room before adding rows: each host call enforces the source cap.
        if (remove.length) await publisher.remove(remove)
        if (started !== lifecycle) return
        if (put.length) await publisher.put(put)
      }
      if (started === lifecycle) published = after
    } catch (error) {
      // An earlier part of the delta may have landed. Replace on the next write.
      published = undefined
      throw error
    }
  }

  function publishBoard(active: SpotDemand) {
    const startedAt = performance.now()
    try {
      const spots = active.render()
      if (spots) return publish(spots)
    } finally {
      // Measure rendering, diffing and the sync part of the first host call.
      // Work after the host reply runs outside the timer callback.
      const finishedAt = performance.now()
      const cost = finishedAt - startedAt + 1 // HaLo's per-wake charge.
      nextDeliveryAt = finishedAt + cost * publishCooldownMultiplier
    }
  }

  async function deliver() {
    running = true
    try {
      await serialize(async () => {
        queued = false
        if (demand) await publishBoard(demand)
      })
    } catch {
      // The next board fetch can restore the snapshot if the host refused a push.
    } finally {
      running = false
      if (queued && demand) scheduleDelivery()
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
    const status = cluster.getStatus()
    const arrivals = status.lastSpotsReportAt ?? status.lastReportAt
    const next = status.state === 'connected' ? arrivals[demand.mode] : undefined
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
    const enabled = demand?.enabled
    demand = undefined
    latest = undefined
    fresh = false
    queued = false
    lifecycle++
    published = undefined
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
      leaseEnd = now() + spotLeaseMs
      lease.schedule(spotLeaseMs, pause)
      configure(active, spotLeaseMs)
    },
    change(active: SpotDemand) {
      if (!demand) return
      configure(active, Math.max(1, leaseEnd - now()))
      queueDelivery()
    },
    syncSnapshot(spots: Spot[]) {
      const requested = lifecycle
      // HaLo replays pushes that land during its fetch. Replace before returning
      // the same snapshot there so it cannot replay older deltas onto new rows.
      return serialize(async () => {
        if (requested === lifecycle) await publish(spots, true)
      })
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
