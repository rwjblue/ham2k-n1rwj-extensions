// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { Continent } from '../data/continents.ts'
import { receiverFamily } from '../data/identity.ts'
import { receiverLocation } from '../data/parser.ts'
import { distanceKm } from '../model.ts'
import type { ReceiverSelection } from './model.ts'

// Two pages per receiver plus the global supplement fit the API request budget.
export const maxDirectedSkimmers = 32

export interface ReceiverQueryEntry {
  call: string
  grid: string | null
  continent?: Continent | null
}

export interface SpotQueryPlan {
  skimmers: string[]
  includeGlobal: boolean
}

const globalPlan = (): SpotQueryPlan => ({ skimmers: [], includeGlobal: true })

/** Narrow upstream queries while retaining reports that need local grid fallback. */
export function planSpotQueries(
  receivers: ReceiverSelection,
  entries?: readonly ReceiverQueryEntry[],
): SpotQueryPlan {
  if (receivers.skimmers.length) {
    const skimmers = [...new Set(receivers.skimmers)].sort()
    return skimmers.length <= maxDirectedSkimmers
      ? { skimmers, includeGlobal: false }
      : globalPlan()
  }
  const hasContinents = Boolean(receivers.continents?.length)
  if ((!hasContinents && !receivers.grids.length && !receivers.radius) || !entries)
    return globalPlan()

  const candidates = entries.filter((receiver) => {
    if (
      hasContinents &&
      (!receiver.continent || !receivers.continents?.includes(receiver.continent))
    )
      return false
    // A report can supply a grid when its directory entry has none.
    const grid = receiver.grid
    if (grid === null) return true
    if (receivers.grids.length && !receivers.grids.some((prefix) => grid.startsWith(prefix)))
      return false
    if (receivers.radius) {
      const [latitude, longitude] = receiverLocation(grid)
      if (
        latitude === null ||
        longitude === null ||
        distanceKm(receivers.radius.origin, { latitude, longitude }) >
          receivers.radius.miles * 1.609344
      )
        return false
    }
    return true
  })
  // Vail currently reports bare receiver callsigns for suffixed RBN nodes.
  // Fetch both representations without changing the operator's exact-ID choice.
  // Local geography still requires unambiguous directory metadata for families.
  const skimmers = [
    ...new Set(candidates.flatMap((receiver) => [receiver.call, receiverFamily(receiver.call)])),
  ].sort()
  if (skimmers.length > maxDirectedSkimmers) return globalPlan()
  // Receivers missing from the directory can still pass geography via report
  // grids, but cannot pass a selected continent under the local filter rules.
  return { skimmers, includeGlobal: !hasContinents }
}
