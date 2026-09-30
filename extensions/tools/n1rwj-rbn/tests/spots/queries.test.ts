import { expect, it } from 'vitest'
import { createReceiverData } from '../../src/data/receivers.ts'
import { readPreferences } from '../../src/spots/preferences.ts'
import {
  maxDirectedSkimmers,
  planSpotQueries,
  type ReceiverQueryEntry,
} from '../../src/spots/queries.ts'

const entries: ReceiverQueryEntry[] = [
  { call: 'KM3T-2', grid: 'FN42ET', continent: 'NA' },
  { call: 'KM3T-3', grid: 'FN42ET', continent: 'NA' },
  { call: 'DL1FAR', grid: 'JO31', continent: 'EU' },
  { call: 'W1NOGRID', grid: null, continent: 'NA' },
  { call: 'W1UNKNOWN', grid: 'FN42ET', continent: null },
]

it('directs exact skimmer queries independently of the directory and other receiver filters', () => {
  const preferences = readPreferences({
    spotSkimmers: 'km3t-3, KM3T-2, km3t-3, KM3T-20',
    spotContinents: ['EU'],
    spotGrids: 'JO',
  })
  expect(planSpotQueries(preferences, entries)).toEqual({
    skimmers: ['KM3T-2', 'KM3T-20', 'KM3T-3'],
    includeGlobal: false,
  })
  expect(planSpotQueries(preferences)).toEqual(planSpotQueries(preferences, entries))
})

it('includes KM3T receivers within 100 miles of FN41FR and excludes known distant receivers', () => {
  const preferences = readPreferences({
    spotRadiusGrid: 'FN41FR',
    spotRadiusMiles: 100,
    spotContinents: ['NA'],
  })
  expect(planSpotQueries(preferences, entries)).toEqual({
    skimmers: ['KM3T', 'KM3T-2', 'KM3T-3', 'W1NOGRID'],
    includeGlobal: false,
  })
  expect(
    planSpotQueries(
      readPreferences({
        spotRadiusGrid: 'FN41FR',
        spotRadiusMiles: 50,
        spotContinents: ['NA'],
      }),
      entries,
    ),
  ).toEqual({ skimmers: ['W1NOGRID'], includeGlobal: false })
})

it('retains a global supplement for geography when unknown receiver report grids can match', () => {
  expect(
    planSpotQueries(
      readPreferences({ spotRadiusGrid: 'FN41FR', spotRadiusMiles: 100, spotGrids: 'FN' }),
      entries,
    ),
  ).toEqual({
    skimmers: ['KM3T', 'KM3T-2', 'KM3T-3', 'W1NOGRID', 'W1UNKNOWN'],
    includeGlobal: true,
  })
})

it('intersects directory continents with grid prefixes and keeps entries needing report grids', () => {
  expect(
    planSpotQueries(readPreferences({ spotContinents: ['EU'], spotGrids: 'FN' }), entries),
  ).toEqual({ skimmers: [], includeGlobal: false })
  expect(
    planSpotQueries(readPreferences({ spotContinents: ['NA'], spotGrids: 'JO' }), entries),
  ).toEqual({ skimmers: ['W1NOGRID'], includeGlobal: false })
  expect(planSpotQueries(readPreferences({ spotContinents: ['EU'] }), entries)).toEqual({
    skimmers: ['DL1FAR'],
    includeGlobal: false,
  })
})

it('distinguishes no known matches from unavailable directory enumeration and unfiltered queries', () => {
  const preferences = readPreferences({ spotContinents: ['NA'] })
  expect(planSpotQueries(preferences, [])).toEqual({ skimmers: [], includeGlobal: false })
  expect(planSpotQueries(preferences)).toEqual({ skimmers: [], includeGlobal: true })
  expect(planSpotQueries(readPreferences({}), entries)).toEqual({
    skimmers: [],
    includeGlobal: true,
  })
})

it('bounds directed queries without partially selecting explicit or geographic receiver sets', () => {
  const many = Array.from({ length: maxDirectedSkimmers + 1 }, (_, index) => ({
    call: `K${index}RX`,
    grid: 'FN42ET',
    continent: 'NA' as const,
  }))
  const first = many.slice(0, maxDirectedSkimmers)
  for (const receivers of [first, many]) {
    const expected =
      receivers.length === maxDirectedSkimmers
        ? { skimmers: receivers.map((receiver) => receiver.call).sort(), includeGlobal: false }
        : { skimmers: [], includeGlobal: true }
    expect(
      planSpotQueries(
        readPreferences({ spotSkimmers: receivers.map((receiver) => receiver.call).join(',') }),
      ),
    ).toEqual(expected)
    expect(planSpotQueries(readPreferences({ spotContinents: ['NA'] }), receivers)).toEqual(
      expected,
    )
  }
})

it('queries each geographic receiver identity and its bare family without duplicating an existing base', () => {
  expect(
    planSpotQueries(readPreferences({ spotContinents: ['NA'] }), [
      ...entries,
      { call: 'KM3T', grid: 'FN42ET', continent: 'NA' },
    ]),
  ).toEqual({
    skimmers: ['KM3T', 'KM3T-2', 'KM3T-3', 'W1NOGRID'],
    includeGlobal: false,
  })
})

it('counts family alias queries toward the directed request bound', () => {
  const many = Array.from({ length: maxDirectedSkimmers / 2 + 1 }, (_, index) => ({
    call: `K${index}RX-2`,
    grid: 'FN42ET',
    continent: 'NA' as const,
  }))
  const first = many.slice(0, maxDirectedSkimmers / 2)
  expect(planSpotQueries(readPreferences({ spotContinents: ['NA'] }), first)).toEqual({
    skimmers: first.flatMap((receiver) => [receiver.call, receiver.call.slice(0, -2)]).sort(),
    includeGlobal: false,
  })
  expect(planSpotQueries(readPreferences({ spotContinents: ['NA'] }), many)).toEqual({
    skimmers: [],
    includeGlobal: true,
  })
})

it('exposes current directory entries after reload and removal for fresh query planning', async () => {
  const data = createReceiverData()
  expect(data.entries()).toEqual([])
  data.dataFile.onLoadRawData({
    schema: 1,
    nodes: entries.map((entry) => ({ ...entry, country: null })),
  })
  expect(data.entries()).toEqual(entries.map((entry) => ({ ...entry, country: null })))
  const preferences = readPreferences({ spotContinents: ['NA'], spotGrids: 'FN' })
  expect(planSpotQueries(preferences, data.entries()).skimmers).toEqual([
    'KM3T',
    'KM3T-2',
    'KM3T-3',
    'W1NOGRID',
  ])
  data.dataFile.onLoadRawData({
    schema: 1,
    nodes: [{ call: 'KM3T-2', grid: 'JO31', country: null, continent: 'NA' }],
  })
  expect(planSpotQueries(preferences, data.entries())).toEqual({
    skimmers: [],
    includeGlobal: false,
  })
  await data.dataFile.onRemoveRawData()
  expect(data.entries()).toEqual([])
})
