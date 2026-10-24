// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it } from 'vitest'
import { createAuditStore } from '../src/audit-store.ts'
import { createAwardExports } from '../src/award-exports.ts'
import { AWARD_IDS, analyzeAwards } from '../src/awards.ts'
import type { Qson, Roster } from '../src/model.ts'
import { DEFAULTS } from '../src/preferences.ts'

const roster: Roster = {
  source: 'test',
  revision: 'one',
  downloadedAt: 0,
  members: [
    {
      number: '1',
      call: 'N1ME',
      name: 'Me',
      spc: 'MA',
      qth: '',
      suffix: '',
      status: 'A',
      oldCalls: [],
      joinDate: '2006-01-01',
    },
    {
      number: '2',
      call: 'K2YOU',
      name: 'You',
      spc: 'NY',
      qth: '',
      suffix: '',
      status: 'A',
      oldCalls: [],
      joinDate: '2006-01-01',
    },
  ],
}
const qso: Qson = {
  uuid: 'qso',
  startAtMillis: Date.parse('2026-10-20T12:00:00Z'),
  band: '40m',
  mode: 'CW',
  our: { call: 'N1ME', skcc: { number: '1', name: 'Me', qualified: true } },
  their: { call: 'K2YOU' },
  refs: [{ type: 'skcc', number: '2', name: 'You', qualified: true, spc: 'NY' }],
}
const ctx = { online: false }
function setup() {
  let number = '1'
  const preferences = {
    get: () => ({ ...DEFAULTS, myNumber: number, month: '2026-10' }),
    load: async () => {},
    set: async () => {},
  }
  const stored: Qson = {}
  const storage = {
    getSettings: async () => stored,
    setSettings: async (values: Qson) => {
      stored.extensions = { 'extension_n1rwj-skcc': values }
    },
  }
  const audit = createAuditStore(storage)
  const exports = createAwardExports(() => roster, preferences, audit)
  return {
    preferences,
    stored,
    audit,
    exports,
    storage,
    select: (value: string) => {
      number = value
    },
  }
}

describe('SKCC award export scopes', () => {
  it('offers per-award CSV and text exclusions for the operation without claiming lifetime history', async () => {
    const { exports } = setup()
    const options = await exports.suggestExportOptions?.({ operation: {}, qsos: [qso] }, ctx)
    expect(options?.every((option) => option.exportKey?.startsWith('operation'))).toBe(true)
    for (const award of AWARD_IDS) {
      expect(options).toContainEqual(
        expect.objectContaining({ exportType: 'skcc-award-csv', exportKey: `operation:${award}` }),
      )
      expect(options).toContainEqual(
        expect.objectContaining({ exportType: 'skcc-award-text', exportKey: `operation:${award}` }),
      )
    }
    const result = await exports.generateExport(
      { exportType: 'skcc-award-summary', exportKey: 'operation', operation: {}, qsos: [qso] },
      ctx,
    )
    expect(result.content).toContain('selected contacts')
    expect(result.content).not.toContain('supplied complete-history file')
  })
  it('exports the loaded complete-history analysis instead of the current operation', async () => {
    const { audit, exports } = setup()
    await audit.save(
      analyzeAwards([qso], roster, { scope: 'complete-history', myNumber: '1', month: '2026-10' }),
      '1',
      'all.adi',
    )
    const options = await exports.suggestExportOptions?.({ operation: {}, qsos: [] }, ctx)
    expect(options).toContainEqual(
      expect.objectContaining({ exportKey: 'import:C', exportType: 'skcc-award-text' }),
    )
    const result = await exports.generateExport(
      { exportType: 'skcc-award-csv', exportKey: 'import:C', operation: {}, qsos: [] },
      ctx,
    )
    expect(result.filename).toBe('SKCC-import-C.csv')
    expect(result.content).toContain('K2YOU')
    expect(result.content).toContain('complete-history')
    const operation = await exports.generateExport(
      { exportType: 'skcc-award-csv', exportKey: 'operation:C', operation: {}, qsos: [] },
      ctx,
    )
    expect(operation.content).not.toContain('K2YOU')
  })
  it('keeps rejected contacts in the text and audit exports and only selected contacts in worksheets', async () => {
    const { exports } = setup()
    const qsos = [
      qso,
      { ...qso, uuid: 'bad', startAtMillis: Date.parse('2026-10-21T12:00:00Z'), mode: 'SSB' },
    ]
    const review = await exports.generateExport(
      { exportType: 'skcc-award-text', exportKey: 'operation:C', operation: {}, qsos },
      ctx,
    )
    expect(review.content).toContain('bad: Contact is not recorded as CW')
    const audit = await exports.generateExport(
      { exportType: 'skcc-award-audit', exportKey: 'operation', operation: {}, qsos },
      ctx,
    )
    expect(audit.content).toContain('Excluded')
    expect(audit.content).toContain('Selected')
    const worksheet = await exports.generateExport(
      { exportType: 'skcc-award-csv', exportKey: 'operation:C', operation: {}, qsos },
      ctx,
    )
    expect(worksheet.content.split('\r\n')).toHaveLength(2)
  })
  it('requires reanalysis after reload because persisted summary is not the full application log', async () => {
    const { audit, preferences, storage } = setup()
    await audit.save(
      analyzeAwards([qso], roster, { scope: 'complete-history', myNumber: '1', month: '2026-10' }),
      '1',
      'all.adi',
    )
    const reloaded = createAuditStore(storage)
    await reloaded.load()
    expect(reloaded.get()).toBeDefined()
    const exports = createAwardExports(() => roster, preferences, reloaded)
    expect(
      (await exports.suggestExportOptions?.({ operation: {}, qsos: [] }, ctx))?.some((option) =>
        option.exportKey?.startsWith('import'),
      ),
    ).toBe(false)
    await expect(
      exports.generateExport(
        { exportType: 'skcc-award-csv', exportKey: 'import:C', operation: {}, qsos: [] },
        ctx,
      ),
    ).rejects.toThrow('Reanalyze')
  })
  it('rejects a snapshot belonging to another selected member and malformed export selections', async () => {
    const { audit, exports, select } = setup()
    await audit.save(
      analyzeAwards([qso], roster, { scope: 'complete-history', myNumber: '1', month: '2026-10' }),
      '1',
      'all.adi',
    )
    select('2')
    await expect(
      exports.generateExport(
        { exportType: 'skcc-award-csv', exportKey: 'import:C', operation: {}, qsos: [] },
        ctx,
      ),
    ).rejects.toThrow('this operator')
    await expect(
      exports.generateExport(
        { exportType: 'skcc-award-csv', exportKey: 'operation:INVALID', operation: {}, qsos: [] },
        ctx,
      ),
    ).rejects.toThrow('Select an SKCC award')
    await expect(
      exports.generateExport(
        { exportType: 'skcc-award-csv', exportKey: 'other:C', operation: {}, qsos: [] },
        ctx,
      ),
    ).rejects.toThrow('Unknown SKCC report source')
    await expect(
      exports.generateExport({ exportType: 'adif', operation: {}, qsos: [] }, ctx),
    ).rejects.toThrow('Unsupported')
  })
})
