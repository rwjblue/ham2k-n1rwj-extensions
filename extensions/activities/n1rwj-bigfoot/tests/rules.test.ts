import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  buildProgress,
  EVENT_2026,
  eventForYear,
  normalizeMode,
  progressForContacts,
  type Qson,
  qualifyingContacts,
  sameModeProgress,
} from '../src/rules.ts'

const firstDay = Date.UTC(2026, 9, 13, 12)

function qso(call = 'W7O', overrides: Qson = {}): Qson {
  return {
    uuid: 'first',
    their: { call, sent: '579' },
    our: { sent: '599' },
    band: '20m',
    mode: 'CW',
    startAtMillis: firstDay,
    ...overrides,
  }
}

function contacts(qsos: Qson[]) {
  return qualifyingContacts(qsos, EVENT_2026)
}

function progress(qsos: Qson[]) {
  return progressForContacts(contacts(qsos), 'MIXED')
}

test('only a published year resolves to event rules', () => {
  assert.equal(eventForYear(2026), EVENT_2026)
  assert.equal(eventForYear(' 2026 '), EVENT_2026)
  for (const value of [2025, 2027, undefined, null, '', '2026-10-13', true, {}])
    assert.equal(eventForYear(value), undefined)
})

test('event window includes its opening instant and final millisecond, not either neighbor', () => {
  const times = [
    EVENT_2026.startAtMillis - 1,
    EVENT_2026.startAtMillis,
    EVENT_2026.endAtMillis - 1,
    EVENT_2026.endAtMillis,
  ]
  const result = contacts(
    times.map((startAtMillis, index) => qso('W7B', { uuid: `${index}`, startAtMillis })),
  )
  assert.deepEqual(
    result.map((contact) => contact.at),
    times.slice(1, 3),
  )
  assert.equal(result[1].utcDate, '2026-10-21')
})

test('other event years, unrelated calls and call suffixes do not receive credit', () => {
  assert.equal(
    contacts([
      qso('W7B', { uuid: 'past', startAtMillis: Date.UTC(2025, 9, 13) }),
      qso('W7B', { uuid: 'future', startAtMillis: Date.UTC(2027, 9, 13) }),
      qso('N1RWJ', { uuid: 'other' }),
      qso('W7B/P', { uuid: 'portable' }),
      qso('K7B', { uuid: 'lookalike' }),
    ]).length,
    0,
  )
})

test('all published bands count while other and missing bands do not', () => {
  const result = contacts(EVENT_2026.bands.map((band) => qso('W7B', { uuid: band, band })))
  assert.equal(result.length, 8)
  for (const band of ['', '160m', '60m', '6m', 'unknown'])
    assert.equal(contacts([qso('W7B', { band })]).length, 0)
})

test('normalizes known modes and leaves actual digital modes distinct', () => {
  for (const mode of ['CW', 'cw-r', 'CW-LSB', 'CW-USB']) assert.equal(normalizeMode(mode), 'CW')
  for (const mode of ['SSB', 'USB', 'LSB']) assert.equal(normalizeMode(mode), 'SSB')
  for (const mode of ['RTTY', 'RTTY-R', 'RTTY-USB', 'RTTY-LSB'])
    assert.equal(normalizeMode(mode), 'RTTY')
  assert.equal(normalizeMode(' FT8 '), 'FT8')
  assert.equal(normalizeMode('ft4'), 'FT4')
  for (const mode of ['DATA', 'DATA-USB', 'DIGITAL', 'PHONE', 'FM', 'AM', 'PSK31', '', undefined])
    assert.equal(normalizeMode(mode), undefined)
})

test('unknown modes and unknown or invalid times cannot establish credit', () => {
  for (const mode of ['', 'DATA', 'FM', 'unknown'])
    assert.equal(contacts([qso('W7B', { mode })]).length, 0)
  for (const startAtMillis of [null, '2026-10-13T12:00:00Z', 0, -1, Number.NaN, Infinity])
    assert.equal(contacts([qso('W7B', { startAtMillis })]).length, 0)
  const missing = qso('W7B')
  delete missing.startAtMillis
  assert.equal(contacts([missing]).length, 0)
  for (const startAt of ['', 'invalid', '2026-10-13', '2026-10-13T12:00:00'])
    assert.equal(contacts([{ ...missing, startAt }]).length, 0)
})

