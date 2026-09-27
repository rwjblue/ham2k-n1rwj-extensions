import { expect, it } from 'vitest'
import { parseReports, selectSpots } from '../../src/spots/model.ts'
import { readPreferences, validateEdit, validation } from '../../src/spots/preferences.ts'

const now = Date.parse('2026-09-27T12:00:00Z')
const row = (wpm: unknown, overrides = {}) => ({
  callsign: 'K1ABC',
  spotter: 'KM3T-5',
  frequency: 14032,
  mode: 'CW',
  timestamp: new Date(now - 1000).toISOString(),
  wpm,
  ...overrides,
})
const select = (rows: unknown[], raw: Record<string, unknown>) =>
  selectSpots(parseReports(rows, 'rbn', now), undefined, readPreferences(raw), () => undefined, now)

it('filters CW speeds inclusively before deduplication and leaves digital modes alone', () => {
  const rows = [
    row(20),
    row(35, { timestamp: new Date(now).toISOString() }),
    row(25, { callsign: 'N2ABC' }),
    row(19, { callsign: 'N3ABC' }),
    row(26, { callsign: 'N4ABC' }),
    ...['RTTY', 'FT8', 'FT4'].map((mode) => row(null, { mode })),
  ]
  const spots = select(rows, { spotMinWpm: 20, spotMaxWpm: 25 })
  expect(spots.map((spot) => [spot.their.call, spot.mode])).toEqual([
    ['K1ABC', 'CW'],
    ['N2ABC', 'CW'],
    ['K1ABC', 'RTTY'],
    ['K1ABC', 'FT8'],
    ['K1ABC', 'FT4'],
  ])
  expect(spots[0].spot.sourceInfo?.wpm).toBe(20)
})

it('supports either bound alone and keeps unknown speeds only when no limit is active', () => {
  for (const speed of [undefined, null, 0, -1, '20', NaN, Infinity]) {
    expect(select([row(speed)], {})).toHaveLength(1)
    expect(select([row(speed)], { spotMinWpm: 20 })).toEqual([])
    expect(select([row(speed)], { spotMaxWpm: 25 })).toEqual([])
  }
  expect(select([row(99)], { spotMinWpm: 20 })).toHaveLength(1)
  expect(select([row(5)], { spotMaxWpm: 25 })).toHaveLength(1)
  expect(select([row(null)], { spotMinWpm: '', spotMaxWpm: null })).toHaveLength(1)
})

it('validates positive whole-number speeds and rejects reversed saved and edited ranges', () => {
  for (const key of ['spotMinWpm', 'spotMaxWpm']) {
    for (const value of [0, -1, 20.5, true, [], {}, 'fast', NaN, Infinity])
      expect(validation(key, value)).toBeTruthy()
    for (const value of ['', ' ', null, '20', 20, 100]) expect(validation(key, value)).toBeNull()
  }
  expect(validateEdit('spotMinWpm', 30, { spotMaxWpm: 20 })).toContain('Minimum')
  expect(validateEdit('spotMaxWpm', 20, { spotMinWpm: 30 })).toContain('Minimum')
  expect(validateEdit('spotMaxWpm', '', { spotMinWpm: 30 })).toBeNull()
  expect(readPreferences({ spotMinWpm: '20', spotMaxWpm: 20 }).cwSpeed).toEqual({
    min: 20,
    max: 20,
  })
  expect(() => readPreferences({ spotMinWpm: 30, spotMaxWpm: 20 })).toThrow('Minimum')
  expect(() => readPreferences({ spotMinWpm: 'bad' })).toThrow('Invalid saved')
})
