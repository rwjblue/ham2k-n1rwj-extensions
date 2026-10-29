import { host } from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import { bkgEnvironment, bkgPreviewFixtures } from '../../../../scripts/bkg-preview.ts'
import * as model from '../src/model.ts'
import { createPanel } from '../src/panel.ts'
import { args, qso, roster } from './fixtures.ts'

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
  const getRoster = vi.fn(roster)
  const worked = vi.spyOn(model, 'workedMembers')
  const panel = createPanel(getRoster, undefined, async () => 'N0AAA')
  const renderArgs = args({ environment: bkgEnvironment(380, 300), instanceId: 'one' })
  expect((await panel.getPanels({}, { online: false }))[0]?.on).toContain('radio')
  const first = await panel.render(renderArgs, { online: false, getQsos })
  if (first.kind !== 'scene') throw new Error('Expected scene')
  expect(first.scene.values.joiningBand).toBe(1)
  await panel.render({ ...renderArgs, reason: 'qso' }, { online: false, getQsos })
  expect(read).toHaveBeenCalledTimes(2)
  expect(getQsos).toHaveBeenCalledTimes(1)
  read.mockResolvedValue({ ...radio, frequencyHz: 14_050_000 })
  const next = await panel.render({ ...renderArgs, reason: 'radio' }, { online: false, getQsos })
  if (next.kind !== 'scene') throw new Error('Expected scene')
  expect(next.scene.values.joiningBand).toBe(0)
  expect(getQsos).toHaveBeenCalledTimes(1)
  for (const reason of ['visible', 'coalesced']) {
    read.mockResolvedValue(radio)
    const resumed = await panel.render({ ...renderArgs, reason }, { online: false, getQsos })
    if (resumed.kind !== 'scene') throw new Error('Expected scene')
    expect(resumed.scene.values.joiningBand).toBe(1)
    read.mockResolvedValue({ ...radio, status: 'disconnected' })
    const disconnected = await panel.render({ ...renderArgs, reason }, { online: false, getQsos })
    if (disconnected.kind !== 'scene') throw new Error('Expected scene')
    expect(disconnected.scene.values.joiningBand).toBe(0)
  }
  expect(getQsos).toHaveBeenCalledTimes(1)
  expect(worked).toHaveBeenCalledTimes(1)
  getRoster.mockReturnValue({ ...roster(), revision: 'new-roster' })
  await panel.render({ ...renderArgs, reason: 'radio' }, { online: false, getQsos })
  expect(worked).toHaveBeenCalledTimes(2)
  expect(getQsos).toHaveBeenCalledTimes(1)
})

it('invalidates derived progress after an overlapping radio render during a log refresh', async () => {
  let finish!: (qsos: ReturnType<typeof qso>[]) => void
  const getQsos = vi.fn(async () => [] as ReturnType<typeof qso>[])
  const panel = createPanel(roster, undefined, async () => 'N0AAA')
  const ctx = { online: false, getQsos }
  await panel.render(args(), ctx)
  getQsos.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const refresh = panel.render(args({ qsoCount: 1, reason: 'qsoLogged' }), ctx)
  await panel.render(args({ qsoCount: 1, reason: 'radio' }), ctx)
  finish([qso()])
  const fresh = await refresh
  if (fresh.kind !== 'markdown') throw new Error('Expected Markdown')
  expect(fresh.content).toContain('1 distinct BKG members')
  const next = await panel.render(args({ qsoCount: 1, reason: 'qso' }), ctx)
  expect(next).toEqual(fresh)
  expect(getQsos).toHaveBeenCalledTimes(2)
})
