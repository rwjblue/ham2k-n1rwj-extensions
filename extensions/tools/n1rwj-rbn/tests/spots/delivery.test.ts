import type { Spot } from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import type { RbnCluster } from '../../src/cluster/index.ts'
import { createLiveSpots } from '../../src/spots/live.ts'

const start = Date.parse('2026-11-28T18:00:00Z')

function spot(call: string, freq = 14025): Spot {
  return {
    key: `${call}|20m|CW`,
    their: { call },
    freq,
    band: '20m',
    mode: 'CW',
    spot: { source: 'n1rwj-rbn', timeInMillis: start },
  }
}

function fixture(initial: Spot[]) {
  vi.useFakeTimers({ now: start, toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] })
  let reports = initial
  let changed = () => {}
  const status = { state: 'connected', lastReportAt: { CW: start } } as const
  const cluster: RbnCluster = {
    renew() {},
    release() {},
    pause() {},
    resume() {},
    getStatus: () => status,
    getSnapshot: () => ({ ...status, reports: [] }),
    reportsForSpot: () => [],
    observe(callback) {
      changed = callback
      return () => {}
    },
    hook: { async onLines() {} },
  }
  const publisher = {
    replace: vi.fn(async (_spots: Spot[]) => {}),
    put: vi.fn(async (_spots: Spot[]) => {}),
    remove: vi.fn(async (_keys: string[]) => {}),
  }
  const live = createLiveSpots(
    cluster,
    { setTimeout: (callback, delay) => Number(setTimeout(callback, delay)), clearTimeout },
    Date.now,
    publisher,
  )
  live.renew({
    enabled: true,
    mode: 'CW',
    render: () => reports,
    async fallback() {},
    nextVailRequestAt: () => 0,
  })
  return {
    live,
    publisher,
    update(spots: Spot[]) {
      reports = spots
      changed()
    },
    deliver: () => vi.advanceTimersByTimeAsync(300),
  }
}

afterEach(() => vi.useRealTimers())

it('updates only changed keys and deletes before adding at capacity', async () => {
  const kept = spot('W1AW')
  const moved = spot('K1TTT')
  const expired = spot('K1ABC')
  const retained = Array.from({ length: 4997 }, (_, i) => spot(`K${i}ZZ`))
  const initial = [kept, moved, expired, ...retained]
  const s = fixture(initial)
  await s.live.syncSnapshot(initial)
  await s.deliver()
  const retuned = spot('K1TTT', 14027)
  const added = spot('K1XYZ')
  const next = [spot('W1AW'), retuned, added, ...retained]
  s.update(next)
  await s.deliver()

  expect(s.publisher.remove).toHaveBeenCalledExactlyOnceWith([expired.key])
  expect(s.publisher.put).toHaveBeenCalledExactlyOnceWith([retuned, added])
  expect(s.publisher.remove.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
    s.publisher.put.mock.invocationCallOrder[0] ?? -Infinity,
  )
  s.update([...next].reverse())
  await s.deliver()
  expect(s.publisher.replace).toHaveBeenCalledExactlyOnceWith(initial)
  expect(s.publisher.put).toHaveBeenCalledTimes(1)
  expect(s.publisher.remove).toHaveBeenCalledTimes(1)
})

it('repairs an incomplete delta with a replacement on the next delivery', async () => {
  const old = spot('W1AW')
  const replacement = spot('K1TTT')
  const s = fixture([old])
  await s.live.syncSnapshot([old])
  await s.deliver()
  s.publisher.put.mockRejectedValueOnce(new Error('host refused'))
  s.update([replacement])
  await s.deliver()
  expect(s.publisher.remove).toHaveBeenCalledExactlyOnceWith([old.key])
  expect(s.publisher.put).toHaveBeenCalledExactlyOnceWith([replacement])

  s.update([replacement])
  await s.deliver()
  expect(s.publisher.replace.mock.calls).toEqual([[[old]], [[replacement]]])
  expect(s.publisher.put).toHaveBeenCalledTimes(1)
})

it('puts the fetch replacement after an in-flight delta and before later deltas', async () => {
  const first = spot('W1AW')
  const newer = spot('K1TTT')
  const newest = spot('K1ABC')
  const s = fixture([first])
  await s.live.syncSnapshot([first])
  await s.deliver()
  let acknowledge = () => {}
  s.publisher.put.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve
      }),
  )
  s.update([first, newer])
  await s.deliver()
  expect(s.publisher.put).toHaveBeenCalledExactlyOnceWith([newer])

  const barrier = s.live.syncSnapshot([first])
  s.update([first, newest])
  await s.deliver()
  expect(s.publisher.replace).toHaveBeenCalledTimes(1)
  acknowledge()
  await barrier
  expect(s.publisher.replace.mock.calls).toEqual([[[first]], [[first]]])

  await s.deliver()
  expect(s.publisher.put.mock.calls).toEqual([[[newer]], [[newest]]])
  expect(s.publisher.replace.mock.invocationCallOrder[1] ?? Infinity).toBeLessThan(
    s.publisher.put.mock.invocationCallOrder[1] ?? -Infinity,
  )
})
