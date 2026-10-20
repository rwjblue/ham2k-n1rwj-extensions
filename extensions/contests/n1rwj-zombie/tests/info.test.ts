import { describe, expect, it } from 'vitest'
import {
  type ZombieCandidateInfoInput,
  type ZombieInfoSummary,
  zombieCandidateInfo,
  zombieInfoMarkdown,
} from '../src/info.ts'
import type { Qson } from '../src/model.ts'
import { scoreLog, summaryText, ZombieScorer } from '../src/scorer.ts'

const summary: ZombieInfoSummary = {
  qsos: 3,
  bonusQsos: 1,
  totalScore: 19282,
  bands: [
    { band: '80m', qsos: 0, bonusQsos: 0, numberSum: 0, score: 0 },
    { band: '40m', qsos: 3, bonusQsos: 1, numberSum: 4654, score: 18616 },
    { band: '20m', qsos: 0, bonusQsos: 0, numberSum: 0, score: 0 },
    { band: '10m/15m', qsos: 0, bonusQsos: 0, numberSum: 0, score: 0 },
  ],
}

const candidate: ZombieCandidateInfoInput = {
  call: 'K1ABC',
  band: '40m',
  mode: 'CW',
  exchange: { zombieName: 'Old Nick', zombieNumber: '0007', spc: 'NEW ZEALAND' },
  identitySource: 'copied',
  sessionState: 'active',
  historyKnown: true,
  firstVisit: true,
}

describe('Zombie idle Info', () => {
  it('uses the native scorer totals for idle Info while preserving plain submission text', () => {
    const operation: Qson = {
      refs: [
        {
          type: 'zombie',
          ref: '2026',
          utcOffset: '-04:00',
          ourSpc: 'RI',
          ourZombieNumber: '002',
          ourZombieName: 'COUNT ROB',
        },
      ],
    }
    const rows: Qson[] = ['111', '222', '4321'].map((number, index) => ({
      uuid: String(index),
      band: '40m',
      mode: 'CW',
      startAtMillis: Date.UTC(2026, 9, 30, 19),
      their: { call: ['K1ABC', 'K2ABC', 'K3ABC'][index], sent: '599' },
      refs: [
        { type: 'zombie', theirSpc: 'MA', theirZombieNumber: number, theirZombieName: 'Old Nick' },
      ],
    }))
    const { scoresheet } = scoreLog(operation, rows)
    const tallies = ZombieScorer.summarizeScore(
      { scoresheet, operation, scope: 'operation' },
      { online: false, locale: 'en' },
    )
    expect(tallies.zombie?.total).toBe(19282)
    expect(tallies.zombie?.longSummary).toContain('🪦👻 **Zombie Shuffle 2026**')
    expect(tallies.zombie?.longSummary).toContain(
      '**40m**: 3 QSOs · 1 bonus QSOs · number sum 4654 · **18616 points**',
    )
    expect(summaryText(scoresheet)).toContain(
      '40m: 3 QSOs, 1 bonus QSOs, number sum 4654, score 18616',
    )
    expect(summaryText(scoresheet)).toContain('Total score: 19282')
    expect(summaryText(scoresheet)).not.toContain('🪦')
  })

  it('presents the four authoritative band groups and total without recalculating points', () => {
    const markdown = zombieInfoMarkdown(summary)
    expect(markdown).toContain('**Score 19282** · **3 eligible QSOs**')
    expect(markdown).toContain(
      '**40m**: 3 QSOs · 1 bonus QSOs · number sum 4654 · **18616 points**',
    )
    expect(markdown).toContain('**10m/15m**:')
    expect(markdown).not.toContain('**10m**:')
    expect(markdown).toContain('**4321 bonus QSOs: 1**')
    expect(markdown).toContain('**Crummy Band bonus:** 666 points')
    expect(markdown).toContain('10m and 15m share a score group, with separate rebirth intervals')
    expect(zombieInfoMarkdown({ ...summary, totalScore: 12345 })).toContain('**Score 12345**')
  })

  it('keeps an empty graveyard at zero without implying earned participation points', () => {
    const markdown = zombieInfoMarkdown({
      qsos: 0,
      bonusQsos: 0,
      totalScore: 0,
      bands: summary.bands.map((band) => ({
        ...band,
        qsos: 0,
        bonusQsos: 0,
        numberSum: 0,
        score: 0,
      })),
    })
    expect(markdown).toContain('The graveyard is quiet')
    expect(markdown).toContain('**Score 0**')
    expect(markdown).toContain('**Crummy Band bonus:** 0 points')
    expect(markdown).not.toContain('666 points')
  })
})

