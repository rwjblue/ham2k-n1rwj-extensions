import assert from 'node:assert/strict'
import type { BoardSpot } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { EVENT_2026, type ProgressMode, type Qson, qualifyingContacts } from '../src/rules.ts'
import { buildSpotRows } from '../src/spots.ts'

const now = Date.UTC(2026, 9, 20, 12)

function spot(call = 'W7O', patch: Partial<BoardSpot> = {}): BoardSpot {
  return {
    their: { call },
    freq: 14030,
    band: '20m',
    mode: 'CW',
    spot: { timeInMillis: now - 60_000, source: 'rbn' },
    ...patch,
  }
}

function qso(call = 'W7O', patch: Qson = {}): Qson {
  return {
    uuid: 'previous',
    their: { call },
    band: '20m',
    mode: 'CW',
    startAtMillis: now - 120_000,
    ...patch,
  }
}

function rows(spots: BoardSpot[], history: Qson[] = [], focus: ProgressMode = 'CW', at = now) {
  return buildSpotRows({
    spots,
    contacts: qualifyingContacts(history, EVENT_2026),
    event: EVENT_2026,
    focus,
    now: at,
    maxAgeMinutes: 15,
  })
}

test('merged calls split into exact published targets with canonical metadata and kHz intact', () => {
  const result = rows([
    spot(' w7b, W7I, W7B/P, W7B/K1, W3S, N1RWJ, W4S, W7B ', {
      band: ' 20M ',
      mode: ' cw-r ',
      freq: 14030.5,
    }),
  ])
  assert.deepEqual(
    result.map(({ call, band, mode, frequency, needed }) => ({
      call,
      band,
      mode,
      frequency,
      needed,
    })),
    ['W4S', 'W7B', 'W7I'].map((call) => ({
      call,
      band: '20m',
      mode: 'CW',
      frequency: 14030.5,
      needed: true,
    })),
  )
  assert.match(result[0].label, /Skunk Ape/)
})

test('missing or invalid band, mode, frequency and report time are excluded', () => {
  const patches: Partial<BoardSpot>[] = [
    { band: undefined },
    { band: '6m' },
    { mode: undefined },
    { mode: 'Digital' },
    { freq: undefined },
    { freq: Number.NaN },
    { freq: Number.POSITIVE_INFINITY },
    { freq: 0 },
    { freq: -14030 },
    { spot: { timeInMillis: Number.NaN, source: 'rbn' } },
    { spot: { timeInMillis: Number.POSITIVE_INFINITY, source: 'rbn' } },
  ]
  for (const patch of patches) assert.deepEqual(rows([spot('W7B', patch)]), [], String(patch))
  const noTime = spot('W7B')
  Reflect.deleteProperty(noTime.spot, 'timeInMillis')
  assert.deepEqual(rows([noTime]), [])
  const noCall = spot('')
  assert.deepEqual(rows([noCall]), [])
})

test('freshness uses report time, includes the cutoff, and excludes every future report', () => {
  const result = rows([
    spot('W7B', { spot: { timeInMillis: now - 15 * 60_000, source: 'cutoff' } }),
    spot('W7I', { spot: { timeInMillis: now - 15 * 60_000 - 1, source: 'stale' } }),
    spot('W7G', { spot: { timeInMillis: now + 1, source: 'future' } }),
    spot('W7F', { spot: { timeInMillis: now, source: 'current' } }),
  ])
  assert.deepEqual(
    result.map((row) => row.call),
    ['W7F', 'W7B'],
  )
  assert.deepEqual(
    result.map((row) => row.at),
    [now, now - 15 * 60_000],
  )
})

test('frequency and reported band must agree before a spot can supply another W7O band', () => {
  const mislabeled = spot('W7O', { band: '40m', freq: 14050 })
  assert.deepEqual(rows([mislabeled], [qso()]), [])
  assert.deepEqual(rows([spot('W7B', { band: '20m', freq: 7030 })]), [])
  const sameBand = rows([spot('W7O', { band: '20m', freq: 14050 })], [qso()])
  assert.equal(sameBand[0].needed, false)
  const anotherBand = rows([spot('W7O', { band: '40m', freq: 7030 })], [qso()])
  assert.equal(anotherBand[0].needed, true)
})

test('MHz-like values, Hz-like values and frequencies outside known bands are excluded', () => {
  for (const freq of [14.05, 7.03, 14050000, 15000, Number.MAX_VALUE])
    assert.deepEqual(rows([spot('W7B', { freq })]), [], `frequency ${freq}`)
})

