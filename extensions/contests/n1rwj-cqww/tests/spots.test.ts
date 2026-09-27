// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict'
import type { JSONValue, ScoreCandidatesResult, ScoreQsosResult } from '@ham2k/extension-sdk'
import { contestScorer } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { CQWWScorer } from '../src/scorer.ts'
import { loadExtension } from './support.ts'

const cqww = await loadExtension(() => import('../src/index.ts'))
type Qson = Record<string, JSONValue>
const ref = { type: 'cqww', mode: 'RTTY', zone: '5', qth: 'MA' }
const operation = { uuid: 'spots', stationCall: 'N1RWJ', refs: [ref] }

// The host's spotCandidateQso supplies these fields, without a received exchange.
function spot(call: string, band = '20m', mode = 'RTTY'): Qson {
  return { their: { call }, band, mode, refs: [], startAtMillis: Date.UTC(2026, 8, 27, 12) }
}
function logged(call: string, zone: string, qth: string, band = '20m'): Qson {
  return {
    ...spot(call, band),
    uuid: `${call}-${band}`,
    startAtMillis: Date.UTC(2026, 8, 26, 12),
    refs: [{ type: 'cqww', theirZone: zone, theirQth: qth }],
  }
}
async function score(qsos: Qson[], extra = {}): Promise<ScoreQsosResult> {
  return (await cqww.runHook('scoring', 'scoreQsos', {
    operation,
    ref,
    qsos,
    ...extra,
  })) as ScoreQsosResult
}
async function candidates(qsos: Qson[], checkpoint: ScoreQsosResult, extra = {}) {
  return (await cqww.runHook('scoring', 'scoreCandidates', {
    operation,
    ref,
    resumeFrom: checkpoint.scoresheet,
    resumeDay: checkpoint.scoresheetDay,
    candidates: qsos.map((qso, index) => ({ key: String(index), qso })),
    ...extra,
  })) as ScoreCandidatesResult
}

test('bare RTTY spots identify new countries and zones independently of exchange completeness', async () => {
  const checkpoint = await score([logged('DL1ABC', '14', 'DX'), logged('W1AW', '5', 'CT')])
  const result = await candidates(
    [
      spot('G3ABC'), // New country, already-worked zone 14.
      spot('W6ABC'), // New zone 3, already-worked country K; no state guess.
      spot('DL2ABC'), // Both multipliers already worked.
      spot('W2ABC'), // No basis for claiming an unknown state multiplier.
      spot('JA1ABC'),
      spot('JA1ABC'), // Candidates must not consume each other's multipliers.
      spot('W1AW', '20m', 'RTTY-USB'),
      spot('DL1ABC', '40m'),
    ],
    checkpoint,
  )
  for (const key of ['0', '1', '4', '5', '7']) assert.ok(result[key].notices.includes('newMult'))
  for (const key of ['2', '3', '6']) assert.ok(!result[key].notices.includes('newMult'))
  assert.equal(result['0'].dupe, false)
  assert.deepEqual(result['4'], result['5'])
  assert.deepEqual(result['6'].alerts, ['duplicate'])
  assert.equal(result['6'].dupe, true)
  assert.ok(result['7'].notices.includes('newBand'))
  assert.deepEqual(
    checkpoint,
    await score([logged('DL1ABC', '14', 'DX'), logged('W1AW', '5', 'CT')]),
  )
})

test('spot notices respect mode and band eligibility including a single-band entry', async () => {
  const checkpoint = await score([])
  const result = await candidates(
    [
      spot('JA1ABC', '160m'),
      spot('JA1ABC', '30m'),
      spot('JA1ABC', '20m', 'FT8'),
      spot('JA1ABC', '40m'),
      spot('JA1ABC', '20m', 'RTTY-LSB'),
    ],
    checkpoint,
    { ref: { ...ref, categoryBand: '20' } },
  )
  for (const key of ['0', '1', '3']) assert.deepEqual(result[key].alerts, ['invalidBand'])
  assert.deepEqual(result['2'].alerts, ['invalidMode'])
  for (const key of ['0', '1', '2', '3']) assert.deepEqual(result[key].notices, [])
  assert.ok(result['4'].notices.includes('newMult'))
})

test('a copied QTH on another band identifies a state-only multiplier without overriding corrections', async () => {
  const checkpoint = await score([logged('W1AW', '5', 'CT', '40m'), logged('W2ABC', '5', 'MA')])
  const corrected = (qth: string) => ({
    ...spot('W1AW'),
    refs: [{ type: 'cqww', theirZone: '5', theirQth: qth }],
  })
  const result = await candidates(
    [spot('W1AW'), corrected('MA'), corrected(''), spot('W1AW', '40m')],
    checkpoint,
  )
  assert.ok(result['0'].notices.includes('newMult'))
  assert.ok(!result['1'].notices.includes('newMult'))
  assert.ok(!result['2'].notices.includes('newMult'))
  assert.deepEqual(result['3'].alerts, ['duplicate'])
})

