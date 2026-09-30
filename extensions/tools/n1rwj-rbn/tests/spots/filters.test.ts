import { expect, it, vi } from 'vitest'
import { createReceiverData } from '../../src/data/receivers.ts'
import { createRbnTransport } from '../../src/data/transport.ts'
import { discoverFilters, matchFilter } from '../../src/spots/filters.ts'
import { createRbnSpots } from '../../src/spots/index.ts'
import { maxAgeMs, parseReports, selectSpots } from '../../src/spots/model.ts'
import { readPreferences, validation } from '../../src/spots/preferences.ts'

const now = Date.parse('2026-09-23T13:10:00Z')
const row = (overrides = {}) => ({
  callsign: 'K1ABC',
  frequency: 14032,
  mode: 'CW',
  timestamp: new Date(now - 1000).toISOString(),
  spotter: 'K1TTT',
  spotter_grid: 'FN42',
  ...overrides,
})

it('filters receiver IDs and directory grid regions before deduplicating; keeps modes and WARC bands', () => {
  const reports = parseReports(
    [
      row(),
      row({
        frequency: 14035,
        spotter: 'DL1ABC',
        spotter_grid: 'JO31',
        timestamp: new Date(now).toISOString(),
      }),
      row({ frequency: 10120 }),
      row({ frequency: 14074, mode: 'FT8' }),
      row({ callsign: 'W9NEW', spotter_grid: '' }),
    ],
    'rbn',
    now,
  )
  const spots = selectSpots(
    reports,
    undefined,
    { skimmers: [], grids: ['FN'] },
    () => undefined,
    now,
  )
  expect(spots.map((spot) => spot.freq)).toEqual([14032, 10120, 14074])
  expect(
    selectSpots(reports, new Set(['W9NEW']), { skimmers: [], grids: [] }, () => undefined, now),
  ).toHaveLength(1)
  expect(
    selectSpots(reports, undefined, { skimmers: ['K1TTT-5'], grids: [] }, () => undefined, now),
  ).toEqual([])
  expect(
    selectSpots(reports, undefined, { skimmers: [], grids: ['JO'] }, () => ({ grid: 'FN31' }), now),
  ).toEqual([])
  expect(
    selectSpots(
      reports,
      undefined,
      { skimmers: [], grids: [] },
      () => undefined,
      now + maxAgeMs + 1,
    ),
  ).toEqual([])
})

it('batches membership and rejects unknown calls, unavailable and failed providers', async () => {
  const invokeOne = vi.fn(async (_cat, key, _method, args) => [
    { key, ok: true, value: { version: 1, available: true, calls: args.calls.slice(0, 1) } },
  ])
  const bridge = { invokeOne, invokeAll: vi.fn(async () => []) }
  expect(
    (
      await matchFilter(
        'cwt',
        Array.from({ length: 4001 }, (_, i) => `K${i}ABC`),
        true,
        bridge,
      )
    ).size,
  ).toBe(3)
  expect(invokeOne.mock.calls.map((call) => call[3].calls.length)).toEqual([2000, 2000, 1])
  for (const replies of [
    [],
    [{ key: 'cwt', ok: false }],
    [{ key: 'cwt', ok: true, value: { version: 1, available: true, calls: ['W9NEW'] } }],
    [{ key: 'cwt', ok: true, value: { version: 1, available: false, calls: [] } }],
  ]) {
    await expect(
      matchFilter('cwt', ['K1ABC'], true, { ...bridge, invokeOne: async () => replies }),
    ).rejects.toThrow()
  }
  expect(
    await discoverFilters(true, {
      ...bridge,
      invokeAll: async () => [{ key: 'broken', ok: true, value: { version: 2 } }],
    }),
  ).toEqual({ providers: [], failed: true })
})

it('validates saved and edited filters without silently treating bad settings as all receivers', () => {
  expect(validation('spotMode', 'all')).toBeNull()
  expect(readPreferences({ spotMode: 'all' }).mode).toBe('all')
  expect(readPreferences({}).mode).toBe('all')
  expect(readPreferences({ spotMode: 'CW' }).mode).toBe('CW')
  expect(() => readPreferences({ spotMode: 'SSB' })).toThrow()
  expect(validation('spotSkimmers', 'km3t-5, K1TTT')).toBeNull()
  expect(validation('spotGrids', 'FN, em, JO31')).toBeNull()
  expect(validation('spotGrids', 'USA')).toBeTruthy()
  expect(validation('spotSkimmers', '***')).toBeTruthy()
  expect(() => readPreferences({ spotGrids: 'USA' })).toThrow()
  expect(readPreferences({ spotGrids: 'fn, FN' }).grids).toEqual(['FN'])
})

