import assert from 'node:assert/strict'
import { test } from 'vitest'
import { EVENT_2026, type Qson, qualifyingContacts } from '../src/rules.ts'
import { BIGFOOT_TARGETS, targetForCall, targetStatus } from '../src/targets.ts'

const at = Date.UTC(2026, 9, 19, 12)

function qso(call = 'W7O', overrides: Qson = {}): Qson {
  return {
    uuid: 'candidate',
    their: { call },
    band: '20m',
    mode: 'CW',
    startAtMillis: at,
    ...overrides,
  }
}

function status(history: Qson[] = [], candidate = qso()) {
  const result = targetStatus(EVENT_2026, qualifyingContacts(history, EVENT_2026), candidate)
  assert.ok(result)
  return result
}

test('published target annotations normalize only the full exact callsign', () => {
  assert.equal(BIGFOOT_TARGETS.length, 7)
  assert.equal(targetForCall(' w7b ')?.letter, 'B')
  assert.equal(targetForCall('W7O')?.letter, 'O')
  assert.match(targetForCall('W7O')?.label ?? '', /two contacts/)
  assert.equal(targetForCall('W4S')?.bonus, true)
  assert.equal(targetForCall('W4S')?.letter, undefined)
  for (const call of ['W3S', 'W7B/P', 'W7B/K1', 'W7', 'N1RWJ', '', null, 7])
    assert.equal(targetForCall(call), undefined)
  assert.equal(targetStatus(EVENT_2026, [], qso('W3S')), undefined)
})

test('first target contact identifies independently needed mixed and CW credit', () => {
  const result = status([], qso('w7b'))
  assert.equal(result.eligibility, 'eligible')
  assert.equal(result.target.call, 'W7B')
  assert.equal(result.mixed.needed, true)
  assert.equal(result.cw.needed, true)
  assert.equal(result.mixed.wouldAdvance, true)
  assert.equal(result.cw.wouldAdvance, true)
  assert.equal(result.mode?.mode, 'CW')
  assert.ok(result.mode)
  assert.equal(result.mode.wouldAdvance, true)
})

test('W7O starts with two remaining letters but one candidate fills only the first O', () => {
  const result = status()
  assert.equal(result.mixed.remaining, 2)
  assert.equal(result.mixed.next, 'first-o')
  assert.equal(result.mixed.wouldAdvance, true)
  assert.equal(result.cw.next, 'first-o')
  assert.match(result.mixed.message, /First O needed/)
})

test('same call, band, canonical mode and UTC date cannot fill the second O', () => {
  const result = status([qso('W7O', { uuid: 'first', startAtMillis: at - 60_000 })])
  assert.equal(result.mixed.remaining, 1)
  assert.equal(result.mixed.next, 'second-o')
  assert.equal(result.mixed.repeat, true)
  assert.equal(result.mixed.wouldAdvance, false)
  assert.equal(result.cw.wouldAdvance, false)
  assert.match(result.cw.message, /another band or UTC date/)
  assert.match(result.mixed.message, /another band, mode, or UTC date/)
})

test('another band or UTC day fills second O in mixed and CW', () => {
  const changes: Qson[] = [{ band: '40m' }, { startAtMillis: at + 86_400_000 }]
  for (const change of changes) {
    const result = status([qso('W7O', { uuid: 'first' })], qso('W7O', change))
    assert.equal(result.mixed.next, 'second-o')
    assert.equal(result.mixed.wouldAdvance, true)
    assert.equal(result.cw.wouldAdvance, true)
    assert.equal(result.mixed.repeat, false)
  }
})

test('another mode fills mixed second O while explaining the remaining CW need', () => {
  const result = status([qso('W7O', { uuid: 'first' })], qso('W7O', { mode: 'USB' }))
  assert.equal(result.mixed.wouldAdvance, true)
  assert.equal(result.cw.needed, true)
  assert.equal(result.cw.wouldAdvance, false)
  assert.match(result.cw.message, /Second O still needed on CW/)
  assert.equal(result.mode?.mode, 'SSB')
  assert.ok(result.mode)
  assert.equal(result.mode.next, 'first-o')
  assert.equal(result.mode.wouldAdvance, true)
})

