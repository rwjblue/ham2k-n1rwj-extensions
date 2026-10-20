import type { JSONValue } from '@ham2k/extension-sdk'

export const TYPE = 'zombie'
export const EVENT_REF = '2026'
export const BONUS_NUMBER = '4321'
export const RULES_URL = 'https://www.zianet.com/qrp/ZOMBIE/pg.html'
export const BANDS = ['80m', '40m', '20m', '15m', '10m']
export const SCORING_BANDS = ['80m', '40m', '20m', '10m/15m']

export type Qson = Record<string, JSONValue>

export interface Exchange {
  spc: string
  zombieNumber: string
  zombieName: string
}

export function text(value: JSONValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

export function object(value: JSONValue | undefined): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function refOf(container: Qson): Qson | undefined {
  return Array.isArray(container.refs)
    ? container.refs.map(object).find((ref) => ref.type === TYPE)
    : undefined
}
