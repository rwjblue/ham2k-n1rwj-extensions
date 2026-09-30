// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { FetchOptions, FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { createSpotFeed } from '../../src/spots/feed.ts'
import { createRbnSpots } from '../../src/spots/index.ts'
import { maxAgeMs } from '../../src/spots/model.ts'

const at = Date.parse('2026-09-30T16:00:00Z')
const row = (changes: Record<string, unknown> = {}) => ({
  callsign: 'K1ABC',
  frequency: 14032.5,
  mode: 'CW',
  timestamp: new Date(at - 1000).toISOString(),
  spotter: 'K1TTT',
  wpm: 28,
  ...changes,
})
const response = (spots: unknown[], total = spots.length): FetchResponse => ({
  status: 200,
  body: JSON.stringify({ spots, total }),
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

it('returns fresh reports when one band times out on a cold start', async () => {
  const fetch = vi.fn(async (url: string, options?: FetchOptions) => {
    expect(options?.timeout).toBe(4000)
    const band = new URL(url).searchParams.get('band')
    if (band === '40m') throw new Error('Request timed out')
    return response(band === '20m' ? [row()] : [])
  })
  const feed = createSpotFeed({ source: 'n1rwj-rbn', now: () => at, fetch })

  const spots = await feed.get(true)
  expect(spots.map((spot) => spot.their.call)).toEqual(['K1ABC'])
  expect(feed.getStatus()).not.toBe('')
  expect(await feed.get(false)).toEqual(spots)
  expect(await feed.get(true)).toEqual(spots)
  expect(fetch).toHaveBeenCalledTimes(9)
})

it('retains a successful first page when a band second page times out', async () => {
  const fetch = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams
    if (params.get('band') !== '20m') return response([])
    if (params.get('offset') === '1000') throw new Error('Second page timed out')
    return response(
      Array.from({ length: 1000 }, (_, index) => row({ frequency: 14032 + index / 1000 })),
      2000,
    )
  })
  const feed = createSpotFeed({
    source: 'n1rwj-rbn',
    now: () => at,
    fetch,
  })

  const spots = await feed.get(true)
  expect(spots).toHaveLength(1000)
  expect(spots.every((spot) => spot.their.call === 'K1ABC')).toBe(true)
  expect(feed.getStatus()).not.toBe('')
  expect(fetch).toHaveBeenCalledTimes(10)
})

it('keeps unexpired reports during total failure and clears the warning after recovery', async () => {
  let now = at
  let failed = false
  const fetch = vi.fn(async (url: string) => {
    if (failed) throw new Error('Request timed out')
    return response(
      new URL(url).searchParams.get('band') === '20m'
        ? [row({ timestamp: new Date(now - 1000).toISOString() })]
        : [],
    )
  })
  const feed = createSpotFeed({
    source: 'n1rwj-rbn',
    now: () => now,
    fetch,
  })

  const previous = await feed.get(true)
  expect(feed.getStatus()).toBe('')
  failed = true
  now += 61_000
  expect(await feed.get(true)).toEqual(previous)
  const warning = feed.getStatus()
  expect(warning).not.toBe('')
  now += 1000
  expect(await feed.get(true)).toEqual(previous)
  expect(feed.getStatus()).toBe(warning)
  expect(fetch).toHaveBeenCalledTimes(18)

  now = at + maxAgeMs + 1
  expect(await feed.get(true)).toEqual([])
  expect(await feed.get(false)).toEqual([])
  expect(feed.getStatus()).not.toBe('')
  expect(fetch).toHaveBeenCalledTimes(27)

  failed = false
  now += 61_000
  const recovered = await feed.get(true)
  expect(recovered).toHaveLength(1)
  expect(recovered[0]?.spot.timeInMillis).toBe(now - 1000)
  expect(feed.getStatus()).toBe('')
  expect(fetch).toHaveBeenCalledTimes(36)
})

