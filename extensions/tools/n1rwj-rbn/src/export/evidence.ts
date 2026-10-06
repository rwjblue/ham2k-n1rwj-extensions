import type { JSONValue } from '@ham2k/extension-sdk'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import { parseRbnPayload, receiverLocation, record } from '../data/parser.ts'
import { isValidCall, normalizeCall, type RbnReport } from '../model.ts'

export const evidenceLimits = {
  reports: 4000,
  archives: 4,
  attempts: 512,
  pages: 8,
  pageSize: 500,
  responseCharacters: 1_000_000,
  archiveCharacters: 12_000_000,
  observationCharacters: 2_000_000,
  budgetMs: 12_000,
  pageTimeoutMs: 4000,
  reuseMs: 300_000,
} as const

export interface EvidenceRequest {
  operationId: string
  call: string
  startMs: number
  endMs: number
  origin?: { latitude: number; longitude: number; label?: string }
}

export type RetrievalKind = 'history' | 'live' | 'snapshot'
export interface RbnEvidenceReport extends RbnReport {
  raw: Record<string, JSONValue>
  retrievedAtMs: number
  firstSeenMs: number
  lastSeenMs: number
  retrievalKind: RetrievalKind
  receiverGrid: string | null
  receiverLocationSource: 'provider-grid' | 'rbn-directory' | 'cached-coordinates' | null
}

export interface RbnRetrievalPage {
  offset: number
  startedAtMs: number
  completedAtMs: number
  status: number | null
  total: number | null
  receivedRows: number
  acceptedRows: number
  duplicateRows: number
  filteredRows: number
  invalidRows: number
  error: string | null
}

export interface RbnRetrievalAttempt {
  id: string
  kind: RetrievalKind
  request: EvidenceRequest
  startedAtMs: number
  completedAtMs: number
  pages: RbnRetrievalPage[]
  complete: boolean
  stopReason: 'complete' | 'live' | 'page-limit' | 'report-limit' | 'budget' | 'error' | 'offline'
  errors: string[]
}

export interface RbnEvidence {
  schemaVersion: 1
  provider: 'vail-rerbn'
  collectionSource?: 'archive' | 'snapshot' | 'archive-and-snapshot'
  request: EvidenceRequest
  retrievedAtMs: number
  reports: RbnEvidenceReport[]
  attempts: RbnRetrievalAttempt[]
  /** Complete pagination of this requested range, not proof of all transmitted signals. */
  complete: boolean
  warnings: string[]
}

export const evidenceStorageKey = 'reception-evidence-v1'

export function normalizedEvidenceRequest(request: EvidenceRequest): EvidenceRequest {
  const call = normalizeCall(request.call)
  if (
    !request.operationId ||
    request.operationId.length > 200 ||
    !isValidCall(call) ||
    !Number.isSafeInteger(request.startMs) ||
    request.startMs <= 0 ||
    !Number.isSafeInteger(request.endMs) ||
    request.endMs < request.startMs
  )
    throw new Error('RBN evidence needs an operation, exact callsign, and valid time range.')
  const origin = request.origin
  const validOrigin =
    origin &&
    Number.isFinite(origin.latitude) &&
    Math.abs(origin.latitude) <= 90 &&
    Number.isFinite(origin.longitude) &&
    Math.abs(origin.longitude) <= 180
  return {
    operationId: request.operationId,
    call,
    startMs: request.startMs,
    endMs: request.endMs,
    ...(validOrigin
      ? {
          origin: {
            latitude: origin.latitude,
            longitude: origin.longitude,
            ...(origin.label ? { label: origin.label.slice(0, 200) } : {}),
          },
        }
      : {}),
  }
}

export function emptyEvidence(request: EvidenceRequest, at: number): RbnEvidence {
  return {
    schemaVersion: 1,
    provider: 'vail-rerbn',
    request: normalizedEvidenceRequest(request),
    retrievedAtMs: at,
    reports: [],
    attempts: [],
    complete: false,
    warnings: [],
  }
}

