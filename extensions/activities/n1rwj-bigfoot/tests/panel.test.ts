import assert from 'node:assert/strict'
import type { HookContext, PanelContent, PanelRenderArgs } from '@ham2k/extension-sdk'
import { test, vi } from 'vitest'
import { BigfootPanel } from '../src/panel.ts'
import { EVENT_2026, type Qson } from '../src/rules.ts'

const operation: Qson = { uuid: 'hunt', refs: [{ type: 'bigfoot', ref: '2026' }] }
const ctx = { online: false, locale: 'en' }

function qso(call = 'W7O', overrides: Qson = {}): Qson {
  return {
    uuid: call,
    their: { call },
    band: '20m',
    mode: 'CW',
    startAtMillis: Date.UTC(2026, 9, 19, 23, 58),
    ...overrides,
  }
}

function args(overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return { panelKey: 'hunt', operation, qsoCount: 1, config: {}, reason: 'operation', ...overrides }
}

function markdown(result: PanelContent) {
  assert.equal(result.kind, 'markdown')
  return result.content
}

async function render(qsos: Qson[], overrides: Partial<PanelRenderArgs> = {}) {
  const getQsos = vi.fn(async (_uuid: string) => qsos)
  const result = await BigfootPanel.render(args(overrides), { ...ctx, getQsos })
  assert.equal(result.kind, 'markdown')
  return { ...result, getQsos }
}

test('panel uses operation/log refresh signals without per-keystroke triggers or ticks', async () => {
  const [panel] = await BigfootPanel.getPanels({}, ctx)
  assert.equal(panel.key, 'hunt')
  assert.deepEqual(panel.on, ['operation', 'qsoLogged'])
  assert.equal(panel.form?.[0].key, 'focus')
  assert.equal(panel.form?.[0].value, 'CW')
})

test('default checklist shows CW beside mixed progress and both O contacts as evidence', async () => {
  const result = await render([
    qso(),
    qso('W7O', { uuid: 'second-o', band: '40m', startAtMillis: Date.UTC(2026, 9, 20, 0, 1) }),
    qso('W7B', { mode: 'USB' }),
    qso('W4S'),
  ])
  assert.equal(result.title, 'BIGFOOT Hunt 2026')
  assert.match(result.content, /\*\*CW 2\/7\*\*/)
  assert.match(result.content, /\*\*Mixed 3\/7\*\*/)
  assert.match(result.content, /\| Target \| CW \| Mixed \|/)
  assert.match(result.content, /\| B · W7B \| — \| ✓ \|/)
  assert.match(result.content, /\| O₁ · W7O \| ✓ \| ✓ \|/)
  assert.match(result.content, /\| O₂ · W7O \| ✓ \| ✓ \|/)
  assert.match(result.content, /\| Skunk Ape · W4S \| ✓ \| ✓ \|/)
  assert.match(result.content, /First O:\*\* 2026-10-19 23:58Z · 20m CW/)
  assert.match(result.content, /Second O:\*\* 2026-10-20 00:01Z · 40m CW/)
  assert.match(result.content, /Progress covers this operation only/)
  assert.deepEqual(result.getQsos.mock.calls, [['hunt']])
})

test('a mixed O pair does not falsely fill the second CW O', async () => {
  const result = await render([qso(), qso('W7O', { uuid: 'phone-o', mode: 'SSB' })])
  assert.match(result.content, /\*\*CW 1\/7\*\*/)
  assert.match(result.content, /\*\*Mixed 2\/7\*\*/)
  assert.match(result.content, /Second O:\*\* Still needed/)
  assert.match(result.content, /Mixed-mode O pair:.*20m CW;.*20m SSB/)
})

test('mixed focus has one checklist column and an invalid saved focus falls back to CW', async () => {
  const mixed = await render([qso()], { config: { focus: 'MIXED' } })
  assert.match(mixed.content, /\| Target \| Mixed \|/)
  assert.doesNotMatch(mixed.content, /\| Target \| CW \| Mixed \|/)
  const invalid = await render([qso()], { config: { focus: 'unsupported' } })
  assert.match(invalid.content, /\| Target \| CW \| Mixed \|/)
})

test('rereads the current log after same-count edits and deletions', async () => {
  let qsos = [qso(), qso('W7O', { uuid: 'second-o', band: '40m' })]
  const getQsos = vi.fn(async () => qsos)
  const context: HookContext = { ...ctx, getQsos }
  const first = await BigfootPanel.render(args({ qsoCount: 2 }), context)
  assert.match(markdown(first), /\*\*CW 2\/7\*\*/)
  qsos = [qso(), qso('W7O', { uuid: 'second-o', band: '20m' })]
  const edited = await BigfootPanel.render(args({ qsoCount: 2 }), context)
  assert.match(markdown(edited), /\*\*CW 1\/7\*\*/)
  qsos = [qso('W7O', { deleted: true }), qso('W7O', { uuid: 'second-o', deleted: true })]
  const deleted = await BigfootPanel.render(args({ qsoCount: 2 }), context)
  assert.match(markdown(deleted), /\*\*CW 0\/7\*\*/)
  assert.equal(getQsos.mock.calls.length, 3)
})

test('inactive and unknown editions never read the log or display completion credit', async () => {
  for (const refs of [
    [],
    [{ type: 'potaActivation', ref: 'US-0001' }],
    [{ type: 'bigfoot', ref: '2027' }],
  ]) {
    const result = await render([qso()], { operation: { uuid: 'other', refs } })
    assert.equal(result.getQsos.mock.calls.length, 0)
    assert.doesNotMatch(result.content, /CW 1\/7/)
    assert.match(result.content, /BIGFOOT Hunt 2026/)
  }
})

test('a panel placed outside an operation offers guidance without accessing a log', async () => {
  const getQsos = vi.fn(async () => [qso()])
  const absent = { ...args(), operation: undefined } as unknown as PanelRenderArgs
  const result = await BigfootPanel.render(absent, { ...ctx, getQsos })
  assert.match(markdown(result), /Open a BIGFOOT operation/)
  assert.equal(getQsos.mock.calls.length, 0)
})

test('unavailable logs are distinguished from an empty operation', async () => {
  const noAccess = await BigfootPanel.render(args(), ctx)
  assert.match(markdown(noAccess), /operation log is unavailable/)
  const missing = await BigfootPanel.render(args(), { ...ctx, getQsos: async () => null })
  assert.match(markdown(missing), /operation log is unavailable/)
  const empty = await render([])
  assert.match(empty.content, /\*\*CW 0\/7\*\*/)
  assert.doesNotMatch(empty.content, /unavailable/)
  const getQsos = vi.fn(async () => [])
  await BigfootPanel.render(args({ operation: { refs: operation.refs } }), { ...ctx, getQsos })
  assert.equal(getQsos.mock.calls.length, 0)
})

test('panel excludes unrelated, off-window, deleted and invalid contacts', async () => {
  const result = await render([
    qso('N1RWJ'),
    qso('W7B', { startAtMillis: EVENT_2026.endAtMillis }),
    qso('W7I', { deleted: true }),
    qso('W7G', { band: '6m' }),
    qso('W7F', { mode: 'FM' }),
  ])
  assert.match(result.content, /\*\*Mixed 0\/7\*\*/)
})
