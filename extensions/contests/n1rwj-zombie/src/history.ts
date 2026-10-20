// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { HookContext, JSONValue } from '@ham2k/extension-sdk'
import { createHistoryAdapter } from '../../../../packages/contest-history/src/index.ts'
import { callLookupKeys, normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
import { parseN1mm } from '../../../../packages/n1mm/src/parse.ts'
import type { LoadedFile } from './data.ts'
import { normalizeZombieNumber, validZombieNumber } from './exchange.ts'

type Qson = Record<string, JSONValue>
export interface ZombieHistoryEntry {
  call: string
  spc?: string
  zombieNumber?: string
  zombieName?: string
  eventYear?: number
  timestamp?: number
}
export interface ZombieHistoryFile {
  records: Record<string, ZombieHistoryEntry>
  count: number
  warnings: number
  sourceUpdatedAt?: string
  sourceYear?: number
}
export type ZombieSuggestions = Pick<ZombieHistoryEntry, 'spc' | 'zombieNumber' | 'zombieName'>

const KNOWN_BONUS_NUMBERS: Record<number, string> = { 2025: '3333', 2026: '4321' }
const text = (value: JSONValue | undefined): string => (typeof value === 'string' ? value : '')
const object = (value: JSONValue | undefined): Qson =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const cleanText = (value: string | undefined): string =>
  (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
const cleanNumber = (value: string | undefined): string => {
  const normalized = normalizeZombieNumber(value)
  return validZombieNumber(normalized) ? normalized : ''
}
function refOf(value: Qson): Qson | undefined {
  return Array.isArray(value.refs)
    ? value.refs.map(object).find((ref) => ref.type === 'zombie')
    : undefined
}
function yearOf(ref: Qson | undefined): number | undefined {
  const year = text(ref?.ref)
  return /^\d{4}$/.test(year) ? Number(year) : undefined
}

/** Bonus assignments expire with their event. Unknown file provenance gets
 * conservative suggestions; an explicitly copied current-operation number
 * never passes through this filter. A later ordinary assignment of 3333 is
 * therefore retained when its known source year uses a different bonus. */
export function historicalNumber(
  value: string | undefined,
  sourceYear: number | undefined,
  eventYear: number | undefined,
): string {
  const number = cleanNumber(value)
  if (!number) return ''
  if (sourceYear === undefined)
    return Object.values(KNOWN_BONUS_NUMBERS).some((bonus) => Number(bonus) === Number(number))
      ? ''
      : number
  return sourceYear !== eventYear && Number(KNOWN_BONUS_NUMBERS[sourceYear]) === Number(number)
    ? ''
    : number
}

/** N1MM Name is the spooky name, Exch1 the number, MISC the SPC. The source
 * year is known for the verified 18 October 2025 edition, not inferred from
 * the download date or the revision suffix. New editions remain undated
 * unless their own comment explicitly identifies their event year. */
export function parseZombieHistory(body: string, eventYear = 2026): ZombieHistoryFile {
  if (body.length > 5_000_000 || /<(?:!doctype|html|body|script|form)\b/i.test(body))
    throw new Error('Invalid Zombie call-history text. Previous data retained.')
  const parsed = parseN1mm(body)
  if (!parsed.usable || parsed.issues.some((issue) => issue.code === 'invalid-row'))
    throw new Error('Invalid Zombie call-history file. Previous data retained.')
  if (parsed.associations.length)
    throw new Error('This call-history file belongs to another contest. Previous data retained.')
  const explicitYear = /^\s*#\s*ZOMBIE(?:\s+SHUFFLE)?\s*[,;:-]?\s*(20\d{2})\s*$/im.exec(body)?.[1]
  const sourceYear = explicitYear
    ? Number(explicitYear)
    : parsed.sourceUpdatedAt === '2025-10-18' && /^\s*#\s*ZOMBIE\s*$/im.test(body)
      ? 2025
      : undefined
  const records: Record<string, ZombieHistoryEntry> = Object.create(null) as Record<
    string,
    ZombieHistoryEntry
  >
  let warnings = parsed.issues.length
  for (const row of parsed.rows) {
    const zombieName = cleanText(row.fields.name)
    const spc = cleanText(row.fields.misc)
    const number = cleanNumber(row.fields.exch1)
    if (row.fields.exch1?.trim() && !number) warnings++
    const zombieNumber = historicalNumber(number, sourceYear, eventYear)
    records[row.call] = {
      ...records[row.call],
      call: row.call,
      ...(zombieName ? { zombieName } : {}),
      ...(spc ? { spc } : {}),
      ...(number ? { zombieNumber } : {}),
    }
  }
  return {
    records,
    count: Object.keys(records).length,
    warnings,
    ...(parsed.sourceUpdatedAt ? { sourceUpdatedAt: parsed.sourceUpdatedAt } : {}),
    ...(sourceYear ? { sourceYear } : {}),
  }
}

export function zombieHistoryContact(qso: Qson): ZombieHistoryEntry | undefined {
  const ref = refOf(qso)
  if (!ref || qso.deleted || qso.band === 'event') return undefined
  const call = normalizeCall(text(object(qso.their).call))
  if (!call) return undefined
  return {
    call,
    spc: cleanText(text(ref.theirSpc)),
    zombieNumber: cleanNumber(text(ref.theirZombieNumber)),
    zombieName: cleanText(text(ref.theirZombieName)),
    eventYear: yearOf(object(object(qso.our).zombie)) ?? yearOf(ref),
    timestamp: typeof qso.startAtMillis === 'number' ? qso.startAtMillis : undefined,
  }
}

/** Targeted callsign history plus the bounded shared operation cache. Nothing
 * here fetches a file or reads the full log for every draft change. */
export function createZombieHistory() {
  const adapter = createHistoryAdapter({ refType: 'zombie', toContact: zombieHistoryContact })
  return {
    update: adapter.update,
    async suggestions(
      operation: Qson,
      qso: Qson,
      ctx: HookContext,
      file?: LoadedFile,
    ): Promise<ZombieSuggestions> {
      const keys = callLookupKeys(text(object(qso.their).call))
      if (!keys.length || !refOf(operation)) return {}
      const { currentOperation, olderHistory } = await adapter.find(operation, qso, ctx)
      const eventYear = yearOf(refOf(operation))
      const recentFirst = (entries: ZombieHistoryEntry[]) =>
        entries.sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))
      const fileEntries = keys
        .map((key) => file?.parsed.records[key])
        .filter((entry): entry is ZombieHistoryEntry => entry !== undefined)
      const result: ZombieSuggestions = {}
      const sources = [
        { entries: recentFirst(currentOperation), current: true, file: false },
        // A copied exchange from this event is fresher than last year's file.
        {
          entries: recentFirst(olderHistory.filter((entry) => entry.eventYear === eventYear)),
          current: false,
          file: false,
        },
        { entries: fileEntries, current: false, file: true },
        {
          entries: recentFirst(olderHistory.filter((entry) => entry.eventYear !== eventYear)),
          current: false,
          file: false,
        },
      ]
      for (const source of sources) {
        for (const key of keys) {
          for (const entry of source.entries) {
            if (entry.call !== key) continue
            if (!result.zombieName && entry.zombieName) result.zombieName = entry.zombieName
            const number = source.current
              ? entry.zombieNumber
              : historicalNumber(
                  entry.zombieNumber,
                  source.file ? file?.parsed.sourceYear : entry.eventYear,
                  eventYear,
                )
            if (!result.zombieNumber && number) result.zombieNumber = number
            // Portable operation can change SPC; only identity fields fall
            // back to the base callsign's history.
            if (key === keys[0] && !result.spc && entry.spc) result.spc = entry.spc
          }
        }
      }
      return result
    },
  }
}
