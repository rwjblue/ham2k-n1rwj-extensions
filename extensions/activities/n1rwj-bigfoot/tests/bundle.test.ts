import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  ExportHook,
  ExtensionDefinition,
  HookContext,
  LookupHook,
  PanelHook,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import type { CallFilterHook } from '../../../../packages/spot-filters/src/index.ts'
import { bigfootPreviewEnvironment } from '../../../../scripts/bigfoot-preview.ts'
import manifest from '../manifest.json'

it('runs the complete hunt in the bundled sandbox with no network or storage adapters', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  const definitions: ExtensionDefinition[] = []
  const registered = new Map<string, RegisterHookParams>()
  runInContext(
    source,
    createContext({
      __polo: {
        sharedModules,
        defineExtension: (value: ExtensionDefinition) => definitions.push(value),
      },
    }),
    { timeout: 5000 },
  )
  expect(definitions).toHaveLength(1)
  const radioCalls: { method: string; params: unknown }[] = []
  let radioConnected = true
  definitions[0]?.onActivation({
    registerHook: (category, hook) => registered.set(category, hook),
    hostCall: async (method, params) => {
      if (method === 'readRadio')
        return {
          id: 'test-radio',
          status: radioConnected ? 'connected' : 'disconnected',
          stale: false,
          problem: null,
          frequencyHz: 14000000,
          mode: 'CW',
          transmitting: false,
          canTune: true,
          modes: ['CW'],
        }
      if (method === 'setRadio') {
        radioCalls.push({ method, params })
        return { accepted: true, state: null }
      }
      throw new Error(`Unexpected host call: ${method}`)
    },
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect(manifest.domains).toEqual([])
  const operation = {
    uuid: 'hunt',
    createdAtMillis: Date.UTC(2026, 9, 19),
    stationCall: 'N1RWJ',
    refs: [{ type: 'bigfoot', ref: '2026' }],
  }
  const qsos = ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7O', 'W7T', 'W4S'].map((call, index) => ({
    uuid: `qso-${index}`,
    their: { call, sent: '599' },
    our: { sent: '599' },
    band: index === 5 ? '40m' : '20m',
    mode: 'CW',
    startAtMillis: Date.UTC(2026, 9, 19, 22, index),
  }))
  let reads = 0
  const ctx: HookContext = {
    online: false,
    getQsos: async () => {
      reads += 1
      return qsos
    },
  }
  const activity = registered.get('activity')?.hook as ActivityHook
  expect(await activity.suggest?.({ operation, searchTerm: 'BIGFOOT' }, ctx)).toMatchObject([
    { type: 'bigfoot', ref: '2026' },
  ])
  const scoring = registered.get('scoring')?.hook as ScoringHook
  const lookup = registered.get('lookup')?.hook as LookupHook
  const filter = registered.get('spotCallFilter:v1')?.hook as CallFilterHook
  const descriptor = await filter.describe({}, ctx)
  expect(descriptor).toMatchObject({
    label: 'BIGFOOT 2026',
    available: true,
    defaultSelected: false,
  })
  expect(
    await filter.matchCalls({ version: 1, calls: ['W7B', 'W7O', 'W4S', 'W3S', 'W1AW'] }, ctx),
  ).toMatchObject({ calls: ['W7B', 'W7O', 'W4S'] })
  // Native lookup omits uuid; station markers need no operation log access.
  const { uuid: _uuid, ...operationData } = operation
  await scoring.scoreQsos({ operation, qsos: [qsos[4]], checkpointKey: 'one-o' }, ctx)
  const candidate = { ...qsos[4], uuid: 'candidate', band: '40m' }
  const args = { operation: operationData, qso: candidate, callInfo: { call: 'W7O' } }
  expect(await lookup.lookupCall(args, ctx)).toMatchObject([
    { call: 'W7O', emoji: '🐾', note: '🐾 BIGFOOT 2026: O (two contacts)' },
  ])
  const notes = (await lookup.lookupCall(args, ctx)).flatMap((result) => result.notes ?? [])
  expect(notes).toContain('🌲🐾 **BIGFOOT Hunt 2026** 🐾🌲')
  expect(notes).toContain('⭕ **O + O — W7O** · Two qualifying contacts fill the two O slots.')
  const spots = await scoring.scoreCandidates?.(
    {
      operation,
      resumeKey: 'one-o',
      candidates: [
        { key: 'needed', qso: candidate },
        { key: 'repeat', qso: { ...candidate, band: '20m' } },
        { key: 'unrelated', qso: { ...candidate, their: { call: 'W1AW' } } },
      ],
    },
    ctx,
  )
  expect(spots?.needed.notices).toContain('newMult')
  expect(spots?.repeat.dupe).toBe(true)
  expect(spots?.repeat.notices).not.toContain('newMult')
  expect(spots?.unrelated.notices).not.toContain('newMult')
  expect(reads).toBe(0)
  const result = await scoring.scoreQsos({ operation, qsos, checkpointKey: 'complete' }, ctx)
  expect(result.operationSummary.bigfoot?.total).toBe(7)
  expect(result.operationSummary.bigfoot?.longSummary).toContain('CW 7/7')
  expect(result.operationSummary.bigfoot?.longSummary).toContain('🎉🐾 **CW BIGFOOT complete!** 🏆')
  expect(result.operationSummary.bigfoot?.longSummary).toContain(
    '🦨 **Skunk Ape bonus (W4S)** · CW: ✅ worked · Mixed: ✅ worked',
  )
  const complete = await scoring.scoreCandidates?.(
    {
      operation,
      resumeKey: 'complete',
      candidates: [{ key: 'o', qso: { ...candidate, band: '30m' } }],
    },
    ctx,
  )
  expect(complete?.o.notices).not.toContain('newMult')
  expect(reads).toBe(0)
  const panel = registered.get('panel')?.hook as PanelHook
  const [catalogEntry] = await panel.getPanels({}, ctx)
  expect(catalogEntry.key).toBe('hunt')
  expect(catalogEntry.preview).toMatch(/^<svg\b/)
  expect(catalogEntry.description).toContain('🌲🐾')
  expect(reads).toBe(0)
  const content = await panel.render(
    { panelKey: 'hunt', operation, qsoCount: 8, config: {}, reason: 'operation' },
    ctx,
  )
  expect(content.kind).toBe('markdown')
  if (content.kind !== 'markdown') throw new Error('Expected Markdown')
  expect(content.content).toContain('CW BIGFOOT complete!')
  expect(content.content).toContain('40m CW')
  const sceneArgs = {
    panelKey: 'hunt',
    instanceId: 'bundled-forest',
    operation,
    qsoCount: qsos.length,
    config: {},
    environment: bigfootPreviewEnvironment(),
    clock: { nowMillis: 100_000, realNowMillis: 100_000 },
    reason: 'initial',
  }
  const forest = await panel.render(sceneArgs, ctx)
  expect(forest).toMatchObject({ kind: 'svgScene', title: 'BIGFOOT Hunt · CW 7/7', triggers: [] })
  if (forest.kind !== 'svgScene') throw new Error('Expected the bundled native scene')
  expect(forest.scene.layers.find((layer) => layer.id === 'bigfoot')?.svg).toContain('<svg')
  expect(forest.scene.values).toMatchObject({ hop: 0, bonus: 1 })
  expect(forest.scene.strings).toBeUndefined()
  expect(forest.scene.controls?.every((control) => control.kind === 'button')).toBe(true)
  expect(
    await panel.onEvent?.(
      {
        ...sceneArgs,
        event: { action: 'wave', controlId: 'wave', phase: 'activate', sequence: 1 },
      },
      ctx,
    ),
  ).toMatchObject({ values: { hop: 1, wave: 1 } })
  const greeting = await panel.render({ ...sceneArgs, reason: 'event' }, ctx)
  expect(greeting).toMatchObject({ kind: 'svgScene', triggers: ['tick:1'] })
  const readsBeforeTick = reads
  expect(
    await panel.render(
      { ...sceneArgs, reason: 'tick', clock: { nowMillis: 104_000, realNowMillis: 104_000 } },
      ctx,
    ),
  ).toMatchObject({ kind: 'svgScene', triggers: [], scene: { values: { hop: 0 } } })
  expect(reads).toBe(readsBeforeTick)
  const at = Date.UTC(2026, 9, 19, 23)
  const boardContext: HookContext = {
    online: false,
    getQsos: async () => [qsos[4]],
    getSpots: async (options) => {
      expect(options).toEqual({ filter: 'user', maxAgeMinutes: 15, annotate: false })
      return [
        {
          their: { call: 'W7O' },
          band: '20m',
          freq: 14050,
          mode: 'CW',
          spot: { source: 'RBN', timeInMillis: at - 120_000 },
        },
        {
          their: { call: 'W7O,W7B' },
          band: '40m',
          freq: 7050,
          mode: 'CW',
          spot: { source: 'RBN', timeInMillis: at - 60_000 },
        },
      ]
    },
  }
  expect((await panel.getPanels({}, boardContext)).map(({ key }) => key)).toEqual(['hunt'])
  const board = await panel.render(
    {
      panelKey: 'hunt',
      instanceId: 'bundled-spots',
      operation,
      qsoCount: 1,
      config: {},
      reason: 'initial',
      clock: { nowMillis: at, realNowMillis: at },
    },
    boardContext,
  )
  expect(board).toMatchObject({
    kind: 'markdown',
    triggers: ['tick:60'],
    title: 'BIGFOOT Hunt 2026',
  })
  if (board.kind !== 'markdown') throw new Error('Expected bundled spots Markdown')
  expect(board.content).toContain('**W7O**')
  expect(board.content).toContain('**W7B** · 7050.0 kHz · 40m CW · Needed')
  expect(board.content).toContain('7050.0 kHz')
  expect(board.content).not.toContain('14050.0 kHz')
  const spotSceneArgs = {
    ...sceneArgs,
    instanceId: 'bundled-spot-forest',
    clock: { nowMillis: at, realNowMillis: at },
  }
  const integrated = await panel.render(spotSceneArgs, boardContext)
  expect(integrated.kind).toBe('svgScene')
  expect(radioCalls).toEqual([])
  await panel.onEvent?.(
    {
      ...spotSceneArgs,
      event: { action: 'spot:W7O', controlId: 'spot-W7O', phase: 'activate', sequence: 1 },
    },
    boardContext,
  )
  expect(radioCalls).toEqual([
    {
      method: 'setRadio',
      params: {
        id: 'test-radio',
        frequencyHz: 7050000,
        mode: 'CW',
      },
    },
  ])
  // The displayed ready snapshot cannot authorize a write after CAT drops.
  radioConnected = false
  await panel.onEvent?.(
    {
      ...spotSceneArgs,
      event: { action: 'tune-spot', controlId: 'tune-spot', phase: 'activate', sequence: 2 },
    },
    boardContext,
  )
  expect(radioCalls).toHaveLength(1)
  const manual = await panel.render({ ...spotSceneArgs, reason: 'event' }, boardContext)
  if (manual.kind !== 'svgScene') throw new Error('Expected the disconnected forest')
  expect(manual.scene.layers.some((layer) => layer.text?.literal === 'Manual tuning')).toBe(true)
  expect(manual.scene.controls?.some((control) => control.event === 'tune-spot')).toBe(false)
  const exporter = registered.get('export')?.hook as ExportHook
  const worksheet = await exporter.generateExport(
    { operation, qsos, exportType: 'bigfoot-csv' },
    ctx,
  )
  expect(worksheet.content).toContain('"O2","O2"')
  expect(worksheet.content).toContain('"Skunk Ape","Skunk Ape"')
  expect(worksheet.content.split('\r\n')).toHaveLength(10)
})
