// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type Member, memberNumber, memberSuffix, type Roster } from './model.ts'

export const ROSTER_URL = 'https://www.skccgroup.com/skimmer-data.txt'
export const RICH_ROSTER_URL = 'https://www.skccgroup.com/membership_data/skccdata.txt'
const required = [
  'SKCCNR',
  'CALL',
  'NAME',
  'SPC',
  'OLDCALL',
  'DXCODE',
  'JOINDATE',
  'CENTDATE',
  'TRIBDATE',
  'TX8DATE',
  'SENDATE',
]
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const historicalSuffix = /\/(?:SK|EX)$/

export function normalizeCall(value: string): string {
  return value.trim().toUpperCase()
}
export function validCall(value: string): boolean {
  return value.length <= 64 && /^(?=.*[A-Z])(?=.*\d)[A-Z\d]+(?:\/[A-Z\d]+)*$/.test(value)
}

/** Preserve /SK and /EX as historical markers, never as portable suffixes. */
export function callKeys(value: string): string[] {
  const call = normalizeCall(value)
  if (!validCall(call)) return []
  const parts = call.split('/')
  if (parts.some((part) => part === 'SK' || part === 'EX')) return [call]
  const candidates = parts.filter((part) => /^(?=.*[A-Z])[A-Z\d]*\d[A-Z]+$/.test(part))
  return candidates.length === 1 && candidates[0] !== call ? [call, candidates[0]] : [call]
}

function date(value: string, row: number): string | undefined {
  if (!value) return undefined
  const match = value.match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/)
  const month = months.indexOf(match?.[2] ?? '')
  if (!match || month < 0) throw new Error(`Invalid SKCC date on row ${row}`)
  const day = Number(match[1])
  const year = Number(match[3])
  const parsed = new Date(Date.UTC(year, month, day))
  if (
    year < 2000 ||
    year > 2100 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  )
    throw new Error(`Invalid SKCC date on row ${row}`)
  return parsed.toISOString().slice(0, 10)
}

function hash(body: string): string {
  let result = 2166136261
  for (let index = 0; index < body.length; index++)
    result = Math.imul(result ^ body.charCodeAt(index), 16777619)
  return (result >>> 0).toString(16)
}

