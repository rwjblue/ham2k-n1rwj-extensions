// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { FetchResponse, JSONValue, Spot } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { createReceiverData } from '../../src/data/receivers.ts'
import { createRbnSpots } from '../../src/spots/index.ts'
import { bands, maxAgeMs } from '../../src/spots/model.ts'
import type { ReceiverQueryEntry } from '../../src/spots/queries.ts'

const at = Date.parse('2026-09-30T16:00:00Z')
const ctx = { online: true }
const directory: ReceiverQueryEntry[] = [
  { call: 'KM3T-2', grid: 'FN42EB', continent: 'NA' },
  { call: 'KM3T-3', grid: 'FN42FF', continent: 'NA' },
  { call: 'W6FAR', grid: 'CM87', continent: 'NA' },
  { call: 'DL1FAR', grid: 'JO31', continent: 'EU' },
]
const row = (spotter: string, callsign = 'K1ABC', overrides = {}) => ({
  callsign,
  frequency: 7033,
  mode: 'CW',
  timestamp: new Date(at - 1000).toISOString(),
  spotter,
  spotter_grid: 'FN42EB',
  snr: 12,
  wpm: 28,
  ...overrides,
})
const response = (spots: unknown[], total = spots.length): FetchResponse => ({
  status: 200,
  body: JSON.stringify({ spots, total }),
})
const calls = (spots: Spot[]) => spots.map((spot) => spot.their.call).sort()

function harness(
  saved: Record<string, JSONValue>,
  reply: (url: URL) => FetchResponse,
  entries: readonly ReceiverQueryEntry[] = directory,
) {
  const receivers = createReceiverData()
  const loadDirectory = (values: readonly ReceiverQueryEntry[]) =>
    receivers.dataFile.onLoadRawData({
      schema: 1,
      nodes: values.map((entry) => ({ ...entry, country: null })),
    })
  if (entries.length) loadDirectory(entries)
  const preferences = { spotCallFilter: 'none', spotContinents: [], ...saved }
  const fetch = vi.fn(async (url: string) => reply(new URL(url)))
  const runtime = createRbnSpots({
    fetch,
    now: () => at,
    lookup: receivers.lookup,
    receiverEntries: receivers.entries,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      Object.assign(preferences, values)
    },
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
  })
  return {
    fetch,
    loadDirectory,
    get: (online = true) => runtime.spots.fetchSpots({}, { online }),
    urls: () => fetch.mock.calls.map(([url]) => new URL(url)),
    edit: (fieldKey: string, value: JSONValue) =>
      runtime.settings.onChangeField({ panelKey: 'n1rwj-rbn', fieldKey, value, state: {} }, ctx),
    definition: () => runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: false }),
  }
}

it('retrieves exact KM3T receiver reports excluded by the worldwide feed page cap', async () => {
  const runtime = harness({}, (url) => {
    const spotter = url.searchParams.get('spotter')
    if (spotter === 'KM3T-2')
      return response([
        row(spotter),
        row(spotter, 'N1TWOBANDS', { frequency: 14032 }),
        row('KM3T-3', 'N2WRONG'),
      ])
    if (spotter === 'KM3T-3') return response([row(spotter, 'N2ABC'), row('W6FAR', 'W6WRONG')])
    // The desired receivers would occur after the two worldwide pages.
    const band = bands.find(({ name }) => name === url.searchParams.get('band'))
    return response(
      Array.from({ length: 1000 }, () =>
        row('DL1FAR', 'DL1BUSY', { frequency: band?.low, spotter_grid: 'JO31' }),
      ),
      6000,
    )
  })
  expect((await runtime.get()).every((spot) => spot.their.call === 'DL1BUSY')).toBe(true)
  expect(runtime.fetch).toHaveBeenCalledTimes(18)

  await runtime.edit('spotSkimmers', 'KM3T-2, KM3T-3')
  const spots = await runtime.get()
  expect(calls(spots)).toEqual(['K1ABC', 'N1TWOBANDS', 'N2ABC'])
  expect(spots.map((spot) => spot.band).sort()).toEqual(['20m', '40m', '40m'])
  const queries = runtime.urls().slice(18)
  expect(queries).toHaveLength(2)
  expect(queries.map((url) => url.searchParams.get('spotter')).sort()).toEqual(['KM3T-2', 'KM3T-3'])
  for (const url of queries) {
    expect(url.searchParams.get('band')).toBeNull()
    expect(url.searchParams.get('mode')).toBeNull()
    expect(url.searchParams.get('limit')).toBe('1000')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('since')).toBe(String((at - maxAgeMs) / 1000))
    expect(url.searchParams.get('until')).toBe(String(at / 1000))
  }
})