test('lookup QTH hints are tentative, normalized and never inferred from a call digit', async () => {
  const checkpoint = await score([logged('VE3XYZ', '4', 'ON'), logged('W1AW', '5', 'CT')])
  const withGuess = (call: string, guess: Qson): Qson => ({ ...spot(call), their: { call, guess } })
  const result = await candidates(
    [
      withGuess('VE3ABC', { state: 'nt' }),
      withGuess('VE3ABC', { state: 'NL' }),
      withGuess('W2ABC', { state: 'MA' }),
      withGuess('W2ABC', { state: 'ON' }),
      spot('W2ABC'),
    ],
    checkpoint,
  )
  for (const key of ['0', '2']) assert.ok(result[key].notices.includes('newMult'))
  for (const key of ['1', '3', '4']) assert.ok(!result[key].notices.includes('newMult'))
})

test('explicit zone corrections and clearing override hints; maritime calls do not imply a location', async () => {
  const checkpoint = await score([logged('DL1ABC', '14', 'DX')])
  const result = await candidates(
    [
      { ...spot('DL2ABC'), refs: [{ type: 'cqww', theirZone: '16' }] },
      {
        ...spot('DL2ABC'),
        refs: [{ type: 'cqww', theirZone: '' }],
        their: { call: 'DL2ABC', guess: { cqZone: 16 } },
      },
      spot('W1AW/MM'),
      { ...spot('W1AW/MM'), refs: [{ type: 'cqww', theirZone: '8' }] },
      spot('???'),
    ],
    checkpoint,
  )
  for (const key of ['0', '3']) assert.ok(result[key].notices.includes('newMult'))
  for (const key of ['1', '2', '4']) assert.ok(!result[key].notices.includes('newMult'))
})

test('potential multipliers never award points or consume logged multipliers and dupe slots', async () => {
  const incomplete = {
    ...spot('W1AW'),
    uuid: 'incomplete',
    startAtMillis: Date.UTC(2026, 8, 26, 11),
  }
  const empty = await score([incomplete])
  assert.equal(empty.qsoScores.incomplete.value, 0)
  assert.deepEqual(empty.qsoScores.incomplete.alerts, ['missingExchange'])
  assert.equal(empty.operationSummary.cqww.total, 0)
  assert.equal(empty.operationSummary.cqww.mults, 0)
  const hinted = await score([
    { ...incomplete, their: { call: 'W1AW', guess: { state: 'CT', cqZone: 5 } } },
  ])
  assert.equal(hinted.operationSummary.cqww.total, 0)
  assert.equal(hinted.operationSummary.cqww.mults, 0)
  const completed = await score([incomplete, logged('W1AW', '5', 'CT')])
  assert.equal(completed.qsoScores['W1AW-20m'].dupe, false)
  assert.equal(completed.operationSummary.cqww.total, 3)
})

test('checkpoint tails carry copied exchanges and live draft notices agree with spots', async () => {
  const checkpoint = await score([logged('W2ABC', '5', 'MA')])
  const tail = [logged('W1AW', '5', 'CT', '40m')]
  const result = await candidates([spot('W1AW')], checkpoint, { qsos: tail })
  assert.ok(result['0'].notices.includes('newMult'))
  const live = await cqww.runHook('scoring', 'scoreQso', {
    operation,
    ref,
    resumeFrom: checkpoint.scoresheet,
    resumeDay: checkpoint.scoresheetDay,
    qsos: tail,
    qso: spot('W1AW'),
  })
  assert.deepEqual(live, result['0'])
  assert.deepEqual(checkpoint, await score([logged('W2ABC', '5', 'MA')]))
})

test('copied zones beat country-file defaults and can be overridden or deliberately cleared', async () => {
  const checkpoint = await score([logged('W1AW', '3', 'CT', '40m'), logged('W2ABC', '5', 'CT')])
  const result = await candidates(
    [
      spot('W1AW'),
      { ...spot('W1AW'), refs: [{ type: 'cqww', theirZone: '5' }] },
      { ...spot('W1AW'), refs: [{ type: 'cqww', theirZone: '' }] },
    ],
    checkpoint,
  )
  assert.ok(result['0'].notices.includes('newMult'))
  for (const key of ['1', '2']) assert.ok(!result[key].notices.includes('newMult'))
})

test('old checkpoints without copied exchanges still identify country and zone multipliers', async () => {
  const checkpoint = await score([logged('W1AW', '5', 'CT')])
  delete (checkpoint.scoresheet as Qson).exchangesByCall
  const result = await candidates([spot('JA1ABC')], checkpoint)
  assert.ok(result['0'].notices.includes('newMult'))
})

test('a cold spot pass folds the log once and does not turn incomplete QSOs into worked multipliers', async () => {
  let reads = 0
  const hook = contestScorer(CQWWScorer, { scope: { refTypes: ['cqww'] } })
  const result = await hook.scoreCandidates?.(
    {
      operation,
      ref,
      candidates: [spot('W1AW'), spot('DL1ABC'), spot('DL1ABC')].map((qso, index) => ({
        key: String(index),
        qso,
      })),
    },
    {
      online: false,
      getQsos: async () => {
        reads++
        return [logged('W1AW', '5', 'CT'), { ...spot('DL1ABC'), uuid: 'incomplete' }]
      },
    },
  )
  assert.equal(reads, 1)
  assert.equal(result?.['0'].dupe, true)
  assert.ok(result?.['1'].notices.includes('newMult'))
  assert.deepEqual(result?.['1'], result?.['2'])
})
