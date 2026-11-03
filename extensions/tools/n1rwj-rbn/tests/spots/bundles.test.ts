import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  DataFileDefinition,
  DynamicSettingsPanel,
  ExportHook,
  ExportOptionsRequest,
  ExtensionDefinition,
  FormDefinition,
  JSONValue,
  RegisterHookParams,
  SpotsHook,
} from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import manifest from '../../manifest.json'
import type { createRbnSpots } from '../../src/spots/index.ts'

type RbnSettings = ReturnType<typeof createRbnSpots>['settings']
type ResetMethod = keyof Omit<RbnSettings, keyof DynamicSettingsPanel>

/** Exercise the built RBN extension through its SDK activation callbacks. */
async function harness(saved: Record<string, JSONValue> = {}) {
  const now = Date.parse('2026-10-02T16:00:00Z')
  const preferences: Record<string, JSONValue> = structuredClone(saved)
  let definition: ExtensionDefinition | undefined
  const registered = new Map<string, RegisterHookParams>()
  const hostCalls = vi.fn()
  const showForm = vi.fn(async (_form: FormDefinition) => null)
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const module = await import(name)
        return [name, name === 'i18next' ? module.default : module]
      }),
    ),
  )
  const requests = vi.fn(async (url: string) => ({
    status: 200,
    body: JSON.stringify({
      spots:
        new URL(url).searchParams.get('band') === '20m' ||
        new URL(url).searchParams.get('spotter') === 'KM3T-5'
          ? ['K1ABC/P', 'W9NEW', 'N2SST'].map((callsign) => ({
              callsign,
              spotter: 'KM3T-5',
              spotter_grid: 'FN42',
              mode: 'CW',
              frequency: 14032,
              wpm: 25,
              timestamp: new Date(now - 60_000).toISOString(),
            }))
          : [],
    }),
  }))
  const context = createContext({
    Date: class extends Date {
      static now() {
        return now
      }
    },
    __polo: {
      sharedModules,
      defineExtension: (extension: ExtensionDefinition) => {
        definition = extension
      },
    },
  })
  runInContext('delete Object.hasOwn', context)
  runInContext(await readFile(new URL('../../build/index.js', import.meta.url), 'utf8'), context, {
    timeout: 5000,
  })
  if (!definition) throw new Error('Missing RBN extension definition')
  definition.onActivation({
    showForm,
    registerHook: (category, hook) => {
      registered.set(category, hook)
    },
    hostCall: async (method, params) => {
      hostCalls(method, params)
      if (method === 'getSettings') return { extensions: preferences }
      if (method === 'setSettings') {
        const key = 'extension_n1rwj-rbn'
        preferences[key] = {
          ...((preferences[key] as Record<string, JSONValue>) ?? {}),
          ...(params.values as Record<string, JSONValue>),
        }
        return null
      }
      if (method === 'kvGet' || method === 'kvSet') return null
      if (method === 'getLocation') return null
      if (method === 'fetch') {
        if (params.url === 'https://vailrerbn.com/api/v1/health')
          return { status: 200, body: '{"status":"ok","database":"connected"}' }
        return requests(String(params.url))
      }
      throw new Error(`Unexpected host call: ${method}`)
    },
  })
  function hook<T>(category: string): T {
    const entry = registered.get(category)
    if (!entry) throw new Error(`Missing RBN ${category} hook`)
    return entry.hook as T
  }
  const spots = hook<SpotsHook>('spots')
  const settings = hook<RbnSettings>('settingsPanel')
  const ctx = { online: true, locale: 'en' }
  // Settle the optional one-shot device-location probe in this locationless host.
  await settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  return {
    definition,
    hostCalls,
    showForm,
    preferences,
    requests,
    registered,
    hook,
    spots,
    settings,
    action: (method: ResetMethod) => settings[method]({ panelKey: 'n1rwj-rbn', state: {} }, ctx),
    fetch: () => spots.fetchSpots({}, ctx),
  }
}

