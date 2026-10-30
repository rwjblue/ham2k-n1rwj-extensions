import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  AdifFieldsHook,
  AdifImportHook,
  ChasingHook,
  DataFileDefinition,
  DynamicSettingsPanel,
  ExportHook,
  ExtensionDefinition,
  FormDefinition,
  HookContext,
  LookupHook,
  PanelHook,
  RegisterHookParams,
} from '@ham2k/extension-sdk'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { CallFilterHook } from '../../../../packages/spot-filters/src/index.ts'
import manifest from '../manifest.json'
import type { Qson } from '../src/model.ts'

type HookTypes = {
  activity: ActivityHook
  adifFields: AdifFieldsHook
  adifImport: AdifImportHook
  chasing: ChasingHook
  dataFile: DataFileDefinition
  export: ExportHook
  lookup: LookupHook
  panel: PanelHook
  settingsPanel: DynamicSettingsPanel & { showAbout(): Promise<null> }
  'spotCallFilter:v1': CallFilterHook
}
let bundle: string
let sharedModules: Record<string, unknown>
beforeAll(async () => {
  bundle = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
})

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error('Missing bundled hook or result')
  return value
}

/** The repository's shipped-IIFE harness: no Node, DOM or network globals in
 * the sandbox. Native settings, disk replay and the built-in ADIF delegate are
 * explicit bridge boundaries; this does not exercise the Flutter UI. */
function harness() {
  const groups: Record<string, Qson> = {
    [`extension_${manifest.key}`]: {
      myNumber: '1C',
      myName: 'Me',
      mySpc: 'MA',
      myKey: 'SK',
      month: '2026-10',
    },
  }
  const storage = new Map<string, unknown>()
  const definitions: ExtensionDefinition[] = []
  const registered = new Map<string, Map<string, RegisterHookParams>>()
  const showForm = vi.fn(async (_form: FormDefinition) => null)
  const hostCall = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === 'getSettings') return structuredClone({ extensions: groups })
    if (method === 'setSettings') {
      const group = `extension_${String(params.ns)}`
      groups[group] = { ...groups[group], ...(params.values as Qson) }
      return null
    }
    if (method === 'kvGet') return storage.get(String(params.key)) ?? null
    if (method === 'kvSet') {
      storage.set(String(params.key), params.value)
      return null
    }
    throw new Error(`Unexpected host call ${method}`)
  })
  // ADIF encoding belongs to the host's core exporter. Assert delegation and
  // test the registered fields separately, instead of reimplementing it here.
  const invokeLocal = vi.fn(
    async (category: string, method: string, _args: unknown, _online?: boolean, key?: string) => {
      if (category !== 'export' || method !== 'generateExport' || key !== 'adif')
        throw new Error(`Unexpected delegated hook ${category}/${key}/${method}`)
      return [{ key: 'adif', ok: true, value: { content: 'HOST-ENCODED-ADIF' } }]
    },
  )
  const context = createContext({
    __polo: {
      sharedModules,
      invokeLocal,
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
    },
  })
  runInContext('delete Object.hasOwn', context)
  runInContext(bundle, context, { filename: 'skcc-built-extension.js', timeout: 5000 })
  expect(definitions).toHaveLength(1)
  const definition = required(definitions[0])
  definition.onActivation({
    hostCall,
    showForm,
    registerHook: (category, entry) => {
      const entries = registered.get(category) ?? new Map()
      if (entries.has(entry.key)) throw new Error(`Duplicate ${category}/${entry.key}`)
      entries.set(entry.key, entry)
      registered.set(category, entries)
    },
  })
  return {
    definition,
    registered,
    groups,
    storage,
    hostCall,
    invokeLocal,
    showForm,
    hook<K extends keyof HookTypes>(category: K, key = manifest.key): HookTypes[K] {
      return required(registered.get(category)?.get(key)).hook as HookTypes[K]
    },
  }
}

