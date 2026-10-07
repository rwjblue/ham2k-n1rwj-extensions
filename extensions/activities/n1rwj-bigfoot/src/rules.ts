import type { JSONValue } from '@ham2k/extension-sdk'

export type Qson = Record<string, JSONValue>
export type EventMode = 'CW' | 'SSB' | 'FT8' | 'FT4' | 'RTTY'
export type ModeGroup = 'CW' | 'PHONE' | 'DIGITAL'
export type ProgressMode = 'MIXED' | ModeGroup

export interface BigfootEvent {
  readonly year: number
  readonly startAtMillis: number
  readonly endAtMillis: number
  readonly bands: readonly string[]
}

// Published 2026 rules:
// https://w7dk.org/?view=article&id=319:3rd-annual-national-sasquatch-day-special-event&catid=185
// End is exclusive: the announced final minute is October 21, 23:59 UTC.
export const EVENT_2026: BigfootEvent = {
  year: 2026,
  startAtMillis: Date.UTC(2026, 9, 13),
  endAtMillis: Date.UTC(2026, 9, 22),
  bands: ['80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'],
}

export const TARGET_SLOTS = [
  { letter: 'B', call: 'W7B' },
  { letter: 'I', call: 'W7I' },
  { letter: 'G', call: 'W7G' },
  { letter: 'F', call: 'W7F' },
  { letter: 'O', call: 'W7O' },
  { letter: 'O', call: 'W7O' },
  { letter: 'T', call: 'W7T' },
] as const

export const EVENT_MODES: readonly EventMode[] = ['CW', 'SSB', 'FT8', 'FT4', 'RTTY']

export type Contact = {
  uuid: string
  call: string
  band: string
  mode: EventMode
  modeGroup: ModeGroup
  at: number
  utcDate: string
  sentReport: string
  receivedReport: string
}

export interface ProgressSlot {
  letter: string
  call: string
  contact?: Contact
}

export interface Progress {
  mode: string
  slots: ProgressSlot[]
  worked: number
  complete: boolean
  bonus?: Contact
}

