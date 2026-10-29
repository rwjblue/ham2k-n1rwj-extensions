import type { ContestScorer } from '@ham2k/extension-sdk'
import {
  contestMode,
  object,
  type Qson,
  refOf,
  text,
} from '../../../../packages/mini-contest/src/model.ts'
import { sessionFor } from '../../../../packages/mini-contest/src/schedule.ts'
import { createScorer, type Scoresheet } from '../../../../packages/mini-contest/src/scorer.ts'
import { isCallsign } from '../../../../packages/n1mm/src/callsign.ts'
import { config } from './config.ts'

export type OperatingMode = 'CQ' | 'SP' | 'UNKNOWN'
export type QsyContact = {
  uuid: string
  at: number | null
  band: string
  hz: number | null
  role: OperatingMode
}
export type QsyState = {
  version: 1
  mode: OperatingMode
  pending: QsyContact[]
  recent: QsyContact[]
  complete: boolean
}
export type NsScoresheet = Scoresheet & { qsy: QsyState }
export type QsyAdvice = {
  kind: 'unknown' | 'cq' | 'sp' | 'required' | 'distance' | 'nearby' | 'editing'
  message: string
  advisory?: string
}
export function operatingMode(value: unknown): OperatingMode {
  return value === 'CQ' || value === 'SP' ? value : 'UNKNOWN'
}
export function initialQsyState(complete = true): QsyState {
  return { version: 1, mode: 'UNKNOWN', pending: [], recent: [], complete }
}
export function isQsyState(value: unknown): value is QsyState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  const contact = (value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const row = value as Record<string, unknown>
    return (
      typeof row.uuid === 'string' &&
      typeof row.band === 'string' &&
      (row.at === null || (typeof row.at === 'number' && Number.isFinite(row.at))) &&
      (row.hz === null || (typeof row.hz === 'number' && Number.isFinite(row.hz) && row.hz > 0)) &&
      ['CQ', 'SP', 'UNKNOWN'].includes(String(row.role))
    )
  }
  return (
    state.version === 1 &&
    typeof state.complete === 'boolean' &&
    ['CQ', 'SP', 'UNKNOWN'].includes(String(state.mode)) &&
    Array.isArray(state.pending) &&
    state.pending.every(contact) &&
    Array.isArray(state.recent) &&
    state.recent.length <= 2 &&
    state.recent.every(contact)
  )
}
export function qsyContact(qso: Qson, fallback: OperatingMode = 'UNKNOWN'): QsyContact {
  const role = refOf(qso, 'ns')?.role
  return {
    uuid: text(qso.uuid),
    at:
      typeof qso.startAtMillis === 'number' && Number.isFinite(qso.startAtMillis)
        ? qso.startAtMillis
        : null,
    band: text(qso.band),
    // QSON stores frequency in kHz. Compare integer Hz; exactly 1 kHz is legal.
    hz:
      typeof qso.freq === 'number' && Number.isFinite(qso.freq) && qso.freq > 0
        ? Math.round(qso.freq * 1000)
        : null,
    role: role === undefined ? fallback : operatingMode(role),
  }
}
const frequency = (hz: number) => `${(hz / 1000).toFixed(3)} kHz`

