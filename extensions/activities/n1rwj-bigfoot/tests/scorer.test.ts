import assert from 'node:assert/strict'
import type { JSONValue } from '@ham2k/extension-sdk'
import { contestScorer } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { EVENT_2026 } from '../src/rules.ts'
import { BigfootScorer, bigfootScoringHook } from '../src/scorer.ts'

const ctx = { online: false }
const ref = { type: 'bigfoot', ref: '2026' }
const operation = { uuid: 'bigfoot-test', stationCall: 'N1RWJ', refs: [ref] }
const during = Date.UTC(2026, 9, 19, 23, 30)

function qso(
  uuid: string,
  call: string,
  band = '20m',
  mode = 'CW',
  at = during,
): Record<string, JSONValue> {
  return { uuid, their: { call, sent: '599' }, our: { sent: '599' }, band, mode, startAtMillis: at }
}

async function score(qsos: Record<string, JSONValue>[]) {
  return bigfootScoringHook.scoreQsos({ operation, ref, qsos }, ctx)
}

test('scopes the scorer to the BIGFOOT operation activity', () => {
  assert.deepEqual(bigfootScoringHook.scope, { refTypes: ['bigfoot'] })
})

test('scores seven letters while keeping the Skunk Ape bonus separate', async () => {
  const result = await score([
    qso('b', 'W7B'),
    qso('i', 'W7I'),
    qso('g', 'W7G'),
    qso('f', 'W7F'),
    qso('o1', 'W7O'),
    qso('o2', 'W7O', '40m'),
    qso('t', 'W7T'),
    qso('bonus', 'W4S'),
  ])
  const summary = result.operationSummary.bigfoot
  assert.equal(summary.total, 7)
  assert.equal(summary.summary, '7/7')
  assert.equal(summary.label, 'BIGFOOT Hunt: 7/7 letters')
  assert.ok(summary.longSummary?.includes('CW 7/7'))
  assert.ok(summary.longSummary?.includes('W7O (first)'))
  assert.ok(summary.longSummary?.includes('W7O (second)'))
  assert.ok(summary.longSummary?.includes('Skunk Ape bonus (W4S): worked'))
  assert.ok(result.daySections.every((day) => Object.keys(day.scores).length === 0))
})

test('counts a second O only after a different band, actual mode or UTC date', async () => {
  const result = await score([
    qso('o1', 'W7O'),
    qso('dupe', 'W7O'),
    qso('o2', 'W7O', '40m'),
    qso('phone', 'W7O', '20m', 'USB'),
    qso('phone-dupe', 'W7O', '20m', 'LSB'),
    qso('digital', 'W7O', '20m', 'FT8'),
    qso('other-digital', 'W7O', '20m', 'FT4'),
    qso('next-day', 'W7O', '20m', 'CW', Date.UTC(2026, 9, 20, 0, 1)),
  ])
  assert.equal(result.operationSummary.bigfoot.total, 2)
  assert.deepEqual(result.qsoScores.dupe, { value: 0, dupe: true, alerts: ['duplicate'] })
  assert.deepEqual(result.qsoScores.o2.notices, ['newBand'])
  assert.deepEqual(result.qsoScores.phone.notices, ['newMode'])
  assert.equal(result.qsoScores['phone-dupe'].dupe, true)
  assert.deepEqual(result.qsoScores['other-digital'].notices, ['newMode'])
  assert.deepEqual(result.qsoScores['next-day'].notices, ['newDay'])
  assert.ok(result.operationSummary.bigfoot.longSummary?.includes('CW 2/7'))
  assert.ok(result.operationSummary.bigfoot.longSummary?.includes('Phone 1/7'))
})

