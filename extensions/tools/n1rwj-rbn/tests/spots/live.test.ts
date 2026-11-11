import type { FetchResponse, JSONValue, Spot } from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import type { RbnCluster } from '../../src/cluster/index.ts'
import type { RbnReport } from '../../src/model.ts'
import { createRbnSpots } from '../../src/spots/index.ts'

const start = Date.parse('2026-11-11T19:00:00Z')

function fixture(settings: Record<string, JSONValue> = {}) {
  vi.useFakeTimers({ now: start })
  let preferences: Record<string, JSONValue> = {
    spotMode: 'CW',
    spotContinents: ['NA'],
    ...settings,
  }
  let listener = () => {}
  let snapshot: ReturnType<RbnCluster['getSnapshot']> = {
    state: 'idle',
    reports: [],
    lastReportAt: {},
  }
  const cluster: RbnCluster = {
    renew: vi.fn(),
    release: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getSnapshot: () => snapshot,
    observe(callback) {
      listener = callback
      return () => {}
    },
    hook: { async onLines() {} },
  }
  const fetch = vi.fn(
    async (_url: string): Promise<FetchResponse> => ({
      status: 200,
      body: JSON.stringify({
        spots: [
          {
            callsign: 'K1ABC',
            spotter: 'K1TTT',
            frequency: 14030,
            mode: 'CW',
            wpm: 28,
            timestamp: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      }),
    }),
  )
  const publishSpots = vi.fn(async (_spots: Spot[]) => {})
  const runtime = createRbnSpots({
    cluster,
    publishSpots,
    fetch,
    healthTimers: {
      setTimeout(callback, delay) {
        return Number(setTimeout(callback, delay))
      },
      clearTimeout,
    },
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      preferences = { ...preferences, ...values }
    },
    lookup: (call) => ({ grid: call === 'K1TTT' ? 'FN42' : 'EM23', continent: 'NA' }),
    receiverEntries: () => [{ call: 'K1TTT', grid: 'FN42', continent: 'NA' }],
  })
  return {
    cluster,
    fetch,
    publishSpots,
    runtime,
    update(update: Partial<typeof snapshot>) {
      snapshot = { ...snapshot, ...update }
      listener()
    },
    report(fields: Partial<RbnReport> = {}): RbnReport {
      return {
        id: 'cluster/1',
        call: 'W1AW',
        receiver: 'K1TTT',
        frequencyKhz: 14025,
        band: '20m',
        mode: 'CW',
        snrDb: 10,
        wpm: 24,
        timeMs: Date.now(),
        receiverLatitude: null,
        receiverLongitude: null,
        country: null,
        ...fields,
      }
    },
    fetchBoard: () => runtime.spots.fetchSpots({}, { online: true }),
    edit: (fieldKey: string, value: string | number | boolean) =>
      runtime.settings.onChangeField(
        { panelKey: 'n1rwj-rbn', fieldKey, value, state: {} },
        { online: true },
      ),
  }
}

afterEach(() => vi.useRealTimers())

it('labels unknown live CW speed under a speed filter and still prefers the cluster', async () => {
  const s = fixture()
  s.fetch.mockResolvedValueOnce({
    status: 200,
    body: JSON.stringify({
      spots: [
        {
          callsign: 'K1ABC',
          spotter: 'K1TTT',
          frequency: 14030,
          mode: 'CW',
          timestamp: new Date(start - 1000).toISOString(),
        },
      ],
    }),
  })
  s.update({
    state: 'connected',
    lastSpotsReportAt: { CW: start },
    reports: [s.report({ wpm: null })],
  })
  const unfiltered = await s.fetchBoard()
  expect(unfiltered.map(({ their }) => their.call)).toEqual(['W1AW', 'K1ABC'])
  expect(unfiltered[0]?.spot.label).toBe('10 dB')
  await s.edit('spotMinWpm', 20)
  await vi.advanceTimersByTimeAsync(61_000)
  const filtered = await s.fetchBoard()
  expect(filtered.map(({ their }) => their.call)).toEqual(['W1AW'])
  expect(filtered[0]?.spot.label).toBe('10 dB · WPM unknown')
  expect(s.fetch).toHaveBeenCalledTimes(1)
})

it('continues enforcing the filter on known CW speed from the cluster', async () => {
  const s = fixture({ spotMinWpm: 25 })
  s.update({
    state: 'connected',
    lastSpotsReportAt: { CW: start },
    reports: [s.report({ wpm: 24 })],
  })
  expect((await s.fetchBoard()).map(({ their }) => their.call)).toEqual(['K1ABC'])
  await vi.advanceTimersByTimeAsync(61_000)
  expect((await s.fetchBoard()).map(({ their }) => their.call)).toEqual(['K1ABC'])
  expect(s.fetch).toHaveBeenCalledTimes(1)
})

it('prefers a fresh digital-only cluster in All with a CW speed range', async () => {
  const s = fixture({ spotMode: 'all', spotMinWpm: 20 })
  s.update({
    state: 'connected',
    lastSpotsReportAt: { FT8: start, all: start },
    reports: [s.report({ mode: 'FT8', wpm: null })],
  })
  expect((await s.fetchBoard()).map(({ their }) => their.call)).toEqual(['W1AW', 'K1ABC'])
  await vi.advanceTimersByTimeAsync(61_000)
  await s.fetchBoard()
  expect(s.fetch).toHaveBeenCalledTimes(1)
})

it('primes Vail, pushes live reports, and resumes Vail after a disconnect without discarding recent reports', async () => {
  const s = fixture()
  s.update({ state: 'connected', lastReportAt: { CW: start }, reports: [s.report()] })
  expect((await s.fetchBoard()).map(({ their }) => their.call)).toEqual(['W1AW', 'K1ABC'])
  expect(s.fetch).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(61_000)
  expect(await s.fetchBoard()).toHaveLength(2)
  expect(s.fetch).toHaveBeenCalledTimes(1)
  s.update({ reports: [s.report({ call: 'W1AW/P' })], lastReportAt: { CW: Date.now() } })
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0].map(({ their }) => their.call)).toEqual([
    'W1AW/P',
    'K1ABC',
  ])

  s.update({ state: 'unavailable', lastReportAt: {} })
  await vi.advanceTimersByTimeAsync(300)
  expect(s.fetch).toHaveBeenCalledTimes(2)
  expect(s.publishSpots.mock.lastCall?.[0].map(({ their }) => their.call)).toEqual([
    'W1AW/P',
    'K1ABC',
  ])
})