export function evidenceForRange(evidence: RbnEvidence, request: EvidenceRequest): RbnEvidence {
  const omitted = evidence.warnings.some(
    (warning) =>
      warning.includes('observation archive limit') ||
      warning.includes('4,000-observation archive limit') ||
      warning.includes('recording queue was full'),
  )
  const complete =
    !omitted &&
    evidence.attempts.some(
      (attempt) =>
        attempt.kind === 'history' &&
        attempt.complete &&
        attempt.request.startMs <= request.startMs &&
        attempt.request.endMs >= request.endMs,
    )
  return {
    ...evidence,
    request,
    reports: evidence.reports.filter(
      (report) => report.timeMs >= request.startMs && report.timeMs <= request.endMs,
    ),
    complete,
  }
}

/** Provider IDs identify observations; repeated polling never inflates counts. */
export function appendEvidencePage(
  evidence: RbnEvidence,
  payload: unknown,
  retrieval: {
    kind: RetrievalKind
    startedAtMs: number
    retrievedAtMs: number
    offset: number
    status: number
  },
): { evidence: RbnEvidence; page: RbnRetrievalPage } {
  const request = evidence.request
  const windowMinutes = Math.max(1, Math.ceil((request.endMs - request.startMs) / 60_000))
  parseRbnPayload(payload, request.call, windowMinutes, request.endMs, evidenceLimits.pageSize)
  const data = record(payload)
  if (!data) throw new Error('Vail ReRBN returned an unsupported data format.')
  if (
    data.offset !== retrieval.offset ||
    data.limit !== evidenceLimits.pageSize ||
    (data.spots as unknown[]).length > evidenceLimits.pageSize
  ) {
    throw new Error('Vail ReRBN returned inconsistent pagination metadata.')
  }
  const reports = new Map(evidence.reports.map((report) => [report.id, report]))
  let reportCharacters = evidence.reports.reduce(
    (sum, report) => sum + JSON.stringify(report).length,
    0,
  )
  const page: RbnRetrievalPage = {
    offset: retrieval.offset,
    startedAtMs: retrieval.startedAtMs,
    completedAtMs: retrieval.retrievedAtMs,
    status: retrieval.status,
    total: data.total as number,
    receivedRows: (data.spots as unknown[]).length,
    acceptedRows: 0,
    duplicateRows: 0,
    filteredRows: 0,
    invalidRows: 0,
    error: null,
  }
  const warnings = new Set(evidence.warnings)
  for (const item of data.spots as unknown[]) {
    const row = record(item)
    if (!row || typeof row.callsign !== 'string') {
      page.invalidRows++
      continue
    }
    if (normalizeCall(row.callsign) !== request.call) {
      page.filteredRows++
      continue
    }
    const time = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : Number.NaN
    if (Number.isFinite(time) && (time < request.startMs || time > request.endMs)) {
      page.filteredRows++
      continue
    }
    let report: RbnReport | undefined
    try {
      // A repeated ID may contain conflicting rows. Normalize each actual row
      // so the normalized measurements always agree with its archived raw JSON.
      report = parseRbnPayload(
        { spots: [row], total: 1, offset: 0, limit: evidenceLimits.pageSize },
        request.call,
        windowMinutes,
        request.endMs,
        1,
      ).reports[0]
    } catch {
      page.invalidRows++
      continue
    }
    if (!report) {
      page.invalidRows++
      continue
    }
    const previous = reports.get(report.id)
    if (!previous && reports.size >= evidenceLimits.reports) {
      warnings.add('The 4,000-observation archive limit was reached; some evidence was omitted.')
      page.filteredRows++
      continue
    }
    const receiverGrid =
      typeof row.spotter_grid === 'string' && receiverLocation(row.spotter_grid)[0] !== null
        ? row.spotter_grid.trim().toUpperCase()
        : null
    // Copy the original JSON row so later callers cannot mutate archived evidence.
    const raw = JSON.parse(JSON.stringify(row)) as Record<string, JSONValue>
    if (
      previous &&
      [
        'callsign',
        'spotter',
        'frequency',
        'timestamp',
        'mode',
        'snr',
        'wpm',
        'spotter_grid',
        'grid',
      ].some((key) => JSON.stringify(previous.raw[key]) !== JSON.stringify(raw[key]))
    )
      warnings.add(
        'A provider observation ID changed fields; the most recently retrieved provider row is retained.',
      )
    const candidate: RbnEvidenceReport = {
      ...report,
      raw,
      receiverGrid,
      receiverLocationSource: receiverGrid ? 'provider-grid' : null,
      retrievedAtMs: previous?.retrievedAtMs ?? retrieval.retrievedAtMs,
      firstSeenMs: previous?.firstSeenMs ?? retrieval.retrievedAtMs,
      lastSeenMs: Math.max(previous?.lastSeenMs ?? 0, retrieval.retrievedAtMs),
      retrievalKind: previous?.retrievalKind ?? retrieval.kind,
    }
    const newCharacters =
      reportCharacters +
      JSON.stringify(candidate).length -
      (previous ? JSON.stringify(previous).length : 0)
    if (newCharacters > evidenceLimits.observationCharacters) {
      warnings.add(
        'The 2,000,000-character observation archive limit was reached; some evidence was omitted.',
      )
      page.filteredRows++
      continue
    }
    reportCharacters = newCharacters
    reports.set(report.id, candidate)
    if (previous) page.duplicateRows++
    else page.acceptedRows++
  }
  if (page.invalidRows) warnings.add('Some provider rows were invalid and could not be included.')
  return {
    evidence: {
      ...evidence,
      retrievedAtMs: retrieval.retrievedAtMs,
      reports: [...reports.values()].sort(
        (a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id),
      ),
      warnings: [...warnings],
    },
    page,
  }
}