it('bundled RBN recognizes new and already-saved station refs offline without changing contacts', async () => {
  const runtime = await harness({
    'extension_n1rwj-rbn': { unrelated: 42, spotAllowMerging: false },
  })
  const activity = runtime.hook<ActivityHook>('activity')
  expect(runtime.definition.hooks).toContain('activity')
  expect(activity.operationControls).toBeUndefined()
  expect(activity.suggest).toBeUndefined()
  expect(activity.processQsoBeforeSave).toBeUndefined()
  expect(runtime.registered.has('export')).toBe(true)
  for (const category of ['adifFields', 'adifImport']) {
    expect(runtime.registered.has(category)).toBe(false)
  }
  const args: Parameters<NonNullable<ActivityHook['loggingControls']>>[0][] = [
    { operation: {} },
    {
      operation: { uuid: 'saved-operation', refs: [{ type: 'cwt', ref: '20260930T1300' }] },
      qso: {
        uuid: 'saved-qso',
        our: { call: 'N1RWJ' },
        their: { call: 'K1ABC/P' },
        freq: 14032,
        band: '20m',
        mode: 'CW',
        refs: [
          { type: 'rbn', ref: 'K1ABC/P' },
          { type: 'rbn', ref: 'W9NEW' },
          { type: 'cwt', ref: '20260930T1300', theirName: 'Al', theirNumber: '1234' },
        ],
      },
    },
  ]
  const originalArgs = structuredClone(args)
  const preferences = structuredClone(runtime.preferences)
  const requestCount = runtime.requests.mock.calls.length
  const hostCallCount = runtime.hostCalls.mock.calls.length
  const getQsos = vi.fn(async () => {
    throw new Error('Logging controls must not read the full log')
  })
  for (const input of args) {
    expect(
      await activity.loggingControls?.(input, { online: false, locale: 'en', getQsos }),
    ).toEqual([
      {
        key: 'n1rwj-rbn/station',
        label: 'RBN',
        icon: 'radar',
        input: { kind: 'refList', refType: 'rbn' },
      },
    ])
  }
  expect(args).toEqual(originalArgs)
  expect(runtime.preferences).toEqual(preferences)
  expect(runtime.requests).toHaveBeenCalledTimes(requestCount)
  expect(runtime.hostCalls).toHaveBeenCalledTimes(hostCallCount + args.length)
  expect(getQsos).not.toHaveBeenCalled()
})

it('defaults to merging without an activity and toggles cached spots across restarts', async () => {
  const runtime = await harness()
  const ctx = { online: false }
  expect(await runtime.settings.getPanels?.({}, ctx)).toEqual([
    { key: 'n1rwj-rbn', title: 'RBN', icon: 'radar', section: 'spotting', sidebar: false },
  ])
  expect(manifest.settings).toEqual({ section: 'spotting' })
  expect(runtime.definition).toMatchObject({
    settings: manifest.settings,
  })
  const builtManifest = JSON.parse(
    await readFile(new URL('../../build/manifest.json', import.meta.url), 'utf8'),
  )
  expect(builtManifest.settings).toEqual(manifest.settings)
  const activity = runtime.hook<ActivityHook>('activity')
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)
  expect(form.elements).toContainEqual(
    expect.objectContaining({
      key: 'spotAllowMerging',
      fieldType: 'checkbox',
      value: true,
    }),
  )
  const first = await runtime.fetch()
  expect(first).toHaveLength(3)
  expect(first.every((spot) => spot.refs?.length === 0)).toBe(true)
  const requests = runtime.requests.mock.calls.length
  const edit = (value: JSONValue) =>
    runtime.settings.onChangeField(
      { panelKey: 'n1rwj-rbn', fieldKey: 'spotAllowMerging', value, state: {} },
      ctx,
    )
  await expect(edit('false')).rejects.toThrow('merging')
  await edit(false)
  const separate = await runtime.fetch()
  expect(separate.map((spot) => spot.refs)).toEqual(
    separate.map((spot) => [{ type: 'rbn', ref: spot.their.call }]),
  )
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toHaveLength(1)
  const restarted = await harness(runtime.preferences)
  expect((await restarted.fetch()).map((spot) => spot.refs)).toEqual(
    separate.map((spot) => spot.refs),
  )
  expect(
    await restarted.hook<ActivityHook>('activity').loggingControls?.({ operation: {} }, ctx),
  ).toHaveLength(1)
  await edit(true)
  expect(await runtime.fetch()).toEqual(first)
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
  expect(runtime.requests).toHaveBeenCalledTimes(requests)
  await edit(false)
  await runtime.action('resetAllSpotSettings')
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
})

