import type { JSONValue } from '@ham2k/extension-sdk'
import { isValidCall, normalizeCall, type RbnSnapshot } from '../model.ts'
import { parseRbnPayload, record } from './parser.ts'

export const snapshotKey = 'my-signal-snapshots-v1'
export const backoffKey = 'rbn-rate-limit-v1'
const maxAge = 120 * 60_000

function timestamp(value: unknown, now: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= now
}

export function readBackoff(value: unknown, now: number): number {
  // Reject impossible timestamps rather than resetting a valid delay each render.
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > now &&
    value <= now + 24 * 60 * 60_000
    ? value
    : 0
}

/** Revalidate saved reports with the network parser before using them in a scene. */
export function decodeSnapshots(
  value: JSONValue | null,
  now: number,
): { snapshots: RbnSnapshot[]; rateLimitedUntil: number; pendingRetryDelayMs: number } {
  if (value === null) return { snapshots: [], rateLimitedUntil: 0, pendingRetryDelayMs: 0 }
  if (typeof value !== 'string' || value.length > 2_000_000)
    throw new Error('Invalid saved reports')
  const data = record(JSON.parse(value))
  if (data?.version !== 1 || !Array.isArray(data.snapshots) || data.snapshots.length > 8)
    throw new Error('Invalid saved reports')
  const snapshots: RbnSnapshot[] = []
  for (const item of data.snapshots) {
    const saved = record(item)
    if (
      !saved ||
      typeof saved.call !== 'string' ||
      !isValidCall(saved.call) ||
      typeof saved.windowMinutes !== 'number' ||
      !Number.isInteger(saved.windowMinutes) ||
      saved.windowMinutes < 5 ||
      saved.windowMinutes > 120 ||
      !timestamp(saved.lastAttemptMs, now) ||
      saved.lastAttemptMs < now - maxAge ||
      (saved.lastSuccessMs !== null && !timestamp(saved.lastSuccessMs, now)) ||
      !Array.isArray(saved.reports) ||
      saved.reports.length > 500
    )
      continue
    const call = normalizeCall(saved.call)
    const windowMinutes = saved.windowMinutes
    const successTime = saved.lastSuccessMs ?? 0
    const rows = saved.reports
      .map((item) => {
        const row = record(item)
        const time = row?.timeMs
        if (
          !row ||
          typeof time !== 'number' ||
          !Number.isSafeInteger(time) ||
          time < now - windowMinutes * 60_000 ||
          time > now + 300_000 ||
          time > successTime + 300_000
        )
          return null
        return {
          id: row.id,
          callsign: row.call,
          spotter: row.receiver,
          frequency: row.frequencyKhz,
          mode: row.mode,
          snr: row.snrDb,
          wpm: row.wpm,
          timestamp: new Date(time).toISOString(),
        }
      })
      .filter((row) => row !== null)
    const parsed = parseRbnPayload(
      { spots: rows, total: rows.length, offset: 0, limit: 500 },
      call,
      saved.windowMinutes,
      now,
    )
    const coordinates = new Map(
      saved.reports.map((item) => {
        const row = record(item)
        return [row?.id, row] as const
      }),
    )
    for (const report of parsed.reports) {
      const row = coordinates.get(report.id)
      if (
        typeof row?.receiverLatitude === 'number' &&
        Number.isFinite(row.receiverLatitude) &&
        Math.abs(row.receiverLatitude) <= 90 &&
        typeof row.receiverLongitude === 'number' &&
        Number.isFinite(row.receiverLongitude) &&
        Math.abs(row.receiverLongitude) <= 180
      ) {
        report.receiverLatitude = row.receiverLatitude
        report.receiverLongitude = row.receiverLongitude
      }
    }
    const pendingTiming = record(saved.pendingRequestTiming)
    snapshots.push({
      call,
      windowMinutes: saved.windowMinutes,
      reports: saved.lastSuccessMs === null ? [] : parsed.reports,
      status: saved.lastSuccessMs === null ? 'error' : 'stale',
      lastAttemptMs: saved.lastAttemptMs,
      lastSuccessMs: saved.lastSuccessMs,
      ...(typeof saved.lastRequestDurationMs === 'number' &&
      Number.isSafeInteger(saved.lastRequestDurationMs) &&
      saved.lastRequestDurationMs >= 0 &&
      saved.lastRequestDurationMs <= maxAge
        ? { lastRequestDurationMs: saved.lastRequestDurationMs }
        : {}),
      ...(saved.lastRequestDurationUpperBound === true
        ? { lastRequestDurationUpperBound: true }
        : {}),
      ...(pendingTiming &&
      timestamp(pendingTiming.startedAtMs, now) &&
      typeof pendingTiming.succeeded === 'boolean'
        ? {
            pendingRequestTiming: {
              startedAtMs: pendingTiming.startedAtMs,
              succeeded: pendingTiming.succeeded,
            },
          }
        : {}),
      error: null,
      capped: saved.capped === true,
    })
  }
  const pendingRetryDelayMs =
    typeof data.pendingRetryDelayMs === 'number' &&
    Number.isSafeInteger(data.pendingRetryDelayMs) &&
    data.pendingRetryDelayMs > 0 &&
    data.pendingRetryDelayMs <= 24 * 60 * 60_000
      ? data.pendingRetryDelayMs
      : 0
  return {
    snapshots,
    rateLimitedUntil: readBackoff(data.rateLimitedUntil, now),
    pendingRetryDelayMs,
  }
}

export function encodeSnapshots(
  snapshots: RbnSnapshot[],
  rateLimitedUntil: number,
  now: number,
  pendingRetryDelayMs = 0,
): string {
  return JSON.stringify({
    version: 1,
    rateLimitedUntil,
    pendingRetryDelayMs,
    snapshots: snapshots
      .filter(
        (snapshot) => snapshot.lastAttemptMs !== null && snapshot.lastAttemptMs >= now - maxAge,
      )
      .slice(-8)
      .map(
        ({
          call,
          windowMinutes,
          reports,
          lastAttemptMs,
          lastSuccessMs,
          lastRequestDurationMs,
          lastRequestDurationUpperBound,
          pendingRequestTiming,
          capped,
        }) => ({
          call,
          windowMinutes,
          lastAttemptMs,
          lastSuccessMs,
          lastRequestDurationMs,
          lastRequestDurationUpperBound,
          pendingRequestTiming,
          capped,
          reports: reports.filter((report) => report.timeMs >= now - windowMinutes * 60_000),
        }),
      ),
  })
}
