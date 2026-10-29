import { describe, expect, it, vi } from 'vitest'
import type { Qson } from '../../../../packages/mini-contest/src/model.ts'
import { createGuideStore } from '../src/guide.ts'
import { createNsHooks } from '../src/hooks.ts'
import { initialQsyState, qsyContact } from '../src/qsy.ts'
import { contact, ctx, operation } from './fixtures.ts'

const cq = {
  ...contact(),
  refs: [{ type: 'ns', name: 'BOB', theirSerial: '42', location: 'MA', role: 'CQ' }],
}
const placement = { panelKey: 'ns-guide', config: {}, operation, qsoCount: 1, reason: 'qso' }

describe('NS guide cache and controls', () => {
  it('shares one cold operation read across simultaneous and repeated guide requests', async () => {
    const store = createGuideStore()
    const getQsos = vi.fn(async () => [cq])
    const states = await Promise.all(
      Array.from({ length: 4 }, () => store.current(operation, { ...ctx, getQsos })),
    )
    expect(getQsos).toHaveBeenCalledTimes(1)
    expect(states.every((state) => state.mode === 'CQ')).toBe(true)
    await store.current(operation, { ...ctx, getQsos })
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
  it('uses the scorer snapshot without reading the full log per keystroke', async () => {
    const { activity, scoring, panel } = createNsHooks()
    await scoring.scoreQsos({ operation, qsos: [cq] }, ctx)
    const getQsos = vi.fn(async () => [cq])
    for (let i = 0; i < 3; i++) {
      const controls = await activity.loggingControls?.(
        { operation, qso: { band: '20m', freq: 14042 } },
        { ...ctx, getQsos },
      )
      expect(controls?.find(({ key }) => key.endsWith('/role'))).toMatchObject({
        label: 'Operating mode · QSY reminder',
        shortLabel: 'QSY',
        skipFocus: true,
        input: {
          kind: 'options',
          field: 'role',
          suggestedValue: 'CQ',
          options: [{ code: 'CQ' }, { code: 'SP' }, { code: 'UNKNOWN' }],
        },
      })
      expect(
        await panel.render(
          { ...placement, qso: { band: '20m', freq: 14042 } },
          { ...ctx, getQsos },
        ),
      ).toMatchObject({ kind: 'markdown', content: expect.stringContaining('QSY reminder') })
    }
    expect(getQsos).not.toHaveBeenCalled()
  })
  it('retains an explicit intent change across Wipe but ignores historical edits', async () => {
    const { activity, scoring } = createNsHooks()
    const sp = {
      ...cq,
      refs: [{ type: 'ns', name: 'BOB', theirSerial: '42', location: 'MA', role: 'SP' }],
    }
    await scoring.scoreQsos({ operation, qsos: [sp] }, ctx)
    await activity.loggingControls?.(
      { operation, qso: { refs: [{ type: 'ns', role: 'CQ' }] } },
      ctx,
    )
    const wiped = await activity.loggingControls?.({ operation, qso: {} }, ctx)
    expect(wiped?.find(({ key }) => key.endsWith('/role'))?.input).toMatchObject({
      suggestedValue: 'CQ',
    })
    await activity.loggingControls?.({ operation, qso: sp }, ctx)
    const afterEdit = await activity.loggingControls?.({ operation, qso: {} }, ctx)
    expect(afterEdit?.find(({ key }) => key.endsWith('/role'))?.input).toMatchObject({
      suggestedValue: 'CQ',
    })
  })
  it('treats explicit clearing as Unknown and leaves it out of the sent/received exchange', async () => {
    const { activity, scoring } = createNsHooks()
    await scoring.scoreQsos({ operation, qsos: [cq] }, ctx)
    const cleared: Qson = {
      refs: [
        { type: 'ns', role: '', ourSerial: '8', theirSerial: '23', name: 'ANN', location: 'RI' },
      ],
    }
    expect(await activity.processQsoBeforeSave?.({ operation, qso: cleared }, ctx)).toEqual({
      our: { exchange: '8' },
      their: { exchange: '23 ANN RI' },
    })
    await activity.loggingControls?.({ operation, qso: cleared }, ctx)
    expect(
      (await activity.loggingControls?.({ operation, qso: {} }, ctx))?.find(({ key }) =>
        key.endsWith('/role'),
      )?.input,
    ).toMatchObject({ suggestedValue: 'UNKNOWN' })
  })
  it('recovers native operation payloads without UUID only from a unique creation identity', async () => {
    const store = createGuideStore()
    const op: Qson = { ...operation, createdAtMillis: 123 }
    const state = initialQsyState()
    state.mode = 'CQ'
    state.pending.push(qsyContact(cq))
    store.accept(op, { qsy: state })
    const { uuid: _uuid, ...native } = op
    expect((await store.current(native, ctx)).mode).toBe('CQ')
    store.accept({ ...op, uuid: 'second-op' }, { qsy: initialQsyState() })
    expect((await store.current(native, ctx)).complete).toBe(false)
  })
  it('does not leak QSY state between operations or selected sessions', async () => {
    const store = createGuideStore()
    const state = initialQsyState()
    state.mode = 'CQ'
    store.accept(operation, { qsy: state })
    expect((await store.current({ ...operation, uuid: 'other' }, ctx)).mode).toBe('UNKNOWN')
    expect(
      (await store.current({ ...operation, refs: [{ type: 'ns', ref: '2026-11-06-0230' }] }, ctx))
        .mode,
    ).toBe('UNKNOWN')
  })
  it('does not retain intent under a shared key when the operation cannot be identified', async () => {
    const store = createGuideStore()
    const unidentified = { refs: [{ type: 'ns', ref: '2026-10-30-0230' }] }
    await store.current(unidentified, ctx)
    store.rememberMode(unidentified, 'CQ')
    expect(await store.current(unidentified, ctx)).toMatchObject({
      mode: 'UNKNOWN',
      complete: false,
    })
  })
  it('replaces a cold native placeholder with the later scoring snapshot', async () => {
    const store = createGuideStore()
    const op: Qson = { ...operation, createdAtMillis: 123 }
    const { uuid: _uuid, ...native } = op
    expect((await store.current(native, ctx)).complete).toBe(false)
    const state = initialQsyState()
    state.mode = 'CQ'
    state.pending.push(qsyContact(cq))
    store.accept(op, { qsy: state })
    expect(await store.current(native, ctx)).toMatchObject({
      complete: true,
      mode: 'CQ',
      pending: [expect.objectContaining({ role: 'CQ' })],
    })
  })
  it('does not overwrite a fresh scoring snapshot with a delayed cold read', async () => {
    const store = createGuideStore()
    let resolve!: (rows: Qson[]) => void
    const pending = store.current(operation, {
      ...ctx,
      getQsos: () =>
        new Promise<Qson[]>((done) => {
          resolve = done
        }),
    })
    const state = initialQsyState()
    state.mode = 'SP'
    store.accept(operation, { qsy: state })
    resolve([cq])
    expect((await pending).mode).toBe('SP')
  })
  it('retains manual controls after a failed read and rejects malformed QSY caches', async () => {
    const store = createGuideStore()
    store.accept(operation, {
      qsy: { version: 1, complete: true, mode: 'CQ', pending: [null], recent: [] },
    })
    const getQsos = vi.fn(async () => {
      throw new Error('unavailable')
    })
    expect((await store.current(operation, { ...ctx, getQsos })).complete).toBe(false)
    store.rememberMode(operation, 'SP')
    expect((await store.current(operation, { ...ctx, getQsos })).mode).toBe('SP')
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
  it('offers guide placement and handles operations without NS', async () => {
    const { activity, panel } = createNsHooks()
    expect(await panel.getPanels({}, ctx)).toMatchObject([
      { key: 'ns-guide', on: ['operation', 'qso', 'qsoLogged'] },
    ])
    expect(await panel.render({ ...placement, operation: {} }, ctx)).toMatchObject({
      kind: 'markdown',
      content: expect.stringContaining('Add NCCC Sprint'),
    })
    expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
  })
})
