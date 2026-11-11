// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { Spot } from '@ham2k/extension-sdk'
import type { Continent } from '../data/continents.ts'
import { isValidReceiver, receiverLocation } from '../data/parser.ts'
import { type Coordinates, distanceKm, isValidCall, normalizeCall } from '../model.ts'

export const maxAgeMs = 10 * 60_000
export const bands = [
  { name: '160m', low: 1800, high: 2000 },
  { name: '80m', low: 3500, high: 4000 },
  { name: '40m', low: 7000, high: 7300 },
  { name: '30m', low: 10100, high: 10150 },
  { name: '20m', low: 14000, high: 14350 },
  { name: '17m', low: 18068, high: 18168 },
  { name: '15m', low: 21000, high: 21450 },
  { name: '12m', low: 24890, high: 24990 },
  { name: '10m', low: 28000, high: 29700 },
] as const

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** A report is evidence of reception, never evidence of CWT participation. */
export function parseReports(rows: readonly unknown[], source: string, now: number): Spot[] {
  const spots: Spot[] = []
  for (const row of rows) {
    const raw = record(row)
    if (
      typeof raw.callsign !== 'string' ||
      !['CW', 'RTTY', 'FT8', 'FT4'].includes(String(raw.mode))
    )
      continue
    const call = normalizeCall(raw.callsign)
    const freq = raw.frequency
    const band =
      typeof freq === 'number' && Number.isFinite(freq)
        ? bands.find(({ low, high }) => freq >= low && freq <= high)
        : undefined
    const time = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN
    if (
      !isValidCall(call) ||
      !band ||
      !Number.isFinite(time) ||
      time > now ||
      time < now - maxAgeMs
    )
      continue
    const sourceInfo: NonNullable<Spot['spot']['sourceInfo']> = {}
    if (typeof raw.spotter !== 'string' || !isValidReceiver(normalizeCall(raw.spotter))) continue
    sourceInfo.spotter = normalizeCall(raw.spotter)
    if (receiverLocation(raw.spotter_grid)[0] !== null)
      sourceInfo.spotterGrid = String(raw.spotter_grid).trim().toUpperCase()
    if (typeof raw.snr === 'number' && Number.isFinite(raw.snr)) sourceInfo.snr = raw.snr
    if (typeof raw.wpm === 'number' && Number.isFinite(raw.wpm)) sourceInfo.wpm = raw.wpm
    spots.push({
      their: { call },
      freq: freq as number,
      band: band.name,
      mode: String(raw.mode),
      // HALO-741: HaLo merges nearby spots with identical references, including
      // empty lists. A stable full-call reference keeps different RBN stations
      // separate without changing identity on every receiver report or refresh.
      refs: [{ type: 'rbn', ref: call }],
      spot: { timeInMillis: time, source, sourceInfo },
    })
  }
  return spots
}

export interface ReceiverSelection {
  skimmers: string[]
  grids: string[]
  continents?: Continent[]
  distanceOrigin?: Coordinates
  radius?: { origin: Coordinates; miles: number }
  cwSpeed?: { min?: number; max?: number }
}
export type ReceiverLookup = (
  call: string,
) => { grid: string | null; continent?: Continent | null; gridAmbiguous?: boolean } | undefined

function spotLabel(
  snr: unknown,
  receiverKm: number | undefined,
  distanceUnits?: string,
  unknownCwSpeed?: boolean,
): string {
  const parts: string[] = []
  if (typeof snr === 'number' && Number.isFinite(snr)) parts.push(`${snr} dB`)
  if (receiverKm !== undefined) {
    const kilometers = distanceUnits === 'kilometers'
    const distance = Math.round(kilometers ? receiverKm : receiverKm / 1.609344)
    parts.push(`RX ${distance} ${kilometers ? 'km' : 'mi'}`)
  }
  if (unknownCwSpeed) parts.push('WPM unknown')
  return parts.join(' · ') || 'RBN'
}

/** Filter receivers, then pick the closest report for each station, band, and mode. */
export function selectSpots(
  reports: readonly Spot[],
  receivers: ReceiverSelection,
  lookup: ReceiverLookup,
  now: number,
  distanceUnits?: string,
): Spot[] {
  const selected = new Map<
    string,
    { report: Spot; grid: string; receiverKm?: number; unknownCwSpeed: boolean }
  >()
  const origin = receivers.radius?.origin ?? receivers.distanceOrigin
  for (const report of reports) {
    if (report.spot.timeInMillis < now - maxAgeMs || report.spot.timeInMillis > now) continue
    const info = report.spot.sourceInfo ?? {}
    let unknownCwSpeed = false
    if (report.mode === 'CW' && receivers.cwSpeed) {
      const speed = info.wpm
      if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
        // Some cluster nodes omit CW speed from their live spot format.
        if (info.transport !== 'cluster') continue
        unknownCwSpeed = true
      } else if (
        (receivers.cwSpeed.min !== undefined && speed < receivers.cwSpeed.min) ||
        (receivers.cwSpeed.max !== undefined && speed > receivers.cwSpeed.max)
      ) {
        continue
      }
    }
    const receiver = String(info.spotter ?? '')
    if (receivers.skimmers.length && !receivers.skimmers.includes(receiver)) continue
    const directory = lookup(receiver)
    // A bare API ID may represent several physical nodes. A registered report
    // grid cannot resolve conflicting node locations in the RBN directory.
    if (directory?.gridAmbiguous && (receivers.grids.length || receivers.radius)) continue
    const grid = directory?.grid ?? String(info.spotterGrid ?? '')
    if (
      receivers.continents?.length &&
      (!directory?.continent || !receivers.continents.includes(directory.continent))
    )
      continue
    if (receivers.grids.length && !receivers.grids.some((prefix) => grid.startsWith(prefix)))
      continue
    let receiverKm: number | undefined
    if (origin && !directory?.gridAmbiguous) {
      const [latitude, longitude] = receiverLocation(grid)
      if (latitude !== null && longitude !== null) {
        receiverKm = distanceKm(origin, { latitude, longitude })
      }
    }
    if (
      receivers.radius &&
      (receiverKm === undefined || receiverKm > receivers.radius.miles * 1.609344)
    )
      continue
    const key = `${report.their.call}:${report.band}:${report.mode}`
    const previous = selected.get(key)
    if (previous) {
      const distance = receiverKm ?? Infinity
      const previousDistance = previous.receiverKm ?? Infinity
      if (
        distance > previousDistance ||
        (distance === previousDistance &&
          report.spot.timeInMillis <= previous.report.spot.timeInMillis)
      )
        continue
    }
    selected.set(key, { report, grid, receiverKm, unknownCwSpeed })
  }
  return [...selected.values()]
    .sort((a, b) => b.report.spot.timeInMillis - a.report.spot.timeInMillis)
    .map(({ report, grid, receiverKm, unknownCwSpeed }) => ({
      ...report,
      spot: {
        ...report.spot,
        label: spotLabel(report.spot.sourceInfo?.snr, receiverKm, distanceUnits, unknownCwSpeed),
        sourceInfo: { ...report.spot.sourceInfo, spotterGrid: grid },
      },
    }))
}
