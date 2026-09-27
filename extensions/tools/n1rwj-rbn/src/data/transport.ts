import type { FetchOptions, FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { backoffKey, readBackoff } from './cache.ts'
import { RbnRequestError } from './errors.ts'
import { record } from './parser.ts'

/** Share API throttling between My Signal and native Spots in this bundle. */
export function createRbnTransport(
  fetch: (url: string, options?: FetchOptions) => Promise<FetchResponse>,
  now: () => number = Date.now,
  storage?: PersistentStorage,
  timers?: TimerDriver,
) {
  let blockedUntil = 0
  let timeLowerBound: number | undefined
  let timerTime = 0
  let epochRevision = 0
  let blocked = false
  let blockedDelayMs = 0
  const backoffTimer = timers && createTimerSlot(timers)
  const clock = () => Math.max(timerTime, timeLowerBound ?? now())
  let writing = Promise.resolve()
  function saveBackoff(value: JSONValue) {
    writing = writing.then(async () => {
      try {
        await storage?.write(backoffKey, value)
      } catch {
        // In-memory backoff remains effective if persistent storage fails.
      }
    })
    return writing
  }
  function blockUntil(time: number) {
    blockedUntil = Math.max(blockedUntil, time)
    blocked = true
    const deadline = blockedUntil
    const revision = epochRevision
    blockedDelayMs = Math.max(0, deadline - clock())
    backoffTimer?.schedule(blockedDelayMs, () => {
      if (revision === epochRevision) timerTime = Math.max(timerTime, deadline)
      blocked = false
      blockedUntil = 0
      void saveBackoff(0)
    })
  }
  let restored: Promise<void> | undefined
  let restoreAfter = 0
  const pending = new Map<string, Promise<FetchResponse>>()
  async function restoreBackoff() {
    if (storage && clock() >= restoreAfter) {
      restored ??= storage
        .read(backoffKey)
        .then((value) => {
          const savedRecord = record(value)
          const pendingDelayMs = savedRecord?.pendingDelayMs
          const delay =
            savedRecord?.version === 1 &&
            typeof pendingDelayMs === 'number' &&
            Number.isFinite(pendingDelayMs) &&
            pendingDelayMs > 0 &&
            pendingDelayMs <= 24 * 60 * 60_000
              ? pendingDelayMs
              : 0
          // A pending relative budget is authoritative: the saved epoch may
          // come from developer Date before any panel supplied real time.
          const saved =
            delay > 0 ? clock() + delay : readBackoff(savedRecord?.until ?? value, clock())
          if (saved > 0) blockUntil(saved)
        })
        .catch(() => {
          restored = undefined
          restoreAfter = clock() + 60_000
        })
      await restored
    }
  }
  const request = async (
    url: string,
    options?: FetchOptions,
    isAllowed?: () => boolean,
  ): Promise<FetchResponse> => {
    await restoreBackoff()
    if (isAllowed && !isAllowed())
      throw new RbnRequestError('offline', 'RBN refresh is no longer active.', {
        requestSent: false,
      })
    if (backoffTimer ? blocked : clock() < blockedUntil)
      return Promise.reject(
        new RbnRequestError(
          'rate-limit',
          'Vail ReRBN rate limit (HTTP 429) from another RBN request. Waiting before retrying.',
          { retryAtMs: blockedUntil, requestSent: false },
        ),
      )
    const key = `${url}:${options?.timeout ?? ''}`
    const current = pending.get(key)
    if (current) return current
    const request = fetch(url, options)
      .then(async (response) => {
        if (response.status === 429) {
          let delay = 60_000
          try {
            if (response.body.length <= 1_000_000) {
              const retry = record(record(JSON.parse(response.body))?.error)?.retryAfter
              if (typeof retry === 'number' && Number.isFinite(retry) && retry > 0)
                delay = Math.max(delay, retry * 1000)
            }
          } catch {
            /* Default backoff. */
          }
          blockUntil(clock() + delay)
          // The last panel sample may be hours old by a Spots-only response.
          // Persist the unresolved relative budget, not just that epoch lower
          // bound; the timeout clears it once real time has discharged it.
          await saveBackoff(
            backoffTimer
              ? { version: 1, until: blockedUntil, pendingDelayMs: blockedDelayMs }
              : blockedUntil,
          )
        }
        return response
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }
  return Object.assign(request, {
    // My Signal supplies real panel samples and timer-established lower bounds.
    // Native Spots shares this clock and the same relative backoff timer.
    observeTimeLowerBound(time: number) {
      if (!Number.isFinite(time)) return
      if (timeLowerBound === undefined) {
        // Spots may have received a 429 before the first real panel sample.
        // Rebase its diagnostic deadline without extending the real timeout or
        // retaining a developer-time epoch after the timeout fires.
        epochRevision++
        timerTime = 0
        if (blocked) blockedUntil = time + blockedDelayMs
      }
      timeLowerBound = Math.max(timeLowerBound ?? time, time)
      // Start restoration with the first panel sample, even if My Signal's own
      // persisted cooldown defers its first fetch until later.
      void restoreBackoff()
    },
  })
}
