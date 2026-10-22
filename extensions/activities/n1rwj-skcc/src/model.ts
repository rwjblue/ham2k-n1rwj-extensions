// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { JSONValue } from '@ham2k/extension-sdk'

export const TYPE = 'skcc'
export const KEY = 'n1rwj-skcc'
export const HOME = 'https://www.skccgroup.com/'
export type Qson = Record<string, JSONValue>
export type Suffix = '' | 'C' | 'T' | 'S'
export type KeyType = '' | 'SK' | 'BUG' | 'SS' | 'WAIVER' | 'OTHER'
export type EventId =
  | 'general'
  | 'wes'
  | 'sks'
  | 'skse'
  | 'sksa'
  | 'sss'
  | 'qso-party'
  | 'k3y'
  | 'cskm'

export interface Member {
  number: string
  call: string
  name: string
  spc: string
  qth: string
  suffix: Suffix
  oldCalls: string[]
  status: 'A' | 'IA' | 'SK'
  joinDate?: string
  centurionDate?: string
  tribuneDate?: string
  tx8Date?: string
  senatorDate?: string
  dxcc?: string
}

export interface Roster {
  members: Member[]
  downloadedAt: number
  source: string
  revision: string
}
export type RosterGetter = () => Roster | undefined

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
export function object(value: unknown): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Qson) : {}
}
export function refOf(container: Qson): Qson | undefined {
  return Array.isArray(container.refs)
    ? container.refs.map(object).find((ref) => ref.type === TYPE)
    : undefined
}
export function memberNumber(value: unknown): string | undefined {
  const match = text(value)
    .toUpperCase()
    .match(/^0*([1-9][0-9]{0,5})(?:[CTS])?$/)
  return match?.[1]
}
export function memberSuffix(value: unknown): Suffix {
  return memberNumber(value)
    ? ((text(value)
        .toUpperCase()
        .match(/[CTS]$/)?.[0] ?? '') as Suffix)
    : ''
}
export function utcDate(at: number): string {
  return Number.isFinite(at) && Math.abs(at) <= 8640000000000000
    ? new Date(at).toISOString().slice(0, 10)
    : ''
}
