import { readFile } from 'node:fs/promises'
import { setImmediate as settleHostCalls } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import type { ExtensionDefinition, JSONValue, PanelHook } from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { environment } from '../../../../packages/reception/tests/environment.ts'
import { createHostTimerHarness, verifyPskBundle } from '../../../../scripts/lib/psk-smoke.ts'
import manifest from '../manifest.json'

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing bundle hook method')
  return value
}

it('loads the API-3 bundle with binary MQTT and host timers through the published SDK', async () => {
  expect(manifest.api).toBe(3)
  expect(manifest.webSockets).toEqual(['mqtt.pskreporter.info'])
  expect(manifest.domains).toEqual(['retrieve.pskreporter.info'])
  await verifyPskBundle(fileURLToPath(new URL('../build/index.js', import.meta.url)), manifest)
})

it('keeps initial and manual history requests outside rendering with only SDK timer access', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  const now = Date.UTC(2026, 8, 26, 18)
  const timers = createHostTimerHarness()
  let clock = now
  let definition: ExtensionDefinition | undefined
  let panel: PanelHook | undefined
  let saved: Record<string, JSONValue> = {}
  let requests = 0
  let finish!: () => void
  let reject!: (error: Error) => void
  let pending: Promise<void>
  const defer = () => {
    pending = new Promise<void>((resolve, rejectPromise) => {
      finish = resolve
      reject = rejectPromise
    })
  }
  defer()
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
      registerSocket: () => 1,
      log: (message: string) => {
        throw new Error(message)
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
      if (method === 'getSettings')
        return { extensions: { 'extension_n1rwj-psk-reporter': { ...saved } } }
      if (method === 'setSettings') {
        saved = { ...saved, ...(params.values as Record<string, JSONValue>) }
        return null
      }
      if (method === 'fetch') {
        requests++
        expect(params.timeout).toBeUndefined()
        await pending
        return {
          status: 200,
          body: `<pskreporter><receptionReport senderCallsign="N1RWJ" receiverCallsign="US-E-015" receiverLocator="FN31" frequency="14074000" mode="FT8" flowStartSeconds="${now / 1000}"/></pskreporter>`,
        }
      }
      if (method.startsWith('webSocket')) return null
      throw new Error(`Unexpected host call ${method}`)
    },
  })
  const args = () => ({
    panelKey: 'psk-reporter',
    instanceId: 'slow-history',
    environment: environment(),
    operation: { stationCall: 'N1RWJ', grid: 'FN42' },
    qsoCount: 0,
    config: {},
    reason: 'tick',
    clock: { nowMillis: clock, realNowMillis: clock },
  })
  const hook = required(panel)
  const initial = await hook.render(args(), { online: true })
  expect(initial.triggers).toEqual(['tick:1'])
  expect(JSON.stringify(initial)).toContain('Loading recent reports')
  await settleHostCalls()
  expect(requests).toBe(1)
  clock += 8_000
  expect((await hook.render(args(), { online: true })).triggers).toEqual(['tick:1'])
  expect(requests).toBe(1)

  finish()
  await settleHostCalls()
  const completed = await hook.render(args(), { online: true })
  expect(completed.triggers).toBeUndefined()
  expect(JSON.stringify(completed)).toContain('US-E-015')
  if (completed.kind !== 'svgScene') throw new Error('Expected native reception scene')
  expect(
    completed.scene.layers.find((layer) => layer.id === 'map-receiver-label:US-E-015')?.text
      ?.literal,
  ).toBe('US-E-015')
  expect((await hook.getPanels({}, { online: true }))[0].on).toEqual(['operation', 'tick:5'])

  defer()
  const reload = () =>
    hook.onEvent?.(
      {
        ...args(),
        event: {
          controlId: 'refresh',
          action: 'refresh:reports',
          phase: 'activate' as const,
          sequence: 1,
        },
      },
      { online: true },
    )
  await reload()
  await settleHostCalls()
  const reloading = await hook.render(args(), { online: true })
  expect(reloading.triggers).toEqual(['tick:1'])
  expect(JSON.stringify(reloading)).toContain('US-E-015')
  await reload()
  expect(requests).toBe(2)

  clock += 15_000
  reject(new Error('TimeoutException: Future not completed'))
  await settleHostCalls()
  const failed = await hook.render(args(), { online: true })
  expect(failed.triggers).toBeUndefined()
  expect(JSON.stringify(failed)).toContain('History unavailable')
  expect(JSON.stringify(failed)).toContain('US-E-015')
  expect(requests).toBe(2)
  await required(definition).onHide?.()
})

it.each(['n1rwj-rbn', 'n1rwj-psk-reporter'])('preserves shared map notices in %s', async (key) => {
  for (const path of [
    'MAP_ATTRIBUTION.md',
    'licenses/d3-geo-ISC.txt',
    'licenses/d3-array-ISC.txt',
    'licenses/internmap-ISC.txt',
    'licenses/atlas-MIT.txt',
  ]) {
    const bundled = await readFile(
      new URL(`../../${key}/build/assets/${path}`, import.meta.url),
      'utf8',
    )
    const shared = await readFile(
      new URL(`../../../../packages/reception/assets/${path}`, import.meta.url),
      'utf8',
    )
    expect(bundled).toBe(shared)
  }
})
