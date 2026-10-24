import type { BoardSpot, PanelRenderArgs } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createAuditStore } from '../src/audit-store.ts'
import { analyzeAwards } from '../src/awards.ts'
import type { Member, Roster } from '../src/model.ts'
import { createPanel, opportunities } from '../src/panel.ts'
import { createPreferences, DEFAULTS } from '../src/preferences.ts'
import { createSettings } from '../src/settings.ts'

const member: Member = {
  number: '2',
  call: 'K2ABC',
  name: 'Alice',
  spc: 'NY',
  qth: '',
  suffix: 'T',
  oldCalls: [],
  status: 'A',
  joinDate: '2006-01-01',
  centurionDate: '2010-01-01',
  tribuneDate: '2011-01-01',
}
const me: Member = { ...member, number: '1', call: 'N1ME', name: 'Me', tx8Date: '2012-01-01' }
const now = Date.parse('2026-10-24T15:00:00Z')
const roster: Roster = {
  members: [me, member, { ...member, number: '3', call: 'N3SK', status: 'SK' }],
  downloadedAt: now,
  source: 'test',
  revision: 'r1',
}
function spot(call = 'K2ABC', changes: Partial<BoardSpot> = {}): BoardSpot {
  return {
    their: { call },
    freq: 7055000,
    band: '40m',
    mode: 'CW',
    spot: { timeInMillis: now - 30000, source: 'RBN', sourceInfo: { wpm: 12 } },
    ...changes,
  }
}
function stores() {
  const deps = {
    getSettings: vi.fn(async () => ({
      extensions: { 'extension_n1rwj-skcc': { ...DEFAULTS, myNumber: '1' } },
    })),
    setSettings: vi.fn(async () => undefined),
  }
  return { prefs: createPreferences(deps), audit: createAuditStore(deps), deps }
}
const args: PanelRenderArgs = {
  panelKey: 'companion',
  operation: { uuid: 'op' },
  qsoCount: 0,
  config: {},
  reason: 'operation',
  clock: { nowMillis: now, realNowMillis: now },
}

describe('SKCC companion panel', () => {
  it('filters inactive, stale, non-CW, unknown speed and self; keeps latest per call/band', () => {
    const rows = opportunities(
      [
        spot(),
        spot('K2ABC', { spot: { timeInMillis: now, source: 'RBN', sourceInfo: { wpm: 10 } } }),
        spot('N1ME'),
        spot('N3SK'),
        spot('K2ABC', { band: '20m', mode: 'SSB' }),
        spot('K2ABC', { band: '10m', spot: { timeInMillis: now - 3600000, source: 'RBN' } }),
        spot('K2ABC', { band: '80m', spot: { timeInMillis: now, source: 'RBN' } }),
      ],
      roster,
      { ...DEFAULTS, myNumber: '1', maxWpm: 12 },
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.wpm).toBe(10)
    expect(rows[0]?.reasons.join(' ')).toContain('Centurion: potential')
  })
  it('does not reread the operation while typing calls, refreshing spots or ticking', async () => {
    const { prefs, audit } = stores(),
      panel = createPanel(() => roster, prefs, audit)
    const ctx = { online: false, getQsos: vi.fn(async () => []), getSpots: vi.fn(async () => []) }
    await panel.render(args, ctx)
    for (const reason of ['qso', 'qso', 'spots', 'tick'])
      await panel.render({ ...args, reason }, ctx)
    expect(ctx.getQsos).toHaveBeenCalledTimes(1)
    await panel.render({ ...args, reason: 'qsoLogged' }, ctx)
    expect(ctx.getQsos).toHaveBeenCalledTimes(2)
  })
  it('suppresses live assistance in SKS without claiming to disable other sources', async () => {
    const { prefs, audit } = stores(),
      panel = createPanel(() => roster, prefs, audit)
    const ctx = {
      online: true,
      getQsos: vi.fn(async () => []),
      getSpots: vi.fn(async () => [spot()]),
    }
    const result = await panel.render(
      { ...args, operation: { uuid: 'op', refs: [{ type: 'skcc', ref: 'sks:2026-10' }] } },
      ctx,
    )
    expect(ctx.getSpots).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      kind: 'markdown',
      content: expect.stringContaining('SKS is unassisted'),
    })
    expect(result).toMatchObject({ content: expect.not.stringContaining('Members heard on CW') })
  })
  it('preserves offline totals when live spots fail and explains roster absence', async () => {
    const { prefs, audit } = stores()
    const ctx = {
      online: false,
      getQsos: vi.fn(async () => []),
      getSpots: vi.fn(async () => {
        throw new Error('offline')
      }),
    }
    const result = await createPanel(() => roster, prefs, audit).render(args, ctx)
    expect(result).toMatchObject({ content: expect.stringContaining('Live spots are unavailable') })
    expect(result).toMatchObject({ content: expect.stringContaining('This operation') })
    expect(await createPanel(() => undefined, prefs, audit).render(args, ctx)).toMatchObject({
      content: expect.stringContaining('Download **SKCC member roster**'),
    })
  })
  it('labels saved history as dated and ignores another operator snapshot', async () => {
    const { prefs, audit } = stores()
    await audit.save(
      analyzeAwards([], roster, { scope: 'complete-history', myNumber: '1' }),
      '1',
      'Test import',
    )
    const panel = createPanel(() => roster, prefs, audit),
      ctx = { online: false, getQsos: vi.fn(async () => []) }
    expect(await panel.render(args, ctx)).toMatchObject({
      content: expect.stringContaining('This dated snapshot does not update'),
    })
    await prefs.set('myNumber', '2')
    expect(await panel.render(args, ctx)).toMatchObject({
      content: expect.not.stringContaining('**Imported history:**'),
    })
  })
})