it('keeps UNKNOWN reports and matches their receiver ID and cached directory grid in Spots', () => {
  const directory = createReceiverData()
  directory.dataFile.onLoadRawData({
    schema: 1,
    nodes: [{ call: 'UNKNOWN', grid: 'JO21BX', country: 'Kazakhstan', continent: 'AS' }],
  })
  const reports = parseReports([row({ spotter: ' unknown ', spotter_grid: '' })], 'rbn', now)
  expect(reports).toHaveLength(1)
  const preferences = readPreferences({ spotSkimmers: 'unknown', spotGrids: 'JO' })
  expect(selectSpots(reports, undefined, preferences, directory.lookup, now)).toMatchObject([
    { spot: { sourceInfo: { spotter: 'UNKNOWN', spotterGrid: 'JO21BX' } } },
  ])
})

it('persists All mode, returns distinct modes for the same station, and switches back to RTTY', async () => {
  let preferences = { spotCallFilter: 'none', spotMode: 'CW' }
  const createRuntime = () =>
    createRbnSpots({
      now: () => now,
      lookup: () => undefined,
      getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
      setSettings: async (values) => {
        preferences = { ...preferences, ...values }
      },
      bridge: { invokeAll: async () => [], invokeOne: async () => [] },
      fetch: async () => ({
        status: 200,
        body: JSON.stringify({ spots: ['CW', 'RTTY', 'FT8', 'FT4'].map((mode) => row({ mode })) }),
      }),
    })
  const runtime = createRuntime()
  const definition = await runtime.settings.getDefinition(
    { panelKey: 'n1rwj-rbn' },
    { online: true },
  )
  expect(definition.elements).toContainEqual(
    expect.objectContaining({
      key: 'spotMode',
      options: expect.arrayContaining([{ label: 'All', value: 'all' }]),
    }),
  )
  expect((await runtime.spots.fetchSpots({}, { online: true })).map((spot) => spot.mode)).toEqual([
    'CW',
  ])
  await runtime.settings.onChangeField(
    { panelKey: 'n1rwj-rbn', fieldKey: 'spotMode', value: 'all', state: {} },
    { online: true },
  )
  expect(preferences.spotMode).toBe('all')
  for (const instance of [runtime, createRuntime()]) {
    expect(
      (await instance.spots.fetchSpots({}, { online: true })).map((spot) => spot.mode),
    ).toEqual(['CW', 'RTTY', 'FT8', 'FT4'])
  }
  await runtime.settings.onChangeField(
    { panelKey: 'n1rwj-rbn', fieldKey: 'spotMode', value: 'RTTY', state: {} },
    { online: true },
  )
  expect((await runtime.spots.fetchSpots({}, { online: true })).map((spot) => spot.mode)).toEqual([
    'RTTY',
  ])
})

it('defaults the settings field and spot feed to All when no mode was saved', async () => {
  const runtime = createRbnSpots({
    now: () => now,
    lookup: () => undefined,
    getSettings: async () => ({
      extensions: { 'extension_n1rwj-rbn': { spotCallFilter: 'none' } },
    }),
    setSettings: async () => {},
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
    fetch: async (url) => {
      expect(new URL(url).searchParams.has('mode')).toBe(false)
      return {
        status: 200,
        body: JSON.stringify({ spots: ['CW', 'RTTY', 'FT8', 'FT4'].map((mode) => row({ mode })) }),
      }
    },
  })
  const definition = await runtime.settings.getDefinition(
    { panelKey: 'n1rwj-rbn' },
    { online: true },
  )
  expect(definition.elements).toContainEqual(
    expect.objectContaining({ key: 'spotMode', value: 'all' }),
  )
  expect((await runtime.spots.fetchSpots({}, { online: true })).map((spot) => spot.mode)).toEqual([
    'CW',
    'RTTY',
    'FT8',
    'FT4',
  ])
})

it('shares rate limits and simultaneous requests between panel and spot callers', async () => {
  let clock = now
  const fetch = vi.fn(async () => ({
    status: 429,
    body: JSON.stringify({ error: { retryAfter: 120 } }),
  }))
  const transport = createRbnTransport(fetch, () => clock)
  await Promise.all([
    transport('https://vailrerbn.com/api/v1/spots?call=K1ABC'),
    transport('https://vailrerbn.com/api/v1/spots?call=K1ABC'),
  ])
  expect(fetch).toHaveBeenCalledTimes(1)
  clock += 61_000
  await expect(transport('https://vailrerbn.com/api/v1/spots?mode=CW')).rejects.toThrow(
    'rate limit',
  )
  expect(fetch).toHaveBeenCalledTimes(1)
  clock += 60_000
  await transport('https://vailrerbn.com/api/v1/spots?mode=CW')
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('invalidates results when preferences change during fetch and ages cached reports offline', async () => {
  let clock = now
  let preferences = { spotCallFilter: 'none' }
  let release: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const fetch = vi.fn(async () => {
    await waiting
    return { status: 200, body: JSON.stringify({ spots: [row()] }) }
  })
  const runtime = createRbnSpots({
    fetch,
    lookup: () => undefined,
    now: () => clock,
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      preferences = { ...preferences, ...values }
    },
  })
  const pending = runtime.spots.fetchSpots({}, { online: true })
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(9))
  await runtime.settings.onChangeField(
    { panelKey: 'n1rwj-rbn', fieldKey: 'spotGrids', value: 'FN', state: {} },
    { online: true },
  )
  release?.()
  expect(await pending).toEqual([])
  expect(await runtime.spots.fetchSpots({}, { online: false })).toHaveLength(1)
  clock += maxAgeMs
  expect(await runtime.spots.fetchSpots({}, { online: false })).toEqual([])
  expect(fetch).toHaveBeenCalledTimes(9)
})

