import type { JSONValue } from '@ham2k/extension-sdk'
import { BONUS_NUMBER, type Exchange, object, type Qson, refOf, text } from './model.ts'

function spaces(value: JSONValue | undefined): string {
  return text(value).trim().replace(/\s+/g, ' ')
}

export function normalizeSpc(value: JSONValue | undefined): string {
  return spaces(value).toUpperCase()
}

export function normalizeZombieNumber(value: JSONValue | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : text(value).trim()
}

export function normalizeZombieName(value: JSONValue | undefined): string {
  return spaces(value)
}

function printable(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
}

// SPC is an exchanged state, province or country, not a restricted state list.
export function validSpc(value: string): boolean {
  return printable(value) && /[^\s]/.test(value)
}

export function validZombieNumber(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
}

export function validZombieName(value: string): boolean {
  return printable(value) && /[^\s]/.test(value)
}

export function receivedRst(qso: Qson): string {
  return text(object(qso.their).sent).trim().toUpperCase()
}

// Native report controls preserve the copied text. N is the usual CW cut
// digit for 9; appended letters can describe the signal (for example 599C).
export function validRst(value: string): boolean {
  return /^[1-5][1-9N][1-9N][A-Z]*$/i.test(value)
}

export function validExchange(exchange: Exchange): boolean {
  return (
    validSpc(exchange.spc) &&
    validZombieNumber(exchange.zombieNumber) &&
    validZombieName(exchange.zombieName)
  )
}

export function received(qso: Qson): Exchange {
  const ref = refOf(qso)
  return {
    spc: normalizeSpc(ref?.theirSpc),
    zombieNumber: normalizeZombieNumber(ref?.theirZombieNumber),
    zombieName: normalizeZombieName(ref?.theirZombieName),
  }
}

export function sent(operation: Qson): Exchange {
  const ref = refOf(operation)
  return {
    spc: normalizeSpc(ref?.ourSpc),
    zombieNumber:
      ref?.bonusStation === true ? BONUS_NUMBER : normalizeZombieNumber(ref?.ourZombieNumber),
    zombieName: normalizeZombieName(ref?.ourZombieName),
  }
}

// A logged snapshot wins field by field, including an intentional empty value.
// Later operation edits must not rewrite what an earlier contact sent.
export function effectiveSent(operation: Qson, qso: Qson): Exchange {
  const snapshot = object(object(qso.our).zombie)
  const ref = refOf(qso)
  const fallback = sent(operation)
  return {
    spc:
      'spc' in snapshot
        ? normalizeSpc(snapshot.spc)
        : ref && 'ourSpc' in ref
          ? normalizeSpc(ref.ourSpc)
          : fallback.spc,
    zombieNumber:
      'zombieNumber' in snapshot
        ? normalizeZombieNumber(snapshot.zombieNumber)
        : ref && 'ourZombieNumber' in ref
          ? normalizeZombieNumber(ref.ourZombieNumber)
          : fallback.zombieNumber,
    zombieName:
      'zombieName' in snapshot
        ? normalizeZombieName(snapshot.zombieName)
        : ref && 'ourZombieName' in ref
          ? normalizeZombieName(ref.ourZombieName)
          : fallback.zombieName,
  }
}

export function exchangeText(exchange: Exchange, rst = ''): string {
  return [rst.trim(), exchange.spc, exchange.zombieNumber, exchange.zombieName]
    .filter(Boolean)
    .join(' ')
}
