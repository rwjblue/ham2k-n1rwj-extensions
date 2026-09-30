import type { JSONValue } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { createPersistentStorage } from '../../../../packages/reception/src/storage.ts'
import type { TimerDriver } from '../../../../packages/reception/src/timers.ts'
import { createReportCache, reportCacheKey } from '../src/data/cache.ts'
import { createReportStore } from '../src/data/store.ts'
import { createHistoryClient } from '../src/history/client.ts'

const initial = Date.UTC(2026, 8, 24, 18)
const key = 'n1rwj-psk-reporter'
const payload = (overrides = {}) =>
  JSON.stringify({
    sc: 'EA8/N1RWJ/P',
    rc: 'CU3AT/P',
    sl: 'FN42',
    rl: 'HM68',
    f: 14074000,
    md: 'FT8',
    b: '20m',
    t: initial / 1000,
    sq: 42,
    rp: -12,
    ...overrides,
  })
const flush = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve()
}
function setup(timers?: TimerDriver) {
  let now = initial
  let values: Record<string, JSONValue> = { unrelated: 'preserved' }
  const host = {
    getSettings: vi.fn(async () => ({ extensions: { [`extension_${key}`]: { ...values } } })),
    setSettings: vi.fn(async (changes: Record<string, JSONValue>) => {
      values = { ...values, ...changes }
    }),
  }
  const storage = createPersistentStorage(host, key)
  const store = createReportStore()
  const cache = createReportCache(storage, store, () => now, timers)
  return {
    host,
    storage,
    store,
    cache,
    values: () => values,
    advance: (ms: number) => {
      now += ms
    },
    now: () => now,
  }
}

function clock() {
  let elapsed = 0
  let nextId = 0
  const pending = new Map<number, { callback: () => void; due: number }>()
  const timers = {
    setTimeout: vi.fn((callback: () => void, delay: number) => {
      const id = ++nextId
      pending.set(id, { callback, due: elapsed + delay })
      return id
    }),
    clearTimeout: vi.fn((id: number) => {
      pending.delete(id)
    }),
  }
  return {
    timers,
    pending: () => pending.size,
    async advance(ms: number) {
      const target = elapsed + ms
      while (true) {
        const next = [...pending.entries()].sort((a, b) => a[1].due - b[1].due)[0]
        if (!next || next[1].due > target) break
        elapsed = next[1].due
        pending.delete(next[0])
        next[1].callback()
        await flush()
      }
      elapsed = target
    },
  }
}

it('restores a full-hour checkpoint with original age, identity and exact portable calls', async () => {
  const s = setup()
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.store.ingest(payload({ rc: 'W1AW', t: initial / 1000 - 1800 }), initial)
  s.store.restoreCapacityLoss(initial - 1000, initial)
  s.cache.tick()
  await flush()
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  expect(s.values().unrelated).toBe('preserved')
  const fresh = createReportStore()
  const cache = createReportCache(
    createPersistentStorage(s.host, key),
    fresh,
    () => initial + 60_000,
  )
  await cache.ready()
  expect(fresh.snapshot(initial + 60_000, 15)).toMatchObject({
    capped: true,
    reports: [
      {
        id: '42',
        timeMs: initial,
        transmitter: { call: 'EA8/N1RWJ/P' },
        receiver: { call: 'CU3AT/P' },
      },
    ],
  })
  expect(fresh.snapshot(initial + 60_000, 60).reports).toHaveLength(2)
  cache.tick()
  await flush()
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  expect(fresh.snapshot(initial + 3601_000, 60)).toEqual({ reports: [], capped: false })
})

it('restores a full cache of maximum-length receiver IDs with escaped fallback report IDs', async () => {
  const s = setup()
  await s.cache.ready()
  for (let index = 0; index < 1000; index++) {
    const receiver = `${'"\\'.repeat(125)}${String(index).padStart(4, '0')}`
    expect(s.store.ingest(payload({ rc: receiver, sq: undefined }), initial)).toBe(true)
  }
  const expected = s.store.snapshot(initial, 60).reports
  expect(expected).toHaveLength(1000)
  expect(expected[0].id.length).toBeGreaterThan(256)
  await s.cache.flush()
  expect(String(s.values()[reportCacheKey]).length).toBeGreaterThan(1_000_000)
  const fresh = createReportStore()
  const cache = createReportCache(s.storage, fresh, () => initial)
  await cache.ready()
  expect(cache.warning).toBeUndefined()
  expect(fresh.snapshot(initial, 60).reports).toEqual(expected)
})

