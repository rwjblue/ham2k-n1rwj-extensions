import type { JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createAuditStore, readSnapshot, snapshotFor } from '../src/audit-store.ts'
import { analyzeAwards } from '../src/awards.ts'
import type { Qson } from '../src/model.ts'
import { parseRoster } from '../src/roster.ts'

const roster = parseRoster(
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS\n1|K1ABC|Alice|MA||291|02 Jan 2006|||||A\n2|K2ABC|Bob|NY||291|02 Jan 2006|||||A',
)
const qso: Qson = {
  uuid: 'one',
  startAtMillis: Date.parse('2026-10-20T12:00:00Z'),
  mode: 'CW',
  band: '40m',
  their: { call: 'K2ABC' },
  our: {
    call: 'K1ABC',
    skcc: { number: '1', name: 'Alice', spc: 'MA', key: 'SK', qualified: true, keyDeclared: true },
  },
  refs: [{ type: 'skcc', number: '2', name: 'Bob', spc: 'NY', qualified: true }],
}
function report() {
  return analyzeAwards([qso], roster, {
    scope: 'complete-history',
    myNumber: '1',
    month: '2026-10',
  })
}

describe('SKCC imported audit snapshot validation', () => {
  it('records a compact dated, owner-specific report with deduplicated award identities', () => {
    const snapshot = snapshotFor(report(), '001C', 'Complete ADIF export', 100)
    expect(snapshot).toMatchObject({
      schema: 1,
      at: 100,
      member: '1',
      records: 1,
      eligible: 1,
      rosterRevision: roster.revision,
      month: '2026-10',
    })
    expect(snapshot.awards.C).toMatchObject({ total: 1, refs: ['2'], numbers: ['2'] })
    expect(readSnapshot(snapshot)).toEqual(snapshot)
    expect(snapshot).not.toHaveProperty('rows')
  })
  it('rejects partial reports, unknown owners and award credits belonging to another operator', () => {
    expect(() => snapshotFor({ ...report(), scope: 'selected' }, '1', 'ADIF')).toThrow(
      'complete-history',
    )
    expect(() => snapshotFor(report(), '', 'ADIF')).toThrow('Set your SKCC number')
    expect(() => snapshotFor(report(), '2', 'ADIF')).toThrow('another SKCC member')
    expect(() => snapshotFor(report(), '1', 'ADIF', NaN)).toThrow('Invalid SKCC audit report')
  })
  it('rejects corrupt saved counts, identifiers, dates, totals and oversized data', () => {
    const good = snapshotFor(report(), '1', 'ADIF', 100)
    for (const patch of [
      { schema: 2 },
      { at: -1 },
      { at: Infinity },
      { member: '001C' },
      { month: '2026-13' },
      { records: NaN },
      { records: -1 },
      { records: 1.5 },
      { eligible: 2 },
      { source: 'x'.repeat(121) },
    ])
      expect(readSnapshot({ ...good, ...patch })).toBeUndefined()
    for (const patch of [
      { total: Infinity },
      { target: -1 },
      { numbers: ['001C'] },
      { refs: [42] },
    ])
      expect(
        readSnapshot({ ...good, awards: { ...good.awards, C: { ...good.awards.C, ...patch } } }),
      ).toBeUndefined()
    expect(
      readSnapshot({
        ...good,
        awards: {
          ...good.awards,
          C: { ...good.awards.C, refs: Array(45_000).fill('x'.repeat(100)) },
        },
      }),
    ).toBeUndefined()
  })
  it('copies only known serialized fields instead of retaining arbitrary saved objects', () => {
    const good = snapshotFor(report(), '1', 'ADIF', 100)
    const extra: Record<string, unknown> = {}
    extra.self = extra
    const restored = readSnapshot({ ...good, extra })
    expect(restored).toEqual(good)
    expect(restored?.awards.C.refs).not.toBe(good.awards.C.refs)
  })
})

describe('SKCC audit store persistence', () => {
  it('restores the durable snapshot while keeping the full current-session report separate', async () => {
    const saved = snapshotFor(report(), '1', 'Previous export', 100)
    const getSettings = vi.fn(async () => ({
      extensions: { 'extension_n1rwj-skcc': { auditSnapshot: saved as unknown as JSONValue } },
    }))
    const setSettings = vi.fn(async (_patch: Record<string, JSONValue>) => undefined)
    const store = createAuditStore({ getSettings, setSettings })
    await Promise.all([store.load(), store.load()])
    expect(getSettings).toHaveBeenCalledTimes(1)
    expect(store.get()).toEqual(saved)
    expect(store.report()).toBeUndefined()
    const current = report()
    await store.save(current, '1', '  ')
    expect(store.report()).toBe(current)
    expect(store.get()?.source).toBe('ADIF import')
    expect(setSettings).toHaveBeenCalledWith({ auditSnapshot: store.get() })
    await store.clear()
    expect(store.get()).toBeUndefined()
    expect(store.report()).toBeUndefined()
    expect(setSettings).toHaveBeenLastCalledWith({ auditSnapshot: null })
  })
  it('does not let an outstanding initial read resurrect a cleared snapshot', async () => {
    let resolve!: (value: Record<string, JSONValue>) => void
    const getSettings = vi.fn(
      () =>
        new Promise<Record<string, JSONValue>>((done) => {
          resolve = done
        }),
    )
    const store = createAuditStore({ getSettings, setSettings: async () => undefined })
    const loading = store.load()
    await store.clear()
    resolve({
      extensions: {
        'extension_n1rwj-skcc': {
          auditSnapshot: snapshotFor(report(), '1', 'Old', 100) as unknown as JSONValue,
        },
      },
    })
    await loading
    expect(store.get()).toBeUndefined()
  })
  it('keeps a new import or clear authoritative when initial loading starts afterward', async () => {
    const getSettings = vi.fn(async () => ({
      extensions: {
        'extension_n1rwj-skcc': {
          auditSnapshot: snapshotFor(report(), '1', 'Old', 100) as unknown as JSONValue,
        },
      },
    }))
    const store = createAuditStore({ getSettings, setSettings: async () => undefined })
    const current = report()
    await store.save(current, '1', 'New import')
    const saved = store.get()
    await store.load()
    expect(store.get()).toBe(saved)
    expect(store.report()).toBe(current)
    expect(getSettings).not.toHaveBeenCalled()

    const cleared = createAuditStore({ getSettings, setSettings: async () => undefined })
    await cleared.clear()
    await cleared.load()
    expect(cleared.get()).toBeUndefined()
    expect(getSettings).not.toHaveBeenCalled()
  })
  it('serializes saves and clears and retains prior data after a failed mutation', async () => {
    const setSettings = vi.fn(async (_patch: Record<string, JSONValue>) => undefined)
    const store = createAuditStore({ getSettings: async () => ({}), setSettings })
    await store.save(report(), '1', 'Good')
    const good = store.get()
    setSettings.mockRejectedValueOnce(new Error('Storage failed'))
    await expect(store.save(report(), '1', 'Failed')).rejects.toThrow('Storage failed')
    expect(store.get()).toBe(good)
    await Promise.all([store.save(report(), '1', 'New'), store.clear()])
    expect(store.get()).toBeUndefined()
    expect(setSettings).toHaveBeenLastCalledWith({ auditSnapshot: null })
  })
})