it('falls back when the selected mode goes quiet despite new reports in another mode', async () => {
  const s = fixture()
  s.update({ state: 'connected', lastReportAt: { CW: start, all: start }, reports: [s.report()] })
  await s.fetchBoard()
  for (let count = 0; count < 2; count++) {
    await vi.advanceTimersByTimeAsync(120_000)
    s.update({ lastReportAt: { CW: start, FT8: Date.now(), all: Date.now() } })
    await s.fetchBoard()
  }
  expect(s.fetch).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(59_999)
  expect(s.fetch).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(301)
  expect(s.fetch).toHaveBeenCalledTimes(2)
})

it('honors the Vail cooldown on disconnect without waiting for another board refresh', async () => {
  const s = fixture()
  s.update({ state: 'connected', lastReportAt: { CW: start }, reports: [s.report()] })
  await s.fetchBoard()
  await vi.advanceTimersByTimeAsync(10_000)
  s.update({ state: 'unavailable', lastReportAt: {} })
  await vi.advanceTimersByTimeAsync(49_999)
  expect(s.fetch).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(s.fetch).toHaveBeenCalledTimes(2)
})

it('applies receiver filters before choosing the display row and honors disabling live updates', async () => {
  const s = fixture({ spotRadiusGrid: 'FN42', spotRadiusMiles: 100 })
  s.update({
    state: 'connected',
    lastReportAt: { CW: start },
    reports: [
      s.report({ call: 'K1ABC', receiver: 'W9ABC', frequencyKhz: 14050 }),
      s.report({ call: 'K1ABC', frequencyKhz: 14026 }),
    ],
  })
  expect((await s.fetchBoard()).map(({ freq }) => freq)).toEqual([14026])
  await vi.advanceTimersByTimeAsync(61_000)
  await s.edit('liveClusterUpdates', false)
  await vi.advanceTimersByTimeAsync(300)
  expect(s.cluster.release).toHaveBeenCalledWith('spots')
  expect(s.fetch).toHaveBeenCalledTimes(2)
  expect(s.publishSpots.mock.lastCall?.[0].map(({ freq }) => freq)).toEqual([14030])
})

