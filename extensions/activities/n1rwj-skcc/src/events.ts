// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type EventId, HOME, object, type Qson, refOf, text } from './model.ts'

export interface EventProfile {
  id: EventId
  label: string
  rules: string
  contest: boolean
  assisted: boolean
  description: string
}

export const EVENTS: EventProfile[] = [
  {
    id: 'general',
    label: 'SKCC',
    rules: `${HOME}membership_data/opfreq.php`,
    contest: false,
    assisted: true,
    description: 'Everyday manual-key contacts and award hunting; combines with other activities.',
  },
  {
    id: 'wes',
    label: 'SKCC WES',
    rules: `${HOME}operating_activities/weekend_sprintathon/`,
    contest: true,
    assisted: true,
    description:
      'Second Saturday, 1200 UTC, for 36 hours. Review this month’s theme before declaring a final score.',
  },
  {
    id: 'sks',
    label: 'SKCC SKS',
    rules: `${HOME}operating_activities/weekday_sprint/`,
    contest: true,
    assisted: false,
    description:
      'Fourth Wednesday, 0000–0200 UTC. Unassisted: close all spots, RBN, sked and chasing assistance. This extension cannot switch off other extensions or the host’s spots board.',
  },
  {
    id: 'skse',
    label: 'SKCC SKSE',
    rules: `${HOME}operating_activities/skse/`,
    contest: true,
    assisted: true,
    description:
      'First Thursday, 2000 UTC November–March; 1900 UTC April–October. Two hours plus 15 minutes at each end only at 12 WPM or less.',
  },
  {
    id: 'sksa',
    label: 'SKCC SKSA',
    rules: `${HOME}operating_activities/sksa/`,
    contest: true,
    assisted: true,
    description:
      'Second Friday, 2200–2400 UTC. Received /BD names identify birthday bonus operators.',
  },
  {
    id: 'sss',
    label: 'SKCC Slow Speed Saunter',
    rules: `${HOME}operating_activities/slowspeed/`,
    contest: false,
    assisted: true,
    description:
      'First UTC day of each month. Report completed contacts; 12 WPM or less encouraged. This is not a contest.',
  },
  {
    id: 'qso-party',
    label: 'SKCC QSO Party',
    rules: `${HOME}operating_activities/QSO_Party/`,
    contest: true,
    assisted: true,
    description:
      'Third Saturday in June, 1200 UTC, for 36 hours. Exchange a four-character grid as well as the usual SKCC exchange.',
  },
  {
    id: 'k3y',
    label: 'K3Y Straight Key Month',
    rules: `${HOME}k3y/k3y.php`,
    contest: false,
    assisted: true,
    description:
      'January 2–31. Preserve the event callsign and received personal operator call. DX event participation must be explicitly identified.',
  },
  {
    id: 'cskm',
    label: 'Canadian Straight Key Month',
    rules: `${HOME}ve9skcc/ve9skcc.php`,
    contest: false,
    assisted: true,
    description:
      'September. Received /CSKM identifies participation; a Canadian callsign alone does not.',
  },
]
export const CONTEST_BANDS = ['160m', '80m', '40m', '20m', '15m', '10m', '6m']
export const ACTIVITY_BANDS = [
  '160m',
  '80m',
  '60m',
  '40m',
  '30m',
  '20m',
  '17m',
  '15m',
  '12m',
  '10m',
  '6m',
]

export interface EventSession {
  key: string
  event: EventId
  label: string
  start: number
  end: number
  qrsStart?: number
  qrsEnd?: number
}
export function eventId(value: unknown): EventId | undefined {
  const id = text(value).toLowerCase().split(':')[0]
  return EVENTS.find((event) => event.id === id)?.id
}
export function eventFor(value: unknown): EventProfile | undefined {
  return EVENTS.find((event) => event.id === eventId(value))
}
export function eventOn(operation: Qson): EventProfile | undefined {
  return eventFor(refOf(operation)?.ref)
}
function nthWeekday(year: number, month: number, weekday: number, nth: number): number {
  return 1 + ((weekday - new Date(Date.UTC(year, month, 1)).getUTCDay() + 7) % 7) + 7 * (nth - 1)
}

