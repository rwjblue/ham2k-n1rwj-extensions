import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  ExtensionDefinition,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import manifest from '../manifest.json'
import { contact, ctx, operation } from './fixtures.ts'

it('activates in an ES2020 sandbox, scores and suggests exchanges without data-file/network hooks', async () => {
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
  const scoring = registered.get('scoring')?.hook as ScoringHook
  expect(scoring).toMatchObject({ scope: { refTypes: ['wrt'] } })
  const result = await scoring.scoreQsos({ operation, qsos: [contact('DL1ABC', '20m', 'DL')] }, ctx)
  expect(result.operationSummary.wrt).toMatchObject({ points: 1, mults: 1, total: 1 })
  const resumed = await scoring.scoreQsos(
    {
      operation,
      qsos: [contact('DL1ABC', '40m', 'DL')],
      resumeFrom: JSON.parse(JSON.stringify(result.scoresheet)),
    },
    ctx,
  )
  expect(resumed.operationSummary.wrt).toMatchObject({ points: 2, mults: 1, total: 2 })
  const activity = registered.get('activity')?.hook as ActivityHook
  const controls = await activity.loggingControls?.(
    { operation, qso: { their: { call: 'DL1ABC', entityPrefix: 'DL' } } },
    {
      ...ctx,
      getQsos: async () => [contact('DL1ABC', '20m', 'DL'), contact('DL1ABC', '40m', 'DL')],
    },
  )
  expect(controls?.map(({ input }) => input)).toMatchObject([
    { suggestedValue: 'BOB' },
    { suggestedValue: 'DL' },
  ])
})
