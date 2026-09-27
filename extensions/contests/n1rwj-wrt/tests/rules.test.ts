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
import { guessedQth, validQth } from '../src/exchange.ts'
import { contact, ctx, operation } from './fixtures.ts'

const score = (qsos: Qson[]) =>
  createContestHooks(config, manifest).scoring.scoreQsos({ operation, qsos }, ctx)

describe('WRT sessions', () => {
  it('offers four weekly Friday sessions, including minute 45 and DST transitions', () => {
    expect(sessionsFrom(config, Date.parse('2026-10-29T12:00:00Z')).map(({ key }) => key)).toEqual([
      '2026-10-30-0145',
      '2026-11-06-0145',
      '2026-11-13-0145',
      '2026-11-20-0145',
    ])
    expect(sessionFor(config, '2026-10-02-0145')).toEqual({
      key: '2026-10-02-0145',
      startMillis: Date.parse('2026-10-02T01:45:00Z'),
      endMillis: Date.parse('2026-10-02T02:15:00Z'),
    })
  })
  it('rejects wrong weekdays, start minutes, invalid dates and malformed references', () => {
    for (const key of [
      '2026-10-01-0145',
      '2026-10-02-0100',
      '2026-10-02-0160',
      '2026-02-30-0145',
      'WRT',
      '',
    ])
      expect(sessionFor(config, key)).toBeUndefined()
  })
  it('offers the session three hours before and retains it for an hour after ending', () => {
    expect(sessionAtHand(config, Date.parse('2026-10-01T22:44:59Z'))).toBeUndefined()
    expect(sessionAtHand(config, Date.parse('2026-10-01T22:45:00Z'))?.key).toBe('2026-10-02-0145')
    expect(sessionAtHand(config, Date.parse('2026-10-02T03:14:59Z'))?.key).toBe('2026-10-02-0145')
    expect(sessionAtHand(config, Date.parse('2026-10-02T03:15:00Z'))).toBeUndefined()
  })
})
describe('WRT exchange', () => {
  it('accepts states, provinces and country prefixes without rewriting ambiguity', () => {
    for (const qth of ['RI', 'ON', 'AK', 'HI', 'KL', 'KH6', 'DL', 'G', '9A', '3D2/R', 'EA8', 'VE'])
      expect(validQth(qth)).toBe(true)
    for (const qth of ['', 'DX', '1234', 'DL DE', '/DL', 'DL/', 'DL//P', 'ABCDEFGHIJK'])
      expect(validQth(qth)).toBe(false)
  })
  it('uses domestic lookup subdivisions and foreign prefixes, never SST DX', () => {
    expect(guessedQth({ call: 'K1ABC', entityPrefix: 'K', state: 'RI' })).toBe('RI')
    expect(guessedQth({ call: 'VE3ABC', guess: { entityPrefix: 'VE', state: 'ON' } })).toBe('ON')
    expect(guessedQth({ call: 'ON4ABC', entityPrefix: 'ON' })).toBe('ON')
    expect(guessedQth({ call: 'DL1ABC', entityPrefix: 'DL', state: 'MA' })).toBe('DL')
    expect(guessedQth({ call: 'G4ABC' })).toBe('G')
    expect(guessedQth({ call: 'K1ABC', entityPrefix: 'K' })).toBe('')
    expect(guessedQth({ call: 'KL7ABC', entityPrefix: 'KL', state: 'AK' })).toBe('')
    expect(guessedQth({ call: 'KH6ABC', entityPrefix: 'KH6', state: 'HI' })).toBe('')
  })
})
describe('WRT scoring', () => {
  it('counts calls once per session and contacts once per band across RTTY aliases', async () => {
    const qsos = [
      contact(),
      contact('K1ABC', '40m'),
      contact('k1abc', '20m', 'MA', 'RTTY-LSB'),
      contact('DL1ABC', '20m', 'DL'),
    ]
    const result = await score(qsos)
    expect(result.operationSummary.wrt).toMatchObject({ points: 3, qsos: 3, mults: 2, total: 6 })
    expect(result.qsoScores[String(qsos[1]?.uuid)]).toMatchObject({
      dupe: false,
      notices: ['newBand'],
    })
    expect(result.qsoScores[String(qsos[2]?.uuid)]).toMatchObject({ value: 0, dupe: true })
  })
  it('allows only the five contest bands and explicit RTTY modes', async () => {
    const modes = ['RTTY', 'RTTY-LSB', 'rtty-usb', 'RTTY-R', 'DATA', 'DATA-USB', 'FT8', 'CW', 'SSB']
    const qsos = modes.map((mode, i) => contact(`K${i}ABC`, '20m', 'MA', mode))
    qsos.push(
      contact('W1ABC', '160m'),
      contact('W2ABC', '30m'),
      { ...contact('W3ABC'), deleted: true },
      contact('NOTACALL'),
    )
    const result = await score(qsos)
    expect(result.operationSummary.wrt).toMatchObject({ points: 4, mults: 4, total: 16 })
    expect(result.qsoScores['W1ABC-160m-RTTY']?.alerts).toEqual(['invalidBand'])
    expect(result.qsoScores['K4ABC-20m-DATA']?.alerts).toEqual(['invalidMode'])
    expect(
      (await score(config.bands.map((band) => contact('K1ABC', band)))).operationSummary.wrt,
    ).toMatchObject({ points: 5, mults: 1, total: 5 })
  })
  it('includes the exact start but excludes the exact end of the half hour', async () => {
    const qsos: Qson[] = ['01:44:59', '01:45:00', '02:14:59', '02:15:00'].map((time, i) => ({
      ...contact(`K${i}ABC`),
      startAtMillis: Date.parse(`2026-10-02T${time}Z`),
    }))
    const result = await score(qsos)
    expect(qsos.map((qso) => result.qsoScores[String(qso.uuid)]?.value)).toEqual([0, 1, 1, 0])
    expect(result.operationSummary.wrt?.total).toBe(4)
  })
  it('flags missing/invalid exchanges but retains provisional callsign points and multipliers', async () => {
    const result = await score([
      contact('K1ABC', '20m', ''),
      contact('K2ABC', '20m', 'DX'),
      contact('K3ABC', '20m', '1234'),
    ])
    expect(Object.values(result.qsoScores).map(({ alerts }) => alerts)).toEqual([
      ['missingExchange'],
      ['invalidExchange'],
      ['invalidExchange'],
    ])
    expect(result.operationSummary.wrt).toMatchObject({ points: 3, mults: 3, total: 9 })
  })
  it('resumes serialized scores and keeps live duplicate checks from changing the tally', async () => {
    const { scoring } = createContestHooks(config, manifest)
    const result = await scoring.scoreQsos({ operation, qsos: [contact()] }, ctx)
    const checkpoint = JSON.parse(JSON.stringify(result.scoresheet))
    expect(
      await scoring.scoreQso?.({ operation, qso: contact(), resumeFrom: checkpoint }, ctx),
    ).toMatchObject({ dupe: true })
    const resumed = await scoring.scoreQsos(
      { operation, qsos: [contact('K1ABC', '40m')], resumeFrom: checkpoint },
      ctx,
    )
    expect(resumed.operationSummary.wrt).toMatchObject({ points: 2, mults: 1, total: 2 })
    expect(result.operationSummary.wrt?.points).toBe(1)
  })
})