export function qsyAdvice(state: QsyState, candidate: QsyContact): QsyAdvice {
  const last = state.recent[state.recent.length - 1]
  if (
    (candidate.uuid && state.recent.some((row) => row.uuid === candidate.uuid)) ||
    (candidate.at !== null && last?.at !== null && last?.at !== undefined && candidate.at < last.at)
  )
    return {
      kind: 'editing',
      message:
        'Editing an earlier contact. Review its role/frequency; live QSY reminders do not reconstruct that draft’s historical position.',
    }
  if (state.pending.length) {
    const blocked = state.pending.find(
      (row) => row.hz === null || candidate.hz === null || Math.abs(candidate.hz - row.hz) < 1000,
    )
    if (blocked) {
      const message =
        blocked.hz === null || candidate.hz === null
          ? 'QSY reminder: the previous CQ requires a move of at least 1 kHz. A frequency is missing; verify the move manually.'
          : `QSY reminder: move at least 1 kHz from ${frequency(blocked.hz)} before another contact. Complete a contact elsewhere before returning.`
      return { kind: 'required', message, advisory: message }
    }
    return {
      kind: 'distance',
      message:
        'At least 1 kHz from the recorded CQ frequencies. Complete a contact here before returning; tuning away and back alone does not clear the restriction.',
    }
  }
  const nearby = [...state.recent, candidate]
  if (
    nearby.length === 3 &&
    nearby.some((row) => row.role === 'UNKNOWN') &&
    nearby.every((row) => row.hz !== null && row.band && row.band === candidate.band)
  ) {
    const values = nearby.map((row) => row.hz as number)
    if (Math.max(...values) - Math.min(...values) < 1000) {
      const message =
        'QSY advisory: three contacts are within a 1 kHz window. Check who solicited; answering separate nearby CQs can be valid.'
      return { kind: 'nearby', message, advisory: message }
    }
  }
  if (candidate.role === 'CQ')
    return {
      kind: 'cq',
      message:
        'CQ / holding frequency: after completing this contact, move at least 1 kHz before calling or answering again.',
    }
  if (candidate.role === 'SP')
    return {
      kind: 'sp',
      message:
        'S&P / answering: you may inherit the frequency and solicit one contact. Select CQ if you do; you may also continue answering other CQs.',
    }
  return {
    kind: 'unknown',
    message:
      'Select CQ or S&P when known. Frequency-only checks are advisory and never change QSO points or multipliers.',
  }
}

export function advanceQsy(state: QsyState, row: QsyContact): void {
  const last = state.recent[state.recent.length - 1]
  if (row.at === null || (last?.at !== null && last?.at !== undefined && row.at < last.at)) {
    state.complete = false
    return
  }
  state.mode = row.role
  if (row.hz === null) state.complete = false
  // Only a COMPLETED contact clears a vacated frequency. Unknown frequencies
  // cannot prove compliance; retain the incomplete-history notice afterward.
  state.pending = state.pending.filter(
    (previous) =>
      row.hz === null || (previous.hz !== null && Math.abs(row.hz - previous.hz) < 1000),
  )
  if (
    row.role === 'CQ' &&
    !state.pending.some((previous) => previous.hz === row.hz && previous.band === row.band)
  )
    state.pending.push(row)
  state.recent = [...state.recent, row].slice(-2)
}

export function replayQsy(qsos: Qson[], operation: Qson): QsyState {
  const state = initialQsyState()
  const session = sessionFor(config, text(refOf(operation, 'ns')?.ref))
  const rows = qsos
    .filter(
      (qso) =>
        refOf(qso, 'ns') &&
        !qso.deleted &&
        config.bands.includes(text(qso.band)) &&
        contestMode(text(qso.mode)) === 'CW' &&
        isCallsign(text(object(qso.their).call)) &&
        !config.ineligibleReason?.(qso, operation),
    )
    .map((qso) => qsyContact(qso))
    .filter(
      (row) =>
        row.at === null ||
        !session ||
        (row.at >= session.startMillis && row.at < session.endMillis),
    )
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity))
  for (const row of rows) advanceQsy(state, row)
  return state
}

export function createNsScorer(): ContestScorer<NsScoresheet> {
  const base = createScorer(config)
  return {
    startScoresheet(args, ctx) {
      return { ...base.startScoresheet(args, ctx), qsy: initialQsyState() }
    },
    scoreQso(args, ctx) {
      const { scoresheet, qso } = args
      // A checkpoint from the first NS build has no role/frequency history.
      if (!isQsyState(scoresheet.qsy)) scoresheet.qsy = initialQsyState(scoresheet.points === 0)
      const row = qsyContact(qso)
      const advice = qsyAdvice(scoresheet.qsy, row)
      const { score } = base.scoreQso(args, ctx)
      if (score.value > 0 || score.dupe) {
        if (advice.advisory) score.alerts = [...(score.alerts ?? []), advice.advisory]
        advanceQsy(scoresheet.qsy, row)
      }
      return { scoresheet, score }
    },
    summarizeScore: (args, ctx) => base.summarizeScore(args, ctx),
  }
}
