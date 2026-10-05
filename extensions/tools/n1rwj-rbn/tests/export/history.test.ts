import type { FetchOptions, FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import type { PersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import type { TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import {
  appendEvidencePage,
  createEvidenceStore,
  type EvidenceRequest,
  emptyEvidence,
  evidenceStorageKey,
} from '../../src/export/evidence.ts'
import { createEvidenceRetriever } from '../../src/export/history.ts'
import { NOW, payload, spotPayload } from '../data/fixtures.ts'

const request: EvidenceRequest = {
  operationId: 'park-activation',
  call: 'N1RWJ',
  startMs: NOW - 3_600_000,
  endMs: NOW,
  origin: { latitude: 42, longitude: -71, label: 'Operation location' },
}

function response(spots: unknown[], total = spots.length, offset = 0): FetchResponse {
  return { status: 200, body: JSON.stringify(payload({ spots, total, offset })) }
}

function storageFixture() {
  const values = new Map<string, JSONValue>()
  const storage: PersistentStorage = {
    read: vi.fn(async (key) => values.get(key) ?? null),
    write: vi.fn(async (key, value) => {
      values.set(key, value)
    }),
  }
  return { values, storage }
}

function timerFixture() {
  const callbacks = new Map<number, () => void>()
  let next = 0
  const timers: TimerDriver = {
    setTimeout: vi.fn((callback) => {
      callbacks.set(++next, callback)
      return next
    }),
    clearTimeout: vi.fn((id) => {
      callbacks.delete(id)
    }),
  }
  return { callbacks, timers }
}

describe('operation reception evidence', () => {
  it('paginates fixed bounds, filters exact calls, deduplicates IDs, and retains original provider fields', async () => {
    const first = spotPayload({ id: 101, snr: 0, wpm: null, extra: { source: 'fixture' } })
    const second = spotPayload({
      id: '102',
      timestamp: new Date(NOW).toISOString(),
      spotter_grid: null,
    })
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([first, spotPayload({ id: 103, callsign: 'N1RWJ/P' })], 4))
      .mockResolvedValueOnce(
        response([spotPayload({ id: 104, callsign: 'N1RWJ/P' }), second], 4, 2),
      )
    const retriever = createEvidenceRetriever({
      fetch,
      now: () => NOW,
      timers: timerFixture().timers,
    })
    const evidence = await retriever.retrieveEvidence({ ...request, call: ' n1rwj ' })
    expect(evidence.complete).toBe(true)
    expect(evidence.reports.map((report) => report.id)).toEqual(['101', '102'])
    expect(evidence.reports[0]).toMatchObject({
      snrDb: 0,
      wpm: null,
      receiverGrid: 'FM19',
      receiverLocationSource: 'provider-grid',
      raw: first,
      firstSeenMs: NOW,
      lastSeenMs: NOW,
      retrievalKind: 'history',
    })
    expect(evidence.reports[1].receiverLatitude).toBeNull()
    expect(evidence.attempts[0].pages).toEqual([
      expect.objectContaining({ offset: 0, filteredRows: 1, acceptedRows: 1 }),
      expect.objectContaining({ offset: 2, filteredRows: 1, acceptedRows: 1 }),
    ])
    expect(fetch.mock.calls[0]).toEqual([
      `https://vailrerbn.com/api/v1/spots?call=N1RWJ&since=${request.startMs / 1000}&until=${request.endMs / 1000}&limit=500&offset=0`,
      { timeout: 4000 },
    ])
    expect(fetch.mock.calls[1][0]).toContain('&offset=2')
  })

  it('keeps successful pages and explicit failures; later failure never erases saved observations', async () => {
    let now = NOW
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([spotPayload()], 2))
      .mockResolvedValueOnce({ status: 503, body: 'unavailable' })
      .mockRejectedValueOnce(new Error('Host request timed out'))
    const retriever = createEvidenceRetriever({
      fetch,
      now: () => now,
      timers: timerFixture().timers,
    })
    const first = await retriever.retrieveEvidence(request)
    expect(first.complete).toBe(false)
    expect(first.reports).toHaveLength(1)
    expect(first.attempts[0]).toMatchObject({
      stopReason: 'error',
      errors: [expect.stringContaining('503')],
    })
    expect(first.attempts[0].pages[1]).toMatchObject({
      offset: 1,
      status: 503,
      error: expect.stringContaining('503'),
    })
    now += 60_001
    const second = await retriever.retrieveEvidence(request)
    expect(second.reports).toHaveLength(1)
    expect(second.attempts).toHaveLength(2)
    expect(second.attempts[1].errors[0]).toContain('timed out')
  })

  it('counts invalid exact-call rows and rejects broken pagination instead of claiming a complete empty archive', async () => {
    let now = NOW
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([spotPayload({ timestamp: 'invalid' })]))
      .mockResolvedValueOnce(response([spotPayload()], 1, 500))
    const retriever = createEvidenceRetriever({
      fetch,
      now: () => now,
      timers: timerFixture().timers,
    })
    const invalid = await retriever.retrieveEvidence(request)
    expect(invalid.complete).toBe(false)
    expect(invalid.attempts[0].pages[0].invalidRows).toBe(1)
    now += 60_001
    const broken = await retriever.retrieveEvidence(request)
    expect(broken.complete).toBe(false)
    expect(broken.attempts[1].errors[0]).toContain('pagination')
  })

  it('bounds pages even when partial matches consume the response, and does not broaden portable calls', async () => {
    const fetch = vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset'))
      return response([spotPayload({ id: offset + 1, callsign: 'N1RWJ/P' })], 100, offset)
    })
    const evidence = await createEvidenceRetriever({
      fetch,
      now: () => NOW,
      timers: timerFixture().timers,
    }).retrieveEvidence(request)
    expect(fetch).toHaveBeenCalledTimes(8)
    expect(evidence.reports).toHaveLength(0)
    expect(evidence.complete).toBe(false)
    expect(evidence.attempts[0].stopReason).toBe('page-limit')
    expect(evidence.warnings).toContainEqual(expect.stringContaining('partial callsign matches'))
  })

  it('enforces the total timer budget while the epoch clock is frozen', async () => {
    const { callbacks, timers } = timerFixture()
    const fetch = vi.fn(() => new Promise<FetchResponse>(() => {}))
    const pending = createEvidenceRetriever({ fetch, now: () => NOW, timers }).retrieveEvidence(
      request,
    )
    for (let count = 0; count < 8; count++) await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 12_000)
    const expire = callbacks.values().next().value
    if (!expire) throw new Error('Expected a history budget timer')
    expire()
    const evidence = await pending
    expect(evidence.attempts[0].stopReason).toBe('budget')
    expect(evidence.complete).toBe(false)
    expect(timers.clearTimeout).toHaveBeenCalledTimes(1)
  })

  it('reduces page timeouts to remaining budget and refuses a new request after the deadline', async () => {
    let now = NOW
    const fetch = vi.fn(async (url: string, _options?: FetchOptions) => {
      const offset = Number(new URL(url).searchParams.get('offset'))
      now += 5000
      return response([spotPayload({ id: offset + 1 })], 100, offset)
    })
    const evidence = await createEvidenceRetriever({
      fetch,
      now: () => now,
      timers: timerFixture().timers,
    }).retrieveEvidence(request)
    expect(fetch.mock.calls.map((call) => call[1])).toEqual([
      { timeout: 4000 },
      { timeout: 4000 },
      { timeout: 2000 },
    ])
    expect(evidence.reports).toHaveLength(3)
    expect(evidence.attempts[0].stopReason).toBe('budget')
  })

  it('bounds response bodies and JSON observation storage without losing prior data', async () => {
    const fetch = vi.fn(async () => ({ status: 200, body: ' '.repeat(1_000_001) }))
    const evidence = await createEvidenceRetriever({
      fetch,
      now: () => NOW,
      timers: timerFixture().timers,
    }).retrieveEvidence(request)
    expect(evidence.complete).toBe(false)
    expect(evidence.attempts[0].errors[0]).toContain('1,000,000-character')
    const raw = [1, 2, 3].map((id) => spotPayload({ id, extra: 'x'.repeat(750_000) }))
    const appended = appendEvidencePage(
      emptyEvidence(request, NOW),
      payload({ spots: raw, total: 3 }),
      { kind: 'history', startedAtMs: NOW, retrievedAtMs: NOW, offset: 0, status: 200 },
    )
    expect(appended.evidence.reports).toHaveLength(2)
    expect(appended.evidence.warnings).toContainEqual(
      expect.stringContaining('observation archive limit'),
    )
  })

  it('coalesces concurrent exports and reuses complete history for five minutes across requested subranges', async () => {
    let finish!: (value: FetchResponse) => void
    const fetch = vi.fn(
      () =>
        new Promise<FetchResponse>((resolve) => {
          finish = resolve
        }),
    )
    const retriever = createEvidenceRetriever({
      fetch,
      now: () => NOW,
      timers: timerFixture().timers,
    })
    const first = retriever.retrieveEvidence(request)
    const second = retriever.retrieveEvidence(request)
    expect(first).toBe(second)
    for (let count = 0; count < 8; count++) await Promise.resolve()
    finish(response([spotPayload()]))
    expect((await first).complete).toBe(true)
    await retriever.retrieveEvidence({ ...request, startMs: NOW - 120_000 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent live appends, merges evolving ranges, preserves first ingestion, and records failures', async () => {
    const { storage } = storageFixture()
    const retriever = createEvidenceRetriever({ fetch: vi.fn(), now: () => NOW, storage })
    await Promise.all([
      retriever.appendLive(request, { payload: payload(), startedAtMs: NOW, retrievedAtMs: NOW }),
      retriever.appendLive(
        { ...request, endMs: NOW + 60_000 },
        {
          payload: payload({ spots: [spotPayload({ id: 124 })] }),
          startedAtMs: NOW + 1,
          retrievedAtMs: NOW + 60_000,
        },
      ),
    ])
    await retriever.appendLive(request, {
      payload: payload(),
      startedAtMs: NOW + 120_000,
      retrievedAtMs: NOW + 120_000,
    })
    await retriever.appendLive(request, {
      startedAtMs: NOW + 180_000,
      retrievedAtMs: NOW + 180_000,
      error: 'Offline',
    })
    const saved = await retriever.readEvidence(request.operationId, request.call)
    expect(saved?.request.endMs).toBe(NOW + 120_000)
    expect(saved?.reports).toHaveLength(2)
    expect(saved?.reports[0]).toMatchObject({
      firstSeenMs: NOW,
      lastSeenMs: NOW + 120_000,
      retrievalKind: 'live',
    })
    expect(saved?.attempts).toHaveLength(4)
    expect(saved?.complete).toBe(false)
    expect(saved?.attempts[3].errors).toEqual(['Offline'])
  })

  it('restores validated evidence after restart and exports stored observations offline', async () => {
    const { storage, values } = storageFixture()
    const initial = createEvidenceRetriever({
      fetch: vi.fn(async () => response([spotPayload()])),
      now: () => NOW,
      storage,
      timers: timerFixture().timers,
    })
    await initial.retrieveEvidence(request)
    // A different storage adapter simulates a runtime restart, not merely a second reader.
    const restartedStorage: PersistentStorage = {
      read: async (key) => values.get(key) ?? null,
      write: async (key, value) => {
        values.set(key, value)
      },
    }
    const fetch = vi.fn()
    const restarted = createEvidenceRetriever({
      fetch,
      now: () => NOW + 1000,
      storage: restartedStorage,
    })
    const evidence = await restarted.retrieveEvidence(request, { online: false })
    expect(fetch).not.toHaveBeenCalled()
    expect(evidence.reports).toHaveLength(1)
    expect(evidence.reports[0].raw).toEqual(spotPayload())
    expect(evidence.complete).toBe(true)
    expect(evidence.warnings).toContainEqual(expect.stringContaining('Offline'))
    expect(evidence.attempts[evidence.attempts.length - 1]?.stopReason).toBe('offline')
  })

  it('evicts old operation archives explicitly and keeps save failure warnings visible on read', async () => {
    const { storage } = storageFixture()
    const retriever = createEvidenceRetriever({ fetch: vi.fn(), now: () => NOW, storage })
    for (let index = 0; index < 5; index++)
      await retriever.appendLive(
        { ...request, operationId: `operation-${index}` },
        { payload: payload(), startedAtMs: NOW + index, retrievedAtMs: NOW + index },
      )
    expect(await retriever.readEvidence('operation-0', request.call)).toBeNull()
    expect((await retriever.readEvidence('operation-4', request.call))?.warnings).toContainEqual(
      expect.stringContaining('evicted'),
    )
    const failingStorage: PersistentStorage = {
      read: async () => null,
      write: async () => {
        throw new Error('No storage')
      },
    }
    const failing = createEvidenceRetriever({
      fetch: vi.fn(),
      now: () => NOW,
      storage: failingStorage,
    })
    await failing.appendLive(request, { payload: payload(), startedAtMs: NOW, retrievedAtMs: NOW })
    expect(
      (await failing.readEvidence(request.operationId, request.call))?.warnings,
    ).toContainEqual(expect.stringContaining('lost on restart'))
  })

  it('rejects corrupt persisted reports and never lets archive fields bypass parser validation', async () => {
    const { storage, values } = storageFixture()
    values.set(
      evidenceStorageKey,
      JSON.stringify({
        version: 1,
        archives: [
          {
            ...emptyEvidence(request, NOW),
            reports: [{ ...spotPayload(), raw: spotPayload({ callsign: 'W1AW' }) }],
          },
        ],
      }),
    )
    const retriever = createEvidenceRetriever({ fetch: vi.fn(), now: () => NOW, storage })
    const evidence = await retriever.appendLive(request, {
      payload: payload(),
      startedAtMs: NOW,
      retrievedAtMs: NOW,
    })
    expect(evidence.reports).toHaveLength(1)
    expect(evidence.warnings).toContainEqual(expect.stringContaining('could not be restored'))
  })

  it.each(['changed-total', 'repeated-id'])(
    'marks mutable pagination incomplete for %s',
    async (reason) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(response([spotPayload({ id: 1 })], 2))
        .mockResolvedValueOnce(
          response(
            [spotPayload({ id: reason === 'repeated-id' ? 1 : 2 })],
            reason === 'changed-total' ? 1 : 2,
            1,
          ),
        )
      const evidence = await createEvidenceRetriever({
        fetch,
        now: () => NOW,
        timers: timerFixture().timers,
      }).retrieveEvidence(request)
      expect(evidence.complete).toBe(false)
      expect(evidence.attempts[0].complete).toBe(false)
      expect(evidence.warnings).toContainEqual(
        expect.stringContaining('offset pagination may have missed rows'),
      )
      expect(evidence.reports).toHaveLength(reason === 'repeated-id' ? 1 : 2)
    },
  )

  it('reuses partial retrieval for a batch, then retries after one minute and resumes online immediately', async () => {
    let now = NOW
    const fetch = vi.fn().mockResolvedValue({ status: 503, body: 'unavailable' })
    const retriever = createEvidenceRetriever({
      fetch,
      now: () => now,
      timers: timerFixture().timers,
    })
    for (let index = 0; index < 5; index++) await retriever.retrieveEvidence(request)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(
      (await retriever.readEvidence(request.operationId, request.call))?.attempts,
    ).toHaveLength(1)
    now += 60_000
    await retriever.retrieveEvidence(request)
    expect(fetch).toHaveBeenCalledTimes(2)
    await retriever.retrieveEvidence({ ...request, endMs: NOW - 1 }, { online: false })
    await retriever.retrieveEvidence({ ...request, endMs: NOW - 1 }, { online: true })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retains mid-flight live reports without changing frozen operation ownership or accepting invalid future reports', async () => {
    const retriever = createEvidenceRetriever({ fetch: vi.fn(), now: () => NOW })
    const evidence = await retriever.appendLive(request, {
      startedAtMs: NOW,
      retrievedAtMs: NOW + 5000,
      payload: payload({
        spots: [
          spotPayload({ id: 1, timestamp: new Date(NOW + 3000).toISOString() }),
          spotPayload({ id: 2, timestamp: new Date(NOW + 306_000).toISOString() }),
        ],
      }),
    })
    expect(evidence.request.operationId).toBe(request.operationId)
    expect(evidence.request.endMs).toBe(NOW + 5000)
    expect(evidence.reports.map((report) => report.id)).toEqual(['1'])
    expect(evidence.complete).toBe(false)
  })

  it('preserves first provenance and warns when a provider ID changes measurements', async () => {
    const first = appendEvidencePage(emptyEvidence(request, NOW), payload(), {
      kind: 'live',
      startedAtMs: NOW,
      retrievedAtMs: NOW,
      offset: 0,
      status: 200,
    }).evidence
    const second = appendEvidencePage(first, payload({ spots: [spotPayload({ snr: 2 })] }), {
      kind: 'history',
      startedAtMs: NOW + 10,
      retrievedAtMs: NOW + 10,
      offset: 0,
      status: 200,
    }).evidence
    expect(second.reports).toHaveLength(1)
    expect(second.reports[0]).toMatchObject({
      snrDb: 2,
      firstSeenMs: NOW,
      lastSeenMs: NOW + 10,
      retrievalKind: 'live',
    })
    expect(second.warnings).toContainEqual(expect.stringContaining('observation ID changed fields'))
  })

  it('retains exact fractional-minute range boundaries and excludes the rounded query padding', () => {
    const scope = { ...request, startMs: request.startMs + 123, endMs: request.endMs - 456 }
    const rows = [scope.startMs, scope.endMs, scope.startMs - 1, scope.endMs + 1].map(
      (time, index) => spotPayload({ id: index + 1, timestamp: new Date(time).toISOString() }),
    )
    const result = appendEvidencePage(emptyEvidence(scope, NOW), payload({ spots: rows }), {
      kind: 'history',
      startedAtMs: NOW,
      retrievedAtMs: NOW,
      offset: 0,
      status: 200,
    })
    expect(result.evidence.reports.map((report) => report.id)).toEqual(['1', '2'])
    expect(result.page.filteredRows).toBe(2)
  })

  it('does not let a slow history completion overwrite newer live measurements during a serialized merge', async () => {
    const older = appendEvidencePage(emptyEvidence(request, NOW), payload(), {
      kind: 'history',
      startedAtMs: NOW,
      retrievedAtMs: NOW,
      offset: 0,
      status: 200,
    }).evidence
    const newer = appendEvidencePage(
      older,
      payload({ spots: [spotPayload({ snr: 25, spotter_grid: 'FN42' })] }),
      { kind: 'live', startedAtMs: NOW + 100, retrievedAtMs: NOW + 100, offset: 0, status: 200 },
    ).evidence
    const store = createEvidenceStore()
    await store.update(newer)
    await store.update(older)
    const result = await store.read(request.operationId, request.call)
    expect(result?.reports[0]).toMatchObject({
      snrDb: 25,
      receiverGrid: 'FN42',
      lastSeenMs: NOW + 100,
      firstSeenMs: NOW,
      raw: { snr: 25, spotter_grid: 'FN42' },
    })
  })

  it('keeps raw and normalized values together when an inconsistent page repeats an ID', () => {
    const result = appendEvidencePage(
      emptyEvidence(request, NOW),
      payload({
        spots: [
          spotPayload({ id: 1, snr: 19, timestamp: new Date(NOW - 60_000).toISOString() }),
          spotPayload({ id: 1, snr: 2, timestamp: new Date(NOW).toISOString() }),
        ],
      }),
      { kind: 'history', startedAtMs: NOW, retrievedAtMs: NOW, offset: 0, status: 200 },
    )
    expect(result.evidence.reports).toHaveLength(1)
    expect(result.evidence.reports[0]).toMatchObject({
      snrDb: 2,
      timeMs: NOW,
      raw: { snr: 2, timestamp: new Date(NOW).toISOString() },
    })
    expect(result.page.duplicateRows).toBe(1)
  })
})
