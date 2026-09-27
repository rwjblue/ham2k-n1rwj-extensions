import { annotateCallAgainstCountryFile } from '@ham2k/extension-sdk'
import { location, PROVINCES, STATES } from '../../../../packages/mini-contest/src/exchange.ts'
import { object, type Qson, text } from '../../../../packages/mini-contest/src/model.ts'

// QTH is exchanged text, not a geographic multiplier. Accept prefix syntax
// without a callsign-derived whitelist: ON can mean Ontario or Belgium.
export const QTH_PATTERN = '(?!DX$)(?=[A-Z0-9/]*[A-Z])[A-Z0-9]+(?:/[A-Z0-9]+)*'
export function validQth(value: string): boolean {
  return value.length <= 10 && new RegExp(`^(?:${QTH_PATTERN})$`).test(value)
}
export function guessedQth(their: Qson): string {
  const guess = object(their.guess)
  const info = annotateCallAgainstCountryFile(text(their.call))
  const entity =
    location(their.entityPrefix) || location(guess.entityPrefix) || location(info.entityPrefix)
  const state = location(their.state) || location(guess.state)
  if (entity === 'K') return STATES.has(state) ? state : ''
  if (entity === 'VE') return PROVINCES.has(state) ? state : ''
  // The short sponsor rules do not spell out Alaska/Hawaii. Preserve either
  // exchange as entered, but leave these ambiguous lookup hints to the operator.
  if (entity === 'KL' || entity === 'KH6') return ''
  return validQth(entity) ? entity : ''
}
