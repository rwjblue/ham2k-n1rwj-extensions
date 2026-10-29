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

describe('NS activity', () => {
  it('offers named/scoped sessions and shows the sent QTH, power limit and operating guidance', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T01:00:00Z'))
    const { activity, refHandler } = createContestHooks(config, manifest)
    expect(await activity.suggest({ operation: {} }, ctx)).toMatchObject([
      { type: 'ns', ref: '2026-10-30-0230', label: 'NS 0230z' },
    ])
    for (const searchTerm of ['NS', 'NCCC', 'NCCC SPRINT', 'NS LADDER', 'SPRINTNS'])
      expect(await activity.suggest({ operation: {}, searchTerm }, ctx)).toHaveLength(4)
    expect(await activity.suggest({ operation: {}, searchTerm: 'ZOMBIE' }, ctx)).toEqual([])
    expect(
      await activity.suggest({ operation: {}, scoped: true, searchTerm: '2026-10-30-0230' }, ctx),
    ).toHaveLength(1)
    const setup = (await activity.operationControls({ operation }, ctx))[0]?.input
    if (setup?.kind !== 'form') throw new Error('Missing setup form')
    expect(
      setup.form.elements.find((e) => e.type === 'field' && e.key === 'ourLocation'),
    ).toMatchObject({ placeholder: 'RI, ON, KP4 or DX' })
    expect(setup.form.elements.find((e) => e.type === 'field' && e.key === 'power')).toMatchObject({
      options: [{ value: 'QRP' }, { value: 'LP' }],
    })
    expect(JSON.stringify(setup.form)).toContain('1 kHz QSY')
    expect(JSON.stringify(setup.form)).toContain('Skimmer and packet assistance are prohibited')
    expect(
      await refHandler.decorateRef(
        { ref: { type: 'ns', ref: '2026-10-30-0230', ourName: 'ROB', ourLocation: 'RI' } },
        ctx,
      ),
    ).toMatchObject({ name: '2026-10-30 0230z · ROB RI' })
    expect(
      await refHandler.suggestOperationTitle(
        {
          operation,
          ref: { type: 'ns', ref: '2026-10-30-0230', ourName: 'ROB', ourLocation: 'RI' },
        },
        ctx,
      ),
    ).toEqual({ for: 'NS 0230z', subtitle: 'ROB RI' })
  })
  it('uses native serial allocation and never suggests a received serial from history', async () => {
    const { activity, scoring } = createContestHooks(config, manifest)
    await scoring.scoreQsos({ operation, qsos: [contact('KL7ABC', '20m', 'AK', '999')] }, ctx)
    const controls = await activity.loggingControls(
      { operation, qso: { their: { call: 'KL7ABC' } } },
      ctx,
    )
    expect(controls.map(({ label }) => label)).toEqual([
      'Sent #',
      'Received #',
      'Name',
      'State / province / country / DX',
    ])
    expect(controls.map(({ input }) => input)).toMatchObject([
      { kind: 'serial', field: 'ourSerial', sequence: { key: 'ns-serial', start: 1 } },
      { kind: 'text', field: 'theirSerial', numeric: true },
      { field: 'name', suggestedValue: 'BOB' },
      { field: 'location', suggestedValue: 'AK' },
    ])
    expect(controls[1]?.input).not.toHaveProperty('suggestedValue')
    expect(await activity.loggingControls({ operation: {}, qso: contact() }, ctx)).toEqual([])
  })
  it('projects entered exchanges and deliberate clearing without substituting lookup hints', async () => {
    const { activity } = createContestHooks(config, manifest)
    for (const [name, theirSerial, qth, expected] of [
      ['ANN', '23', 'HI', '23 ANN HI'],
      ['', '', '', ''],
    ]) {
      const qso: Qson = {
        ...contact(),
        their: { call: 'K1ABC', name: 'WRONG', state: 'MA' },
        refs: [
          {
            type: 'ns',
            ourSerial: '8',
            name: name ?? '',
            theirSerial: theirSerial ?? '',
            location: qth ?? '',
          },
        ],
      }
      expect(await activity.processQsoBeforeSave({ operation, qso }, ctx)).toEqual({
        our: { exchange: '8' },
        their: { exchange: expected },
      })
    }
    const locationOnly: Qson = { ...contact(), refs: [{ type: 'ns', location: 'RI' }] }
    expect(await activity.processQsoBeforeSave({ operation, qso: locationOnly }, ctx)).toEqual({
      our: { exchange: '' },
      their: { exchange: 'RI' },
    })
    expect(await activity.processQsoBeforeSave({ operation: {}, qso: contact() }, ctx)).toBeNull()
  })
  it('keeps current NS hints ahead of older history and bounds full-log reads across keystrokes', async () => {
    const { activity, scoring } = createContestHooks(config, manifest)
    const current = contact('K1ABC', '20m', 'RI')
    await scoring.scoreQsos({ operation, qsos: [current] }, ctx)
    const getQsos = vi.fn(async () => [current])
    const getHistoryForCall = vi.fn(async () => [
      { ...contact('K1ABC', '20m', 'MA'), uuid: 'older-contact' },
    ])
    for (let i = 0; i < 3; i++) {
      const controls = await activity.loggingControls(
        { operation, qso: { their: { call: 'K1ABC' } } },
        { ...ctx, getQsos, getHistoryForCall },
      )
      expect(controls[3]?.input).toMatchObject({ suggestedValue: 'RI' })
      expect(controls[1]?.input).not.toHaveProperty('suggestedValue')
    }
    expect(getQsos.mock.calls.length).toBeLessThanOrEqual(1)
    expect(getHistoryForCall).toHaveBeenCalledWith('K1ABC', { refType: 'ns' })
  })
  it('does not carry another contest or base-call location into a portable station', async () => {
    const { activity } = createContestHooks(config, manifest)
    const getHistoryForCall = vi.fn(async () => [
      { ...contact(), refs: [{ type: 'sst', name: 'WRONG', location: 'DX' }] },
      contact('K1ABC', '20m', 'MA'),
    ])
    const controls = await activity.loggingControls(
      { operation, qso: { their: { call: 'K1ABC/P', state: 'RI' } } },
      { ...ctx, getHistoryForCall },
    )
    expect(controls[2]?.input).toMatchObject({ suggestedValue: 'BOB' })
    expect(controls[3]?.input).toMatchObject({ suggestedValue: 'RI' })
    const wiped = await activity.loggingControls({ operation, qso: { their: { call: '' } } }, ctx)
    expect(wiped[2]?.input).toMatchObject({ suggestedValue: ' ' })
    expect(wiped[3]?.input).toMatchObject({ suggestedValue: ' ' })
  })
})
