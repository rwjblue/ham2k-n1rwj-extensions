// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0
import { callLookupKeys } from '../../../../packages/n1mm/src/callsign.ts'

// NA5N, QRP-L, "Zombie Shuffle Friday Oct. 30", October 29, 2026 (US Eastern).
// Message-ID: <20261030014009.50176.qmail@modulo.zianet.com>
// The original has a line break between N7CQR and K7TQ, not a combined call.
export const ANNOUNCED_2026_BONUS_CALLS = [
  'K4BAI',
  'AB9CA',
  'NB6M',
  'W2EB',
  'NA5N',
  'WB9HFK',
  'WA5BDU',
  'N7CQR',
  'K7TQ',
  'N0MII',
  'W1PID',
  'WD7Y',
  'AD4TJ',
  'N4VE',
  'NB7O',
  'N3XTR',
] as const

/** An announced assignment, never evidence of activity or a copied exchange. */
export function isAnnouncedBonusStation(call: string, eventRef: string): boolean {
  return (
    eventRef === '2026' &&
    callLookupKeys(call).some((key) => ANNOUNCED_2026_BONUS_CALLS.some((bonus) => bonus === key))
  )
}
