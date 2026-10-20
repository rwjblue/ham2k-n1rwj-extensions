import type { OperationSegmentPayload } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { buildZombieExperience, refreshZombieExperience } from '../src/experience.ts'
import { object, type Qson, refOf } from '../src/model.ts'
import { REBIRTH_MILLIS, scoreLog, scoreTotal } from '../src/scorer.ts'

const START = Date.UTC(2026, 9, 30, 19)
const MINUTE = 60_000
const END = START + 9 * 60 * MINUTE
const operation: Qson = {
  uuid: 'operation',
  stationCall: 'N1RWJ',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      ourSpc: 'RI',
      ourZombieNumber: '0002',
      ourZombieName: 'OLD NICK',
      utcOffset: '-04:00',
    },
  ],
}
function qso(uuid: string, minutes = 0, overrides: Qson = {}): Qson {
  return {
    uuid,
    startAtMillis: START + minutes * MINUTE,
    band: '40m',
    mode: 'CW',
    their: { call: 'K1ABC', sent: '569' },
    refs: [
      {
        type: 'zombie',
        ref: '2026',
        theirSpc: 'MA',
        theirZombieNumber: '002',
        theirZombieName: 'Dead Fred',
      },
    ],
    ...overrides,
  }
}
function exchangeContact(
  uuid: string,
  call: string,
  number: string,
  band = '40m',
  minutes = 0,
): Qson {
  return qso(uuid, minutes, {
    band,
    their: { call, sent: '599' },
    refs: [
      {
        type: 'zombie',
        ref: '2026',
        theirSpc: 'NEW ZEALAND',
        theirZombieNumber: number,
        theirZombieName: 'OLD NICK',
      },
    ],
  })
}

