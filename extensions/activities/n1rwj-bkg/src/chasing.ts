// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { ChasingHook, QsoClaim } from '@ham2k/extension-sdk'
import {
  holderFor,
  isQualifyingContact,
  memberForQso,
  object,
  type Qson,
  type RosterGetter,
  text,
} from './model.ts'

export function createChasing(getRoster: RosterGetter): ChasingHook {
  return {
    program: {
      label: 'Worked the Gang',
      icon: 'hand-fist',
      color: '#D4AF37',
      version: 2,
      editions: 'lifetime',
      refLabel: 'BKG member',
    },
    claimsForQsos({ qsos }) {
      const roster = getRoster()
      // Failure preserves existing host claims; [] would withdraw credit.
      if (!roster)
        throw new Error(
          'BKG roster unavailable. Download it in Data Files, then rebuild chasing on a device with the complete log.',
        )
      const results: Record<string, QsoClaim[]> = {}
      for (const qso of qsos) {
        const uuid = text(qso.uuid)
        if (!uuid) continue
        results[uuid] = []
        if (!isQualifyingContact(qso)) continue
        const member = memberForQso(roster, qso)
        const holder = holderFor(object(qso.our).call)
        if (
          !member ||
          !holder ||
          member.number === memberForQso(roster, { their: qso.our } as Qson)?.number
        )
          continue
        const base: QsoClaim = {
          holder,
          ref: String(member.number),
          band: null,
          mode: null,
          level: 'worked',
          label: `${member.call} · BKG #${member.number}`,
        }
        results[uuid] = [
          base,
          { ...base, band: '2m' },
          { ...base, mode: 'CW' },
          { ...base, band: '2m', mode: 'CW' },
        ]
      }
      return results
    },
    holdersFor({ station }) {
      const holder = holderFor(station.call)
      // Deliberately independent of membership: joining never resets progress.
      return holder ? [holder] : []
    },
    summarizeClaims({ slots }) {
      const total = new Set(
        slots.filter((slot) => slot.band === null && slot.mode === null).map((slot) => slot.ref),
      ).size
      return {
        members: {
          key: 'members',
          label: 'Worked the Gang',
          total,
          summary: `${total} distinct BKG members worked on 2m CW. Everyone can hunt. Based on the downloaded roster.`,
        },
      }
    },
  }
}
