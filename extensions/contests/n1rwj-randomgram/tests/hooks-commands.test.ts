import type {
  ActivityHook,
  CommandHook,
  FormDefinition,
  FormField,
  HookContext,
  LoggingControlDescriptor,
  RefHandlerHook,
} from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActivity } from '../src/activity.ts'
import { createCommands } from '../src/commands.ts'
import { object, type Qson, REF_TYPE, refOf } from '../src/model.ts'
import { createRetirementStore } from '../src/retirement.ts'

const settingKey = 'extension_n1rwj-randomgram'
const txGroups = ['0A9ZO', 'XYZAB', 'O01QT']
const opRef: Qson = {
  type: REF_TYPE,
  ref: 'RG#999',
  participant: 'K1TEST',
  alphabet: 'alphanumeric',
  txList: txGroups.join('\n'),
  txGroups,
}
function operation(ref: Qson = {}, uuid = 'randomgram-operation'): Qson {
  return { uuid, stationCall: 'K1TEST', refs: [{ ...opRef, ...ref }] }
}
function contact(ref: Qson = {}, extra: Qson = {}): Qson {
  return {
    their: { call: 'K2TEST' },
    our: { sent: '579' },
    band: '20m',
    mode: 'CW',
    refs: [{ type: REF_TYPE, ourSerial: 1, ...ref }],
    ...extra,
  }
}
const issued = `Please find below and attached a Tx List of [3] registered code groups.
Call: K1TEST
Event: RG#999 on Sat Jan 2nd @ 22:00 UTC (24-hrs)
TX List for K1TEST:
0A9ZO
XYZAB
O01QT
-end-`

function fixture(initial: Qson = {}) {
  let settings: Qson = {
    extensions: { [settingKey]: { enabled: true, retiredThrough: initial } },
  }
  const read = vi.fn(async () => settings)
  const write = vi.fn(async (values: Qson) => {
    const extensions = object(settings.extensions)
    settings = {
      ...settings,
      extensions: {
        ...extensions,
        [settingKey]: { ...object(extensions[settingKey]), ...values },
      },
    }
  })
  const getQsos = vi.fn<NonNullable<HookContext['getQsos']>>(async () => {
    throw new Error('A logging keystroke must not read the full log')
  })
  const showForm = vi.fn(async (_form: FormDefinition) => null)
  const onPresentationError = vi.fn<(error: unknown) => void>()
  const ctx: HookContext = { online: false, locale: 'en', appName: 'Ham2K Logger', getQsos }
  const store = createRetirementStore(read, write)
  const hooks = createActivity(store)
  return {
    store,
    activity: hooks.activity as ActivityHook,
    refHandler: hooks.refHandler as RefHandlerHook,
    commands: createCommands(store, showForm, onPresentationError),
    ctx,
    read,
    write,
    getQsos,
    showForm,
    onPresentationError,
    settings: () => settings,
    restart: () => createRetirementStore(read, write),
  }
}

function field(controls: LoggingControlDescriptor[], key: string): FormField {
  for (const control of controls) {
    if (control.input.kind !== 'form') continue
    const found = control.input.form.elements.find(
      (element): element is FormField => element.type === 'field' && element.key === key,
    )
    if (found) return found
  }
  throw new Error(`Missing setup field ${key}`)
}
async function interpret(
  command: CommandHook,
  ctx: HookContext,
  input: string,
  execute = false,
  op: Qson = operation(),
  qso: Qson = contact(),
) {
  return command.interpret({ input, execute, operation: op, qso }, ctx)
}

