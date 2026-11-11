import type { ClusterStatus } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRbnCluster } from '../../src/cluster/index.ts'
import { latestReports } from '../../src/model.ts'

const NOW = Date.parse('2026-11-11T17:10:15Z')
const defaultNode = { name: 'Test Node', host: 'test.example', port: 7300 }
const status = (
  state: ClusterStatus['state'],
  rest: Partial<ClusterStatus> = {},
): ClusterStatus => ({
  state,
  node: defaultNode,
  lastSeq: 12,
  ...rest,
})

function setup(now?: () => number) {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  let reply = status('connected')
  const host = {
    setTimeout: (callback: () => void, delay: number) => Number(setTimeout(callback, delay)),
    clearTimeout: (id: number) => clearTimeout(id),
    clusterStatus: vi.fn(async () => reply),
    clusterSubscribe: vi.fn(async () => reply),
    clusterUnsubscribe: vi.fn(async () => reply),
    clusterLines: vi.fn(async () => []),
    clusterSend: vi.fn(async () => ({ ok: true, lines: [] })),
  }
  const cluster = createRbnCluster(host, now)
  return {
    host,
    cluster,
    setStatus: (next: ClusterStatus) => {
      reply = next
    },
  }
}

const cw = 'DX de W1NT-#: 7002.5 WI3W CW 22dB 27 WPM FN20 1710Z'
const ft8 = 'DX de W1NT-#: 7074.1 WI3W FT8 -14dB FN20 1710Z'
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

afterEach(() => vi.useRealTimers())

