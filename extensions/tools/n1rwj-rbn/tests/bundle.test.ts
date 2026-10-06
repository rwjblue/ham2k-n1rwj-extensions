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
import { createHostTimerHarness } from '../../../../scripts/lib/psk-smoke.ts'
import manifest from '../manifest.json'
import { NOW, payload } from './data/fixtures.ts'

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing bundle hook method')
  return value
}

it('registers and loads the weekly receiver data file in the packaged sandbox', async () => {
  expect(manifest.api).toBe(5)
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
    timers: createHostTimerHarness().api,
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
  expect(saved.nodes).toHaveLength(8)
  expect(saved.nodes).toContainEqual({
    call: 'UNKNOWN',
    grid: 'JO21BX',
    country: 'Kazakhstan',
    continent: 'AS',
  })
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
  const requestUrls: string[] = []
  let limited = false
  function restart() {
    const timers = createHostTimerHarness()
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
      timers: timers.api,
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
          requestUrls.push(String(params.url))
          return limited
            ? { status: 429, body: JSON.stringify({ error: { retryAfter: 120 } }) }
            : { status: 200, body: JSON.stringify(payload()) }
        }
        throw new Error(`Unexpected host call ${method}`)
      },
    })
    return { panel: required(panel), timers }
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
  const { panel: first } = restart()
  await first.render(args(), { online: true })
  await settleHostCalls()
  const ready = await first.render(args(), { online: true })
  expect(JSON.stringify(ready)).toContain('W3LPL')
  if (ready.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  const band = required(ready.scene.controls?.find((control) => control.id === 'band'))
  expect(band).toMatchObject({ kind: 'nativeDropdown', value: 'band' })
  const choice = {
    ...args(),
    event: {
      controlId: 'band',
      action: required(band.event),
      phase: 'commit' as const,
      sequence: 100,
      text: '40m',
    },
  }
  expect(await first.onEvent?.(choice, { online: true })).toEqual({
    values: {},
    strings: { band: '40m' },
  })
  expect(await first.onEvent?.(choice, { online: true })).toEqual({
    values: {},
    strings: { band: '40m' },
  })
  const filtered = await first.render(args(), { online: true })
  if (filtered.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  expect(filtered.scene.strings?.band).toBe('40m')
  expect(JSON.stringify(filtered)).not.toContain('map-receiver-label:W3LPL')
  const remounted = {
    ...args(),
    event: {
      controlId: 'band',
      action: required(filtered.scene.controls?.find((control) => control.id === 'band')?.event),
      phase: 'commit' as const,
      sequence: 1,
      text: '20m',
    },
  }
  expect(await first.onEvent?.(remounted, { online: true })).toEqual({
    values: {},
    strings: { band: '20m' },
  })
  const restoredChoice = await first.render(args(), { online: true })
  expect(JSON.stringify(restoredChoice)).toContain('map-receiver-label:W3LPL')
  expect(saved).not.toHaveProperty('band')
  expect(requests).toBe(1)
  clock += 1000
  const { panel: second } = restart()
  expect(JSON.stringify(await second.render(args(), { online: false }))).toContain('W3LPL')
  await second.render(args(), { online: true })
  expect(requests).toBe(1)
  limited = true
  const refresh = async (panel: PanelHook) => {
    const content = await panel.render(args(), { online: false })
    if (content.kind !== 'scene') throw new Error('Expected API-5 reception scene')
    const action = required(
      content.scene.controls?.find((control) => control.id === 'refresh')?.event,
    )
    return panel.onEvent?.(
      { ...args(), event: { controlId: 'refresh', action, phase: 'activate', sequence: 1 } },
      { online: true },
    )
  }
  await refresh(second)
  await settleHostCalls()
  expect(requests).toBe(2)
  expect(saved['rbn-rate-limit-v1']).toMatchObject({ version: 1, pendingDelayMs: 120_000 })
  const { panel: third, timers: thirdTimers } = restart()
  await refresh(third)
  expect(requests).toBe(2)
  const rateLimited = await third.render(args(), { online: true })
  expect(JSON.stringify(rateLimited)).toContain('rate limited')
  if (rateLimited.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  const window = required(rateLimited.scene.controls?.find((control) => control.id === 'window'))
  expect(window).toMatchObject({ kind: 'nativeDropdown', value: 'window' })
  expect(
    await third.onEvent?.(
      {
        ...args(),
        event: {
          controlId: 'window',
          action: required(window.event),
          phase: 'commit',
          sequence: 2,
          text: '30',
        },
      },
      { online: true },
    ),
  ).toEqual({ values: {}, strings: { window: '30' } })
  const selectedWindow = await third.render(args(), { online: true })
  if (selectedWindow.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  expect(selectedWindow.scene.strings?.window).toBe('30')
  expect(requests).toBe(2)
  expect(saved).not.toHaveProperty('windowMinutes')
  clock += 120_000
  limited = false
  thirdTimers.advance(120_000)
  await settleHostCalls()
  await third.render(args(), { online: true })
  await settleHostCalls()
  expect(requests).toBe(3)
  expect(requestUrls[2]).toContain(`since=${Math.floor(clock / 1000) - 1800}`)
  const { panel: fourth } = restart()
  const restartedWindow = await fourth.render(args(), { online: false })
  if (restartedWindow.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  expect(restartedWindow.scene.strings?.window).toBe('15')
  expect(requests).toBe(3)
  expect(saved.spotMode).toBe('CW')
})

it('renders before a slow fetch settles and uses host timers without ambient timer globals', async () => {
  const timers = createHostTimerHarness()
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
    timers: timers.api,
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
  // The built bundle refreshes at the remaining cooldown without a render or
  // advancing the sandbox's Date. Hiding cancels the next scheduled refresh.
  timers.advance(54_000)
  await settleHostCalls()
  expect(requests).toBe(2)
  await required(required(definition).onHide)()
  expect(timers.pendingCount).toBe(0)
  timers.advance(5 * 60_000)
  await settleHostCalls()
  expect(requests).toBe(2)
  expect(runInContext('typeof setTimeout', sandbox)).toBe('undefined')
  expect(runInContext('typeof setInterval', sandbox)).toBe('undefined')
})
