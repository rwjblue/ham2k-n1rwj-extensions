import { describe, expect, it } from 'vitest'
import { buildReceptionMap } from '../../src/map/native.ts'
import { receptionMapTheme } from '../../src/map/theme.ts'
import type { MapStation } from '../../src/map/types.ts'

const position = (
  key: string,
  latitude: number,
  longitude: number,
  ageMinutes = 0,
): MapStation => ({
  key,
  label: key,
  latitude,
  longitude,
  ageMinutes,
})

const reports = [
  position('ZL2IFB', -41, 175, 20),
  position('KH6LC', 19, -155, 2),
  position('FK8IK', -22, 166, 3),
]
const options = {
  context: 'all bands',
  label: 'Reception map for N1RWJ',
  rectangle: { x: 12, y: 100, width: 520, height: 320 },
  origin: { latitude: 20, longitude: -156 },
  stations: reports,
  projection: 'regional' as const,
  theme: receptionMapTheme('light'),
}

describe('native reception map', () => {
  it('fits markers across the antimeridian and draws the freshest paths last', () => {
    const { control, count, camera } = buildReceptionMap(options)
    expect(control).toMatchObject({
      id: 'reception-map',
      kind: 'map',
      projection: 'equirectangular',
      x: 12,
      y: 100,
      width: 520,
      height: 320,
      home: { lat: -10.5, lon: -174.5 },
      zoom: { initial: expect.any(Number) },
    })
    expect(camera.fit.width).toBe(39)
    expect(camera.fit.height).toBe(61)
    expect(control.markers?.map(({ id }) => id)).toEqual([
      'station:ZL2IFB',
      'station:FK8IK',
      'station:KH6LC',
      'origin',
    ])
    expect(control.lines?.map(({ from, to }) => [from, to])).toEqual([
      ['origin', 'station:ZL2IFB'],
      ['origin', 'station:FK8IK'],
      ['origin', 'station:KH6LC'],
    ])
    expect(count).toBe(3)
  })

  it('fits the projected station spread in portrait and wide panes without resetting live bounds', () => {
    const portrait = { ...options.rectangle, width: 220, height: 550 }
    const wide = { ...options.rectangle, width: 650, height: 180 }
    const first = buildReceptionMap({ ...options, rectangle: portrait })
    const update = buildReceptionMap({
      ...options,
      stations: [position('W1AW', 41, -73)],
      rectangle: wide,
      previous: first.camera,
    })
    expect(update.control.id).toBe(first.control.id)
    expect(update.control.home).toEqual(first.control.home)
    expect(update.camera.fit).toEqual(first.camera.fit)
    for (const { camera } of [first, update]) expect(camera.zoom).toBeGreaterThan(0)
    expect(update.camera.zoom).not.toBe(first.camera.zoom)
    expect(update.control.markers?.[0].id).toBe('station:W1AW')
  })

  it('fits first reports and filter changes while preserving a manually moved camera until reset', () => {
    const empty = buildReceptionMap({ ...options, stations: [] })
    const first = buildReceptionMap({ ...options, previous: empty.camera })
    expect(first.control.id).not.toBe(empty.control.id)
    expect(first.control.home).not.toEqual(empty.control.home)
    const moved = { ...empty.camera, moved: true }
    const withManualCamera = buildReceptionMap({ ...options, previous: moved })
    expect(withManualCamera.camera).toBe(moved)
    expect(withManualCamera.control.id).toBe(empty.control.id)
    expect(withManualCamera.control.markers).toHaveLength(4)
    const refitted = buildReceptionMap({ ...options, previous: { ...moved, refit: true } })
    expect(refitted.control.home).toEqual(first.control.home)
    expect(refitted.control.id).not.toBe(withManualCamera.control.id)
    const differentFilter = buildReceptionMap({
      ...options,
      context: '40m',
      stations: [reports[1]],
      previous: moved,
    })
    expect(differentFilter.control.home).toEqual({ lat: 19.5, lon: -155.5 })
    expect(differentFilter.control.id).not.toBe(withManualCamera.control.id)
  })

  it('keeps the azimuthal origin fixed and supplies distance rings at useful zooms', () => {
    const origin = { latitude: 0, longitude: 0 }
    const { control, count } = buildReceptionMap({
      ...options,
      projection: 'azimuthal',
      origin,
      stations: [
        position('NEAR', 4, 14),
        position('DISTANT', 0, 150),
        position('CLIPPED', 0, 178),
        position('INVALID', 91, 0),
      ],
    })
    expect(control.projection).toBe('azimuthal')
    expect(control.home).toEqual({ lat: 0, lon: 0 })
    expect(control.origin).toEqual(control.home)
    expect(control.markers?.map(({ id }) => id)).toEqual([
      'station:DISTANT',
      'station:NEAR',
      'origin',
    ])
    expect(count).toBe(2)
    expect(control.circles?.[0]).toMatchObject({
      at: 'origin',
      km: 500,
      width: [
        [2.5, 0],
        [3, 1],
      ],
      dashed: true,
      label: { unit: 'km' },
    })
    expect(control.circles?.[3]).toMatchObject({ at: 'origin', km: 5000, width: 1 })
  })

  it('plots an antipodal station in the regional view where its path is ambiguous', () => {
    const { control } = buildReceptionMap({
      ...options,
      origin: { latitude: 0, longitude: 0 },
      stations: [position('ANTIPODE', 0, 180)],
    })
    expect(control.markers?.map(({ id }) => id)).toEqual(['station:ANTIPODE', 'origin'])
    expect(control.lines).toEqual([])
  })

  it('bounds overlays to the host route budget using the newest reports', () => {
    const { control } = buildReceptionMap({
      ...options,
      stations: Array.from({ length: 1030 }, (_, index) =>
        position(`CALL-${index}`, index % 80, -120 + (index % 180), index),
      ),
    })
    expect(control.lines).toHaveLength(1024)
    expect(control.markers).toHaveLength(1025)
    expect(control.lines?.[0].id).toBe('path:CALL-1023')
    expect(control.lines?.[1023].id).toBe('path:CALL-0')
  })
})
