import type { JSONValue } from '@ham2k/extension-sdk'
import { gridToLocation } from '@ham2k/lib-geo-tools'
import type { Coordinates } from '../model.ts'
import { bearingDegrees, distanceKm, normalizeCall } from '../model.ts'
import type { RbnEvidence, RbnEvidenceReport } from './evidence.ts'

export const RECEPTION_WINDOW_MS = 15 * 60_000
export const QSO_CONTEXT_MAX_AGE_MS = 10 * 60_000
export const QSO_CONTEXT_MAX_DISTANCE_KM = 250

export interface ReceptionSummary {
  call: string
  receiver: string
  receiverGrid: string | null
  band: string
  mode: string
  startMs: number
  endMs: number
  count: number
  snrCount: number
  medianSnrDb: number | null
  minSnrDb: number | null
  maxSnrDb: number | null
  latest: RbnEvidenceReport
  distanceKm: number | null
  bearingDegrees: number | null
}

export interface ReceptionHighlight {
  report: RbnEvidenceReport
  distanceKm: number | null
  bearingDegrees: number | null
}

export interface ReceptionLocation extends Coordinates {
  source: 'explicit-coordinates' | 'explicit-grid'
  grid: string | null
  precision: string
}

/** The SNR belongs to this receiver's preceding report, never to the contact. */
export interface QsoReceptionContext {
  qsoId: string | null
  contactCall: string | null
  stationCall: string | null
  timeMs: number | null
  band: string | null
  mode: string | null
  contactLocation: ReceptionLocation | null
  status: 'matched' | 'unmatched'
  reason: string | null
  reportId: string | null
  receiver: string | null
  receiverGrid: string | null
  receiverLocationSource: string | null
  receiverLocationPrecision: string | null
  reportTimeMs: number | null
  firstSeenMs: number | null
  ageSeconds: number | null
  receiverToContactKm: number | null
  distanceFromOriginKm: number | null
  /** Report frequency minus logged QSO frequency, in kHz. */
  frequencyDifferenceKhz: number | null
  snrDb: number | null
}

export interface ReceptionAnalysis {
  reports: RbnEvidenceReport[]
  timeBins: ReceptionSummary[]
  receiverSummaries: ReceptionSummary[]
  highlights: { strongest: ReceptionHighlight | null; farthest: ReceptionHighlight | null }
  qsoContext: QsoReceptionContext[]
  counts: {
    observations: number
    receivers: number
    /** Distinct observations without a finite SNR. */
    unknownSnr: number
    /** Distinct observations without valid receiver coordinates. */
    unlocated: number
  }
  firstObservationMs: number | null
  lastObservationMs: number | null
  complete: boolean
  warnings: string[]
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function coordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  const lat = finite(latitude)
  const lon = finite(longitude)
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { latitude: lat, longitude: lon }
    : null
}

function grid(value: unknown): string | null {
  const normalized = text(value)?.toUpperCase() ?? ''
  return /^[A-R]{2}\d{2}(?:[A-X]{2}(?:\d{2})?)?$/.test(normalized) ? normalized : null
}

function gridPrecision(value: string): string {
  return `${value.length}-character grid center; actual position within the grid is unknown`
}

function receiverLocation(report: RbnEvidenceReport): Coordinates | null {
  return coordinates(report.receiverLatitude, report.receiverLongitude)
}

/** No country centroids, registered-address guesses, or lookup fallbacks. */
export function explicitContactLocation(value: unknown): ReceptionLocation | null {
  const info = object(value)
  const locator = grid(info.grid)
  const location = info.locSource === 'prefix' ? null : coordinates(info.lat, info.lon)
  if (location) {
    if (locator) {
      const [latitude, longitude] = gridToLocation(locator)
      // Ham2K stores a typed locator's center in lat/lon too. Keep its precision.
      if (
        Math.abs(location.latitude - latitude) < 1e-6 &&
        Math.abs(location.longitude - longitude) < 1e-6
      ) {
        return {
          latitude,
          longitude,
          source: 'explicit-grid',
          grid: locator,
          precision: gridPrecision(locator),
        }
      }
    }
    return {
      ...location,
      source: 'explicit-coordinates',
      grid: locator,
      precision: 'logged coordinate pair; accuracy not supplied',
    }
  }
  if (!locator) return null
  const [latitude, longitude] = gridToLocation(locator)
  return {
    latitude,
    longitude,
    source: 'explicit-grid',
    grid: locator,
    precision: gridPrecision(locator),
  }
}

