import { describe, expect, it } from 'vitest'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import type { Qson } from '../../../../packages/mini-contest/src/model.ts'
import manifest from '../manifest.json'
import { config } from '../src/config.ts'
import { createNsHooks } from '../src/hooks.ts'
import {
  advanceQsy,
  initialQsyState,
  type OperatingMode,
  qsyAdvice,
  qsyContact,
  replayQsy,
} from '../src/qsy.ts'
import { contact, ctx, operation } from './fixtures.ts'

function qso(index: number, role: OperatingMode, freq = 14042): Qson {
  return {
    ...contact(`K${index}ABC`),
    freq,
    startAtMillis: Date.parse('2026-10-30T02:35:00Z') + index * 1000,
    refs: [
      {
        type: 'ns',
        name: 'BOB',
        theirSerial: '42',
        ourSerial: String(index),
        location: 'MA',
        role,
      },
    ],
  }
}
const row = (index: number, role: OperatingMode, freq = 14042) => qsyContact(qso(index, role, freq))

describe('NS QSY advice', () => {
  it('requires 1 kHz after CQ, including before answering, and accepts exactly 1 kHz', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'CQ'))
    expect(qsyAdvice(state, row(2, 'SP', 14042.999)).kind).toBe('required')
    expect(qsyAdvice(state, row(2, 'SP', 14043)).kind).toBe('distance')
    expect(qsyAdvice(state, row(2, 'CQ', 14041)).kind).toBe('distance')
    expect(state.pending).toHaveLength(1)
  })
  it('keeps the return restriction until a completed contact elsewhere', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'CQ'))
    qsyAdvice(state, row(2, 'SP', 14044))
    expect(qsyAdvice(state, row(2, 'SP')).kind).toBe('required')
    advanceQsy(state, row(2, 'SP', 14044))
    expect(state.pending).toEqual([])
    expect(qsyAdvice(state, row(3, 'SP')).kind).toBe('sp')
  })
  it('permits the answering-then-CQ couplet and retains the selected mode', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'SP'))
    expect(state.mode).toBe('SP')
    expect(qsyAdvice(state, row(2, 'CQ')).kind).toBe('cq')
    advanceQsy(state, row(2, 'CQ'))
    expect(state.mode).toBe('CQ')
    expect(qsyAdvice(state, row(3, 'SP')).kind).toBe('required')
  })
  it('does not assume that answering nearby CQs means soliciting', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'SP', 14042))
    advanceQsy(state, row(2, 'SP', 14042.3))
    expect(qsyAdvice(state, row(3, 'SP', 14042.6))).toMatchObject({ kind: 'sp' })
    expect(state.pending).toEqual([])
  })
  it('makes unknown-role proximity advisory and uses the whole window rather than chained deltas', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'UNKNOWN', 14042))
    advanceQsy(state, row(2, 'UNKNOWN', 14042.5))
    expect(qsyAdvice(state, row(3, 'UNKNOWN', 14042.9))).toMatchObject({
      kind: 'nearby',
      advisory: expect.stringContaining('answering separate nearby CQs can be valid'),
    })
    expect(qsyAdvice(state, row(3, 'UNKNOWN', 14043)).kind).toBe('unknown')
    expect(qsyAdvice(state, row(3, 'UNKNOWN', 14043.4)).kind).toBe('unknown')
  })
  it('retains all unfulfilled CQ anchors instead of permitting slow frequency drift', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'CQ', 14042))
    advanceQsy(state, row(2, 'CQ', 14042.5))
    expect(state.pending).toHaveLength(2)
    expect(qsyAdvice(state, row(3, 'SP', 14041.5)).kind).toBe('required')
    advanceQsy(state, row(3, 'SP', 14041.5))
    expect(state.pending.map(({ hz }) => hz)).toEqual([14042000])
  })
  it('accepts a completed contact on another band as the intervening contact', () => {
    const state = initialQsyState()
    advanceQsy(state, row(1, 'CQ'))
    advanceQsy(state, { ...row(2, 'SP', 7042), band: '40m' })
    expect(qsyAdvice(state, row(3, 'SP')).kind).toBe('sp')
  })
  it('does not invent frequencies or claim that missing history proves compliance', () => {
    const state = initialQsyState()
    advanceQsy(state, { ...row(1, 'CQ'), hz: null })
    expect(state.complete).toBe(false)
    expect(qsyAdvice(state, row(2, 'SP')).message).toContain('verify the move manually')
    expect(qsyContact({ freq: NaN }).hz).toBeNull()
    expect(qsyContact({ freq: '14042' }).hz).toBeNull()
  })
  it('does not rewind the live sequence while editing an older contact', () => {
    const state = initialQsyState()
    advanceQsy(state, row(3, 'CQ'))
    expect(qsyAdvice(state, row(1, 'SP')).kind).toBe('editing')
    expect(qsyAdvice(state, row(3, 'CQ')).kind).toBe('editing')
    advanceQsy(state, row(1, 'SP'))
    expect(state.mode).toBe('CQ')
    expect(state.complete).toBe(false)
  })
  it('rebuilds from chronological, eligible NS contacts after edits/deletions', () => {
    const outside = { ...qso(1, 'CQ'), startAtMillis: Date.parse('2026-10-30T03:01:00Z') }
    const state = replayQsy(
      [
        qso(3, 'CQ', 14044),
        qso(1, 'CQ'),
        qso(2, 'SP', 14044),
        { ...qso(4, 'CQ', 14044), deleted: true },
        { ...qso(5, 'CQ'), mode: 'RTTY' },
        { ...qso(6, 'CQ'), band: '30m' },
        outside,
        { ...qso(7, 'CQ'), refs: [{ type: 'sst', name: 'BOB' }] },
      ],
      operation,
    )
    expect(state.mode).toBe('CQ')
    expect(state.pending.map(({ hz }) => hz)).toEqual([14044000])
    expect(state.recent.map(({ uuid }) => uuid)).toEqual(['K2ABC-20m', 'K3ABC-20m'])
  })
})

