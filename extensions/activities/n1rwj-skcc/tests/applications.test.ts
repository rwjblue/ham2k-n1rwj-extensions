// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it } from 'vitest'
import {
  analyzeAdif,
  applicationCsv,
  applicationText,
  auditCsv,
  parseAdif,
  qsosFromAdif,
  reportMarkdown,
} from '../src/applications.ts'
import { analyzeAwards } from '../src/awards.ts'
import type { Roster } from '../src/model.ts'

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
function record(fields: Record<string, string> = {}): string {
  const base = {
    QSO_DATE: '20261020',
    TIME_ON: '120000',
    TIME_OFF: '130000',
    CALL: 'K2YOU',
    STATION_CALLSIGN: 'N1ME',
    MODE: 'CW',
    BAND: '40m',
    SKCC: '23456T',
    NAME: 'You',
    STATE: 'NY',
    DXCC: '291',
    RST_SENT: '579',
    RST_RCVD: '569',
    ...fields,
  }
  return `${Object.entries(base)
    .map(([key, value]) => `<${key}:${value.length}>${value}`)
    .join('')}<EOR>`
}
const evidence = {
  APP_N1RWJ_SKCC_QUALIFIED: 'Y',
  APP_N1RWJ_SKCC_MY_NUMBER: '1C',
  APP_N1RWJ_SKCC_MY_NAME: 'Me',
  APP_N1RWJ_SKCC_MY_SPC: 'MA',
  APP_N1RWJ_SKCC_MY_QUALIFIED: 'Y',
  APP_N1RWJ_SKCC_MY_KEY: 'SK',
  APP_N1RWJ_SKCC_MY_KEY_DECLARED: 'Y',
}

describe('SKCC ADIF audit parser', () => {
  it('honors field lengths, mixed case, header data and embedded delimiters', () => {
    const input = `<programid:4>TEST<eoh>${record({ NAME: 'A<EOR>B' }).toLowerCase()}`
    const parsed = parseAdif(input)
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0]?.NAME).toBe('a<eor>b')
    expect(parsed.records[0]?.PROGRAMID).toBeUndefined()
    expect(parsed.errors).toEqual([])
  })
  it('rejects truncated, conflicting and unterminated records', () => {
    expect(parseAdif('<CALL:10>ABC').records).toHaveLength(0)
    expect(parseAdif('<CALL:3>AAA<CALL:3>BBB<EOR>').records).toHaveLength(0)
    expect(parseAdif('<CALL:3>AAA').errors).toContain('Unterminated ADIF record was skipped')
  })
  it('validates actual calendar dates rather than accepting Date normalization', () => {
    const result = qsosFromAdif(
      record({ QSO_DATE: '20260230' }) + record({ TIME_ON: '250000' }) + record(evidence),
      roster,
    )
    expect(result.skipped).toBe(2)
    expect(result.qsos).toHaveLength(1)
  })
  it('does not turn a standard SKCC field or QSL status into key-policy or award approval', () => {
    const report = analyzeAdif(record({ LOTW_QSL_RCVD: 'Y', CREDIT_GRANTED: 'SKCC:LOTW' }), roster)
    expect(report.awards.C.total).toBe(0)
    expect(report.rows[0]?.issues.join(' ')).toContain('Approved keying')
  })
  it('roundtrips explicit eligibility and uses custom clears ahead of standard fields', () => {
    const report = analyzeAdif(record(evidence), roster, { myNumber: '1', month: '2026-10' })
    expect(report.awards.C.total).toBe(1)
    expect(report.awards.TKA.total).toBe(1)
    expect(report.awards.RC.total).toBe(60)
    const cleared = analyzeAdif(
      record({ ...evidence, APP_N1RWJ_SKCC_CLEAR_FIELDS: 'NUMBER' }),
      roster,
    )
    expect(cleared.awards.C.total).toBe(0)
  })
  it('requires explicit import attestation for old logs and never overrides a recorded refusal', () => {
    const opts = { myNumber: '1', attestImportedEligibility: true }
    expect(analyzeAdif(record(), roster, opts).awards.C.total).toBe(1)
    expect(
      analyzeAdif(record({ APP_N1RWJ_SKCC_QUALIFIED: 'N' }), roster, opts).awards.C.total,
    ).toBe(0)
    expect(analyzeAdif(record({ MODE: 'FT8' }), roster, opts).awards.C.total).toBe(0)
    expect(analyzeAdif(record(), roster, opts).limitations[0]).toContain(
      'operator explicitly attested',
    )
  })
  it('handles overnight durations and derives a band only from recorded frequency', () => {
    const { qsos } = qsosFromAdif(
      record({ ...evidence, TIME_ON: '233000', TIME_OFF: '003000', BAND: '', FREQ: '7.055' }),
      roster,
    )
    expect(qsos[0]?.band).toBe('40m')
    expect(Number(qsos[0]?.endAtMillis) - Number(qsos[0]?.startAtMillis)).toBe(3600000)
  })
  it('produces inspectable review exports with safe CSV cells and scope', () => {
    const report = analyzeAdif(record({ ...evidence, NAME: '=2+2' }), roster, { month: '2026-10' })
    expect(applicationCsv(report, 'C')).toContain("'=2+2")
    expect(applicationCsv(report, 'C')).toContain('complete-history')
    expect(applicationText(report, 'C')).toContain('not sponsor approval')
    expect(reportMarkdown(report)).toContain('supplied complete-history file')
    expect(auditCsv(report)).toContain('Selected')
  })
  it('exports invalid timestamp exclusions without throwing a Date range error', () => {
    const report = analyzeAwards(
      [{ uuid: 'invalid-date', startAtMillis: 1e30, mode: 'CW', band: '40m' }],
      roster,
    )
    expect(auditCsv(report)).toContain('Missing or invalid QSO date')
    expect(report.rows[0]?.at).toBe(0)
  })
})
