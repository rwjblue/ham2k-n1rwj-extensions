// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT

import type { Bounds, Match } from './geometry.ts'
import { areaForFix, decodeBoundaries, matches, overlaps } from './geometry.ts'
import type {
  OperationLocationCandidate,
  OperationLocationHook,
  OperationLocationResult,
} from './operation-location.ts'

type ReadRow = (key: string) => Promise<unknown>
type Boundaries = ReturnType<typeof decodeBoundaries>
type BoundaryCache = { version: string; geometries: Map<string, Promise<Boundaries | undefined>> }

const MAX_CACHED_GEOMETRIES = 4

export function createResolver(readRow: ReadRow): OperationLocationHook['resolve'] {
  let currentCache: BoundaryCache | undefined

  return async ({ latitude, longitude, accuracyMeters }): Promise<OperationLocationResult> => {
    const area = areaForFix(latitude, longitude, accuracyMeters)
    if (!area) return {}

    // Refresh the small index on every fix. After a data file update or
    // removal, a previous fix's cached boundaries cannot answer for it.
    const index = asRecord(await readRow('index'))
    const boundsByState = asRecord(index?.bounds)
    const version = index?.version
    if (!boundsByState || typeof version !== 'string' || !version) {
      currentCache = undefined
      return {}
    }
    if (currentCache?.version !== version) currentCache = { version, geometries: new Map() }
    const cache = currentCache

    const stateMatches: Match[] = []
    for (const [state, bounds] of Object.entries(boundsByState)) {
      if (!/^[A-Z]{2}$/.test(state) || !isBounds(bounds)) return {}
      if (!overlaps(bounds, area.bounds)) continue
      const geometry = await loadGeometry(readRow, cache, `state:${state}`)
      // An import can expose a new index before all its rows are written.
      // Do not decide which state contains the fix from an incomplete set.
      if (!geometry) return {}
      stateMatches.push(...matches(geometry, area))
    }

    const state = containedName(stateMatches)
    if (state) {
      const counties = matches((await loadGeometry(readRow, cache, `county:${state}`)) ?? [], area)
      const county = containedName(counties)
      if (county) return { state, county }
      const candidates = countyChoices(state, counties)
      return candidates.length ? { state, candidates } : { state }
    }

    const candidates: OperationLocationCandidate[] = []
    for (const { name } of stateMatches) {
      if (!name) continue
      const counties = matches((await loadGeometry(readRow, cache, `county:${name}`)) ?? [], area)
      const choices = countyChoices(name, counties)
      candidates.push(...choices)
      if (!choices.length || counties.some((match) => !match.name)) candidates.push({ state: name })
    }
    return candidates.length ? { candidates } : {}
  }
}

async function loadGeometry(
  readRow: ReadRow,
  cache: BoundaryCache,
  key: string,
): Promise<Boundaries | undefined> {
  const { geometries, version } = cache
  const previous = geometries.get(key)
  // Usually a fix needs one state and one county row. A line between
  // states needs both pairs, so keep those pairs through GPS refinement.
  geometries.delete(key)
  if (geometries.size >= MAX_CACHED_GEOMETRIES) {
    const oldest = geometries.keys().next().value
    if (oldest !== undefined) geometries.delete(oldest)
  }
  const pending =
    previous ??
    readRow(key).then((value) => {
      const row = asRecord(value)
      if (row?.version !== version || typeof row.geometry !== 'string') return undefined
      const boundaries = decodeBoundaries(row.geometry)
      if (
        key.startsWith('state:') &&
        (boundaries.length !== 1 || boundaries[0].name !== key.slice(6))
      ) {
        throw new Error('US state geometry does not match its index')
      }
      return boundaries
    })
  geometries.set(key, pending)
  try {
    const geometry = await pending
    if (geometry) return geometry
  } catch (error) {
    if (geometries.get(key) === pending) geometries.delete(key)
    throw error
  }
  if (geometries.get(key) === pending) geometries.delete(key)
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function isBounds(value: unknown): value is Bounds {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(Number.isInteger) &&
    value[0] < value[2] &&
    value[1] < value[3]
  )
}

function containedName(records: Match[]): string | undefined {
  return records.length === 1 && records[0].contained ? records[0].name : undefined
}

function countyChoices(state: string, records: Match[]): OperationLocationCandidate[] {
  return records.flatMap(({ name }) => (name ? [{ state, county: name }] : []))
}
