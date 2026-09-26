import { readFile } from 'node:fs/promises'
import { setImmediate as settleHostCalls } from 'node:timers/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  DataFileDefinition,
  ExtensionDefinition,
  JSONValue,
  PanelHook,
  RegisterHookParams,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { environment } from '../../../../packages/reception/tests/environment.ts'
import manifest from '../manifest.json'
import { NOW, payload } from './data/fixtures.ts'

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing bundle hook method')
  return value
}

it('registers and loads the weekly receiver data file in the packaged sandbox', async () => {
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
        defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
      },
    }),
    { timeout: 5000 },
  )
  expect(definitions).toHaveLength(1)
  definitions[0].onActivation({
    registerHook: (category, hook) => registered.set(category, hook),
    hostCall: async (method) => {
      throw new Error(`Unexpected host call ${method}`)
    },
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  const dataFile = registered.get('dataFile')?.hook as DataFileDefinition
  expect(dataFile).toMatchObject({ key: 'n1rwj-rbn_receivers', fetchType: 'raw', maxAgeInDays: 7 })
  const saved = await required(dataFile.rawToJSONData)({
    body: await readFile(new URL('./data/receivers.txt', import.meta.url), 'utf8'),
    url: String(dataFile.url),
    options: {},
  })
  expect(saved.nodes).toHaveLength(7)
  required(dataFile.onLoadRawData)(JSON.parse(JSON.stringify(saved)))
  await expect(
    required(dataFile.rawToJSONData)({
      body: 'Bad gateway',
      url: String(dataFile.url),
      options: {},
    }),
  ).rejects.toThrow()
  await required(dataFile.onRemoveRawData)()
})

it('restores reports and shared server backoff through the actual SDK settings bridge', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  let saved: Record<string, JSONValue> = { spotMode: 'CW' }
  let clock = NOW
  let requests = 0
  let limited = false
  function restart() {
    let definition: ExtensionDefinition | undefined
    let panel: PanelHook | undefined
    runInContext(
      source,
      createContext({
        Date: class extends Date {
          static now() {
            return clock
          }
        },
        __polo: {
          sharedModules,
          defineExtension: (value: ExtensionDefinition) => {
            definition = value
          },
        },
      }),
      { timeout: 5000 },
    )
    required(definition).onActivation({
      registerHook: (category, hook) => {
        if (category === 'panel') panel = hook.hook as PanelHook
      },
      hostCall: async (method, params) => {
        if (method === 'getSettings') return { extensions: { 'extension_n1rwj-rbn': { ...saved } } }
        if (method === 'setSettings') {
          expect(params.ns).toBe('n1rwj-rbn')
          saved = { ...saved, ...(params.values as Record<string, JSONValue>) }
          return null
        }
        if (method === 'fetch') {
          requests++
          return limited
            ? { status: 429, body: JSON.stringify({ error: { retryAfter: 120 } }) }
            : { status: 200, body: JSON.stringify(payload()) }
        }
        throw new Error(`Unexpected host call ${method}`)
      },
    })
    return required(panel)
  }
  const args = () => ({
    panelKey: 'my-signal',
    instanceId: 'restart',
    environment: environment(),
    operation: { stationCall: 'N1RWJ', grid: 'FN42' },
    qsoCount: 0,
    config: {},
    reason: 'initial',
    clock: { nowMillis: clock, realNowMillis: clock },
  })
  const first = restart()
  await first.render(args(), { online: true })
  await settleHostCalls()
  expect(JSON.stringify(await first.render(args(), { online: true }))).toContain('W3LPL')
  expect(requests).toBe(1)
  clock += 1000
  const second = restart()
  expect(JSON.stringify(await second.render(args(), { online: false }))).toContain('W3LPL')
  await second.render(args(), { online: true })
  expect(requests).toBe(1)
  limited = true
  const event = () => ({
    ...args(),
    event: {
      controlId: 'refresh',
      action: 'refresh:reports',
      phase: 'activate' as const,
      sequence: 1,
    },
  })
  await second.onEvent?.(event(), { online: true })
  await settleHostCalls()
  expect(requests).toBe(2)
  const third = restart()
  await third.onEvent?.(event(), { online: true })
  expect(requests).toBe(2)
  expect(JSON.stringify(await third.render(args(), { online: true }))).toContain('rate limited')
  clock += 120_000
  limited = false
  await third.render(args(), { online: true })
  await settleHostCalls()
  expect(requests).toBe(3)
  expect(saved.spotMode).toBe('CW')
})

it('renders before a slow fetch settles in a sandbox without timers and collects it on the next tick', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  let definition: ExtensionDefinition | undefined
  let panel: PanelHook | undefined
  let saved: Record<string, JSONValue> = {}
  let clock = NOW
  let requests = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const sandbox = createContext({
    Date: class extends Date {
      static now() {
        return clock
      }
    },
    __polo: {
      sharedModules,
      defineExtension: (value: ExtensionDefinition) => {
        definition = value
      },
    },
  })
  expect(runInContext('typeof setTimeout', sandbox)).toBe('undefined')
  expect(runInContext('typeof setInterval', sandbox)).toBe('undefined')
  runInContext(source, sandbox, { timeout: 5000 })
  required(definition).onActivation({
    registerHook: (category, hook) => {
      if (category === 'panel') panel = hook.hook as PanelHook
    },
    hostCall: async (method, params) => {
      if (method === 'getSettings') return { extensions: { 'extension_n1rwj-rbn': { ...saved } } }
      if (method === 'setSettings') {
        saved = { ...saved, ...(params.values as Record<string, JSONValue>) }
        return null
      }
      if (method === 'fetch') {
        requests++
        expect(params.timeout).toBeUndefined()
        await pending
        return { status: 200, body: JSON.stringify(payload()) }
      }
      throw new Error(`Unexpected host call ${method}`)
    },
  })
  const args = (reason = 'tick') => ({
    panelKey: 'my-signal',
    instanceId: 'slow-request',
    environment: environment(),
    operation: { stationCall: 'N1RWJ', grid: 'FN42' },
    qsoCount: 0,
    config: {},
    reason,
    clock: { nowMillis: clock, realNowMillis: clock },
  })
  const hook = required(panel)
  const initial = await hook.render(args('initial'), { online: true })
  expect(initial?.triggers).toEqual(['tick:1'])
  expect(JSON.stringify(initial)).not.toContain('W3LPL')
  await settleHostCalls()
  expect(requests).toBe(1)
  clock += 1000
  expect((await hook.render(args(), { online: true }))?.triggers).toEqual(['tick:1'])
  expect(requests).toBe(1)
  clock += 5000
  finish()
  await settleHostCalls()
  const completed = await hook.render(args(), { online: true })
  expect(completed?.triggers ?? []).not.toContain('tick:1')
  expect(JSON.stringify(completed)).toContain('W3LPL')
  expect(requests).toBe(1)
})
