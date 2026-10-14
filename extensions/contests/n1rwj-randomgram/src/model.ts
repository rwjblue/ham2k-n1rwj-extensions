import type { JSONValue } from '@ham2k/extension-sdk'

export type Qson = Record<string, JSONValue>
export const REF_TYPE = 'randomgram'
export const RULES_URL = 'https://groups.io/g/RandomGram/topic/randomgram_overview/97601889'
export const BANDS = ['160m', '80m', '40m', '20m', '15m', '10m']

export function object(value: JSONValue | undefined): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function text(value: JSONValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

export function refOf(container: Qson): Qson | undefined {
  return Array.isArray(container.refs)
    ? container.refs.map(object).find((ref) => ref.type === REF_TYPE)
    : undefined
}

// This number is only a position in the issued list, never an exchange.
export function position(value: JSONValue | undefined): number | undefined {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

export function operationGroups(operation: Qson): string[] {
  const groups = refOf(operation)?.txGroups
  return Array.isArray(groups) ? groups.map(text) : []
}
