import type { FormField, JSONValue } from '@ham2k/extension-sdk'

export type Qson = Record<string, JSONValue>
export interface ContestConfig {
  type: 'mst' | 'sst' | 'wrt'
  name: string
  shortName: string
  adifId: string
  cabrilloId: string
  aliases: string[]
  rulesUrl: string
  slots: { day: number; hour: number; minute?: number }[]
  durationMinutes: number
  mode: 'CW' | 'RTTY'
  bands: string[]
  powerClasses: typeof POWER_CLASSES
  multiplier: 'callsign' | 'sst-location'
  setupLocationSuggestions?: FormField['suggestions']
  locationInput?: {
    label: string
    placeholder: string
    pattern: string
    maxLength: number
    guess(their: Qson): string
    valid(value: string): boolean
  }
  exchange: 'serial-name' | 'name-location'
  guidance: string
}
export interface DownloadedContestConfig extends ContestConfig {
  historyPrefix: string
  historyAliases: string[]
}
export interface ContestManifest {
  key: string
  icon: string
  accentColor: string
}
export function text(value: JSONValue | undefined): string {
  return typeof value === 'string' ? value : ''
}
export function object(value: JSONValue | undefined): Qson {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function refOf(container: Qson, type: string): Qson | undefined {
  return Array.isArray(container.refs)
    ? container.refs.map(object).find((ref) => ref.type === type)
    : undefined
}
export const BANDS = ['160m', '80m', '40m', '20m', '15m', '10m']
export const POWER_CLASSES = [
  { value: 'QRP', label: 'QRP (≤5 W)', cabrillo: 'QRP' },
  { value: 'LP', label: 'Low (≤100 W)', cabrillo: 'LOW' },
  { value: 'HP', label: 'High (>100 W)', cabrillo: 'HIGH' },
]

export function contestMode(mode: string): string {
  const value = mode.trim().toUpperCase()
  return ['RTTY', 'RTTY-R', 'RTTY-LSB', 'RTTY-USB'].includes(value) ? 'RTTY' : value
}
