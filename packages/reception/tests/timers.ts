import type { TimerDriver } from '../src/timers.ts'

/** A real-delay clock separate from the injected (possibly frozen) sandbox Date. */
export function fakeTimers(initial = 0) {
  let time = initial
  let sequence = 0
  const pending = new Map<number, { at: number; callback: () => void }>()
  const driver: TimerDriver = {
    setTimeout(callback, delay) {
      const id = ++sequence
      pending.set(id, { at: time + delay, callback })
      return id
    },
    clearTimeout(id) {
      pending.delete(id)
    },
  }
  return {
    driver,
    pending,
    now: () => time,
    advance(ms: number) {
      const target = time + ms
      let count = 0
      for (;;) {
        const next = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > target) break
        if (++count > 1000) throw new Error('Unbounded timer loop')
        time = next[1].at
        pending.delete(next[0])
        next[1].callback()
      }
      time = target
    },
  }
}

export async function settle() {
  for (let index = 0; index < 30; index++) await Promise.resolve()
}
