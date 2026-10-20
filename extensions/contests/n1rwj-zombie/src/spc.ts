// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import { annotateCallAgainstCountryFile } from '@ham2k/extension-sdk'
import { isCallsign, normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
import { normalizeSpc, validSpc } from './exchange.ts'
import { object, type Qson, text } from './model.ts'

function field(source: Qson, key: string): string | undefined {
  return typeof source[key] === 'string' ? normalizeSpc(source[key]) : undefined
}

function usable(value: string | undefined): string {
  return value && validSpc(value) && /[A-Z]/i.test(value) ? value : ''
}

/** A late directory answer may improve an untouched SPC field, but cannot
 * supply an event name or Zombie number. The host's lookup merge has already
 * reconciled competing location sources; do not reassemble its raw lookups. */
export function zombieSpcSuggestion(their: Qson): string {
  const call = normalizeCall(text(their.call))
  if (!isCallsign(call)) return ''
  const annotation = annotateCallAgainstCountryFile(call)
  let guess = object(their.guess)
  // Ignore answers left for a different call. A portable call's home-QTH
  // directory entry does not establish its present state/province either.
  const guessCall = normalizeCall(text(guess.call))
  if (
    (guessCall && guessCall !== call) ||
    (call.includes('/') && !['prefixed', 'portable'].includes(text(guess.locationScope)))
  )
    guess = {}

  const country =
    field(their, 'country') ??
    field(guess, 'country') ??
    field(their, 'entityName') ??
    field(guess, 'entityName') ??
    normalizeSpc(annotation.entityName)
  const prefix =
    field(their, 'entityPrefix') ??
    field(guess, 'entityPrefix') ??
    normalizeSpc(annotation.entityPrefix)
  const normalizedCountry = country.replace(/\./g, '')
  const isUnitedStates =
    ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'ALASKA', 'HAWAII'].includes(
      normalizedCountry,
    ) ||
    (!country && ['K', 'KL', 'KH6'].includes(prefix))
  const isCanada =
    ['CA', 'CAN', 'CANADA'].includes(normalizedCountry) || (!country && prefix === 'VE')
  if (isUnitedStates || isCanada) {
    // Explicit general-state edits and clearing also beat a directory value.
    // No state or province is inferred from a call district. AK/HI remain
    // ordinary state exchanges here; SST's DX conversion does not apply.
    return usable(field(their, 'state') ?? field(guess, 'state'))
  }
  return usable(country)
}