test('explicitly zoned ISO time fallback uses UTC date, not local calendar date', () => {
  const row = qso('w7b', { their: { call: ' w7b ', sent: ' 579 ' }, band: ' 20M ', mode: ' cw ' })
  delete row.startAtMillis
  const [contact] = contacts([{ ...row, startAt: '2026-10-13T20:05:00-04:00' }])
  assert.equal(contact.at, Date.UTC(2026, 9, 14, 0, 5))
  assert.equal(contact.utcDate, '2026-10-14')
  assert.equal(contact.call, 'W7B')
  assert.equal(contact.band, '20m')
  assert.equal(contact.mode, 'CW')
  assert.equal(contact.sentReport, '599')
  assert.equal(contact.receivedReport, '579')
})

test('numeric time wins over a conflicting ISO field; invalid explicit time is not repaired', () => {
  const startAt = '2026-10-14T00:05:00Z'
  assert.equal(contacts([qso('W7B', { startAt })])[0].at, firstDay)
  assert.equal(contacts([qso('W7B', { startAt, startAtMillis: null })]).length, 0)
})

test('reports stay blank if the operator did not enter them', () => {
  const [contact] = contacts([qso('W7B', { our: {}, their: { call: 'W7B' } })])
  assert.equal(contact.sentReport, '')
  assert.equal(contact.receivedReport, '')
})

test('deletions and edits recompute progress from the current log', () => {
  const row = qso('W7B')
  assert.equal(progress([row]).worked, 1)
  assert.equal(progress([{ ...row, deleted: true }]).worked, 0)
  assert.equal(progress([{ ...row, their: { call: 'N1RWJ' } }]).worked, 0)
  assert.equal(progress([{ ...row, band: '6m' }]).worked, 0)
  assert.equal(progress([{ ...row, mode: 'FM' }]).worked, 0)
  assert.equal(progress([{ ...row, startAtMillis: EVENT_2026.endAtMillis }]).worked, 0)
  assert.equal(progress([]).worked, 0)
})

test('event markers do not count even with otherwise eligible fields', () => {
  assert.equal(contacts([qso('W7B', { event: { event: 'start' } })]).length, 0)
})

test('the last revision of a UUID replaces earlier data, including deletion', () => {
  const row = qso('W7B')
  assert.equal(contacts([row, { ...row, deleted: true }]).length, 0)
  assert.equal(contacts([row, { ...row, their: { call: 'N1RWJ' } }]).length, 0)
  assert.equal(contacts([row, { ...row, band: '40m' }])[0].band, '40m')
})

test('one contact and exact repeats never fill both Os', () => {
  const row = qso()
  assert.equal(progress([row]).worked, 1)
  assert.equal(progress([row, row]).worked, 1)
  assert.equal(
    progress([row, qso('W7O', { uuid: 'second', startAtMillis: firstDay + 60_000 })]).worked,
    1,
  )
})

test('unkeyed duplicate copies do not become separate contacts', () => {
  const row = qso()
  delete row.uuid
  assert.equal(contacts([row, { ...row }]).length, 1)
  assert.equal(progress([row, { ...row }]).worked, 1)
})

test('a repeated contact identity cannot be allocated to different letters', () => {
  const [contact] = contacts([qso('W7B')])
  const result = progressForContacts([contact, { ...contact, call: 'W7O' }], 'MIXED')
  assert.equal(result.worked, 1)
})

test('a second W7O counts on another band, actual mode, or UTC day', () => {
  const changes: Qson[] = [
    { band: '40m' },
    { mode: 'SSB' },
    { startAtMillis: firstDay + 86_400_000 },
  ]
  for (const change of changes) {
    const result = progress([qso(), qso('W7O', { uuid: 'second', ...change })])
    assert.equal(result.worked, 2)
    assert.equal(result.slots[4].contact?.uuid, 'first')
    assert.equal(result.slots[5].contact?.uuid, 'second')
  }
})

test('USB and LSB are the same SSB mode for the second-O rule', () => {
  assert.equal(
    progress([qso('W7O', { mode: 'USB' }), qso('W7O', { uuid: 'second', mode: 'LSB' })]).worked,
    1,
  )
})

test('CW and RTTY rig variants do not manufacture a new mode', () => {
  for (const [first, second] of [
    ['CW', 'CW-R'],
    ['RTTY', 'RTTY-USB'],
  ])
    assert.equal(
      progress([qso('W7O', { mode: first }), qso('W7O', { uuid: 'second', mode: second })]).worked,
      1,
    )
})

