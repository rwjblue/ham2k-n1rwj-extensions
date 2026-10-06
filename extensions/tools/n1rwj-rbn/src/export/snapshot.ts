import type { JSONValue } from '@ham2k/extension-sdk'
import { operationOrigin } from '../config.ts'
import type { RbnSnapshot } from '../model.ts'
import {
  emptyEvidence,
  evidenceLimits,
  type RbnEvidence,
  type RbnEvidenceReport,
} from './evidence.ts'

/** A snapshot is callsign-scoped context, not proof of operation-wide collection. */
export function evidenceFromSnapshots(
  operation: Record<string, JSONValue>,
  call: string,
  snapshots: readonly RbnSnapshot[],
  now: number,
): RbnEvidence | null {
  const selected = snapshots
    .filter((snapshot) => snapshot.call === call && snapshot.lastSuccessMs !== null)
    .slice(0, 8)
    .sort((a, b) => (a.lastSuccessMs ?? 0) - (b.lastSuccessMs ?? 0))
  if (!selected.length) return null
  const first = Math.min(
    ...selected.map(
      (snapshot) => (snapshot.lastSuccessMs ?? now) - snapshot.windowMinutes * 60_000,
    ),
  )
  const last = Math.min(now, Math.max(...selected.map((snapshot) => snapshot.lastSuccessMs ?? now)))
  if (first <= 0 || last <= first) return null
  const origin = operationOrigin(operation, '')
  const evidence = emptyEvidence(
    {
      operationId: String(operation.uuid ?? `${call}:${first}`),
      call,
      startMs: first,
      endMs: last,
      ...(origin ? { origin } : {}),
    },
    last,
  )
  const reports = new Map<string, RbnEvidenceReport>()
  for (const snapshot of selected) {
    for (const report of snapshot.reports) {
      if (report.call !== call || report.timeMs < first || report.timeMs > last) continue
      reports.set(report.id, {
        ...report,
        // The rolling cache discarded raw provider rows and the original locator.
        // Never manufacture either from normalized measurements.
        raw: {},
        retrievedAtMs: snapshot.lastSuccessMs ?? last,
        firstSeenMs: snapshot.lastSuccessMs ?? last,
        lastSeenMs: snapshot.lastSuccessMs ?? last,
        retrievalKind: 'snapshot',
        receiverGrid: null,
        receiverLocationSource:
          report.receiverLatitude !== null && report.receiverLongitude !== null
            ? 'cached-coordinates'
            : null,
      })
    }
  }
  return {
    ...evidence,
    collectionSource: 'snapshot',
    reports: [...reports.values()].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id)),
    warnings: [
      'This export uses rolling My Signal snapshots for the exact station callsign. The cache is not operation-scoped and may include observations collected during another operation; it is not a complete activation archive.',
      'Cached observations contain normalized measurements only. Original provider rows, original receiver grids, and earlier retrieval times are unavailable; raw objects are empty and retrievalKind is snapshot.',
      'Enable Save reception evidence in My Signal panel settings to opt in to bounded raw observation recording while that panel is visible. Exporting never starts a history request.',
      ...selected.flatMap((snapshot) => [
        ...(snapshot.capped ? ['A cached panel snapshot reached its 500-report limit.'] : []),
        ...(snapshot.error ? [snapshot.error] : []),
        ...(snapshot.storageWarning ? [snapshot.storageWarning] : []),
      ]),
    ],
  }
}

/** Retain authoritative raw archive rows; supplement gaps with labelled cache rows. */
export function mergeEvidenceSnapshot(
  archived: RbnEvidence | null,
  snapshot: RbnEvidence | null,
): RbnEvidence | null {
  if (!archived) return snapshot
  if (!snapshot?.reports.length) return { ...archived, collectionSource: 'archive' }
  const reports = new Map(archived.reports.map((report) => [report.id, report]))
  const warnings = new Set(archived.warnings)
  let characters = archived.reports.reduce((sum, report) => sum + JSON.stringify(report).length, 0)
  let added = 0
  for (const report of snapshot.reports) {
    if (reports.has(report.id)) continue
    const size = JSON.stringify(report).length
    if (
      reports.size >= evidenceLimits.reports ||
      characters + size > evidenceLimits.observationCharacters
    ) {
      warnings.add(
        'The observation archive limit was reached while supplementing saved evidence; some cached reports were omitted.',
      )
      continue
    }
    reports.set(report.id, report)
    characters += size
    added++
  }
  if (!added) return { ...archived, collectionSource: 'archive', warnings: [...warnings] }
  for (const warning of snapshot.warnings) warnings.add(warning)
  warnings.add(
    'Saved operation evidence is supplemented with normalized cached reports. Archived provider rows take precedence when the same observation ID appears in both sources.',
  )
  return {
    ...archived,
    collectionSource: 'archive-and-snapshot',
    retrievedAtMs: Math.max(archived.retrievedAtMs, snapshot.retrievedAtMs),
    request: {
      ...archived.request,
      startMs: Math.min(archived.request.startMs, snapshot.request.startMs),
      endMs: Math.max(archived.request.endMs, snapshot.request.endMs),
    },
    reports: [...reports.values()].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id)),
    warnings: [...warnings],
  }
}