export function addEvidenceAttempt(
  evidence: RbnEvidence,
  attempt: RbnRetrievalAttempt,
): RbnEvidence {
  const attempts = [...evidence.attempts, attempt]
  const warnings = new Set(evidence.warnings)
  if (attempts.length > evidenceLimits.attempts)
    warnings.add('Only the latest 512 retrieval attempts are retained in this archive.')
  return {
    ...evidence,
    attempts: attempts.slice(-evidenceLimits.attempts),
    retrievedAtMs: attempt.completedAtMs,
    complete: evidence.complete || attempt.complete,
    warnings: [...warnings],
  }
}

function archiveId(request: EvidenceRequest): string {
  return JSON.stringify([request.operationId, request.call])
}

function restoredEvidence(value: unknown): RbnEvidence | null {
  const saved = record(value)
  if (
    saved?.schemaVersion !== 1 ||
    saved.provider !== 'vail-rerbn' ||
    !Array.isArray(saved.reports) ||
    saved.reports.length > evidenceLimits.reports ||
    !Array.isArray(saved.attempts) ||
    saved.attempts.length > evidenceLimits.attempts ||
    !Array.isArray(saved.warnings) ||
    saved.warnings.length > 40 ||
    !saved.warnings.every((warning) => typeof warning === 'string' && warning.length <= 500) ||
    typeof saved.retrievedAtMs !== 'number' ||
    !Number.isSafeInteger(saved.retrievedAtMs)
  )
    return null
  try {
    const request = normalizedEvidenceRequest(saved.request as unknown as EvidenceRequest)
    let evidence = emptyEvidence(request, saved.retrievedAtMs)
    // Reuse the network parser instead of trusting saved normalized measurements.
    for (let offset = 0; offset < saved.reports.length; offset += evidenceLimits.pageSize) {
      const rows = saved.reports.slice(offset, offset + evidenceLimits.pageSize)
      const appended = appendEvidencePage(
        evidence,
        {
          spots: rows.map((item) => record(item)?.raw),
          total: saved.reports.length,
          offset,
          limit: evidenceLimits.pageSize,
        },
        {
          kind: 'history',
          startedAtMs: saved.retrievedAtMs,
          retrievedAtMs: saved.retrievedAtMs,
          offset,
          status: 200,
        },
      )
      if (appended.page.invalidRows || appended.page.filteredRows) return null
      evidence = appended.evidence
    }
    const originals = new Map(saved.reports.map((item) => [String(record(item)?.id), record(item)]))
    evidence.reports = evidence.reports.map((report) => {
      const original = originals.get(report.id)
      if (!original) throw new Error('Invalid observation provenance')
      const first = original.firstSeenMs
      const last = original.lastSeenMs
      if (
        typeof first !== 'number' ||
        !Number.isSafeInteger(first) ||
        first <= 0 ||
        typeof last !== 'number' ||
        !Number.isSafeInteger(last) ||
        last < first ||
        !['history', 'live'].includes(String(original.retrievalKind))
      )
        throw new Error('Invalid observation provenance')
      return {
        ...report,
        retrievedAtMs: first,
        firstSeenMs: first,
        lastSeenMs: last,
        retrievalKind: original.retrievalKind as RetrievalKind,
      }
    })
    const attempts = saved.attempts.map((item) => {
      const attempt = record(item)
      if (
        !attempt ||
        typeof attempt.id !== 'string' ||
        attempt.id.length > 200 ||
        !['history', 'live'].includes(String(attempt.kind)) ||
        typeof attempt.startedAtMs !== 'number' ||
        !Number.isSafeInteger(attempt.startedAtMs) ||
        typeof attempt.completedAtMs !== 'number' ||
        !Number.isSafeInteger(attempt.completedAtMs) ||
        attempt.completedAtMs < attempt.startedAtMs ||
        typeof attempt.complete !== 'boolean' ||
        !Array.isArray(attempt.pages) ||
        attempt.pages.length > evidenceLimits.pages ||
        !Array.isArray(attempt.errors) ||
        attempt.errors.length > evidenceLimits.pages ||
        !attempt.errors.every((error) => typeof error === 'string' && error.length <= 500) ||
        !['complete', 'live', 'page-limit', 'report-limit', 'budget', 'error', 'offline'].includes(
          String(attempt.stopReason),
        )
      )
        throw new Error('Invalid retrieval ledger')
      const attemptRequest = normalizedEvidenceRequest(
        attempt.request as unknown as EvidenceRequest,
      )
      if (
        attemptRequest.operationId !== request.operationId ||
        attemptRequest.call !== request.call
      )
        throw new Error('Invalid retrieval scope')
      for (const item of attempt.pages) {
        const page = record(item)
        if (
          !page ||
          ![
            'offset',
            'startedAtMs',
            'completedAtMs',
            'receivedRows',
            'acceptedRows',
            'duplicateRows',
            'filteredRows',
            'invalidRows',
          ].every(
            (key) =>
              typeof page[key] === 'number' &&
              Number.isSafeInteger(page[key]) &&
              (page[key] as number) >= 0,
          ) ||
          !(
            page.status === null ||
            (typeof page.status === 'number' && Number.isInteger(page.status))
          ) ||
          !(
            page.total === null ||
            (typeof page.total === 'number' && Number.isSafeInteger(page.total) && page.total >= 0)
          ) ||
          !(page.error === null || (typeof page.error === 'string' && page.error.length <= 500))
        )
          throw new Error('Invalid page ledger')
      }
      return { ...attempt, request: attemptRequest } as unknown as RbnRetrievalAttempt
    })
    return evidenceForRange(
      { ...evidence, attempts, warnings: saved.warnings as string[] },
      request,
    )
  } catch {
    return null
  }
}

