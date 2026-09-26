import type { FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { snapshotKey } from '../../src/data/cache.ts'
import { createRbnClient } from '../../src/data/client.ts'
import { RbnRequestError } from '../../src/data/errors.ts'
import { NOW, payload } from './fixtures.ts'

const query = { call: 'N1RWJ', windowMinutes: 30 }
const response = (status = 200): FetchResponse => ({
  status,
  body: JSON.stringify(status === 429 ? { error: { retryAfter: 120 } } : payload()),
})

function deferred() {
  let finish!: (value: FetchResponse) => void
  const promise = new Promise<FetchResponse>((resolve) => {
    finish = resolve
  })
  return { promise, finish }
}

function memoryStorage() {
  const values = new Map<string, JSONValue>()
  return {
    values,
    read: async (key: string) => values.get(key) ?? null,
    write: async (key: string, value: JSONValue) => {
      values.set(key, value)
    },
  }
}

it.each([86_400_000, -86_400_000, 800_000, 0])(
  'uses later real samples after a virtual clock change of %i ms',
  async (virtualAdvance) => {
    let virtualNow = NOW
    const request = deferred()
    const fetch = vi.fn(() => request.promise)
    const client = createRbnClient({ fetch, now: () => virtualNow })
    await client.getSnapshot(query, { realNowMillis: NOW, waitForRequest: false })
    virtualNow += virtualAdvance
    await client.getSnapshot(query, { realNowMillis: NOW + 3000, waitForRequest: false })
    const settled = client.getSnapshot(query)
    request.finish(response())
    expect((await settled).lastRequestDurationMs).toBeUndefined()
    const observed = await client.getSnapshot(query, {
      realNowMillis: NOW + 8000,
      waitForRequest: false,
    })
    expect(observed).toMatchObject({
      status: 'ready',
      lastSuccessMs: NOW + 8000,
      lastRequestDurationMs: 8000,
      lastRequestDurationUpperBound: true,
    })
    expect(observed.pendingRequestTiming).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)

it('starts a late HTTP 429 delay at the next real observation, independent of virtual time', async () => {
  let virtualNow = NOW
  const request = deferred()
  const fetch = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValue(response())
  const client = createRbnClient({ fetch, now: () => virtualNow })
  await client.getSnapshot(query, { realNowMillis: NOW, waitForRequest: false })
  const settled = client.getSnapshot(query)
  virtualNow += 86_400_000
  request.finish(response(429))
  await settled
  expect(await client.getSnapshot(query, { realNowMillis: NOW + 50_000 })).toMatchObject({
    lastRequestDurationMs: 50_000,
    refresh: { state: 'rate-limit', manualAtMs: NOW + 170_000 },
  })
  await client.getSnapshot(query, { realNowMillis: NOW + 169_999, force: true })
  expect(fetch).toHaveBeenCalledTimes(1)
  await client.getSnapshot(query, { realNowMillis: NOW + 170_000, force: true })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('preserves unfinished completion timing across restart and finalizes it only once', async () => {
  const storage = memoryStorage()
  const request = deferred()
  const fetch = vi.fn(() => request.promise)
  const create = () => createRbnClient({ fetch, storage, now: () => NOW + 86_400_000 })
  const client = create()
  await client.getSnapshot(query, { realNowMillis: NOW, waitForRequest: false })
  const settled = client.getSnapshot(query)
  request.finish(response())
  await settled
  expect(JSON.parse(String(storage.values.get(snapshotKey))).snapshots[0]).toMatchObject({
    pendingRequestTiming: { startedAtMs: NOW, succeeded: true },
  })
  const restored = await create().getSnapshot(query, { realNowMillis: NOW + 8000 })
  expect(restored).toMatchObject({
    lastSuccessMs: NOW + 8000,
    lastRequestDurationMs: 8000,
    lastRequestDurationUpperBound: true,
  })
  expect(
    (await create().getSnapshot(query, { realNowMillis: NOW + 9000 })).lastRequestDurationMs,
  ).toBe(8000)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('persists unobserved retry delays so restart cannot shorten server backoff', async () => {
  const storage = memoryStorage()
  const request = deferred()
  const fetch = vi.fn(() => request.promise)
  const create = () => createRbnClient({ fetch, storage, now: () => NOW - 86_400_000 })
  const client = create()
  await client.getSnapshot(query, { realNowMillis: NOW, waitForRequest: false })
  const settled = client.getSnapshot(query)
  request.finish(response(429))
  await settled
  expect(JSON.parse(String(storage.values.get(snapshotKey))).pendingRetryDelayMs).toBe(120_000)
  expect(
    await create().getSnapshot(query, { realNowMillis: NOW + 100_000, force: true }),
  ).toMatchObject({ refresh: { state: 'rate-limit', manualAtMs: NOW + 220_000 } })
  expect(JSON.parse(String(storage.values.get(snapshotKey))).pendingRetryDelayMs).toBe(0)
  expect(
    await create().getSnapshot(query, { realNowMillis: NOW + 101_000, force: true }),
  ).toMatchObject({ refresh: { state: 'rate-limit', manualAtMs: NOW + 220_000 } })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('keeps another query pending while shared backoff or offline status prevents new requests', async () => {
  const first = deferred()
  const second = deferred()
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const client = createRbnClient({ fetch, now: () => NOW })
  await client.getSnapshot(query, { realNowMillis: NOW, waitForRequest: false })
  const other = { ...query, call: 'W1AW' }
  await client.getSnapshot(other, { realNowMillis: NOW, waitForRequest: false })
  const firstSettled = client.getSnapshot(query)
  const secondSettled = client.getSnapshot(other)
  first.finish(response(429))
  await firstSettled
  for (const online of [true, false]) {
    expect(
      await client.getSnapshot(other, {
        realNowMillis: NOW + 1000,
        online,
        waitForRequest: false,
      }),
    ).toMatchObject({ refresh: { state: 'pending' } })
  }
  second.finish(response())
  await secondSettled
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('shows a completed hidden request once before starting another automatic request', async () => {
  const fetch = vi.fn(async () => response())
  const client = createRbnClient({ fetch, now: () => NOW })
  await client.getSnapshot(query, { realNowMillis: NOW })
  const observed = await client.getSnapshot(query, {
    realNowMillis: NOW + 120_000,
    waitForRequest: false,
  })
  expect(observed).toMatchObject({ lastRequestDurationMs: 120_000, status: 'ready' })
  expect(observed.refresh?.state).not.toBe('pending')
  expect(fetch).toHaveBeenCalledTimes(1)
  await client.getSnapshot(query, { realNowMillis: NOW + 180_000 })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('does not replace duration when a same-timestamp forced attempt sends no request', async () => {
  let clock = NOW
  const fetch = vi
    .fn()
    .mockImplementationOnce(async () => {
      clock += 100
      return response()
    })
    .mockRejectedValueOnce(
      new RbnRequestError('rate-limit', 'Waiting', { requestSent: false, retryAtMs: NOW + 60_000 }),
    )
  const client = createRbnClient({ fetch, now: () => clock })
  expect((await client.getSnapshot(query)).lastRequestDurationMs).toBe(100)
  clock = NOW
  expect((await client.getSnapshot(query, { force: true })).lastRequestDurationMs).toBe(100)
})