test('mixed O completion does not hide an independently needed CW pair', () => {
  const history = [
    qso('W7O', { uuid: 'phone-first', mode: 'SSB' }),
    qso('W7O', { uuid: 'phone-second', mode: 'SSB', band: '40m' }),
  ]
  const first = status(history)
  assert.equal(first.mixed.needed, false)
  assert.equal(first.mixed.wouldAdvance, false)
  assert.equal(first.cw.remaining, 2)
  assert.equal(first.cw.next, 'first-o')
  assert.equal(first.cw.wouldAdvance, true)
  const second = status([...history, qso('W7O', { uuid: 'cw-first' })], qso('W7O', { band: '40m' }))
  assert.equal(second.cw.next, 'second-o')
  assert.equal(second.cw.wouldAdvance, true)
})

test('mixed and CW select qualifying O contacts independently of input order', () => {
  const history = [
    qso('W7O', { uuid: 'ssb', mode: 'SSB', startAtMillis: at - 120_000 }),
    qso('W7O', { uuid: 'cw', startAtMillis: at - 60_000 }),
  ]
  const result = status(history, qso('W7O', { band: '40m' }))
  assert.equal(result.mixed.needed, false)
  assert.equal(result.cw.wouldAdvance, true)
  assert.deepEqual(result, status([...history].reverse(), qso('W7O', { band: '40m' })))
})

test('SSB sideband and RTTY variants do not manufacture a different mode', () => {
  const variants: [string, string][] = [
    ['USB', 'LSB'],
    ['RTTY', 'RTTY-R'],
  ]
  for (const [previous, current] of variants) {
    const result = status(
      [qso('W7O', { uuid: 'first', mode: previous })],
      qso('W7O', { mode: current }),
    )
    assert.equal(result.mixed.repeat, true)
    assert.equal(result.mixed.wouldAdvance, false)
    assert.equal(result.mode?.wouldAdvance, false)
  }
})

test('actual FT8 and RTTY modes can differ for the mixed pair and their mode progress stays separate', () => {
  const result = status([qso('W7O', { uuid: 'first', mode: 'FT8' })], qso('W7O', { mode: 'RTTY' }))
  assert.equal(result.mixed.wouldAdvance, true)
  assert.equal(result.cw.wouldAdvance, false)
  assert.equal(result.mode?.mode, 'RTTY')
  assert.equal(result.mode?.next, 'first-o')
  assert.equal(result.mode?.wouldAdvance, true)
})

test('per-mode second O guidance keeps the same mode while mixed permits a mode change', () => {
  for (const mode of ['FT8', 'SSB']) {
    const result = status([qso('W7O', { uuid: 'first', mode })], qso('W7O', { mode }))
    assert.match(result.mode?.message ?? '', /use another band or UTC date/)
    assert.doesNotMatch(result.mode?.message ?? '', /band, mode/)
    assert.match(result.mixed.message, /use another band, mode, or UTC date/)
    assert.equal(result.mode?.wouldAdvance, false)
  }
})

test('a new mode can advance per-mode credit after mixed letters are already worked', () => {
  const result = status([qso('W7B', { uuid: 'cw' })], qso('W7B', { mode: 'FT8' }))
  assert.equal(result.mixed.needed, false)
  assert.equal(result.cw.needed, false)
  assert.equal(result.mode?.needed, true)
  assert.equal(result.mode?.wouldAdvance, true)
})

test('the same record UUID cannot be used to claim a second O', () => {
  const result = status([qso('W7O', { uuid: 'candidate' })], qso('W7O', { band: '40m' }))
  assert.equal(result.mixed.remaining, 1)
  assert.equal(result.mixed.wouldAdvance, false)
  assert.equal(result.cw.wouldAdvance, false)
})