it('opens RBN guidance separately from grouped controls without changing settings or requesting data', async () => {
  const runtime = await harness({
    'extension_n1rwj-rbn': { spotMinWpm: 12, additionalExportFormats: ['json'], unrelated: 42 },
  })
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: false })
  expect(form.elements[form.elements.length - 1]).toMatchObject({
    type: 'action',
    style: 'row',
    label: 'About RBN',
    method: 'showAbout',
  })
  expect(form.elements).toContainEqual(expect.objectContaining({ key: 'spotMinWpm', value: 12 }))
  expect(form.elements).toContainEqual(
    expect.objectContaining({ key: 'additionalExportFormats', value: ['json'] }),
  )
  expect(JSON.stringify(form)).not.toContain('The My Signal map and receiver reports')
  expect(JSON.stringify(form)).not.toContain('Reports cover the last ten minutes')
  const saved = structuredClone(runtime.preferences)
  const requests = runtime.requests.mock.calls.length
  runtime.hostCalls.mockClear()
  expect(runtime.showForm).not.toHaveBeenCalled()
  await expect(runtime.settings.showAbout({}, { online: false })).resolves.toBeNull()
  expect(runtime.showForm).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ title: 'About RBN' }),
    {},
  )
  const about = runtime.showForm.mock.calls[0]?.[0]
  expect(about?.elements.every((element) => !['field', 'action'].includes(element.type))).toBe(true)
  expect(JSON.stringify(about)).toContain('Spots filters never affect My Signal')
  expect(JSON.stringify(about)).toContain('Reports cover the last ten minutes')
  expect(JSON.stringify(about)).toContain('directory metadata only when their nodes agree')
  expect(runtime.preferences).toEqual(saved)
  expect(runtime.hostCalls).not.toHaveBeenCalled()
  expect(runtime.requests).toHaveBeenCalledTimes(requests)
})

