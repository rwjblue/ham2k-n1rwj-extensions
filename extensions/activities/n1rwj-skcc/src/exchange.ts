// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type KeyType, memberNumber, object, type Qson, refOf, text } from './model.ts'

export const KEY_OPTIONS = [
  { code: '', name: 'Unknown' },
  { code: 'SK', name: 'Straight key' },
  { code: 'BUG', name: 'Bug' },
  { code: 'SS', name: 'Sideswiper / cootie' },
  { code: 'WAIVER', name: 'SKCC policy exemption' },
  { code: 'OTHER', name: 'Other key' },
]
export function keyType(value: unknown): KeyType {
  const key = text(value).toUpperCase()
  return KEY_OPTIONS.some((option) => option.code === key) ? (key as KeyType) : ''
}
export function numberToken(value: unknown): string {
  const raw = text(value).toUpperCase()
  const number = memberNumber(raw)
  return number ? number + (/[CTS]$/.exec(raw)?.[0] ?? '') : raw === 'NONE' ? 'NONE' : raw
}
export function isQualified(value: unknown): boolean | undefined {
  return value === true || value === 'yes'
    ? true
    : value === false || value === 'no'
      ? false
      : undefined
}
/** Explicitly empty editable fields outrank the saved projection and roster hints. */
export function getExchange(qso: Qson): Qson {
  const saved = object(object(qso.their).skcc)
  const ref = refOf(qso)
  const result: Qson = { ...saved, ...(ref ?? {}) }
  if (!('number' in result) && memberNumber(result.ref)) result.number = text(result.ref)
  return result
}
export function ownExchange(qso: Qson, operation: Qson = {}): Qson {
  const op = refOf(operation) ?? {}
  const imported = object(getExchange(qso).our)
  const defaults: Qson = {}
  for (const field of [
    'number',
    'name',
    'spc',
    'key',
    'qualified',
    'keyDeclared',
    'grid',
    'power',
    'operatorCall',
  ]) {
    const source = `our${field.charAt(0).toUpperCase()}${field.slice(1)}`
    if (source in op) defaults[field] = op[source]
  }
  if (text(op.ref)) defaults.event = text(op.ref)
  return { ...defaults, ...imported, ...object(object(qso.our).skcc) }
}
export function reportFor(qso: Qson, side: 'our' | 'their'): string {
  const station = object(qso[side])
  return (
    text(station.sent) ||
    text(station.rst) ||
    text((side === 'our' ? ownExchange(qso) : getExchange(qso)).rst)
  )
}
export function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}
export function exchangeText(exchange: Qson): string {
  return [text(exchange.name), text(exchange.spc), numberToken(exchange.number)]
    .filter(Boolean)
    .join(' ')
}
export function snapshotBeforeSave(qso: Qson, operation: Qson): Qson | null {
  if (!refOf(operation) && !refOf(qso)) return null
  const received = getExchange(qso)
  const ours = ownExchange(qso, operation)
  const skcc: Qson = {}
  for (const field of [
    'number',
    'name',
    'spc',
    'operatorCall',
    'key',
    'qualified',
    'grid',
    'wpm',
    'power',
    'region',
    'event',
    'keyDeclared',
  ]) {
    if (field in received) skcc[field] = received[field]
  }
  if (!('event' in skcc)) skcc.event = text(refOf(operation)?.ref) || 'general'
  return { their: { exchange: exchangeText(received), skcc }, our: { skcc: ours } }
}