describe('NS QSY scoring integration', () => {
  it('adds advisories without changing points, multipliers or duplicate treatment', async () => {
    const qsos = [qso(1, 'CQ'), qso(2, 'SP'), qso(3, 'UNKNOWN')]
    const baseline = await createContestHooks(config, manifest).scoring.scoreQsos(
      { operation, qsos },
      ctx,
    )
    const actual = await createNsHooks().scoring.scoreQsos({ operation, qsos }, ctx)
    expect(actual.operationSummary).toEqual(baseline.operationSummary)
    expect(actual.qsoScores['K2ABC-20m']).toMatchObject({
      value: 1,
      dupe: false,
      alerts: [expect.stringContaining('QSY reminder')],
    })
    expect(actual.qsoScores['K1ABC-20m']?.value).toBe(1)
  })
  it('serializes CQ restrictions across checkpoint/resume and leaves live probes read-only', async () => {
    const { scoring } = createNsHooks()
    const first = await scoring.scoreQsos({ operation, qsos: [qso(1, 'CQ')] }, ctx)
    const saved = JSON.parse(JSON.stringify(first.scoresheet))
    expect(
      await scoring.scoreQso?.({ operation, qso: qso(2, 'SP'), resumeFrom: saved }, ctx),
    ).toMatchObject({ alerts: [expect.stringContaining('QSY reminder')] })
    expect(saved).toEqual(first.scoresheet)
    const resumed = await scoring.scoreQsos(
      { operation, qsos: [qso(2, 'SP', 14044)], resumeFrom: saved },
      ctx,
    )
    expect(resumed.operationSummary.ns?.points).toBe(2)
    expect(
      await scoring.scoreQso?.(
        { operation, qso: qso(3, 'SP'), resumeFrom: resumed.scoresheet },
        ctx,
      ),
    ).toMatchObject({ alerts: [] })
  })
  it('makes frequency-only reminders advisory even with no recorded CQ', async () => {
    const qsos = [qso(1, 'UNKNOWN'), qso(2, 'UNKNOWN', 14042.3), qso(3, 'UNKNOWN', 14042.6)]
    const result = await createNsHooks().scoring.scoreQsos({ operation, qsos }, ctx)
    expect(result.operationSummary.ns).toMatchObject({ points: 3, mults: 1, total: 3 })
    expect(result.qsoScores['K3ABC-20m']?.alerts).toEqual([expect.stringContaining('QSY advisory')])
  })
  it('accepts older NS checkpoints without claiming their missing QSY history is complete', async () => {
    const { scoring } = createNsHooks()
    const older = await createContestHooks(config, manifest).scoring.scoreQsos(
      { operation, qsos: [qso(1, 'UNKNOWN')] },
      ctx,
    )
    const result = await scoring.scoreQsos(
      { operation, qsos: [qso(2, 'SP', 14044)], resumeFrom: older.scoresheet },
      ctx,
    )
    expect(result.operationSummary.ns?.points).toBe(2)
    expect(result.scoresheet).toMatchObject({ qsy: { complete: false } })
  })
})
