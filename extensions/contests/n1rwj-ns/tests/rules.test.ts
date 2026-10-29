import { DXCC_BY_CODE } from '@ham2k/lib-dxcc-data'
import { describe, expect, it } from 'vitest'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import type { Qson } from '../../../../packages/mini-contest/src/model.ts'
import {
  sessionAtHand,
  sessionFor,
  sessionsFrom,
} from '../../../../packages/mini-contest/src/schedule.ts'
import manifest from '../manifest.json'
import { config } from '../src/config.ts'
import { guessedQth, nsMultiplier, validQth } from '../src/exchange.ts'
import { contact, ctx, operation } from './fixtures.ts'

const score = (qsos: Qson[], op = operation) =>
  createContestHooks(config, manifest).scoring.scoreQsos({ operation: op, qsos }, ctx)

describe('NS sessions', () => {
  it('offers fixed Friday UTC half hours through the US daylight-saving transition', () => {
    expect(sessionsFrom(config, Date.parse('2026-10-29T12:00:00Z')).map(({ key }) => key)).toEqual([
      '2026-10-30-0230',
      '2026-11-06-0230',
      '2026-11-13-0230',
      '2026-11-20-0230',
    ])
    expect(sessionFor(config, '2026-10-30-0230')).toEqual({
      key: '2026-10-30-0230',
      startMillis: Date.parse('2026-10-30T02:30:00Z'),
      endMillis: Date.parse('2026-10-30T03:00:00Z'),
    })
    for (const key of [
      '2026-10-29-0230',
      '2026-10-30-0200',
      '2026-10-30-0260',
      '2026-02-30-0230',
      'NS',
      '',
    ])
      expect(sessionFor(config, key)).toBeUndefined()
  })
  it('uses the existing nearby-session offer window', () => {
    expect(sessionAtHand(config, Date.parse('2026-10-29T23:29:59Z'))).toBeUndefined()
    expect(sessionAtHand(config, Date.parse('2026-10-29T23:30:00Z'))?.key).toBe('2026-10-30-0230')
    expect(sessionAtHand(config, Date.parse('2026-10-30T03:59:59Z'))?.key).toBe('2026-10-30-0230')
    expect(sessionAtHand(config, Date.parse('2026-10-30T04:00:00Z'))).toBeUndefined()
  })
})
describe('NS locations', () => {
  it('accepts states, provinces, known prefixes and DX, and rejects numbers and incomplete domestic QTHs', () => {
    for (const qth of [
      'RI',
      'DC',
      'AK',
      'HI',
      'ON',
      'NL',
      'NF',
      'LB',
      'NU',
      'KP4',
      'PR',
      'KP2',
      'XE',
      '9Y',
      '9Z',
      'P4',
      'PJ2',
      'PJ4',
      'PJ5',
      'PJ7',
      'DL',
      'G',
      'DX',
    ])
      expect(validQth(qth), qth).toBe(true)
    for (const qth of ['', '123', 'K', 'VE', 'QQ', 'DLABC', 'DL DE', '/DL', 'DL/', 'DL//P'])
      expect(validQth(qth), qth).toBe(false)
  })
  it('keeps the 51 US and thirteen Canadian multipliers distinct, merging NF/LB/NL', () => {
    expect(nsMultiplier(contact('DL1ABC'), 'RI')).toBe('state:RI')
    for (const state of ['AK', 'HI', 'DC'])
      expect(nsMultiplier(contact(), state)).toBe(`state:${state}`)
    for (const province of ['NL', 'NF', 'LB'])
      expect(nsMultiplier(contact(), province)).toBe('province:NL')
    const provinces = 'AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' ')
    expect(new Set(provinces.map((qth) => nsMultiplier(contact(), qth))).size).toBe(13)
  })
  it('counts every current North American DXCC and only the specified South American additions', () => {
    for (const entity of Object.values(DXCC_BY_CODE).filter(
      (e) =>
        !e.deleted &&
        e.source === 'DXCC' &&
        e.continents.includes('NA') &&
        ![1, 6, 291].includes(e.dxccCode),
    ))
      expect(
        nsMultiplier(
          {
            ...contact(),
            their: { call: `${entity.entityPrefix}1ABC`, dxccCode: entity.dxccCode },
          },
          entity.entityPrefix,
        ),
        entity.entityPrefix,
      ).toBe(`dxcc:${entity.dxccCode}`)
    for (const [prefix, code] of [
      ['9Y', 90],
      ['9Z', 90],
      ['P4', 91],
      ['PJ2', 517],
      ['PJ4', 520],
    ] as const)
      expect(nsMultiplier(contact(), prefix)).toBe(`dxcc:${code}`)
    for (const prefix of ['DL', 'G', 'JA', 'LU', 'PY', 'DX', '', 'QQ'])
      expect(nsMultiplier(contact(), prefix)).toBeUndefined()
    expect(nsMultiplier(contact(), 'KL')).toBe('state:AK')
    expect(nsMultiplier(contact(), 'KH6')).toBe('state:HI')
  })
  it('distinguishes Hawaii from the Dominican Republic and Ontario from Belgium', () => {
    expect(nsMultiplier(contact('KH6ABC'), 'HI')).toBe('state:HI')
    expect(nsMultiplier(contact('HI3ABC'), 'HI')).toBe('dxcc:72')
    expect(nsMultiplier(contact('VE3ABC'), 'ON')).toBe('province:ON')
    expect(nsMultiplier(contact('ON4ABC'), 'ON')).toBeUndefined()
    expect(
      nsMultiplier({ ...contact('ON4ABC'), their: { call: 'ON4ABC', state: 'ON' } }, 'ON'),
    ).toBe('province:ON')
  })
  it('requires DXCC prefixes for Caribbean countries rather than ambiguous postal abbreviations', () => {
    expect(nsMultiplier(contact('PR7ABC'), 'PR')).toBeUndefined()
    expect(nsMultiplier(contact('VK3ABC'), 'VI')).toBeUndefined()
    expect(nsMultiplier(contact('KP4ABC'), 'KP4')).toBe('dxcc:202')
    expect(nsMultiplier(contact('KP2ABC'), 'KP2')).toBe('dxcc:285')
    expect(guessedQth({ call: 'PR7ABC', entityPrefix: 'PR' })).toBe('DX')
  })
  it('does not manufacture a multiplier for DX, a missing QTH, or mobile-at-sea/air contacts', () => {
    for (const call of ['KP4ABC', 'PJ2ABC', 'K1ABC'])
      for (const qth of ['', 'DX']) expect(nsMultiplier(contact(call), qth)).toBeUndefined()
    expect(nsMultiplier(contact('K1ABC/MM'), 'MA')).toBeUndefined()
    expect(nsMultiplier(contact('K1ABC/AM'), 'MA')).toBeUndefined()
  })
  it('suggests NS exchanges from host locations and country files without applying SST DX conversions', () => {
    for (const [call, expected] of [
      ['KL7ABC', 'AK'],
      ['KH6ABC', 'HI'],
      ['KP4ABC', 'KP4'],
      ['9Y4ABC', '9Y'],
      ['P40ABC', 'P4'],
      ['PJ2ABC', 'PJ2'],
      ['DL1ABC', 'DX'],
      ['K1ABC/MM', 'DX'],
    ] as const)
      expect(guessedQth({ call }), call).toBe(expected)
    expect(guessedQth({ call: 'K1ABC', guess: { state: 'RI' } })).toBe('RI')
    expect(guessedQth({ call: 'VE3ABC', guess: { state: 'LB' } })).toBe('NL')
    expect(guessedQth({ call: 'DL1ABC', entityPrefix: 'K', state: 'RI' })).toBe('RI')
    expect(guessedQth({ call: 'K1ABC' })).toBe('')
    expect(guessedQth({ call: '' })).toBe('')
  })
})
describe('NS scoring', () => {
  it('scores QSOs times band multipliers and permits a station once on each band', async () => {
    const qsos = [
      contact(),
      contact('K2ABC'),
      contact('K1ABC', '40m'),
      contact('k1abc'),
      contact('VE3ABC', '20m', 'ON'),
    ]
    const result = await score(qsos)
    expect(result.operationSummary.ns).toMatchObject({ qsos: 4, points: 4, mults: 3, total: 12 })
    expect(result.qsoScores['k1abc-20m']).toMatchObject({ value: 0, dupe: true })
    expect(result.qsoScores['K1ABC-40m']).toMatchObject({
      dupe: false,
      notices: ['newMult', 'newBand'],
    })
    expect(result.operationSummary.ns?.longSummary).toContain('**20m**: 3 QSOs, 2 mults')
    expect(result.operationSummary.ns?.longSummary).toContain('**40m**: 1 QSOs, 1 mult')
  })
  it('counts DX contacts for QSO credit without adding a DX multiplier', async () => {
    const result = await score([
      contact(),
      contact('DL1ABC', '20m', 'DX'),
      contact('G4ABC', '20m', 'G'),
    ])
    expect(result.operationSummary.ns).toMatchObject({ points: 3, mults: 1, total: 3 })
  })
  it('accepts only CW on the five contest bands and excludes deleted and invalid contacts', async () => {
    const qsos = [
      ...config.bands.map((band) => contact('K1ABC', band)),
      contact('W1ABC', '10m'),
      contact('W2ABC', '30m'),
      { ...contact('W3ABC'), mode: 'RTTY' },
      { ...contact('W4ABC'), deleted: true },
      contact('NOTACALL'),
    ]
    const result = await score(qsos)
    expect(result.operationSummary.ns).toMatchObject({ points: 5, mults: 5, total: 25 })
    expect(result.qsoScores['W1ABC-10m']?.alerts).toEqual(['invalidBand'])
    expect(result.qsoScores['W3ABC-20m']?.alerts).toEqual(['invalidMode'])
  })
  it('scores contacts starting before the cutoff, including completion after 0300', async () => {
    const qsos: Qson[] = ['02:29:59', '02:30:00', '02:59:59', '03:00:00'].map((time, i) => ({
      ...contact(`K${i}ABC`),
      startAtMillis: Date.parse(`2026-10-30T${time}Z`),
      endAtMillis: Date.parse('2026-10-30T03:00:10Z'),
    }))
    const result = await score(qsos)
    expect(qsos.map((qso) => result.qsoScores[String(qso.uuid)]?.value)).toEqual([0, 1, 1, 0])
    expect(result.qsoScores['K3ABC-20m']?.alerts).toEqual(['Outside selected session'])
  })
  it('flags each missing exchange component and malformed serials/QTHs with provisional QSO credit', async () => {
    const refs = [
      { name: '', theirSerial: '1', location: 'MA' },
      { name: 'BOB', theirSerial: '', location: 'MA' },
      { name: 'BOB', theirSerial: '1', location: '' },
      { name: 'BOB', theirSerial: '0', location: 'MA' },
      { name: 'BOB', theirSerial: '42A', location: 'MA' },
      { name: 'BOB', theirSerial: '1', location: 'QQ' },
    ]
    const qsos: Qson[] = refs.map((ref, i) => ({
      ...contact(`K${i}ABC`),
      refs: [{ type: 'ns', ...ref }],
    }))
    const result = await score(qsos)
    expect(qsos.map((qso) => result.qsoScores[String(qso.uuid)]?.alerts)).toEqual([
      ['missingExchange'],
      ['missingExchange'],
      ['missingExchange'],
      ['invalidExchange'],
      ['invalidExchange'],
      ['invalidExchange'],
    ])
    expect(result.operationSummary.ns?.points).toBe(6)
    expect(result.operationSummary.ns?.mults).toBe(1)
  })
  it('rejects self contacts and contacts between two non-North American stations', async () => {
    expect((await score([contact('N1RWJ')])).operationSummary.ns?.points).toBe(0)
    const foreignOperation = {
      ...operation,
      stationCall: 'DL1ABC',
      refs: [{ type: 'ns', ref: '2026-10-30-0230', ourName: 'ANN', ourLocation: 'DX' }],
    }
    const result = await score(
      [contact('G4ABC', '20m', 'DX'), contact('K1ABC'), contact('P40ABC', '20m', 'P4')],
      foreignOperation,
    )
    expect(result.operationSummary.ns?.points).toBe(2)
    expect(result.qsoScores['G4ABC-20m']?.alerts).toEqual([
      'Contact must include a North American station',
    ])
  })
  it('resumes checkpoints and makes live duplicate checks without mutating prior scores', async () => {
    const { scoring } = createContestHooks(config, manifest)
    const initial = await scoring.scoreQsos({ operation, qsos: [contact()] }, ctx)
    const checkpoint = JSON.parse(JSON.stringify(initial.scoresheet))
    expect(
      await scoring.scoreQso?.({ operation, qso: contact(), resumeFrom: checkpoint }, ctx),
    ).toMatchObject({ dupe: true })
    const resumed = await scoring.scoreQsos(
      { operation, qsos: [contact('K1ABC', '40m')], resumeFrom: checkpoint },
      ctx,
    )
    expect(resumed.operationSummary.ns).toMatchObject({ points: 2, mults: 2, total: 4 })
    expect(initial.operationSummary.ns?.points).toBe(1)
    expect(resumed.daySections).toHaveLength(1)
  })
})