test('exact kHz band boundaries follow the declared shared library without unit guessing', () => {
  // These are the library's inclusive recognition envelopes, not a transmit
  // permission or a replacement for the operator's regional band plan.
  for (const [band, lower, upper] of [
    ['40m', 6900, 7400],
    ['20m', 13900, 14400],
  ] as const) {
    for (const freq of [lower, upper]) {
      const result = rows([spot('W7B', { band, freq })])
      assert.equal(result.length, 1, `${band} at ${freq} kHz`)
      assert.equal(result[0].band, band)
      assert.equal(result[0].frequency, freq)
    }
    for (const freq of [lower - 0.001, upper + 0.001])
      assert.deepEqual(rows([spot('W7B', { band, freq })]), [], `${band} at ${freq} kHz`)
  }
})

test('malformed external spot rows cannot throw or manufacture a target', () => {
  const malformed: unknown[] = [
    null,
    undefined,
    false,
    42,
    'W7B',
    {},
    { ...spot(), spot: null },
    { ...spot(), spot: { timeInMillis: '2026-10-20T12:00:00Z' } },
    { ...spot(), spot: { timeInMillis: null } },
    { ...spot(), their: null },
    { ...spot(), their: { call: ['W7B'] } },
    { ...spot(), band: ['20m'] },
    { ...spot(), mode: ['CW'] },
    { ...spot(), freq: '14030' },
  ]
  assert.deepEqual(rows(malformed as BoardSpot[]), [])
  assert.equal(rows([...malformed, spot('W7B')] as BoardSpot[])[0].call, 'W7B')
})

test('receivers deduplicate by call, band, canonical actual mode and exact frequency', () => {
  const spots = [
    spot('W7O', { spot: { timeInMillis: now - 90_000, source: 'older' } }),
    spot('W7O', { mode: 'CW-R', spot: { timeInMillis: now - 60_000, source: 'newest' } }),
    spot('W7O', { freq: 14031 }),
    spot('W7O', { mode: 'RTTY', freq: 14080 }),
    spot('W7O', { mode: 'RTTY-R', freq: 14080 }),
  ]
  const result = rows(spots, [], 'MIXED')
  assert.equal(result.length, 3)
  assert.equal(result.find((row) => row.frequency === 14030)?.source, 'newest')
  assert.deepEqual(result, rows([...spots].reverse(), [], 'MIXED'))
})

test('source tie breaking is deterministic and the displayed label is preferred', () => {
  const a = spot('W7B', { spot: { timeInMillis: now, source: 'z-source', label: 'Receiver A' } })
  const b = spot('W7B', { spot: { timeInMillis: now, source: 'a-source', label: 'Receiver B' } })
  assert.equal(rows([b, a])[0].source, 'Receiver A')
  assert.deepEqual(rows([b, a]), rows([a, b]))
  assert.equal(
    rows([spot('W7B', { spot: { timeInMillis: now, source: ' ' } })])[0].source,
    undefined,
  )
})

test('worked annotations cannot hide an independently needed letter or bonus', () => {
  const result = rows([
    spot('W7B', { annotations: { worked: true, isSelf: false, notices: [] } }),
    spot('W4S', { annotations: { worked: true, isSelf: false, notices: [] } }),
  ])
  assert.ok(result.every((row) => row.needed))
  const worked = rows([spot('W7B'), spot('W4S')], [qso('W7B'), qso('W4S', { uuid: 'bonus' })])
  assert.ok(worked.every((row) => !row.needed))
  assert.match(worked.find((row) => row.call === 'W4S')?.status ?? '', /bonus worked/)
})

test('same-band same-mode W7O repeats remain known without claiming the second O', () => {
  const result = rows([spot()], [qso()])
  assert.equal(result.length, 1)
  assert.equal(result[0].needed, false)
  assert.match(result[0].status, /Second O still needed; use another band or UTC date/)
})

test('a new W7O band advances CW and mixed progress until both O contacts are complete', () => {
  const second = spot('W7O', { band: '40m', freq: 7030 })
  for (const focus of ['CW', 'MIXED'] as const) {
    assert.equal(rows([second], [qso()], focus)[0].needed, true)
    const completed = rows([second], [qso(), qso('W7O', { uuid: 'second', band: '40m' })], focus)
    assert.equal(completed[0].needed, false)
    assert.match(completed[0].status, /Both O contacts worked/)
  }
})

