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
