// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type CallFilterHook, maxFilterCalls } from '../../../../packages/spot-filters/src/index.ts'
import type { RosterGetter } from './model.ts'
import { lookupMember, normalizeCall } from './roster.ts'

const unavailable = 'Download the SKCC member roster in Data Files to enable this filter.'

/** Membership only: an RBN detection cannot establish qualifying key use. */
export function createSpotFilter(getRoster: RosterGetter): CallFilterHook {
  return {
    async describe() {
      const available = Boolean(getRoster())
      return {
        version: 1,
        label: 'SKCC members',
        available,
        defaultSelected: false,
        ...(!available ? { reason: unavailable } : {}),
      }
    },
    async matchCalls(args) {
      if (
        args?.version !== 1 ||
        !Array.isArray(args.calls) ||
        args.calls.length > maxFilterCalls ||
        args.calls.some((call) => typeof call !== 'string' || call.length > 64)
      )
        throw new Error('Unsupported spot call-filter request')
      const roster = getRoster()
      if (!roster) return { version: 1, available: false, calls: [], reason: unavailable }
      return {
        version: 1,
        available: true,
        calls: [...new Set(args.calls.map(normalizeCall))].filter(
          (call) =>
            !call.split('/').some((part) => part === 'SK' || part === 'EX') &&
            lookupMember(roster, call)?.status === 'A',
        ),
      }
    },
  }
}