it('offers one bundled reception report by default and persists only opted-in companions', async () => {
  const runtime = await harness({ 'extension_n1rwj-rbn': { unrelated: 42 } })
  const ctx = { online: false }
  const args: ExportOptionsRequest = {
    operation: { uuid: 'activation', stationCall: 'N1RWJ', grid: 'FN42' },
    qsos: [
      {
        uuid: 'contact',
        startAtMillis: Date.parse('2026-10-02T15:55:00Z'),
        our: { call: 'N1RWJ' },
        their: { call: 'K1ABC', grid: 'FN41' },
        band: '20m',
        mode: 'CW',
      },
    ],
  }
  const exporter = runtime.hook<ExportHook>('export')
  const options = () => exporter.suggestExportOptions?.(args, ctx)
  const edit = (value: JSONValue) =>
    runtime.settings.onChangeField(
      { panelKey: 'n1rwj-rbn', fieldKey: 'additionalExportFormats', value, state: {} },
      ctx,
    )
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)
  expect(form.elements).toContainEqual(
    expect.objectContaining({
      key: 'additionalExportFormats',
      fieldType: 'multiselect',
      value: [],
      defaultValue: [],
      options: expect.arrayContaining([expect.objectContaining({ value: 'json' })]),
    }),
  )
  expect((await options())?.map((option) => option.format)).toEqual(['html'])
  await edit(['json'])
  expect((await options())?.map((option) => option.format)).toEqual(['html', 'json'])
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({
    unrelated: 42,
    additionalExportFormats: ['json'],
  })
  const restarted = await harness(runtime.preferences)
  expect(
    (await restarted.hook<ExportHook>('export').suggestExportOptions?.(args, ctx))?.map(
      (option) => option.format,
    ),
  ).toEqual(['html', 'json'])
  await runtime.action('resetAllSpotSettings')
  expect((await options())?.map((option) => option.format)).toEqual(['html', 'json'])
  await edit([])
  expect((await options())?.map((option) => option.format)).toEqual(['html'])
  expect(runtime.preferences['extension_n1rwj-rbn']).toMatchObject({
    unrelated: 42,
    additionalExportFormats: [],
  })
  const definitions = (await exporter.getExportTypes?.({}, ctx)) ?? []
  expect(definitions.map((definition) => definition.format)).toEqual([
    'html',
    'md',
    'csv',
    'json',
    'svg',
    'qso.csv',
  ])
  for (const definition of definitions) {
    expect(
      await exporter.generateExport({ ...args, exportType: definition.exportType }, ctx),
    ).toMatchObject({ content: expect.any(String), filename: expect.any(String) })
  }
  expect(runtime.requests).not.toHaveBeenCalled()
})

it('rejects invalid companion-file preferences without changing bundled settings', async () => {
  const runtime = await harness({ 'extension_n1rwj-rbn': { unrelated: 42 } })
  const ctx = { online: false }
  for (const value of ['json', ['zip'], ['html'], ['json', 42], null]) {
    const args = {
      panelKey: 'n1rwj-rbn',
      fieldKey: 'additionalExportFormats',
      value,
      state: {},
    }
    expect(await runtime.settings.validateField?.(args, ctx)).toContain('export files')
    await expect(runtime.settings.onChangeField(args, ctx)).rejects.toThrow('export files')
  }
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({ unrelated: 42 })
})

it('ignores a saved station filter while keeping the receiver filters and settings intact', async () => {
  const saved = {
    spotCallFilter: 'n1rwj-cwt',
    spotMode: 'CW',
    spotSkimmers: 'KM3T-5',
    spotMinWpm: 25,
  }
  const runtime = await harness({ 'extension_n1rwj-rbn': saved })
  expect(runtime.spots.sourceName).toBe('RBN')
  const [first, second] = await Promise.all([runtime.fetch(), runtime.fetch()])
  expect(first.map((spot) => spot.their.call)).toEqual(['K1ABC/P', 'W9NEW', 'N2SST'])
  expect(second).toEqual(first)
  expect(runtime.requests).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining('mode=CW&spotter=KM3T-5'),
  )
  const ctx = { online: true }
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)
  expect(form.elements).not.toContainEqual(expect.objectContaining({ key: 'spotCallFilter' }))
  expect(form.elements).not.toContainEqual(
    expect.objectContaining({ method: 'resetSpotCallFilter' }),
  )
  expect(form.elements).toContainEqual(
    expect.objectContaining({ key: 'spotSkimmers', value: 'KM3T-5' }),
  )
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual(saved)
  await runtime.settings.onChangeField(
    { panelKey: 'n1rwj-rbn', fieldKey: 'spotMinWpm', value: 26, state: {} },
    ctx,
  )
  const restarted = await harness(runtime.preferences)
  expect(await restarted.fetch()).toEqual([])
  expect(restarted.preferences['extension_n1rwj-rbn']).toEqual({ ...saved, spotMinWpm: 26 })
})