test('a fresh previous-day spot can fill the second O today, using NOW for candidate credit', () => {
  const midnight = Date.UTC(2026, 9, 20, 0, 1)
  const reportAt = midnight - 120_000
  const result = rows(
    [spot('W7O', { spot: { timeInMillis: reportAt, source: 'rbn' } })],
    [qso('W7O', { startAtMillis: reportAt })],
    'CW',
    midnight,
  )
  assert.equal(result[0].at, reportAt)
  assert.equal(result[0].needed, true)
  assert.match(result[0].status, /Second O needed/)
})

test('focus excludes other mode families while mixed retains every supported actual mode', () => {
  const spots = [
    spot('W7B', { mode: 'CW-USB' }),
    spot('W7I', { mode: 'LSB', freq: 14250 }),
    spot('W7G', { mode: 'FT8', freq: 14074 }),
    spot('W7F', { mode: 'FT4', freq: 14080 }),
    spot('W7T', { mode: 'RTTY-USB', freq: 14090 }),
  ]
  assert.deepEqual(
    rows(spots, [], 'CW').map((row) => row.mode),
    ['CW'],
  )
  assert.deepEqual(
    rows(spots, [], 'PHONE').map((row) => row.mode),
    ['SSB'],
  )
  assert.deepEqual(
    rows(spots, [], 'DIGITAL').map((row) => row.mode),
    ['FT4', 'FT8', 'RTTY'],
  )
  assert.equal(rows(spots, [], 'MIXED').length, 5)
})

test('phone focus ignores CW completion and normalizes sidebands for the second O', () => {
  const ssb = spot('W7O', { mode: 'USB', freq: 14250 })
  assert.equal(rows([ssb], [qso()], 'PHONE')[0].needed, true)
  const repeat = rows([ssb], [qso('W7O', { mode: 'LSB' })], 'PHONE')[0]
  assert.equal(repeat.needed, false)
  assert.match(repeat.status, /^Phone: Second O still needed/)
  assert.match(repeat.status, /another band or UTC date/)
  assert.doesNotMatch(repeat.status, /band, mode/)
  assert.equal(rows([ssb], [qso('W7O', { mode: 'SSB' })], 'MIXED')[0].needed, false)
})

test('digital family counts an FT8 plus RTTY O pair, without demanding two RTTY contacts', () => {
  const rtty = spot('W7O', { mode: 'RTTY-R', freq: 14090 })
  const first = qso('W7O', { mode: 'FT8' })
  assert.equal(rows([rtty], [first], 'DIGITAL')[0].needed, true)
  assert.match(rows([rtty], [first], 'DIGITAL')[0].status, /^Digital: Second O needed/)
  const completed = [first, qso('W7O', { uuid: 'rtty', mode: 'RTTY' })]
  const result = rows([spot('W7O', { mode: 'FT4', freq: 14080 })], completed, 'DIGITAL')[0]
  assert.equal(result.needed, false)
  assert.match(result.status, /Both O contacts worked/)
})

test('mixed completion cannot erase a still-needed CW bonus', () => {
  const history = [qso('W4S', { mode: 'SSB' })]
  assert.equal(rows([spot('W4S')], history, 'MIXED')[0].needed, false)
  assert.equal(rows([spot('W4S')], history, 'CW')[0].needed, true)
})

test('fresh spots outside the event remain known but promise no credit', () => {
  const after = EVENT_2026.endAtMillis
  const result = rows(
    [spot('W7B', { spot: { timeInMillis: after, source: 'rbn' } })],
    [],
    'CW',
    after,
  )
  assert.equal(result[0].needed, false)
  assert.match(result[0].status, /Outside the confirmed 2026 event window/)
})

test('invalid clock or age options never widen the spot window', () => {
  for (const maxAgeMinutes of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])
    assert.deepEqual(
      buildSpotRows({
        spots: [spot()],
        contacts: [],
        event: EVENT_2026,
        focus: 'CW',
        now,
        maxAgeMinutes,
      }),
      [],
    )
  assert.deepEqual(rows([spot()], [], 'CW', Number.NaN), [])
})

test('projection preserves frozen SDK spots and contact snapshots', () => {
  const held = spot('W7B')
  Object.freeze(held.their)
  Object.freeze(held.spot)
  Object.freeze(held)
  const contacts = qualifyingContacts([qso()], EVENT_2026).map((contact) => Object.freeze(contact))
  const before = JSON.stringify({ held, contacts })
  assert.equal(
    buildSpotRows({
      spots: Object.freeze([held]),
      contacts: Object.freeze(contacts),
      event: EVENT_2026,
      focus: 'CW',
      now,
      maxAgeMinutes: 15,
    }).length,
    1,
  )
  assert.equal(JSON.stringify({ held, contacts }), before)
})
