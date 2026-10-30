import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from '../manifest.json'
import { createActivity } from '../src/activity.ts'
import { ANNOUNCED_2026_BONUS_CALLS } from '../src/bonus.ts'
import { createExports } from '../src/exports.ts'
import { object, type Qson } from '../src/model.ts'

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
      flexibleHours: false,
    },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Zombie Shuffle activity', () => {
  it('offers the confirmed 2026 event and requires an explicit event-day UTC offset', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
    const { activity, refHandler } = createActivity(manifest)
    expect(await activity.suggest({ operation: {} }, ctx)).toMatchObject([
      { type: 'zombie', ref: '2026', label: 'Zombie Shuffle 2026' },
    ])
    expect(await activity.suggest({ operation: {}, searchTerm: 'SST' }, ctx)).toEqual([])
    expect(await refHandler.validateRef({ ref: { type: 'zombie', ref: '2026' } }, ctx)).toEqual({
      valid: true,
      normalized: '2026',
    })
    expect(
      await refHandler.validateRef({ ref: { type: 'zombie', ref: '2027' } }, ctx),
    ).toMatchObject({
      valid: false,
    })
    const setup = (await activity.operationControls({ operation }, ctx))[0]?.input
    expect(setup?.kind).toBe('form')
    if (setup?.kind !== 'form') throw new Error('Expected setup form')
    const offset = setup.form.elements.find(
      (field) => field.type === 'field' && field.key === 'utcOffset',
    )
    if (offset?.type !== 'field') throw new Error('Missing offset field')
    expect(offset.value).toBeUndefined()
    expect(await offset.validate?.('', {})).toContain('+HH:MM')
    expect(await offset.validate?.('-04:00', {})).toBeNull()
    expect(await offset.validate?.('America/New_York', {})).toContain('+HH:MM')
    expect(setup.form.elements).toContainEqual(
      expect.objectContaining({ key: 'flexibleHours', fieldType: 'checkbox' }),
    )
    expect(setup.form.elements).toContainEqual(
      expect.objectContaining({ key: 'bonusStation', fieldType: 'checkbox' }),
    )

    vi.setSystemTime(new Date('2027-10-19T12:00:00Z'))
    expect(await activity.suggest({ operation: {} }, ctx)).toEqual([])
    expect(await activity.suggest({ operation: {}, scoped: true }, ctx)).toHaveLength(1)
  })

  it('adds exactly three received fields and uses numeric text rather than an allocated serial', async () => {
    const { activity } = createActivity(manifest)
    const controls = await activity.loggingControls({ operation, qso: {} }, ctx)
    expect(controls.map(({ input }) => input)).toEqual([
      expect.objectContaining({ kind: 'text', field: 'theirSpc', suggestedValue: ' ' }),
      expect.objectContaining({
        kind: 'text',
        field: 'theirZombieNumber',
        numeric: true,
        pattern: '[0-9]+',
      }),
      expect.objectContaining({ kind: 'text', field: 'theirZombieName', suggestedValue: ' ' }),
    ])
    expect(controls.map(({ input }) => input)).not.toContainEqual(
      expect.objectContaining({ kind: 'serial' }),
    )
    expect(await activity.loggingControls({ operation: {}, qso: {} }, ctx)).toEqual([])
  })

  it('prefills 4321 for announced bonus calls and unambiguous portable forms while offline', async () => {
    const { activity } = createActivity(manifest)
    const getQsos = vi.fn(async () => [])
    for (const call of [...ANNOUNCED_2026_BONUS_CALLS, ' na5n/qrp ', 'VE3/NB6M']) {
      const controls = await activity.loggingControls(
        { operation, qso: { their: { call, name: 'Directory Name' } } },
        { ...ctx, getQsos },
      )
      expect(controls[1]?.input).toMatchObject({
        kind: 'text',
        field: 'theirZombieNumber',
        suggestedValue: '4321',
      })
      expect(controls[0]?.input).toMatchObject({ suggestedValue: ' ' })
      expect(controls[2]?.input).toMatchObject({ suggestedValue: ' ' })
    }
    expect(getQsos.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('uses the announced bonus number ahead of older personal-number history', async () => {
    const { activity } = createActivity(manifest)
    const controls = await activity.loggingControls(
      { operation, qso: { their: { call: 'NA5N' } } },
      {
        ...ctx,
        getHistoryForCall: async () => [
          {
            uuid: 'old-na5n',
            their: { call: 'NA5N' },
            refs: [
              {
                type: 'zombie',
                ref: '2025',
                theirSpc: 'NM',
                theirZombieNumber: '004',
                theirZombieName: 'PANCHO',
              },
            ],
          },
        ],
      },
    )
    expect(controls.map(({ input }) => input)).toMatchObject([
      { suggestedValue: 'NM' },
      { suggestedValue: '4321' },
      { suggestedValue: 'PANCHO' },
    ])
  })

  it('preserves entered numbers and explicit blanks and keeps an applied bonus prefill stable', async () => {
    const { activity } = createActivity(manifest)
    for (const value of ['0007', '3333', '4321', '', null, 1234]) {
      const qso: Qson = {
        their: { call: 'NA5N' },
        refs: [{ type: 'zombie', theirZombieNumber: value }],
      }
      const original = JSON.stringify(qso)
      for (let refresh = 0; refresh < 2; refresh++) {
        const controls = await activity.loggingControls({ operation, qso }, ctx)
        expect(controls[1]?.input).toMatchObject({
          suggestedValue: value === null || value === '' ? ' ' : String(value),
        })
      }
      expect(JSON.stringify(qso)).toBe(original)
      const patch = await activity.processQsoBeforeSave({ operation, qso }, ctx)
      expect(patch?.their?.exchange).toBe(value === null ? '' : String(value))
    }
  })

  it('withdraws the bonus suggestion for unknown calls and never applies another event’s roster', async () => {
    const { activity } = createActivity(manifest)
    const numberFor = async (call: string, op: Qson = operation) =>
      (await activity.loggingControls({ operation: op, qso: { their: { call } } }, ctx))[1]?.input
    expect(await numberFor('NA5N')).toMatchObject({ suggestedValue: '4321' })
    for (const call of ['', 'K1ABC', 'NA5', 'NA5N/K4BAI', 'N7CQRK7TQ'])
      expect(await numberFor(call)).toMatchObject({ suggestedValue: ' ' })
    for (const year of ['2025', '2027', ''])
      expect(await numberFor('NA5N', { refs: [{ type: 'zombie', ref: year }] })).toMatchObject({
        suggestedValue: ' ',
      })
    const patch = await activity.processQsoBeforeSave(
      { operation, qso: { their: { call: 'NA5N' } } },
      ctx,
    )
    expect(patch?.their?.exchange).toBe('')
  })

  it('preserves complete spooky names, free-form locations and leading zeros when projecting an exchange', async () => {
    const { activity } = createActivity(manifest)
    const qso: Qson = {
      their: { call: 'K1ABC', sent: '579', name: 'FRED' },
      refs: [
        {
          type: 'zombie',
          theirSpc: 'TRANSYLVANIA',
          theirZombieNumber: '0007',
          theirZombieName: 'DEAD MAN FRED',
        },
      ],
    }
    expect(await activity.processQsoBeforeSave({ operation, qso }, ctx)).toEqual({
      our: { zombie: { spc: 'RI', zombieNumber: '00123', zombieName: 'COUNT ROB', ref: '2026' } },
      their: { exchange: 'TRANSYLVANIA 0007 DEAD MAN FRED' },
    })
    expect(qso.their).toEqual({ call: 'K1ABC', sent: '579', name: 'FRED' })
  })

  it('provides space-entry transforms that survive save and ADIF while leaving numbers unchanged', async () => {
    const { activity } = createActivity(manifest)
    const controls = await activity.loggingControls({ operation, qso: {} }, ctx)
    const [spc, number, name] = controls
    if (spc?.input.kind !== 'text' || number?.input.kind !== 'text' || name?.input.kind !== 'text')
      throw new Error('Expected three text controls')
    expect([spc.shortLabel, name.shortLabel]).toEqual(['SPC', 'Name'])
    expect([spc.label, name.label]).toEqual([
      'State / province / country (_ = space)',
      'Zombie name (_ = space)',
    ])
    for (const control of [spc, name]) {
      expect(control.input).toMatchObject({
        transforms: [{ pattern: '_', replacement: ' ', flags: 'g' }],
      })
    }
    expect(number.input.numeric).toBe(true)
    expect(number.input.transforms).toBeUndefined()

    // Apply the declared native formatter contract: uppercase, then each
    // regex transform. Both typed underscores and pasted spaces must reach
    // the saved exchange and ADIF as complete words.
    const format = (value: string, input: typeof spc.input) => {
      let result = input.uppercase ? value.toUpperCase() : value
      for (const transform of input.transforms ?? [])
        result = result.replace(
          new RegExp(transform.pattern, transform.flags),
          transform.replacement,
        )
      return result
    }
    const { adifFields } = createExports(manifest)
    for (const [spcText, nameText] of [
      ['new_zealand', 'old_nick'],
      ['new zealand', 'old nick'],
    ]) {
      const qso: Qson = {
        their: { call: 'ZL1ABC', sent: '579' },
        refs: [
          {
            type: 'zombie',
            theirSpc: format(spcText ?? '', spc.input),
            theirZombieNumber: '002',
            theirZombieName: format(nameText ?? '', name.input),
          },
        ],
      }
      const patch = await activity.processQsoBeforeSave({ operation, qso }, ctx)
      expect(patch?.their).toEqual({ exchange: 'NEW ZEALAND 002 OLD NICK' })
      expect(await adifFields.fieldsForOneQSO({ operation, qso }, ctx)).toContainEqual({
        name: 'SRX_STRING',
        value: 'NEW ZEALAND 002 OLD NICK',
      })
    }
  })

  it('snapshots the sent bonus exchange without replacing the regular number and retains snapshots on edit', async () => {
    const { activity } = createActivity(manifest)
    const bonusOperation: Qson = {
      ...operation,
      refs: [{ ...(operation.refs as Qson[])[0], bonusStation: true }],
    }
    const original = JSON.stringify(bonusOperation)
    const patch = await activity.processQsoBeforeSave({ operation: bonusOperation, qso: {} }, ctx)
    expect(patch?.our).toMatchObject({ zombie: { zombieNumber: '4321', ref: '2026' } })
    expect(JSON.stringify(bonusOperation)).toBe(original)
    const edited: Qson = {
      refs: [
        {
          type: 'zombie',
          ourSpc: 'MA',
          ourZombieNumber: '0009',
          ourZombieName: 'OLD GHOST',
          theirSpc: '',
          theirZombieNumber: '',
          theirZombieName: '',
        },
      ],
    }
    expect(
      await activity.processQsoBeforeSave({ operation: bonusOperation, qso: edited }, ctx),
    ).toEqual({
      our: { zombie: { spc: 'MA', zombieNumber: '0009', zombieName: 'OLD GHOST', ref: '2026' } },
      their: { exchange: '' },
    })
    expect(await activity.processQsoBeforeSave({ operation: {}, qso: edited }, ctx)).toBeNull()
  })

  it('persists sent snapshots through the supported native one-level side patch and preserves them on later saves', async () => {
    const { activity } = createActivity(manifest)
    const qso: Qson = {
      our: { sent: '579' },
      their: { call: 'K1ABC', sent: '559' },
      refs: [
        { type: 'zombie', theirSpc: 'MA', theirZombieNumber: '007', theirZombieName: 'GHOST' },
      ],
    }
    const patch = await activity.processQsoBeforeSave({ operation, qso }, ctx)
    if (!patch) throw new Error('Expected a save patch')
    // The published compatibility contract merges our/their one level deep;
    // refs and uuid in a hook patch are ignored by older hosts.
    const saved: Qson = {
      ...qso,
      our: { ...object(qso.our), ...object(patch.our) },
      their: { ...object(qso.their), ...object(patch.their) },
    }
    expect(saved).toMatchObject({
      our: { sent: '579', zombie: { zombieNumber: '00123', ref: '2026' } },
      their: { call: 'K1ABC', sent: '559', exchange: 'MA 007 GHOST' },
    })
    const changedOperation: Qson = {
      ...operation,
      refs: [
        {
          type: 'zombie',
          ref: '2026',
          ourSpc: 'CA',
          ourZombieNumber: '999',
          ourZombieName: 'NEW GHOST',
          bonusStation: true,
        },
      ],
    }
    const editPatch = await activity.processQsoBeforeSave(
      { operation: changedOperation, qso: saved },
      ctx,
    )
    expect(editPatch?.our).toEqual(saved.our && { zombie: object(saved.our).zombie })
  })

  it('uses current-event history without substituting normal lookup names or reading the whole log per keystroke', async () => {
    const { activity, history } = createActivity(manifest)
    history.update({
      operation,
      qsos: [
        {
          uuid: 'worked-zombie',
          their: { call: 'K1ABC', sent: '599' },
          startAtMillis: Date.parse('2026-10-30T19:30:00Z'),
          refs: [
            {
              type: 'zombie',
              theirSpc: 'ONT',
              theirZombieNumber: '0011',
              theirZombieName: 'DR DEATH',
            },
          ],
        },
      ],
    })
    const getQsos = vi.fn(async () => [])
    for (let index = 0; index < 3; index++) {
      const controls = await activity.loggingControls(
        { operation, qso: { their: { call: 'K1ABC', name: 'BOB' } } },
        { ...ctx, getQsos },
      )
      expect(controls.map(({ input }) => input)).toMatchObject([
        { suggestedValue: 'ONT' },
        { suggestedValue: '0011' },
        { suggestedValue: 'DR DEATH' },
      ])
    }
    expect(getQsos.mock.calls.length).toBeLessThanOrEqual(1)
    const controls = await activity.loggingControls(
      { operation, qso: { their: { call: 'K2XYZ', name: 'NORMAL NAME' } } },
      ctx,
    )
    expect(controls[2]?.input).toMatchObject({ suggestedValue: ' ' })
  })
})