it('restores receiver IDs without callsign syntax and preserves reports without valid locators', async () => {
  const s = setup()
  const receiverIds = ['SWL', 'FWG', 'I0-1589', 'US-E-015']
  await s.cache.ready()
  for (const [index, rc] of receiverIds.entries()) {
    expect(
      s.store.ingest(
        payload({ rc, rl: index < 2 ? 'HM68' : index === 2 ? undefined : 'ZZ99', sq: index + 1 }),
        initial,
      ),
    ).toBe(true)
  }
  s.cache.tick()
  await flush()
  const fresh = createReportStore()
  const cache = createReportCache(
    createPersistentStorage(s.host, key),
    fresh,
    () => initial + 60_000,
  )
  await cache.ready()
  const reports = fresh.snapshot(initial + 60_000, 15).reports
  expect(reports.map((report) => report.receiver.call)).toEqual(receiverIds)
  expect(reports.map((report) => report.id)).toEqual(['1', '2', '3', '4'])
  expect(reports.map((report) => report.receiver.location?.grid)).toEqual([
    'HM68',
    'HM68',
    undefined,
    undefined,
  ])
  expect(reports.every((report) => report.transmitter.call === 'EA8/N1RWJ/P')).toBe(true)
  expect(cache.warning).toBeUndefined()
})

it('batches writes, saves changes during an in-flight write and retries failures', async () => {
  const s = setup()
  await s.cache.ready()
  let finish!: () => void
  s.host.setSettings.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  s.store.ingest(payload(), initial)
  s.cache.tick()
  await flush()
  s.store.ingest(payload({ rc: 'W1AW' }), initial)
  s.advance(30_000)
  s.cache.tick()
  await flush()
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  finish()
  await flush()
  s.host.setSettings.mockRejectedValueOnce(new Error('disk full'))
  s.cache.tick()
  await flush()
  expect(s.cache.warning).toContain('could not be saved')
  for (let i = 0; i < 5; i++) {
    s.advance(5000)
    s.cache.tick()
    await flush()
  }
  expect(s.host.setSettings).toHaveBeenCalledTimes(2)
  s.advance(5000)
  s.cache.tick()
  await flush()
  expect(s.cache.warning).toBeUndefined()
  expect(JSON.parse(String(s.values()[reportCacheKey])).reports).toHaveLength(2)
})

it('merges a late restore without overwriting newer reports received while reading', async () => {
  let finish!: (value: JSONValue) => void
  const write = vi.fn(async () => {})
  const store = createReportStore()
  const cache = createReportCache(
    {
      read: () =>
        new Promise<JSONValue>((resolve) => {
          finish = resolve
        }),
      write,
    },
    store,
    () => initial,
  )
  const loading = cache.ready()
  store.ingest(payload({ t: initial / 1000 + 15, rp: -20 }), initial)
  finish(JSON.stringify({ version: 1, reports: [{ ...JSON.parse(payload()), id: '42' }] }))
  await loading
  expect(store.snapshot(initial, 15).reports[0].snrDb).toBe(-20)
  cache.tick()
  await flush()
  expect(write).toHaveBeenCalledTimes(1)
})

it('does not overwrite unread storage and recovers on a later render tick', async () => {
  const s = setup()
  s.host.getSettings.mockRejectedValueOnce(new Error('unavailable'))
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.tick()
  await flush()
  expect(s.cache.warning).toContain('unavailable')
  expect(s.host.setSettings).not.toHaveBeenCalled()
  s.advance(30_000)
  s.cache.tick()
  await flush()
  expect(s.host.getSettings).toHaveBeenCalledTimes(2)
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
})

