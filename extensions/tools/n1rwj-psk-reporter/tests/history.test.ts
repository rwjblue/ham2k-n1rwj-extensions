import type { FetchResponse, JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createReportStore } from '../src/data/store.ts'
import { createHistoryClient, type HistoryHost, historyUrl } from '../src/history/client.ts'
import { historyLimit, parseHistoryXml } from '../src/history/parser.ts'

const initial = Date.UTC(2026, 8, 24, 18)
const receiverIds = ['SWL', 'FWG', 'I0-1589', 'US-E-015']
const row = (attrs = '') =>
  `<receptionReport senderCallsign="N1RWJ" receiverCallsign="CU3AT" senderLocator="FN42" receiverLocator="HM68" frequency="14074000" mode="FT8" sNR="-12" flowStartSeconds="${initial / 1000 - 30}" ${attrs}/>`
const xml = (rows = row()) =>
  `<?xml version="1.0"?><pskreporter><status code="0"/>${rows}</pskreporter>`
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function setup(storage = new Map<string, JSONValue>()) {
  let time = initial
  const host = {
    fetch: vi.fn<HistoryHost['fetch']>(async () => ({ status: 200, body: xml() })),
    read: vi.fn<HistoryHost['read']>(async (key) => storage.get(key) ?? null),
    write: vi.fn<HistoryHost['write']>(async (key, value) => {
      storage.set(key, value)
    }),
  }
  const store = createReportStore()
  const ingest = vi.fn((reports: ReturnType<typeof parseHistoryXml>['reports']) => {
    for (const report of reports) store.ingestReport(report, time)
  })
  const client = createHistoryClient(host, ingest, () => time)
  const observe = (call = 'N1RWJ', window = 15, connected = true, online = true) =>
    client.observe(call, 'outgoing', window, connected, online)
  const advance = (ms: number) => {
    time += ms
  }
  return { host, client, observe, advance, store, ingest, storage, now: () => time }
}

describe('PSK history XML', () => {
  it('reads metadata, entities, single quotes, both roots and missing optional fields', () => {
    const result = parseHistoryXml(xml(row('senderCountry="A &amp; B"')))
    expect(result).toMatchObject({
      incomplete: false,
      reports: [
        {
          band: '20m',
          mode: 'FT8',
          snrDb: -12,
          timeMs: initial - 30_000,
          receiver: { call: 'CU3AT', location: { grid: 'HM68' } },
        },
      ],
    })
    const minimal = `<receptionReports><receptionReport senderCallsign='N1RW&#74;' receiverCallsign='W1AW' frequency='7074000' flowStartSeconds='${initial / 1000}'></receptionReport></receptionReports>`
    expect(parseHistoryXml(minimal).reports[0]).toMatchObject({
      band: '40m',
      mode: 'UNKNOWN',
      transmitter: { call: 'N1RWJ' },
    })
    expect(parseHistoryXml(minimal).reports[0].receiver.location).toBeUndefined()
    expect(parseHistoryXml('<pskreporter/>').reports).toEqual([])
  })
  it.each(receiverIds)('retains receiver ID %s with or without a valid locator', (call) => {
    const located = row().replace('receiverCallsign="CU3AT"', `receiverCallsign="${call}"`)
    const result = parseHistoryXml(
      xml(
        located +
          located.replace('receiverLocator="HM68"', '') +
          located.replace('receiverLocator="HM68"', 'receiverLocator="ZZ99"'),
      ),
    )
    expect(result.incomplete).toBe(false)
    expect(result.reports.map((report) => report.receiver.call)).toEqual([call, call, call])
    expect(result.reports[0].receiver.location).toMatchObject({
      grid: 'HM68',
      source: 'reported-grid',
    })
    expect(result.reports[1].receiver.location).toBeUndefined()
    expect(result.reports[2].receiver.location).toBeUndefined()
  })
  it.each([
    '<html><body>Just a moment...</body></html>',
    '<pskreporter><error message="busy"/></pskreporter>',
    '<pskreporter><status></pskreporter>',
    '<pskreporter/><pskreporter/>',
    '<pskreporter><',
    '<!DOCTYPE pskreporter><pskreporter/>',
    xml(row('country="&external;"')),
    xml(row('mode="FT4"')),
    ' '.repeat(2_000_001),
  ])('rejects errors, challenges and malformed documents', (body) => {
    expect(() => parseHistoryXml(body)).toThrow('History unavailable')
  })
  it('flags truncated or unsupported rows without inventing reports', () => {
    expect(parseHistoryXml(xml('<receptionReport bad="yes"/>'))).toEqual({
      reports: [],
      incomplete: true,
    })
    expect(parseHistoryXml(xml(row().repeat(historyLimit))).incomplete).toBe(true)
  })
})

