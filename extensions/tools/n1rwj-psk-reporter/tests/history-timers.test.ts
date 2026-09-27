import type { FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { fakeTimers, settle } from '../../../../packages/reception/tests/timers.ts'
import { createHistoryClient, type HistoryHost } from '../src/history/client.ts'

const initial = Date.UTC(2026, 8, 24, 18)
const cooldown = 300_000
const storageKey = 'psk-history-next-request-v1'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function setup(storage = new Map<string, JSONValue>(), start = initial) {
  const timers = fakeTimers(start)
  let virtualNow = initial
  const visible = new Set<string>(['N1RWJ', 'W1AW', 'W2AA'])
  const host = {
    fetch: vi.fn<HistoryHost['fetch']>(async () => ({ status: 200, body: '<pskreporter/>' })),
    read: vi.fn<HistoryHost['read']>(async (key) => storage.get(key) ?? null),
    write: vi.fn<HistoryHost['write']>(async (key, value) => {
      storage.set(key, value)
    }),
  }
  const ingest = vi.fn()
  const client = createHistoryClient(
    host,
    ingest,
    () => virtualNow,
    (call) => visible.has(call),
    timers.driver,
  )
  const observe = (call = 'N1RWJ', online = true, window = 15) =>
    client.observe(call, 'outgoing', window, true, online, timers.now())
  const advance = async (millis: number) => {
    timers.advance(millis)
    await settle()
    timers.advance(0)
    await settle()
  }
  return {
    client,
    host,
    ingest,
    storage,
    timers,
    visible,
    observe,
    advance,
    setVirtual(value: number) {
      virtualNow = value
    },
  }
}

describe('PSK history host timers', () => {
  it('starts queued work at its cooldown deadline without another render', async () => {
    const s = setup()
    s.observe()
    await settle()
    s.observe('W1AW')
    await s.advance(cooldown - 5_000)
    s.observe('W1AW')
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    await s.advance(4_999)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    await s.advance(1)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.host.fetch.mock.calls[1][0]).toContain('senderCallsign=W1AW')
    expect(s.timers.pending.size).toBeLessThanOrEqual(2)
  })

  it('does not poll successfully loaded history while it stays visible', async () => {
    const s = setup()
    s.observe()
    await settle()
    for (let index = 0; index < 30; index++) {
      await s.advance(25_000)
      s.observe()
      await settle()
    }
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    expect(s.timers.pending.size).toBe(0)
  })

  it.each(['hidden', 'offline', 'pause', 'stop'] as const)(
    'suppresses queued automatic work when %s',
    async (action) => {
      const s = setup()
      s.observe()
      await settle()
      await s.advance(cooldown - 5_000)
      s.observe('W1AW')
      if (action === 'hidden') {
        s.visible.delete('W1AW')
        s.client.reconcile()
      } else if (action === 'offline') s.observe('W1AW', false)
      else s.client[action]()
      await s.advance(5_000)
      expect(s.host.fetch).toHaveBeenCalledTimes(1)
      expect(s.timers.pending.size).toBe(0)
    },
  )

  it('waits for an in-flight request even after its cooldown expires', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(response.promise)
    s.observe()
    s.observe('W1AW')
    await settle()
    await s.advance(cooldown - 5_000)
    s.observe()
    s.observe('W1AW')
    await s.advance(5_000)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    response.resolve({ status: 200, body: '<pskreporter/>' })
    await settle()
    await s.advance(0)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.host.fetch.mock.calls[1][0]).toContain('senderCallsign=W1AW')
  })

  it('rotates failed callsigns behind other pending visible work', async () => {
    const s = setup()
    s.host.fetch.mockResolvedValueOnce({ status: 429, body: 'busy' })
    s.observe()
    s.observe('W1AW')
    await settle()
    await s.advance(cooldown - 5_000)
    s.observe()
    s.observe('W1AW')
    await s.advance(5_000)
    expect(s.host.fetch.mock.calls[1][0]).toContain('senderCallsign=W1AW')
    await s.advance(cooldown - 5_000)
    s.observe()
    await s.advance(5_000)
    expect(s.host.fetch.mock.calls[2][0]).toContain('senderCallsign=N1RWJ')
  })

  it.each(['N1RWJ', 'W1AW'])(
    'keeps a new forced %s request when an older generation finishes',
    async (call) => {
      const s = setup()
      const oldResponse = deferred<FetchResponse>()
      const newResponse = deferred<FetchResponse>()
      s.host.fetch.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise)
      s.observe()
      s.observe('W1AW')
      await settle()
      const oldForce = s.client.force(call, 'outgoing', 15, true, s.timers.now())
      s.client.pause()
      s.observe(call)
      const newForce = s.client.force(call, 'outgoing', 15, true, s.timers.now())
      oldResponse.resolve({ status: 200, body: '<pskreporter/>' })
      await settle()
      expect(s.host.fetch).toHaveBeenCalledTimes(2)
      expect(s.host.fetch.mock.calls[1][0]).toContain(`senderCallsign=${call}`)
      expect(s.observe(call).pending).toBe(true)
      expect(s.ingest).not.toHaveBeenCalled()
      newResponse.resolve({ status: 200, body: '<pskreporter/>' })
      await Promise.all([oldForce, newForce])
      expect(s.ingest).toHaveBeenCalledTimes(1)
    },
  )

  it('does not derive deadline eligibility or request durations from virtual Date', async () => {
    const s = setup()
    s.observe()
    await settle()
    await s.advance(cooldown - 5_000)
    s.observe('W1AW')
    s.setVirtual(initial - 365 * 24 * 60 * 60_000)
    await s.advance(5_000)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    const status = (sample?: number) => s.client.observe('W1AW', 'outgoing', 15, true, true, sample)
    expect(status().lastRequestDurationMs).toBeUndefined()
    expect(status(initial + cooldown - 5_000).lastRequestDurationMs).toBeUndefined()
    expect(status(initial + cooldown + 2_000)).toMatchObject({
      lastRequestDurationMs: 2_000,
      lastRequestDurationUpperBound: true,
    })
  })

  it('does not invent a duration if a timer-driven request has no host clock sample', async () => {
    const s = setup()
    s.client.observe('N1RWJ', 'outgoing', 15, true, true)
    await settle()
    s.setVirtual(initial + 10_000)
    expect(s.client.observe('N1RWJ', 'outgoing', 15, true, true)).toMatchObject({
      lastRequestDurationMs: undefined,
      lastRequestDurationUpperBound: undefined,
    })
  })

  it.each(['read', 'write'] as const)(
    'does not send after pausing during a storage %s',
    async (method) => {
      const s = setup()
      const wait = deferred<JSONValue | undefined>()
      if (method === 'read')
        s.host.read.mockImplementationOnce(async () => (await wait.promise) ?? null)
      else
        s.host.write.mockImplementationOnce(async (key, value) => {
          await wait.promise
          s.storage.set(key, value)
        })
      s.observe()
      await settle()
      s.client.pause()
      wait.resolve(null)
      await settle()
      expect(s.host.fetch).not.toHaveBeenCalled()
      await s.advance(cooldown)
      expect(s.host.fetch).not.toHaveBeenCalled()
      expect(s.timers.pending.size).toBe(0)
    },
  )

  it('starts its real cooldown after slow storage finishes reserving the request', async () => {
    const s = setup()
    const write = deferred<void>()
    s.host.write.mockImplementationOnce(async (key, value) => {
      await write.promise
      s.storage.set(key, value)
    })
    s.observe()
    await settle()
    await s.advance(cooldown)
    s.observe()
    s.observe('W1AW')
    write.resolve()
    await settle()
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    await s.advance(cooldown - 5_000)
    s.observe('W1AW')
    await s.advance(4_999)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    await s.advance(1)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps relative cooldown records authoritative across restart and clock jumps', async () => {
    const storage = new Map<string, JSONValue>([
      [storageKey, { version: 2, nextRequest: initial + 10 * 60 * 60_000, remainingMs: cooldown }],
    ])
    const s = setup(storage, initial + 60 * 60_000)
    s.observe()
    await settle()
    expect(s.host.fetch).not.toHaveBeenCalled()
    await s.advance(cooldown - 5_000)
    s.observe()
    await s.advance(5_000)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    const reloaded = setup(storage, initial + 24 * 60 * 60_000)
    reloaded.observe()
    await settle()
    expect(reloaded.host.fetch).not.toHaveBeenCalled()
    await reloaded.advance(cooldown - 5_000)
    reloaded.observe()
    await reloaded.advance(5_000)
    expect(reloaded.host.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps legacy numeric cooldowns readable', async () => {
    const s = setup(new Map([[storageKey, initial + cooldown]]))
    s.observe()
    await settle()
    expect(s.host.fetch).not.toHaveBeenCalled()
    await s.advance(cooldown - 5_000)
    s.observe()
    await s.advance(5_000)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
  })

  it('protects a timer-initiated request whose deadline callback was delayed', async () => {
    const s = setup(new Map([[storageKey, initial + cooldown]]))
    s.observe()
    await settle()
    const [id, expiry] = [...s.timers.pending.entries()][0]
    s.timers.pending.delete(id)
    await s.advance(cooldown - 5_000)
    s.observe('W1AW')
    await s.advance(60_000)
    // Delayed delivery supplies only a lower bound; there is no new render sample.
    expiry.callback()
    await s.advance(0)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    expect(s.storage.get(storageKey)).toMatchObject({ version: 2, remainingMs: cooldown })
    const reloaded = setup(s.storage, s.timers.now() + 24 * 60 * 60_000)
    reloaded.observe()
    await settle()
    expect(reloaded.host.fetch).not.toHaveBeenCalled()
  })

  it('serializes expiry persistence before a later forced-request reservation', async () => {
    const s = setup()
    s.observe()
    await settle()
    const cleared = deferred<void>()
    s.host.write.mockImplementationOnce(async (key, value) => {
      expect(typeof value).toBe('number')
      await cleared.promise
      s.storage.set(key, value)
    })
    await s.advance(cooldown)
    const force = s.client.force('N1RWJ', 'outgoing', 15, true, s.timers.now())
    await settle()
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    cleared.resolve()
    await force
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.storage.get(storageKey)).toMatchObject({ version: 2, remainingMs: cooldown })
    const reloaded = setup(s.storage, s.timers.now())
    reloaded.observe()
    await settle()
    expect(reloaded.host.fetch).not.toHaveBeenCalled()
  })

  it('bounds repeated failure backoff and permits explicit force retries', async () => {
    const s = setup()
    s.host.fetch.mockResolvedValue({ status: 429, body: 'busy' })
    s.observe()
    await settle()
    for (const remainingMs of [600_000, 1_200_000, 2_400_000, 3_600_000, 3_600_000]) {
      await s.client.force('N1RWJ', 'outgoing', 15, true, s.timers.now())
      expect(s.storage.get(storageKey)).toMatchObject({ version: 2, remainingMs })
    }
    expect(s.host.fetch).toHaveBeenCalledTimes(6)
    expect(s.timers.pending.size).toBe(1)
  })
})
