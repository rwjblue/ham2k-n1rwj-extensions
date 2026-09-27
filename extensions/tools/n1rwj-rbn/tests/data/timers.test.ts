import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { backoffKey, snapshotKey } from '../../src/data/cache.ts'
import { createRbnClient } from '../../src/data/client.ts'
import { createRbnTransport } from '../../src/data/transport.ts'
import { NOW, payload } from './fixtures.ts'

const query = { call: 'N1RWJ', windowMinutes: 30 }
const success = { status: 200, body: JSON.stringify(payload()) }
const limited = { status: 429, body: JSON.stringify({ error: { retryAfter: 60 } }) }
const visible = { instanceId: 'my-signal', realNowMillis: NOW }

function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  const callbacks: (() => void)[] = []
  const timers: TimerDriver = {
    setTimeout(callback, delay) {
      callbacks.push(callback)
      return Number(setTimeout(callback, delay))
    },
    clearTimeout(id) {
      clearTimeout(id)
    },
  }
  return { timers, callbacks }
}

afterEach(() => vi.useRealTimers())

describe('visible RBN request scheduling', () => {
  it('refreshes without another render, expires hidden placements, and resumes once', async () => {
    const { timers } = setup()
    const fetch = vi.fn(async (_url: string) => success)
    const client = createRbnClient({ fetch, timers })
    await client.getSnapshot(query, visible)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    await client.getSnapshot(query, { ...visible, realNowMillis: NOW + 360_000 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('honors the latest offline observation and changed placement settings', async () => {
    const { timers } = setup()
    const fetch = vi.fn(async (_url: string) => success)
    const client = createRbnClient({ fetch, timers })
    await client.getSnapshot(query, visible)
    await vi.advanceTimersByTimeAsync(10_000)
    await client.getSnapshot(query, { ...visible, online: false, realNowMillis: NOW + 10_000 })
    await vi.advanceTimersByTimeAsync(50_000)
    expect(fetch).toHaveBeenCalledTimes(1)
    await client.getSnapshot(
      { ...query, call: 'W1AW' },
      { ...visible, online: true, realNowMillis: NOW + 60_000 },
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.slice(1).every(([url]) => url.includes('call=W1AW&'))).toBe(true)
  })

  it('shares one request across placements and never overlaps a slow fetch', async () => {
    const { timers } = setup()
    let finish!: (value: typeof success) => void
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(success)
      .mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const client = createRbnClient({ fetch, timers })
    await client.getSnapshot(query, visible)
    await client.getSnapshot(query, { ...visible, instanceId: 'second' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    await client.getSnapshot(query, {
      ...visible,
      realNowMillis: NOW + 60_000,
      waitForRequest: false,
    })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    finish(success)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('ignores cancelled callbacks and caps timer use across many placements', async () => {
    const { timers, callbacks } = setup()
    const fetch = vi.fn(async (_url: string) => success)
    const client = createRbnClient({ fetch, timers })
    for (let index = 0; index < 20; index++)
      await client.getSnapshot(query, { ...visible, instanceId: String(index) })
    expect(vi.getTimerCount()).toBeLessThanOrEqual(9)
    const cancelled = callbacks.slice(0, 3)
    for (const callback of cancelled) callback()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('uses real timeout eligibility with a frozen or changed developer Date and truthful timing', async () => {
    const { timers } = setup()
    let developerTime = NOW + 365 * 86_400_000
    const fetch = vi.fn(async (_url: string) => success)
    const client = createRbnClient({ fetch, timers, now: () => developerTime })
    await client.getSnapshot(query, visible)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    // A timer must not reuse the old real sample to report a zero-ms duration.
    const pendingTiming = await client.getSnapshot(query)
    expect(pendingTiming.lastRequestDurationMs).toBeUndefined()
    expect(pendingTiming.pendingRequestTiming?.startedAtMs).toBe(NOW + 60_000)
    developerTime -= 2 * 365 * 86_400_000
    const finalized = await client.getSnapshot(query, {
      ...visible,
      realNowMillis: NOW + 65_000,
    })
    expect(finalized.lastRequestDurationMs).toBe(5_000)
    expect(finalized.lastRequestDurationUpperBound).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('shares timed HTTP 429 backoff with native Spots even when Date is frozen', async () => {
    const { timers } = setup()
    const fetch = vi.fn().mockResolvedValueOnce(limited).mockResolvedValue(success)
    const transport = createRbnTransport(fetch, () => NOW, undefined, timers)
    const client = createRbnClient({
      fetch: transport,
      timers,
      now: () => NOW,
      observeTimeLowerBound: transport.observeTimeLowerBound,
    })
    await client.getSnapshot(query, visible)
    await expect(transport('https://vailrerbn.com/api/v1/spots?mode=CW')).rejects.toThrow(
      'rate limit',
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not spin when another caller starts backoff between real clock samples', async () => {
    const { timers } = setup()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(limited)
      .mockResolvedValue(success)
    const transport = createRbnTransport(fetch, () => NOW, undefined, timers)
    const sharedFetch = vi.fn(transport)
    const client = createRbnClient({
      fetch: sharedFetch,
      timers,
      now: () => NOW,
      observeTimeLowerBound: transport.observeTimeLowerBound,
    })
    await client.getSnapshot(query, visible)
    await vi.advanceTimersByTimeAsync(30_000)
    await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sharedFetch).toHaveBeenCalledTimes(2)
    await client.getSnapshot(query, { ...visible, realNowMillis: NOW + 60_000 })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sharedFetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each(['expired', 'offline', 'changed-call', 'paused'])(
    'rechecks %s eligibility after a delayed storage write before fetching',
    async (change) => {
      const { timers } = setup()
      let block = false
      let release!: () => void
      const waiting = new Promise<void>((resolve) => (release = resolve))
      const storage = {
        read: async () => null,
        write: vi.fn(async () => {
          if (block) await waiting
        }),
      }
      const fetch = vi.fn(async (_url: string) => success)
      const client = createRbnClient({ fetch, timers, storage, now: () => NOW })
      await client.getSnapshot(query, visible)
      block = true
      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetch).toHaveBeenCalledTimes(1)
      if (change === 'paused') client.pause?.()
      const pending =
        change === 'expired' || change === 'paused'
          ? undefined
          : client.getSnapshot(change === 'changed-call' ? { ...query, call: 'W1AW' } : query, {
              ...visible,
              online: change !== 'offline',
              realNowMillis: NOW + 60_000,
            })
      if (change === 'expired') await vi.advanceTimersByTimeAsync(15_000)
      release()
      await pending
      await vi.advanceTimersByTimeAsync(0)
      expect(fetch.mock.calls.filter(([url]) => url.includes('call=N1RWJ&'))).toHaveLength(1)
      expect(fetch).toHaveBeenCalledTimes(change === 'changed-call' ? 2 : 1)
      if (change === 'paused') {
        expect(vi.getTimerCount()).toBe(0)
        await client.getSnapshot(query, { ...visible, realNowMillis: NOW + 60_000 })
        expect(fetch).toHaveBeenCalledTimes(2)
      }
    },
  )

  it('rebases a Spots-only virtual deadline when My Signal supplies its first real sample', async () => {
    const { timers } = setup()
    const fetch = vi.fn().mockResolvedValueOnce(limited).mockResolvedValue(success)
    const transport = createRbnTransport(fetch, () => NOW + 365 * 86_400_000, undefined, timers)
    await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
    await vi.advanceTimersByTimeAsync(30_000)
    const client = createRbnClient({
      fetch: transport,
      timers,
      observeTimeLowerBound: transport.observeTimeLowerBound,
    })
    await client.getSnapshot(query, { ...visible, realNowMillis: NOW + 30_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rechecks the lease after the shared transport awaits backoff restoration', async () => {
    const { timers } = setup()
    let release!: (value: null) => void
    let reads = 0
    const storage = {
      read: async () => {
        if (++reads === 1) throw new Error('Storage temporarily unavailable')
        return new Promise<null>((resolve) => (release = resolve))
      },
      write: async () => {},
    }
    const fetch = vi.fn(async () => success)
    const transport = createRbnTransport(fetch, () => NOW, storage, timers)
    const client = createRbnClient({
      fetch: transport,
      timers,
      now: () => NOW,
      observeTimeLowerBound: transport.observeTimeLowerBound,
    })
    await client.getSnapshot(query, visible)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(reads).toBe(2)
    await vi.advanceTimersByTimeAsync(15_000)
    release(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restores both snapshot and shared transport cooldowns before scheduling a request', async () => {
    const { timers } = setup()
    const values = new Map<string, JSONValue>()
    const storage = {
      read: async (key: string) => values.get(key) ?? null,
      write: async (key: string, value: JSONValue) => {
        values.set(key, value)
      },
    }
    const fetch = vi.fn().mockResolvedValueOnce(limited).mockResolvedValue(success)
    const transport = createRbnTransport(fetch, () => NOW, storage, timers)
    const first = createRbnClient({ fetch: transport, storage, now: () => NOW })
    await first.getSnapshot(query)
    expect(values.has(snapshotKey)).toBe(true)
    expect(values.get(backoffKey)).toMatchObject({
      until: NOW + 60_000,
      pendingDelayMs: 60_000,
    })
    vi.clearAllTimers()
    const restoredTransport = createRbnTransport(fetch, () => NOW, storage, timers)
    const client = createRbnClient({
      fetch: restoredTransport,
      storage,
      timers,
      now: () => NOW,
      observeTimeLowerBound: restoredTransport.observeTimeLowerBound,
    })
    await client.getSnapshot(query, visible)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('preserves a later Spots backoff across restart after the last real sample becomes stale', async () => {
    const { timers } = setup()
    const values = new Map<string, JSONValue>()
    const storage = {
      read: async (key: string) => values.get(key) ?? null,
      write: async (key: string, value: JSONValue) => {
        values.set(key, value)
      },
    }
    const fetch = vi.fn().mockResolvedValueOnce(limited).mockResolvedValue(success)
    const transport = createRbnTransport(fetch, () => NOW, storage, timers)
    transport.observeTimeLowerBound(NOW)
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000)
    await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
    expect(values.get(backoffKey)).toMatchObject({ until: NOW + 60_000, pendingDelayMs: 60_000 })
    vi.clearAllTimers()
    const restarted = createRbnTransport(fetch, () => NOW + 3 * 60 * 60_000, storage, timers)
    await expect(restarted('https://vailrerbn.com/api/v1/spots?mode=CW')).rejects.toThrow(
      'rate limit',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(values.get(backoffKey)).toBe(0)
    await restarted('https://vailrerbn.com/api/v1/spots?mode=CW')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('restores the relative budget when a saved virtual epoch is only one hour ahead', async () => {
    const { timers } = setup()
    let saved: JSONValue = { version: 1, until: NOW + 3_660_000, pendingDelayMs: 60_000 }
    const storage = {
      read: async () => saved,
      write: async (_key: string, value: JSONValue) => {
        saved = value
      },
    }
    const fetch = vi.fn(async () => success)
    const transport = createRbnTransport(fetch, () => NOW, storage, timers)
    await expect(transport('https://vailrerbn.com/api/v1/spots?mode=CW')).rejects.toThrow(
      'rate limit',
    )
    await vi.advanceTimersByTimeAsync(60_000)
    await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(saved).toBe(0)
  })
})

import type { JSONValue } from '@ham2k/extension-sdk'
