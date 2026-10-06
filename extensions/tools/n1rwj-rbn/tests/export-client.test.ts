import { expect, it, vi } from 'vitest'
import { createRbnClient } from '../src/data/client.ts'
import { NOW, payload } from './data/fixtures.ts'

it('collects raw response evidence once per real request, including rows hidden by the display', async () => {
  const finish = vi.fn()
  const prepare = vi.fn(() => finish)
  const raw = payload()
  const client = createRbnClient({
    now: () => NOW,
    fetch: async () => ({ status: 200, body: JSON.stringify(raw) }),
    prepareCollection: prepare,
  })
  await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
  await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
  expect(prepare).toHaveBeenCalledTimes(1)
  expect(prepare).toHaveBeenCalledWith({ call: 'N1RWJ', windowMinutes: 15 }, NOW)
  expect(finish).toHaveBeenCalledWith({
    startedAtMs: NOW,
    retrievedAtMs: NOW,
    status: 200,
    payload: raw,
  })
})
it('records failed requests without creating observations from old cached reports', async () => {
  const finish = vi.fn()
  const client = createRbnClient({
    now: () => NOW,
    fetch: async () => {
      throw new Error('timeout')
    },
    prepareCollection: () => finish,
  })
  await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
  expect(finish).toHaveBeenCalledOnce()
  expect(finish.mock.calls[0][0]).toMatchObject({ startedAtMs: NOW, retrievedAtMs: NOW })
  expect(finish.mock.calls[0][0].error).toContain('timeout')
  expect(finish.mock.calls[0][0].payload).toBeUndefined()
})

it('reads exact-call snapshots without fetching, changing visibility, or exposing mutable cache rows', async () => {
  let now = NOW
  const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
  const setTimeout = vi.fn(() => 1)
  const client = createRbnClient({
    now: () => now,
    fetch,
    timers: { setTimeout, clearTimeout: vi.fn() },
  })
  await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
  fetch.mockClear()
  setTimeout.mockClear()
  const snapshots = await client.readSnapshots?.('n1rwj')
  expect(snapshots).toHaveLength(1)
  if (!snapshots?.[0].reports[0]) throw new Error('Missing cached observation')
  snapshots[0].reports[0].snrDb = 999
  expect((await client.readSnapshots?.('N1RWJ'))?.[0].reports[0].snrDb).not.toBe(999)
  expect(await client.readSnapshots?.('N1RWJ/P')).toEqual([])
  now += 20 * 60_000
  expect((await client.readSnapshots?.('N1RWJ'))?.[0].reports).toEqual([])
  expect(fetch).not.toHaveBeenCalled()
  expect(setTimeout).not.toHaveBeenCalled()
})
