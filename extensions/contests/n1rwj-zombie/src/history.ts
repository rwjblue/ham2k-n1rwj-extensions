// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { HookContext, JSONValue } from '@ham2k/extension-sdk'
import { createHistoryAdapter } from '../../../../packages/contest-history/src/index.ts'
import { callLookupKeys, normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
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

/** Bonus assignments expire with their event. Unknown event provenance gets
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
    async suggestions(operation: Qson, qso: Qson, ctx: HookContext): Promise<ZombieSuggestions> {
      const keys = callLookupKeys(text(object(qso.their).call))
      if (!keys.length || !refOf(operation)) return {}
      const { currentOperation, olderHistory } = await adapter.find(operation, qso, ctx)
      const eventYear = yearOf(refOf(operation))
      const recentFirst = (entries: ZombieHistoryEntry[]) =>
        entries.sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0))
      const result: ZombieSuggestions = {}
      const sources = [
        { entries: recentFirst(currentOperation), current: true },
        // Exchanges copied during this event take priority over older events.
        {
          entries: recentFirst(olderHistory.filter((entry) => entry.eventYear === eventYear)),
          current: false,
        },
        {
          entries: recentFirst(olderHistory.filter((entry) => entry.eventYear !== eventYear)),
          current: false,
        },
      ]
      for (const source of sources) {
        for (const key of keys) {
          for (const entry of source.entries) {
            if (entry.call !== key) continue
            if (!result.zombieName && entry.zombieName) result.zombieName = entry.zombieName
            const number = source.current
              ? entry.zombieNumber
              : historicalNumber(entry.zombieNumber, entry.eventYear, eventYear)
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