describe('Zombie candidate Info', () => {
  it('preserves the copied spooky identity and leading zeros without ordinary-directory guesses', () => {
    const markdown = zombieCandidateInfo(candidate).join('\n\n')
    expect(markdown).toContain('**Copied exchange** · **Old Nick** · #0007 · NEW ZEALAND')
    expect(markdown).toContain('**40m**: **first visit**')
    expect(markdown).not.toContain('bonus exchange')
  })

  it('formats the authoritative resting/ready verdict without judging a different band', () => {
    const resting = zombieCandidateInfo({
      ...candidate,
      rebirth: {
        status: 'RESTING',
        nextAt: Date.UTC(2026, 9, 30, 21, 42),
        remainingMillis: 12 * 60_000,
      },
    }).join('\n')
    expect(resting).toContain('**40m**: **resting** · Rebirth in 12 minutes')
    expect(resting).toContain('eligible at 2026-10-30 21:42 UTC')
    const ready = zombieCandidateInfo({
      ...candidate,
      band: '10m',
      rebirth: { status: 'READY', nextAt: Date.UTC(2026, 9, 30, 21, 42), remainingMillis: 0 },
    }).join('\n')
    expect(ready).toContain('**10m**: **rebirth ready**')
    expect(ready).not.toContain('**15m**')
    expect(ready).toContain('Eligibility does not mean the station is on the air')
    expect(ready).toContain('a complete exchange and all event rules still apply')
  })

  it('makes a near-boundary countdown readable without rounding it to ready', () => {
    expect(
      zombieCandidateInfo({
        ...candidate,
        rebirth: { status: 'RESTING', nextAt: Date.UTC(2026, 9, 30, 21, 42), remainingMillis: 1 },
      }).join('\n'),
    ).toContain('Rebirth in under 1 minute')
  })

  it('labels history as tentative and never declares its bonus assignment current', () => {
    const markdown = zombieCandidateInfo({
      ...candidate,
      identitySource: 'history',
      exchange: { zombieName: 'Last Year', zombieNumber: '4321', spc: 'MA' },
    }).join('\n')
    expect(markdown).toContain('**History hint — confirm on air**')
    expect(markdown).toContain('History is a suggestion, not a complete participant roster')
    expect(markdown).not.toContain('Copied 2026 bonus exchange')
    expect(zombieCandidateInfo({ ...candidate, identitySource: undefined }).join('\n')).toContain(
      '**Exchange to confirm**',
    )
  })

  it('recognizes bonus status only from the copied numeric value and preserves its text', () => {
    expect(
      zombieCandidateInfo({
        ...candidate,
        exchange: { ...candidate.exchange, zombieNumber: '004321' },
      }).join('\n'),
    ).toContain('**Copied 2026 bonus exchange:** 004321')
    expect(
      zombieCandidateInfo({
        ...candidate,
        exchange: { ...candidate.exchange, zombieNumber: '3333' },
      }).join('\n'),
    ).not.toContain('Copied 2026 bonus exchange')
  })

  it('escapes Markdown, HTML, entities and line breaks from identity data', () => {
    const markdown = zombieCandidateInfo({
      ...candidate,
      call: 'K1[ABC](https://example.test)',
      exchange: {
        zombieName: '*Igor* <script> &ast; `boo`\\\n# New heading',
        zombieNumber: '[0007]',
        spc: '>[DX](https://example.test)',
      },
    }).join('\n')
    expect(markdown).toContain('K1\\[ABC\\]\\(https://example\\.test\\)')
    expect(markdown).toContain('\\*Igor\\* &lt;script&gt; &amp;ast; \\`boo\\`\\\\ \\# New heading')
    expect(markdown).toContain('#\\[0007\\]')
    expect(markdown).toContain('&gt;\\[DX\\]\\(https://example\\.test\\)')
    expect(markdown).not.toContain('<script>')
    expect(markdown).not.toContain('\n# New heading')
    expect(markdown).not.toContain('[ABC](https://example.test)')
  })

  it.each([
    ['unconfigured', 'Rebirth status unavailable'],
    ['upcoming', 'Event has not started'],
    ['ended', 'Event window ended'],
  ] as const)('keeps %s sessions from advertising a ready contact', (sessionState, label) => {
    const markdown = zombieCandidateInfo({
      ...candidate,
      sessionState,
      rebirth: { status: 'READY', nextAt: 0, remainingMillis: 0 },
    }).join('\n')
    expect(markdown).toContain(label)
    expect(markdown).not.toContain('**rebirth ready**')
  })

  it('distinguishes unavailable history, an unsupported band, and a non-CW candidate', () => {
    expect(zombieCandidateInfo({ ...candidate, historyKnown: false }).join('\n')).toContain(
      '**rebirth status unknown**',
    )
    expect(zombieCandidateInfo({ ...candidate, firstVisit: undefined }).join('\n')).toContain(
      '**rebirth status unknown**',
    )
    expect(zombieCandidateInfo({ ...candidate, band: '10m/15m' }).join('\n')).toContain(
      '**Choose an event band**',
    )
    expect(zombieCandidateInfo({ ...candidate, mode: 'SSB' }).join('\n')).toContain(
      '**CW required**',
    )
    expect(zombieCandidateInfo({ ...candidate, call: ' ' })).toEqual([])
  })
})
