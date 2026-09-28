// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The contest through its `scoring` HOOK — one call over a log, the way the
// app scores an operation — rather than by folding a scoresheet QSO by QSO the
// way scorer.test.ts does. That file pins the rules in isolation; this one
// pins what the operator is shown once they are applied together, and it fails
// if the hook stops being registered at all (the SDK harness in sdkGapTesting.ts).

import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'

import { fixtureOperation, loadExtension } from './support.ts'

afterEach(() => vi.useRealTimers())

const cqww = await loadExtension(() => import('../src/index.ts'))

const ref = { type: 'cqww', mode: 'SSB' }
/// A US station: "our continent" is NA and "our country" K, which is what the
/// per-QSO points below are relative to.
const operation = fixtureOperation({ stationCall: 'N0DEV', refs: [ref] })

const qso = (call: string, band = '20m') => ({
  uuid: `${call}-${band}`,
  startAtMillis: Date.UTC(2026, 0, 1, 12, 0, 0),
  band,
  mode: 'SSB',
  their: { call },
})

test("points follow the worked station's distance, and every one is a zone and a country", async () => {
  // CQWW pays 3 points across continents, 0 inside your own country — and a
  // contact that scores nothing can still bring multipliers, which is the part
  // a scorer that returned early on zero points would silently lose.
  const result = (await cqww.runHook('scoring', 'scoreQsos', {
    operation,
    ref,
    qsos: [qso('DL1ABC'), qso('JA1XYZ'), qso('W1AW')],
  })) as {
    qsoScores: Record<string, { value: number }>
    operationSummary: Record<
      string,
      { total: number; points: number; mults: number; label?: string; longSummary?: string }
    >
  }

  assert.equal(result.qsoScores['DL1ABC-20m'].value, 3, 'Germany, another continent')
  assert.equal(result.qsoScores['JA1XYZ-20m'].value, 3, 'Japan, another continent')
  assert.equal(result.qsoScores['W1AW-20m'].value, 0, 'same country')

  const summary = result.operationSummary.cqww
  assert.equal(summary.points, 6)
  assert.equal(summary.mults, 6, 'three zones and three countries, all new on 20m')
  assert.equal(summary.total, 36, 'points × mults is the score the operator reads')
  assert.equal(summary.label, 'CQWW SSB: 36 points')
  // Zones and countries are different things to chase; the split says which
  // the log is short of.
  assert.equal(
    summary.longSummary?.split('\n')[0],
    '3 QSOs, 6 pts × 6 mults (3 zones, 3 countries)',
  )
})

test('the same country on a second band is a fresh multiplier', async () => {
  // Multipliers are per band in CQWW; counting them once for the operation
  // would under-report every multi-band log.
  const result = (await cqww.runHook('scoring', 'scoreQsos', {
    operation,
    ref,
    qsos: [qso('DL1ABC', '20m'), qso('DL1ABC', '40m')],
  })) as { operationSummary: Record<string, { mults: number }> }

  assert.equal(result.operationSummary.cqww.mults, 4, 'zone and country, on each of two bands')
})

test('the activity search offers all three runnings, the nearest first, labelled as the operation will show them', async () => {
  // Mid October: SSB is days away, CW a month, RTTY eleven months. Ranking by
  // a fixed order instead of the calendar would lead with RTTY all year.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 9, 15))
  const suggestions = (await cqww.runHook('activity', 'suggest', { searchTerm: 'cq' })) as {
    mode: string
    label: string
    shortLabel: string
    relevance: number
  }[]

  const ranked = [...suggestions].sort((a, b) => b.relevance - a.relevance).map((s) => s.mode)
  assert.deepEqual(ranked, ['SSB', 'CW', 'RTTY'])

  // A suggestion is saved verbatim; a label that differs from decorateRef's
  // would change the moment the operation is edited.
  const ssb = suggestions.find((s) => s.mode === 'SSB')
  assert.ok(ssb)
  const decorated = (await cqww.runHook('ref:cqww', 'decorateRef', {
    ref: { type: 'cqww', mode: 'SSB' },
  })) as { label: string; shortLabel: string }
  assert.equal(ssb.label, decorated.label)
  assert.equal(ssb.shortLabel, decorated.shortLabel)
})

test('an operation already running CQ WW is offered nothing', async () => {
  // A suggestion has no `ref` for the picker's duplicate guard to match, so
  // tapping one would replace the configured ref and lose its zone.
  const configured = fixtureOperation({
    stationCall: 'N0DEV',
    refs: [{ type: 'cqww', mode: 'CW', zone: '5' }],
  })
  assert.deepEqual(
    await cqww.runHook('activity', 'suggest', { operation: configured, searchTerm: 'cq' }),
    [],
  )
})

test('the activity search stays out of unrelated searches', async () => {
  assert.deepEqual(await cqww.runHook('activity', 'suggest', { searchTerm: 'pota' }), [])
})
