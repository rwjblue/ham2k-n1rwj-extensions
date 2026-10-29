import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  DataFileDefinition,
  ExportHook,
  ExtensionDefinition,
  PanelHook,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import manifest from '../manifest.json'
import { contact, ctx, operation } from './fixtures.ts'

it('activates with cached native history, QSY guidance and no network calls or spotting hooks', async () => {
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
  if (!definition) throw new Error('Missing extension')
  definition.onActivation({
    registerHook: (category, hook) => registered.set(category, hook),
    hostCall: async (method) => {
      throw new Error(`Unexpected host call: ${method}`)
    },
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect(manifest.domains).toEqual([])
  expect(manifest.api).toBe(11)
  expect(registered.has('spots')).toBe(false)
  expect(registered.has('spotCallFilter:v1')).toBe(false)
  const data = registered.get('dataFile')?.hook as DataFileDefinition
  expect(data.url).toBe('n1mm-history:SPRINTNS')
  data.onLoadRawData?.({
    schema: 1,
    body: '# NS\n!!Order!!,Call,Name,State\nW8ABC,ANN,MI\n',
    url: 'https://n1mmwp.hamdocs.com/mmfile/get/file/SPRINTNS.txt',
    fetchedAt: '2026-10-29T12:00:00Z',
  })
  const scoring = registered.get('scoring')?.hook as ScoringHook
  expect(scoring).toMatchObject({ scope: { refTypes: ['ns'] } })
  const initial = await scoring.scoreQsos(
    { operation, qsos: [contact('KH6ABC', '20m', 'HI')] },
    ctx,
  )
  expect(initial.operationSummary.ns).toMatchObject({ points: 1, mults: 1, total: 1 })
  const result = await scoring.scoreQsos(
    {
      operation,
      qsos: [
        contact('KH6ABC', '40m', 'HI'),
        contact('PJ2ABC', '20m', 'PJ2'),
        contact('DL1ABC', '20m', 'DX'),
      ],
      resumeFrom: JSON.parse(JSON.stringify(initial.scoresheet)),
    },
    ctx,
  )
  expect(result.operationSummary.ns).toMatchObject({ points: 4, mults: 3, total: 12 })
  const activity = registered.get('activity')?.hook as ActivityHook
  const qso = contact('PJ2ABC', '20m', 'PJ2')
  const controls = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'PJ2ABC' } } },
    ctx,
  )
  expect(controls?.[0]?.input).toMatchObject({
    kind: 'serial',
    sequence: { key: 'ns-serial', start: 1 },
  })
  expect(controls?.[1]?.input).not.toHaveProperty('suggestedValue')
  expect(controls?.[3]?.input).toMatchObject({ suggestedValue: 'PJ2' })
  expect(controls?.[4]?.input).toMatchObject({
    kind: 'options',
    field: 'role',
    options: [{ code: 'CQ' }, { code: 'SP' }, { code: 'UNKNOWN' }],
  })
  const prefilled = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'W8ABC' } } },
    ctx,
  )
  expect(prefilled?.[2]?.input).toMatchObject({ suggestedValue: 'ANN' })
  expect(prefilled?.[3]?.input).toMatchObject({ suggestedValue: 'MI' })
  const panel = registered.get('panel')?.hook as PanelHook
  expect(
    await panel.render(
      { panelKey: 'ns-guide', operation, qsoCount: 4, config: {}, reason: 'operation' },
      ctx,
    ),
  ).toMatchObject({ kind: 'markdown', content: expect.stringContaining('Reminders are advisory') })
  expect(await activity.processQsoBeforeSave?.({ operation, qso }, ctx)).toEqual({
    our: { exchange: '7' },
    their: { exchange: '42 BOB PJ2' },
  })
  const exports = registered.get('export')?.hook as ExportHook
  const exported = await exports.generateExport(
    { operation, qsos: [qso], exportType: 'ns-cabrillo' },
    ctx,
  )
  expect(exported.content).toContain('N1RWJ 7 ROB RI PJ2ABC 42 BOB PJ2')
})