it.each([
  'bad JSON',
  JSON.stringify({ version: 2, reports: [] }),
  JSON.stringify({ version: 1, reports: Array(1001).fill(null) }),
  JSON.stringify({ version: 1, reports: [], padding: ' '.repeat(2_000_001) }),
])('discards an invalid or oversized cache safely', async (value) => {
  const store = createReportStore()
  const cache = createReportCache(
    { read: async () => value, write: async () => {} },
    store,
    () => initial,
  )
  await cache.ready()
  expect(store.snapshot(initial, 60).reports).toEqual([])
  expect(cache.warning).toContain('could not be restored')
})

it('validates cached records and reconstructs locations rather than trusting stored coordinates', async () => {
  const reports = [
    null,
    { id: 'bad' },
    ...[-3601, 61, 0].map((age) => ({
      ...JSON.parse(payload({ t: initial / 1000 + age })),
      id: '42',
      latitude: 1234,
    })),
  ]
  const store = createReportStore()
  const cache = createReportCache(
    {
      read: async () => JSON.stringify({ version: 1, reports, droppedAt: initial + 60_000 }),
      write: async () => {},
    },
    store,
    () => initial,
  )
  await cache.ready()
  expect(store.snapshot(initial, 60)).toMatchObject({
    capped: false,
    reports: [{ id: '42', transmitter: { location: { source: 'reported-grid' } } }],
  })
  expect(store.snapshot(initial, 60).reports).toHaveLength(1)
})

it('persists the HTTP cooldown through settings and serializes it with report writes', async () => {
  const s = setup()
  let writing = false
  s.host.setSettings.mockImplementation(async (changes) => {
    expect(writing).toBe(false)
    writing = true
    await Promise.resolve()
    Object.assign(s.values(), changes)
    writing = false
  })
  const fetch = vi.fn(async () => ({ status: 200, body: '<pskreporter/>' }))
  const history = createHistoryClient({ ...s.storage, fetch }, () => {}, s.now)
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.tick()
  history.observe('EA8/N1RWJ/P', 'outgoing', 15, true, true)
  await flush()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(s.host.getSettings).toHaveBeenCalledTimes(1)
  expect(Object.keys(s.values())).toEqual(
    expect.arrayContaining([reportCacheKey, 'psk-history-next-request-v1', 'unrelated']),
  )
  const restarted = createHistoryClient(
    { ...createPersistentStorage(s.host, key), fetch },
    () => {},
    s.now,
  )
  restarted.observe('EA8/N1RWJ/P', 'outgoing', 15, true, true)
  await flush()
  expect(fetch).toHaveBeenCalledTimes(1)
  await restarted.force('EA8/N1RWJ/P', 'outgoing', 15, true)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('checkpoints after ingestion without more renders or advancing the sandbox date', async () => {
  const c = clock()
  const s = setup(c.timers)
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.changed()
  await flush()
  expect(c.pending()).toBe(1)
  await c.advance(20_000)
  s.store.ingest(payload({ rc: 'W1AW' }), initial)
  s.cache.changed()
  await flush()
  expect(c.pending()).toBe(1)
  await c.advance(9_999)
  expect(s.host.setSettings).not.toHaveBeenCalled()
  await c.advance(1)
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(s.values()[reportCacheKey])).reports).toHaveLength(2)
  await c.advance(60_000)
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  expect(c.pending()).toBe(0)
})

it('automatically checkpoints changes received during a write without overlapping writes', async () => {
  const c = clock()
  const s = setup(c.timers)
  await s.cache.ready()
  let finish!: () => void
  s.host.setSettings.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  s.store.ingest(payload(), initial)
  s.cache.changed()
  await flush()
  await c.advance(30_000)
  s.store.ingest(payload({ rc: 'W1AW' }), initial)
  s.cache.changed()
  await c.advance(30_000)
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  finish()
  await flush()
  await c.advance(0)
  expect(s.host.setSettings).toHaveBeenCalledTimes(2)
  expect(JSON.parse(String(s.values()[reportCacheKey])).reports).toHaveLength(2)
  await c.advance(30_000)
  expect(c.pending()).toBe(0)
})

