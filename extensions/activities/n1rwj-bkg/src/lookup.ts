// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { CallInfoLookup, LookupHook } from '@ham2k/extension-sdk'
import { findMember, KEY, normalizeCall, object, type RosterGetter } from './model.ts'

export function markdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()#+.!|~-]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
}

/** Add notes only; preserve QRZ, typed/cleared identity and exchange fields. */
export function createLookup(getRoster: RosterGetter): LookupHook {
  return {
    async lookupCall({ callInfo, qso }) {
      const their = object(qso.their)
      const call = normalizeCall('call' in their ? their.call : callInfo.call)
      const member = findMember(getRoster(), call)
      if (!member) return []
      const result: CallInfoLookup & { n1rwjBkg: { number: number; call: string } } = {
        call,
        source: KEY,
        scope: 'general',
        notes: [
          `**BKG #${member.number}** · ${markdown(member.name)}${member.qth ? ` · ${markdown(member.qth)}` : ''}`,
        ],
        // The host's generic guess merge retains extension-owned JSON fields.
        // New contacts keep this identity when a member later changes callsign.
        n1rwjBkg: { number: member.number, call },
      }
      return [result]
    },
  }
}
