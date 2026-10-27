// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { JSONValue } from '@ham2k/extension-sdk'

export const KEY = 'n1rwj-bkg'
export const ROSTER_URL = 'https://www.bkg.club/data/v2/roster.json'
export const DAY = 86_400_000
export type Qson = Record<string, JSONValue>
export function object(value: unknown): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Qson) : {}
}
export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
export function normalizeCall(value: unknown): string {
  return text(value).toUpperCase()
}
export function callKeys(value: unknown): string[] {
  const call = normalizeCall(value)
  if (
    call.length > 64 ||
    !/^(?=.*[A-Z])(?=.*\d)[A-Z\d]+(?:\/[A-Z\d]+)*$/.test(call) ||
    call.split('/').some((part) => part === 'SK' || part === 'EX')
  )
    return []
  const candidates = call.split('/').filter((part) => /^(?=.*[A-Z])[A-Z\d]*\d[A-Z]+$/.test(part))
  return candidates.length === 1 && candidates[0] !== call ? [call, candidates[0]] : [call]
}
export function holderFor(call: unknown): string | undefined {
  const keys = callKeys(call)
  return keys[keys.length - 1]
}
export interface Member {
  number: number
  call: string
  name: string
  qth: string
  sponsor: number | null
}
export interface Roster {
  members: Member[]
  byCall: Map<string, Member>
  byNumber: Map<number, Member>
  revision: string
  generatedAt: number
  downloadedAt: number
}
export type RosterGetter = () => Roster | undefined
export function findMember(roster: Roster | undefined, call: unknown): Member | undefined {
  for (const key of callKeys(call)) {
    const member = roster?.byCall.get(key)
    if (member) return member
  }
  return undefined
}

/** A saved lookup belongs to that callsign, never a later edit to another call.
 * Keep its stable member number across a rename or callsign reassignment. */
export function memberForQso(roster: Roster | undefined, qso: Qson): Member | undefined {
  const their = object(qso.their)
  const recorded = object(object(their.guess).n1rwjBkg)
  if (
    typeof recorded.number === 'number' &&
    callKeys(their.call).some((call) => callKeys(recorded.call).includes(call))
  ) {
    const member = roster?.byNumber.get(recorded.number)
    if (member) return member
  }
  return findMember(roster, their.call)
}

export function isQualifyingContact(qso: Qson): boolean {
  return (
    !qso.deleted &&
    text(qso.band).toLowerCase() === '2m' &&
    normalizeCall(qso.mode) === 'CW' &&
    Boolean(holderFor(object(qso.their).call))
  )
}

export function workedMembers(qsos: Qson[], roster: Roster | undefined): Set<number> {
  return new Set(
    qsos.flatMap((qso) => {
      const member = isQualifyingContact(qso) ? memberForQso(roster, qso) : undefined
      return member && member.number !== findMember(roster, object(qso.our).call)?.number
        ? [member.number]
        : []
    }),
  )
}
