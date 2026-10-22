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

/** Offline global identity hints; no references or participation are invented. */
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
      const annotation: CallInfoLookup & { note: string; emoji: string } = {
        call,
        source: KEY,
        scope: 'general',
        emoji: '🔑',
        note: `SKCC ${member.number}${member.suffix}${member.status === 'A' ? '' : ` · ${status}`}`,
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
