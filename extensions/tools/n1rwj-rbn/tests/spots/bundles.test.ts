import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  DataFileDefinition,
  DynamicSettingsPanel,
  ExtensionDefinition,
  JSONValue,
  RegisterHookParams,
  SpotsHook,
} from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import manifest from '../../manifest.json'
import type { createRbnSpots } from '../../src/spots/index.ts'

type RbnSettings = ReturnType<typeof createRbnSpots>['settings']
type ResetMethod = keyof Omit<RbnSettings, keyof DynamicSettingsPanel>

/** Actual bundles, separate SDK copies, the documented kernel dispatch boundary. */
async function harness(saved: Record<string, JSONValue> = {}, contests = ['cwt', 'mst', 'sst']) {
  const now = Date.parse('2026-10-02T16:00:00Z')
  const preferences: Record<string, JSONValue> = structuredClone(saved)
  const definitions: ExtensionDefinition[] = []
  const registered = new Map<string, Map<string, RegisterHookParams>>()
  const hostCalls = vi.fn()
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
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
      invokeLocal: async (
        category: string,
        method: string,
        args: unknown,
        online: boolean,
        key?: string,
      ) => {
        const results = []
        for (const [extension, categories] of registered) {
          const registration = categories.get(category)
          if (!registration || (key && key !== (registration.key ?? extension))) continue
          const hookKey = registration.key ?? extension
          try {
            const hook = registration.hook as Record<
              string,
              (args: unknown, ctx: unknown) => unknown
            >
            results.push({
              key: hookKey,
              ok: true,
              value: await hook[method](args, { online, locale: 'en' }),
            })
          } catch (error) {
            results.push({ key: hookKey, ok: false, error: String(error) })
          }
        }
        return results
      },
    },
  })
  runInContext('delete Object.hasOwn', context)
  for (const path of ['tools/n1rwj-rbn', ...contests.map((name) => `contests/n1rwj-${name}`)]) {
    runInContext(
      await readFile(new URL(`../../../../${path}/build/index.js`, import.meta.url), 'utf8'),
      context,
      { timeout: 5000 },
    )
  }
  for (const definition of definitions) {
    const categories = new Map<string, RegisterHookParams>()
    registered.set(definition.key, categories)
    definition.onActivation({
      registerHook: (category, hook) => {
        categories.set(category, hook)
      },
      hostCall: async (method, params) => {
        hostCalls(method, params)
        if (method === 'getSettings') return { extensions: preferences }
        if (method === 'setSettings') {
          const key = `extension_${definition.key}`
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
  }
  function hook<T>(key: string, category: string): T {
    const entry = registered.get(key)?.get(category)
    if (!entry) throw new Error(`Missing ${category} from ${key}`)
    return entry.hook as T
  }
  const spots = hook<SpotsHook>('n1rwj-rbn', 'spots')
  const settings = hook<RbnSettings>('n1rwj-rbn', 'settingsPanel')
  const ctx = { online: true, locale: 'en' }
  // Settle the optional one-shot device-location probe in this locationless host.
  await settings.getDefinition({ panelKey: 'n1rwj-rbn' }, ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  return {
    definitions,
    hostCalls,
    preferences,
    requests,
    registered,
    hook,
    spots,
    settings,
    action: (method: ResetMethod) => settings[method]({ panelKey: 'n1rwj-rbn', state: {} }, ctx),
    fetch: () => spots.fetchSpots({}, ctx),
    choose: (value: string) =>
      settings.onChangeField(
        { panelKey: 'n1rwj-rbn', fieldKey: 'spotCallFilter', value, state: {} },
        ctx,
      ),
    load: (contest: string, body: string) =>
      hook<DataFileDefinition>(`n1rwj-${contest}`, 'dataFile').onLoadRawData?.({
        schema: 1,
        body,
        url: 'https://n1mm.hamdocs.com/history.txt',
        fetchedAt: new Date().toISOString(),
      }),
  }
}

it('bundled RBN recognizes new and already-saved station refs offline without changing contacts', async () => {
  const runtime = await harness(
    { 'extension_n1rwj-rbn': { unrelated: 42, spotAllowMerging: false } },
    [],
  )
  const activity = runtime.hook<ActivityHook>('n1rwj-rbn', 'activity')
  expect(runtime.definitions[0].hooks).toContain('activity')
  expect(activity.operationControls).toBeUndefined()
  expect(activity.suggest).toBeUndefined()
  expect(activity.processQsoBeforeSave).toBeUndefined()
  expect(runtime.registered.get('n1rwj-rbn')?.has('export')).toBe(true)
  for (const category of ['adifFields', 'adifImport']) {
    expect(runtime.registered.get('n1rwj-rbn')?.has(category)).toBe(false)
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
  const runtime = await harness({}, [])
  const ctx = { online: false }
  const activity = runtime.hook<ActivityHook>('n1rwj-rbn', 'activity')
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
  const restarted = await harness(runtime.preferences, [])
  expect((await restarted.fetch()).map((spot) => spot.refs)).toEqual(
    separate.map((spot) => spot.refs),
  )
  expect(
    await restarted
      .hook<ActivityHook>('n1rwj-rbn', 'activity')
      .loggingControls?.({ operation: {} }, ctx),
  ).toHaveLength(1)
  await edit(true)
  expect(await runtime.fetch()).toEqual(first)
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
  expect(runtime.requests).toHaveBeenCalledTimes(requests)
  await edit(false)
  await runtime.action('resetAllSpotSettings')
  expect(await activity.loggingControls?.({ operation: {} }, ctx)).toEqual([])
})

it('RBN defaults to all calls and respects explicit CWT filtering, removal and saved choices across restarts', async () => {
  const runtime = await harness()
  expect(runtime.spots.sourceName).toBe('RBN')
  expect(await runtime.fetch()).toHaveLength(3)
  expect(runtime.preferences['extension_n1rwj-rbn']).toBeUndefined()
  const form = await runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
  expect(JSON.stringify(form)).toContain('MST call-history file')
  expect(JSON.stringify(form)).toContain('SST call-history file')
  await runtime.choose('n1rwj-cwt')
  expect(await runtime.fetch()).toEqual([]) // Explicit filtering needs the data file.
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({ spotCallFilter: 'n1rwj-cwt' })
  runtime.load('cwt', '#CWOPS\n!!Order!!,Call,Name,Exch1\nK1ABC,Al,1234\n')
  const [first, second] = await Promise.all([runtime.fetch(), runtime.fetch()])
  expect(first).toEqual(second)
  expect(first.map((spot) => spot.their.call)).toEqual(['K1ABC/P'])
  expect(first[0]).toMatchObject({ freq: 14032, spot: { source: 'n1rwj-rbn' } })
  expect(first[0].refs).toEqual([])
  expect(runtime.requests).toHaveBeenCalledTimes(9)
  const saved = await harness(runtime.preferences)
  expect(saved.preferences['extension_n1rwj-rbn']).toEqual({ spotCallFilter: 'n1rwj-cwt' })
  expect(await saved.fetch()).toEqual([]) // Keep the choice when its cached file is absent.
  await runtime.hook<DataFileDefinition>('n1rwj-cwt', 'dataFile').onRemoveRawData?.()
  expect(await runtime.fetch()).toEqual([])
  const missing = await harness(runtime.preferences, [])
  expect(await missing.fetch()).toEqual([])
  expect(missing.requests).not.toHaveBeenCalled()
  await runtime.choose('none')
  expect(await runtime.fetch()).toHaveLength(3)
  const restarted = await harness(runtime.preferences)
  expect(await restarted.fetch()).toHaveLength(3)
  expect(restarted.preferences['extension_n1rwj-rbn']).toEqual({ spotCallFilter: 'none' })
})

it('MST and SST select cached membership through the same bundled contract', async () => {
  const runtime = await harness()
  runtime.load('mst', '#ICWC-MST\n!!Order!!,Call,Name,Misc\nW9NEW,Pat,123\n')
  runtime.load('sst', '#K1USNSST\n!!Order!!,Call,Name,Exch1\nN2SST,Jo,MA\n')
  await runtime.choose('n1rwj-mst')
  expect((await runtime.fetch()).map((spot) => spot.their.call)).toEqual(['W9NEW'])
  await runtime.choose('n1rwj-sst')
  expect((await runtime.fetch()).map((spot) => spot.their.call)).toEqual(['N2SST'])
  expect(runtime.requests).toHaveBeenCalledTimes(9)
  runtime.registered.delete('n1rwj-sst')
  expect(await runtime.fetch()).toEqual([])
})

it('adding CWT or a legacy default hint never selects a call-history filter automatically', async () => {
  const runtime = await harness({}, [])
  expect(await runtime.fetch()).toHaveLength(3)
  expect(runtime.preferences['extension_n1rwj-rbn']).toBeUndefined()
  const added = await harness(runtime.preferences)
  expect(await added.fetch()).toHaveLength(3)
  expect(added.preferences['extension_n1rwj-rbn']).toBeUndefined()
  for (const spotsHistoryOnly of [false, true]) {
    const legacy = await harness({ 'extension_n1rwj-cwt': { spotsHistoryOnly } })
    expect(await legacy.fetch()).toHaveLength(3)
    expect(legacy.preferences['extension_n1rwj-rbn']).toBeUndefined()
  }
})

it('bundled RBN gives calls on one frequency distinct stable references when merging is disabled', async () => {
  const runtime = await harness({ 'extension_n1rwj-rbn': { spotAllowMerging: false } }, [])
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
  const runtime = await harness({}, [])
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
  const restored = await harness(runtime.preferences, [])
  expect(await restored.fetch()).toEqual([]) // Unknown continent is excluded.
  restored.hook<DataFileDefinition>('n1rwj-rbn', 'dataFile').onLoadRawData?.({
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
  const runtime = await harness({}, [])
  const edit = (fieldKey: string, value: JSONValue) =>
    runtime.settings.onChangeField(
      { panelKey: 'n1rwj-rbn', fieldKey, value, state: {} },
      { online: true },
    )
  await edit('spotMinWpm', '20')
  await edit('spotMaxWpm', '24')
  expect(runtime.preferences['extension_n1rwj-rbn']).toEqual({ spotMinWpm: 20, spotMaxWpm: 24 })
  expect(await runtime.fetch()).toEqual([])
  expect(await (await harness(runtime.preferences, [])).fetch()).toEqual([])
  await expect(edit('spotMinWpm', 30)).rejects.toThrow('Minimum')
  await edit('spotMaxWpm', '')
  expect(await runtime.fetch()).toHaveLength(3)
  const results = await Promise.allSettled([edit('spotMaxWpm', 25), edit('spotMinWpm', 26)])
  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
})

it('resets all spot settings in the bundle while preserving reception caches and unrelated values', async () => {
  const runtime = await harness({
    'extension_n1rwj-rbn': {
      spotCallFilter: 'none',
      spotMode: 'CW',
      spotMinWpm: 30,
      spotMaxWpm: 20, // Reset repairs inconsistent saved pairs.
      spotSkimmers: 'KM3T-5',
      spotGrids: 'FN',
      spotContinents: ['NA'], // A preference from before continent memory existed.
      spotRadiusGrid: '',
      spotRadiusMiles: 100,
      receptionCache: { marker: 'preserve' },
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
    spotCallFilter: 'none',
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
    ['resetSpotCallFilter', { spotCallFilter: 'none' }],
    ['resetSpotMode', { spotMode: 'all' }],
    ['resetSpotSpeed', { spotMinWpm: '', spotMaxWpm: '' }],
    ['resetSpotSkimmers', { spotSkimmers: '' }],
    ['resetSpotGrids', { spotGrids: '' }],
    ['resetSpotContinents', { spotContinents: ['NA'], spotLastContinents: ['NA'] }],
    ['clearSpotContinents', { spotContinents: [], spotLastContinents: ['EU'] }],
    ['resetSpotDistance', { spotRadiusGrid: '', spotRadiusMiles: '' }],
  ]
  for (const [method, patch] of cases) {
    const runtime = await harness({ 'extension_n1rwj-rbn': saved }, [])
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
  const runtime = await harness({ 'extension_n1rwj-rbn': { spotContinents: ['NA'] } }, [])
  await runtime.action('clearSpotContinents')
  const restarted = await harness(runtime.preferences, [])
  expect(restarted.preferences['extension_n1rwj-rbn']).toMatchObject({
    spotContinents: [],
    spotLastContinents: ['NA'],
  })
  await restarted.action('resetSpotContinents')
  expect(restarted.preferences['extension_n1rwj-rbn']).toMatchObject({ spotContinents: ['NA'] })
})
