import { bearingDegrees, distanceKm, earthRadiusKm } from '../geography.ts'
import type { MapLocation } from './types.ts'

interface MapSize {
  width: number
  height: number
}

interface Fit {
  home: { lat: number; lon: number }
  width: number
  height: number
  worldWidth: number
  worldHeight: number
}

export interface ReceptionMapCamera {
  context: string
  revision: number
  hasReports: boolean
  fit: Fit
  zoom: number
  moved?: boolean
  refit?: boolean
}

const markerPadding = 24
const nearbySpanDegrees = 4
const nearbyDiscSpan = nearbySpanDegrees / 180
const degreesToRadians = Math.PI / 180

/** The shortest arc containing every marker, including sets across the date line. */
function regionalFit(origin: MapLocation, stations: readonly MapLocation[]): Fit {
  const points = [origin, ...stations]
  const longitudes = points.map(({ longitude }) => (longitude + 360) % 360).sort((a, b) => a - b)
  let gap = 0
  let start = longitudes[0]
  for (const [index, longitude] of longitudes.entries()) {
    const next = longitudes[index + 1] ?? longitudes[0] + 360
    if (next - longitude > gap) {
      gap = next - longitude
      start = next
    }
  }
  const span = 360 - gap
  const latitudes = points.map(({ latitude }) => latitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  return {
    home: { lat: (north + south) / 2, lon: ((start + span / 2 + 180) % 360) - 180 },
    width: Math.max(nearbySpanDegrees, span),
    height: Math.max(nearbySpanDegrees, north - south),
    worldWidth: 360,
    worldHeight: 180,
  }
}

function azimuthalFit(origin: MapLocation, stations: readonly MapLocation[]): Fit {
  let width = nearbyDiscSpan
  let height = nearbyDiscSpan
  for (const station of stations) {
    const radius = distanceKm(origin, station) / (earthRadiusKm * Math.PI)
    const bearing = bearingDegrees(origin, station) * degreesToRadians
    width = Math.max(width, 2 * radius * Math.abs(Math.sin(bearing)))
    height = Math.max(height, 2 * radius * Math.abs(Math.cos(bearing)))
  }
  return {
    home: { lat: origin.latitude, lon: origin.longitude },
    width,
    height,
    worldWidth: 2,
    worldHeight: 2,
  }
}

function fitZoom(size: MapSize, fit: Fit): number {
  // API 25 defines zero zoom as the whole world fitted in the pane.
  const worldScale = Math.min(size.width / fit.worldWidth, size.height / fit.worldHeight)
  const markerScale = Math.min(
    (size.width - 2 * markerPadding) / fit.width,
    (size.height - 2 * markerPadding) / fit.height,
  )
  return Math.max(0, Math.min(8, Math.log2(markerScale / worldScale)))
}

export function receptionMapCamera(
  context: string,
  size: MapSize,
  origin: MapLocation,
  stations: readonly MapLocation[],
  azimuthal: boolean,
  previous?: ReceptionMapCamera,
): ReceptionMapCamera {
  const hasReports = stations.length > 0
  const sameContext = previous?.context === context
  if (sameContext && !previous.refit && (previous.moved || previous.hasReports || !hasReports)) {
    // Keep both inputs stable when the operator is moving the host camera.
    return previous.moved ? previous : { ...previous, zoom: fitZoom(size, previous.fit) }
  }
  const fit = azimuthal ? azimuthalFit(origin, stations) : regionalFit(origin, stations)
  return {
    context,
    revision: previous ? previous.revision + 1 : 0,
    hasReports,
    fit,
    zoom: fitZoom(size, fit),
  }
}
