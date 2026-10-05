import type { JSONValue, OperationSegmentPayload } from '@ham2k/extension-sdk'
import { operationOrigin, watchedCall } from '../config.ts'
import { record } from '../data/parser.ts'
import { isValidCall } from '../model.ts'
import type { EvidenceRequest, RbnEvidence } from './evidence.ts'

const marginMs = 5 * 60_000
export function millis(value: JSONValue | undefined): number | undefined {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 8.64e15 ? parsed : undefined
}

/** Log bounds are a useful approximation, not evidence of CQ/PTT activity. */
export function receptionScope(
  operation: Record<string, JSONValue>,
  qsos: readonly Record<string, JSONValue>[],
  now: number,
  saved?: RbnEvidence | null,
  segments?: OperationSegmentPayload[],
): { request: EvidenceRequest; warnings: string[] } | null {
  const call = watchedCall(operation, '')
  if (!isValidCall(call)) return null
  const times = qsos
    .filter((qso) => !qso.deleted)
    .flatMap((qso) => {
      const own = record(qso.our)?.call
      if (typeof own === 'string' && own.trim().toUpperCase() !== call) return []
      const start = millis(qso.startAtMillis) ?? millis(qso.startAt)
      const end = millis(qso.endAtMillis) ?? millis(qso.endAt) ?? start
      return start !== undefined && end !== undefined && start <= now && end >= start
        ? [start, end]
        : []
    })
  const starts = times.length ? [Math.max(0, Math.min(...times) - marginMs)] : []
  const ends = times.length ? [Math.min(now, Math.max(...times) + marginMs)] : []
  if (saved?.request.call === call) {
    starts.push(saved.request.startMs)
    ends.push(Math.min(now, saved.request.endMs))
  }
  if (!starts.length || !ends.length) return null
  const startMs = Math.min(...starts)
  const endMs = Math.max(...ends)
  if (endMs <= startMs) return null
  const origin = operationOrigin(operation, '')
  const locations = [operation, ...(segments ?? []).map((segment) => segment.operation)]
    .map((op) => operationOrigin(op, ''))
    .filter((location) => location !== undefined)
  const moving = locations.some(
    (location) =>
      origin && (location.latitude !== origin.latitude || location.longitude !== origin.longitude),
  )
  return {
    request: {
      operationId: String(operation.uuid ?? `${call}:${startMs}`),
      call,
      startMs,
      endMs,
      ...(origin && !moving ? { origin } : {}),
    },
    warnings: [
      'The requested interval covers logged contacts with a five-minute margin and saved visible-panel observations. It does not identify when CQ was called.',
      ...(moving
        ? [
            'Operation segments have different locations; a single transmitter origin and distance summary are omitted.',
          ]
        : []),
    ],
  }
}
