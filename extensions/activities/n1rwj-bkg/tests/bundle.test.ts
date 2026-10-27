import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ChasingHook,
  DataFileDefinition,
  ExtensionDefinition,
  LookupHook,
  PanelHook,
  RegisterHookParams,
} from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import manifest from '../manifest.json'
import { args, at, body, qso } from './fixtures.ts'

it('runs the shipped ES2020 bundle with native disk replay and no Node, DOM, fetch or settings writes', async () => {
  const source = await readFile(new URL('../build/index.js', import.meta.url), 'utf8')
  const definitions: ExtensionDefinition[] = []
  const registered = new Map<string, RegisterHookParams>()
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const loaded = await import(name)
        return [name, name === 'i18next' ? loaded.default : loaded]
      }),
    ),
  )
  const context = createContext({
    __polo: {
      sharedModules,
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
    },
  })
  runInContext('delete Object.hasOwn; delete Array.prototype.at', context)
  runInContext(source, context, { timeout: 5000 })
  const hostCall = vi.fn(async (method: string) => {
    if (method === 'getSettings') return { operatorCall: 'W9HUNT' }
    throw new Error(`Unexpected host call: ${method}`)
  })
  definitions[0].onActivation({
    hostCall,
    registerHook: (category, entry) => registered.set(category, entry),
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect(registered.has('settingsPanel')).toBe(false)
  expect(registered.has('account')).toBe(false)
  const data = registered.get('dataFile')?.hook as DataFileDefinition
  await data.onLoadRawData?.({ schema: 1, body: body(), downloadedAt: at })
  const lookup = registered.get('lookup')?.hook as LookupHook
  const [member] = await lookup.lookupCall(
    { callInfo: { call: 'N0BBB' }, qso: {}, operation: {} },
    { online: false },
  )
  expect(member).toMatchObject({ notes: ['**BKG #2** · Blair · Rhode Island'] })
  const chasing = registered.get('chasing')?.hook as ChasingHook
  expect(chasing.program.version).toBe(2)
  expect(await chasing.holdersFor({ station: { call: 'W9HUNT' } }, { online: false })).toEqual([
    'W9HUNT',
  ])
  expect((await chasing.claimsForQsos({ qsos: [qso()] }, { online: false })).qso[0]).toMatchObject({
    holder: 'W9HUNT',
    ref: '2',
  })
  const panel = registered.get('panel')?.hook as PanelHook
  const home = await panel.render(args({ operation: {} }), { online: false })
  expect(home.kind).toBe('markdown')
  if (home.kind === 'markdown') expect(home.content).toContain('Work a BKG member on 2m CW to join')
  expect(hostCall.mock.calls.map(([method]) => method)).toEqual(['getSettings'])
  const packed = JSON.parse(
    await readFile(new URL('../build/manifest.json', import.meta.url), 'utf8'),
  )
  expect(packed.api).toBe(9)
  expect(packed.settings).toBeUndefined()
})