describe('SKCC settings and history actions', () => {
  it('groups settings under Activities with native data management', async () => {
    const { prefs, audit } = stores(),
      hook = createSettings(prefs, () => roster, audit)
    expect(await hook.getPanels()).toEqual([
      {
        key: 'n1rwj-skcc',
        title: 'SKCC Companion',
        icon: 'key',
        section: 'activities',
        dataFilesSection: true,
      },
    ])
    const form = await hook.getDefinition()
    expect(JSON.stringify(form)).toContain('EXP CHASE')
    expect(JSON.stringify(form)).toContain('restartOnChange')
  })
  it('validates values and clears a month-specific bonus when the month changes', async () => {
    const { prefs, audit } = stores(),
      hook = createSettings(prefs, () => roster, audit)
    expect(
      await hook.validateField({
        panelKey: 'n1rwj-skcc',
        state: {},
        fieldKey: 'myNumber',
        value: 'bad',
      }),
    ).toContain('member number')
    expect(
      await hook.validateField({
        panelKey: 'n1rwj-skcc',
        state: {},
        fieldKey: 'spotAgeMinutes',
        value: 0,
      }),
    ).toContain('whole number')
    await prefs.set('bragBonusNumber', '2')
    await hook.onChangeField({
      panelKey: 'n1rwj-skcc',
      state: {},
      fieldKey: 'month',
      value: '2026-11',
    })
    expect(prefs.get().bragBonusNumber).toBe('')
  })
  it('keeps saved history when an import is incomplete, malformed or cancelled', async () => {
    const { prefs, audit } = stores()
    await audit.save(analyzeAwards([], roster, { scope: 'complete-history' }), '1', 'Previous')
    const showForm = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ complete: false, adif: 'bad' })
      .mockResolvedValueOnce({ complete: true, adif: '<CALL:999>K2ABC<EOR>' })
      .mockResolvedValue(null)
    const hook = createSettings(prefs, () => roster, audit, { showForm })
    expect(await hook.analyzeHistory()).toContain('cancelled')
    expect(await hook.analyzeHistory()).toContain('explicit complete-history')
    await hook.analyzeHistory()
    expect(audit.get()?.source).toBe('Previous')
  })
  it('pins an announced bonus to a specific month instead of carrying it into future months', async () => {
    const { prefs, audit } = stores()
    const hook = createSettings(prefs, () => roster, audit)
    await hook.onChangeField({
      panelKey: 'n1rwj-skcc',
      state: {},
      fieldKey: 'bragBonusNumber',
      value: '2',
    })
    expect(prefs.get().month).toBe(new Date().toISOString().slice(0, 7))
    expect(prefs.get().bragBonusNumber).toBe('2')
  })
})