describe('operation setup', () => {
  it('validates and transforms the organizer list and derives its event number', async () => {
    const f = fixture()
    const empty = operation({ ref: 'RG', txList: '', txGroups: [] })
    const controls = (await f.activity.operationControls?.({ operation: empty }, f.ctx)) ?? []
    const tx = field(controls, 'txList')
    const event = field(controls, 'ref')
    const state = { ref: '', participant: 'K1TEST', alphabet: 'alphanumeric', txList: issued }
    expect(await tx.validate?.(issued, state)).toBeNull()
    const transformedList = await tx.transform?.(issued, state)
    expect(transformedList).toBe(issued)
    state.txList = transformedList
    expect(await event.validate?.('', state)).toBeNull()
    expect(await event.transform?.('', state)).toBe('RG#999')
    expect(await event.transform?.(' 999 ', state)).toBe('RG#999')
    expect(await event.validate?.('nonsense', state)).toContain('event number')
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('rejects the wrong recipient, event, declared count, and event alphabet', async () => {
    const f = fixture()
    const controls =
      (await f.activity.operationControls?.(
        { operation: operation({ ref: 'RG', txList: '', txGroups: [] }) },
        f.ctx,
      )) ?? []
    const tx = field(controls, 'txList')
    const state = { ref: 'RG#999', participant: 'K1TEST', alphabet: 'alphanumeric', txList: issued }
    expect(await tx.validate?.(issued, { ...state, participant: 'K2TEST' })).toContain(
      'different callsign',
    )
    expect(
      await tx.validate?.(issued.replace(/K1TEST/g, 'K2TEST'), { ...state, participant: '' }),
    ).toContain('different callsign')
    expect(await tx.validate?.(issued, { ...state, ref: 'RG#1000' })).toContain('different event')
    expect(await tx.validate?.(issued.replace('[3]', '[4]'), state)).toContain('declares 4')
    expect(await tx.validate?.(issued, { ...state, alphabet: 'letters' })).toContain('alphabet')
  })

  it('keeps issued groups fixed in place and permits only append operations', async () => {
    const f = fixture()
    const controls = (await f.activity.operationControls?.({ operation: operation() }, f.ctx)) ?? []
    const tx = field(controls, 'txList')
    const event = field(controls, 'ref')
    const state = { ref: 'RG#999', participant: 'K1TEST', alphabet: 'alphanumeric' }
    expect(await tx.validate?.(`${txGroups.join('\n')}\nABCDE`, state)).toBeNull()
    for (const replacement of ['ABCDE\nXYZAB\nO01QT', 'XYZAB\n0A9ZO\nO01QT', '0A9ZO\nXYZAB']) {
      expect(await tx.validate?.(replacement, state)).toContain('original order')
    }
    expect(await tx.validate?.('', state)).toContain('Keep the issued groups')
    expect(await event.validate?.('1000', state)).toContain('new operation')
    expect(await field(controls, 'participant').validate?.('K2TEST', state)).toContain(
      'different list owner',
    )
    expect(await field(controls, 'alphabet').validate?.('letters', state)).toContain(
      'different event alphabet',
    )
  })

  it('allows listening-only setup without a TX list', async () => {
    const f = fixture()
    const controls =
      (await f.activity.operationControls?.(
        { operation: operation({ txList: '', txGroups: [] }) },
        f.ctx,
      )) ?? []
    const state = { ref: 'RG#999', participant: 'SWL123', alphabet: 'letters', txList: '' }
    expect(await field(controls, 'txList').validate?.('', state)).toBeNull()
    expect(await field(controls, 'ref').validate?.('999', state)).toBeNull()
    expect(await field(controls, 'ref').validate?.('1000', state)).toContain('new operation')
  })

  it('decorates the normalized list with string groups and stable event identity', async () => {
    const f = fixture()
    const decorated = await f.refHandler.decorateRef?.(
      { ref: { type: REF_TYPE, ref: '999', txList: txGroups.join('\n') } },
      f.ctx,
    )
    expect(decorated).toMatchObject({ type: REF_TYPE, ref: 'RG#999', txGroups })
    expect(decorated?.name).toContain('3')
    expect(
      await f.refHandler.validateRef?.({ ref: { type: REF_TYPE, ref: ' 999 ' } }, f.ctx),
    ).toEqual({
      valid: true,
      normalized: 'RG#999',
    })
    const fromMessage = await f.refHandler.decorateRef?.(
      { ref: { type: REF_TYPE, ref: 'RG', txList: issued } },
      f.ctx,
    )
    expect(fromMessage).toMatchObject({ ref: 'RG#999', txGroups, txList: txGroups.join('\n') })
  })

  it('normalizes a blank participant and reopens a legacy list owner without a false mismatch', async () => {
    const f = fixture()
    const fresh = operation({ ref: 'RG', txGroups: [], txList: '', participant: '' })
    const controls = (await f.activity.operationControls?.({ operation: fresh }, f.ctx)) ?? []
    const state = { ref: 'RG#999', participant: '', alphabet: 'alphanumeric', txList: issued }
    expect(await field(controls, 'txList').validate?.(issued, state)).toBeNull()
    expect(await field(controls, 'participant').transform?.('', state)).toBe('K1TEST')

    const legacy = {
      ...operation({ participant: '', issuedCall: 'K1TEST' }),
      stationCall: 'K2TEST',
    }
    const reopened = (await f.activity.operationControls?.({ operation: legacy }, f.ctx)) ?? []
    expect(field(reopened, 'participant').value).toBe('K1TEST')
    expect(await field(reopened, 'participant').validate?.('K1TEST', state)).toBeNull()
    expect(await field(reopened, 'participant').validate?.('K2TEST', state)).toContain(
      'different list owner',
    )
  })
})

describe('logging controls and saved literals', () => {
  it('reads settings once and never loads a full log on successive keystrokes', async () => {
    const f = fixture()
    const op = operation()
    for (const call of ['K', 'K2', 'K2T', 'K2TEST']) {
      const controls = await f.activity.loggingControls?.(
        { operation: op, qso: contact({}, { their: { call } }) },
        f.ctx,
      )
      expect(controls?.find((control) => control.input.kind === 'serial')?.input).toMatchObject({
        kind: 'serial',
        refType: REF_TYPE,
        field: 'ourSerial',
        sequence: { key: 'tx-item', start: 1 },
      })
    }
    expect(f.read).toHaveBeenCalledTimes(1)
    expect(f.getQsos).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('snapshots the literal selected TX and RX without mutating the contact or issuing another group', async () => {
    const f = fixture()
    const qso = contact({ ourSerial: 3, theirGroup: '0O1ZA' })
    const before = JSON.stringify(qso)
    expect(await f.activity.processQsoBeforeSave?.({ operation: operation(), qso }, f.ctx)).toEqual(
      {
        our: { exchange: 'O01QT' },
        their: { exchange: '0O1ZA' },
      },
    )
    expect(JSON.stringify(qso)).toBe(before)
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
    expect(f.getQsos).not.toHaveBeenCalled()
  })

  it('preserves the operator’s TX correction and explicitly cleared RX', async () => {
    const f = fixture()
    const qso = contact(
      { ourGroup: 'O00AZ', theirGroup: '' },
      { our: { sent: '579', exchange: 'ABCDE' }, their: { call: 'K2TEST', exchange: 'VWXYZ' } },
    )
    expect(await f.activity.processQsoBeforeSave?.({ operation: operation(), qso }, f.ctx)).toEqual(
      {
        our: { exchange: 'O00AZ' },
        their: { exchange: '' },
      },
    )
  })

  it('keeps a historical TX snapshot after setup edits and leaves an unallocated batch item blank', async () => {
    const f = fixture()
    const saved = contact({}, { uuid: 'qso1', our: { exchange: '0A9ZO' } })
    expect(
      await f.activity.processQsoBeforeSave?.(
        { operation: operation({ txGroups: ['ABCDE'], alphabet: 'letters' }), qso: saved },
        f.ctx,
      ),
    ).toMatchObject({ our: { exchange: '0A9ZO' } })
    expect(
      await f.activity.processQsoBeforeSave?.(
        { operation: operation(), qso: contact({ ourSerial: '' }) },
        f.ctx,
      ),
    ).toMatchObject({ our: { exchange: '' } })
  })

  it('does not rewrite unrelated operations or annotation rows', async () => {
    const f = fixture()
    expect(
      await f.activity.processQsoBeforeSave?.({ operation: { refs: [] }, qso: contact() }, f.ctx),
    ).toBeNull()
    expect(
      await f.activity.processQsoBeforeSave?.(
        { operation: operation(), qso: contact({}, { band: 'event' }) },
        f.ctx,
      ),
    ).toBeNull()
    expect(await f.activity.loggingControls?.({ operation: { refs: [] } }, f.ctx)).toEqual([])
  })
})

describe('operator commands and durable retirement', () => {
  it('catalog and repeated previews perform no settings reads or writes', async () => {
    const f = fixture()
    expect((await f.commands.catalog?.(f.ctx))?.map((entry) => entry.command)).toEqual([
      'RGREPORT',
      'RGSWL',
      'RGSKIP',
    ])
    for (let i = 0; i < 3; i++) {
      expect(await interpret(f.commands, f.ctx, 'RGSKIP')).toMatchObject({
        describe: expect.stringContaining('0A9ZO'),
      })
      expect(await interpret(f.commands, f.ctx, 'RGSWL O01QT')).toMatchObject({
        describe: expect.stringContaining('listening only'),
      })
      expect(await interpret(f.commands, f.ctx, 'RGREPORT')).toMatchObject({
        describe: expect.stringContaining('submission'),
      })
    }
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
    expect(f.getQsos).not.toHaveBeenCalled()
    expect(f.showForm).not.toHaveBeenCalled()
  })

  it('persists retirement before claiming success and restores a next-item descriptor hint', async () => {
    const f = fixture({ 'another-operation|RG#998': 7 })
    const result = await interpret(f.commands, f.ctx, 'RGSKIP 2', true)
    expect(f.write).toHaveBeenCalledExactlyOnceWith({
      retiredThrough: { 'another-operation|RG#998': 7, 'randomgram-operation|RG#999': 2 },
      retiredItems: { 'randomgram-operation|RG#999': [2] },
    })
    const note = result?.commands?.[0].addQso
    expect(note).toMatchObject({
      band: 'event',
      mode: 'note',
      freq: 0,
      event: { event: 'note', note: expect.stringContaining('XYZAB') },
      refs: [{ type: REF_TYPE, ourSerial: 2, ourGroup: 'XYZAB', skipped: true }],
    })
    expect(refOf(note ?? {})?.theirGroup).toBeUndefined()
    expect(object(object(f.settings().extensions)[settingKey]).enabled).toBe(true)
    const restarted = createActivity(f.restart()).activity as ActivityHook
    const controls = await restarted.loggingControls?.({ operation: operation() }, f.ctx)
    expect(controls?.find((control) => control.input.kind === 'serial')?.input).toMatchObject({
      sequence: { key: 'tx-item', start: 3 },
    })
    expect(f.getQsos).not.toHaveBeenCalled()
  })

  it('permits unused earlier positions while rejecting a repeated exact item after restart', async () => {
    const f = fixture()
    const groups = Array.from(
      { length: 12 },
      (_, index) => `A${String(index + 1).padStart(4, '0')}`,
    )
    const op = operation({ txGroups: groups, txList: groups.join('\n') })
    await interpret(f.commands, f.ctx, 'RGSKIP 12', true, op)
    expect(await f.store.isRetired(op, 12)).toBe(true)
    expect(await f.store.isRetired(op, 5)).toBe(false)
    const restartedCommand = createCommands(f.restart(), f.showForm)
    expect(await interpret(restartedCommand, f.ctx, 'RGSKIP 5', true, op)).toMatchObject({
      describe: expect.stringContaining('Record used item 5'),
    })
    expect(await interpret(restartedCommand, f.ctx, 'RGSKIP 12', true, op)).toMatchObject({
      error: expect.stringContaining('already retired'),
    })
    expect(await interpret(restartedCommand, f.ctx, 'RGSKIP 5', true, op)).toMatchObject({
      error: expect.stringContaining('already retired'),
    })
    const persisted = f.restart()
    expect(await persisted.through(op)).toBe(12)
    expect(await persisted.isRetired(op, 5)).toBe(true)
    expect(await persisted.isRetired(op, 4)).toBe(false)
    expect(f.write).toHaveBeenCalledTimes(2)
  })

  it('isolates retirement by saved operation and event and serializes concurrent updates', async () => {
    const f = fixture()
    await Promise.all([
      f.store.retire(operation(), 2),
      f.store.retire(operation({}, 'second-operation'), 1),
      f.store.retire(operation(), 1),
    ])
    expect(await f.restart().through(operation())).toBe(2)
    expect(await f.restart().through(operation({}, 'second-operation'))).toBe(1)
    expect(await f.restart().isRetired(operation(), 1)).toBe(true)
    expect(await f.restart().isRetired(operation(), 2)).toBe(true)
    expect(await f.restart().isRetired(operation(), 3)).toBe(false)
    expect(await f.restart().isRetired(operation({}, 'second-operation'), 2)).toBe(false)
    expect(await f.store.through(operation({ ref: 'RG#1000' }))).toBe(0)
    expect(await f.store.through(operation({}, ''))).toBe(0)
    expect(f.write.mock.calls[f.write.mock.calls.length - 1]?.[0]).toEqual({
      retiredThrough: { 'randomgram-operation|RG#999': 2, 'second-operation|RG#999': 1 },
      retiredItems: { 'randomgram-operation|RG#999': [1, 2], 'second-operation|RG#999': [1] },
    })
  })

  it('records listening-only groups as annotations without consuming an issued item', async () => {
    const f = fixture()
    const result = await interpret(f.commands, f.ctx, 'rgswl o01qt', true)
    expect(result?.commands?.[0].addQso).toMatchObject({
      band: 'event',
      mode: 'note',
      freq: 0,
      their: { call: 'NOTE' },
      our: { call: 'EVENT' },
      event: { event: 'note', note: expect.stringContaining('O01QT') },
      refs: [{ type: REF_TYPE, theirGroup: 'O01QT', listeningOnly: true }],
    })
    expect(refOf(result?.commands?.[0].addQso ?? {})?.ourSerial).toBeUndefined()
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('rejects a skipped index inconsistent with an explicit correction unless the item is supplied', async () => {
    const f = fixture()
    const corrected = contact({ ourGroup: 'XYZAB' })
    expect(
      await interpret(f.commands, f.ctx, 'RGSKIP', false, operation(), corrected),
    ).toMatchObject({ error: expect.stringContaining('override differs') })
    expect(
      await interpret(f.commands, f.ctx, 'RGSKIP 2', false, operation(), corrected),
    ).toMatchObject({ describe: expect.stringContaining('XYZAB') })
    expect(f.write).not.toHaveBeenCalled()
  })

  it('rejects malformed, exhausted, saved-contact and inactive-operation commands', async () => {
    const f = fixture()
    expect(await interpret(f.commands, f.ctx, 'unrelated command')).toBeNull()
    expect(await interpret(f.commands, f.ctx, 'RGSWL')).toMatchObject({ expectsParams: true })
    expect(await interpret(f.commands, f.ctx, 'RGSWL ABC@E')).toMatchObject({
      error: expect.any(String),
    })
    expect(
      await interpret(f.commands, f.ctx, 'RGSWL 0A9ZO', true, operation({ alphabet: 'letters' })),
    ).toMatchObject({ error: expect.any(String) })
    expect(await interpret(f.commands, f.ctx, 'RGSKIP 4', true)).toMatchObject({
      error: expect.any(String),
    })
    expect(await interpret(f.commands, f.ctx, 'RGSKIP 0', true)).toMatchObject({
      error: expect.any(String),
    })
    expect(
      await interpret(
        f.commands,
        f.ctx,
        'RGSKIP',
        true,
        operation(),
        contact({ ourGroup: 'AB@DE' }),
      ),
    ).toMatchObject({ error: expect.stringContaining('No valid TX group') })
    expect(
      await interpret(f.commands, f.ctx, 'RGSKIP 1', true, operation({ alphabet: 'letters' })),
    ).toMatchObject({ error: expect.any(String) })
    expect(
      await interpret(
        f.commands,
        f.ctx,
        'RGSKIP',
        true,
        operation(),
        contact({}, { uuid: 'saved' }),
      ),
    ).toMatchObject({ error: expect.stringContaining('new, unlogged') })
    expect(await interpret(f.commands, f.ctx, 'RGSKIP', true, { refs: [] })).toMatchObject({
      error: expect.stringContaining('RandomGram operation'),
    })
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('does not claim retirement when settings persistence fails and can retry', async () => {
    const f = fixture()
    f.write.mockRejectedValueOnce(new Error('Settings are unavailable'))
    await expect(interpret(f.commands, f.ctx, 'RGSKIP', true)).rejects.toThrow(
      'Settings are unavailable',
    )
    expect(await f.store.through(operation())).toBe(0)
    expect(await f.store.isRetired(operation(), 1)).toBe(false)
    expect(await f.restart().through(operation())).toBe(0)
    const retry = await interpret(f.commands, f.ctx, 'RGSKIP', true)
    expect(retry?.describe).toContain('Record used item 1')
    expect(await f.restart().through(operation())).toBe(1)
    expect(await f.restart().isRetired(operation(), 1)).toBe(true)
  })

  it('recovers from a transient settings read failure without publishing a retirement action', async () => {
    const f = fixture()
    f.read.mockRejectedValueOnce(new Error('Could not load settings'))
    await expect(interpret(f.commands, f.ctx, 'RGSKIP', true)).rejects.toThrow(
      'Could not load settings',
    )
    expect(f.write).not.toHaveBeenCalled()
    const retry = await interpret(f.commands, f.ctx, 'RGSKIP', true)
    expect(retry?.describe).toContain('Record used item 1')
    expect(await f.restart().through(operation())).toBe(1)
  })

  it('copies deduplicated received groups only on explicit report execution', async () => {
    const f = fixture()
    f.getQsos.mockResolvedValueOnce([
      contact({ theirGroup: 'VWXYZ' }),
      contact({ theirGroup: 'AB@DE' }),
      contact({ theirGroup: 'VWXYZ' }),
      contact({ theirGroup: 'LMNOP', listeningOnly: true }, { band: 'event', mode: 'note' }),
      contact({ ourSerial: 2, ourGroup: 'XYZAB', skipped: true }, { band: 'event', mode: 'note' }),
    ])
    const result = await interpret(f.commands, f.ctx, 'RGREPORT', true)
    expect(result?.describe).toContain('submission')
    expect(result?.commands).toBeUndefined()
    expect(f.getQsos).toHaveBeenCalledExactlyOnceWith('randomgram-operation')
    expect(f.showForm).toHaveBeenCalledTimes(1)
    const form = f.showForm.mock.calls[0]?.[0]
    const submission = form?.elements.find(
      (element) => element.type === 'field' && element.key === 'submission',
    )
    expect(submission).toMatchObject({ fieldType: 'multiline', value: 'K1TEST\n\nVWXYZ\nLMNOP\n' })
    const notice = form?.elements.find((element) => element.type === 'markdown')
    expect(notice).toMatchObject({
      text: expect.stringContaining('1 repeated received group omitted.'),
    })
    expect(notice).toMatchObject({ text: expect.stringContaining('1 invalid entry omitted.') })
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('reports an unavailable log without presenting a partial submission', async () => {
    const f = fixture()
    expect(
      await f.commands.interpret(
        { input: 'RGREPORT', operation: operation(), execute: true },
        { online: false },
      ),
    ).toMatchObject({ error: expect.stringContaining('cannot retrieve') })
    f.getQsos.mockResolvedValueOnce(null)
    expect(await interpret(f.commands, f.ctx, 'RGREPORT', true)).toMatchObject({
      error: expect.stringContaining('log is unavailable'),
    })
    expect(await interpret(f.commands, f.ctx, 'RGREPORT unwanted', true)).toMatchObject({
      error: expect.stringContaining('does not take'),
    })
    expect(f.showForm).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('finishes report execution while the dialog remains open and treats cancellation as a normal close', async () => {
    const f = fixture()
    f.getQsos.mockResolvedValueOnce([contact({ theirGroup: 'VWXYZ' })])
    let close: (value: null) => void = () => {
      throw new Error('The report was not opened')
    }
    f.showForm.mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          close = resolve
        }),
    )
    // Await before closing: waiting for the operator here would hang the
    // command and reproduce the native 30-second execution timeout.
    const result = await interpret(f.commands, f.ctx, 'RGREPORT', true)
    expect(result?.describe).toContain('Copy received groups')
    expect(f.showForm).toHaveBeenCalledTimes(1)
    close(null)
    await Promise.resolve()
    expect(f.onPresentationError).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })

  it('surfaces a real report presentation failure instead of treating it as cancellation', async () => {
    const f = fixture()
    f.getQsos.mockResolvedValueOnce([contact({ theirGroup: 'VWXYZ' })])
    const failure = new Error('The form presenter is unavailable')
    f.showForm.mockRejectedValueOnce(failure)
    await interpret(f.commands, f.ctx, 'RGREPORT', true)
    await Promise.resolve()
    expect(f.onPresentationError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(f.write).not.toHaveBeenCalled()
  })

  it('treats an old checkpoint as evidence for its highest item only', async () => {
    const f = fixture({ 'randomgram-operation|RG#999': 3 })
    expect(await f.store.isRetired(operation(), 3)).toBe(true)
    expect(await f.store.isRetired(operation(), 2)).toBe(false)
    await interpret(f.commands, f.ctx, 'RGSKIP 1', true)
    const restarted = f.restart()
    expect(await restarted.through(operation())).toBe(3)
    expect(await restarted.isRetired(operation(), 1)).toBe(true)
    expect(await restarted.isRetired(operation(), 3)).toBe(true)
    expect(await restarted.isRetired(operation(), 2)).toBe(false)
  })

  it('does not persist invalid item numbers or an unsaved operation', async () => {
    const f = fixture()
    await expect(f.store.retire(operation(), 0)).rejects.toThrow('positive whole number')
    await expect(f.store.retire(operation(), Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(
      'positive whole number',
    )
    await expect(f.store.retire(operation({}, ''), 1)).rejects.toThrow('saved RandomGram operation')
    expect(f.read).not.toHaveBeenCalled()
    expect(f.write).not.toHaveBeenCalled()
  })
})