function text(value: JSONValue | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function object(value: JSONValue | undefined): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function eventForYear(year: unknown): BigfootEvent | undefined {
  return year === 2026 || (typeof year === 'string' && year.trim() === '2026')
    ? EVENT_2026
    : undefined
}

export function normalizeMode(value: unknown): EventMode | undefined {
  if (typeof value !== 'string') return undefined
  const mode = value.trim().toUpperCase()
  if (['CW', 'CW-R', 'CW-LSB', 'CW-USB'].includes(mode)) return 'CW'
  if (['SSB', 'USB', 'LSB'].includes(mode)) return 'SSB'
  if (['RTTY', 'RTTY-R', 'RTTY-LSB', 'RTTY-USB'].includes(mode)) return 'RTTY'
  if (mode === 'FT8' || mode === 'FT4') return mode
  return undefined
}

function groupForMode(mode: EventMode): ModeGroup {
  return mode === 'CW' ? 'CW' : mode === 'SSB' ? 'PHONE' : 'DIGITAL'
}

function contactTime(qso: Qson): number | undefined {
  // An explicit but invalid numeric timestamp is not repaired from another
  // field: the record needs correction before it can establish event credit.
  if ('startAtMillis' in qso) {
    return typeof qso.startAtMillis === 'number' && Number.isFinite(qso.startAtMillis)
      ? qso.startAtMillis
      : undefined
  }
  const value = text(qso.startAt)
  // Reject local-time strings, whose interpretation would depend on device TZ.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareContacts(a: Contact, b: Contact): number {
  return (
    a.at - b.at ||
    compareText(a.call, b.call) ||
    compareText(a.band, b.band) ||
    compareText(a.mode, b.mode) ||
    compareText(a.uuid, b.uuid)
  )
}

export function qualifyingContacts(qsos: readonly Qson[], event: BigfootEvent): Contact[] {
  const records = new Map<string, Qson>()
  const unkeyed: Qson[] = []
  for (const qso of qsos) {
    const uuid = text(qso.uuid)
    // A repeated UUID is one record. If callers supply revisions, the last
    // revision wins, including an edit to an ineligible call or a deletion.
    if (uuid) records.set(uuid, qso)
    else unkeyed.push(qso)
  }

  const contacts = new Map<string, Contact>()
  for (const qso of [...records.values(), ...unkeyed]) {
    if (qso.deleted || qso.event) continue
    const their = object(qso.their)
    const call = text(their.call).toUpperCase()
    if (call !== 'W4S' && !TARGET_SLOTS.some((slot) => slot.call === call)) continue
    const band = text(qso.band).toLowerCase()
    const mode = normalizeMode(qso.mode)
    const at = contactTime(qso)
    if (
      !event.bands.includes(band) ||
      !mode ||
      at === undefined ||
      at < event.startAtMillis ||
      at >= event.endAtMillis
    )
      continue
    const uuid = text(qso.uuid) || `contact:${call}|${at}|${band}|${mode}`
    contacts.set(uuid, {
      uuid,
      call,
      band,
      mode,
      modeGroup: groupForMode(mode),
      at,
      utcDate: new Date(at).toISOString().slice(0, 10),
      sentReport: text(object(qso.our).sent),
      receivedReport: text(their.sent),
    })
  }
  return [...contacts.values()].sort(compareContacts)
}

function distinctSecondO(first: Contact, second: Contact): boolean {
  return (
    first.uuid !== second.uuid &&
    (first.band !== second.band || first.mode !== second.mode || first.utcDate !== second.utcDate)
  )
}

function progress(contacts: readonly Contact[], label: string): Progress {
  const sorted = [...new Map(contacts.map((contact) => [contact.uuid, contact])).values()].sort(
    compareContacts,
  )
  const firstO = sorted.find((contact) => contact.call === 'W7O')
  const secondO = firstO
    ? sorted.find((contact) => contact.call === 'W7O' && distinctSecondO(firstO, contact))
    : undefined
  const slots = TARGET_SLOTS.map((slot, index): ProgressSlot => {
    const contact =
      slot.call === 'W7O'
        ? index === 4
          ? firstO
          : secondO
        : sorted.find((candidate) => candidate.call === slot.call)
    return { ...slot, ...(contact ? { contact } : {}) }
  })
  const worked = slots.filter((slot) => slot.contact).length
  const bonus = sorted.find((contact) => contact.call === 'W4S')
  return { mode: label, slots, worked, complete: worked === 7, ...(bonus ? { bonus } : {}) }
}

export function progressForContacts(contacts: readonly Contact[], mode: ProgressMode): Progress {
  return progress(
    mode === 'MIXED' ? contacts : contacts.filter((contact) => contact.modeGroup === mode),
    mode,
  )
}

export function buildProgress(contacts: readonly Contact[]): Record<ProgressMode, Progress> {
  return {
    MIXED: progressForContacts(contacts, 'MIXED'),
    CW: progressForContacts(contacts, 'CW'),
    PHONE: progressForContacts(contacts, 'PHONE'),
    DIGITAL: progressForContacts(contacts, 'DIGITAL'),
  }
}

// Optional per-mode breakdown alongside the Digital family total.
export function progressForMode(contacts: readonly Contact[], mode: EventMode): Progress {
  return progress(
    contacts.filter((contact) => contact.mode === mode),
    mode,
  )
}

export function sameModeProgress(contacts: readonly Contact[]): Record<EventMode, Progress> {
  return {
    CW: progressForMode(contacts, 'CW'),
    SSB: progressForMode(contacts, 'SSB'),
    FT8: progressForMode(contacts, 'FT8'),
    FT4: progressForMode(contacts, 'FT4'),
    RTTY: progressForMode(contacts, 'RTTY'),
  }
}