test('leaves ordinary host dupe judgement intact for contacts outside the hunt', async () => {
  const result = await score([
    qso('ordinary', 'W1AW'),
    qso('early', 'W7B', '20m', 'CW', EVENT_2026.startAtMillis - 1),
    qso('late', 'W7I', '20m', 'CW', EVENT_2026.endAtMillis),
    qso('unsupported-band', 'W7G', '160m'),
    qso('unsupported-mode', 'W7F', '20m', 'FM'),
    { ...qso('event', 'W7T'), band: 'event' },
    qso('valid', 'W7O'),
  ])
  for (const uuid of ['ordinary', 'early', 'late', 'unsupported-band', 'unsupported-mode']) {
    assert.deepEqual(result.qsoScores[uuid], { value: 0 })
  }
  assert.equal(result.qsoScores.event, undefined)
  assert.equal(result.qsoScores.valid.dupe, false)
  assert.equal(result.operationSummary.bigfoot.total, 1)
})

test('requires a known event edition before awarding credit or a summary', async () => {
  const unknown = { ...operation, refs: [{ type: 'bigfoot', ref: '2027' }] }
  const result = await bigfootScoringHook.scoreQsos(
    { operation: unknown, qsos: [qso('b', 'W7B')] },
    ctx,
  )
  assert.deepEqual(result.qsoScores.b, { value: 0 })
  assert.deepEqual(result.operationSummary, {})
})

test('incremental checkpoint scoring matches a full batch across UTC dates', async () => {
  const first = qso('first', 'W7O')
  const next = qso('next', 'W7O', '20m', 'CW', Date.UTC(2026, 9, 20, 0, 1))
  const duplicate = qso('duplicate', 'W7O', '20m', 'CW', Date.UTC(2026, 9, 20, 0, 2))
  const partial = await score([first, qso('bonus', 'W4S')])
  const incremental = await bigfootScoringHook.scoreQsos(
    {
      operation,
      ref,
      qsos: [next, duplicate],
      resumeFrom: JSON.parse(JSON.stringify(partial.scoresheet)),
      resumeDay: partial.scoresheetDay,
    },
    ctx,
  )
  const full = await score([first, qso('bonus', 'W4S'), next, duplicate])
  assert.deepEqual(incremental.operationSummary, full.operationSummary)
  assert.deepEqual(incremental.scoresheet, full.scoresheet)
  assert.deepEqual(incremental.qsoScores.next, full.qsoScores.next)
  assert.deepEqual(incremental.qsoScores.duplicate, full.qsoScores.duplicate)
})

test('live and spot scoring reuse a held checkpoint without a per-keystroke log read', async () => {
  const hook = contestScorer(BigfootScorer, { scope: { refTypes: ['bigfoot'] } })
  let reads = 0
  const liveContext = {
    online: false,
    async getQsos() {
      reads += 1
      throw new Error('The checkpoint must supply existing contacts')
    },
  }
  const first = qso('first', 'W7O')
  const before = await hook.scoreQsos(
    { operation, ref, qsos: [first], checkpointKey: 'saved-log' },
    liveContext,
  )
  assert.equal(before.checkpointHeld, true)
  const duplicate = await hook.scoreQso?.(
    { operation, ref, qso: qso('dupe', 'W7O'), resumeKey: 'saved-log' },
    liveContext,
  )
  assert.equal(duplicate?.dupe, true)
  assert.deepEqual(duplicate?.alerts, ['duplicate'])
  const nextDay = qso('next', 'W7O', '20m', 'CW', Date.UTC(2026, 9, 20, 0, 1))
  const fresh = await hook.scoreQso?.(
    { operation, ref, qso: nextDay, resumeKey: 'saved-log' },
    liveContext,
  )
  assert.equal(fresh?.dupe, false)
  assert.deepEqual(fresh?.notices, ['newDay'])
  const candidates = await hook.scoreCandidates?.(
    {
      operation,
      ref,
      resumeKey: 'saved-log',
      candidates: [
        { key: 'new-band', qso: qso('band', 'W7O', '40m') },
        { key: 'same-context', qso: qso('dupe', 'W7O') },
      ],
    },
    liveContext,
  )
  assert.deepEqual(candidates?.['new-band'].notices, ['newBand'])
  assert.equal(candidates?.['same-context'].dupe, true)
  assert.equal(reads, 0)
  // Neither live judgement becomes a logged contact inside the checkpoint.
  assert.deepEqual(before.scoresheet, {
    contactsByCall: { W7O: [['first', '20m', 'CW', during]] },
  })
})
