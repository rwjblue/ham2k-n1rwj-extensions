import { describe, expect, it } from 'vitest'
import { getExchange, ownExchange } from '../src/exchange.ts'
import {
  eventScoreReports,
  exchangeFromAdif,
  ownFromAdif,
  SKCCAdifFields,
  SKCCAdifImport,
  scoreReport,
  worksheetCsv,
} from '../src/exports.ts'
import type { Qson } from '../src/model.ts'

describe('SKCC ADIF evidence roundtrip', () => {
  it('recovers standard SKCC and name without fabricating qualification or key type', () => {
    const ref = exchangeFromAdif({ skcc: '00123S', name: 'AL', state: 'MA', dxcc: '291' })
    expect(ref).toMatchObject({ type: 'skcc', ref: '123', number: '00123S', name: 'AL', spc: 'MA' })
    expect(ref).not.toHaveProperty('qualified')
    expect(ref).not.toHaveProperty('key')
    expect(exchangeFromAdif({ name: 'AL', comment: 'SKCC 123S' })).toBeUndefined()
  })
  it('reads standard key/RST/power evidence without treating key type as qualification', () => {
    const fields = {
      skcc: '123',
      morse_key_type: 'BUG',
      my_morse_key_type: 'SK',
      rst_sent: '579',
      rst_rcvd: '589',
      tx_pwr: '5',
      rx_pwr: '4',
      state: 'CA',
      dxcc: '150',
    }
    expect(exchangeFromAdif(fields)).toMatchObject({ key: 'BUG', rst: '589', power: '4' })
    expect(exchangeFromAdif(fields)).not.toHaveProperty('qualified')
    expect(exchangeFromAdif(fields)).not.toHaveProperty('spc')
    expect(ownFromAdif(fields)).toMatchObject({ key: 'SK', rst: '579', power: '5' })
  })
  it('preserves received and own evidence, operator identity, and explicit clearing', async () => {
    const qso: Qson = {
      refs: [
        {
          type: 'skcc',
          ref: '123',
          number: '123S',
          name: 'AL',
          spc: '',
          operatorCall: 'N1ABC',
          qualified: true,
          key: 'BUG',
          event: 'k3y:2026',
          region: '1',
        },
      ],
      our: { skcc: { number: '42T', name: 'ME', key: 'SK', keyDeclared: true, qualified: false } },
    }
    const fields = await SKCCAdifFields.fieldsForOneQSO({ qso, operation: {} }, { online: false })
    const raw = Object.fromEntries(fields.map((field) => [field.name.toLowerCase(), field.value]))
    expect(raw.skcc).toBe('123S')
    expect(raw.app_n1rwj_skcc_clear_fields).toBe('SPC')
    const ref = exchangeFromAdif(raw)
    if (!ref) throw new Error('Exported exchange was not imported')
    const imported = { refs: [ref] }
    expect(getExchange(imported)).toMatchObject({
      number: '123S',
      operatorCall: 'N1ABC',
      qualified: true,
      key: 'BUG',
      spc: '',
      region: '1',
      event: 'k3y:2026',
    })
    expect(ownExchange(imported)).toMatchObject({
      number: '42T',
      keyDeclared: true,
      qualified: false,
    })
    expect(ownFromAdif(raw)).toMatchObject({ key: 'SK' })
  })
  it('keeps positional imports and does not label unrelated ADIF records SKCC', async () => {
    const results = await SKCCAdifImport.refsForRecords(
      { records: [{ fields: { skcc: '123' } }, { fields: { call: 'N1ABC' } }] },
      { online: false },
    )
    expect(results).toHaveLength(2)
    expect(results[0]?.refs?.[0]).toMatchObject({ type: 'skcc', ref: '123' })
    expect(results[1]).toBeNull()
  })
  it('exports an auditable worksheet and labels an unreviewed event score', () => {
    const csv = worksheetCsv(
      [
        {
          band: '20m',
          mode: 'CW',
          their: { call: 'N1ABC' },
          refs: [{ type: 'skcc', number: '123', name: '=1+1' }],
        },
      ],
      {},
    )
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('"unknown"')
    expect(scoreReport([], { refs: [{ type: 'skcc', ref: 'wes:2026-10' }] })).toContain(
      'Final score: NOT REVIEWED',
    )
  })
  it('uses each contact’s segment evidence and the latest review settings within an event', () => {
    const start = Date.parse('2026-10-10T12:00:00Z')
    const setup = {
      type: 'skcc',
      ref: 'wes:2026-10',
      ourNumber: '42T',
      ourName: 'Me',
      ourSpc: 'MA',
      ourKey: 'SK',
    }
    const first = { refs: [{ ...setup, themeMode: '' }] }
    const second = { refs: [{ ...setup, themeMode: 'none' }] }
    const contacts = ['20m', '40m'].map((band, index) => ({
      startAtMillis: start + index * 60000,
      band,
      mode: 'CW',
      our: { sent: '579' },
      their: { call: 'N1ABC', sent: '589' },
      refs: [{ type: 'skcc', number: '123S', name: 'Al', spc: 'MA', key: 'SK' }],
    }))
    const segments = [
      { fromMillis: start, operation: first },
      { fromMillis: start + 60000, operation: second },
    ]
    expect(eventScoreReports(contacts, second, segments)).toContain('Final score: 17')
    const missingFirstKey = [
      { fromMillis: start, operation: { refs: [{ ...setup, ourKey: '' }] } },
      segments[1] as (typeof segments)[number],
    ]
    const report = eventScoreReports(contacts, second, missingFirstKey)
    expect(report).toContain('Qualified contacts: 1')
    expect(report).toContain('Contacts needing evidence: 1')
    expect(report).toContain('Final score: NOT REVIEWED')
  })
})
