import { describe, expect, it } from 'vitest'
import type { TimerDriver } from '../../../../packages/reception/src/timers.ts'
import { createMqttClient } from '../src/transport/client.ts'
import { fakeSocket, publication } from './socket-fixture.ts'

function setup(random = 0) {
  let realNow = 0
  let virtualNow = 1_000
  let nextId = 0
  let peakTimers = 0
  const pending = new Map<number, { at: number; callback: () => void }>()
  const timers: TimerDriver = {
    setTimeout(callback, delay) {
      const id = ++nextId
      pending.set(id, { at: realNow + delay, callback })
      peakTimers = Math.max(peakTimers, pending.size)
      return id
    },
    clearTimeout(id) {
      pending.delete(id)
    },
  }
  const sockets: ReturnType<typeof fakeSocket>[] = []
  const reports: string[] = []
  const client = createMqttClient({
    timers,
    now: () => virtualNow,
    random: () => random,
    onReport: (_, payload) => reports.push(payload),
    open: () => {
      const socket = fakeSocket()
      sockets.push(socket)
      return socket.socket
    },
  })
  const advance = (millis: number) => {
    const until = realNow + millis
    while (true) {
      const due = [...pending.entries()]
        .filter(([, timer]) => timer.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      const [id, timer] = due
      realNow = timer.at
      pending.delete(id)
      timer.callback()
    }
    realNow = until
  }
  const acknowledge = (socket = sockets[sockets.length - 1]) => {
    for (const packet of [...socket.sent]) {
      if (packet[0] === 0x82) socket.receive([0x90, 3, packet[2], packet[3], 0])
      if (packet[0] === 0xa2) socket.receive([0xb0, 2, packet[2], packet[3]])
    }
  }
  const connect = (topics = ['test/#']) => {
    client.tick(topics)
    const socket = sockets[sockets.length - 1]
    socket.socket.onopen?.()
    socket.receive([0x20, 2, 0, 0])
    acknowledge(socket)
    return socket
  }
  return {
    client,
    sockets,
    reports,
    pending,
    advance,
    acknowledge,
    connect,
    setNow(value: number) {
      virtualNow = value
    },
    get peakTimers() {
      return peakTimers
    },
  }
}

describe('MQTT host timer scheduling', () => {
  it.each([false, true])('times out a missing connection ACK after opening=%s', (opened) => {
    const s = setup()
    s.client.tick(['test/#'])
    if (opened) s.sockets[0].socket.onopen?.()
    s.advance(9_999)
    expect(s.client.status().state).toBe('connecting')
    s.advance(1)
    expect(s.client.status()).toMatchObject({
      state: 'retrying',
      message: 'Connection or subscription timed out',
    })
    expect(s.sockets[0].closed).toBe(1)
    s.advance(5_000)
    expect(s.sockets).toHaveLength(2)
  })

  it('starts a separate subscription deadline after a slow connection ACK', () => {
    const s = setup()
    s.client.tick(['test/#'])
    s.sockets[0].socket.onopen?.()
    s.advance(9_000)
    s.sockets[0].receive([0x20, 2, 0, 0])
    s.advance(9_999)
    expect(s.client.status().state).toBe('subscribing')
    s.advance(1)
    expect(s.client.status().state).toBe('retrying')
    expect(s.sockets[0].closed).toBe(1)
  })

  it('does not extend the subscription deadline when topics change', () => {
    const s = setup()
    s.client.tick(['test/#', 'other/#'])
    s.sockets[0].socket.onopen?.()
    s.sockets[0].receive([0x20, 2, 0, 0])
    s.advance(9_000)
    s.sockets[0].receive([0x90, 3, 0, 1, 0])
    s.client.tick(['third/#'])
    expect(s.sockets[0].sent.filter((packet) => packet[0] === 0x82)).toHaveLength(2)
    s.advance(1_000)
    expect(s.client.status().state).toBe('retrying')
    expect(s.peakTimers).toBeLessThanOrEqual(4)
  })

  it('reconciles the latest desired topics once a subscription batch is acknowledged', () => {
    const s = setup()
    s.client.tick(['test/#', 'other/#'])
    const socket = s.sockets[0]
    socket.socket.onopen?.()
    socket.receive([0x20, 2, 0, 0])
    s.client.tick(['third/#'])
    socket.receive([0x90, 3, 0, 1, 0])
    socket.receive([0x90, 3, 0, 2, 0])
    expect(socket.sent.slice(-3).map((packet) => packet[0])).toEqual([0xa2, 0xa2, 0x82])
    socket.receive([0xb0, 2, 0, 3, 0xb0, 2, 0, 4, 0x90, 3, 0, 5, 0])
    expect(s.client.status().state).toBe('live')
    s.advance(10_000)
    expect(s.client.status().state).toBe('live')
    expect(s.peakTimers).toBeLessThanOrEqual(4)
  })

  it('keeps a silent connection alive and times out a missing PINGRESP without panel ticks', () => {
    const s = setup()
    const socket = s.connect()
    s.advance(15_000)
    expect(socket.sent[socket.sent.length - 1]).toEqual([0xc0, 0])
    socket.receive([0xd0, 0])
    s.advance(15_000)
    expect(socket.sent.filter((packet) => packet[0] === 0xc0)).toHaveLength(2)
    s.advance(15_000)
    expect(s.client.status()).toMatchObject({
      state: 'retrying',
      message: 'Feed heartbeat timed out',
    })
  })

  it('uses real timer delays for heartbeat and retry after virtual time runs backwards', () => {
    const s = setup()
    const socket = s.connect()
    s.setNow(-100_000)
    s.client.tick(['test/#'])
    socket.receive(publication('test/x', '{}'))
    expect(s.reports).toEqual(['{}'])
    expect(socket.closed).toBe(0)
    s.advance(30_000)
    expect(s.client.status().state).toBe('retrying')
    s.setNow(-200_000)
    s.client.tick(['test/#'])
    s.advance(4_999)
    expect(s.sockets).toHaveLength(1)
    s.advance(1)
    expect(s.sockets).toHaveLength(2)
  })

  it('backs off with jitter and keeps the failure count through brief successful sessions', () => {
    const s = setup(0.5)
    let socket = s.connect()
    socket.socket.onerror?.({ message: 'failed' })
    for (const delay of [5_500, 11_000, 22_000, 44_000, 66_000, 66_000]) {
      const count = s.sockets.length
      s.advance(delay - 1)
      expect(s.sockets).toHaveLength(count)
      s.advance(1)
      expect(s.sockets).toHaveLength(count + 1)
      socket = s.connect()
      socket.socket.onerror?.({ message: 'failed' })
    }
  })

  it('resets failure backoff after a full minute of stable connection time', () => {
    const s = setup()
    s.connect().socket.onerror?.({ message: 'failed' })
    s.advance(5_000)
    const socket = s.connect()
    for (let index = 0; index < 4; index++) {
      s.advance(15_000)
      socket.receive([0xd0, 0])
    }
    socket.socket.onerror?.({ message: 'failed' })
    s.advance(4_999)
    expect(s.sockets).toHaveLength(2)
    s.advance(1)
    expect(s.sockets).toHaveLength(3)
  })

  it.each(['stop', 'empty topics'] as const)(
    'cancels reconnect on %s and ignores late callbacks',
    (action) => {
      const s = setup()
      const socket = s.connect()
      const oldMessage = socket.socket.onmessage
      const oldTimers = [...s.pending.values()].map((timer) => timer.callback)
      socket.socket.onerror?.({ message: 'failed' })
      const reconnect = [...s.pending.values()][0].callback
      if (action === 'stop') s.client.stop()
      else s.client.tick([])
      expect(s.pending.size).toBe(0)
      for (const callback of [...oldTimers, reconnect]) callback()
      oldMessage?.({ data: new Uint8Array(publication('test/x', '{}')).buffer })
      s.advance(120_000)
      expect(s.sockets).toHaveLength(1)
      expect(s.reports).toEqual([])
      expect(s.client.status().state).toBe('idle')
      s.connect()
      expect(s.sockets).toHaveLength(2)
      for (const callback of [...oldTimers, reconnect]) callback()
      expect(s.client.status().state).toBe('live')
    },
  )

  it('ignores an acknowledged batch deadline delivered late in the same connection', () => {
    const s = setup()
    s.client.tick(['test/#'])
    const oldHandshake = [...s.pending.values()][0].callback
    s.sockets[0].socket.onopen?.()
    s.sockets[0].receive([0x20, 2, 0, 0])
    const oldSubscription = [...s.pending.values()].find((timer) => timer.at === 10_000)?.callback
    expect(oldSubscription).toBeDefined()
    s.acknowledge()
    oldHandshake()
    oldSubscription?.()
    expect(s.client.status().state).toBe('live')
  })
})
