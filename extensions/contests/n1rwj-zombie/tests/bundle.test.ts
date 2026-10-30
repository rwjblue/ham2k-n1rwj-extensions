import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  DynamicSettingsPanel,
  ExtensionDefinition,
  FormDefinition,
  LookupHook,
  PanelHook,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import manifest from '../manifest.json'
import type { Qson } from '../src/model.ts'

it('activates its official ES2020 bundle, scores elapsed rebirths and suggests logged exchanges without data files', async () => {
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
  const definition = definitions[0]
  if (!definition) throw new Error('Missing Zombie extension')
  const called: string[] = []
  const shownForms: FormDefinition[] = []
  await definition.onActivation({
    registerHook: (category, params) => registered.set(category, params),
    showForm: async (form) => {
      shownForms.push(form)
      return null
    },
    hostCall: async (method) => {
      called.push(method)
      throw new Error(`Unexpected host call: ${method}`)
    },
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect(registered.get('activity')?.key).toBe(manifest.key)
  const settings = registered.get('settingsPanel')?.hook as DynamicSettingsPanel & {
    showAbout(): Promise<null>
  }
  expect(await settings.getPanels?.({}, { online: false })).toEqual([
    {
      key: manifest.key,
      title: 'Zombie Shuffle',
      icon: manifest.icon,
      section: 'activities',
      sidebar: false,
    },
  ])
  expect(manifest.settings).toEqual({ section: 'activities' })
  expect(definition).toMatchObject({ settings: manifest.settings })
  const builtManifest = JSON.parse(
    await readFile(new URL('../build/manifest.json', import.meta.url), 'utf8'),
  )
  expect(builtManifest.settings).toEqual(manifest.settings)
  const operation: Qson = {
    uuid: 'bundle-operation',
    stationCall: 'N1RWJ',
    refs: [
      {
        type: 'zombie',
        ref: '2026',
        ourSpc: 'RI',
        ourZombieNumber: '00123',
        ourZombieName: 'COUNT ROB',
        utcOffset: '-04:00',
      },
    ],
  }
  const contact = (uuid: string, at: string): Qson => ({
    uuid,
    mode: 'CW',
    band: '20m',
    startAtMillis: Date.parse(at),
    their: { call: 'K1ABC', sent: '599' },
    refs: [{ type: 'zombie', theirSpc: 'MA', theirZombieNumber: '0007', theirZombieName: 'GHOST' }],
  })
  const scoring = registered.get('scoring')?.hook as ScoringHook
  expect(scoring).toMatchObject({ scope: { refTypes: ['zombie'] } })
  const result = await scoring.scoreQsos(
    {
      operation,
      qsos: [
        contact('first', '2026-10-30T19:30:00Z'),
        contact('early', '2026-10-30T20:30:00Z'),
        contact('reborn', '2026-10-30T21:30:00Z'),
      ],
    },
    { online: false },
  )
  expect(result.qsoScores.early).toMatchObject({ dupe: true, value: 0 })
  expect(result.qsoScores.reborn).toMatchObject({ dupe: false, value: 7 })
  expect(result.operationSummary.zombie).toMatchObject({ qsos: 2, numberSum: 14, total: 694 })
  expect(result.operationSummary.zombie?.longSummary).toContain('Band plots')
  const panel = registered.get('panel')?.hook as PanelHook
  expect((await panel.getPanels({}, { online: false }))[0]?.key).toBe('graveyard')
  const watch = await panel.render(
    {
      panelKey: 'graveyard',
      operation,
      config: { view: 'watch' },
      reason: 'initial',
      qsoCount: 1,
      clock: { nowMillis: Date.parse('2026-10-30T20:30:00Z'), realNowMillis: 1000 },
    },
    { online: false, getQsos: async () => [contact('first', '2026-10-30T19:30:00Z')] },
  )
  expect(watch.kind).toBe('markdown')
  if (watch.kind !== 'markdown') throw new Error('Expected watch')
  expect(watch.content).toContain('Rises in 60 min')

  expect(registered.has('dataFile')).toBe(false)
  expect(manifest.hooks).not.toContain('dataFile')
  expect(manifest).not.toHaveProperty('domains')
  expect(builtManifest).not.toHaveProperty('domains')
  const preferences = await settings.getDefinition({ panelKey: manifest.key }, { online: false })
  expect(preferences.elements).toContainEqual(
    expect.objectContaining({ type: 'action', style: 'row', method: 'showAbout' }),
  )
  expect(shownForms).toEqual([])
  await settings.showAbout()
  expect(shownForms).toHaveLength(1)
  const guide = shownForms[0]
  if (!guide) throw new Error('Missing About dialog')
  expect(guide.title).toBe('About Zombie Shuffle')
  expect(guide.elements.every((element) => !['field', 'action'].includes(element.type))).toBe(true)
  const guideText = guide.elements
    .filter((element) => element.type === 'markdown')
    .map((element) => element.text)
    .join('\n')
  expect(guideText).toContain('NA5N announced these 16 bonus stations')
  expect(guideText).toContain('N7CQR · K7TQ')
  const lookup = registered.get('lookup')?.hook as LookupHook
  for (const call of ['N7CQR', 'K7TQ', 'NA5N/QRP']) {
    const annotations = await lookup.lookupCall(
      { operation, qso: {}, callInfo: { call } },
      { online: false },
    )
    expect(annotations[0]).toMatchObject({ call, note: '⚡ 2026 bonus station' })
    expect(annotations[0]?.notes?.join('\n')).toContain('Expected number **4321**')
  }
  expect(
    await lookup.lookupCall(
      {
        operation: { refs: [{ type: 'zombie', ref: '2027' }] },
        qso: {},
        callInfo: { call: 'NA5N' },
      },
      { online: false },
    ),
  ).toEqual([])
  const activity = registered.get('activity')?.hook as ActivityHook
  const controls = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'K1ABC' } } },
    { online: false },
  )
  expect(controls?.map(({ input }) => input)).toMatchObject([
    { field: 'theirSpc', suggestedValue: 'MA' },
    { field: 'theirZombieNumber', kind: 'text', suggestedValue: '0007' },
    { field: 'theirZombieName', suggestedValue: 'GHOST' },
  ])
  const bonus = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'AB9CA' } } },
    { online: false },
  )
  expect(bonus?.[1]?.input).toMatchObject({ suggestedValue: '4321' })
  expect(bonus?.[2]?.input).toMatchObject({ suggestedValue: ' ' })
  const unknown = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'K9XYZ' } } },
    { online: false },
  )
  expect(unknown?.[1]?.input).toMatchObject({ suggestedValue: ' ' })
  expect(unknown?.[2]?.input).toMatchObject({ suggestedValue: ' ' })
  expect(called).toEqual([])
})
