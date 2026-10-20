// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The entry we declare — operator class, band, power and overlay — and the
// Cabrillo `CATEGORY-` lines it becomes. The log robot reads these to place
// the entry, and "failure to fill out the header correctly may result in the
// entry being placed in the wrong category or reclassified as a Checklog"
// (rules X.3). None of it changes the score.
//
// NOTHING is defaulted, as in the QSO parties: each answer is a claim about
// how we operated, so an unanswered question writes no line rather than a
// guessed one. What the rules make follow from an answer — a multi-operator
// entry is all-band and may use assistance — is written for it.

import type { JSONValue } from '@ham2k/extension-sdk'

/// The rules' entry categories (V.A, V.C, V.D). Operator and transmitter are
/// one axis here, as the rules list them, and split into the two Cabrillo
/// lines on the way out.
export const OPERATOR_CLASSES = [
  'SINGLE-OP',
  'SINGLE-OP-ASSISTED',
  'MULTI-ONE',
  'MULTI-TWO',
  'MULTI-MULTI',
  'MULTI-DISTRIBUTED',
  'CHECKLOG',
] as const
export type OperatorClass = (typeof OPERATOR_CLASSES)[number]

/// `ALL` or one band — "All Band or Single Band" for the single operators.
/// RTTY has no 160m.
export const BAND_CLASSES = ['ALL', '160M', '80M', '40M', '20M', '15M', '10M'] as const

export const POWER_CLASSES = ['HIGH', 'LOW', 'QRP'] as const

/// The single-operator overlays (V.B), entered alongside the main category.
export const OVERLAY_CLASSES = ['CLASSIC', 'ROOKIE', 'YOUTH'] as const

function declared<T extends string>(
  value: JSONValue | undefined,
  allowed: readonly T[],
): T | undefined {
  const upper = typeof value === 'string' ? value.toUpperCase() : ''
  return allowed.find((option) => option === upper)
}

const TRANSMITTER_FOR: Partial<Record<OperatorClass, string>> = {
  'MULTI-ONE': 'ONE',
  'MULTI-TWO': 'TWO',
  'MULTI-MULTI': 'UNLIMITED',
}

/// Read the temporary preview's saved category fields without rewriting logs.
/// A new field, including an explicit blank, always wins over its old alias.
export function compatibleEntry(
  ref: Record<string, JSONValue> | undefined,
): Record<string, JSONValue> | undefined {
  if (!ref) return ref
  const entry = { ...ref }
  if (!('operator' in entry) && 'categoryOperator' in entry) {
    entry.operator =
      entry.categoryOperator === 'SINGLE-OP' && entry.categoryAssisted === 'ASSISTED'
        ? 'SINGLE-OP-ASSISTED'
        : entry.categoryOperator
  }
  if (!('band' in entry) && typeof entry.categoryBand === 'string') {
    entry.band = /^\d+$/.test(entry.categoryBand)
      ? `${entry.categoryBand}M`
      : entry.categoryBand.toUpperCase()
  }
  if (!('power' in entry) && 'categoryPower' in entry) entry.power = entry.categoryPower
  return entry
}

/// The `CATEGORY-` lines for the entry declared on [ref], in the order the
/// sponsor's example header gives them. A line with no value is dropped by
/// the Cabrillo writer.
export function cabrilloCategories(
  ref: Record<string, JSONValue> | undefined,
): [string, string | undefined][] {
  ref = compatibleEntry(ref)
  const mode = typeof ref?.mode === 'string' ? ref.mode : ''
  const operator = declared(ref?.operator, OPERATOR_CLASSES)
  const single = operator === 'SINGLE-OP' || operator === 'SINGLE-OP-ASSISTED'
  const multi = operator?.startsWith('MULTI-') ?? false

  // Multi-operator categories are "all-band operation only" (V.C), so their
  // band is not a question. RTTY runs no 160m, so that answer is no entry.
  const band = multi ? 'ALL' : declared(ref?.band, BAND_CLASSES)
  const validBand = mode === 'RTTY' && band === '160M' ? undefined : band
  // Overlays are for single operators only, and Classic not for an assisted
  // one; anything else would be a claim the robot rejects.
  const overlay = declared(ref?.overlay, OVERLAY_CLASSES)
  const validOverlay =
    single && !(operator === 'SINGLE-OP-ASSISTED' && overlay === 'CLASSIC') ? overlay : undefined

  return [
    [
      'CATEGORY-OPERATOR',
      operator === 'CHECKLOG' ? 'CHECKLOG' : single ? 'SINGLE-OP' : multi ? 'MULTI-OP' : undefined,
    ],
    // Single Operator is defined as unassisted, and multi-operator entries
    // may use assistance, so each class answers this line itself.
    [
      'CATEGORY-ASSISTED',
      operator === 'SINGLE-OP'
        ? 'NON-ASSISTED'
        : operator === 'SINGLE-OP-ASSISTED' || multi
          ? 'ASSISTED'
          : undefined,
    ],
    ['CATEGORY-BAND', validBand],
    ['CATEGORY-POWER', declared(ref?.power, POWER_CLASSES)],
    ['CATEGORY-MODE', mode || undefined],
    ['CATEGORY-TRANSMITTER', operator ? TRANSMITTER_FOR[operator] : undefined],
    // Multi-Distributed is declared by this line with MULTI-OP (V.C.4).
    ['CATEGORY-STATION', operator === 'MULTI-DISTRIBUTED' ? 'DISTRIBUTED' : undefined],
    ['CATEGORY-OVERLAY', validOverlay],
  ]
}

/// `OPERATORS`: the calls typed at setup, uppercased and space-separated as
/// the sponsor asks, with an `@station` kept as written. Empty when nothing
/// was typed, so the caller can fall back to the app's operator call.
export function declaredOperators(ref: Record<string, JSONValue> | undefined): string {
  const typed = typeof ref?.operators === 'string' ? ref.operators : ''
  return typed
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter((call) => call)
    .join(' ')
}

/// `CLUB`: the club name as typed — spelled out in full, which only the
/// operator can do — on one line.
export function declaredClub(ref: Record<string, JSONValue> | undefined): string {
  return typeof ref?.club === 'string' ? ref.club.replace(/\s+/g, ' ').trim() : ''
}
