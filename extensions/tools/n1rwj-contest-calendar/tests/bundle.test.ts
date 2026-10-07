import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  DataFileDefinition,
  ExtensionDefinition,
  JSONValue,
  PanelHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { environment } from '../../../../packages/reception/tests/environment.ts'
import { createHostTimerHarness } from '../../../../scripts/lib/psk-smoke.ts'
import manifest from '../manifest.json'
import { calendarApiUrl } from '../src/source.ts'
import { NOW, payload } from './fixtures.ts'

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing calendar hook')
  return value
}

it('registers the weekly managed file, replays it offline, and never fetches from the panel', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  expect(manifest.api).toBe(5)
  expect(manifest.hooks).toEqual(['panel', 'dataFile'])
  expect(manifest.domains).toEqual(['contestclock.com'])
  let saved: Record<string, JSONValue> = {}
  const methods: string[] = []
  let realNow = NOW
  let appNow = NOW

  function restart() {
    let definition: ExtensionDefinition | undefined
    let panel: PanelHook | undefined
    let dataFile: DataFileDefinition | undefined
    const sandbox = createContext({
      Intl: undefined,
      URL: undefined,
      Date: class extends Date {
        static now() {
          return appNow
        }
      },
      __polo: {
        sharedModules,
        defineExtension: (value: ExtensionDefinition) => {
          definition = value
        },
      },
    })
    expect(runInContext('typeof fetch + typeof window + typeof document', sandbox)).toBe(
      'undefinedundefinedundefined',
    )
    runInContext(source, sandbox, { timeout: 5000 })
    required(definition).onActivation({
      timers: createHostTimerHarness().api,
      registerHook: (category, registration) => {
        if (category === 'panel') panel = registration.hook as PanelHook
        else {
          expect(category).toBe('dataFile')
          expect(registration.key).toBe(`${manifest.key}_calendar`)
          dataFile = registration.hook as DataFileDefinition
        }
      },
      hostCall: async (method, params) => {
        methods.push(method)
        if (method === 'getSettings')
          return { extensions: { [`extension_${manifest.key}`]: { ...saved } } }
        if (method === 'setSettings') {
          expect(params.ns).toBe(manifest.key)
          saved = { ...saved, ...(params.values as Record<string, JSONValue>) }
          return null
        }
        throw new Error(`Unexpected host call ${method}`)
      },
    })
    return { panel: required(panel), dataFile: required(dataFile) }
  }
  const args = () => ({
    panelKey: 'calendar',
    instanceId: 'home-calendar',
    environment: environment(330, 650),
    operation: {},
    qsoCount: 0,
    config: {},
    reason: 'initial',
    clock: { nowMillis: appNow, realNowMillis: realNow },
  })
  const first = restart()
  expect(methods).toEqual([])
  expect(first.dataFile).toMatchObject({ url: calendarApiUrl, maxAgeInDays: 7, fetchType: 'raw' })
  const descriptors = await first.panel.getPanels({}, { online: true })
  expect(descriptors[0]).toMatchObject({ key: 'calendar', on: ['tick:60'] })
  expect(methods).toEqual([])
  const empty = await first.panel.render(args(), { online: false })
  expect(JSON.stringify(empty)).toContain('Data Files')

  // Simulate native conversion, disk save and replay. No extension host.fetch is used.
  const diskFile = await required(first.dataFile.rawToJSONData)({
    body: payload(),
    url: calendarApiUrl,
    options: {},
  })
  required(first.dataFile.onLoadRawData)(diskFile)
  const ready = await first.panel.render(args(), { online: true })
  expect(ready.kind).toBe('scene')
  expect(JSON.stringify(ready)).toContain('CWops Test (CWT)')
  if (ready.kind !== 'scene') throw new Error('Expected calendar scene')
  const favorite = required(ready.scene.controls?.find((control) => control.id === 'favorite'))
  await required(first.panel.onEvent)(
    {
      ...args(),
      event: {
        controlId: favorite.id,
        action: required(favorite.event),
        phase: 'activate',
        sequence: 1,
      },
    },
    { online: true },
  )
  const preferences = JSON.parse(JSON.stringify(saved['calendar.panel.home-calendar']))
  expect(preferences.favorites).toEqual([
    `cwops-cwt-20261007T1300@contestcal:${Date.parse('2026-10-07T13:00:00Z')}/${Date.parse('2026-10-07T14:00:00Z')}`,
  ])

  const replay = restart()
  required(replay.dataFile.onLoadRawData)(JSON.parse(JSON.stringify(diskFile)))
  const restored = await replay.panel.render(args(), { online: false })
  expect(JSON.stringify(restored)).toContain('Unsave')

  // Developer time travel changes the displayed preview, not the real age warning.
  appNow += 365 * 24 * 60 * 60_000
  expect(JSON.stringify(await replay.panel.render(args(), { online: false }))).not.toContain(
    'stale · calendar',
  )
  appNow = NOW
  realNow += 7 * 24 * 60 * 60_000
  expect(JSON.stringify(await replay.panel.render(args(), { online: false }))).toContain(
    'stale · calendar',
  )
  await replay.dataFile.onRemoveRawData?.()
  expect(JSON.stringify(await replay.panel.render(args(), { online: false }))).toContain(
    'Data Files',
  )
  expect(methods).not.toContain('fetch')
  expect(Object.keys(saved)).toEqual(['calendar.panel.home-calendar'])
})
