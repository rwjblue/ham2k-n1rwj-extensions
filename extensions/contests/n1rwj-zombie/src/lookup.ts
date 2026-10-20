// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0
import type { CallInfoLookup, LookupHook } from '@ham2k/extension-sdk'
import { isCallsign, normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
import type { LoadedFile } from './data.ts'
import { received } from './exchange.ts'
import type { createZombieHistory, ZombieSuggestions } from './history.ts'
import { zombieIdentityNotes } from './info.ts'
import { EVENT_REF, type Exchange, object, refOf, text } from './model.ts'

type ZombieAnnotation = CallInfoLookup & { note?: string; emoji?: string }

/** Static, scoped identity notes. No cached readiness, roster claim or network access. */
export function createZombieLookup(
  history: ReturnType<typeof createZombieHistory>,
  file: () => LoadedFile | undefined = () => undefined,
): LookupHook {
  return {
    async lookupCall({ callInfo, operation, qso }, ctx) {
      if (text(refOf(operation)?.ref) !== EVENT_REF) return []
      const their = object(qso.their)
      // Clearing/correcting the live call outranks a preceding lookup result.
      // Native spots omit their.call and can use the supplied callsign instead.
      const call = normalizeCall(text('call' in their ? their.call : callInfo.call))
      if (!isCallsign(call)) return []
      let suggestions: ZombieSuggestions = {}
      try {
        suggestions = await history.suggestions(
          operation,
          { ...qso, their: { ...their, call } },
          ctx,
          file(),
        )
      } catch {
        // Optional history must not hide the operator's own current exchange.
      }
      const ref = refOf(qso)
      const hints: Partial<Exchange> = {}
      const fields = [
        ['spc', 'theirSpc'],
        ['zombieNumber', 'theirZombieNumber'],
        ['zombieName', 'theirZombieName'],
      ] as const
      for (const [key, field] of fields) {
        // Presence includes deliberate blanks; a hint cannot undo clearing.
        if ((!ref || !(field in ref)) && suggestions[key]) hints[key] = suggestions[key]
      }
      const copied = received(qso)
      const hasCopied = Object.values(copied).some(Boolean)
      const hasHints = Object.values(hints).some(Boolean)
      // Unknown spots are not evidence of Zombie participation. A live
      // logging draft may still show the event's exchange-entry guidance.
      if (!('call' in their) && !hasCopied && !hasHints) return []
      const annotation: ZombieAnnotation = {
        call,
        source: 'n1rwj-zombie',
        scope: 'operation',
        note: hasCopied
          ? '👻 Zombie exchange'
          : hasHints
            ? '👻 Zombie history hint'
            : '👻 Zombie Shuffle exchange',
        emoji: '👻',
        notes: zombieIdentityNotes({ call, copied, hints }),
      }
      return [annotation]
    },
  }
}
