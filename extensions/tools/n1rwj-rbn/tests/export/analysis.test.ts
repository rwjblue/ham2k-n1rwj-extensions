import type { JSONValue } from '@ham2k/extension-sdk'
import { gridToLocation } from '@ham2k/lib-geo-tools'
import { describe, expect, it } from 'vitest'
import { buildReceptionAnalysis, explicitContactLocation } from '../../src/export/analysis.ts'
import type { RbnEvidence, RbnEvidenceReport } from '../../src/export/evidence.ts'

const start = Date.UTC(2026, 9, 4, 14)
const minute = 60_000

function report(
  id: string,
  minutes: number,
  values: Partial<RbnEvidenceReport> = {},
): RbnEvidenceReport {
  const [latitude, longitude] = gridToLocation('FN42')
  return {
    id,
    call: 'N1RWJ',
    receiver: 'SK-A',
    receiverGrid: 'FN42',
    band: '20m',
    mode: 'CW',
    frequencyKhz: 14060,
    snrDb: 20,
    wpm: 20,
    timeMs: start + minutes * minute,
    receiverLatitude: latitude,
    receiverLongitude: longitude,
    country: null,
    raw: { id, unknownSourceField: 'retained' },
    retrievedAtMs: start + 30 * minute,
    firstSeenMs: start + 30 * minute,
    lastSeenMs: start + 30 * minute,
    retrievalKind: 'history',
    receiverLocationSource: 'provider-grid',
    ...values,
  }
}

function evidence(reports: RbnEvidenceReport[]): RbnEvidence {
  return {
    schemaVersion: 1,
    provider: 'vail-rerbn',
    request: {
      operationId: 'op',
      call: 'N1RWJ',
      startMs: start + minute,
      endMs: start + 30 * minute,
      origin: { latitude: 41, longitude: -72, label: 'FN41' },
    },
    retrievedAtMs: start + 30 * minute,
    reports,
    attempts: [],
    complete: true,
    warnings: [],
  }
}

function qso(values: Record<string, JSONValue> = {}): Record<string, JSONValue> {
  return {
    uuid: 'qso-1',
    our: { call: 'N1RWJ' },
    their: { call: 'K1ABC', grid: 'FN42' },
    freq: 14060.5,
    band: '20m',
    mode: 'CW',
    startAtMillis: start + 15 * minute,
    ...values,
  }
}

