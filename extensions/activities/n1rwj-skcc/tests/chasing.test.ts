// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it, vi } from 'vitest'
import { createChasing } from '../src/chasing.ts'
import type { Qson, Roster } from '../src/model.ts'

const roster: Roster = {
  downloadedAt: 0,
  source: 'test',
  revision: 'one',
  members: [
    {
      number: '1',
      call: 'N1ME',
      name: 'Me',
      spc: 'MA',
      qth: '',
      suffix: 'C',
      oldCalls: [],
      status: 'A',
      joinDate: '2006-01-01',
      centurionDate: '2020-01-01',
    },
    {
      number: '23456',
      call: 'K2YOU',
      name: 'You',
      spc: 'NY',
      qth: '',
      suffix: 'T',
      oldCalls: [],
      status: 'A',
      joinDate: '2006-01-01',
      centurionDate: '2020-01-01',
      tribuneDate: '2021-01-01',
    },
  ],
}
const qso: Qson = {
  uuid: 'one',
  startAtMillis: Date.parse('2026-10-20T12:00:00Z'),
  band: '40m',
  mode: 'CW',
  our: { call: 'N1ME', skcc: { number: '1', name: 'Me', qualified: true } },
  their: { call: 'K2YOU' },
  refs: [{ type: 'skcc', number: '23456', name: 'You', qualified: true }],
}
const ctx = {
  online: false,
  getQsos: vi.fn(() => {
    throw new Error('Forbidden log read')
  }),
}
function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected test fixture to exist')
  return value
}

describe('SKCC native chasing', () => {
  it('maps each QSO independently to worked claims without scanning a log', async () => {
    const hook = defined(createChasing(() => roster).find((item) => item.key.endsWith('_c'))).hook
    const result = await hook.claimsForQsos(
      {
        qsos: [
          qso,
          { ...qso, uuid: 'event', band: 'event' },
          { ...qso, uuid: 'spot', refs: [] },
          { ...qso, uuid: '' },
        ],
      },
      ctx,
    )
    expect(result.one).toEqual([
      { holder: '1', ref: '23456', band: null, mode: null, level: 'worked', label: 'K2YOU #23456' },
      {
        holder: '1',
        ref: '23456',
        band: '40m',
        mode: null,
        level: 'worked',
        label: 'K2YOU #23456',
      },
    ])
    expect(result.event).toEqual([])
    expect(result.spot).toEqual([])
    expect(result['']).toBeUndefined()
    expect(ctx.getQsos).not.toHaveBeenCalled()
  })
  it('freezes roster and options for the registration and requires restart for changes', async () => {
    let current = structuredClone(roster)
    const opts = { myNumber: '1' }
    const hook = defined(
      createChasing(() => current, { getOptions: () => opts, version: 7 })[0],
    ).hook
    await hook.claimsForQsos({ qsos: [qso] }, ctx)
    defined(current.members[1]).joinDate = '2027-01-01'
    opts.myNumber = '999'
    expect((await hook.claimsForQsos({ qsos: [qso] }, ctx)).one).toHaveLength(2)
    current = { ...current, revision: 'two' }
    expect(hook.program.version).toBe(7)
    const restarted = defined(createChasing(() => current)[0]).hook
    expect((await restarted.claimsForQsos({ qsos: [qso] }, ctx)).one).toEqual([])
  })
  it('fails explicitly with no frozen roster rather than withdrawing existing credits', async () => {
    const hook = defined(createChasing(() => undefined)[0]).hook
    await expect(async () => hook.claimsForQsos({ qsos: [qso] }, ctx)).rejects.toThrow(
      'roster unavailable',
    )
  })
  it('uses membership identity for holders and does not promote confirmation levels', async () => {
    const hook = defined(createChasing(() => roster)[0]).hook
    expect(await hook.holdersFor({ station: { call: 'N1ME' } }, ctx)).toEqual(['1'])
    const result = await hook.claimsForQsos(
      {
        qsos: [
          { ...qso, qsl: { lotw: { received: true } }, credits: { skcc: { level: 'verified' } } },
        ],
      },
      ctx,
    )
    expect(result.one?.every((claim) => claim.level === 'worked')).toBe(true)
  })
  it('summarizes only mixed slots, preserving per-band deduplication for QRP', async () => {
    const hook = defined(
      createChasing(() => roster).find((item) => item.key.endsWith('_qrp1')),
    ).hook
    const summary = await hook.summarizeClaims(
      {
        holder: '1',
        slots: [
          { ref: '23456:40m', band: null, mode: null, level: 'worked' },
          { ref: '23456:40m', band: '40m', mode: null, level: 'worked' },
          { ref: '23456:20m', band: null, mode: null, level: 'worked' },
        ],
      },
      ctx,
    )
    expect(summary.progress?.total).toBe(3)
  })
  it('accepts a later roster replay after an initial unavailable call', async () => {
    let current: Roster | undefined
    const hook = defined(createChasing(() => current)[0]).hook
    expect(() => hook.holdersFor({ station: { call: 'N1ME' } }, ctx)).toThrow('roster unavailable')
    current = roster
    expect(await hook.holdersFor({ station: { call: 'N1ME' } }, ctx)).toEqual(['1'])
  })
  it('does not replace native claim imports with a malformed partial file', async () => {
    const onReport = vi.fn()
    const hook = defined(createChasing(() => roster, { onReport })[0]).hook
    const importer = defined(hook.importClaims)
    await expect(
      importer(
        {
          importer: 'skcc-adif',
          file: { name: 'broken.adi', text: '<CALL:20>X' },
          station: { call: 'N1ME' },
        },
        ctx,
      ),
    ).rejects.toThrow('was not imported')
    expect(onReport).toHaveBeenCalledOnce()
    expect(onReport.mock.calls[0]?.[0]?.scope).toBe('selected')
  })
  it('never assumes a native file import is complete or supplies missing qualification', async () => {
    const onReport = vi.fn()
    const hook = defined(
      createChasing(() => roster, {
        onReport,
        getOptions: () => ({ attestImportedEligibility: true, scope: 'complete-history' }),
      })[0],
    ).hook
    const importer = defined(hook.importClaims)
    const imported = await importer(
      {
        importer: 'skcc-adif',
        file: {
          name: 'selected.adi',
          text: '<CALL:5>K2YOU<QSO_DATE:8>20261020<TIME_ON:4>1200<BAND:3>40m<MODE:2>CW<SKCC:5>23456<NAME:3>You<EOR>',
        },
        station: { call: 'N1ME' },
      },
      ctx,
    )
    expect(imported.claims).toEqual([])
    expect(onReport.mock.calls[0]?.[0]?.scope).toBe('selected')
    expect(onReport.mock.calls[0]?.[0]?.rows[0].issues).toContain(
      'Approved keying by both stations has not been recorded',
    )
  })
})
