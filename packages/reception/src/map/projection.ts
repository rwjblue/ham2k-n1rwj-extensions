import type { GeoProjection } from 'd3-geo'
import { geoAzimuthalEquidistant, geoDistance, geoNaturalEarth1 } from 'd3-geo'
import type { MapLocation, MapStation } from './types.ts'

export const earthRadiusKm = 6371.0088

function coordinates(location: MapLocation): [number, number] {
  return [location.longitude, location.latitude]
}

function niceRadius(distanceKm: number): number {
  const steps = [1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000]
  return steps.find((step) => step >= distanceKm * 1.2) ?? 20000
}

function longitudeCenter(locations: readonly MapLocation[]): number {
  const longitudes = [
    ...new Set(locations.map(({ longitude }) => ((longitude % 360) + 360) % 360)),
  ].sort((a, b) => a - b)
  let largestGap = -1
  let start = longitudes[0]
  for (let index = 0; index < longitudes.length; index++) {
    const next =
      longitudes[(index + 1) % longitudes.length] + (index + 1 === longitudes.length ? 360 : 0)
    const gap = next - longitudes[index]
    // Keep the first equal gap in sorted order so report order cannot move
    // the map's seam. The complement is the shortest arc containing reports.
    if (gap > largestGap) {
      largestGap = gap
      start = next
    }
  }
  return ((start + (360 - largestGap) / 2 + 180) % 360) - 180
}

/** Fit report endpoints; the caller separately clips the geographic viewport. */
export function createMapProjection(
  origin: MapLocation,
  stations: readonly MapStation[],
  width: number,
  height: number,
  kind: 'regional' | 'azimuthal',
): GeoProjection {
  const padding = Math.max(12, Math.min(44, width / 12, height / 8))
  if (kind === 'azimuthal') {
    const farthest = stations.reduce(
      (distance, receiver) =>
        Math.max(distance, geoDistance(coordinates(origin), coordinates(receiver)) * earthRadiusKm),
      0,
    )
    const radius = niceRadius(farthest) / earthRadiusKm
    return geoAzimuthalEquidistant()
      .rotate([-origin.longitude, -origin.latitude])
      .clipAngle(179.99)
      .precision(0.6)
      .scale(Math.min(width - padding * 2, height - padding * 2) / (radius * 2))
      .translate([width / 2, height / 2])
  }

  const locations = [origin, ...stations]
  // Default fitting stays north-up. Moving only the longitude seam keeps
  // nearby reports across the date line together without distorting the world
  // around the operator's location or introducing singularities at the poles.
  const projection = geoNaturalEarth1()
    .rotate([-longitudeCenter(locations), 0])
    .scale(1)
    .translate([0, 0])
    .precision(0.6)
  const points = locations.flatMap((location) => {
    const point = projection(coordinates(location))
    return point?.every(Number.isFinite) ? [point] : []
  })
  // A minimum extent prevents local reports from over-zooming the 110m
  // geography. Quantized bounds reduce drift when a receiver reappears.
  const minX = Math.floor(Math.min(...points.map((point) => point[0])) / 0.05) * 0.05
  const maxX = Math.ceil(Math.max(...points.map((point) => point[0])) / 0.05) * 0.05
  const minY = Math.floor(Math.min(...points.map((point) => point[1])) / 0.05) * 0.05
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])) / 0.05) * 0.05
  const extentX = Math.max(0.4, (maxX - minX) * 1.1)
  const extentY = Math.max(0.3, (maxY - minY) * 1.1)
  const scale = Math.min((width - padding * 2) / extentX, (height - padding * 2) / extentY)
  return projection
    .scale(scale)
    .translate([width / 2 - ((minX + maxX) / 2) * scale, height / 2 - ((minY + maxY) / 2) * scale])
}