it('releases demand once the board stops fetching and ignores later cluster callbacks', async () => {
  const s = fixture()
  s.update({ state: 'connected', lastReportAt: { CW: start }, reports: [s.report()] })
  await s.fetchBoard()
  await vi.advanceTimersByTimeAsync(151_000)
  expect(s.cluster.release).toHaveBeenCalledWith('spots')
  s.publishSpots.mockClear()
  s.update({ state: 'unavailable', lastReportAt: {} })
  await vi.advanceTimersByTimeAsync(150_000)
  expect(s.fetch).toHaveBeenCalledTimes(1)
  expect(s.publishSpots).not.toHaveBeenCalled()
})

it('reselects healthy live Spots after a receiver edit without fetching a new Vail snapshot', async () => {
  const s = fixture()
  s.update({
    state: 'connected',
    lastReportAt: { CW: start },
    reports: [s.report(), s.report({ call: 'W9NEW', receiver: 'W9ABC' })],
  })
  expect(await s.fetchBoard()).toHaveLength(3)
  await vi.advanceTimersByTimeAsync(61_000)
  await s.edit('spotSkimmers', 'K1TTT')
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0].map(({ their }) => their.call)).toEqual([
    'W1AW',
    'K1ABC',
  ])
  expect(await s.fetchBoard()).toHaveLength(2)
  expect(s.fetch).toHaveBeenCalledTimes(1)
})

it('keeps the new receiver selection when the initial Vail request finishes late', async () => {
  const s = fixture()
  let finish: (response: FetchResponse) => void = () => {}
  s.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  s.update({
    state: 'connected',
    lastReportAt: { CW: start },
    reports: [s.report(), s.report({ call: 'W9NEW', receiver: 'W9ABC' })],
  })
  const first = s.fetchBoard()
  await vi.advanceTimersByTimeAsync(0)
  expect(s.fetch).toHaveBeenCalledTimes(1)
  await s.edit('spotSkimmers', 'W9ABC')
  finish({ status: 200, body: JSON.stringify({ spots: [] }) })
  expect((await first).map(({ their }) => their.call)).toEqual(['W9NEW'])
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0].map(({ their }) => their.call)).toEqual(['W9NEW'])
  expect(s.fetch).toHaveBeenCalledTimes(1)
})

it('keeps Spots on the supported HF bands and does not treat VHF spots as HF freshness', async () => {
  const s = fixture()
  s.update({
    state: 'connected',
    lastReportAt: { CW: start },
    lastSpotsReportAt: {},
    reports: [s.report({ band: '6m', frequencyKhz: 50080 })],
  })
  expect((await s.fetchBoard()).map(({ their }) => their.call)).toEqual(['K1ABC'])
  await vi.advanceTimersByTimeAsync(61_000)
  expect(await s.fetchBoard()).toHaveLength(1)
  expect(s.fetch).toHaveBeenCalledTimes(2)
})

it('keeps recent cluster and Vail rows while offline without maintaining the Spots lease', async () => {
  const s = fixture()
  s.update({ state: 'connected', lastReportAt: { CW: start }, reports: [s.report()] })
  await s.fetchBoard()
  const offline = await s.runtime.spots.fetchSpots({}, { online: false })
  expect(offline.map(({ their }) => their.call)).toEqual(['W1AW', 'K1ABC'])
  expect(s.fetch).toHaveBeenCalledTimes(1)
  expect(s.cluster.release).toHaveBeenCalledWith('spots')
})

it('corrects an older publication that finishes after settings change', async () => {
  const s = fixture()
  const first = s.report()
  s.update({ state: 'connected', lastReportAt: { CW: start }, reports: [first] })
  await s.fetchBoard()
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0][0]?.their.call).toBe('W1AW')

  let finish = () => {}
  s.publishSpots.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  s.update({ reports: [s.report({ call: 'W1AW/P' })] })
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0][0]?.their.call).toBe('W1AW/P')

  s.update({ reports: [first] })
  await s.edit('spotMode', 'CW')
  finish()
  await vi.advanceTimersByTimeAsync(300)
  expect(s.publishSpots.mock.lastCall?.[0][0]?.their.call).toBe('W1AW')
})