it('queries nearby North American receivers for FN41FR within 100 miles', async () => {
  const runtime = harness(
    { spotRadiusGrid: 'FN41FR', spotRadiusMiles: 100, spotContinents: ['NA'] },
    (url) => {
      const spotter = url.searchParams.get('spotter')
      return response(
        spotter === 'KM3T-2'
          ? [row(spotter), row('W6FAR', 'W6WRONG')]
          : spotter === 'KM3T-3'
            ? [row(spotter, 'N2ABC')]
            : [row('DL1FAR', 'DL1BUSY')],
      )
    },
  )
  expect(calls(await runtime.get())).toEqual(['K1ABC', 'N2ABC'])
  expect(
    runtime
      .urls()
      .map((url) => url.searchParams.get('spotter'))
      .sort(),
  ).toEqual(['KM3T', 'KM3T-2', 'KM3T-3'])
  expect(runtime.urls().every((url) => !url.searchParams.has('band'))).toBe(true)
})

it('supplements radius queries with worldwide reports for receivers missing from the directory', async () => {
  const runtime = harness({ spotRadiusGrid: 'FN41FR', spotRadiusMiles: 100 }, (url) => {
    const spotter = url.searchParams.get('spotter')
    if (spotter) return response([row(spotter, spotter === 'KM3T-2' ? 'K1ABC' : 'N2ABC')])
    return response([
      row('W1NEW', 'W1ABC'),
      row('W6FAR', 'W6WRONG'), // Directory grid overrides the misleading report grid.
      row('W1LOST', 'W1WRONG', { spotter_grid: '' }),
    ])
  })
  expect(calls(await runtime.get())).toEqual(['K1ABC', 'N2ABC', 'W1ABC'])
  expect(runtime.urls().filter((url) => url.searchParams.has('spotter'))).toHaveLength(3)
  expect(runtime.urls().filter((url) => url.searchParams.has('band'))).toHaveLength(9)
})

