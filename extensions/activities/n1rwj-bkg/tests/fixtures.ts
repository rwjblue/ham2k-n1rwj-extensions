import type { BoardSpot, PanelRenderArgs } from '@ham2k/extension-sdk'
import { parseRoster } from '../src/roster.ts'

export const at = Date.UTC(2026, 9, 29, 12)
export const entries = [
  {
    bkg_number: 1,
    callsign: 'N0AAA',
    name: 'Alex',
    qth: 'Utah',
    qso_date: '2025-08-02',
    sponsor_bkg_number: null,
    map_location: null,
    photo: null,
  },
  {
    bkg_number: 2,
    callsign: 'N0BBB',
    name: 'Blair',
    qth: 'Rhode Island',
    qso_date: '2026-01-01',
    sponsor_bkg_number: 1,
    map_location: null,
    photo: null,
  },
  {
    bkg_number: 3,
    callsign: 'VE3ABC',
    name: 'Charlie',
    qth: 'Ontario',
    qso_date: '2026-02-01',
    sponsor_bkg_number: 2,
    map_location: null,
    photo: null,
  },
]
export function body(members: unknown[] = entries, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema_version: '2',
    generated_at: new Date(at).toISOString(),
    content_hash: `sha256:${'a'.repeat(64)}`,
    members,
    og_assignments: [],
    ...overrides,
  })
}
export function roster() {
  return parseRoster(body(), at)
}
export function qso(call = 'N0BBB', uuid = 'qso') {
  return {
    uuid,
    our: { call: 'W9HUNT' },
    their: { call },
    band: '2m',
    mode: 'CW',
    startAtMillis: at,
  }
}
export function args(overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    panelKey: 'gang',
    operation: { uuid: 'operation', operatorCall: 'N0AAA' },
    qsoCount: 0,
    config: {},
    reason: 'initial',
    clock: { nowMillis: at, realNowMillis: at },
    ...overrides,
  }
}
export function spot(call: string, band = '20m', mode = 'CW', age = 0): BoardSpot {
  return {
    their: { call },
    band,
    mode,
    freq: band === '2m' ? 144025 : 14025,
    spot: { timeInMillis: at - age, source: 'test' },
  }
}
