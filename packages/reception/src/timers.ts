/** Relative real-time delays supplied by the extension host, independent of Date. */
export interface TimerDriver {
  setTimeout(callback: () => void, delay: number): number
  clearTimeout(id: number): void
}

/** One replaceable timeout; cancelled callbacks remain harmless if already queued. */
export function createTimerSlot(timers: TimerDriver) {
  let handle: number | undefined
  let generation = 0
  function cancel() {
    generation++
    if (handle !== undefined) timers.clearTimeout(handle)
    handle = undefined
  }
  return {
    cancel,
    schedule(delay: number, callback: () => void) {
      cancel()
      const current = generation
      handle = timers.setTimeout(
        () => {
          if (current !== generation) return
          generation++
          handle = undefined
          callback()
        },
        Math.max(0, delay),
      )
    },
  }
}
