import { expect, it } from 'vitest'
import { fakeTimers } from '../../../../packages/reception/tests/timers.ts'
import { createLiveReception } from '../src/live.ts'
import { fakeSocket } from './socket-fixture.ts'

const initial = Date.UTC(2026, 8, 27, 12)
function setup() {
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
    undefined,
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
