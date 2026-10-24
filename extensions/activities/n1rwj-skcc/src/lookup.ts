// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { CallInfoLookup, LookupHook } from '@ham2k/extension-sdk'
import { KEY, object, type RosterGetter, refOf, text } from './model.ts'
import { lookupMember, normalizeCall, validCall } from './roster.ts'

function markdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()#+.!|~-]/g, '\\$&')
}

/** Additive roster notes and an offline name fallback, never a compact-line override. */
export function createLookup(getRoster: RosterGetter): LookupHook {
  return {
    async lookupCall({ callInfo, qso }) {
      const their = object(qso.their)
      const call = normalizeCall(text('call' in their ? their.call : callInfo.call))
      if (!validCall(call)) return []
      const ref = refOf(qso)
      const number = ref && 'number' in ref ? ref.number : undefined
      const member = lookupMember(getRoster(), call, number)
      if (!member) return []
      const status =
        member.status === 'SK'
          ? 'Silent key'
          : member.status === 'IA'
            ? 'Inactive member'
            : 'Member'
      const annotation: CallInfoLookup = {
        call,
        source: KEY,
        scope: 'general',
        // The host accumulates notes in Info. Singular `note` replaces its
        // compact name line, even when QRZ already supplied a name.
        notes: [
          `**SKCC ${member.number}${member.suffix}** · ${status}`,
          [
            !('name' in their) && !(ref && 'name' in ref) && member.name
              ? markdown(member.name)
              : '',
            !('state' in their) && !(ref && 'spc' in ref) && member.spc
              ? `Roster SPC: ${markdown(member.spc)}`
              : '',
          ]
            .filter(Boolean)
            .join(' · '),
          'Roster information is a hint; confirm the exchange and qualifying key use on air.',
        ].filter(Boolean),
      }
      // A typed or cleared name and any earlier source take precedence.
      if (
        !('name' in their) &&
        !(ref && 'name' in ref) &&
        !('name' in callInfo) &&
        member.name &&
        member.status === 'A'
      )
        annotation.name = member.name
      return [annotation]
    },
  }
}
