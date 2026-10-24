// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import {
  type ContestScorer,
  contestScorer,
  contestSummary,
  type OperationSegmentPayload,
  operationForQso,
  type QsoScoreVerdict,
  type ScoringHook,
} from '@ham2k/extension-sdk'
import { ACTIVITY_BANDS, CONTEST_BANDS, eventOn, inSession, sessionFor } from './events.ts'
import {
  getExchange,
  isQualified,
  numberToken,
  numeric,
  ownExchange,
  reportFor,
} from './exchange.ts'
import { memberNumber, memberSuffix, object, type Qson, refOf, TYPE, text } from './model.ts'

export type EventState = {
  qsos: number
  pending: number
  outside: number
  duplicates: number
  worked: Record<string, boolean>
  members: Record<string, number>
  spcs: Record<string, boolean>
  grids: Record<string, boolean>
  birthdays: Record<string, boolean>
  special: number
}
export function emptyEventState(): EventState {
  return {
    qsos: 0,
    pending: 0,
    outside: 0,
    duplicates: 0,
    worked: {},
    members: {},
    spcs: {},
    grids: {},
    birthdays: {},
    special: 0,
  }
}
export type EventScoresheet = { sessions: Record<string, { operation: Qson; state: EventState }> }
export function emptyScoresheet(): EventScoresheet {
  return { sessions: {} }
}
export interface EventScoreReport {
  label: string
  qsos: number
  mults: number
  membershipBonus: number
  specialBonus: number
  gridBonus: number
  birthdayBonus: number
  themeBonus: number
  base: number
  total?: number
  status: string
  pending: number
  duplicates: number
}

function approvedKeying(exchange: Qson): boolean {
  const qualified = isQualified(exchange.qualified)
  const key = text(exchange.key).toUpperCase()
  const approved = ['SK', 'BUG', 'SS', 'WAIVER'].includes(key)
  return qualified !== false && (!key || approved) && (qualified === true || approved)
}

function scoreContact(sheet: EventState, qso: Qson, operation: Qson): QsoScoreVerdict {
  const event = eventOn(operation)
  if (!event || event.id === 'general' || qso.band === 'event' || qso.deleted === true)
    return { value: 0 }
  const session = sessionFor(refOf(operation)?.ref)
  const exchange = getExchange(qso)
  const ours = ownExchange(qso, operation)
  const time = numeric(qso.startAtMillis)
  if (!session || time === undefined || !inSession(session, time, numeric(exchange.wpm))) {
    sheet.outside++
    return { value: 0, alerts: ['outsideEvent'] }
  }
  if (text(qso.mode).toUpperCase() !== 'CW') return { value: 0, alerts: ['invalidMode'] }
  const band = text(qso.band)
  if (
    (event.id === 'cskm'
      ? !band
      : !(event.contest ? CONTEST_BANDS : ACTIVITY_BANDS).includes(band)) ||
    (event.id === 'k3y' && band === '60m')
  )
    return { value: 0, alerts: ['invalidBand'] }
  const number = numberToken(exchange.number)
  const call = text(object(qso.their).call).toUpperCase()
  const spc = text(exchange.spc).toUpperCase()
  const name = text(exchange.name)
  const grid = text(exchange.grid).toUpperCase()
  const nonmemberException = number === 'NONE' && (event.id === 'sksa' || event.id === 'sss')
  const ourNonmemberException =
    numberToken(ours.number) === 'NONE' && (event.id === 'sksa' || event.id === 'sss')
  const missing =
    !call ||
    !name ||
    !/^[A-Z]{2,3}$/.test(spc) ||
    (!memberNumber(number) && number !== 'NONE') ||
    !text(ours.name) ||
    !/^[A-Z]{2,3}$/.test(text(ours.spc).toUpperCase()) ||
    (!memberNumber(ours.number) && numberToken(ours.number) !== 'NONE') ||
    !reportFor(qso, 'our') ||
    !reportFor(qso, 'their') ||
    (!nonmemberException && !approvedKeying(exchange)) ||
    (!ourNonmemberException && !approvedKeying(ours)) ||
    (event.id === 'qso-party' && !/^[A-R]{2}[0-9]{2}$/.test(grid))
  if (missing) {
    sheet.pending++
    return { value: 0, alerts: ['missingExchange'] }
  }
  // SSS reports completed contacts, with no competition duplicate rule.
  const identity = `${call}|${band}`
  if (event.contest && sheet.worked[identity]) {
    sheet.duplicates++
    return { value: 0, dupe: true, alerts: ['duplicate'] }
  }
  sheet.worked[identity] = true
  sheet.qsos++
  const newSpc = !sheet.spcs[spc]
  sheet.spcs[spc] = true
  if (event.contest) {
    const suffix = memberSuffix(number)
    const member = memberNumber(number)
    const bonus = suffix === 'S' ? 15 : suffix === 'T' ? 10 : suffix === 'C' ? 5 : 0
    if (member) sheet.members[member] = Math.max(sheet.members[member] ?? 0, bonus)
    const configured = text(refOf(operation)?.bonusCall).toUpperCase()
    const bonusCall =
      event.id === 'sks'
        ? configured
        : event.id === 'wes' || event.id === 'qso-party'
          ? 'KS1KCC'
          : ''
    if (bonusCall && call === bonusCall) sheet.special += 25
    if (event.id === 'qso-party') sheet.grids[grid] = true
    if (event.id === 'sksa' && /(?:^|\s|\/)BD(?:\s|$)/i.test(name))
      sheet.birthdays[member ?? call] = true
  }
  return {
    value: 1,
    band,
    ...(event.contest ? { dupe: false, notices: newSpc ? ['newMult'] : [] } : {}),
  }
}