const at = Date.parse('2026-10-24T15:00:00Z')
const body = [
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS',
  '1C|K1ME|Me|MA||291|01 Jan 2006|01 Jan 2010||||A',
  '2T|K2ABC|Alice|NY||291|01 Jan 2006|01 Jan 2010|01 Jan 2011|||A',
  '3|K3SK/SK|Former|CA||291|01 Jan 2006|||||SK',
].join('\n')
const snapshot = {
  schema: 1,
  body,
  source: 'https://www.skccgroup.com/skimmer-data.txt',
  downloadedAt: at,
}
const operation: Qson = {
  uuid: 'skcc-bundle-operation',
  stationCall: 'K1ME',
  refs: [{ type: 'skcc', ref: 'general', ourQualified: 'yes', ourKeyDeclared: true }],
}
const ctx: HookContext = {
  online: false,
  getQsos: async () => {
    throw new Error('Logging must not read the full log')
  },
}
function replay(runtime: ReturnType<typeof harness>) {
  return runtime
    .hook('dataFile', `${manifest.key}_members`)
    .onLoadRawData?.(JSON.parse(JSON.stringify(snapshot)))
}
async function savedContact(runtime: ReturnType<typeof harness>): Promise<Qson> {
  // Native logging controls write the final received values to the ref. The
  // actual bundled before-save hook creates immutable exchange evidence.
  const qso: Qson = {
    uuid: 'saved-contact',
    startAtMillis: at,
    band: '40m',
    mode: 'CW',
    their: { call: 'K2ABC', sent: '579' },
    our: { call: 'K1ME', sent: '589' },
    refs: [{ type: 'skcc', number: '2T', name: 'ALICIA', spc: 'NY', key: 'BUG', qualified: 'yes' }],
  }
  const patch = required(
    await runtime.hook('activity').processQsoBeforeSave?.({ operation, qso }, ctx),
  )
  return {
    ...qso,
    ...patch,
    their: { ...(qso.their as Qson), ...(patch.their as Qson) },
    our: { ...(qso.our as Qson), ...(patch.our as Qson) },
  }
}