it('rechecks the selected provider after the network and does not leak removed file matches', async () => {
  let available = true
  const runtime = createRbnSpots({
    now: () => now,
    lookup: () => undefined,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': { spotCallFilter: 'cwt' } } }),
    setSettings: async () => {},
    bridge: {
      invokeAll: async () => [
        {
          key: 'cwt',
          ok: true,
          value: { version: 1, label: 'CWT', available, defaultSelected: true },
        },
      ],
      invokeOne: async () => [
        { key: 'cwt', ok: true, value: { version: 1, available, calls: [] } },
      ],
    },
    fetch: async () => {
      available = false
      return { status: 200, body: JSON.stringify({ spots: [row()] }) }
    },
  })
  expect(await runtime.spots.fetchSpots({}, { online: true })).toEqual([])
})

it('ignores default hints from older providers and resets history to all calls', async () => {
  let preferences = {}
  const invokeOne = vi.fn(async () => [])
  const runtime = createRbnSpots({
    now: () => now,
    lookup: () => undefined,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      preferences = { ...preferences, ...values }
    },
    bridge: {
      invokeAll: async () => [
        {
          key: 'cwt',
          ok: true,
          value: { version: 1, label: 'CWT', available: false, defaultSelected: true },
        },
      ],
      invokeOne,
    },
    fetch: async () => ({ status: 200, body: JSON.stringify({ spots: [row()] }) }),
  })
  expect(await runtime.spots.fetchSpots({}, { online: true })).toHaveLength(1)
  expect(preferences).toEqual({})
  expect(invokeOne).not.toHaveBeenCalled()
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
  expect(form.elements).toContainEqual(
    expect.objectContaining({
      key: 'spotCallFilter',
      value: 'none',
      description: 'Default: All calls.',
    }),
  )
  await runtime.settings.resetSpotCallFilter({}, { online: true })
  expect(preferences).toEqual({ spotCallFilter: 'none' })
})

it('defaults to all calls and keeps resets usable when call-history discovery fails', async () => {
  let preferences = {}
  const runtime = createRbnSpots({
    now: () => now,
    lookup: () => undefined,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': preferences } }),
    setSettings: async (values) => {
      preferences = { ...preferences, ...values }
    },
    bridge: {
      invokeAll: async () => {
        throw new Error('Unavailable bridge')
      },
      invokeOne: async () => [],
    },
    fetch: async () => ({ status: 200, body: JSON.stringify({ spots: [row()] }) }),
  })
  expect(await runtime.spots.fetchSpots({}, { online: true })).toHaveLength(1)
  expect(
    (await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })).elements
      .length,
  ).toBeGreaterThan(0)
  await runtime.settings.resetAllSpotSettings({}, { online: true })
  expect(preferences).toMatchObject({ spotCallFilter: 'none' })
  const reset = { ...preferences }
  await runtime.settings.resetSpotSpeed({}, { online: true })
  expect(preferences).toEqual(reset)
  await runtime.settings.onChangeField(
    { panelKey: 'n1rwj-rbn', fieldKey: 'spotCallFilter', value: 'none', state: {} },
    { online: true },
  )
  expect(await runtime.spots.fetchSpots({}, { online: true })).toHaveLength(1)
})

it('invalidates an in-flight fetch on reset and serializes later edits against reset defaults', async () => {
  let preferences = {
    spotCallFilter: 'none',
    spotMinWpm: 30,
    spotRadiusGrid: 'FN42',
    spotRadiusMiles: 100,
  }
  let finish: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const fetch = vi.fn(async () => {
    await pending
    return { status: 200, body: JSON.stringify({ spots: [row({ wpm: 35 })] }) }
  })
  const runtime = createRbnSpots({
    fetch,
    now: () => now,
    lookup: () => undefined,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': { ...preferences } } }),
    setSettings: async (values) => {
      preferences = { ...preferences, ...values }
    },
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
  })
  const fetching = runtime.spots.fetchSpots({}, { online: true })
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(9))
  await runtime.settings.resetAllSpotSettings({}, { online: true })
  finish()
  expect(await fetching).toEqual([])
  expect(await runtime.spots.fetchSpots({}, { online: false })).toHaveLength(1)
  const results = await Promise.allSettled([
    runtime.settings.resetSpotDistance({}, { online: true }),
    runtime.settings.onChangeField(
      {
        panelKey: 'n1rwj-rbn',
        fieldKey: 'spotRadiusMiles',
        value: 50,
        state: { spotRadiusGrid: 'FN42' },
      },
      { online: true },
    ),
  ])
  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
})
