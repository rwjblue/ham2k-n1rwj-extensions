import assert from 'node:assert/strict'
import type { JSONValue } from '@ham2k/extension-sdk'
import { contestScorer } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { EVENT_2026, type Qson } from '../src/rules.ts'
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
  assert.equal(summary.label, 'BIGFOOT Hunt · Mixed letters')
  assert.ok(summary.longSummary?.includes('CW 7/7'))
  assert.ok(summary.longSummary?.includes('W7O (first)'))
  assert.ok(summary.longSummary?.includes('W7O (second)'))
  assert.ok(
    summary.longSummary?.includes(
      '🦨 **Skunk Ape bonus (W4S)** · CW: ✅ worked · Mixed: ✅ worked',
    ),
  )
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
  assert.deepEqual(result.qsoScores.o1.notices, ['newMult'])
  assert.deepEqual(result.qsoScores.o2.notices, ['newBand', 'newMult'])
  assert.deepEqual(result.qsoScores.phone.notices, ['newMode', 'newMult'])
  assert.equal(result.qsoScores['phone-dupe'].dupe, true)
  assert.deepEqual(result.qsoScores['other-digital'].notices, ['newMode', 'newMult'])
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
  assert.deepEqual(fresh?.notices, ['newDay', 'newMult'])
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
  assert.deepEqual(candidates?.['new-band'].notices, ['newBand', 'newMult'])
  assert.equal(candidates?.['same-context'].dupe, true)
  assert.equal(reads, 0)
  // Neither live judgement becomes a logged contact inside the checkpoint.
  assert.deepEqual(before.scoresheet, {
    contactsByCall: { W7O: [['first', '20m', 'CW', during]] },
  })
})

test('highlights missing letters and bonus without highlighting completed same-mode targets', async () => {
  const result = await score([
    qso('first-b', 'W7B'),
    qso('another-b', 'W7B', '40m'),
    qso('phone-b', 'W7B', '20m', 'SSB'),
    qso('first-bonus', 'W4S'),
    qso('another-bonus', 'W4S', '40m'),
    qso('unrelated', 'W3S'),
  ])
  assert.deepEqual(result.qsoScores['first-b'].notices, ['newMult'])
  assert.deepEqual(result.qsoScores['another-b'].notices, ['newBand'])
  assert.deepEqual(result.qsoScores['phone-b'].notices, ['newMode', 'newMult'])
  assert.deepEqual(result.qsoScores['first-bonus'].notices, ['newMult'])
  assert.deepEqual(result.qsoScores['another-bonus'].notices, ['newBand'])
  assert.deepEqual(result.qsoScores.unrelated, { value: 0 })
})

test('CW spots still highlight both needed O contacts after mixed-mode completion on SSB', async () => {
  const hook = contestScorer(BigfootScorer, { scope: { refTypes: ['bigfoot'] } })
  const logged = [qso('phone-one', 'W7O', '20m', 'USB'), qso('phone-two', 'W7O', '40m', 'LSB')]
  await hook.scoreQsos({ operation, ref, qsos: logged, checkpointKey: 'phone-pair' }, ctx)
  const first = await hook.scoreCandidates?.(
    {
      operation,
      ref,
      resumeKey: 'phone-pair',
      candidates: [{ key: 'cw', qso: qso('cw-one', 'W7O') }],
    },
    ctx,
  )
  assert.ok(first?.cw.notices.includes('newMult'))
  await hook.scoreQsos(
    {
      operation,
      ref,
      qsos: [...logged, qso('cw-one', 'W7O')],
      checkpointKey: 'one-cw',
    },
    ctx,
  )
  const second = await hook.scoreCandidates?.(
    {
      operation,
      ref,
      resumeKey: 'one-cw',
      candidates: [
        { key: 'same', qso: qso('same', 'W7O') },
        { key: 'second', qso: qso('cw-two', 'W7O', '40m') },
      ],
    },
    ctx,
  )
  assert.equal(second?.same.dupe, true)
  assert.ok(!second?.same.notices.includes('newMult'))
  assert.ok(second?.second.notices.includes('newMult'))
})

test('live needed status follows edits and deletion of the last contact without a batch rescore', async () => {
  const hook = contestScorer(BigfootScorer, { scope: { refTypes: ['bigfoot'] } })
  let logged: Qson[] = [qso('first', 'W7O')]
  const liveContext = { online: false, getQsos: async () => logged }
  const judge = () =>
    hook.scoreCandidates?.(
      {
        operation,
        ref,
        candidates: [{ key: 'o', qso: qso('candidate', 'W7O') }],
      },
      liveContext,
    )
  assert.equal((await judge())?.o.dupe, true)
  const editing = await hook.scoreQso?.(
    {
      operation,
      ref,
      qso: qso('first', 'W7O'),
      excludeUuid: 'first',
    },
    liveContext,
  )
  assert.equal(editing?.dupe, false)
  assert.ok(editing?.notices.includes('newMult'))
  logged = [qso('first', 'W7O', '40m')]
  const edited = (await judge())?.o
  assert.equal(edited?.dupe, false)
  assert.ok(edited?.notices.includes('newMult'))
  assert.ok(edited?.notices.includes('newBand'))
  // The native host skips scoreQsos on an empty log. Its live path drops
  // the invalid checkpoint and reads the current log instead.
  logged = []
  const deleted = (await judge())?.o
  assert.equal(deleted?.dupe, false)
  assert.deepEqual(deleted?.notices, ['newMult'])
})
