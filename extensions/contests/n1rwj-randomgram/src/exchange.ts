import { object, operationGroups, position, type Qson, refOf, text } from './model.ts'

export type Alphabet = 'letters' | 'alphanumeric'
export interface SentExchange {
  state: 'ready' | 'unconfigured' | 'pending' | 'exhausted' | 'invalid'
  group: string
  position?: number
  source?: 'list' | 'override' | 'saved'
  reason?: string
}

export function validGroup(value: string, alphabet: Alphabet = 'alphanumeric'): boolean {
  return (alphabet === 'letters' ? /^[A-Z]{5}$/ : /^[A-Z0-9]{5}$/).test(value)
}

export function resolveSent(operation: Qson, qso: Qson): SentExchange {
  const opRef = refOf(operation)
  const qsoRef = refOf(qso)
  const item = position(qsoRef?.ourSerial)
  const alphabet = opRef?.alphabet === 'letters' ? 'letters' : 'alphanumeric'
  const override = text(qsoRef?.ourGroup).trim()
  const saved = text(object(qso.our).exchange).trim()
  // A correction is explicit; a snapshot protects historical contacts from
  // operation setup edits. Neither reading may advance the issued list.
  const literal = override || saved
  if (literal) {
    return validGroup(literal, override ? alphabet : 'alphanumeric')
      ? { state: 'ready', group: literal, position: item, source: override ? 'override' : 'saved' }
      : {
          state: 'invalid',
          group: '',
          position: item,
          reason: 'The sent group must match the selected event alphabet.',
        }
  }
  const groups = operationGroups(operation)
  if (groups.length === 0) {
    return {
      state: 'unconfigured',
      group: '',
      reason: 'Import your issued TX list in operation setup.',
    }
  }
  if (item === undefined) {
    const raw = qsoRef?.ourSerial
    const empty =
      raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
    return empty
      ? { state: 'pending', group: '', reason: 'Enter a callsign to reserve a TX item.' }
      : { state: 'invalid', group: '', reason: 'The TX item must be a positive whole number.' }
  }
  if (item > groups.length) {
    return {
      state: 'exhausted',
      group: '',
      position: item,
      reason: 'This issued TX list is exhausted.',
    }
  }
  const group = groups[item - 1]
  return validGroup(group, alphabet)
    ? { state: 'ready', group, position: item, source: 'list' }
    : {
        state: 'invalid',
        group: '',
        position: item,
        reason: 'The selected TX item is not a valid code group.',
      }
}

export function sentGroup(operation: Qson, qso: Qson): string {
  return resolveSent(operation, qso).group
}

export function receivedGroup(qso: Qson): string {
  const ref = refOf(qso)
  // An explicitly cleared received field remains clear, even on a saved QSO.
  return ref && Object.keys(ref).includes('theirGroup')
    ? text(ref.theirGroup).trim()
    : text(object(qso.their).exchange).trim()
}