it('bundled RBN gives calls on one frequency distinct stable references when merging is disabled', async () => {
  const runtime = await harness({ 'extension_n1rwj-rbn': { spotAllowMerging: false } })
  const first = await runtime.fetch()
  expect(first.map((spot) => spot.freq)).toEqual([14032, 14032, 14032])
  expect(first).toEqual(
    expect.arrayContaining(
      ['K1ABC/P', 'W9NEW', 'N2SST'].map((call) =>
        expect.objectContaining({ their: { call }, refs: [{ type: 'rbn', ref: call }] }),
      ),
    ),
  )
  expect(first.every((spot) => spot.spot.label === undefined)).toBe(true)
  const requests = runtime.requests.mock.calls.length
  expect(await runtime.fetch()).toEqual(first)
  expect(await runtime.spots.fetchSpots({}, { online: false, locale: 'en' })).toEqual(first)
  expect(runtime.requests).toHaveBeenCalledTimes(requests)
})

it('persists geography settings, needs directory continents, and rejects stale origin edits', async () => {
  const runtime = await harness()
  const edit = (fieldKey: string, value: JSONValue) =>
    runtime.settings.onChangeField(
      { panelKey: 'n1rwj-rbn', fieldKey, value, state: {} },
      { online: true },
    )
  await expect(edit('spotRadiusMiles', 100)).rejects.toThrow('origin')
  await edit('spotRadiusGrid', ' fn42 ')
  await edit('spotRadiusMiles', '100')
  await edit('spotContinents', ['NA', 'NA'])
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({
    spotRadiusGrid: 'FN42',
    spotRadiusMiles: 100,
    spotContinents: ['NA'],
    spotLastContinents: ['NA'],
  })
  const restored = await harness(runtime.preferences)
  expect(await restored.fetch()).toEqual([]) // Unknown continent is excluded.
  restored.hook<DataFileDefinition>('dataFile').onLoadRawData?.({
    schema: 1,
    nodes: [{ call: 'KM3T-5', grid: 'FN42', country: 'United States', continent: 'NA' }],
  })
  expect(await restored.fetch()).toHaveLength(3)
  const form = await restored.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
  expect(form.elements).toContainEqual(
    expect.objectContaining({ key: 'spotContinents', fieldType: 'multiselect', value: ['NA'] }),
  )
  expect(form.elements).toContainEqual(
    expect.objectContaining({ key: 'spotRadiusMiles', value: 100 }),
  )
  await expect(edit('spotRadiusGrid', '')).rejects.toThrow('origin')
  await edit('spotRadiusMiles', '')
  await edit('spotRadiusGrid', '')
  await edit('spotContinents', [])
  expect(await runtime.fetch()).toHaveLength(3)
  // Form state can be stale: queue revalidation prevents concurrent writes
  // from leaving an enabled radius with a cleared origin.
  await edit('spotRadiusGrid', 'FN42')
  const results = await Promise.allSettled([
    edit('spotRadiusMiles', 10),
    edit('spotRadiusGrid', ''),
  ])
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
})

it('persists CW speed bounds across bundle restarts and rejects stale crossing edits', async () => {
  const runtime = await harness()
  const edit = (fieldKey: string, value: JSONValue) =>
    runtime.settings.onChangeField(
      { panelKey: 'n1rwj-rbn', fieldKey, value, state: {} },
      { online: true },
    )
  await edit('spotMinWpm', '20')
  await edit('spotMaxWpm', '24')
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({ spotMinWpm: 20, spotMaxWpm: 24 })
  expect(await runtime.fetch()).toEqual([])
  expect(await (await harness(runtime.preferences)).fetch()).toEqual([])
  await expect(edit('spotMinWpm', 30)).rejects.toThrow('Minimum')
  await edit('spotMaxWpm', '')
  expect(await runtime.fetch()).toHaveLength(3)
  const results = await Promise.allSettled([edit('spotMaxWpm', 25), edit('spotMinWpm', 26)])
  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
})

