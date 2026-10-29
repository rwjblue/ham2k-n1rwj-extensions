import { hooks } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import manifest from '../manifest.json'
import { config } from '../src/config.ts'
import { contact, ctx, operation } from './fixtures.ts'

afterEach(() => vi.restoreAllMocks())
describe('NS exports', () => {
  it('exports serial/name/QTH on both sides in Sprint Cabrillo order, without signal reports', async () => {
    const { exports } = createContestHooks(config, manifest)
    const qso = contact('VE3ABC', '20m', 'ON', '0042')
    const result = await exports.generateExport(
      {
        operation,
        exportType: 'ns-cabrillo',
        qsos: [qso, { ...qso, deleted: true }, { band: 'event' }],
      },
      ctx,
    )
    expect(result.content).toContain('CONTEST: NCCC-SPRINT\n')
    expect(result.content).toContain('CATEGORY-MODE: CW\n')
    expect(result.content).toContain('CATEGORY-POWER: LOW\n')
    expect(result.content).toContain(
      'QSO: 14042 CW 2026-10-30 0240 N1RWJ 7 ROB RI VE3ABC 0042 BOB ON\n',
    )
    expect(result.content.match(/^QSO:/gm)).toHaveLength(1)
    expect(result.content).not.toContain('599')
    expect(result.filename).toContain('NS-2026-10-30-0230')
  })
  it('preserves cleared columns and keeps excluded contacts available for log review', async () => {
    const { exports } = createContestHooks(config, manifest)
    const qso = {
      ...contact(),
      startAtMillis: Date.parse('2026-10-30T03:01:00Z'),
      refs: [{ type: 'ns', ourSerial: '', theirSerial: '', name: '', location: '' }],
    }
    const result = await exports.generateExport(
      { operation, exportType: 'cabrillo', qsos: [qso] },
      ctx,
    )
    expect(result.content).toContain('QSO: 14042 CW 2026-10-30 0301 N1RWJ - ROB RI K1ABC - - -\n')
  })
  it('exports numeric ADIF serials plus complete exchange strings', async () => {
    const { adifFields } = createContestHooks(config, manifest)
    expect(
      await adifFields.fieldsForOneQSO(
        { operation, qso: contact('VE3ABC', '20m', 'ON', '0042') },
        ctx,
      ),
    ).toEqual([
      { name: 'CONTEST_ID', value: 'NCCC-SPRINT' },
      { name: 'STX_STRING', value: '7 ROB RI' },
      { name: 'SRX_STRING', value: '0042 BOB ON' },
      { name: 'STX', value: '7' },
      { name: 'SRX', value: '42' },
    ])
    const fields = await adifFields.fieldsForOneQSO(
      {
        operation,
        qso: {
          ...contact(),
          refs: [{ type: 'ns', name: '', location: '', theirSerial: '', ourSerial: '' }],
        },
      },
      ctx,
    )
    expect(fields).toEqual([
      { name: 'CONTEST_ID', value: 'NCCC-SPRINT' },
      { name: 'STX_STRING', value: 'ROB RI' },
    ])
    expect(await adifFields.fieldsForOneQSO({ operation: {}, qso: contact() }, ctx)).toEqual([])
  })
  it('delegates full ADIF generation with the NS handler and preserves export preferences', async () => {
    const invoke = vi
      .spyOn(hooks, 'invokeOne')
      .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<eoh>\n<eor>' } }])
    const { exports } = createContestHooks(config, manifest)
    expect(
      (await exports.suggestExportOptions({ operation, qsos: [contact()] }, ctx)).map(
        ({ exportType, refType }) => ({ exportType, refType }),
      ),
    ).toEqual([
      { exportType: 'ns-adif', refType: 'ns' },
      { exportType: 'ns-cabrillo', refType: 'ns' },
    ])
    const result = await exports.generateExport(
      {
        operation,
        qsos: [contact()],
        exportType: 'ns-adif',
        includePrivateData: false,
        includeLookupData: false,
      },
      ctx,
    )
    expect(result.content).toBe('<eoh>\n<eor>')
    expect(invoke).toHaveBeenCalledWith(
      'export',
      'adif',
      'generateExport',
      expect.objectContaining({
        mainHandler: 'n1rwj-ns',
        includePrivateData: false,
        includeLookupData: false,
      }),
    )
  })
})
