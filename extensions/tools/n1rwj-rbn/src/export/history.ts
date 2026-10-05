import { type FetchOptions, type FetchResponse, host } from '@ham2k/extension-sdk'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import type { TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import { requestFailure } from '../data/errors.ts'
import { parseRbnPayload, record } from '../data/parser.ts'
import { normalizeCall } from '../model.ts'
import {
  addEvidenceAttempt,
  appendEvidencePage,
  createEvidenceStore,
  type EvidenceRequest,
  emptyEvidence,
  evidenceForRange,
  evidenceLimits,
  normalizedEvidenceRequest,
  type RbnEvidence,
  type RbnRetrievalAttempt,
  type RbnRetrievalPage,
} from './evidence.ts'

const endpoint = 'https://vailrerbn.com/api/v1/spots'

export interface EvidenceDependencies {
  fetch: (url: string, options?: FetchOptions) => Promise<FetchResponse>
  now?: () => number
  storage?: PersistentStorage
  timers?: TimerDriver
}

export interface LiveEvidenceEvent {
  payload?: unknown
  startedAtMs: number
  retrievedAtMs: number
  status?: number
  error?: string
}

const stores = new WeakMap<PersistentStorage, ReturnType<typeof createEvidenceStore>>()
let sequence = 0

function observeSequence(evidence: RbnEvidence | null) {
  for (const attempt of evidence?.attempts ?? []) {
    const saved = Number(attempt.id.split(':')[2])
    if (Number.isSafeInteger(saved)) sequence = Math.max(sequence, saved)
  }
}

function storeFor(storage?: PersistentStorage) {
  if (!storage) return createEvidenceStore()
  let store = stores.get(storage)
  if (!store) {
    store = createEvidenceStore(storage)
    stores.set(storage, store)
  }
  return store
}

/** Fixed bounds prevent an activation export becoming a moving recent-time snapshot. */
export function createEvidenceRetriever(dependencies: EvidenceDependencies) {
  const now = dependencies.now ?? Date.now
  const timers = dependencies.timers ?? host
  const store = storeFor(dependencies.storage)
  const pending = new Map<string, Promise<RbnEvidence>>()
  const finished = new Map<string, { evidence: RbnEvidence; at: number }>()

  async function readEvidence(operationId: string, call: string) {
    return store.read(operationId, call)
  }

  function attemptFor(
    request: EvidenceRequest,
    kind: 'history' | 'live',
    at: number,
  ): RbnRetrievalAttempt {
    return {
      id: `${kind}:${at}:${++sequence}`,
      kind,
      request,
      startedAtMs: at,
      completedAtMs: at,
      pages: [],
      complete: false,
      stopReason: kind === 'live' ? 'live' : 'error',
      errors: [],
    }
  }

  async function appendLive(
    request: EvidenceRequest,
    event: LiveEvidenceEvent,
  ): Promise<RbnEvidence> {
    let scope = normalizedEvidenceRequest(request)
    const previous = await store.read(scope.operationId, scope.call)
    observeSequence(previous)
    let evidence = previous
      ? evidenceForRange(previous, scope)
      : emptyEvidence(scope, event.retrievedAtMs)
    const attempt = attemptFor(scope, 'live', event.startedAtMs)
    attempt.completedAtMs = Math.max(event.startedAtMs, event.retrievedAtMs)
    if (event.error || event.payload === undefined) {
      const error = (event.error ?? 'Live reception request returned no data.').slice(0, 500)
      attempt.errors.push(error)
      attempt.stopReason = 'error'
      attempt.pages.push({
        offset: 0,
        startedAtMs: event.startedAtMs,
        completedAtMs: attempt.completedAtMs,
        status: event.status ?? null,
        total: null,
        receivedRows: 0,
        acceptedRows: 0,
        duplicateRows: 0,
        filteredRows: 0,
        invalidRows: 0,
        error,
      })
    } else {
      try {
        // Operation/callsign ownership remains frozen. The live endpoint has no
        // until bound, so retain valid spots that arrived while the fetch ran.
        const accepted = parseRbnPayload(
          event.payload,
          scope.call,
          Math.max(1, Math.ceil((scope.endMs - scope.startMs) / 60_000)),
          attempt.completedAtMs,
          evidenceLimits.pageSize,
        ).reports
        scope = {
          ...scope,
          endMs: Math.max(
            scope.endMs,
            attempt.completedAtMs,
            ...accepted.map((report) => report.timeMs),
          ),
        }
        attempt.request = scope
        evidence = { ...evidence, request: scope }
        const result = appendEvidencePage(evidence, event.payload, {
          kind: 'live',
          startedAtMs: event.startedAtMs,
          retrievedAtMs: attempt.completedAtMs,
          offset: 0,
          status: event.status ?? 200,
        })
        evidence = result.evidence
        attempt.pages.push(result.page)
        if ((result.page.total ?? 0) > result.page.receivedRows)
          evidence.warnings.push(
            'A live panel fetch was capped at 500 rows; history retrieval may recover omitted observations.',
          )
      } catch (error) {
        attempt.stopReason = 'error'
        attempt.errors.push(
          error instanceof Error ? error.message.slice(0, 500) : 'Invalid live reception response.',
        )
      }
    }
    evidence.warnings = [
      ...new Set([
        ...evidence.warnings,
        'Live capture covers visible My Signal panels; hidden or suspended periods are not continuously recorded.',
        'Live retrieval times are host clock samples and may be lower bounds on request completion.',
      ]),
    ]
    return store.update(addEvidenceAttempt(evidence, attempt))
  }

  async function collect(
    request: EvidenceRequest,
    options: { online?: boolean },
  ): Promise<RbnEvidence> {
    const previous = await store.read(request.operationId, request.call)
    observeSequence(previous)
    let evidence = previous ? evidenceForRange(previous, request) : emptyEvidence(request, now())
    const currentTime = now()
    const reusable = evidence.attempts.some(
      (attempt) =>
        attempt.kind === 'history' &&
        attempt.complete &&
        attempt.request.startMs <= request.startMs &&
        attempt.request.endMs >= request.endMs &&
        currentTime >= attempt.completedAtMs &&
        currentTime - attempt.completedAtMs < evidenceLimits.reuseMs,
    )
    if (options.online === false) {
      const attempt = attemptFor(request, 'history', currentTime)
      attempt.stopReason = 'offline'
      attempt.errors.push(
        'Offline: no history request was sent. Saved evidence is included when available.',
      )
      evidence.warnings = [...new Set([...evidence.warnings, ...attempt.errors])]
      return store.update(addEvidenceAttempt(evidence, attempt))
    }
    if (reusable && evidence.complete) return evidence
    const attempt = attemptFor(request, 'history', currentTime)
    const deadline = currentTime + evidenceLimits.budgetMs
    let budgetExpired = false
    let rejectBudget: (error: Error) => void = () => {}
    const budget = new Promise<never>((_, reject) => {
      rejectBudget = reject
    })
    // Observe immediately, even before the first Promise.race attaches a handler.
    void budget.catch(() => {})
    const timer = timers.setTimeout(() => {
      budgetExpired = true
      rejectBudget(new Error('The 12-second history retrieval budget was reached.'))
    }, evidenceLimits.budgetMs)
    let offset = 0
    let lastTotal: number | null = null
    let paginationChanged = false
    const pageIds = new Set<string>()
    try {
      for (let pageIndex = 0; pageIndex < evidenceLimits.pages; pageIndex++) {
        const startedAtMs = now()
        const remaining = deadline - startedAtMs
        if (budgetExpired || remaining <= 0) {
          attempt.stopReason = 'budget'
          break
        }
        const page: RbnRetrievalPage = {
          offset,
          startedAtMs,
          completedAtMs: startedAtMs,
          status: null,
          total: null,
          receivedRows: 0,
          acceptedRows: 0,
          duplicateRows: 0,
          filteredRows: 0,
          invalidRows: 0,
          error: null,
        }
        const url = `${endpoint}?call=${encodeURIComponent(request.call)}&since=${Math.floor(request.startMs / 1000)}&until=${Math.ceil(request.endMs / 1000)}&limit=${evidenceLimits.pageSize}&offset=${offset}`
        try {
          const response = await Promise.race([
            dependencies.fetch(url, {
              timeout: Math.max(1, Math.min(evidenceLimits.pageTimeoutMs, remaining)),
            }),
            budget,
          ])
          page.status = response.status
          page.completedAtMs = Math.max(startedAtMs, now())
          if (response.status < 200 || response.status >= 300)
            throw new Error(`Vail ReRBN history request failed (HTTP ${response.status}).`)
          if (response.body.length > evidenceLimits.responseCharacters)
            throw new Error('Vail ReRBN history response exceeded the 1,000,000-character limit.')
          let payload: unknown
          try {
            payload = JSON.parse(response.body)
          } catch {
            throw new Error('Vail ReRBN history returned invalid JSON.')
          }
          const result = appendEvidencePage(evidence, payload, {
            kind: 'history',
            startedAtMs,
            retrievedAtMs: page.completedAtMs,
            offset,
            status: response.status,
          })
          evidence = result.evidence
          attempt.pages.push(result.page)
          if (lastTotal !== null && result.page.total !== lastTotal) paginationChanged = true
          const rows = record(payload)?.spots
          for (const item of Array.isArray(rows) ? rows : []) {
            const row = record(item)
            if (typeof row?.callsign !== 'string' || normalizeCall(row.callsign) !== request.call)
              continue
            const id = String(row.id)
            if (pageIds.has(id)) paginationChanged = true
            pageIds.add(id)
          }
          if (paginationChanged)
            evidence.warnings.push(
              'Provider totals or observation IDs changed during pagination; offset pagination may have missed rows.',
            )
          lastTotal = result.page.total
          offset += result.page.receivedRows
          if (offset >= (result.page.total ?? 0)) {
            attempt.complete =
              !paginationChanged &&
              result.page.invalidRows === 0 &&
              attempt.pages.every((page) => page.invalidRows === 0) &&
              !evidence.warnings.some((warning) => warning.includes('observation archive limit'))
            attempt.stopReason = attempt.complete ? 'complete' : 'error'
            if (!attempt.complete)
              attempt.errors.push(
                'Pagination finished, but invalid or omitted rows prevent a complete evidence archive.',
              )
            break
          }
          if (!result.page.receivedRows)
            throw new Error('Vail ReRBN pagination stopped before its reported total.')
          if (evidence.reports.length >= evidenceLimits.reports) {
            attempt.stopReason = 'report-limit'
            break
          }
          if (pageIndex === evidenceLimits.pages - 1) attempt.stopReason = 'page-limit'
        } catch (error) {
          page.completedAtMs = Math.max(startedAtMs, now())
          const detail = error instanceof Error ? error.message : requestFailure(error).message
          page.error = detail.slice(0, 500)
          // Parsing may fail after a successful page was already recorded.
          const recorded = attempt.pages.find(
            (saved) => saved.offset === page.offset && saved.startedAtMs === startedAtMs,
          )
          if (recorded) recorded.error = page.error
          else attempt.pages.push(page)
          attempt.errors.push(page.error)
          attempt.stopReason = budgetExpired ? 'budget' : 'error'
          break
        }
      }
    } finally {
      timers.clearTimeout(timer)
    }
    attempt.completedAtMs = Math.max(attempt.startedAtMs, now())
    if (!attempt.complete) {
      evidence.warnings.push(
        attempt.stopReason === 'page-limit'
          ? 'History retrieval stopped after eight pages; partial callsign matches may have consumed the page budget.'
          : attempt.stopReason === 'report-limit'
            ? 'History retrieval stopped at the 4,000-observation limit.'
            : attempt.stopReason === 'budget'
              ? 'History retrieval stopped at its 12-second budget; this export includes partial evidence.'
              : 'History retrieval was incomplete; successful pages and saved observations are included.',
      )
    }
    evidence.warnings = [...new Set([...evidence.warnings, ...attempt.errors])]
    return store.update(addEvidenceAttempt(evidence, attempt))
  }

  function retrieveEvidence(
    request: EvidenceRequest,
    options: { online?: boolean } = {},
  ): Promise<RbnEvidence> {
    const normalized = normalizedEvidenceRequest(request)
    const key = JSON.stringify([normalized, options.online !== false])
    const existing = pending.get(key)
    if (existing) return existing
    const cached = finished.get(key)
    const time = now()
    const latestCachedAttempt = cached?.evidence.attempts[cached.evidence.attempts.length - 1]
    if (
      cached &&
      time >= cached.at &&
      time - cached.at < (latestCachedAttempt?.complete ? evidenceLimits.reuseMs : 60_000)
    )
      return Promise.resolve(cached.evidence)
    const result = collect(normalized, options)
      .then((evidence) => {
        finished.delete(key)
        finished.set(key, { evidence, at: now() })
        while (finished.size > 8) {
          const oldest = finished.keys().next().value
          if (oldest !== undefined) finished.delete(oldest)
        }
        return evidence
      })
      .finally(() => pending.delete(key))
    pending.set(key, result)
    return result
  }
  return { retrieveEvidence, readEvidence, appendLive }
}

const retrievers = new WeakMap<EvidenceDependencies, ReturnType<typeof createEvidenceRetriever>>()

export function retrieveEvidence(
  request: EvidenceRequest,
  dependencies: EvidenceDependencies,
  options: { online?: boolean } = {},
): Promise<RbnEvidence> {
  let retriever = retrievers.get(dependencies)
  if (!retriever) {
    retriever = createEvidenceRetriever(dependencies)
    retrievers.set(dependencies, retriever)
  }
  return retriever.retrieveEvidence(request, options)
}