describe('SKCC installable ES2020 bundle', () => {
  it('registers every hook and recovers native chasing after delayed offline roster replay', async () => {
    const runtime = harness()
    expect(runtime.definition).toMatchObject({
      key: manifest.key,
      version: manifest.version,
      adifFieldsScope: 'always',
    })
    expect([...runtime.registered.keys()].sort()).toEqual([...manifest.hooks].sort())
    expect(runtime.registered.get('lookup')?.get(manifest.key)?.priority).toBeLessThan(-1)
    expect(runtime.registered.get('export')?.size).toBe(2)
    expect(runtime.registered.get('chasing')?.size).toBe(11)
    const chasing = runtime.hook('chasing', `${manifest.key}_c`)
    expect(() => chasing.claimsForQsos({ qsos: [] }, ctx)).toThrow('roster unavailable')
    expect(await runtime.hook('spotCallFilter:v1').describe({}, ctx)).toMatchObject({
      available: false,
      defaultSelected: false,
    })
    await replay(runtime)
    expect(await chasing.holdersFor({ station: { call: 'K1ME' } }, ctx)).toEqual(['1'])
    expect(
      await runtime
        .hook('spotCallFilter:v1')
        .matchCalls({ version: 1, calls: ['K2ABC/P', 'K3SK/SK', 'W9UNKNOWN'] }, ctx),
    ).toEqual({ version: 1, available: true, calls: ['K2ABC/P'] })
    const lookup = runtime.hook('lookup')
    const args = { operation: {}, qso: { their: { call: 'K2ABC' } }, callInfo: { call: 'K2ABC' } }
    const [offlineIdentity] = await lookup.lookupCall(args, ctx)
    expect(offlineIdentity).toMatchObject({
      name: 'Alice',
      notes: expect.arrayContaining(['**SKCC 2T** · Member']),
    })
    expect(offlineIdentity).not.toHaveProperty('note')
    expect(offlineIdentity).not.toHaveProperty('emoji')
    const [withQrz] = await lookup.lookupCall(
      { ...args, callInfo: { call: 'K2ABC', name: 'Alice Anderson', grid: 'FN31aa' } },
      ctx,
    )
    expect(withQrz?.notes).toContain('**SKCC 2T** · Member')
    for (const field of ['name', 'note', 'emoji', 'grid']) expect(withQrz).not.toHaveProperty(field)
    expect(await runtime.hook('settingsPanel').getPanels?.({}, ctx)).toEqual([
      {
        key: manifest.key,
        title: 'SKCC Companion',
        icon: 'key',
        sidebar: false,
        dataFilesSection: true,
      },
    ])
    expect(manifest).not.toHaveProperty('settings')
    expect(runtime.definition).not.toHaveProperty('settings')
    const packedManifest = JSON.parse(
      await readFile(new URL('../build/manifest.json', import.meta.url), 'utf8'),
    )
    expect(packedManifest).not.toHaveProperty('settings')
    expect(runtime.hostCall.mock.calls.every(([method]) => method === 'kvGet')).toBe(true)
  })

  it('dispatches the separate About action through the host without editing saved settings', async () => {
    const runtime = harness()
    const saved = structuredClone(runtime.groups)
    runtime.hostCall.mockClear()
    await expect(runtime.hook('settingsPanel').showAbout()).resolves.toBeNull()
    expect(runtime.showForm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'About SKCC Companion' }),
      {},
    )
    const form = required(runtime.showForm.mock.calls[0]?.[0])
    expect(form.elements.every((element) => !['field', 'action'].includes(element.type))).toBe(true)
    expect(JSON.stringify(form)).toContain('not an official SKCC product')
    expect(JSON.stringify(form)).toContain('A reload alone does not rebuild')
    expect(runtime.groups).toEqual(saved)
    expect(runtime.hostCall).not.toHaveBeenCalled()
  })

  it('retains the native disk snapshot after bad refresh and restores it with empty runtime KV', async () => {
    const first = harness()
    const data = first.hook('dataFile', `${manifest.key}_members`)
    let diskCache = ''
    const refresh = async (body: string) => {
      const value = await required(data.rawToJSONData)({ body, url: snapshot.source, options: {} })
      // The native manager writes only after conversion succeeds.
      diskCache = JSON.stringify(value)
      await data.onLoadRawData?.(value)
    }
    await refresh(body)
    const good = diskCache
    await expect(refresh('<html>Unavailable</html>')).rejects.toThrow()
    expect(diskCache).toBe(good)
    const restarted = harness()
    expect(restarted.storage.size).toBe(0)
    await restarted
      .hook('dataFile', `${manifest.key}_members`)
      .onLoadRawData?.(JSON.parse(diskCache))
    const controls = await restarted
      .hook('activity')
      .loggingControls?.({ operation, qso: { their: { call: 'K2ABC' } } }, ctx)
    expect(controls?.map(({ input }) => input)).toMatchObject([
      { field: 'name', suggestedValue: 'Alice' },
      { field: 'spc', suggestedValue: 'NY' },
      { field: 'number', suggestedValue: '2T' },
      { field: 'qualified' },
    ])
    expect(controls?.[3]?.input).not.toHaveProperty('suggestedValue')
    expect(restarted.hostCall.mock.calls.every(([method]) => method === 'kvGet')).toBe(true)
  })

  it('connects settings, saved exchange evidence, native claims, panel totals and both exporters', async () => {
    const runtime = harness()
    await replay(runtime)
    const settings = runtime.hook('settingsPanel')
    const form = await settings.getDefinition({ panelKey: manifest.key }, ctx)
    expect(JSON.stringify(form)).toContain('EXP CHASE')
    await settings.onChangeField(
      { panelKey: manifest.key, state: {}, fieldKey: 'myName', value: 'ME ON AIR' },
      ctx,
    )
    expect(runtime.groups[`extension_${manifest.key}`]).toMatchObject({
      myNumber: '1C',
      myName: 'ME ON AIR',
    })
    const saved = await savedContact(runtime)
    expect(saved).toMatchObject({
      their: {
        call: 'K2ABC',
        exchange: 'ALICIA NY 2T',
        skcc: { name: 'ALICIA', qualified: 'yes', key: 'BUG' },
      },
      our: { skcc: { number: '1C', name: 'ME ON AIR', key: 'SK', qualified: 'yes' } },
    })
    const chasing = runtime.hook('chasing', `${manifest.key}_c`)
    const claims = await chasing.claimsForQsos(
      { qsos: [saved, { uuid: 'spot', their: { call: 'K2ABC' }, mode: 'CW', band: '40m' }] },
      ctx,
    )
    expect(claims.spot).toEqual([])
    expect(claims['saved-contact']).toEqual([
      { holder: '1', ref: '2', band: null, mode: null, level: 'worked', label: 'K2ABC #2' },
      { holder: '1', ref: '2', band: '40m', mode: null, level: 'worked', label: 'K2ABC #2' },
    ])
    const summary = await chasing.summarizeClaims(
      { holder: '1', slots: claims['saved-contact'] },
      ctx,
    )
    expect(summary.progress?.total).toBe(1)
    const awardExport = await runtime
      .hook('export', `${manifest.key}_awards`)
      .generateExport(
        { operation, qsos: [saved], exportType: 'skcc-award-csv', exportKey: 'operation:C' },
        ctx,
      )
    expect(awardExport.content).toContain('"C","selected","K2ABC","2","ALICIA","NY"')

    // Changing defaults later cannot rewrite the recorded transmitted exchange.
    await settings.onChangeField(
      { panelKey: manifest.key, state: {}, fieldKey: 'myName', value: 'LATER NAME' },
      ctx,
    )
    const fields = await runtime.hook('adifFields').fieldsForOneQSO({ operation, qso: saved }, ctx)
    expect(fields).toEqual(
      expect.arrayContaining([
        { name: 'SKCC', value: '2T' },
        { name: 'NAME', value: 'ALICIA' },
        { name: 'APP_N1RWJ_SKCC_MY_NAME', value: 'ME ON AIR' },
        { name: 'APP_N1RWJ_SKCC_QUALIFIED', value: 'Y' },
        { name: 'MY_MORSE_KEY_TYPE', value: 'SK' },
      ]),
    )
    const imported = await runtime.hook('adifImport').refsForRecords(
      {
        records: [
          {
            fields: Object.fromEntries(
              fields.map(({ name, value }) => [name.toLowerCase(), value]),
            ),
          },
        ],
      },
      ctx,
    )
    expect(imported[0]?.refs?.[0]).toMatchObject({
      number: '2T',
      name: 'ALICIA',
      qualified: true,
      our: { number: '1C', name: 'ME ON AIR', qualified: true },
    })
    const exported = await runtime
      .hook('export')
      .generateExport({ operation, qsos: [saved], exportType: 'skcc-adif' }, ctx)
    expect(exported.content).toBe('HOST-ENCODED-ADIF')
    expect(runtime.invokeLocal).toHaveBeenCalledWith(
      'export',
      'generateExport',
      expect.objectContaining({ qsos: [saved], mainHandler: manifest.key, exportType: 'adif' }),
      undefined,
      'adif',
    )

    const getQsos = vi.fn(async () => [saved])
    const panelCtx: HookContext = { online: false, getQsos, getSpots: async () => [] }
    const panel = runtime.hook('panel')
    const args = {
      panelKey: 'companion',
      operation,
      qsoCount: 1,
      config: {},
      reason: 'operation',
      clock: { nowMillis: at, realNowMillis: at },
    }
    expect(await panel.render(args, panelCtx)).toMatchObject({
      kind: 'markdown',
      content: expect.stringContaining('1 distinct qualifying members / 5 personal target'),
    })
    await panel.render({ ...args, reason: 'qso', qso: { their: { call: 'K2ABC' } } }, panelCtx)
    expect(getQsos).toHaveBeenCalledTimes(1)
    expect(runtime.hostCall.mock.calls.some(([method]) => /fetch|network/i.test(method))).toBe(
      false,
    )
  })
})
