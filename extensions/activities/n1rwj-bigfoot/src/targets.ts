import type { BigfootEvent, Contact, EventMode, Progress, Qson } from './rules.ts'
import {
  buildProgress,
  eventForYear,
  normalizeMode,
  progressForMode,
  qualifyingContacts,
} from './rules.ts'

export type Target = {
  call: string
  label: string
  letter?: string
  bonus: boolean
}

export const BIGFOOT_TARGETS: readonly Target[] = [
  { call: 'W7B', label: 'BIGFOOT 2026: B', letter: 'B', bonus: false },
  { call: 'W7I', label: 'BIGFOOT 2026: I', letter: 'I', bonus: false },
  { call: 'W7G', label: 'BIGFOOT 2026: G', letter: 'G', bonus: false },
  { call: 'W7F', label: 'BIGFOOT 2026: F', letter: 'F', bonus: false },
  { call: 'W7O', label: 'BIGFOOT 2026: O (two contacts)', letter: 'O', bonus: false },
  { call: 'W7T', label: 'BIGFOOT 2026: T', letter: 'T', bonus: false },
  { call: 'W4S', label: 'BIGFOOT 2026: Skunk Ape bonus', bonus: true },
]

export type TargetEligibility =
  | 'eligible'
  | 'outside-event'
  | 'unknown-context'
  | 'unsupported-band'
  | 'unsupported-mode'
  | 'unavailable-event'
  | 'excluded-record'

export type NeedStatus = {
  needed: boolean
  remaining: number
  wouldAdvance: boolean
  repeat: boolean
  next?: 'letter' | 'first-o' | 'second-o' | 'bonus'
  message: string
}

export type TargetStatus = {
  target: Target
  label: string
  messages: string[]
  eligibility: TargetEligibility
  mixed: NeedStatus
  cw: NeedStatus
  mode?: NeedStatus & { mode: EventMode }
}

