// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT

import { base64ToBytes } from '@ham2k/extension-sdk'

export type Bounds = [west: number, south: number, east: number, north: number]

type FixArea = {
  x: number
  y: number
  dx: number
  dy: number
  bounds: Bounds
}

type Ring = { coordinates: Int32Array; bounds: Bounds }
type Polygon = { outer: Ring; holes: Ring[] }
type Boundary = { name?: string; polygons: Polygon[] }
type Relation = 'outside' | 'inside' | 'touches'

export type Match = { name?: string; contained: boolean }

const UNITS_PER_DEGREE = 100_000
const MIN_METERS_PER_DEGREE = 110_000

export function areaForFix(
  latitude: number,
  longitude: number,
  accuracyMeters: number,
): FixArea | undefined {
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0
  ) {
    return undefined
  }

  // Enclose the accuracy circle, with a metre to spare for coordinate
  // quantization. A field can fill only when the entire box is contained.
  const latRadius = (accuracyMeters + 1) / MIN_METERS_PER_DEGREE
  const farthestLatitude = Math.abs(latitude) + latRadius
  if (farthestLatitude >= 90) return undefined
  const lonRadius = latRadius / Math.cos((farthestLatitude * Math.PI) / 180)
  if (lonRadius >= 180) return undefined

  const x = longitude * UNITS_PER_DEGREE
  const y = latitude * UNITS_PER_DEGREE
  const dx = lonRadius * UNITS_PER_DEGREE
  const dy = latRadius * UNITS_PER_DEGREE
  return { x, y, dx, dy, bounds: [x - dx, y - dy, x + dx, y + dy] }
}

export function overlaps(a: Bounds, b: Bounds): boolean {
  return a[2] >= b[0] && a[0] <= b[2] && a[3] >= b[1] && a[1] <= b[3]
}

export function matches(boundaries: Boundary[], area: FixArea): Match[] {
  const result: Match[] = []
  for (const boundary of boundaries) {
    let relation: Relation = 'outside'
    for (const polygon of boundary.polygons) {
      const candidate = polygonRelation(polygon, area)
      if (candidate === 'outside') continue
      relation = candidate
      if (candidate === 'inside') break
    }
    if (relation !== 'outside')
      result.push({ name: boundary.name, contained: relation === 'inside' })
  }
  return result
}

function polygonRelation({ outer, holes }: Polygon, area: FixArea): Relation {
  let relation = ringRelation(outer, area)
  if (relation === 'outside') return relation
  for (const hole of holes) {
    const holeRelation = ringRelation(hole, area)
    if (holeRelation === 'inside') return 'outside'
    if (holeRelation === 'touches') relation = 'touches'
  }
  return relation
}

function ringRelation({ coordinates, bounds }: Ring, area: FixArea): Relation {
  if (!overlaps(bounds, area.bounds)) return 'outside'

  let inside = false
  let previousX = coordinates[coordinates.length - 2]
  let previousY = coordinates[coordinates.length - 1]
  for (let i = 0; i < coordinates.length; i += 2) {
    const x = coordinates[i]
    const y = coordinates[i + 1]
    if (segmentTouches(area, previousX, previousY, x, y)) return 'touches'

    // A horizontal ray from the center of the fix counts each shared vertex
    // once, even where two edges meet it.
    if (
      y > area.y !== previousY > area.y &&
      area.x < x + ((previousX - x) * (area.y - y)) / (previousY - y)
    ) {
      inside = !inside
    }
    previousX = x
    previousY = y
  }
  return inside ? 'inside' : 'outside'
}

function segmentTouches(area: FixArea, x1: number, y1: number, x2: number, y2: number): boolean {
  const [left, bottom, right, top] = area.bounds
  if (
    (x1 < left && x2 < left) ||
    (x1 > right && x2 > right) ||
    (y1 < bottom && y2 < bottom) ||
    (y1 > top && y2 > top)
  )
    return false

  // The boxes overlap. Project onto the segment's normal, the remaining
  // separating axis, to determine whether the segment touches the fix.
  const dx = x2 - x1
  const dy = y2 - y1
  const offset = Math.abs(dx * (area.y - y1) - dy * (area.x - x1))
  return offset <= Math.abs(dx) * area.dy + Math.abs(dy) * area.dx
}

export function decodeBoundaries(geometry: string): Boundary[] {
  const reader = new BoundaryReader(base64ToBytes(geometry))
  if (reader.readString(4) !== 'HSB1') throw new Error('Unknown US boundary data format')
  const boundaries = reader.readArray(() => {
    const name = reader.readString(reader.readUint()) || undefined
    const polygons = reader.readArray(() => {
      const rings = reader.readArray(() => reader.readRing())
      const [outer, ...holes] = rings
      if (!outer) throw new Error('US boundary polygon has no exterior ring')
      return { outer, holes }
    })
    return { name, polygons }
  })
  if (reader.remaining !== 0) throw new Error('Unexpected data after US boundaries')
  return boundaries
}

class BoundaryReader {
  private readonly bytes: Uint8Array
  private offset = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  get remaining(): number {
    return this.bytes.length - this.offset
  }

  readString(length: number): string {
    if (length > this.remaining) throw new Error('Truncated US boundary data')
    let escaped = ''
    for (let i = 0; i < length; i++)
      escaped += `%${this.bytes[this.offset++].toString(16).padStart(2, '0')}`
    // Boundary names are UTF-8. TextDecoder is unavailable in the sandbox.
    return decodeURIComponent(escaped)
  }

  readUint(): number {
    let value = 0
    for (let shift = 0; shift <= 28 && this.remaining > 0; shift += 7) {
      const byte = this.bytes[this.offset++]
      if (shift === 28 && byte > 7) break
      value |= (byte & 127) << shift
      if (byte < 128) return value
    }
    throw new Error('Invalid US boundary data integer')
  }

  readArray<T>(next: () => T): T[] {
    const count = this.readUint()
    if (count > this.remaining) throw new Error('Invalid US boundary data count')
    const values: T[] = []
    for (let i = 0; i < count; i++) values.push(next())
    return values
  }

  readRing(): Ring {
    const count = this.readUint()
    if (count < 3 || count * 2 > this.remaining) throw new Error('Invalid US boundary ring size')
    const coordinates = new Int32Array(count * 2)
    let longitude = 0
    let latitude = 0
    let left = 180 * UNITS_PER_DEGREE
    let right = -left
    let bottom = 90 * UNITS_PER_DEGREE
    let top = -bottom
    for (let i = 0; i < coordinates.length; i += 2) {
      longitude += this.readDelta()
      latitude += this.readDelta()
      coordinates[i] = longitude
      coordinates[i + 1] = latitude
      left = Math.min(left, longitude)
      right = Math.max(right, longitude)
      bottom = Math.min(bottom, latitude)
      top = Math.max(top, latitude)
    }
    // TIGER/Line rings are split at the antimeridian, so each remains local.
    return { coordinates, bounds: [left, bottom, right, top] }
  }

  private readDelta(): number {
    const value = this.readUint()
    const magnitude = value >> 1
    return value % 2 === 0 ? magnitude : -magnitude - 1
  }
}