/** Small bounded settings checkpoints; no invented durable KV or filesystem API. */
export function createEvidenceStore(storage?: PersistentStorage) {
  const archives = new Map<string, RbnEvidence>()
  let restoring: Promise<void> | undefined
  let writing = Promise.resolve()
  let storageWarning: string | undefined
  async function restore() {
    restoring ??= (async () => {
      if (!storage) return
      try {
        const value = await storage.read(evidenceStorageKey)
        if (value === null) return
        if (typeof value !== 'string' || value.length > evidenceLimits.archiveCharacters)
          throw new Error('Invalid evidence archive')
        const data = record(JSON.parse(value))
        if (
          data?.version !== 1 ||
          !Array.isArray(data.archives) ||
          data.archives.length > evidenceLimits.archives
        )
          throw new Error('Invalid evidence archive')
        for (const item of data.archives) {
          const evidence = restoredEvidence(item)
          if (!evidence) throw new Error('Invalid evidence archive')
          archives.set(archiveId(evidence.request), evidence)
        }
      } catch {
        storageWarning =
          'Saved RBN evidence could not be restored; new evidence is retained for this session.'
      }
    })()
    await restoring
  }
  async function read(operationId: string, call: string) {
    await restore()
    // A completed panel fetch can be followed immediately by Exports while its
    // captured rows are still queued. Return the completed archive revision.
    await writing
    const evidence = archives.get(
      archiveId({ operationId, call: normalizeCall(call), startMs: 1, endMs: 1 }),
    )
    return evidence ? (JSON.parse(JSON.stringify(evidence)) as RbnEvidence) : null
  }
  function update(evidence: RbnEvidence): Promise<RbnEvidence> {
    let result = evidence
    const pending = writing.then(async () => {
      await restore()
      const key = archiveId(evidence.request)
      const previous = archives.get(key)
      const reports = new Map(previous?.reports.map((report) => [report.id, report]) ?? [])
      let reportCharacters = [...reports.values()].reduce(
        (sum, report) => sum + JSON.stringify(report).length,
        0,
      )
      let omittedReports = 0
      let oversizedReports = 0
      for (const report of evidence.reports) {
        const old = reports.get(report.id)
        if (!old && reports.size >= evidenceLimits.reports) {
          omittedReports++
          continue
        }
        const latest = old && old.lastSeenMs > report.lastSeenMs ? old : report
        const candidate = old
          ? {
              ...latest,
              firstSeenMs: Math.min(old.firstSeenMs, report.firstSeenMs),
              retrievedAtMs: Math.min(old.retrievedAtMs, report.retrievedAtMs),
              lastSeenMs: Math.max(old.lastSeenMs, report.lastSeenMs),
              retrievalKind:
                old.firstSeenMs <= report.firstSeenMs ? old.retrievalKind : report.retrievalKind,
            }
          : report
        const newCharacters =
          reportCharacters +
          JSON.stringify(candidate).length -
          (old ? JSON.stringify(old).length : 0)
        if (newCharacters > evidenceLimits.observationCharacters) {
          oversizedReports++
          continue
        }
        reportCharacters = newCharacters
        reports.set(report.id, candidate)
      }
      const attempts = new Map(previous?.attempts.map((attempt) => [attempt.id, attempt]) ?? [])
      for (const attempt of evidence.attempts) attempts.set(attempt.id, attempt)
      const warnings = new Set([...(previous?.warnings ?? []), ...evidence.warnings])
      if (storageWarning) warnings.add(storageWarning)
      if (omittedReports)
        warnings.add('The 4,000-observation archive limit was reached; some evidence was omitted.')
      if (oversizedReports)
        warnings.add(
          'The 2,000,000-character observation archive limit was reached; some evidence was omitted.',
        )
      if (attempts.size > evidenceLimits.attempts)
        warnings.add('Only the latest 512 retrieval attempts are retained in this archive.')
      const merged = {
        ...evidence,
        retrievedAtMs: Math.max(previous?.retrievedAtMs ?? 0, evidence.retrievedAtMs),
        request: {
          ...evidence.request,
          startMs: Math.min(
            previous?.request.startMs ?? evidence.request.startMs,
            evidence.request.startMs,
          ),
          endMs: Math.max(
            previous?.request.endMs ?? evidence.request.endMs,
            evidence.request.endMs,
          ),
        },
        reports: [...reports.values()].sort(
          (a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id),
        ),
        attempts: [...attempts.values()]
          .sort((a, b) => a.startedAtMs - b.startedAtMs || a.id.localeCompare(b.id))
          .slice(-evidenceLimits.attempts),
        warnings: [...warnings],
      }
      archives.delete(key)
      archives.set(key, evidenceForRange(merged, merged.request))
      if (archives.size > evidenceLimits.archives) {
        const oldest = archives.keys().next().value
        if (oldest !== undefined) archives.delete(oldest)
        merged.warnings.push(
          'Only four recent operation/callsign archives are retained; the oldest archive was evicted.',
        )
      }
      result = evidenceForRange(merged, evidence.request)
      if (storage) {
        try {
          const encoded = JSON.stringify({ version: 1, archives: [...archives.values()] })
          if (encoded.length > evidenceLimits.archiveCharacters)
            throw new Error('Archive size limit')
          await storage.write(evidenceStorageKey, encoded)
        } catch {
          const warning =
            'RBN evidence could not be saved within the local archive limit; it may be lost on restart.'
          result.warnings = [...new Set([...result.warnings, warning])]
          const archived = archives.get(key)
          if (archived) archived.warnings = [...new Set([...archived.warnings, warning])]
        }
      }
    })
    writing = pending.catch(() => {})
    return pending.then(() => result)
  }
  return { read, update }
}
