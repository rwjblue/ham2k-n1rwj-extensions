import type { OperationSegmentPayload } from '@ham2k/extension-sdk'
import { hooks } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from '../manifest.json'
import { createExports } from '../src/exports.ts'
import type { Qson } from '../src/model.ts'
import { createScoringHook, scoreLog, scoreTotal } from '../src/scorer.ts'

const ctx = { online: false }
const operation: Qson = {
  uuid: 'zombie-operation',
  stationCall: 'N1RWJ',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      ourSpc: 'RI',
      ourZombieNumber: '00123',
      ourZombieName: 'COUNT ROB',
      utcOffset: '-04:00',
    },
  ],
}
function contact(call = 'K1ABC', band = '20m', number = '0007', at = '2026-10-30T19:30:00Z'): Qson {
  return {
    uuid: `${call}-${band}-${at}`,
    their: { call, sent: '579' },
    our: { call: 'N1RWJ', sent: '559' },
    mode: 'CW',
    band,
    freq: 14060,
    startAtMillis: Date.parse(at),
    refs: [
      {
        type: 'zombie',
        theirSpc: 'MA',
        theirZombieNumber: number,
        theirZombieName: 'DEAD MAN FRED',
        ourSpc: 'RI',
        ourZombieNumber: '00123',
        ourZombieName: 'COUNT ROB',
      },
    ],
  }
}

afterEach(() => vi.restoreAllMocks())

describe('Zombie Shuffle exports', () => {
  it('offers ADIF and a text score summary, without inventing a Cabrillo format', async () => {
    const { exports } = createExports(manifest)
    const options = await exports.suggestExportOptions({ operation, qsos: [contact()] }, ctx)
    expect(
      options.map(({ exportType, format, refType }) => ({ exportType, format, refType })),
    ).toEqual([
      { exportType: 'zombie-adif', format: 'adif', refType: 'zombie' },
      { exportType: 'zombie-text', format: 'text', refType: 'zombie' },
    ])
    expect(options.map(({ filename }) => filename)).toMatchObject([
      expect.stringContaining('Zombie-Shuffle-2026'),
      expect.stringContaining('Zombie-Shuffle-2026'),
    ])
    expect(await exports.suggestExportOptions({ operation: {}, qsos: [] }, ctx)).toEqual([])
    expect(
      await exports.generateExport({ operation, qsos: [], exportType: 'cabrillo' }, ctx),
    ).toEqual({ filename: '', mimeType: '', content: '' })
  })

  it('exports full string exchanges and leaves native RST to the standard ADIF writer', async () => {
    const { adifFields } = createExports(manifest)
    expect(await adifFields.fieldsForOneQSO({ operation, qso: contact() }, ctx)).toEqual([
      { name: 'CONTEST_ID', value: 'ZOMBIE' },
      { name: 'STX_STRING', value: 'RI 00123 COUNT ROB' },
      { name: 'SRX_STRING', value: 'MA 0007 DEAD MAN FRED' },
    ])
    expect(await adifFields.fieldsForOneQSO({ operation: {}, qso: contact() }, ctx)).toEqual([])
    const cleared = contact()
    cleared.refs = [
      {
        type: 'zombie',
        ourSpc: '',
        ourZombieNumber: '',
        ourZombieName: '',
        theirSpc: '',
        theirZombieNumber: '',
        theirZombieName: '',
      },
    ]
    expect(await adifFields.fieldsForOneQSO({ operation, qso: cleared }, ctx)).toEqual([
      { name: 'CONTEST_ID', value: 'ZOMBIE' },
    ])
  })

  it('delegates ADIF with the native reports, snapshot exchanges and user export settings', async () => {
    const invoke = vi
      .spyOn(hooks, 'invokeOne')
      .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<eoh>\n<eor>' } }])
    const { exports } = createExports(manifest)
    const result = await exports.generateExport(
      {
        operation,
        qsos: [contact()],
        exportType: 'zombie-adif',
        includePrivateData: false,
        includeLookupData: false,
        compactFilenames: true,
      },
      ctx,
    )
    expect(result.content).toBe('<eoh>\n<eor>')
    expect(invoke).toHaveBeenCalledWith(
      'export',
      'adif',
      'generateExport',
      expect.objectContaining({
        mainHandler: 'n1rwj-zombie',
        includePrivateData: false,
        includeLookupData: false,
        qsos: [
          expect.objectContaining({
            their: { call: 'K1ABC', sent: '579' },
            our: { call: 'N1RWJ', sent: '559' },
          }),
        ],
      }),
    )
  })

  it('produces a sponsor-style summary from exactly the scorer calculation, including shared high-band groups', async () => {
    const qsos = [
      contact(),
      contact('K1ABC', '20m', '0007', '2026-10-30T20:30:00Z'),
      contact('K1ABC', '20m', '0007', '2026-10-30T21:30:00Z'),
      contact('K2ABC', '15m', '4321'),
      contact('K2ABC', '10m', '4321'),
      contact('K3ABC', '40m', '0100'),
    ]
    const { exports } = createExports(manifest)
    const result = await exports.generateExport({ operation, qsos, exportType: 'zombie-text' }, ctx)
    const { scoresheet } = scoreLog(operation, qsos)
    expect(result.content).toContain('Callsign: N1RWJ')
    expect(result.content).toContain('Zombie number sent: 00123')
    expect(result.content).toContain('COUNT ROB')
    expect(result.content).toContain('10m/15m')
    expect(result.content.replace(/,/g, '')).toContain(String(scoreTotal(scoresheet)))
    expect(result.content).toContain('Review this summary')
    expect(result.content).not.toContain('November 15, 2025')
    expect(result.filename).toMatch(/\.txt$/)
  })

  it('matches native scoring when the activity is disabled and later reactivated in operation segments', async () => {
    const qsos = [
      contact('K1ABC', '20m', '0007', '2026-10-30T19:30:00Z'),
      contact('K2ABC', '20m', '0100', '2026-10-30T20:30:00Z'),
      contact('K3ABC', '20m', '0007', '2026-10-30T21:30:00Z'),
    ]
    const segments: OperationSegmentPayload[] = [
      { fromMillis: 0, operation },
      { fromMillis: Date.parse('2026-10-30T20:00:00Z'), operation: { ...operation, refs: [] } },
      { fromMillis: Date.parse('2026-10-30T21:00:00Z'), operation },
    ]
    const native = await createScoringHook().scoreQsos({ operation, qsos, segments }, ctx)
    const { exports } = createExports(manifest)
    const summary = await exports.generateExport(
      { operation, qsos, segments, exportType: 'zombie-text' },
      ctx,
    )
    expect(native.operationSummary.zombie).toMatchObject({ qsos: 2, total: 694 })
    expect(summary.content).toContain('Total QSOs: 2')
    expect(summary.content).toContain(`Total score: ${native.operationSummary.zombie?.total}`)
    expect(summary.content).toContain('Excluded / unscored contacts: 1')
  })
})