function chronological(a: RbnEvidenceReport, b: RbnEvidenceReport): number {
  return a.timeMs - b.timeMs || a.id.localeCompare(b.id)
}

function median(values: number[]): number | null {
  if (!values.length) return null
  values.sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

function originFor(evidence: RbnEvidence): Coordinates | null {
  return coordinates(evidence.request.origin?.latitude, evidence.request.origin?.longitude)
}

function highlight(report: RbnEvidenceReport, origin: Coordinates | null): ReceptionHighlight {
  const receiver = receiverLocation(report)
  return {
    report,
    distanceKm: origin && receiver ? distanceKm(origin, receiver) : null,
    bearingDegrees: origin && receiver ? bearingDegrees(origin, receiver) : null,
  }
}

function summarize(
  reports: readonly RbnEvidenceReport[],
  evidence: RbnEvidence,
  quarterHours: boolean,
): ReceptionSummary[] {
  const groups = new Map<string, RbnEvidenceReport[]>()
  for (const report of reports) {
    const start = quarterHours
      ? Math.floor(report.timeMs / RECEPTION_WINDOW_MS) * RECEPTION_WINDOW_MS
      : evidence.request.startMs
    const key = JSON.stringify([report.call, report.receiver, report.band, report.mode, start])
    const group = groups.get(key) ?? []
    group.push(report)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => {
      const latest = group[group.length - 1]
      const snr = group
        .map((report) => finite(report.snrDb))
        .filter((value): value is number => value !== null)
      const startMs = quarterHours
        ? Math.floor(latest.timeMs / RECEPTION_WINDOW_MS) * RECEPTION_WINDOW_MS
        : evidence.request.startMs
      const located = highlight(latest, originFor(evidence))
      return {
        call: latest.call,
        receiver: latest.receiver,
        receiverGrid: latest.receiverGrid,
        band: latest.band,
        mode: latest.mode,
        startMs,
        endMs: quarterHours ? startMs + RECEPTION_WINDOW_MS : evidence.request.endMs,
        count: group.length,
        snrCount: snr.length,
        medianSnrDb: median(snr),
        minSnrDb: snr.length ? snr[0] : null,
        maxSnrDb: snr.length ? snr[snr.length - 1] : null,
        latest,
        distanceKm: located.distanceKm,
        bearingDegrees: located.bearingDegrees,
      }
    })
    .sort(
      (a, b) =>
        a.startMs - b.startMs ||
        a.receiver.localeCompare(b.receiver) ||
        a.band.localeCompare(b.band) ||
        a.mode.localeCompare(b.mode),
    )
}

function qsoTime(qso: Record<string, JSONValue>): number | null {
  const milliseconds = finite(qso.startAtMillis)
  if (milliseconds !== null && Math.abs(milliseconds) <= 8.64e15) return milliseconds
  const iso = text(qso.startAt)
  if (!iso || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(iso)) return null
  return finite(Date.parse(iso))
}

function qsoContext(
  evidence: RbnEvidence,
  reports: readonly RbnEvidenceReport[],
  qso: Record<string, JSONValue>,
): QsoReceptionContext {
  const stationCall = text(object(qso.our).call)
  const contactCall = text(object(qso.their).call)
  const timeMs = qsoTime(qso)
  const band = text(qso.band)?.toLowerCase() ?? null
  const mode = text(qso.mode)?.toUpperCase() ?? null
  const contactLocation = explicitContactLocation(qso.their)
  const context: QsoReceptionContext = {
    qsoId: text(qso.uuid),
    contactCall,
    stationCall,
    timeMs,
    band,
    mode,
    contactLocation,
    status: 'unmatched',
    reason: null,
    reportId: null,
    receiver: null,
    receiverGrid: null,
    receiverLocationSource: null,
    receiverLocationPrecision: null,
    reportTimeMs: null,
    firstSeenMs: null,
    ageSeconds: null,
    receiverToContactKm: null,
    distanceFromOriginKm: null,
    frequencyDifferenceKhz: null,
    snrDb: null,
  }
  if (!stationCall || normalizeCall(stationCall) !== normalizeCall(evidence.request.call)) {
    return { ...context, reason: 'Station callsign does not match the reception evidence' }
  }
  if (timeMs === null || !band || !mode)
    return { ...context, reason: 'QSO time, band, or mode unavailable' }
  if (!contactLocation) return { ...context, reason: 'Explicit contact location unavailable' }
  const latestByReceiver = new Map<string, RbnEvidenceReport>()
  for (const report of reports) {
    if (
      normalizeCall(report.call) !== normalizeCall(stationCall) ||
      report.band.toLowerCase() !== band ||
      report.mode.toUpperCase() !== mode ||
      report.timeMs > timeMs ||
      timeMs - report.timeMs > QSO_CONTEXT_MAX_AGE_MS
    )
      continue
    // Reports are ascending. The newest preceding observation wins, including null SNR.
    latestByReceiver.set(report.receiver, report)
  }
  const candidates = [...latestByReceiver.values()]
    .flatMap((report) => {
      const location = receiverLocation(report)
      if (!location) return []
      const separation = distanceKm(contactLocation, location)
      return separation <= QSO_CONTEXT_MAX_DISTANCE_KM ? [{ report, separation }] : []
    })
    .sort(
      (a, b) =>
        a.separation - b.separation ||
        b.report.timeMs - a.report.timeMs ||
        a.report.receiver.localeCompare(b.report.receiver),
    )
  const candidate = candidates[0]
  if (!candidate)
    return {
      ...context,
      reason: 'No preceding same-band/mode report within 10 minutes and 250 km of the contact',
    }
  const { report, separation } = candidate
  const frequency = finite(qso.freq)
  const receiverGrid = grid(report.receiverGrid)
  return {
    ...context,
    status: 'matched',
    reportId: report.id,
    receiver: report.receiver,
    receiverGrid: report.receiverGrid,
    receiverLocationSource: report.receiverLocationSource,
    receiverLocationPrecision: receiverGrid
      ? gridPrecision(receiverGrid)
      : 'receiver coordinate accuracy unavailable',
    reportTimeMs: report.timeMs,
    firstSeenMs: finite(report.firstSeenMs),
    ageSeconds: (timeMs - report.timeMs) / 1000,
    receiverToContactKm: separation,
    distanceFromOriginKm: highlight(report, originFor(evidence)).distanceKm,
    frequencyDifferenceKhz:
      frequency !== null && frequency > 0 && finite(report.frequencyKhz) !== null
        ? report.frequencyKhz - frequency
        : null,
    snrDb: finite(report.snrDb),
  }
}

/** Pure export-time analysis; source IDs are deduplicated before any statistics. */
export function buildReceptionAnalysis(
  evidence: RbnEvidence,
  qsos: readonly Record<string, JSONValue>[] = [],
): ReceptionAnalysis {
  const distinct = new Map<string, RbnEvidenceReport>()
  for (const report of evidence.reports) {
    if (!distinct.has(report.id)) distinct.set(report.id, report)
  }
  const reports = [...distinct.values()].sort(chronological)
  const origin = originFor(evidence)
  const observations = reports.map((report) => highlight(report, origin))
  const strongest =
    observations
      .filter(({ report }) => finite(report.snrDb) !== null)
      .sort(
        (a, b) =>
          (b.report.snrDb ?? 0) - (a.report.snrDb ?? 0) ||
          b.report.timeMs - a.report.timeMs ||
          a.report.id.localeCompare(b.report.id),
      )[0] ?? null
  const farthest =
    observations
      .filter((value) => value.distanceKm !== null)
      .sort(
        (a, b) =>
          (b.distanceKm ?? 0) - (a.distanceKm ?? 0) ||
          b.report.timeMs - a.report.timeMs ||
          a.report.id.localeCompare(b.report.id),
      )[0] ?? null
  return {
    reports,
    timeBins: summarize(reports, evidence, true),
    receiverSummaries: summarize(reports, evidence, false),
    highlights: { strongest, farthest },
    qsoContext: qsos
      .filter(
        (qso) =>
          qso.deleted !== true &&
          text(qso.band)?.toLowerCase() !== 'event' &&
          !text(object(qso.event).event),
      )
      .map((qso) => qsoContext(evidence, reports, qso)),
    counts: {
      observations: reports.length,
      receivers: new Set(reports.map((report) => report.receiver)).size,
      unknownSnr: reports.filter((report) => finite(report.snrDb) === null).length,
      unlocated: reports.filter((report) => receiverLocation(report) === null).length,
    },
    firstObservationMs: reports[0]?.timeMs ?? null,
    lastObservationMs: reports[reports.length - 1]?.timeMs ?? null,
    complete: evidence.complete,
    warnings: [...evidence.warnings],
  }
}