it('resets all spot settings in the bundle while preserving reception caches and unrelated values', async () => {
  const runtime = await harness({
    'extension_n1rwj-rbn': {
      spotCallFilter: 'n1rwj-cwt',
      spotMode: 'CW',
      spotMinWpm: 30,
      spotMaxWpm: 20, // Reset repairs inconsistent saved pairs.
      spotSkimmers: 'KM3T-5',
      spotGrids: 'FN',
      spotContinents: ['NA'], // A preference from before continent memory existed.
      spotRadiusGrid: '',
      spotRadiusMiles: 100,
      receptionCache: { marker: 'preserve' },
      additionalExportFormats: ['json'],
      unrelated: 42,
    },
  })
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
  const heading = form.elements.findIndex(
    (element) => element.type === 'header' && element.title === 'Spots — Who I might hear',
  )
  expect(form.elements[heading + 1]).toMatchObject({
    type: 'action',
    method: 'resetAllSpotSettings',
  })
  expect(form.elements).toContainEqual(
    expect.objectContaining({
      method: 'resetSpotContinents',
      label: 'Reset continents — North America',
    }),
  )
  await runtime.action('resetAllSpotSettings')
  const expected = {
    spotCallFilter: 'n1rwj-cwt',
    spotAllowMerging: true,
    spotMode: 'all',
    spotMinWpm: '',
    spotMaxWpm: '',
    spotSkimmers: '',
    spotGrids: '',
    spotContinents: ['NA'],
    spotLastContinents: ['NA'],
    spotRadiusGrid: '',
    spotRadiusMiles: '',
    receptionCache: { marker: 'preserve' },
    additionalExportFormats: ['json'],
    unrelated: 42,
  }
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual(expected)
  expect((await harness(runtime.preferences)).preferences['extension_n1rwj-rbn']).toEqual(expected)
})

it('each bundled reset changes only its filter and displays the persisted defaults', async () => {
  const saved = {
    spotCallFilter: 'missing',
    spotMode: 'CW',
    spotMinWpm: 10,
    spotMaxWpm: 20,
    spotSkimmers: 'KM3T-5',
    spotGrids: 'FN',
    spotContinents: ['EU'],
    spotLastContinents: ['NA'],
    spotRadiusGrid: 'FN42',
    spotRadiusMiles: 100,
  }
  const cases: [ResetMethod, Record<string, JSONValue>][] = [
    ['resetSpotMode', { spotMode: 'all' }],
    ['resetSpotSpeed', { spotMinWpm: '', spotMaxWpm: '' }],
    ['resetSpotSkimmers', { spotSkimmers: '' }],
    ['resetSpotGrids', { spotGrids: '' }],
    ['resetSpotContinents', { spotContinents: ['NA'], spotLastContinents: ['NA'] }],
    ['clearSpotContinents', { spotContinents: [], spotLastContinents: ['EU'] }],
    ['resetSpotDistance', { spotRadiusGrid: '', spotRadiusMiles: '' }],
  ]
  for (const [method, patch] of cases) {
    const runtime = await harness({ 'extension_n1rwj-rbn': saved })
    const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
    expect(form.elements).toContainEqual(expect.objectContaining({ type: 'action', method }))
    await runtime.action(method)
    expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({ ...saved, ...patch })
    const updated = await runtime.settings.getDefinition(
      { panelKey: 'n1rwj-rbn' },
      { online: true },
    )
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'spotLastContinents') continue
      expect(updated.elements).toContainEqual(
        expect.objectContaining({ type: 'field', key, value }),
      )
    }
  }
})

it('clears and restores a legacy continent preference without reviving it after explicit clearing', async () => {
  const runtime = await harness({ 'extension_n1rwj-rbn': { spotContinents: ['NA'] } })
  await runtime.action('clearSpotContinents')
  const restarted = await harness(runtime.preferences)
  expect(restarted.preferences['extension_n1rwj-rbn']).toMatchObject({
    spotContinents: [],
    spotLastContinents: ['NA'],
  })
  await restarted.action('resetSpotContinents')
  expect(restarted.preferences['extension_n1rwj-rbn']).toMatchObject({ spotContinents: ['NA'] })
})