test('Skunk Ape annotations and needed status remain separate from letters', () => {
  const first = status([], qso('W4S'))
  assert.equal(first.target.bonus, true)
  assert.equal(first.mixed.next, 'bonus')
  assert.equal(first.mixed.wouldAdvance, true)
  const worked = status([qso('W4S', { uuid: 'first', mode: 'SSB' })], qso('W4S'))
  assert.equal(worked.mixed.needed, false)
  assert.equal(worked.cw.wouldAdvance, true)
})

test('missing band, mode or time never claims that a candidate qualifies', () => {
  const candidates = [qso('W7O', { band: '' }), qso('W7O', { mode: '' }), qso()]
  delete candidates[2].startAtMillis
  for (const candidate of candidates) {
    const result = status([qso('W7O', { uuid: 'first' })], candidate)
    assert.equal(result.eligibility, 'unknown-context')
    assert.equal(result.mixed.needed, true)
    assert.equal(result.mixed.wouldAdvance, false)
    assert.equal(result.cw.wouldAdvance, false)
    assert.match(result.messages.join(' '), /cannot be established yet/)
    assert.doesNotMatch(result.messages.join(' '), /would fill/)
  }
})

test('unsupported bands and modes retain identity without claiming credit', () => {
  for (const [patch, eligibility] of [
    [{ band: '6m' }, 'unsupported-band'],
    [{ mode: 'DATA' }, 'unsupported-mode'],
  ] as const) {
    const result = status([], qso('W7B', patch))
    assert.equal(result.eligibility, eligibility)
    assert.equal(result.label, 'BIGFOOT 2026: B')
    assert.equal(result.mixed.wouldAdvance, false)
    assert.equal(result.cw.wouldAdvance, false)
    assert.match(result.messages[0], /no BIGFOOT credit/)
  }
})

test('event time boundaries warn outside and never award historical or future contacts', () => {
  for (const startAtMillis of [
    EVENT_2026.startAtMillis - 1,
    EVENT_2026.endAtMillis,
    Date.UTC(2027, 9, 20),
  ]) {
    const result = status([], qso('W7B', { startAtMillis }))
    assert.equal(result.eligibility, 'outside-event')
    assert.equal(result.mixed.wouldAdvance, false)
    assert.match(result.messages[0], /Outside the confirmed 2026 event window/)
  }
  for (const startAtMillis of [EVENT_2026.startAtMillis, EVENT_2026.endAtMillis - 1])
    assert.equal(status([], qso('W7B', { startAtMillis })).mixed.wouldAdvance, true)
})

test('static target identity is useful without an operation or confirmed edition', () => {
  for (const event of [undefined, { ...EVENT_2026, year: 2027 }]) {
    const result = targetStatus(event, [], qso('W7B'))
    assert.ok(result)
    assert.equal(result.label, 'BIGFOOT 2026: B')
    assert.equal(result.eligibility, 'unavailable-event')
    assert.equal(result.mixed.wouldAdvance, false)
    assert.equal(result.cw.wouldAdvance, false)
    assert.equal(result.messages.length, 1)
    assert.match(result.messages[0], /Published BIGFOOT 2026 target/)
    assert.doesNotMatch(result.messages[0], /active|would fill/)
  }
})

test('ISO UTC offsets are assessed by UTC date and an invalid explicit numeric time is not repaired', () => {
  const candidate = qso('W7O', { startAt: '2026-10-19T20:01:00-04:00' })
  delete candidate.startAtMillis
  const result = status(
    [qso('W7O', { uuid: 'first', startAtMillis: Date.UTC(2026, 9, 19, 23, 59) })],
    candidate,
  )
  assert.equal(result.mixed.wouldAdvance, true)
  const invalid = status([], { ...candidate, startAtMillis: null })
  assert.equal(invalid.eligibility, 'unknown-context')
  assert.equal(invalid.mixed.wouldAdvance, false)
})

test('deleted records and event markers receive no credit', () => {
  const patches: Qson[] = [{ deleted: true }, { event: { event: 'start' } }]
  for (const patch of patches) {
    const result = status([], qso('W7B', patch))
    assert.equal(result.eligibility, 'excluded-record')
    assert.equal(result.mixed.wouldAdvance, false)
  }
})
