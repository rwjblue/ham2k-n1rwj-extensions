import { hooks } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import type { Qson } from '../../../../packages/mini-contest/src/model.ts'
import manifest from '../manifest.json'
import { config } from '../src/config.ts'
import { contact, ctx, operation } from './fixtures.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('WRT activity and history', () => {
  it('offers WRT sessions and exposes only low power and QRP setup', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T23:00:00Z'))
    const { activity, refHandler } = createContestHooks(config, manifest)
    expect(await activity.suggest({ operation: {} }, ctx)).toMatchObject([
      { type: 'wrt', ref: '2026-10-02-0145', label: 'WRT 0145z' },
    ])
    expect(await activity.suggest({ operation: {}, searchTerm: 'WRT' }, ctx)).toHaveLength(4)
    expect(
      await refHandler.validateRef({ ref: { type: 'wrt', ref: '2026-10-02-0145' } }, ctx),
    ).toMatchObject({ valid: true })
    const setup = (await activity.operationControls({ operation }, ctx))[0]?.input
    expect(setup?.kind).toBe('form')
    if (setup?.kind !== 'form') throw new Error('Expected setup form')
    expect(setup.form.elements.find((e) => e.type === 'field' && e.key === 'power')).toMatchObject({
      options: [{ value: 'QRP' }, { value: 'LP' }],
    })
    expect(
      setup.form.elements.find((e) => e.type === 'field' && e.key === 'ourLocation'),
    ).toMatchObject({ placeholder: 'RI, ON or DL' })
  })
  it('projects edits and deliberate clearing rather than substituting suggestions', async () => {
    const { activity } = createContestHooks(config, manifest)
    for (const [name, location, exchange] of [
      ['ANN', 'EA8', 'ANN EA8'],
      ['', '', ''],
    ]) {
      const qso: Qson = {
        ...contact('DL1ABC'),
        their: { call: 'DL1ABC', name: 'BOB', entityPrefix: 'DL' },
        refs: [{ type: 'wrt', name: name ?? '', location: location ?? '' }],
      }
      expect(await activity.processQsoBeforeSave({ operation, qso }, ctx)).toEqual({
        their: { exchange },
      })
      const controls = await activity.loggingControls({ operation, qso }, ctx)
      expect(controls.map(({ input }) => input)).toMatchObject([
        { field: 'name', suggestedValue: 'BOB' },
        { field: 'location', suggestedValue: 'DL' },
      ])
    }
    expect(await activity.loggingControls({ operation: {}, qso: contact() }, ctx)).toEqual([])
  })
  it('uses current WRT exchanges before older WRT history without per-keystroke full-log reads', async () => {
    const { activity, scoring } = createContestHooks(config, manifest)
    const current = contact('DL1ABC', '20m', 'EA8')
    await scoring.scoreQsos({ operation, qsos: [current] }, ctx)
    const getQsos = vi.fn(async () => [current])
    const getHistoryForCall = vi.fn(async () => [
      { ...contact('DL1ABC', '20m', 'DL'), uuid: 'older-operation-qso' },
    ])
    for (let i = 0; i < 3; i++) {
      const controls = await activity.loggingControls(
        { operation, qso: { their: { call: 'DL1ABC' } } },
        { ...ctx, getQsos, getHistoryForCall },
      )
      expect(controls[1]?.input).toMatchObject({ suggestedValue: 'EA8' })
    }
    expect(getQsos.mock.calls.length).toBeLessThanOrEqual(1)
    expect(getHistoryForCall).toHaveBeenCalledWith('DL1ABC', { refType: 'wrt' })
  })
  it('rejects unrelated history and base-call locations for portable stations', async () => {
    const { activity } = createContestHooks(config, manifest)
    const getHistoryForCall = vi.fn(async () => [
      { ...contact('DL1ABC'), refs: [{ type: 'sst', name: 'WRONG', location: 'DX' }] },
      contact('DL1ABC', '20m', 'EA8'),
    ])
    const controls = await activity.loggingControls(
      { operation, qso: { their: { call: 'DL1ABC/P', entityPrefix: 'DL' } } },
      { ...ctx, getHistoryForCall },
    )
    expect(controls.map(({ input }) => input)).toMatchObject([
      { suggestedValue: 'BOB' },
      { suggestedValue: 'DL' },
    ])
    const cleared = await activity.loggingControls({ operation, qso: { their: { call: '' } } }, ctx)
    expect(cleared.map(({ input }) => input)).toMatchObject([
      { suggestedValue: ' ' },
      { suggestedValue: ' ' },
    ])
  })
})
describe('WRT exports', () => {
  it('preserves state/prefix exchanges and emits RY only for RTTY contacts without RST', async () => {
    const { exports, adifFields } = createContestHooks(config, manifest)
    const qso = contact('DL1ABC', '20m', 'DL', 'RTTY-USB')
    const result = await exports.generateExport(
      {
        operation,
        exportType: 'cabrillo',
        qsos: [
          qso,
          contact('K1ABC', '20m', 'MA', 'FT8'),
          { ...qso, deleted: true },
          { band: 'event' },
        ],
      },
      ctx,
    )
    expect(result.content).toContain('CONTEST: WRT\n')
    expect(result.content).toContain('CATEGORY-MODE: RTTY\n')
    expect(result.content).toContain('CATEGORY-POWER: LOW\n')
    expect(result.content).toContain('QSO: 14085 RY 2026-10-02 0150 N1RWJ ROB RI DL1ABC BOB DL\n')
    expect(result.content.match(/^QSO:/gm)).toHaveLength(1)
    expect(result.content).not.toContain('599')
    expect(result.filename).toContain('WRT-2026-10-02-0145')
    expect(await adifFields.fieldsForOneQSO({ operation, qso }, ctx)).toEqual([
      { name: 'CONTEST_ID', value: 'WRT' },
      { name: 'STX_STRING', value: 'ROB RI' },
      { name: 'SRX_STRING', value: 'BOB DL' },
      { name: 'MODE', value: 'RTTY' },
    ])
    expect(
      await adifFields.fieldsForOneQSO(
        { operation, qso: contact('K1ABC', '20m', 'MA', 'FT8') },
        ctx,
      ),
    ).not.toContainEqual({ name: 'MODE', value: 'RTTY' })
  })
  it('retains cleared exchange columns and exports off-session contacts for review', async () => {
    const { exports } = createContestHooks(config, manifest)
    const qso: Qson = {
      ...contact(),
      startAtMillis: Date.parse('2026-10-02T02:30:00Z'),
      refs: [{ type: 'wrt', name: '', location: '' }],
    }
    const result = await exports.generateExport(
      { operation, exportType: 'cabrillo', qsos: [qso] },
      ctx,
    )
    expect(result.content).toContain('QSO: 14085 RY 2026-10-02 0230 N1RWJ ROB RI K1ABC - -\n')
  })
  it('delegates ADIF with the WRT handler and respects export options', async () => {
    const invoke = vi
      .spyOn(hooks, 'invokeOne')
      .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<eoh>\n<eor>' } }])
    const { exports } = createContestHooks(config, manifest)
    const options = await exports.suggestExportOptions({ operation, qsos: [contact()] }, ctx)
    expect(options.map(({ refType }) => refType)).toEqual(['wrt', 'wrt'])
    const result = await exports.generateExport(
      {
        operation,
        qsos: [contact()],
        exportType: 'contest-adif',
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
        mainHandler: 'n1rwj-wrt',
        includePrivateData: false,
        includeLookupData: false,
      }),
    )
  })
})