/** UTC recurrence rules; all ends are exclusive except the explicitly documented SKSE QRS boundary. */
export function sessionFor(value: unknown): EventSession | undefined {
  const key = text(value).toLowerCase()
  const match =
    /^(wes|sks|skse|sksa|sss):(\d{4})-(\d{2})$/.exec(key) ??
    /^(qso-party|k3y|cskm):(\d{4})$/.exec(key)
  if (!match) return undefined
  const event = match[1] as EventId
  const year = Number(match[2])
  const month = match[3]
    ? Number(match[3]) - 1
    : event === 'qso-party'
      ? 5
      : event === 'cskm'
        ? 8
        : 0
  if (year < 2006 || year > 2199 || month < 0 || month > 11) return undefined
  let start = Date.UTC(year, month, 1)
  let hours = 24
  if (event === 'wes' || event === 'qso-party') {
    start = Date.UTC(year, month, nthWeekday(year, month, 6, event === 'wes' ? 2 : 3), 12)
    hours = 36
  }
  if (event === 'sks') {
    start = Date.UTC(year, month, nthWeekday(year, month, 3, 4))
    hours = 2
  }
  if (event === 'sksa') {
    start = Date.UTC(year, month, nthWeekday(year, month, 5, 2), 22)
    hours = 2
  }
  if (event === 'skse') {
    start = Date.UTC(year, month, nthWeekday(year, month, 4, 1), month >= 3 && month <= 9 ? 19 : 20)
    hours = 2
  }
  if (event === 'k3y') start = Date.UTC(year, 0, 2)
  const end =
    event === 'k3y' || event === 'cskm' ? Date.UTC(year, month + 1, 1) : start + hours * 3600000
  return {
    key,
    event,
    label: `${eventFor(event)?.label} ${match[2]}${match[3] ? `-${match[3]}` : ''}`,
    start,
    end,
    ...(event === 'skse' ? { qrsStart: start - 900000, qrsEnd: end + 900000 } : {}),
  }
}
export function upcomingSessions(now: number, count = 12): EventSession[] {
  const date = new Date(now)
  const sessions: EventSession[] = []
  for (let offset = -1; offset <= 12; offset++) {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
      .toISOString()
      .slice(0, 7)
    for (const id of ['wes', 'sks', 'skse', 'sksa', 'sss']) {
      const session = sessionFor(`${id}:${month}`)
      if (session && (session.qrsEnd ?? session.end) >= now) sessions.push(session)
    }
  }
  for (let year = date.getUTCFullYear(); year <= date.getUTCFullYear() + 1; year++) {
    for (const id of ['qso-party', 'k3y', 'cskm']) {
      const session = sessionFor(`${id}:${year}`)
      if (session && session.end > now) sessions.push(session)
    }
  }
  return sessions.sort((a, b) => a.start - b.start).slice(0, count)
}
export function inSession(session: EventSession, at: number, wpm?: number): boolean {
  if (!Number.isFinite(at)) return false
  if (at >= session.start && at < session.end) return true
  return (
    session.event === 'skse' &&
    typeof wpm === 'number' &&
    wpm > 0 &&
    wpm <= 12 &&
    at >= (session.qrsStart ?? session.start) &&
    at <= (session.qrsEnd ?? session.end)
  )
}
export function sprintAt(at: number): EventId[] {
  if (!Number.isFinite(at)) return []
  const month = new Date(at).toISOString().slice(0, 7)
  return (['wes', 'sks', 'skse', 'sksa'] as const).filter((id) => {
    const session = sessionFor(`${id}:${month}`)
    return (
      session &&
      at >= (session.qrsStart ?? session.start) &&
      at <= (session.qrsEnd ?? session.end - 1)
    )
  })
}
export function qsoEvent(qso: Qson): EventId | undefined {
  return eventId(
    refOf(qso)?.event ?? object(object(qso.our).skcc).event ?? object(object(qso.their).skcc).event,
  )
}