/** Both published pipe-delimited schemas are mapped by header, not position. */
export function parseRoster(
  body: string,
  options: { source?: string; downloadedAt?: number } = {},
): Roster {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject embedded control bytes in downloaded data.
  if (!body || body.length > 8_000_000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body))
    throw new Error('Invalid SKCC roster body')
  const lines = body
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
  if (lines.length < 2 || lines.length > 100_001) throw new Error('Invalid SKCC roster length')
  const headers = lines[0].split('|').map((field) => field.trim().toUpperCase())
  if (
    new Set(headers).size !== headers.length ||
    required.some((field) => !headers.includes(field)) ||
    (!headers.includes('MBRSTATUS') &&
      !['QTH', 'SKCC', 'DXENTITY'].every((field) => headers.includes(field)))
  )
    throw new Error('Unsupported SKCC roster header')
  const members: Member[] = []
  const numbers = new Set<string>()
  for (let index = 1; index < lines.length; index++) {
    if (!lines[index].trim()) continue
    const fields = lines[index].split('|').map((field) => field.trim())
    const row = index + 1
    if (fields.length !== headers.length || fields.some((field) => field.length > 1000))
      throw new Error(`Invalid SKCC fields on row ${row}`)
    const entry = Object.fromEntries(headers.map((key, column) => [key, fields[column]]))
    const number = memberNumber(entry.SKCCNR)
    if (!number || numbers.has(number))
      throw new Error(`Invalid or duplicate SKCC number on row ${row}`)
    numbers.add(number)
    // The rich public file deliberately redacts inactive rows to these tokens.
    const redacted =
      !headers.includes('MBRSTATUS') &&
      entry.CALL === 'call' &&
      entry.NAME === 'name' &&
      entry.SPC === 'spc' &&
      entry.OLDCALL === 'oldcall' &&
      entry.SKCC === 'skcc'
    const call = redacted ? '' : normalizeCall(entry.CALL)
    // Some current downloads mark /EX and even /SK rows as A. Historical
    // call markers still rule out an active spotting identity, including aliases.
    const status =
      redacted || call.endsWith('/EX') ? 'IA' : call.endsWith('/SK') ? 'SK' : entry.MBRSTATUS || 'A'
    if (
      !['A', 'IA', 'SK'].includes(status) ||
      (headers.includes('MBRSTATUS') && !['A', 'IA', 'SK'].includes(entry.MBRSTATUS)) ||
      (!redacted && !validCall(call) && !(status === 'IA' && /^[A-Z0-9-]{1,64}$/.test(call))) ||
      (status === 'A' && (!entry.NAME || historicalSuffix.test(call))) ||
      (!redacted && !/^[A-Z0-9 -]{1,32}$/i.test(entry.SPC))
    )
      throw new Error(`Invalid SKCC identity on row ${row}`)
    const oldCalls =
      redacted || !entry.OLDCALL ? [] : [...new Set(entry.OLDCALL.split(',').map(normalizeCall))]
    if (oldCalls.some((alias) => !validCall(alias)))
      throw new Error(`Invalid SKCC other call on row ${row}`)
    if (!redacted && entry.SKCC && memberNumber(entry.SKCC) !== number)
      throw new Error(`Conflicting SKCC number on row ${row}`)
    if (entry.DXCODE && !/^\d{1,3}$/.test(entry.DXCODE))
      throw new Error(`Invalid SKCC entity on row ${row}`)
    members.push({
      number,
      call,
      name: redacted ? '' : entry.NAME,
      spc: redacted ? '' : entry.SPC.toUpperCase(),
      qth: redacted ? '' : (entry.QTH ?? ''),
      suffix: memberSuffix(entry.SKCCNR),
      oldCalls,
      status: status as Member['status'],
      joinDate: date(entry.JOINDATE, row),
      centurionDate: date(entry.CENTDATE, row),
      tribuneDate: date(entry.TRIBDATE, row),
      tx8Date: date(entry.TX8DATE, row),
      senatorDate: date(entry.SENDATE, row),
      dxcc: entry.DXCODE ? String(Number(entry.DXCODE)) : undefined,
    })
  }
  if (!members.length) throw new Error('Empty SKCC roster')
  const downloadedAt = options.downloadedAt ?? Date.now()
  if (!Number.isSafeInteger(downloadedAt) || downloadedAt < 0 || downloadedAt > 8640000000000000)
    throw new Error('Invalid SKCC download time')
  const roster = {
    members,
    downloadedAt,
    source: options.source ?? ROSTER_URL,
    revision: hash(body),
  }
  indexRoster(roster)
  return roster
}

interface Index {
  byNumber: Map<string, Member>
  byCall: Map<string, Set<Member>>
}
const indexes = new WeakMap<Roster, Index>()
function indexRoster(roster: Roster): Index {
  const previous = indexes.get(roster)
  if (previous) return previous
  const byNumber = new Map<string, Member>()
  const byCall = new Map<string, Set<Member>>()
  for (const member of roster.members) {
    byNumber.set(member.number, member)
    for (const call of [member.call, ...member.oldCalls]) {
      if (!validCall(call)) continue
      const matches = byCall.get(call) ?? new Set<Member>()
      matches.add(member)
      byCall.set(call, matches)
    }
  }
  const index = { byNumber, byCall }
  indexes.set(roster, index)
  return index
}

/** Resolve only unambiguous identities. Explicit exchanged numbers can resolve
 * reused calls and new calls, but cannot contradict an identified station. */
export function lookupMember(
  roster: Roster | undefined,
  call: string,
  number?: unknown,
): Member | undefined {
  if (!roster) return undefined
  const keys = callKeys(call)
  const index = indexRoster(roster)
  let matches: Set<Member> | undefined
  for (const key of keys) {
    matches = index.byCall.get(key)
    if (matches) break
  }
  if (number !== undefined) {
    const normalized = memberNumber(number)
    const member = normalized ? index.byNumber.get(normalized) : undefined
    return member && (!matches || matches.has(member)) ? member : undefined
  }
  return matches?.size === 1 ? matches.values().next().value : undefined
}
