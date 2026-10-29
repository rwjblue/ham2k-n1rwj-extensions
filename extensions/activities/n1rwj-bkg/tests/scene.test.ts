import { host } from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import { bkgEnvironment, bkgPreviewFixtures } from '../../../../scripts/bkg-preview.ts'
import { createPanel } from '../src/panel.ts'
import { args, roster, spot } from './fixtures.ts'

afterEach(() => vi.restoreAllMocks())

it('renders branded scenes in both contexts with all layers inside their panes', async () => {
  const fixtures = await bkgPreviewFixtures()
  expect(fixtures).toHaveLength(6)
  for (const { content, environment, name } of fixtures) {
    expect(content.kind, name).toBe('scene')
    if (content.kind !== 'scene') continue
    expect(content.scene.layers.length).toBeLessThan(128)
    expect(new Set(content.scene.layers.map((layer) => layer.id)).size).toBe(
      content.scene.layers.length,
    )
    expect(content.scene.layers.some((layer) => layer.id === 'fist')).toBe(true)
    for (const layer of content.scene.layers) {
      expect(layer.x, `${name}/${layer.id}`).toBeGreaterThanOrEqual(0)
      expect(layer.y, `${name}/${layer.id}`).toBeGreaterThanOrEqual(0)
      expect(layer.x + layer.width, `${name}/${layer.id}`).toBeLessThanOrEqual(
        environment.width + 0.01,
      )
      expect(layer.y + layer.height, `${name}/${layer.id}`).toBeLessThanOrEqual(
        (layer.fixed ? environment.height : content.scene.height) + 0.01,
      )
    }
  }
})
it('uses accessible Markdown on very small, high-contrast and enlarged-text panes', async () => {
  for (const environment of [
    bkgEnvironment(160, 180),
    { ...bkgEnvironment(), highContrast: true },
    {
      ...bkgEnvironment(),
      typography: {
        ...bkgEnvironment().typography,
        body: { ...bkgEnvironment().typography.body, scaledFontSize: 28 },
      },
    },
  ]) {
    const result = await createPanel(roster, undefined, async () => 'W9HUNT').render(
      args({ environment }),
      { online: false },
    )
    expect(result.kind).toBe('markdown')
  }
})

it('scrolls all cards in short panes and keeps live radio readouts fixed', async () => {
  const environment = bkgEnvironment(380, 300)
  const panel = createPanel(roster, undefined, async () => 'N0AAA')
  const rendered = await panel.render(args({ environment }), { online: false })
  expect(rendered.kind).toBe('scene')
  if (rendered.kind !== 'scene') return
  expect(rendered.scene.height).toBeGreaterThan(environment.height)
  expect(rendered.scene.scroll).toEqual({ axis: 'y', value: 'scrollY' })
  expect(rendered.scene.radio).toEqual({})
  expect(rendered.scene.layers.find((layer) => layer.id === 'freshness')).toBeDefined()
  expect(rendered.scene.layers.find((layer) => layer.id === 'radio-frequency')).toMatchObject({
    fixed: true,
    when: { value: 'radio.connected', is: 1 },
    text: { value: 'radio.frequencyHz' },
  })
})

it('refreshes 2m CW guidance on radio events without rereading the log while typing', async () => {
  const radio = {
    id: 'test',
    name: 'Radio',
    status: 'connected' as const,
    stale: false,
    problem: null,
    frequencyHz: 144_050_000,
    mode: 'CW',
    powerWatts: 5,
    transmitting: false,
    meters: {},
    canTune: false,
  }
  const read = vi.spyOn(host, 'readRadio').mockResolvedValue(radio)
  const getQsos = vi.fn(async () => [])
  const panel = createPanel(roster, undefined, async () => 'N0AAA')
  const renderArgs = args({ environment: bkgEnvironment(380, 300), instanceId: 'one' })
  expect((await panel.getPanels({}, { online: false }))[0]?.on).toContain('radio')
  const first = await panel.render(renderArgs, { online: false, getQsos })
  if (first.kind !== 'scene') throw new Error('Expected scene')
  expect(first.scene.values.joiningBand).toBe(1)
  await panel.render({ ...renderArgs, reason: 'qso' }, { online: false, getQsos })
  expect(read).toHaveBeenCalledTimes(1)
  expect(getQsos).toHaveBeenCalledTimes(1)
  read.mockResolvedValue({ ...radio, frequencyHz: 14_050_000 })
  const next = await panel.render({ ...renderArgs, reason: 'radio' }, { online: false, getQsos })
  if (next.kind !== 'scene') throw new Error('Expected scene')
  expect(next.scene.values.joiningBand).toBe(0)
  expect(getQsos).toHaveBeenCalledTimes(1)
})

it('commits bounded spot spacing per placement and ignores invalid control events', async () => {
  const panel = createPanel(roster, undefined, async () => 'N0AAA')
  const renderArgs = args({ environment: bkgEnvironment(380, 300), instanceId: 'one' })
  const ctx = { online: false, getSpots: async () => [spot('N0AAA'), spot('N0BBB')] }
  const before = await panel.render(renderArgs, ctx)
  if (before.kind !== 'scene' || !panel.onEvent) throw new Error('Expected interactive scene')
  const event = {
    controlId: 'spot-spacing',
    action: 'spot-spacing',
    phase: 'commit' as const,
    sequence: 1,
    value: 2,
  }
  await panel.onEvent({ ...renderArgs, event }, ctx)
  const after = await panel.render({ ...renderArgs, reason: 'event' }, ctx)
  if (after.kind !== 'scene') throw new Error('Expected scene')
  expect(after.scene.height).toBeGreaterThan(before.scene.height)
  for (const value of [NaN, -1, 0])
    await panel.onEvent({ ...renderArgs, event: { ...event, value } }, ctx)
  const retained = await panel.render({ ...renderArgs, reason: 'event' }, ctx)
  expect(retained).toEqual(after)
  const other = await panel.render({ ...renderArgs, instanceId: 'two', reason: 'event' }, ctx)
  if (other.kind !== 'scene') throw new Error('Expected scene')
  expect(other.scene.height).toBe(before.scene.height)
})
