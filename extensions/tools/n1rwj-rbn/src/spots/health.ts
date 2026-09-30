import type { FetchOptions, FetchResponse } from '@ham2k/extension-sdk'
import { createTimerSlot, type TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { requestFailure } from '../data/errors.ts'
import { record } from '../data/parser.ts'

export interface HealthNotice {
  title: string
  message: string
}

const endpoint = 'https://vailrerbn.com/api/v1/health'
const interval = 60_000

/** Optional settings diagnostic, never part of the Spots refresh path. */
export function createHealthCheck(
  fetch: (url: string, options?: FetchOptions) => Promise<FetchResponse>,
  now: () => number = Date.now,
  timers?: TimerDriver,
) {
  const expiry = timers && createTimerSlot(timers)
  let cached: { at: number; notice: HealthNotice | null } | undefined
  let pending: Promise<HealthNotice | null> | undefined
  function failed(message: string): HealthNotice {
    return {
      title: 'RBN service health check failed',
      message: `${message} Fresh reports may be unavailable; unexpired cached reports can still appear. Reopen RBN settings after a minute to check again.`,
    }
  }
  async function request(): Promise<HealthNotice | null> {
    try {
      // The whole settings definition has a five-second host deadline. Share
      // the RBN transport/backoff, but spend at most two seconds on this probe.
      const response = await fetch(endpoint, { timeout: 2000 })
      if (response.status === 429)
        return failed('Vail ReRBN is limiting requests (HTTP 429). Waiting before retrying.')
      if (response.status !== 200)
        return failed(`The health endpoint returned HTTP ${response.status}.`)
      if (response.body.length > 64_000)
        return failed('The health endpoint returned an unexpected response.')
      let value: Record<string, unknown> | null
      try {
        value = record(JSON.parse(response.body))
      } catch {
        return failed('The health endpoint returned an invalid response.')
      }
      if (typeof value?.status !== 'string' || typeof value.database !== 'string')
        return failed('The health endpoint returned an unexpected response.')
      if (value.status !== 'ok') return failed('Vail ReRBN reports a service problem.')
      if (value.database !== 'connected')
        return failed('Vail ReRBN reports that its database is unavailable.')
      // vailmorse.connected describes presence ingestion, not the RBN feed.
      // A healthy API/database does not guarantee that live reports are flowing.
      return null
    } catch (error) {
      const failure = requestFailure(error)
      return failed(
        failure.kind === 'rate-limit'
          ? 'Vail ReRBN requests are paused while a rate limit clears.'
          : failure.kind === 'timeout'
            ? 'The health check timed out.'
            : 'The health endpoint could not be reached.',
      )
    }
  }
  return function check(online: boolean): Promise<HealthNotice | null> {
    if (!online)
      return Promise.resolve({
        title: 'RBN service status not checked',
        message: 'Ham2K is offline. Reopen RBN settings when online to check the service.',
      })
    if (pending) return pending
    const age = cached && now() - cached.at
    if (cached && age !== undefined && age >= 0 && age < interval)
      return Promise.resolve(cached.notice)
    pending = request()
      .then((notice) => {
        cached = { at: now(), notice }
        // Relative host time also expires the result when developer Date freezes.
        try {
          expiry?.schedule(interval, () => {
            cached = undefined
          })
        } catch {
          // A host without timers can still retry using the clock above.
        }
        return notice
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }
}