describe('authoritative Zombie experience', () => {
  it('uses the canonical scoresheet and emits all four score groups even with an empty log', () => {
    const empty = buildZombieExperience(operation, [], START)
    expect(empty).toMatchObject({
      totalScore: 0,
      eligibleContacts: [],
      visitors: [],
      rebirths: [],
      own: { spc: 'RI', zombieNumber: '0002', zombieName: 'OLD NICK' },
    })
    expect(empty.bands).toEqual(
      ['80m', '40m', '20m', '10m/15m'].map((band) => ({
        band,
        qsos: 0,
        bonusQsos: 0,
        numberSum: 0,
        score: 0,
      })),
    )
    const rows = [
      exchangeContact('a', 'K1ABC', '111'),
      exchangeContact('b', 'K2ABC', '222'),
      exchangeContact('c', 'K3ABC', '4321'),
    ]
    const model = buildZombieExperience(operation, rows, START)
    expect(model.scoresheet).toEqual(scoreLog(operation, rows).scoresheet)
    expect(model.totalScore).toBe(scoreTotal(model.scoresheet))
    expect(model.totalScore).toBe(19282)
    expect(model.bands.find((band) => band.band === '40m')).toEqual({
      band: '40m',
      qsos: 3,
      bonusQsos: 1,
      numberSum: 4654,
      score: 18616,
    })
  })

  it('preserves copied spooky identities and leading zeros without directory-name substitution', () => {
    const row = exchangeContact('a', ' k1abc/p ', '0002')
    const their = object(row.their)
    their.name = 'Ordinary Directory Name'
    const model = buildZombieExperience(operation, [row], START)
    expect(model.visitors).toEqual([
      {
        call: 'K1ABC/P',
        spc: 'NEW ZEALAND',
        zombieNumber: '0002',
        zombieName: 'OLD NICK',
        lastAt: START,
        qsos: 1,
        bonusQsos: 0,
        bands: ['40m'],
      },
    ])
    expect(model.eligibleContacts).toEqual([
      {
        uuid: 'a',
        call: 'K1ABC/P',
        band: '40m',
        time: START,
        spc: 'NEW ZEALAND',
        zombieNumber: '0002',
        zombieName: 'OLD NICK',
        rebirth: false,
        bonus: false,
      },
    ])
  })

  it('drops incomplete, invalid, duplicate, deleted and out-of-window rows from cards and cooldowns', () => {
    const rows = [
      qso('good'),
      qso('dupe', 60),
      qso('incomplete', 240, {
        refs: [{ type: 'zombie', theirSpc: 'CT', theirZombieNumber: '12', theirZombieName: '' }],
      }),
      qso('deleted', 300, { deleted: true }),
      qso('event', 350, { band: 'event' }),
      qso('mode', 360, { mode: 'SSB' }),
      qso('band', 370, { band: '30m' }),
      qso('bad-call', 380, { their: { call: '???', sent: '599' } }),
      qso('bad-rst', 390, { their: { call: 'K1ABC', sent: '' } }),
      qso('before', -1),
      qso('after', 540),
    ]
    const model = buildZombieExperience(operation, rows, START + 400 * MINUTE)
    expect(model.eligibleContacts.map((contact) => contact.uuid)).toEqual(['good'])
    expect(model.visitors[0]?.qsos).toBe(1)
    expect(model.rebirths).toEqual([
      expect.objectContaining({
        call: 'K1ABC',
        band: '40m',
        lastAt: START,
        nextAt: START + REBIRTH_MILLIS,
        remainingMillis: 0,
        status: 'READY',
      }),
    ])
  })

  it('moves resting to ready exactly at two hours and anchors the next interval to the last qualifying rebirth', () => {
    const first = qso('first')
    const before = buildZombieExperience(operation, [first], START + REBIRTH_MILLIS - 1)
    expect(before.rebirths[0]).toMatchObject({ status: 'RESTING', remainingMillis: 1 })
    const ready = buildZombieExperience(operation, [first], START + REBIRTH_MILLIS)
    expect(ready.rebirths[0]).toMatchObject({ status: 'READY', remainingMillis: 0 })
    const withRebirth = buildZombieExperience(
      operation,
      [qso('dupe', 180), qso('rebirth', 120), first],
      START + 180 * MINUTE,
    )
    expect(withRebirth.eligibleContacts.map(({ uuid, rebirth }) => ({ uuid, rebirth }))).toEqual([
      { uuid: 'first', rebirth: false },
      { uuid: 'rebirth', rebirth: true },
    ])
    expect(withRebirth.rebirths[0]).toMatchObject({
      lastAt: START + 120 * MINUTE,
      nextAt: START + 240 * MINUTE,
      remainingMillis: 60 * MINUTE,
      status: 'RESTING',
    })
    expect(withRebirth.visitors[0]?.qsos).toBe(2)
  })

  it('groups 10m and 15m points while keeping their actual-band cooldowns independent', () => {
    const model = buildZombieExperience(
      operation,
      [
        exchangeContact('ten', 'K1ABC', '111', '10m'),
        exchangeContact('fifteen', 'K1ABC', '222', '15m', 60),
      ],
      START + 120 * MINUTE,
    )
    expect(model.bands.find((band) => band.band === '10m/15m')).toMatchObject({
      qsos: 2,
      numberSum: 333,
      score: 666,
    })
    expect(model.rebirths).toEqual([
      expect.objectContaining({ band: '10m', status: 'READY', remainingMillis: 0 }),
      expect.objectContaining({ band: '15m', status: 'RESTING', remainingMillis: 60 * MINUTE }),
    ])
    expect(model.visitors[0]).toMatchObject({ qsos: 2, zombieNumber: '222', bands: ['15m', '10m'] })
    expect(model.eligibleContacts.every((contact) => !contact.rebirth)).toBe(true)
  })

  it('keeps portable and base calls separate exactly as the scorer does', () => {
    const model = buildZombieExperience(
      operation,
      [exchangeContact('base', 'K1ABC', '2'), exchangeContact('portable', 'K1ABC/P', '2')],
      START + 30 * MINUTE,
    )
    expect(model.visitors.map((visitor) => visitor.call)).toEqual(['K1ABC', 'K1ABC/P'])
    expect(model.rebirths.map((entry) => entry.call)).toEqual(['K1ABC', 'K1ABC/P'])
  })

  it('matches canonical chronological and UUID tie ordering after backdated insertions', () => {
    const original = [qso('late', 120), qso('later', 240)]
    expect(
      buildZombieExperience(operation, original, START + 300 * MINUTE).eligibleContacts.map(
        (contact) => contact.uuid,
      ),
    ).toEqual(['late', 'later'])
    const inserted = [...original, qso('backdated', 1)]
    const model = buildZombieExperience(operation, inserted, START + 300 * MINUTE)
    expect(model.eligibleContacts.map((contact) => contact.uuid)).toEqual(['backdated', 'later'])
    expect(model.scoresheet).toEqual(scoreLog(operation, inserted).scoresheet)
    const ties = buildZombieExperience(operation, [qso('b'), qso('a')], START)
    expect(ties.eligibleContacts.map((contact) => contact.uuid)).toEqual(['a'])
  })

  it('marks bonus and repeated bonus contacts only when the canonical scorer awards them', () => {
    const rows = [
      exchangeContact('first', 'K1ABC', '04321'),
      exchangeContact('dupe', 'K1ABC', '4321', '40m', 60),
      exchangeContact('rebirth', 'K1ABC', '4321', '40m', 120),
    ]
    const model = buildZombieExperience(operation, rows, START + 130 * MINUTE)
    expect(
      model.eligibleContacts.map(({ uuid, rebirth, bonus }) => ({ uuid, rebirth, bonus })),
    ).toEqual([
      { uuid: 'first', rebirth: false, bonus: true },
      { uuid: 'rebirth', rebirth: true, bonus: true },
    ])
    expect(model.visitors[0]?.bonusQsos).toBe(2)
    expect(model.scoresheet.bonusQsos).toBe(2)
  })

  it('has explicit setup, upcoming, active and ended states and advertises no rebirth at or after midnight', () => {
    expect(buildZombieExperience({}, [], START).sessionState).toBe('unconfigured')
    expect(
      buildZombieExperience(
        { ...operation, refs: [{ ...refOf(operation), utcOffset: '' }] },
        [],
        START,
      ).sessionState,
    ).toBe('unconfigured')
    expect(buildZombieExperience(operation, [], START - 1).sessionState).toBe('upcoming')
    expect(buildZombieExperience(operation, [], START).sessionState).toBe('active')
    const late = [
      qso('one-minute-before', 419),
      exchangeContact('at-midnight', 'K2ABC', '2', '20m', 420),
      exchangeContact('after-midnight', 'K3ABC', '2', '80m', 421),
    ]
    const open = buildZombieExperience(operation, late, END - 1)
    expect(open.rebirths.map((entry) => entry.call)).toEqual(['K1ABC'])
    expect(open.rebirths[0]?.nextAt).toBe(END - MINUTE)
    const ended = buildZombieExperience(operation, late, END)
    expect(ended.sessionState).toBe('ended')
    expect(ended.rebirths).toEqual([])
    expect(ended.visitors).toHaveLength(3)
  })

  it('does not describe a future-dated eligible contact as ready before its cooldown opens', () => {
    const model = buildZombieExperience(operation, [qso('future', 60)], START)
    expect(model.rebirths[0]).toMatchObject({
      status: 'RESTING',
      nextAt: START + 180 * MINUTE,
      remainingMillis: 180 * MINUTE,
    })
  })

  it('respects operation segments for eligibility, current setup and current event window', () => {
    const configuredLater: Qson = {
      ...operation,
      refs: [{ ...refOf(operation), ourZombieName: 'NEW GHOUL', utcOffset: '-05:00' }],
    }
    const segments: OperationSegmentPayload[] = [
      { fromMillis: START, operation: { ...operation, refs: [] } },
      { fromMillis: START + 60 * MINUTE, operation: configuredLater },
    ]
    const rows = [qso('outside-segment'), qso('valid-segment', 60)]
    const model = buildZombieExperience(operation, rows, START + 90 * MINUTE, segments)
    expect(model.eligibleContacts.map((contact) => contact.uuid)).toEqual(['valid-segment'])
    expect(model.scoresheet).toEqual(scoreLog(operation, rows, segments).scoresheet)
    expect(model.own.zombieName).toBe('NEW GHOUL')
    expect(model.session?.endMillis).toBe(END + 60 * MINUTE)
  })

  it('is deterministic and leaves operations, rows and segments unchanged', () => {
    const rows = [qso('later', 120), qso('earlier')]
    const original = JSON.stringify({ operation, rows })
    const first = buildZombieExperience(operation, rows, START + 180 * MINUTE)
    expect(buildZombieExperience(operation, rows, START + 180 * MINUTE)).toEqual(first)
    expect(JSON.stringify({ operation, rows })).toBe(original)
  })

  it('refreshes only the clock-dependent state at rebirth and event boundaries', () => {
    const original = buildZombieExperience(operation, [qso('first')], START - 1)
    const before = refreshZombieExperience(original, START)
    expect(before.sessionState).toBe('active')
    expect(before.rebirths[0]).toMatchObject({ status: 'RESTING', remainingMillis: REBIRTH_MILLIS })
    const resting = refreshZombieExperience(before, START + REBIRTH_MILLIS - 1)
    expect(resting.rebirths[0]).toMatchObject({ status: 'RESTING', remainingMillis: 1 })
    const ready = refreshZombieExperience(resting, START + REBIRTH_MILLIS)
    expect(ready.rebirths[0]).toMatchObject({ status: 'READY', remainingMillis: 0 })
    const ended = refreshZombieExperience(ready, END)
    expect(ended.sessionState).toBe('ended')
    expect(ended.rebirths).toEqual([])
    expect(ended.scoresheet).toBe(original.scoresheet)
    expect(ended.eligibleContacts).toBe(original.eligibleContacts)
    expect(ended.visitors).toBe(original.visitors)
    expect(ended.bands).toBe(original.bands)
    expect(ended.totalScore).toBe(original.totalScore)
    expect(original.sessionState).toBe('upcoming')
    expect(original.rebirths[0]?.remainingMillis).toBe(REBIRTH_MILLIS + 1)
  })

  it('keeps an unconfigured cached model without a rebirth queue', () => {
    const model = buildZombieExperience({}, [], START)
    expect(refreshZombieExperience(model, END)).toMatchObject({
      sessionState: 'unconfigured',
      rebirths: [],
    })
  })
})
