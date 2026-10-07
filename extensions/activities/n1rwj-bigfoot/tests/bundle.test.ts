import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  ExportHook,
  ExtensionDefinition,
  HookContext,
  PanelHook,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
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
  definitions[0]?.onActivation({
    registerHook: (category, hook) => registered.set(category, hook),
    hostCall: async (method) => {
      throw new Error(`Unexpected host call: ${method}`)
    },
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect(manifest.domains).toEqual([])
  const operation = { uuid: 'hunt', stationCall: 'N1RWJ', refs: [{ type: 'bigfoot', ref: '2026' }] }
  const qsos = ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7O', 'W7T', 'W4S'].map((call, index) => ({
    uuid: `qso-${index}`,
    their: { call, sent: '599' },
    our: { sent: '599' },
    band: index === 5 ? '40m' : '20m',
    mode: 'CW',
    startAtMillis: Date.UTC(2026, 9, 19, 22, index),
  }))
  const ctx: HookContext = { online: false, getQsos: async () => qsos }
  const activity = registered.get('activity')?.hook as ActivityHook
  expect(await activity.suggest?.({ operation, searchTerm: 'BIGFOOT' }, ctx)).toMatchObject([
    { type: 'bigfoot', ref: '2026' },
  ])
  const scoring = registered.get('scoring')?.hook as ScoringHook
  const result = await scoring.scoreQsos({ operation, qsos }, ctx)
  expect(result.operationSummary.bigfoot?.total).toBe(7)
  expect(result.operationSummary.bigfoot?.longSummary).toContain('CW 7/7')
  const panel = registered.get('panel')?.hook as PanelHook
  const content = await panel.render(
    { panelKey: 'hunt', operation, qsoCount: 8, config: {}, reason: 'operation' },
    ctx,
  )
  expect(content.kind).toBe('markdown')
  if (content.kind !== 'markdown') throw new Error('Expected Markdown')
  expect(content.content).toContain('CW BIGFOOT complete!')
  expect(content.content).toContain('40m CW')
  const exporter = registered.get('export')?.hook as ExportHook
  const worksheet = await exporter.generateExport(
    { operation, qsos, exportType: 'bigfoot-csv' },
    ctx,
  )
  expect(worksheet.content).toContain('"O2","O2"')
  expect(worksheet.content).toContain('"Skunk Ape","Skunk Ape"')
  expect(worksheet.content.split('\r\n')).toHaveLength(10)
})
