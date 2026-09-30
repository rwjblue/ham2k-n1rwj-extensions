// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import type { Spot } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { parseReports, selectSpots } from '../../src/spots/model.ts'

const now = Date.parse('2026-09-30T13:10:00Z')
const row = (changes: Record<string, unknown> = {}) => ({
  callsign: 'W2NO',
  frequency: 14032.5,
  mode: 'CW',
  timestamp: new Date(now - 120_000).toISOString(),
  spotter: 'K1TTT',
  ...changes,
})
const reference = (call: string): NonNullable<Spot['refs']> => [{ type: 'rbn', ref: call }]
const select = (reports: Spot[], skimmers: string[] = []) =>
  selectSpots(reports, undefined, { skimmers, grids: [] }, () => undefined, now)

describe('RBN station references', () => {
  it.each(['CW', 'RTTY', 'FT8', 'FT4'])(
    'gives different stations at the same frequency distinct full-call references (%s)',
    (mode) => {
      const reports = parseReports(
        [' w2no ', 'KR2Q', ' w2no/p '].map((callsign) => row({ callsign, mode })),
        'n1rwj-rbn',
        now,
      )
      expect(
        select(reports).map(({ their, freq, mode, refs }) => ({
          call: their.call,
          freq,
          mode,
          refs,
        })),
      ).toEqual(
        ['W2NO', 'KR2Q', 'W2NO/P'].map((call) => ({
          call,
          freq: 14032.5,
          mode,
          refs: reference(call),
        })),
      )
      expect(reports.every(({ spot }) => spot.label === undefined)).toBe(true)
    },
  )

  it.each(['CW', 'RTTY', 'FT8', 'FT4'])(
    'keeps a station reference stable across receivers, time, frequency, and band (%s)',
    (mode) => {
      const reports = parseReports(
        [
          row({ callsign: ' w2no/p ', mode }),
          row({
            callsign: 'W2NO/P',
            mode,
            spotter: 'W3LPL',
            frequency: 14034,
            timestamp: new Date(now - 60_000).toISOString(),
          }),
          row({
            callsign: 'w2no/p',
            mode,
            spotter: 'KM3T-5',
            frequency: 7032.5,
            timestamp: new Date(now).toISOString(),
          }),
        ],
        'n1rwj-rbn',
        now,
      )
      expect(reports).toHaveLength(3)
      expect(reports.map(({ refs }) => refs)).toEqual([
        reference('W2NO/P'),
        reference('W2NO/P'),
        reference('W2NO/P'),
      ])
      expect(select(reports).map(({ refs }) => refs)).toEqual([
        reference('W2NO/P'),
        reference('W2NO/P'),
      ])
    },
  )

  it('preserves newest-report selection per station, band, and mode after receiver filtering', () => {
    const reports = parseReports(
      [
        row(),
        row({ spotter: 'KM3T-5', timestamp: new Date(now - 90_000).toISOString() }),
        row({
          spotter: 'W3LPL',
          frequency: 14034,
          timestamp: new Date(now - 60_000).toISOString(),
        }),
        row({ mode: 'RTTY', frequency: 14082.5 }),
        row({
          mode: 'RTTY',
          spotter: 'W3LPL',
          frequency: 14085,
          timestamp: new Date(now - 30_000).toISOString(),
        }),
        row({ frequency: 7032.5, timestamp: new Date(now - 20_000).toISOString() }),
        row({
          mode: 'RTTY',
          frequency: 7082.5,
          timestamp: new Date(now - 10_000).toISOString(),
        }),
      ],
      'n1rwj-rbn',
      now,
    )
    const selected = select(reports)
    expect(
      selected.map(({ freq, band, mode, spot }) => ({
        freq,
        band,
        mode,
        receiver: spot.sourceInfo?.spotter,
      })),
    ).toEqual([
      { freq: 7082.5, band: '40m', mode: 'RTTY', receiver: 'K1TTT' },
      { freq: 7032.5, band: '40m', mode: 'CW', receiver: 'K1TTT' },
      { freq: 14085, band: '20m', mode: 'RTTY', receiver: 'W3LPL' },
      { freq: 14034, band: '20m', mode: 'CW', receiver: 'W3LPL' },
    ])
    expect(selected.map(({ refs }) => refs)).toEqual(Array(4).fill(reference('W2NO')))

    const filtered = select(reports, ['K1TTT'])
    expect(filtered.map(({ freq }) => freq)).toEqual([7082.5, 7032.5, 14032.5, 14082.5])
    expect(filtered.map(({ refs }) => refs)).toEqual(Array(4).fill(reference('W2NO')))
  })
})
