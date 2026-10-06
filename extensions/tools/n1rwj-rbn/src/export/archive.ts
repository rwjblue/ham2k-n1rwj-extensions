import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import { parseRbnPayload } from '../data/parser.ts'
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
} from './evidence.ts'

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

/** A bounded opt-in archive; reading or appending never starts a network request. */
export function createEvidenceArchive(storage?: PersistentStorage) {
  const store = storeFor(storage)
  let appending = Promise.resolve()
  let pendingAppends = 0
  let queueWarning: string | undefined
  async function readStoredEvidence(operationId: string, call: string) {
    const evidence = await store.read(operationId, call)
    observeSequence(evidence)
    return evidence
  }
  async function readEvidence(operationId: string, call: string) {
    // Only response bodies already delivered to appendLive are awaited. This
    // queue contains no network requests or unfinished panel fetches.
    await appending
    const evidence = await readStoredEvidence(operationId, call)
    return evidence && queueWarning
      ? {
          ...evidence,
          complete: false,
          warnings: [...new Set([...evidence.warnings, queueWarning])],
        }
      : evidence
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

  async function appendEvent(
    request: EvidenceRequest,
    event: LiveEvidenceEvent,
  ): Promise<RbnEvidence> {
    let scope = normalizedEvidenceRequest(request)
    const previous = await readStoredEvidence(scope.operationId, scope.call)
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
            'A live panel fetch was capped at 500 rows; the archive may omit reception observations.',
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
        ...(queueWarning ? [queueWarning] : []),
      ]),
    ]
    return store.update(addEvidenceAttempt(evidence, attempt))
  }

  function appendLive(request: EvidenceRequest, event: LiveEvidenceEvent): Promise<RbnEvidence> {
    // Match the eight-query/placement bound instead of retaining an unbounded
    // chain of raw response bodies when persistent storage stops responding.
    if (pendingAppends >= 8) {
      queueWarning =
        'The eight-response recording queue was full; some completed panel reception evidence was not archived.'
      return Promise.reject(new Error(queueWarning))
    }
    pendingAppends++
    const pending = appending.then(() => appendEvent(request, event))
    appending = pending.then(
      () => {
        pendingAppends--
      },
      () => {
        pendingAppends--
      },
    )
    return pending
  }

  return { store, readEvidence, appendLive, attemptFor }
}