export function targetForCall(value: unknown): Target | undefined {
  if (typeof value !== 'string') return undefined
  const call = value.trim().toUpperCase()
  return BIGFOOT_TARGETS.find((target) => target.call === call)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function callOf(candidate: Qson): unknown {
  const their = candidate.their
  return their && typeof their === 'object' && !Array.isArray(their) ? their.call : undefined
}

function candidateTime(candidate: Qson): number | undefined {
  // Match the rules' timestamp precedence when explaining why a candidate
  // failed qualification. Qualification itself always goes through rules.ts.
  if ('startAtMillis' in candidate)
    return typeof candidate.startAtMillis === 'number' && Number.isFinite(candidate.startAtMillis)
      ? candidate.startAtMillis
      : undefined
  const value = text(candidate.startAt)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function eligibilityFor(event: BigfootEvent | undefined, candidate: Qson): TargetEligibility {
  if (!event || !eventForYear(event.year)) return 'unavailable-event'
  if (candidate.deleted || candidate.event) return 'excluded-record'
  const band = text(candidate.band).toLowerCase()
  if (band && !event.bands.includes(band)) return 'unsupported-band'
  if (text(candidate.mode) && !normalizeMode(candidate.mode)) return 'unsupported-mode'
  const at = candidateTime(candidate)
  if (at !== undefined && (at < event.startAtMillis || at >= event.endAtMillis))
    return 'outside-event'
  if (!band || !normalizeMode(candidate.mode) || at === undefined) return 'unknown-context'
  return 'eligible'
}

function countFor(progress: Progress, target: Target): number {
  return target.bonus
    ? Number(!!progress.bonus)
    : progress.slots.filter((slot) => slot.call === target.call && slot.contact).length
}

function needStatus(
  target: Target,
  before: Progress,
  after: Progress,
  contacts: readonly Contact[],
  candidate: Contact | undefined,
  label: string,
  acceptsCandidate: boolean,
): NeedStatus {
  const count = countFor(before, target)
  const remaining = Math.max(0, (target.call === 'W7O' ? 2 : 1) - count)
  const wouldAdvance = acceptsCandidate && countFor(after, target) > count
  const repeat =
    !!candidate &&
    acceptsCandidate &&
    contacts.some(
      (contact) =>
        contact.call === candidate.call &&
        contact.band === candidate.band &&
        contact.mode === candidate.mode &&
        contact.utcDate === candidate.utcDate,
    )
  const next =
    remaining === 0
      ? undefined
      : target.bonus
        ? 'bonus'
        : target.call === 'W7O'
          ? count === 0
            ? 'first-o'
            : 'second-o'
          : 'letter'
  const subject = target.bonus
    ? 'Skunk Ape bonus'
    : target.call === 'W7O'
      ? count === 0
        ? 'First O'
        : 'Second O'
      : `${target.letter} (${target.call})`
  let message: string
  if (!remaining)
    message = `${label}: ${target.call === 'W7O' ? 'Both O contacts' : subject} worked.`
  else if (wouldAdvance) message = `${label}: ${subject} needed; this contact would fill it.`
  else if (label === 'CW' && candidate && candidate.mode !== 'CW')
    message = `${label}: ${subject} still needed on CW.`
  else if (repeat && target.call === 'W7O' && count > 0)
    message = `${label}: Second O still needed; use another ${label === 'Mixed' ? 'band, mode, or UTC date' : 'band or UTC date'}.`
  else if (repeat) message = `${label}: ${subject} still needed; this context was already worked.`
  else message = `${label}: ${subject} still needed; confirm the band, mode, and UTC date.`
  return {
    needed: remaining > 0,
    remaining,
    wouldAdvance,
    repeat,
    ...(next ? { next } : {}),
    message,
  }
}

const ELIGIBILITY_MESSAGES: Record<Exclude<TargetEligibility, 'eligible'>, string> = {
  'outside-event': 'Outside the confirmed 2026 event window; this contact earns no BIGFOOT credit.',
  'unknown-context':
    'Band, mode, or UTC time is unavailable; BIGFOOT credit cannot be established yet.',
  'unsupported-band': 'This band is not listed for the confirmed event; no BIGFOOT credit.',
  'unsupported-mode': 'This mode is not listed for the confirmed event; no BIGFOOT credit.',
  'unavailable-event':
    'Published BIGFOOT 2026 target. Select the confirmed event edition to assess progress.',
  'excluded-record': 'Deleted contacts and event markers earn no BIGFOOT credit.',
}

export function targetStatus(
  event: BigfootEvent | undefined,
  contacts: readonly Contact[],
  candidate: Qson,
): TargetStatus | undefined {
  const target = targetForCall(callOf(candidate))
  if (!target) return undefined
  const eligibility = eligibilityFor(event, candidate)
  const history =
    event && eventForYear(event.year)
      ? contacts.filter(
          (contact) => contact.at >= event.startAtMillis && contact.at < event.endAtMillis,
        )
      : []
  const contact =
    eligibility === 'eligible' && event ? qualifyingContacts([candidate], event)[0] : undefined
  const before = buildProgress(history)
  const after = buildProgress(contact ? [...history, contact] : history)
  const mixed = needStatus(target, before.MIXED, after.MIXED, history, contact, 'Mixed', !!contact)
  const cw = needStatus(target, before.CW, after.CW, history, contact, 'CW', contact?.mode === 'CW')
  const actualMode = normalizeMode(candidate.mode)
  const mode = actualMode
    ? {
        mode: actualMode,
        ...needStatus(
          target,
          progressForMode(history, actualMode),
          progressForMode(contact ? [...history, contact] : history, actualMode),
          history,
          contact,
          actualMode,
          contact?.mode === actualMode,
        ),
      }
    : undefined
  const messages =
    eligibility === 'unavailable-event'
      ? [ELIGIBILITY_MESSAGES[eligibility]]
      : [
          ...(eligibility === 'eligible' ? [] : [ELIGIBILITY_MESSAGES[eligibility]]),
          cw.message,
          mixed.message,
          ...(mode && mode.mode !== 'CW' ? [mode.message] : []),
        ]
  return {
    target,
    label: target.label,
    messages,
    eligibility,
    mixed,
    cw,
    ...(mode ? { mode } : {}),
  }
}