describe('RBN reception export analysis', () => {
  it('uses UTC quarter-hours and deduplicates before receiver/band/mode statistics', () => {
    const first = report('1', 7, { snrDb: 0 })
    const source = evidence([
      first,
      report('2', 14.99, { snrDb: 10 }),
      report('1', 7, { snrDb: 100 }),
      report('3', 15, { snrDb: null, receiverLatitude: null, receiverLongitude: null }),
      report('4', 7, { mode: 'RTTY', snrDb: 20 }),
      report('5', 7, { receiver: 'SK-B', band: '40m', snrDb: -2 }),
    ])
    const analysis = buildReceptionAnalysis(source)
    expect(analysis.counts).toEqual({ observations: 5, receivers: 2, unknownSnr: 1, unlocated: 1 })
    expect(analysis.timeBins).toHaveLength(4)
    expect(
      analysis.timeBins.find(
        (bin) => bin.receiver === 'SK-A' && bin.mode === 'CW' && bin.startMs === start,
      ),
    ).toMatchObject({
      startMs: start,
      endMs: start + 15 * minute,
      count: 2,
      snrCount: 2,
      medianSnrDb: 5,
      minSnrDb: 0,
      maxSnrDb: 10,
      latest: { id: '2' },
    })
    expect(analysis.timeBins.find((bin) => bin.startMs === start + 15 * minute)).toMatchObject({
      count: 1,
      snrCount: 0,
      medianSnrDb: null,
      minSnrDb: null,
      maxSnrDb: null,
    })
    expect(
      analysis.receiverSummaries.find((bin) => bin.receiver === 'SK-A' && bin.mode === 'CW'),
    ).toMatchObject({ count: 3, snrCount: 2, medianSnrDb: 5 })
    expect(analysis.reports.find((row) => row.id === '1')?.raw).toEqual(first.raw)
    expect(source.reports).toHaveLength(6)
    expect(source.reports[0]).toBe(first)
  })

  it('retains strongest and farthest separately without rewarding a distant weak report', () => {
    const source = evidence([
      report('1', 2, { snrDb: 32 }),
      report('2', 4, {
        receiver: 'SK-G',
        receiverGrid: 'JO31',
        receiverLatitude: 51.5,
        receiverLongitude: 7,
        snrDb: 1,
      }),
      report('3', 5, {
        receiver: 'UNKNOWN',
        receiverGrid: null,
        receiverLatitude: null,
        receiverLongitude: null,
        snrDb: null,
      }),
    ])
    const analysis = buildReceptionAnalysis(source)
    expect(analysis.highlights.strongest?.report.id).toBe('1')
    expect(analysis.highlights.farthest?.report.id).toBe('2')
    expect(analysis.highlights.farthest?.report.snrDb).toBe(1)
    expect(analysis.highlights.farthest?.distanceKm).toBeGreaterThan(5000)
    expect(
      analysis.receiverSummaries.find((summary) => summary.receiver === 'UNKNOWN')?.distanceKm,
    ).toBeNull()
    delete source.request.origin
    expect(buildReceptionAnalysis(source).highlights.farthest).toBeNull()
    expect(buildReceptionAnalysis(source).highlights.strongest?.report.id).toBe('1')
  })

  it('keeps empty or incomplete collections honest and leaves missing measurements null', () => {
    const source = { ...evidence([]), complete: false, warnings: ['Request timed out'] }
    const analysis = buildReceptionAnalysis(source)
    expect(analysis).toMatchObject({
      reports: [],
      timeBins: [],
      receiverSummaries: [],
      firstObservationMs: null,
      lastObservationMs: null,
      complete: false,
      highlights: { strongest: null, farthest: null },
      counts: { observations: 0, receivers: 0 },
    })
    analysis.warnings.push('Only the copied list changes')
    expect(source.warnings).toEqual(['Request timed out'])
  })

  it('chooses the nearest eligible receiver and its newest preceding record, even with null SNR', () => {
    const source = evidence([
      report('1', 7, { snrDb: 5 }),
      report('2', 12, { snrDb: null }),
      report('3', 16, { snrDb: 90 }), // Future reception cannot explain the earlier contact.
      report('4', 14, { receiver: 'SK-B', receiverLatitude: 42.6, snrDb: 50 }),
      report('5', 14, { call: 'N1RWJ/P', snrDb: 70 }),
      report('6', 14, { mode: 'RTTY', snrDb: 80 }),
      report('7', 14, { band: '40m', snrDb: 60 }),
    ])
    const context = buildReceptionAnalysis(source, [qso()]).qsoContext[0]
    expect(context).toMatchObject({
      status: 'matched',
      receiver: 'SK-A',
      reportId: '2',
      reportTimeMs: start + 12 * minute,
      ageSeconds: 180,
      receiverToContactKm: 0,
      frequencyDifferenceKhz: -0.5,
      snrDb: null,
      firstSeenMs: start + 30 * minute,
      contactLocation: { source: 'explicit-grid', grid: 'FN42' },
    })
    expect(context.receiverLocationPrecision).toContain('4-character grid center')
    expect(context.firstSeenMs).toBeGreaterThan(start + 15 * minute)
  })

  it('enforces the ten-minute age and 250 km geographic limits', () => {
    const contact = qso({ their: { call: 'K1ABC', lat: 0, lon: 0 } })
    const near = report('near', 5, {
      receiverGrid: null,
      receiverLocationSource: null,
      receiverLatitude: 2,
      receiverLongitude: 0,
    })
    const source = evidence([near])
    expect(buildReceptionAnalysis(source, [contact]).qsoContext[0]).toMatchObject({
      status: 'matched',
      ageSeconds: 600,
      receiver: 'SK-A',
    })
    near.timeMs--
    expect(buildReceptionAnalysis(source, [contact]).qsoContext[0].status).toBe('unmatched')
    near.timeMs++
    near.receiverLatitude = 3
    expect(buildReceptionAnalysis(source, [contact]).qsoContext[0].status).toBe('unmatched')
  })

  it('rejects guessed, centroid, invalid, and cleared locations without fabricating contact SNR', () => {
    const their: Record<string, JSONValue>[] = [
      { call: 'K1ABC', guess: { grid: 'FN42', lat: 42.5, lon: -71 } },
      { call: 'K1ABC', lat: 42.5, lon: -71, locSource: 'prefix' },
      { call: 'K1ABC', grid: 'ZZ99', lat: 91, lon: -71 },
      { call: 'K1ABC', grid: '', guess: { grid: 'FN42' } },
    ]
    for (const info of their) {
      const context = buildReceptionAnalysis(evidence([report('1', 12)]), [qso({ their: info })])
        .qsoContext[0]
      expect(context).toMatchObject({
        status: 'unmatched',
        contactLocation: null,
        snrDb: null,
        receiverToContactKm: null,
        reportId: null,
      })
    }
  })

  it('preserves typed-grid precision while accepting a separately logged coordinate pair', () => {
    const [lat, lon] = gridToLocation('FN42ab')
    expect(explicitContactLocation({ grid: 'fn42ab', lat, lon })).toMatchObject({
      source: 'explicit-grid',
      grid: 'FN42AB',
    })
    expect(explicitContactLocation({ grid: 'FN42ab', lat: lat + 0.01, lon })).toMatchObject({
      source: 'explicit-coordinates',
      latitude: lat + 0.01,
    })
    expect(
      explicitContactLocation({ grid: 'FN42', lat: 0, lon: 0, locSource: 'prefix' }),
    ).toMatchObject({ source: 'explicit-grid', grid: 'FN42', latitude: 42.5, longitude: -71 })
  })

  it('does not match other station identities, missing QSO metadata, or deleted QSOs', () => {
    const source = evidence([report('1', 12)])
    const qsos = [
      qso({ our: { call: 'N1RWJ/P' } }),
      qso({ our: {} }),
      qso({ startAtMillis: null }),
      qso({ mode: '' }),
      qso({ deleted: true }),
      qso({ band: 'event' }),
      qso({ event: { event: 'start' } }),
    ]
    const contexts = buildReceptionAnalysis(source, qsos).qsoContext
    expect(contexts).toHaveLength(4)
    expect(
      contexts.every((context) => context.status === 'unmatched' && context.snrDb === null),
    ).toBe(true)
    expect(
      buildReceptionAnalysis(source, [
        qso({ startAtMillis: null, startAt: '2026-10-04T14:15:00Z', freq: null }),
      ]).qsoContext[0],
    ).toMatchObject({ status: 'matched', ageSeconds: 180, frequencyDifferenceKhz: null })
  })
})
