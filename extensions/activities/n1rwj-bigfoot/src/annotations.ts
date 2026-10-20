import type { CallInfoLookup, LookupHook } from '@ham2k/extension-sdk'
import { eventFromOperation } from './activity.ts'
import { targetInfoNotes } from './info.ts'
import type { Qson } from './rules.ts'
import { targetForCall } from './targets.ts'

// The host's own call-notes extension uses these extra fields for its compact
// call-info line and native Spots marker. Detailed notes remain separate.
type StationAnnotation = CallInfoLookup & { note?: string; emoji?: string }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function object(value: unknown): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Qson) : {}
}

function timestamp(qso: Qson): number | undefined {
  if ('startAtMillis' in qso)
    return typeof qso.startAtMillis === 'number' && Number.isFinite(qso.startAtMillis)
      ? qso.startAtMillis
      : undefined
  if ('startAt' in qso) {
    const value = text(qso.startAt)
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    )
      return undefined
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return Date.now()
}

export const BigfootLookup: LookupHook = {
  async lookupCall({ callInfo, operation, qso }) {
    const event = eventFromOperation(operation)
    if (!event) return []
    const their = object(qso.their)
    // A cleared or corrected call is authoritative, even while callInfo still
    // contains the preceding lookup. Spots passes an empty qso and uses callInfo.
    const target = targetForCall('call' in their ? their.call : callInfo.call)
    const at = timestamp(qso)
    if (!target || at === undefined || at < event.startAtMillis || at >= event.endAtMillis)
      return []
    const emoji = target.bonus ? '🦨' : '🐾'
    const result: StationAnnotation = {
      call: target.call,
      source: 'n1rwj-bigfoot',
      scope: 'operation',
      note: `${emoji} ${target.label}`,
      emoji,
      notes: targetInfoNotes(target),
    }
    return [result]
  },
}
