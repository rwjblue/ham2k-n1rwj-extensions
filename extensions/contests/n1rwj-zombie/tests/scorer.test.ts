import type { HookContext } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import type { Qson } from '../src/model.ts'
import {
  createScoringHook,
  REBIRTH_MILLIS,
  scoreLog,
  scoreTotal,
  summaryText,
  type ZombieScoresheet,
} from '../src/scorer.ts'

const START = Date.UTC(2026, 9, 30, 19)
const context: HookContext = { online: false, locale: 'en', appName: 'Ham2K Logger' }
const operation: Qson = {
  uuid: 'zombie-operation',
  stationCall: 'N1RWJ',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      ourSpc: 'RI',
      ourZombieNumber: '1027',
      ourZombieName: 'Ghoul',
      utcOffset: '-04:00',
      flexibleHours: false,
    },
  ],
}
const qso = (uuid: string, minutes = 0, overrides: Qson = {}): Qson => ({
  uuid,
  startAtMillis: START + minutes * 60_000,
  band: '40m',
  mode: 'CW',
  their: { call: 'K1ABC', sent: '569' },
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      theirSpc: 'MA',
      theirZombieNumber: '111',
      theirZombieName: 'Igor',
    },
  ],
  ...overrides,
})
const numbered = (uuid: string, call: string, number: string, band = '40m') =>
  qso(uuid, 0, {
    band,
    their: { call, sent: '599' },
    refs: [
      {
        type: 'zombie',
        ref: '2026',
        theirSpc: 'MA',
        theirZombieNumber: number,
        theirZombieName: 'Igor',
      },
    ],
  })

describe('Zombie scoring and rebirth', () => {
  it('matches the official formula, including 4321 in both QSO and number totals', () => {
    const { scoresheet } = scoreLog(operation, [
      numbered('a', 'K1ABC', '111'),
      numbered('b', 'K2ABC', '222'),
      numbered('c', 'K3ABC', '4321'),
    ])
    expect(scoresheet.bands['40m']).toEqual({ qsos: 3, bonusQsos: 1, numberSum: 4654 })
    expect(scoreTotal(scoresheet)).toBe(19_282)
    expect(summaryText(scoresheet)).toContain(
      '40m: 3 QSOs, 1 bonus QSOs, number sum 4654, score 18616',
    )
    expect(summaryText(scoresheet)).toContain('Total score: 19282')
    expect(
      scoreTotal(
        scoreLog(operation, [numbered('a', 'K1ABC', '111'), numbered('b', 'K2ABC', '222')])
          .scoresheet,
      ),
    ).toBe(1332)
    expect(scoreTotal(scoreLog(operation, []).scoresheet)).toBe(0)
  })

  it('combines 10/15m scoring but keeps their dupe histories separate', () => {
    const { scoresheet, qsoScores } = scoreLog(operation, [
      numbered('a', 'K1ABC', '111', '10m'),
      numbered('b', 'K1ABC', '222', '15m'),
      numbered('c', 'K1ABC', '333', '10m'),
    ])
    expect(scoresheet.bands['10m/15m']).toEqual({ qsos: 2, bonusQsos: 0, numberSum: 333 })
    expect(qsoScores.b.dupe).toBe(false)
    expect(qsoScores.c.dupe).toBe(true)
    expect(scoreTotal(scoresheet)).toBe(1332)
  })

  it('allows exactly two elapsed hours after the last eligible contact', () => {
    const { scoresheet, qsoScores } = scoreLog(
      operation,
      [
        qso('first'),
        qso('early', 119.999),
        qso('rebirth', 120),
        qso('still-early', 239.999),
        qso('second-rebirth', 240),
      ].reverse(),
    )
    expect(scoresheet.qsos).toBe(3)
    expect(qsoScores.early.dupe).toBe(true)
    expect(qsoScores.rebirth.dupe).toBe(false)
    expect(qsoScores['still-early'].dupe).toBe(true)
    expect(qsoScores['second-rebirth'].dupe).toBe(false)
  })

  it('counts qualifying bonus rebirth contacts using the documented assumption', () => {
    const bonus = numbered('a', 'K1ABC', '4321')
    const { scoresheet } = scoreLog(operation, [
      bonus,
      { ...bonus, uuid: 'b', startAtMillis: START + REBIRTH_MILLIS },
    ])
    expect(scoresheet.bands['40m']).toEqual({ qsos: 2, bonusQsos: 2, numberSum: 8642 })
    expect(scoreTotal(scoresheet)).toBe(35_234)
  })

  it('excludes invalid and incomplete contacts without consuming a dupe interval', () => {
    const incomplete = qso('incomplete', 60, {
      refs: [{ type: 'zombie', theirSpc: 'MA', theirZombieNumber: '', theirZombieName: 'Igor' }],
    })
    const invalid = [
      qso('deleted', 0, { deleted: true }),
      qso('event', 0, { band: 'event' }),
      qso('mode', 0, { mode: 'SSB' }),
      qso('band', 0, { band: '30m' }),
      qso('before', -1),
      qso('after', 540),
      qso('no-time', 0, { startAtMillis: null }),
      qso('bad-call', 0, { their: { call: '?', sent: '599' } }),
      qso('rst', 0, { their: { call: 'K1ABC', sent: '' } }),
      incomplete,
      qso('good', 60),
    ]
    const { scoresheet, qsoScores } = scoreLog(operation, invalid)
    expect(scoresheet.qsos).toBe(1)
    expect(qsoScores.good.dupe).toBe(false)
    expect(qsoScores.incomplete.alerts).toContain('missingExchange')
    expect(qsoScores.rst.alerts).toContain('missingExchange')
    expect(
      scoreTotal(scoreLog(operation, [qso('first'), incomplete, qso('rebirth', 120)]).scoresheet),
    ).toBe(1110)
  })

  it('requires setup and respects a half-open operating window', () => {
    const noOffset = { ...operation, refs: [{ type: 'zombie', ref: '2026' }] }
    expect(scoreTotal(scoreLog(noOffset, [qso('a')]).scoresheet)).toBe(0)
    expect(scoreLog(noOffset, [qso('a')]).qsoScores.a.alerts).toContain(
      'Configure the event and event-day UTC offset',
    )
    expect(scoreLog(operation, [qso('end', 540)]).qsoScores.end.alerts).toContain(
      'Outside selected event hours',
    )
    const flexible: Qson = {
      ...operation,
      refs: [{ ...(operation.refs as Qson[])[0], flexibleHours: true }],
    }
    expect(scoreLog(flexible, [qso('early', -60)]).scoresheet.qsos).toBe(1)
  })

  it('resolves equal timestamps deterministically by UUID', () => {
    const a = numbered('a', 'K1ABC', '111')
    const z = numbered('z', 'K1ABC', '999')
    expect(scoreLog(operation, [z, a])).toEqual(scoreLog(operation, [a, z]))
    expect(scoreLog(operation, [z, a]).scoresheet.numberSum).toBe(111)
  })
})

