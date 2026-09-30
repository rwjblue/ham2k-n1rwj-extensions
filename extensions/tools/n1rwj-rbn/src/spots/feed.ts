// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { FetchOptions, FetchResponse, Spot } from '@ham2k/extension-sdk'
import { RbnRequestError, requestFailure } from '../data/errors.ts'
import { bands, maxAgeMs, parseReports, record } from './model.ts'
import type { SpotQueryPlan } from './queries.ts'

const endpoint = 'https://vailrerbn.com/api/v1/spots'
const pageSize = 1000
const maxPages = 2
// Two sequential pages leave room for settings and history within the host's
// ten-second Spots fan-out. One slow query must not erase other query results.
const requestTimeoutMs = 4000
const refreshMs = 60_000

export interface FeedOptions {
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>
  source: string
  mode?: string
  queries?: SpotQueryPlan
  now?: () => number
}

/** Bounded HTTPS snapshots fit the hook deadline; no sockets or background timers. */
export function createSpotFeed(options: FeedOptions) {
  const now = options.now ?? Date.now
  const mode = options.mode ?? 'all'
  const modeQuery = mode === 'all' ? '' : `mode=${mode}&`
  const plan = options.queries ?? { skimmers: [], includeGlobal: true }
  const queries = [
    ...plan.skimmers.map((spotter) => ({ spotter, band: undefined })),
    ...(plan.includeGlobal ? bands.map(({ name: band }) => ({ band, spotter: undefined })) : []),
  ]
  const cached = new Map<number, Spot[]>()
  let nextFetchAt = 0
  let status = ''
  let inFlight: Promise<Spot[]> | undefined

  function available(reports: Spot[]): Spot[] {
    const at = now()
    return reports.filter(
      ({ spot }) => spot.timeInMillis >= at - maxAgeMs && spot.timeInMillis <= at,
    )
  }
  const cachedReports = () => available([...cached.values()].flat())
  function mergeReports(previous: Spot[], fresh: Spot[]): Spot[] {
    const unique = new Map<string, Spot>()
    for (const report of available([...previous, ...fresh])) {
      const key = JSON.stringify([
        report.their.call,
        report.freq,
        report.mode,
        report.spot.timeInMillis,
        report.spot.sourceInfo,
      ])
      unique.set(key, report)
    }
    return [...unique.values()]
      .sort((a, b) => b.spot.timeInMillis - a.spot.timeInMillis)
      .slice(0, pageSize * maxPages)
  }

  async function fetchQuery(
    query: (typeof queries)[number],
    at: number,
  ): Promise<{ reports: Spot[]; error?: RbnRequestError }> {
    const reports: Spot[] = []
    const since = Math.floor((at - maxAgeMs) / 1000)
    const until = Math.floor(at / 1000)
    try {
      for (let page = 0; page < maxPages; page++) {
        const response = await options.fetch(
          `${endpoint}?${modeQuery}${query.spotter ? `spotter=${encodeURIComponent(query.spotter)}&` : `band=${query.band}&`}since=${since}&until=${until}&limit=${pageSize}&offset=${page * pageSize}`,
          { timeout: requestTimeoutMs },
        )
        if (response.status === 429) {
          let retryAfter: unknown
          if (response.body.length <= 1_000_000) {
            try {
              retryAfter = record(record(JSON.parse(response.body)).error).retryAfter
            } catch {
              /* Use default backoff. */
            }
          }
          const delay =
            typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.max(refreshMs, retryAfter * 1000)
              : refreshMs
          nextFetchAt = Math.max(nextFetchAt, now() + delay)
          throw new RbnRequestError(
            'rate-limit',
            'Vail ReRBN rate limit reached. Waiting before retrying.',
          )
        }
        if (response.status < 200 || response.status >= 300)
          throw new RbnRequestError('http', `Vail ReRBN request failed (${response.status}).`)
        if (response.body.length > 1_000_000)
          throw new RbnRequestError('response', 'Vail ReRBN response was too large.')
        let payload: Record<string, unknown>
        try {
          payload = record(JSON.parse(response.body))
        } catch {
          throw new RbnRequestError('response', 'Vail ReRBN returned invalid JSON.')
        }
        if (!Array.isArray(payload.spots))
          throw new RbnRequestError('response', 'Vail ReRBN returned an unsupported data format.')
        if (payload.spots.length > pageSize)
          throw new RbnRequestError('response', 'Vail ReRBN exceeded the requested report limit.')
        reports.push(
          ...parseReports(payload.spots, options.source, at).filter(
            (spot) =>
              (!query.band || spot.band === query.band) &&
              (!query.spotter || spot.spot.sourceInfo?.spotter === query.spotter) &&
              (mode === 'all' || spot.mode === mode),
          ),
        )
        if (
          payload.spots.length < pageSize ||
          (typeof payload.total === 'number' && payload.total <= (page + 1) * pageSize)
        )
          break
      }
      return { reports, error: undefined }
    } catch (error) {
      // A second-page failure still leaves the first page useful.
      return { reports, error: requestFailure(error) }
    }
  }

  return {
    get(online: boolean): Promise<Spot[]> {
      if (!online) return Promise.resolve(cachedReports())
      if (inFlight) return inFlight
      if (now() < nextFetchAt) return Promise.resolve(cachedReports())
      const at = now()
      // Settle every query before allowing another refresh, including after errors.
      // Each directed query covers all bands for one exact skimmer. The limit
      // then applies to that receiver instead of unrelated worldwide reports.
      inFlight = Promise.all(queries.map((query) => fetchQuery(query, at)))
        .then((results) => {
          for (const [index, result] of results.entries()) {
            cached.set(
              index,
              result.error
                ? mergeReports(cached.get(index) ?? [], result.reports)
                : available(result.reports),
            )
          }
          const failures = results.filter((result) => result.error)
          const error = failures[0]?.error
          status = error
            ? `${failures.length} of ${queries.length} RBN queries could not be refreshed. Showing available unexpired reports. ${error.message} Will retry on a later Spots refresh.`
            : ''
          return cachedReports()
        })
        .finally(() => {
          nextFetchAt = Math.max(nextFetchAt, now() + refreshMs)
          inFlight = undefined
        })
      return inFlight
    },
    getStatus: () => status,
  }
}