it('retries unavailable storage before writing and retries a failed checkpoint on elapsed timers', async () => {
  const c = clock()
  const s = setup(c.timers)
  s.host.getSettings.mockRejectedValueOnce(new Error('unavailable'))
  s.host.setSettings.mockRejectedValueOnce(new Error('disk full'))
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.changed()
  await flush()
  expect(s.cache.warning).toContain('unavailable')
  await c.advance(29_999)
  expect(s.host.setSettings).not.toHaveBeenCalled()
  await c.advance(1)
  expect(s.host.getSettings).toHaveBeenCalledTimes(2)
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  expect(s.cache.warning).toContain('could not be saved')
  await c.advance(30_000)
  expect(s.host.setSettings).toHaveBeenCalledTimes(2)
  expect(s.cache.warning).toBeUndefined()
  expect(JSON.parse(String(s.values()[reportCacheKey])).reports).toHaveLength(1)
})

it.each(['read', 'write'] as const)(
  'bounds automatic %s failures and preserves the retry cooldown when activity resumes',
  async (kind) => {
    const c = clock()
    const s = setup(c.timers)
    const failing = kind === 'read' ? s.host.getSettings : s.host.setSettings
    failing.mockRejectedValue(new Error('unavailable'))
    await s.cache.ready()
    s.store.ingest(payload(), initial)
    s.cache.changed()
    await flush()
    await c.advance(kind === 'read' ? 60_000 : 90_000)
    expect(failing).toHaveBeenCalledTimes(3)
    s.store.ingest(payload({ rc: 'W1AW' }), initial)
    s.cache.changed()
    await flush()
    await c.advance(29_999)
    expect(failing).toHaveBeenCalledTimes(3)
    await c.advance(1)
    expect(failing).toHaveBeenCalledTimes(4)
    await c.advance(300_000)
    expect(failing).toHaveBeenCalledTimes(6)
    expect(c.pending()).toBe(0)
    expect(s.store.snapshot(initial, 60).reports).toHaveLength(2)
  },
)

it('flushes on visibility expiry while retaining the store and the write cooldown', async () => {
  const c = clock()
  const s = setup(c.timers)
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.changed()
  await flush()
  await s.cache.flush()
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  s.store.ingest(payload({ rc: 'W1AW' }), initial)
  s.cache.changed()
  await s.cache.flush()
  expect(s.host.setSettings).toHaveBeenCalledTimes(1)
  await c.advance(30_000)
  expect(s.host.setSettings).toHaveBeenCalledTimes(2)
  expect(s.store.snapshot(initial, 60).reports).toHaveLength(2)
})

it('cancels pending saves and ignores already queued timer callbacks after stopping', async () => {
  const c = clock()
  const s = setup(c.timers)
  await s.cache.ready()
  s.store.ingest(payload(), initial)
  s.cache.changed()
  await flush()
  const queued = c.timers.setTimeout.mock.calls[0][0]
  s.cache.stop()
  expect(c.pending()).toBe(0)
  queued()
  s.cache.changed()
  await s.cache.flush()
  await c.advance(60_000)
  expect(s.host.setSettings).not.toHaveBeenCalled()
  expect(s.store.snapshot(initial, 60).reports).toHaveLength(1)
})

it('does not restore or schedule work when an outstanding storage read finishes after stopping', async () => {
  const c = clock()
  let finish!: (value: JSONValue) => void
  const write = vi.fn(async () => {})
  const store = createReportStore()
  const cache = createReportCache(
    {
      read: () =>
        new Promise<JSONValue>((resolve) => {
          finish = resolve
        }),
      write,
    },
    store,
    () => initial,
    c.timers,
  )
  const loading = cache.ready()
  cache.stop()
  finish(JSON.stringify({ version: 1, reports: [{ ...JSON.parse(payload()), id: '42' }] }))
  await loading
  await c.advance(60_000)
  expect(store.snapshot(initial, 60).reports).toHaveLength(0)
  expect(write).not.toHaveBeenCalled()
  expect(c.pending()).toBe(0)
})