describe('SDK scoring hooks', () => {
  it('keeps native summaries and checkpoints equivalent to a full chronological fold', async () => {
    const hook = createScoringHook()
    const first = await hook.scoreQsos(
      { operation, qsos: [qso('a')], checkpointKey: 'first' },
      context,
    )
    expect(first.checkpointHeld).toBe(true)
    const resumed = await hook.scoreQsos(
      {
        operation,
        qsos: [qso('b', 120)],
        resumeKey: 'first',
        resumeDay: first.scoresheetDay,
      },
      context,
    )
    const full = await createScoringHook().scoreQsos(
      { operation, qsos: [qso('b', 120), qso('a')] },
      context,
    )
    expect(resumed.scoresheet).toEqual(full.scoresheet)
    expect(resumed.operationSummary).toEqual(full.operationSummary)
    expect(Object.keys(resumed.qsoScores)).toEqual(['b'])
    expect(scoreTotal(resumed.scoresheet as ZombieScoresheet)).toBe(1110)
  })

  it('does not mutate a held checkpoint or read the full log for live candidates', async () => {
    const hook = createScoringHook()
    await hook.scoreQsos({ operation, qsos: [qso('a')], checkpointKey: 'held' }, context)
    const getQsos = vi.fn(async () => {
      throw new Error('Checkpoint should avoid reading the log')
    })
    const ctx = { ...context, getQsos }
    const atRebirth = await hook.scoreQso(
      { operation, qso: qso('draft', 120), resumeKey: 'held' },
      ctx,
    )
    expect(atRebirth.dupe).toBe(false)
    const candidates = await hook.scoreCandidates(
      {
        operation,
        resumeKey: 'held',
        candidates: [
          { key: 'one', qso: qso('one', 120) },
          { key: 'two', qso: qso('two', 120) },
        ],
      },
      ctx,
    )
    expect(candidates.one.dupe).toBe(false)
    expect(candidates.two.dupe).toBe(false)
    expect(
      (await hook.scoreQso({ operation, qso: qso('early', 30), resumeKey: 'held' }, ctx)).dupe,
    ).toBe(true)
    expect(getQsos).not.toHaveBeenCalled()
  })

  it('honors excludeUuid and judges backdated candidates against their prior history', async () => {
    const hook = createScoringHook()
    const log = [qso('future', 240), qso('own', 120), qso('first')]
    const ctx = { ...context, getQsos: vi.fn(async () => log) }
    expect(
      (await hook.scoreQso({ operation, qso: qso('own', 120), excludeUuid: 'own' }, ctx)).dupe,
    ).toBe(false)
    expect((await hook.scoreQso({ operation, qso: qso('draft', 30) }, ctx)).dupe).toBe(true)
    expect((await hook.scoreQso({ operation, qso: qso('draft', -1) }, ctx)).alerts).toContain(
      'Outside selected event hours',
    )
  })
})