it('refreshes changed receiver scopes within a minute and applies current filters offline or on error', async () => {
  const runtime = harness({}, (url) => {
    const spotter = url.searchParams.get('spotter')
    if (spotter === 'KM3T-3') return { status: 503, body: '' }
    return response([row('KM3T-2'), row('KM3T-3', 'N2ABC'), row('W6FAR', 'W6ABC')])
  })
  expect(calls(await runtime.get())).toEqual(['K1ABC', 'N2ABC', 'W6ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(9)

  await runtime.edit('spotSkimmers', 'KM3T-2')
  expect(calls(await runtime.get())).toEqual(['K1ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(10)
  expect(calls(await runtime.get())).toEqual(['K1ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(10)

  await runtime.edit('spotSkimmers', 'KM3T-3')
  expect(calls(await runtime.get(false))).toEqual(['N2ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(10)
  expect(calls(await runtime.get())).toEqual(['N2ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(11)
  const urls = runtime.urls()
  expect(urls[urls.length - 1]?.searchParams.get('spotter')).toBe('KM3T-3')

  await runtime.edit('spotSkimmers', 'KM3T-2')
  expect(calls(await runtime.get(false))).toEqual(['K1ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(11)
})

it('keeps mode caches separate when switching the same receiver scope', async () => {
  const runtime = harness({ spotSkimmers: 'KM3T-2', spotMode: 'CW' }, () =>
    response([row('KM3T-2'), row('KM3T-2', 'N2RTTY', { mode: 'RTTY' })]),
  )
  expect(calls(await runtime.get())).toEqual(['K1ABC'])
  await runtime.edit('spotMode', 'RTTY')
  expect(await runtime.get(false)).toEqual([])
  expect(calls(await runtime.get())).toEqual(['N2RTTY'])
  expect(runtime.urls().map((url) => url.searchParams.get('mode'))).toEqual(['CW', 'RTTY'])
  await runtime.edit('spotMode', 'CW')
  expect(calls(await runtime.get(false))).toEqual(['K1ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(2)
})

it('replans the receiver scope immediately when the directory is loaded', async () => {
  const runtime = harness(
    { spotRadiusGrid: 'FN41FR', spotRadiusMiles: 100, spotContinents: ['NA'] },
    (url) => {
      const spotter = url.searchParams.get('spotter')
      return response(spotter ? [row(spotter, spotter === 'KM3T-2' ? 'K1ABC' : 'N2ABC')] : [])
    },
    [],
  )
  expect(await runtime.get()).toEqual([])
  expect(runtime.fetch).not.toHaveBeenCalled()
  runtime.loadDirectory(directory)
  expect(calls(await runtime.get())).toEqual(['K1ABC', 'N2ABC'])
  expect(runtime.fetch).toHaveBeenCalledTimes(3)
})

it('bounds an exact receiver snapshot to two pages across all bands', async () => {
  const runtime = harness({ spotSkimmers: 'KM3T-2', spotMode: 'CW' }, () =>
    response(
      Array.from({ length: 1000 }, () => row('KM3T-2')),
      5000,
    ),
  )
  expect(calls(await runtime.get())).toEqual(['K1ABC'])
  expect(runtime.urls().map((url) => url.searchParams.get('offset'))).toEqual(['0', '1000'])
  for (const url of runtime.urls()) {
    expect(url.searchParams.get('spotter')).toBe('KM3T-2')
    expect(url.searchParams.get('band')).toBeNull()
    expect(url.searchParams.get('mode')).toBe('CW')
    expect(url.searchParams.get('limit')).toBe('1000')
    expect(url.searchParams.get('since')).toBe(String((at - maxAgeMs) / 1000))
    expect(url.searchParams.get('until')).toBe(String(at / 1000))
  }
})

it('retrieves Vail bare receiver reports for a directory-backed radius and continent', async () => {
  const runtime = harness(
    { spotRadiusGrid: 'FN41FR', spotRadiusMiles: 100, spotContinents: ['NA'] },
    (url) => response(url.searchParams.get('spotter') === 'KM3T' ? [row('KM3T')] : []),
    [
      { call: 'KM3T-2', grid: 'FN42ET', continent: 'NA' },
      { call: 'KM3T-3', grid: 'FN42ET', continent: 'NA' },
    ],
  )
  const spots = await runtime.get()
  expect(calls(spots)).toEqual(['K1ABC'])
  expect(spots[0]?.spot.sourceInfo).toMatchObject({ spotter: 'KM3T', spotterGrid: 'FN42ET' })
  expect(
    runtime
      .urls()
      .map((url) => url.searchParams.get('spotter'))
      .sort(),
  ).toEqual(['KM3T', 'KM3T-2', 'KM3T-3'])
})

it('explains unavailable suffix identities without rewriting the operator selection', async () => {
  const runtime = harness({ spotSkimmers: 'KM3T-2, KM3T-3' }, () => response([]))
  expect(await runtime.get()).toEqual([])
  const form = await runtime.definition()
  const field = form.elements.find(
    (element) => element.type === 'field' && element.key === 'spotSkimmers',
  )
  expect(field).toMatchObject({ value: 'KM3T-2, KM3T-3' })
  expect(
    form.elements.some(
      (element) =>
        element.type === 'markdown' &&
        element.text.includes('Individual suffixed nodes cannot be isolated'),
    ),
  ).toBe(true)
  expect(
    runtime
      .urls()
      .map((url) => url.searchParams.get('spotter'))
      .sort(),
  ).toEqual(['KM3T-2', 'KM3T-3'])
})