it('replaces successful band caches while retaining a failed band previous reports', async () => {
  let now = at
  let refresh = false
  const feed = createSpotFeed({
    source: 'n1rwj-rbn',
    now: () => now,
    fetch: async (url) => {
      const band = new URL(url).searchParams.get('band')
      if (band !== '20m' && band !== '40m') return response([])
      if (refresh && band === '40m') throw new Error('Request timed out')
      return response([
        row({
          frequency: band === '40m' ? 7033 : 14032,
          callsign: band === '40m' ? 'W9OLD' : refresh ? 'N2NEW' : 'K1OLD',
          timestamp: new Date(now - 1000).toISOString(),
        }),
      ])
    },
  })

  expect((await feed.get(true)).map((spot) => spot.their.call).sort()).toEqual(['K1OLD', 'W9OLD'])
  refresh = true
  now += 61_000
  expect((await feed.get(true)).map((spot) => spot.their.call).sort()).toEqual(['N2NEW', 'W9OLD'])
  expect(feed.getStatus()).not.toBe('')
})

it('coalesces parallel refreshes until every band request settles after a failure', async () => {
  const failed = deferred<FetchResponse>()
  const successful = deferred<FetchResponse>()
  const fetch = vi.fn((url: string) => {
    const band = new URL(url).searchParams.get('band')
    if (band === '20m') return failed.promise
    if (band === '40m') return successful.promise
    return Promise.resolve(response([]))
  })
  const feed = createSpotFeed({
    source: 'n1rwj-rbn',
    now: () => at,
    fetch,
  })

  const first = feed.get(true)
  const second = feed.get(true)
  expect(first).toBe(second)
  expect(fetch).toHaveBeenCalledTimes(9)
  failed.reject(new Error('Request timed out'))
  await Promise.resolve()
  const third = feed.get(true)
  expect(third).toBe(first)
  successful.resolve(response([row({ frequency: 7033 })]))
  const results = await Promise.all([first, second, third])
  expect(results.every((spots) => spots.length === 1)).toBe(true)
  expect(results[0]?.[0]?.band).toBe('40m')
  expect(feed.getStatus()).not.toBe('')
  expect(fetch).toHaveBeenCalledTimes(9)
})

it('preserves partial reports and honors retryAfter when another band is rate limited', async () => {
  let now = at
  let limited = true
  const fetch = vi.fn(async (url: string) => {
    const band = new URL(url).searchParams.get('band')
    if (limited && band === '40m')
      return { status: 429, body: JSON.stringify({ error: { retryAfter: 120 } }) }
    return response(band === '20m' ? [row()] : band === '40m' ? [row({ frequency: 7033 })] : [])
  })
  const feed = createSpotFeed({
    source: 'n1rwj-rbn',
    now: () => now,
    fetch,
  })

  const spots = await feed.get(true)
  expect(spots).toHaveLength(1)
  expect(spots[0]?.band).toBe('20m')
  expect(feed.getStatus()).not.toBe('')
  expect(fetch).toHaveBeenCalledTimes(9)
  now += 61_000
  expect(await feed.get(true)).toEqual(spots)
  expect(fetch).toHaveBeenCalledTimes(9)
  limited = false
  now = at + 121_000
  expect(await feed.get(true)).toHaveLength(2)
  expect(feed.getStatus()).toBe('')
  expect(fetch).toHaveBeenCalledTimes(18)
})

it('shows fresh partial spots and a settings warning, then clears that warning after recovery', async () => {
  let now = at
  let failed = true
  const preferences: Record<string, JSONValue> = { spotCallFilter: 'none', spotContinents: [] }
  const runtime = createRbnSpots({
    now: () => now,
    lookup: () => undefined,
    fetch: async (url) => {
      const band = new URL(url).searchParams.get('band')
      if (failed && band === '40m') throw new Error('Request timed out')
      return response(band === '20m' ? [row()] : [])
    },
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      Object.assign(preferences, values)
    },
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
  })
  const ctx = { online: true }
  const definition = () => runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)

  expect((await runtime.spots.fetchSpots({}, ctx)).map((spot) => spot.their.call)).toEqual([
    'K1ABC',
  ])
  const elements = (await definition()).elements
  const warning = elements[elements.length - 1]
  expect(warning).toMatchObject({ type: 'markdown', text: expect.any(String) })
  if (warning?.type !== 'markdown') throw new Error('Missing settings status')
  expect(warning.text).not.toBe('')
  expect(warning.text).not.toContain('Reports cover the last ten minutes')
  expect(warning.text).not.toContain('cached reports only')

  failed = false
  now += 61_000
  expect(await runtime.spots.fetchSpots({}, ctx)).toHaveLength(1)
  const recoveredElements = (await definition()).elements
  expect(recoveredElements[recoveredElements.length - 1]).toMatchObject({
    type: 'markdown',
    text: expect.stringContaining('Reports cover the last ten minutes'),
  })
})