test('different digital modes can provide the mixed-mode pair without completing either same-mode pair', () => {
  const result = contacts([
    qso('W7O', { mode: 'FT8' }),
    qso('W7O', { uuid: 'second', mode: 'RTTY' }),
  ])
  assert.equal(buildProgress(result).MIXED.worked, 2)
  assert.equal(buildProgress(result).DIGITAL.worked, 2)
  assert.equal(sameModeProgress(result).FT8.worked, 1)
  assert.equal(sameModeProgress(result).RTTY.worked, 1)
})

test('UTC midnight qualifies another O even while the operator remains on the same local date', () => {
  const before = Date.UTC(2026, 9, 14, 23, 59, 59)
  const after = before + 1_000
  const result = progress([
    qso('W7O', { startAtMillis: before }),
    qso('W7O', { uuid: 'second', startAtMillis: after }),
  ])
  assert.equal(result.worked, 2)
  assert.equal(result.slots[4].contact?.utcDate, '2026-10-14')
  assert.equal(result.slots[5].contact?.utcDate, '2026-10-15')
})

test('CW progress selects its own O pair even when mixed uses a different pair', () => {
  const result = buildProgress(
    contacts([
      qso('W7O', { uuid: 'phone', mode: 'SSB', startAtMillis: firstDay - 60_000 }),
      qso('W7O', { uuid: 'cw-first' }),
      qso('W7O', { uuid: 'cw-duplicate', startAtMillis: firstDay + 60_000 }),
      qso('W7O', { uuid: 'cw-second', band: '40m', startAtMillis: firstDay + 120_000 }),
    ]),
  )
  assert.deepEqual(
    result.MIXED.slots.slice(4, 6).map((slot) => slot.contact?.uuid),
    ['phone', 'cw-first'],
  )
  assert.deepEqual(
    result.CW.slots.slice(4, 6).map((slot) => slot.contact?.uuid),
    ['cw-first', 'cw-second'],
  )
  assert.equal(result.PHONE.worked, 1)
})

test('slot selection is deterministic regardless of input log order', () => {
  const rows = [
    qso('W7O', { uuid: 'last', band: '40m', startAtMillis: firstDay + 120_000 }),
    qso('W7B', { uuid: 'b' }),
    qso('W7O', { uuid: 'middle', startAtMillis: firstDay + 60_000 }),
    qso(),
  ]
  assert.deepEqual(progress(rows), progress([...rows].reverse()))
})

test('the seven letters complete independently of the W4S bonus', () => {
  const rows = ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7T'].map((call) => qso(call, { uuid: call }))
  rows.push(qso('W7O', { uuid: 'second-o', band: '40m' }))
  const result = buildProgress(contacts(rows))
  assert.equal(result.MIXED.worked, 7)
  assert.equal(result.MIXED.complete, true)
  assert.equal(result.CW.complete, true)
  assert.equal(result.MIXED.bonus, undefined)
  assert.deepEqual(
    result.MIXED.slots.map((slot) => slot.letter),
    [...'BIGFOOT'],
  )
  assert.equal(new Set(result.MIXED.slots.map((slot) => slot.contact?.uuid)).size, 7)

  const withBonus = progress([...rows, qso('W4S', { uuid: 'bonus' })])
  assert.equal(withBonus.worked, 7)
  assert.equal(withBonus.bonus?.call, 'W4S')
  const bonusOnly = progress([qso('W4S')])
  assert.equal(bonusOnly.worked, 0)
  assert.equal(bonusOnly.complete, false)
  assert.equal(bonusOnly.bonus?.call, 'W4S')
})

test('each mode family keeps its own bonus and target progress', () => {
  const result = buildProgress(
    contacts([
      qso('W7B'),
      qso('W7I', { uuid: 'phone', mode: 'USB' }),
      qso('W7G', { uuid: 'digital', mode: 'FT4' }),
      qso('W4S', { uuid: 'bonus', mode: 'RTTY' }),
    ]),
  )
  assert.equal(result.MIXED.worked, 3)
  assert.equal(result.CW.worked, 1)
  assert.equal(result.PHONE.worked, 1)
  assert.equal(result.DIGITAL.worked, 1)
  assert.equal(result.CW.bonus, undefined)
  assert.equal(result.PHONE.bonus, undefined)
  assert.equal(result.DIGITAL.bonus?.mode, 'RTTY')
})