describe('shared backfill scheduling', () => {
  it.each([1, 3, 5, 10, 45])(
    'queries, filters and reloads the %i-minute history window',
    async (minutes) => {
      const s = setup()
      const rowAt = (receiver: string, secondsAgo: number) =>
        row()
          .replace('receiverCallsign="CU3AT"', `receiverCallsign="${receiver}"`)
          .replace(String(initial / 1000 - 30), String(initial / 1000 - secondsAgo))
      s.host.fetch.mockResolvedValue({
        status: 200,
        body: xml(row() + rowAt('W1AW', minutes * 60) + rowAt('W1NT', minutes * 60 + 1)),
      })
      s.observe('N1RWJ', minutes)
      await flush()
      expect(s.host.fetch).toHaveBeenCalledTimes(1)
      expect(s.host.fetch.mock.calls[0][0]).toContain(`flowStartSeconds=-${minutes * 60}&`)
      expect(s.ingest.mock.calls[0][0].map((report) => report.receiver.call)).toEqual([
        'CU3AT',
        'W1AW',
      ])
      await s.client.force('N1RWJ', 'outgoing', minutes, true)
      expect(s.host.fetch).toHaveBeenCalledTimes(2)
      expect(s.host.fetch.mock.calls[1][0]).toBe(s.host.fetch.mock.calls[0][0])
    },
  )
  it('broadens a one-minute history window when a 45-minute reload is requested', async () => {
    const s = setup()
    s.observe('N1RWJ', 1)
    await flush()
    await s.client.force('N1RWJ', 'outgoing', 45, true)
    expect(s.host.fetch.mock.calls.map(([url]) => url)).toEqual([
      historyUrl('N1RWJ', 'outgoing', 1),
      historyUrl('N1RWJ', 'outgoing', 45),
    ])
  })
  it('queries and reloads an exact incoming receiver ID while retaining transmitter validation', async () => {
    const s = setup()
    const receiver = 'US-E-015'
    s.host.fetch.mockResolvedValue({
      status: 200,
      body: xml(row().replace('CU3AT', receiver) + row()),
    })
    s.client.observe(receiver, 'incoming', 15, true, true)
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    expect(s.host.fetch.mock.calls[0][0]).toContain(`receiverCallsign=${receiver}&`)
    expect(s.store.snapshot(initial, 15).reports.map((report) => report.receiver.call)).toEqual([
      receiver,
    ])
    await s.client.force(receiver, 'incoming', 15, true)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    s.client.observe(receiver, 'outgoing', 15, true, true)
    await s.client.force(receiver, 'outgoing', 15, true)
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
  })
  it('loads receiver IDs without callsign syntax without an incomplete-history warning', async () => {
    const s = setup()
    const rows = receiverIds
      .map((call, index) => {
        const report = row().replace('receiverCallsign="CU3AT"', `receiverCallsign="${call}"`)
        return index < 2 ? report : report.replace('receiverLocator="HM68"', '')
      })
      .join('')
    s.host.fetch.mockResolvedValue({ status: 200, body: xml(rows) })
    s.observe()
    await flush()
    const reports = s.store.snapshot(initial, 15).reports
    expect(reports.map((report) => report.receiver.call)).toEqual(receiverIds)
    expect(reports.map((report) => report.receiver.location?.grid)).toEqual([
      'HM68',
      'HM68',
      undefined,
      undefined,
    ])
    expect(s.observe()).toMatchObject({
      message: 'Recent history loaded',
      pending: false,
      warning: undefined,
    })
  })
  it('fetches startup history once across placements and merges without overwriting newer live reports', async () => {
    const s = setup()
    const live = parseHistoryXml(xml()).reports[0]
    s.store.ingestReport({ ...live, timeMs: initial, snrDb: -25 }, initial)
    s.observe()
    s.observe()
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    expect(s.host.fetch.mock.calls[0][0]).toContain(
      'senderCallsign=N1RWJ&flowStartSeconds=-900&rptlimit=1000',
    )
    expect(s.host.fetch.mock.calls[0][1]).toEqual({
      headers: { Accept: 'application/xml, text/xml' },
    })
    expect(s.store.snapshot(initial, 15).reports).toHaveLength(1)
    expect(s.store.snapshot(initial, 15).reports[0].snrDb).toBe(-25)
    for (let i = 0; i < 100; i++) {
      s.advance(5000)
      s.observe()
      await flush()
    }
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
  })
  it('queues other calls globally, cancels hidden work, and retries after a resume or larger window', async () => {
    const s = setup()
    s.observe()
    await flush()
    s.observe('W1AW')
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    s.advance(300_000)
    s.observe('N1RWJ', 60)
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.host.fetch.mock.calls[1][0]).toContain('flowStartSeconds=-3600')
    s.advance(5000)
    s.observe('N1RWJ', 60, false)
    s.advance(5000)
    expect(s.observe('N1RWJ', 60).message).toContain('gap')
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
  })
  it('restores cooldown across extension reloads but force reload bypasses it', async () => {
    const s = setup()
    s.observe()
    await flush()
    const reloaded = setup(s.storage)
    reloaded.observe()
    await flush()
    expect(reloaded.host.fetch).not.toHaveBeenCalled()
    await reloaded.client.force('N1RWJ', 'outgoing', 15, true)
    expect(reloaded.host.fetch).toHaveBeenCalledTimes(1)
    reloaded.observe()
    await flush()
    expect(reloaded.host.fetch).toHaveBeenCalledTimes(1)
  })
  it('coalesces repeated force clicks and serializes a different callsign', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(response.promise)
    s.observe()
    s.observe('W1AW')
    await flush()
    const first = s.client.force('N1RWJ', 'outgoing', 15, true)
    const duplicate = s.client.force('N1RWJ', 'outgoing', 15, true)
    const other = s.client.force('W1AW', 'outgoing', 15, true)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    response.resolve({ status: 200, body: xml() })
    await Promise.all([first, duplicate, other])
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.host.fetch.mock.calls[1][0]).toContain('senderCallsign=W1AW')
  })
  it('keeps a slow request pending across visible ticks and measures its completed duration', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(response.promise)
    expect(s.observe()).toMatchObject({ message: 'Loading recent reports', pending: true })
    await flush()
    for (let second = 1; second <= 45; second++) {
      s.advance(1000)
      expect(s.observe()).toMatchObject({ pending: true, lastRequestDurationMs: undefined })
      await flush()
    }
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    response.resolve({ status: 200, body: xml() })
    await flush()
    expect(s.observe()).toMatchObject({
      message: 'Recent history loaded',
      pending: false,
      lastRequestDurationMs: 45_000,
      lastRequestDurationUpperBound: false,
    })
    expect(s.ingest).toHaveBeenCalledTimes(1)
  })
  it('measures duration through the next real-clock sample without extrapolating from the virtual clock', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    const realStart = initial + 24 * 60 * 60_000
    s.host.fetch.mockReturnValueOnce(response.promise)
    const observe = (realNowMillis?: number) =>
      s.client.observe('N1RWJ', 'outgoing', 15, true, true, realNowMillis)
    expect(observe(realStart).pending).toBe(true)
    await flush()
    expect(observe(realStart + 2000).pending).toBe(true)
    response.resolve({ status: 200, body: xml() })
    await flush()
    // Date is deliberately frozen here. Only a fresh host sample can bound
    // a request that began with a supplied real clock.
    expect(observe()).toMatchObject({ pending: false, lastRequestDurationMs: undefined })
    expect(observe(realStart + 3000)).toMatchObject({
      pending: false,
      lastRequestDurationMs: 3000,
      lastRequestDurationUpperBound: true,
    })
    s.advance(15_000)
    expect(observe(realStart + 4000).lastRequestDurationMs).toBe(3000)
  })
  it('marks queued forced reloads pending and coalesces each callsign through a shared queue', async () => {
    const s = setup()
    const responses = [
      deferred<FetchResponse>(),
      deferred<FetchResponse>(),
      deferred<FetchResponse>(),
    ]
    for (const response of responses) s.host.fetch.mockReturnValueOnce(response.promise)
    s.observe()
    expect(s.observe('W1AW').pending).toBe(false)
    expect(s.observe('W2AA').pending).toBe(false)
    await flush()
    const first = s.client.force('W1AW', 'outgoing', 15, true)
    const duplicate = s.client.force('W1AW', 'outgoing', 15, true)
    const next = s.client.force('W2AA', 'outgoing', 15, true)
    const nextDuplicate = s.client.force('W2AA', 'outgoing', 15, true)
    expect(s.observe('W1AW').pending).toBe(true)
    expect(s.observe('W2AA').pending).toBe(true)
    expect(s.host.fetch).toHaveBeenCalledTimes(1)
    responses[0].resolve({ status: 200, body: xml() })
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(2)
    expect(s.host.fetch.mock.calls[1][0]).toContain('senderCallsign=W1AW')
    expect(s.observe('W2AA').pending).toBe(true)
    const during = s.client.force('W1AW', 'outgoing', 15, true)
    responses[1].resolve({ status: 200, body: xml() })
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(3)
    expect(s.host.fetch.mock.calls[2][0]).toContain('senderCallsign=W2AA')
    responses[2].resolve({ status: 200, body: xml() })
    await Promise.all([first, duplicate, next, nextDuplicate, during])
    expect(s.observe('W1AW').pending).toBe(false)
    expect(s.observe('W2AA').pending).toBe(false)
    expect(s.host.fetch).toHaveBeenCalledTimes(3)
  })
  it('does not start a queued forced reload after it becomes hidden, offline, or stopped', async () => {
    for (const action of ['hidden', 'offline', 'stop']) {
      const s = setup()
      const response = deferred<FetchResponse>()
      s.host.fetch.mockReturnValueOnce(response.promise)
      s.observe()
      s.observe('W1AW')
      await flush()
      const forced = s.client.force('W1AW', 'outgoing', 15, true)
      if (action === 'hidden') s.advance(31_000)
      if (action === 'offline') s.observe('W1AW', 15, false, false)
      if (action === 'stop') s.client.stop()
      response.resolve({ status: 200, body: xml() })
      await forced
      expect(s.host.fetch).toHaveBeenCalledTimes(1)
    }
  })
  it('reports a bounded host timeout diagnostic and suppresses it while retrying', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(response.promise)
    s.observe()
    await flush()
    s.advance(16_000)
    response.reject({ message: `TimeoutException\n${'unavailable '.repeat(100)}` })
    await flush()
    const failed = s.observe()
    expect(failed).toMatchObject({
      pending: false,
      lastRequestDurationMs: 16_000,
      lastRequestDurationUpperBound: false,
    })
    expect(failed.warning).toContain('request timed out in the host; no HTTP response')
    expect(failed.warning).toContain('Host detail: TimeoutException unavailable')
    expect(failed.warning).not.toContain('\n')
    expect(failed.warning?.length).toBeLessThan(450)
    const retried = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(retried.promise)
    const force = s.client.force('N1RWJ', 'outgoing', 15, true)
    expect(s.observe()).toMatchObject({
      pending: true,
      warning: undefined,
      lastRequestDurationMs: undefined,
    })
    await flush()
    retried.resolve({ status: 200, body: xml() })
    await force
    expect(s.observe()).toMatchObject({ pending: false, warning: undefined })
  })
  it('filters exact calls, direction, stale/future reports and retains unlocated stations', async () => {
    const s = setup()
    const mixed =
      row() +
      row().replace('N1RWJ', 'N1RWJ/P') +
      row().replace('N1RWJ', 'W1AW') +
      row().replace(String(initial / 1000 - 30), String(initial / 1000 - 901)) +
      row().replace(String(initial / 1000 - 30), String(initial / 1000 + 90))
    s.host.fetch.mockResolvedValue({ status: 200, body: xml(mixed) })
    s.client.observe('CU3AT', 'incoming', 15, true, true)
    await flush()
    expect(s.host.fetch.mock.calls[0][0]).toContain('receiverCallsign=CU3AT')
    expect(s.ingest.mock.calls[0][0]).toHaveLength(3)
    s.observe()
    await s.client.force('N1RWJ', 'outgoing', 15, true)
    expect(s.ingest.mock.calls[1][0]).toHaveLength(1)
  })
  it('backs off errors, preserves reports and lets force retry without resetting automatic limits', async () => {
    const s = setup()
    s.observe()
    await flush()
    s.host.fetch.mockResolvedValue({ status: 429, body: 'slow down' })
    await s.client.force('N1RWJ', 'outgoing', 15, true)
    expect(s.observe().warning).toContain('429')
    expect(s.store.snapshot(initial, 15).reports).toHaveLength(1)
    s.advance(300_000)
    s.observe()
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(3)
    s.advance(300_000)
    s.observe()
    await flush()
    expect(s.host.fetch).toHaveBeenCalledTimes(3)
    s.host.fetch.mockResolvedValue({ status: 200, body: '<html>challenge</html>' })
    await s.client.force('N1RWJ', 'outgoing', 15, true)
    expect(s.observe().warning).toContain('unsupported XML')
  })
  it('does not send while offline or without durable cooldown storage', async () => {
    const s = setup()
    s.observe('N1RWJ', 15, false, false)
    await s.client.force('N1RWJ', 'outgoing', 15, false)
    expect(s.host.fetch).not.toHaveBeenCalled()
    s.host.write.mockRejectedValue(new Error('storage failed'))
    s.observe()
    await flush()
    expect(s.host.fetch).not.toHaveBeenCalled()
    expect(s.observe().warning).toContain('storage')
  })
  it('ignores results after stop, loss of visibility, or offline transition', async () => {
    for (const action of ['stop', 'hidden', 'offline']) {
      const s = setup()
      const response = deferred<FetchResponse>()
      s.host.fetch.mockReturnValueOnce(response.promise)
      s.observe()
      await flush()
      if (action === 'stop') s.client.stop()
      if (action === 'hidden') s.advance(31_000)
      if (action === 'offline') s.observe('N1RWJ', 15, false, false)
      response.resolve({ status: 200, body: xml() })
      await flush()
      expect(s.ingest).not.toHaveBeenCalled()
    }
  })
  it('keeps a larger-window request pending if settings change during a fetch', async () => {
    const s = setup()
    const response = deferred<FetchResponse>()
    s.host.fetch.mockReturnValueOnce(response.promise)
    s.observe()
    await flush()
    s.observe('N1RWJ', 60)
    response.resolve({ status: 200, body: xml() })
    await flush()
    expect(s.observe('N1RWJ', 60).message).toContain('gap')
    s.advance(300_000)
    s.observe('N1RWJ', 60)
    await flush()
    expect(s.host.fetch.mock.calls[1][0]).toContain('flowStartSeconds=-3600')
  })
})

it('keeps slashes in exact portable HTTP queries', () => {
  expect(historyUrl('EA8/N1RWJ/P', 'outgoing', 15)).toContain('senderCallsign=EA8%2FN1RWJ%2FP&')
})
