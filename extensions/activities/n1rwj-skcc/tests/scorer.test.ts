import { describe, expect, it } from 'vitest'
import { sessionFor } from '../src/events.ts'
import type { Qson } from '../src/model.ts'

function knownSession(key: string) {
  const session = sessionFor(key)
  if (!session) throw new Error(`Missing event session ${key}`)
  return session
}

import { calculateEventScore, createScoringHook } from '../src/scorer.ts'

function operation(event = 'wes:2026-10', setup: Qson = {}): Qson {
  return {
    refs: [
      {
        type: 'skcc',
        ref: event,
        ourNumber: '42T',
        ourName: 'ME',
        ourSpc: 'MA',
        ourQualified: 'yes',
        ourKey: 'SK',
        ...setup,
      },
    ],
  }
}
function contact(event = 'wes:2026-10', fields: Qson = {}, patch: Qson = {}): Qson {
  return {
    uuid: 'qso',
    startAtMillis: knownSession(event).start,
    band: '20m',
    mode: 'CW',
    our: { sent: '579' },
    their: { call: 'N1ABC', sent: '589' },
    refs: [
      {
        type: 'skcc',
        number: '123S',
        name: 'AL',
        spc: 'MA',
        key: 'SK',
        qualified: 'yes',
        ...fields,
      },
    ],
    ...patch,
  }
}
describe('SKCC event scoring', () => {
  it('counts station per band, SPC and member bonuses only once, without stacking C/T/S tiers', () => {
    const qsos = [
      contact(),
      contact(),
      contact('wes:2026-10', {}, { band: '40m' }),
      contact(
        'wes:2026-10',
        { number: '124C', spc: 'CA' },
        { their: { call: 'W6ABC', sent: '589' } },
      ),
    ]
    expect(
      calculateEventScore(qsos, operation('wes:2026-10', { themeMode: 'none' })),
    ).toMatchObject({ qsos: 3, mults: 2, membershipBonus: 20, base: 26, total: 26, duplicates: 1 })
  })
  it('withholds a final WES score until monthly rules are reviewed', () => {
    expect(calculateEventScore([contact()], operation())).toMatchObject({
      base: 16,
      status: expect.stringContaining('Base estimate'),
    })
    expect(calculateEventScore([contact()], operation())).not.toHaveProperty('total')
    expect(
      calculateEventScore(
        [contact()],
        operation('wes:2026-10', { themeMode: 'additive', themeBonus: 9 }),
      ),
    ).toMatchObject({ total: 25, themeBonus: 9 })
    expect(
      calculateEventScore(
        [contact()],
        operation('wes:2026-10', { themeMode: 'custom', reviewedScore: 400 }),
      ),
    ).toMatchObject({ base: 16, total: 400 })
  })
  it('requires recorded keying evidence and reports rather than trusting a roster suffix', () => {
    const score = calculateEventScore(
      [
        contact('wes:2026-10', { qualified: '', key: '' }),
        contact('wes:2026-10', {}, { their: { call: 'N1ABC' } }),
      ],
      operation(),
    )
    expect(score).toMatchObject({ qsos: 0, pending: 2, membershipBonus: 0 })
  })
  it('accepts an explicit approved key with unknown qualification but preserves negative evidence', () => {
    for (const key of ['SK', 'BUG', 'SS', 'WAIVER']) {
      expect(
        calculateEventScore(
          [contact('wes:2026-10', { qualified: '', key })],
          operation('wes:2026-10', { ourQualified: '', ourKey: key, themeMode: 'none' }),
        ),
      ).toMatchObject({ qsos: 1, pending: 0, total: 16 })
    }
    const rejected: Qson[] = [
      { qualified: false },
      { qualified: 'no' },
      { key: 'OTHER' },
      { key: 'CPU' },
      { key: 'DP' },
    ]
    for (const evidence of rejected) {
      expect(calculateEventScore([contact('wes:2026-10', evidence)], operation())).toMatchObject({
        qsos: 0,
        pending: 1,
      })
    }
    expect(
      calculateEventScore([contact()], operation('wes:2026-10', { ourQualified: false })),
    ).toMatchObject({ qsos: 0, pending: 1 })
  })
  it('counts explicitly reported NONE participants and SKSA birthday bonus once', () => {
    const event = 'sksa:2026-10'
    const contacts = [
      contact(event, { name: 'AL /BD' }),
      contact(event, { name: 'AL /BD' }, { band: '40m' }),
      contact(
        event,
        { number: 'NONE', qualified: '', key: 'OTHER' },
        { their: { call: 'W2ABC', sent: '579' } },
      ),
    ]
    expect(calculateEventScore(contacts, operation(event, { themeMode: 'none' }))).toMatchObject({
      qsos: 3,
      birthdayBonus: 30,
      membershipBonus: 15,
      total: 48,
    })
  })
  it('uses explicit received WPM for SKSE extension and excludes post-event contacts', () => {
    const event = 'skse:2026-10',
      start = knownSession(event).start
    expect(
      calculateEventScore([contact(event, {}, { startAtMillis: start - 60000 })], operation(event)),
    ).toMatchObject({ qsos: 0 })
    expect(
      calculateEventScore(
        [contact(event, { wpm: '12' }, { startAtMillis: start - 60000 })],
        operation(event),
      ),
    ).toMatchObject({ qsos: 1 })
  })
  it('keeps SSS a completed-contact report including WARC, with no contest dupe rule', () => {
    const event = 'sss:2026-10'
    expect(
      calculateEventScore(
        [contact(event, {}, { band: '30m' }), contact(event, {}, { band: '30m' })],
        operation(event),
      ),
    ).toMatchObject({
      qsos: 2,
      total: 2,
      duplicates: 0,
      status: expect.stringContaining('not a contest'),
    })
  })
  it('calculates QSO Party grids once and adds only explicitly declared submission bonus', () => {
    const event = 'qso-party:2026'
    const contacts = [
      contact(event, { grid: 'FN42' }),
      contact(event, { grid: 'FN42' }, { band: '40m' }),
    ]
    expect(calculateEventScore(contacts, operation(event))).toMatchObject({
      qsos: 2,
      gridBonus: 5,
      base: 22,
      total: 22,
    })
    expect(calculateEventScore(contacts, operation(event, { photoSoapbox: true }))).toMatchObject({
      total: 122,
    })
  })
  it('withholds SKS bonus assumptions and suppresses this extension’s spot verdicts', async () => {
    const event = 'sks:2026-10'
    expect(
      calculateEventScore([contact(event)], operation(event, { themeMode: 'none' })),
    ).not.toHaveProperty('total')
    expect(
      calculateEventScore(
        [contact(event)],
        operation(event, { themeMode: 'none', bonusCall: 'N1ABC' }),
      ),
    ).toMatchObject({ specialBonus: 25, total: 41 })
    expect(
      await createScoringHook().scoreCandidates?.(
        { operation: operation(event), candidates: [] },
        { online: false },
      ),
    ).toEqual({})
  })
  it('keeps duplicate, multiplier and bonus state separate across effective event segments', async () => {
    const wes = operation('wes:2026-10', { themeMode: 'none' })
    const sks = operation('sks:2026-10', { themeMode: 'none', bonusCall: 'W1BONUS' })
    const result = await createScoringHook().scoreQsos(
      {
        operation: sks,
        qsos: [
          contact('wes:2026-10', {}, { uuid: 'wes' }),
          contact('sks:2026-10', {}, { uuid: 'sks' }),
        ],
        segments: [
          { fromMillis: knownSession('wes:2026-10').start, operation: wes },
          { fromMillis: knownSession('sks:2026-10').start, operation: sks },
        ],
      },
      { online: false },
    )
    expect(result.qsoScores.wes).toMatchObject({ value: 1, dupe: false })
    expect(result.qsoScores.sks).toMatchObject({ value: 1, dupe: false })
    expect(Object.values(result.operationSummary).map((tally) => tally.total)).toEqual([16, 16])
  })
  it('does not impose an unstated HF restriction on Canadian Straight Key Month', () => {
    const event = 'cskm:2026'
    expect(
      calculateEventScore(
        [contact(event, { name: 'AL/CSKM', spc: 'ON' }, { band: '2m' })],
        operation(event),
      ),
    ).toMatchObject({ qsos: 1, total: 1 })
  })
})
