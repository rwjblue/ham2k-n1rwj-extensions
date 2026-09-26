import type { GeoProjection } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { createMapProjection, earthRadiusKm } from '../../src/map/projection.ts'
import type { MapLocation, MapStation } from '../../src/map/types.ts'

const origin = { latitude: 41.733, longitude: -71.574 }
const station = (key: string, latitude: number, longitude: number): MapStation => ({
  key,
  label: key,
  latitude,
  longitude,
  ageMinutes: 0,
})

function point(projection: GeoProjection, location: MapLocation): [number, number] {
  const projected = projection([location.longitude, location.latitude])
  if (!projected?.every(Number.isFinite)) throw new Error('Invalid projected point')
  return projected
}

describe('reception map projections', () => {
  it('keeps the fitted map north-up and leaves clipping to the geographic viewport', () => {
    const locations = [
      station('north-west', 60, -110),
      station('north-east', 60, 0),
      station('south-west', -30, -110),
      station('south-east', -30, 0),
    ]
    const projection = createMapProjection(origin, locations, 800, 300, 'regional')
    expect(projection.rotate().slice(1)).toEqual([0, 0])
    expect(projection.clipAngle()).toBe(0)
    expect(projection.clipExtent()).toBeNull()
    expect(point(projection, locations[0])[1]).toBeCloseTo(point(projection, locations[1])[1])
    expect(point(projection, locations[2])[1]).toBeCloseTo(point(projection, locations[3])[1])
    expect(point(projection, locations[0])[1]).toBeLessThan(point(projection, origin)[1])
    expect(point(projection, locations[2])[1]).toBeGreaterThan(point(projection, origin)[1])
    expect(point(projection, locations[0])[0]).toBeLessThan(point(projection, locations[1])[0])
  })

  it('fits a cluster across the date line like an equivalent cluster across Greenwich', () => {
    const dateLineOrigin = { latitude: 45, longitude: 179.8 }
    const dateLineStation = station('across', 46, -179.8)
    const greenwichOrigin = { latitude: 45, longitude: -0.2 }
    const greenwichStation = station('across', 46, 0.2)
    const dateLine = createMapProjection(dateLineOrigin, [dateLineStation], 720, 300, 'regional')
    const greenwich = createMapProjection(greenwichOrigin, [greenwichStation], 720, 300, 'regional')
    for (const [a, b] of [
      [dateLineOrigin, greenwichOrigin],
      [dateLineStation, greenwichStation],
    ]) {
      const actual = point(dateLine, a)
      const expected = point(greenwich, b)
      expect(actual[0]).toBeCloseTo(expected[0], 8)
      expect(actual[1]).toBeCloseTo(expected[1], 8)
    }
    expect(dateLine.scale()).toBeCloseTo(greenwich.scale(), 8)
  })

  it('selects a stable longitude seam regardless of endpoint order or duplicate meridians', () => {
    const locations = [station('west', 30, -90), station('east', -30, 90)]
    const dateLineOrigin = { latitude: 0, longitude: 180 }
    const original = createMapProjection(dateLineOrigin, locations, 800, 300, 'regional')
    const reversed = createMapProjection(
      { ...dateLineOrigin, longitude: -180 },
      [...locations].reverse(),
      800,
      300,
      'regional',
    )
    const duplicated = createMapProjection(
      dateLineOrigin,
      [...locations, station('duplicate', 0, -180)],
      800,
      300,
      'regional',
    )
    for (const comparison of [reversed, duplicated]) {
      expect(comparison.rotate()).toEqual(original.rotate())
      expect(comparison.scale()).toBe(original.scale())
      for (const location of [dateLineOrigin, ...locations]) {
        expect(point(comparison, location)).toEqual(point(original, location))
      }
    }
  })

  it('fits global outliers and exact poles without dropping finite locations', () => {
    const locations = [
      station('west', 35, -120),
      station('east', 35, 140),
      station('south', -35, 20),
      station('north-pole', 90, 180),
      station('south-pole', -90, -180),
      station('antipode', -origin.latitude, origin.longitude + 180),
    ]
    for (const [width, height] of [
      [800, 227],
      [320, 149],
      [400, 400],
    ]) {
      const projection = createMapProjection(origin, locations, width, height, 'regional')
      const padding = Math.max(12, Math.min(44, width / 12, height / 8))
      for (const location of [origin, ...locations]) {
        const [x, y] = point(projection, location)
        expect(x).toBeGreaterThanOrEqual(padding)
        expect(x).toBeLessThanOrEqual(width - padding)
        expect(y).toBeGreaterThanOrEqual(padding)
        expect(y).toBeLessThanOrEqual(height - padding)
      }
      expect(projection.clipExtent()).toBeNull()
    }
  })

  it('uses the available short-panel height for spread-out American reports', () => {
    const stations = [
      station('NG7M', 40.6, -111.9),
      station('KM7W', 43.6, -116.2),
      station('PY2KNK', -23.5, -46.6),
    ]
    const height = 227
    const projection = createMapProjection(origin, stations, 800, height, 'regional')
    const points = [origin, ...stations].map((location) => point(projection, location))
    const ys = points.map((point) => point[1])
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(height * 0.63)
    expect(point(projection, stations[2])[1]).toBeGreaterThan(point(projection, origin)[1])
    expect(point(projection, stations[0])[0]).toBeLessThan(point(projection, origin)[0])
  })

  it('keeps explicit distance mode centered with equal radial distances at different bearings', () => {
    const equator = { latitude: 0, longitude: 0 }
    const locations = [station('north', 10, 0), station('east', 0, 10)]
    const projection = createMapProjection(equator, locations, 800, 227, 'azimuthal')
    const center = point(projection, equator)
    expect(center).toEqual([400, 113.5])
    expect(projection.rotate().every((angle) => angle === 0)).toBe(true)
    expect(projection.clipAngle()).toBe(179.99)
    expect(projection.clipExtent()).toBeNull()
    const distances = locations.map((location) => {
      const [x, y] = point(projection, location)
      return Math.hypot(x - center[0], y - center[1])
    })
    expect(distances[0]).toBeCloseTo(distances[1], 8)
    expect((distances[0] / projection.scale()) * earthRadiusKm).toBeCloseTo(
      (earthRadiusKm * Math.PI) / 18,
      8,
    )
    const polar = createMapProjection(
      equator,
      [station('n', 90, 0), station('s', -90, 0)],
      320,
      149,
      'azimuthal',
    )
    for (const location of [station('n', 90, 0), station('s', -90, 0)]) {
      const [x, y] = point(polar, location)
      expect(x).toBeGreaterThan(12)
      expect(x).toBeLessThan(308)
      expect(y).toBeGreaterThan(12)
      expect(y).toBeLessThan(137)
    }
  })
})