describe('shared cluster demand', () => {
  it('shares a read subscription and polls status without subscribing again', async () => {
    const { cluster, host } = setup()
    cluster.renew('map', 20_000)
    cluster.renew('spots', 30_000)
    await tick()
    expect(cluster.getSnapshot().state).toBe('connected')
    expect(host.clusterSubscribe).toHaveBeenCalledWith({ match: [expect.any(RegExp)] })
    await tick(5_000)
    expect(host.clusterStatus).toHaveBeenCalledTimes(2)
    expect(host.clusterSubscribe).toHaveBeenCalledTimes(1)
    cluster.release('map')
    await tick()
    expect(host.clusterUnsubscribe).not.toHaveBeenCalled()
    cluster.release('spots')
    await tick()
    expect(host.clusterUnsubscribe).toHaveBeenCalledTimes(1)
    expect(cluster.getSnapshot().state).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('expires a lease on host timers with a frozen developer clock', async () => {
    const { cluster, host } = setup(() => NOW)
    cluster.renew('panel', 7_000)
    await tick(6_999)
    expect(host.clusterUnsubscribe).not.toHaveBeenCalled()
    await tick(1)
    expect(host.clusterUnsubscribe).toHaveBeenCalledOnce()
    expect(cluster.getSnapshot().state).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up an in-flight subscription before a resumed lease connects', async () => {
    const { cluster, host } = setup()
    const order: string[] = []
    let finish!: (value: ClusterStatus) => void
    host.clusterSubscribe
      .mockImplementationOnce(() => {
        order.push('subscribe')
        return new Promise((resolve) => (finish = resolve))
      })
      .mockImplementationOnce(async () => {
        order.push('subscribe')
        return status('connected')
      })
    host.clusterUnsubscribe.mockImplementationOnce(async () => {
      order.push('unsubscribe')
      return status('idle')
    })
    cluster.renew('map', 20_000)
    await tick()
    cluster.pause()
    cluster.renew('background board', 50_000)
    expect(cluster.getSnapshot().state).toBe('idle')
    cluster.resume()
    cluster.renew('visible board', 10_000)
    finish(status('connected'))
    await tick()
    expect(order).toEqual(['subscribe', 'unsubscribe', 'subscribe'])
    expect(cluster.getSnapshot().state).toBe('connected')
    await tick(10_000)
    expect(host.clusterUnsubscribe).toHaveBeenCalledTimes(2)
    expect(cluster.getSnapshot().state).toBe('idle')
  })

  it('does not keep checking the unsupported browser host', async () => {
    const { cluster, host, setStatus } = setup()
    setStatus(status('failed', { error: 'unsupported' }))
    cluster.renew('map', 30_000)
    await tick()
    expect(cluster.getSnapshot()).toMatchObject({ state: 'unavailable', error: 'unsupported' })
    await tick(15_000)
    expect(host.clusterStatus).toHaveBeenCalledOnce()
    expect(host.clusterSubscribe).not.toHaveBeenCalled()
    await tick(15_000)
    expect(cluster.getSnapshot().state).toBe('idle')
  })

  it('reports off without subscribing, then subscribes once when enabled', async () => {
    const { cluster, host, setStatus } = setup()
    setStatus(status('failed', { error: 'off' }))
    cluster.renew('map', 30_000)
    await tick()
    expect(cluster.getSnapshot()).toMatchObject({ state: 'unavailable', error: 'off' })
    expect(host.clusterSubscribe).not.toHaveBeenCalled()
    setStatus(status('connected'))
    await tick(5_000)
    expect(cluster.getSnapshot().state).toBe('connected')
    expect(host.clusterSubscribe).toHaveBeenCalledOnce()
  })
})

describe('cluster reports', () => {
  it('uses receipt time for feed freshness while retaining a grouped CW report time', async () => {
    const { cluster } = setup()
    cluster.renew('spots', 60_000)
    await tick()
    const text = 'DX de W1NT-#: 7002.5 WI3W CW 22dB Q:3+ Z:5 1705Z'
    await cluster.hook.onLines(
      {
        lines: [
          { seq: 13, at: NOW - 30_001, text },
          { seq: 14, at: NOW, text },
        ],
      },
      { online: true },
    )
    expect(cluster.getSnapshot()).toMatchObject({
      lastReportAt: { CW: NOW, all: NOW },
      lastSpotsReportAt: { CW: NOW, all: NOW },
      reports: [{ id: 'cluster:0000000000000014', timeMs: Date.parse('2026-11-11T17:05:00Z') }],
    })
  })

  it('preserves exact watched reports when unrelated traffic fills the global cache', async () => {
    const { cluster } = setup()
    cluster.renew('map', 60_000, 'WI3W')
    cluster.renew('second map', 60_000, 'WI3W')
    cluster.renew('spots', 60_000)
    await tick()
    await cluster.hook.onLines({ lines: [{ seq: 13, at: NOW, text: cw }] }, { online: true })
    await cluster.hook.onLines(
      {
        lines: Array.from({ length: 1_300 }, (_, index) => ({
          seq: 14 + index,
          at: NOW,
          text: cw.replace('WI3W', `K${index}X`),
        })),
      },
      { online: true },
    )
    expect(cluster.getSnapshot().reports).toHaveLength(1250)
    expect(cluster.getSnapshot().reports.some(({ call }) => call === 'WI3W')).toBe(false)
    expect(cluster.getSnapshot('WI3W').reports.map(({ call }) => call)).toEqual(['WI3W'])
    cluster.release('map')
    expect(cluster.getSnapshot('WI3W').reports).toHaveLength(1)
    cluster.release('second map')
    expect(cluster.getSnapshot('WI3W').reports).toEqual([])
    expect(cluster.getSnapshot().state).toBe('connected')
  })

  it('tracks separate board freshness for its supported bands', async () => {
    const { cluster } = setup()
    cluster.renew('map', 60_000, 'WI3W')
    await tick()
    await cluster.hook.onLines(
      { lines: [{ seq: 13, at: NOW, text: ft8.replace('7074.1', '50313') }] },
      { online: true },
    )
    expect(cluster.getSnapshot('WI3W')).toMatchObject({
      lastReportAt: { FT8: NOW, all: NOW },
      lastSpotsReportAt: {},
      reports: [{ band: '6m' }],
    })
    await cluster.hook.onLines({ lines: [{ seq: 14, at: NOW, text: cw }] }, { online: true })
    expect(cluster.getSnapshot().lastSpotsReportAt).toEqual({ CW: NOW, all: NOW })
  })

  it('validates both sides of the receipt clock and hides future cache rows on rewind', async () => {
    const { cluster } = setup()
    cluster.renew('map', 60_000, 'WI3W')
    await tick()
    await cluster.hook.onLines(
      {
        lines: [
          { seq: 13, at: NOW - 30_001, text: cw.replace('1710Z', '1709Z') },
          { seq: 14, at: NOW + 5_001, text: cw },
          { seq: 15, at: NOW, text: ft8 },
        ],
      },
      { online: true },
    )
    expect(cluster.getSnapshot('WI3W').lastReportAt).toEqual({ FT8: NOW, all: NOW })
    expect(cluster.getSnapshot('WI3W').reports).toHaveLength(1)
    vi.setSystemTime(NOW - 5 * 60_000)
    expect(cluster.getSnapshot('WI3W')).toMatchObject({ reports: [], lastReportAt: {} })
    await cluster.hook.onLines(
      { lines: [{ seq: 16, at: Date.now(), text: cw.replace('1710Z', '1705Z') }] },
      { online: true },
    )
    expect(cluster.getSnapshot('WI3W').lastReportAt).toEqual({ CW: Date.now(), all: Date.now() })
  })

  it('tracks fresh receipt by mode and rejects pre-subscription and old or duplicate lines', async () => {
    const { cluster } = setup()
    const listener = vi.fn()
    const stopObserving = cluster.observe(listener)
    cluster.renew('spots', 60_000)
    await tick()
    listener.mockClear()
    await cluster.hook.onLines(
      {
        lines: [
          { seq: 12, at: NOW, text: ft8 },
          { seq: 13, at: NOW, text: ft8.replace('1710Z', '1708Z') },
          { seq: 14, at: NOW, text: cw },
          { seq: 15, at: NOW + 1000, text: cw },
          { seq: 16, at: NOW + 1000, text: ft8 },
        ],
      },
      { online: true },
    )
    expect(cluster.getSnapshot().lastReportAt).toEqual({
      CW: NOW,
      FT8: NOW + 1000,
      all: NOW + 1000,
    })
    expect(cluster.getSnapshot().reports.map(({ id }) => id)).toEqual([
      'cluster:0000000000000014',
      'cluster:0000000000000016',
    ])
    expect(listener).toHaveBeenCalledOnce()
    stopObserving()
    cluster.release('spots')
    expect(listener).toHaveBeenCalledOnce()
    expect(cluster.getSnapshot().lastReportAt).toEqual({})
    expect(cluster.getSnapshot().reports).toHaveLength(2)
  })

  it('retains later measured changes in a UTC minute and accepts CW with no speed', async () => {
    const { cluster } = setup()
    cluster.renew('map', 60_000, 'WI3W')
    await tick()
    await cluster.hook.onLines(
      { lines: [{ seq: 98, at: NOW, text: cw.replace('27 WPM ', '') }] },
      { online: true },
    )
    expect(cluster.getSnapshot().lastSpotsReportAt).toEqual({ CW: NOW, all: NOW })
    await cluster.hook.onLines(
      {
        lines: [
          { seq: 99, at: NOW + 1000, text: cw },
          { seq: 100, at: NOW + 2000, text: cw.replace('27 WPM', '30 WPM') },
          {
            seq: 101,
            at: NOW + 3000,
            text: cw.replace('22dB', '30dB').replace('27 WPM', '30 WPM'),
          },
          {
            seq: 102,
            at: NOW + 4000,
            text: cw.replace('22dB', '30dB').replace('27 WPM', '30 WPM'),
          },
        ],
      },
      { online: true },
    )
    const snapshot = cluster.getSnapshot('WI3W')
    expect(snapshot.lastSpotsReportAt).toEqual({ CW: NOW + 3000, all: NOW + 3000 })
    expect(snapshot.reports.map(({ snrDb, wpm }) => [snrDb, wpm])).toEqual([
      [30, 30],
      [22, 30],
      [22, 27],
      [22, null],
    ])
    expect(latestReports(snapshot.reports)).toMatchObject([{ snrDb: 30, wpm: 30 }])
    cluster.release('map')
    expect(cluster.getSnapshot().lastSpotsReportAt).toEqual({})
  })

  it('keeps recent rows across a drop, resets freshness, and waits for a manual reconnect', async () => {
    const { cluster, host, setStatus } = setup()
    cluster.renew('spots', 60_000)
    await tick()
    await cluster.hook.onLines({ lines: [{ seq: 13, at: NOW, text: cw }] }, { online: true })
    setStatus(status('failed', { error: 'disconnected', lastSeq: 13 }))
    await tick(5_000)
    expect(cluster.getSnapshot()).toMatchObject({
      state: 'unavailable',
      error: 'disconnected',
      lastReportAt: {},
    })
    expect(cluster.getSnapshot().reports).toHaveLength(1)
    setStatus(status('connected', { lastSeq: 13 }))
    await tick(5_000)
    expect(cluster.getSnapshot().lastReportAt).toEqual({})
    expect(host.clusterSubscribe).toHaveBeenCalledOnce()

    setStatus(status('idle', { lastSeq: 13 }))
    await tick(5_000)
    cluster.release('spots')
    await tick()
    cluster.renew('spots', 60_000)
    await tick()
    expect(host.clusterSubscribe).toHaveBeenCalledOnce()
    expect(cluster.getSnapshot().state).toBe('unavailable')
    setStatus(status('connected', { lastSeq: 13 }))
    await tick(5_000)
    expect(host.clusterSubscribe).toHaveBeenCalledTimes(2)
  })

  it('clears the old node reports and ages inactive reports out', async () => {
    const { cluster, setStatus } = setup()
    cluster.renew('spots', 30_000)
    await tick()
    await cluster.hook.onLines({ lines: [{ seq: 13, at: NOW, text: cw }] }, { online: true })
    setStatus(status('connected', { node: { ...defaultNode, host: 'other.example' }, lastSeq: 13 }))
    await tick(5_000)
    expect(cluster.getSnapshot().reports).toEqual([])
    await cluster.hook.onLines(
      { lines: [{ seq: 14, at: NOW + 5_000, text: cw }] },
      { online: true },
    )
    cluster.release('spots')
    expect(cluster.getSnapshot().reports).toHaveLength(1)
    await tick(60 * 60_000)
    expect(cluster.getSnapshot().reports).toEqual([])
  })
})
