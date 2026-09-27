import type { JSONValue } from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { fakeTimers, settle } from '../../../../packages/reception/tests/timers.ts'
import { reportCacheKey } from '../src/data/cache.ts'
import type { HistoryHost } from '../src/history/client.ts'
import { createLiveReception } from '../src/live.ts'
import { fakeSocket, publication } from './socket-fixture.ts'

const initial = Date.UTC(2026, 8, 27, 12)
function setup(historyHost?: HistoryHost) {
  const timers = fakeTimers(initial)
  const sockets: ReturnType<typeof fakeSocket>[] = []
  const live = createLiveReception(
    () => {
      const socket = fakeSocket()
      sockets.push(socket)
      return socket.socket
    },
    () => initial - 86_400_000,
    () => 0,
    historyHost,
    timers.driver,
  )
  const snapshot = (id = 'one', call = 'N1RWJ', online = true) =>
    live.snapshot(id, call, 'outgoing', 15, online, timers.now())
  const connect = () => {
    snapshot()
    sockets[0].socket.onopen?.()
    sockets[0].receive([0x20, 2, 0, 0])
    sockets[0].receive([0x90, 3, 0, 1, 0])
  }
  return { timers, sockets, live, snapshot, connect }
}

it('expires the final visible lease without another render or incoming frame', () => {
  const s = setup()
  s.connect()
  s.timers.advance(15_000)
  expect(s.sockets[0].sent[s.sockets[0].sent.length - 1]).toEqual([0xc0, 0])
  s.sockets[0].receive([0xd0, 0])
  s.timers.advance(15_000)
  expect(s.sockets[0].closed).toBe(1)
  expect(s.timers.pending.size).toBe(0)
  s.timers.advance(120_000)
  expect(s.sockets).toHaveLength(1)
})

it('saves reports received after the last render, then restores using real panel time', async () => {
  const saved = new Map<string, JSONValue>()
  const storage: HistoryHost = {
    read: async (key) => saved.get(key) ?? null,
    write: async (key, value) => {
      saved.set(key, value)
    },
    fetch: async () => ({ status: 200, body: '<pskreporter/>' }),
  }
  const s = setup(storage)
  await s.live.restore(initial)
  s.connect()
  await settle()
  s.sockets[0].receive(
    publication(
      'pskr/filter/v2/20m/FT8/N1RWJ/W1AW/FN42/FN31/291/291',
      JSON.stringify({
        sc: 'N1RWJ',
        rc: 'W1AW',
        sl: 'FN42',
        rl: 'FN31',
        t: initial / 1000,
        f: 14074000,
        md: 'FT8',
        b: '20m',
        rp: -12,
      }),
    ),
  )
  await settle()
  s.live.pause()
  await settle()
  s.timers.advance(30_000)
  await settle()
  expect(JSON.parse(String(saved.get(reportCacheKey))).reports).toHaveLength(1)
  const restored = createLiveReception(
    () => fakeSocket().socket,
    () => initial + 86_400_000,
    () => 0,
    storage,
    s.timers.driver,
  )
  await restored.restore(initial + 30_000)
  expect(
    restored.snapshot('restored', 'N1RWJ', 'outgoing', 15, false, initial + 30_000).reports,
  ).toHaveLength(1)
  restored.stop()
})

it('shares a topic expiry across placements and stops after the last renewal', () => {
  const s = setup()
  s.connect()
  s.timers.advance(15_000)
  s.sockets[0].receive([0xd0, 0])
  s.snapshot('two')
  s.timers.advance(15_000)
  s.sockets[0].receive([0xd0, 0])
  expect(s.sockets[0].closed).toBe(0)
  s.timers.advance(15_000)
  expect(s.sockets[0].closed).toBe(1)
  expect(s.timers.pending.size).toBe(0)
})

it.each([false, true])(
  'wakes queued history independently of rendering (paused: %s)',
  async (paused) => {
    let requests = 0
    const storage: HistoryHost = {
      read: async (key) => (key === 'psk-history-next-request-v1' ? initial + 5000 : null),
      write: async () => {},
      fetch: async () => {
        requests++
        return { status: 200, body: '<pskreporter/>' }
      },
    }
    const s = setup(storage)
    await s.live.restore(initial)
    s.connect()
    await settle()
    expect(requests).toBe(0)
    if (paused) s.live.pause()
    s.timers.advance(5000)
    await settle()
    expect(requests).toBe(paused ? 0 : 1)
    s.live.stop()
    expect(s.timers.pending.size).toBe(0)
  },
)

it('removes stale placements sharing a visible topic without exhausting placement capacity', () => {
  const s = setup()
  s.connect()
  for (let index = 1; index < 32; index++) s.snapshot(String(index))
  for (let second = 5; second <= 35; second += 5) {
    s.timers.advance(5000)
    if (second % 15 === 0) s.sockets[0].receive([0xd0, 0])
    s.snapshot()
  }
  expect(s.snapshot('new').state).toBe('live')
  expect(s.timers.pending.size).toBeLessThanOrEqual(4)
})

it.each(['offline', 'pause', 'stop'] as const)('cancels hidden reconnects on %s', (reason) => {
  const s = setup()
  s.connect()
  s.sockets[0].socket.onerror?.({ message: 'disconnected' })
  const callbacks = [...s.timers.pending.values()].map((timer) => timer.callback)
  if (reason === 'offline') s.snapshot('one', 'N1RWJ', false)
  else s.live[reason]()
  for (const callback of callbacks) callback()
  s.timers.advance(120_000)
  expect(s.sockets).toHaveLength(1)
  expect(s.timers.pending.size).toBe(0)
})