export function summarizeEvent(sheet: EventState, operation: Qson): EventScoreReport {
  const event = eventOn(operation)
  const setup = refOf(operation) ?? {}
  const membershipBonus = Object.values(sheet.members).reduce((sum, points) => sum + points, 0)
  const mults = Object.keys(sheet.spcs).length
  const gridBonus = Object.keys(sheet.grids).length * 5
  const birthdayBonus = Object.keys(sheet.birthdays).length * 30
  const base = event?.contest
    ? sheet.qsos * mults + membershipBonus + sheet.special + gridBonus + birthdayBonus
    : sheet.qsos
  const themeBonus = text(setup.themeMode) === 'additive' ? numeric(setup.themeBonus) : 0
  let total: number | undefined = base
  let status = event?.contest ? 'Standard score' : 'Completed contacts; not a contest score'
  if (event && ['wes', 'sks', 'skse', 'sksa'].includes(event.id)) {
    const mode = text(setup.themeMode)
    if (mode === 'none') status = 'Standard rules reviewed'
    else if (mode === 'additive' && themeBonus !== undefined) {
      total = base + themeBonus
      status = 'Includes manually reviewed theme bonus'
    } else if (mode === 'custom' && numeric(setup.reviewedScore) !== undefined) {
      total = numeric(setup.reviewedScore)
      status = 'Manually reviewed special-rule final score'
    } else {
      total = undefined
      status = 'Base estimate only — review this edition’s rules and theme'
    }
    if (event.id === 'sks' && !text(setup.bonusCall)) {
      total = undefined
      status += '; designated bonus station not configured'
    }
  }
  if (event?.id === 'qso-party' && setup.photoSoapbox === true) {
    total = base + 100
    status += '; includes declared photo and soapbox'
  }
  if (text(setup.entryCategory) === 'SWL') {
    total = undefined
    status = 'SWL worksheet only — manually review copied sides and theme eligibility'
  }
  if (sheet.pending) {
    total = undefined
    status += `; ${sheet.pending} contacts need exchange/key evidence`
  }
  return {
    label: sessionFor(setup.ref)?.label ?? event?.label ?? 'SKCC',
    qsos: sheet.qsos,
    mults,
    membershipBonus,
    specialBonus: sheet.special,
    gridBonus,
    birthdayBonus,
    themeBonus: themeBonus ?? 0,
    base,
    ...(total === undefined ? {} : { total }),
    status,
    pending: sheet.pending,
    duplicates: sheet.duplicates,
  }
}
export function calculateEventScore(qsos: Qson[], operation: Qson): EventScoreReport {
  const sheet = emptyEventState()
  for (const qso of qsos) scoreContact(sheet, qso, operation)
  return summarizeEvent(sheet, operation)
}
export function calculateEventReports(
  qsos: Qson[],
  operation: Qson,
  segments: OperationSegmentPayload[] = [],
): EventScoreReport[] {
  if (!segments.length) return [calculateEventScore(qsos, operation)]
  const sessions = new Map<string, { operation: Qson; state: EventState }>()
  for (const qso of qsos) {
    const effective = operationForQso(operation, qso, segments)
    const key = text(refOf(effective)?.ref)
    if (!sessionFor(key)) continue
    const session = sessions.get(key) ?? { operation: effective, state: emptyEventState() }
    scoreContact(session.state, qso, effective)
    session.operation = effective
    sessions.set(key, session)
  }
  return sessions.size
    ? [...sessions.values()].map(({ state, operation }) => summarizeEvent(state, operation))
    : [calculateEventScore([], operation)]
}
export const SKCCScorer: ContestScorer<EventScoresheet> = {
  startScoresheet: emptyScoresheet,
  scoreQso({ scoresheet, qso, operation, ref }) {
    const effectiveOperation = ref?.type === TYPE ? { ...operation, refs: [ref] } : operation
    const setup = refOf(effectiveOperation)
    const key = text(setup?.ref)
    if (!sessionFor(key)) return { scoresheet, score: { value: 0 } }
    const bucket = scoresheet.sessions[key] ?? {
      operation: { refs: [setup ?? {}] },
      state: emptyEventState(),
    }
    scoresheet.sessions[key] = bucket
    bucket.operation = { refs: [setup ?? {}] }
    return { scoresheet, score: scoreContact(bucket.state, qso, effectiveOperation) }
  },
  summarizeScore({ scoresheet, scope }, ctx) {
    return Object.assign(
      {},
      ...Object.entries(scoresheet.sessions).map(([key, { state, operation }]) => {
        const report = summarizeEvent(state, operation)
        return contestSummary(
          {
            key: `${TYPE}:${key}`,
            scope,
            icon: 'key',
            title: report.label,
            total: report.total ?? report.base,
            arithmetic: eventOn(operation)?.contest
              ? `${report.qsos} QSOs × ${report.mults} SPC + ${report.membershipBonus} C/T/S + ${report.specialBonus} special + ${report.gridBonus} grid + ${report.birthdayBonus} birthday`
              : `${report.qsos} completed contacts`,
            detail: `${report.total === undefined ? '**BASE ESTIMATE** · ' : ''}${report.status}`,
            extra: { ...report },
          },
          ctx,
        )
      }),
    )
  },
}
export function createScoringHook(): ScoringHook {
  const base = contestScorer(SKCCScorer, { scope: { refTypes: [TYPE] } })
  return {
    ...base,
    async scoreCandidates(args, ctx) {
      // This suppresses this extension’s spot score hints. Other sources and
      // native chasing are outside the activity hook’s control.
      if (eventOn(args.operation)?.id === 'sks') return {}
      return base.scoreCandidates ? base.scoreCandidates(args, ctx) : {}
    },
  }
}
