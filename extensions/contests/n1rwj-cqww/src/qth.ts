// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The W/VE QTH — CQ WW RTTY's third multiplier, and the part of its exchange
// the CW and SSB weekends don't have. Per the RTTY rules: "each continental US
// state (48), The District of Columbia and each Canadian call area (14)
// contacted on each band", with Alaska and Hawaii counting "as country
// multipliers only and not as state multipliers".

import type { JSONValue } from '@ham2k/extension-sdk'
import { annotateCallAgainstCountryFile } from '@ham2k/extension-sdk'
import { parseCallsign } from '@ham2k/lib-callsigns'

/// The 48 continental states and DC, as US Postal Service abbreviations.
const US_QTHS = [
  'AL',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
]

/// The 14 Canadian call areas the rules count, keyed by the call-area prefix
/// each is named for. Spelled as the RTTY site's Cabrillo location list spells
/// them (NT, NL, PE) — the rules' own text says NWT, NF and PEI, which are
/// accepted as aliases below. Labrador (LB) is its own area per the rules,
/// though the location list folds it into NL.
const VE_QTH_BY_PREFIX: Record<string, string> = {
  VE1: 'NS',
  VA1: 'NS',
  VE2: 'QC',
  VA2: 'QC',
  VE3: 'ON',
  VA3: 'ON',
  VE4: 'MB',
  VA4: 'MB',
  VE5: 'SK',
  VA5: 'SK',
  VE6: 'AB',
  VA6: 'AB',
  VE7: 'BC',
  VA7: 'BC',
  VE8: 'NT',
  VE9: 'NB',
  VO1: 'NL',
  VO2: 'LB',
  VY0: 'NU',
  VY1: 'YT',
  VY2: 'PE',
}
const VE_QTHS = [...new Set(Object.values(VE_QTH_BY_PREFIX))]

/// The rules' spellings of the three call areas the location list spells
/// differently, so one area never counts as two multipliers.
const ALIASES: Record<string, string> = { NWT: 'NT', NF: 'NL', PEI: 'PE' }

const VALID_QTHS = new Set([...US_QTHS, ...VE_QTHS])

/// The field takes letters only — the longest accepted spelling is three.
export const QTH_PATTERN = '[A-Za-z]{2,3}'

/// The entities whose stations send a QTH, by their country-file prefix:
/// the continental US and Canada. Alaska (`KL`) and Hawaii (`KH6`) are their
/// own entities, so they fall outside this on their own.
const SENDS_A_QTH = ['K', 'VE']

function str(value: JSONValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

/// A QTH as typed, reduced to the rules' spelling, or '' for anything that is
/// not one of the 63 multipliers.
export function normalizeQth(value: JSONValue | undefined): string {
  const typed = str(value).trim().toUpperCase()
  const qth = ALIASES[typed] ?? typed
  return VALID_QTHS.has(qth) ? qth : ''
}

/// Whether [call] is a station that sends a QTH at all.
export function sendsQth(call: string): boolean {
  return SENDS_A_QTH.includes(str(annotateCallAgainstCountryFile(call, { wae: true }).entityPrefix))
}

/// The QTH a station most likely sends: a US station's state when a lookup
/// has supplied one, a Canadian station's call area from its prefix. Blank
/// rather than wrong — every one of these is a multiplier claim.
export function guessedQth(their: Record<string, JSONValue>): string {
  const call = str(their.call)
  if (!call || !sendsQth(call)) return ''
  const guess = (their.guess as Record<string, JSONValue>) ?? {}
  const state = normalizeQth(str(their.state) || str(guess.state))
  if (state) return state
  return VE_QTH_BY_PREFIX[str(parseCallsign(call).prefix as JSONValue)] ?? ''
}

/// The entities whose stations give a state, province or ARRL section in the
/// Cabrillo LOCATION line — the US and Canada, Alaska, Hawaii, Puerto Rico
/// and the Virgin Islands included — where everyone else puts `DX`.
const HAS_A_SECTION = ['K', 'VE', 'KL', 'KH6', 'KP4', 'KP2']

/// The Cabrillo LOCATION for [call]: what was typed at setup, as typed — the
/// sponsor also accepts an ARRL section here, which the exchange's QTH does
/// not — else a Canadian call area, else `DX` for a station outside the US
/// and Canada. Blank for a US station that set none: claiming `DX` for it
/// would be wrong, and the line is better left out.
export function cabrilloLocation(call: string, typed: JSONValue | undefined): string {
  const own = str(typed)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (own) return own
  if (!call) return ''
  const entity = str(annotateCallAgainstCountryFile(call, { wae: true }).entityPrefix)
  return HAS_A_SECTION.includes(entity) ? guessedQth({ call }) : 'DX'
}
