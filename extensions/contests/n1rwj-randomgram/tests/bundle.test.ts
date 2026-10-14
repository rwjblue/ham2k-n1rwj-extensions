import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivityHook,
  AdifFieldsHook,
  CommandHook,
  ExportHook,
  ExtensionDefinition,
  HookContext,
  PanelHook,
  RegisterHookParams,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { renderTemplate, templateContext } from '@ham2k/extension-sdk'
import { expect, test, vi } from 'vitest'
import manifest from '../manifest.json'
import { KEYER_EXCHANGE_TEMPLATE } from '../src/keyer.ts'
import { object, type Qson, refOf } from '../src/model.ts'

test('the ES2020 distributable shares one literal across display, CW, saving and export', async () => {
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const module = await import(name)
        return [name, name === 'i18next' ? module.default : module]
      }),
    ),
  )
  const definitions: ExtensionDefinition[] = []
  const registered = new Map<string, RegisterHookParams>()
  let settings: Qson = { extensions: { 'extension_n1rwj-randomgram': {} } }
  const hostCall = vi.fn(async (method: string, params: Qson): Promise<unknown> => {
    if (method === 'getSettings') return settings
    if (method === 'setSettings') {
      expect(params.ns).toBe(manifest.key)
      settings = {
        extensions: {
          'extension_n1rwj-randomgram': {
            ...object(object(settings.extensions)['extension_n1rwj-randomgram']),
            ...object(params.values),
          },
        },
      }
      return null
    }
    throw new Error(`Unexpected host IO: ${method}`)
  })
  const invokeLocal = vi.fn(
    async (category: string, method: string, args: unknown, _online: boolean, key: string) => {
      expect([category, method, key]).toEqual(['export', 'generateExport', 'adif'])
      expect(args).toMatchObject({ mainHandler: manifest.key, exportType: 'adif' })
      return [{ key: 'adif', ok: true, value: { content: 'core-adif-export' } }]
    },
  )
  const sandbox = createContext({
    __polo: {
      sharedModules,
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
      invokeLocal,
    },
  })
  // These APIs are newer than the host's ES2020 sandbox. Removing them makes
  // accidental use fail in the distributable rather than only on a phone.
  runInContext('delete Object.hasOwn; delete Array.prototype.at', sandbox)
  runInContext(await readFile(new URL('../build/index.js', import.meta.url), 'utf8'), sandbox, {
    timeout: 5000,
  })
  expect(definitions).toHaveLength(1)
  const definition = definitions[0]
  if (!definition) throw new Error('Missing extension definition')
  expect(definition.key).toBe(manifest.key)
  expect(definition.domains).toEqual([])
  await definition.onActivation({
    hostCall,
    registerHook: (category, params) => registered.set(category, params),
  })
  expect([...registered.keys()].sort()).toEqual([...manifest.hooks].sort())
  expect([...registered.values()].every((params) => params.key === manifest.key)).toBe(true)
  expect(hostCall).not.toHaveBeenCalled()

  const ref: Qson = {
    type: 'randomgram',
    ref: 'RG#999',
    participant: 'K1TEST',
    alphabet: 'alphanumeric',
    txList: '0A9ZO\nXYZAB\nO01QT',
    txGroups: ['0A9ZO', 'XYZAB', 'O01QT'],
  }
  const operation: Qson = { uuid: 'bundle-operation', stationCall: 'K1TEST', refs: [ref] }
  const draft: Qson = {
    band: '20m',
    mode: 'CW',
    freq: 14055,
    startAtMillis: Date.UTC(2026, 0, 1, 12),
    our: { call: 'K1TEST', sent: '579' },
    their: { call: 'K2TEST', sent: '589' },
    refs: [{ type: 'randomgram', ourSerial: 1, theirGroup: 'VWXYZ' }],
  }
  const ctx: HookContext = { online: false, locale: 'en', appName: 'Ham2K Logger' }
  const activity = registered.get('activity')?.hook as ActivityHook
  const controls = await activity.loggingControls?.({ operation, qso: draft }, ctx)
  expect(controls?.find((control) => control.input.kind === 'serial')?.input).toMatchObject({
    kind: 'serial',
    sequence: { start: 1 },
  })
  const patch = await activity.processQsoBeforeSave?.({ operation, qso: draft }, ctx)
  expect(patch).toMatchObject({ our: { exchange: '0A9ZO' }, their: { exchange: 'VWXYZ' } })
  const saved: Qson = {
    ...draft,
    uuid: 'bundle-contact',
    our: { ...object(draft.our), ...object(patch?.our) },
    their: { ...object(draft.their), ...object(patch?.their) },
    refs: [{ ...refOf(draft), ...refOf(patch ?? {}) }],
  }

  const sourceTemplate = await readFile(
    new URL('../assets/KEYER_EXCHANGE.liquid', import.meta.url),
    'utf8',
  )
  const packagedTemplate = await readFile(
    new URL('../build/assets/KEYER_EXCHANGE.liquid', import.meta.url),
    'utf8',
  )
  expect(sourceTemplate.trim()).toBe(KEYER_EXCHANGE_TEMPLATE.trim())
  expect(packagedTemplate.trim()).toBe(sourceTemplate.trim())
  expect(renderTemplate(packagedTemplate.trim(), templateContext({ operation, qso: draft }))).toBe(
    '57N 0A9ZO',
  )
  expect(
    renderTemplate(
      packagedTemplate.trim(),
      templateContext({ operation, qso: { ...draft, refs: [{ type: 'randomgram' }] } }),
    ),
  ).toBe('')
  const panel = registered.get('panel')?.hook as PanelHook
  const display = await panel.render(
    { operation, qso: draft, config: {}, panelKey: 'exchange', qsoCount: 0, reason: 'qso' },
    ctx,
  )
  expect(display.kind).toBe('svgScene')
  if (display.kind !== 'svgScene') throw new Error('Missing native scene')
  expect(display.scene.layers.find((layer) => layer.id === 'tx-group')?.text?.literal).toBe('0A9ZO')
  const adifFields = registered.get('adifFields')?.hook as AdifFieldsHook
  expect(await adifFields.fieldsForOneQSO({ operation, qso: saved }, ctx)).toEqual(
    expect.arrayContaining([
      { name: 'STX_STRING', value: '0A9ZO' },
      { name: 'SRX_STRING', value: 'VWXYZ' },
    ]),
  )

  const command = registered.get('command')?.hook as CommandHook
  const preview = await command.interpret({ input: 'RGSKIP 2', operation, qso: draft }, ctx)
  expect(preview?.describe).toContain('XYZAB')
  expect(hostCall.mock.calls.map(([method]) => method)).toEqual(['getSettings'])
  const retired = await command.interpret(
    { input: 'RGSKIP 2', operation, qso: draft, execute: true },
    ctx,
  )
  expect(retired?.commands?.[0].addQso).toMatchObject({
    refs: [{ skipped: true, ourGroup: 'XYZAB' }],
  })
  const listening = await command.interpret({ input: 'RGSWL LMNOP', operation, execute: true }, ctx)
  const swl: Qson = {
    ...listening?.commands?.[0].addQso,
    uuid: 'bundle-listening',
    startAtMillis: Date.UTC(2026, 0, 1, 12, 1),
  }
  const skipped: Qson = {
    ...retired?.commands?.[0].addQso,
    uuid: 'bundle-skipped',
    startAtMillis: Date.UTC(2026, 0, 1, 12, 2),
  }
  const nextControls = await activity.loggingControls?.({ operation }, ctx)
  expect(nextControls?.find((control) => control.input.kind === 'serial')?.input).toMatchObject({
    sequence: { start: 3 },
  })
  expect(hostCall.mock.calls.map(([method]) => method)).toEqual(['getSettings', 'setSettings'])

  const qsos = [saved, swl, skipped]
  const scoring = registered.get('scoring')?.hook as ScoringHook
  const score = await scoring.scoreQsos({ operation, ref, qsos }, ctx)
  expect(score.qsoScores['bundle-contact'].dupe).toBe(false)
  expect(score.operationSummary.randomgram).toMatchObject({
    summary: '1 TX / 2 RX',
    txGroups: 1,
    rxGroups: 2,
    organizerAdjudicated: false,
  })
  const exporter = registered.get('export')?.hook as ExportHook
  const submission = await exporter.generateExport(
    { operation, qsos, exportType: 'randomgram-text' },
    ctx,
  )
  expect(submission.content).toBe('K1TEST\n\nVWXYZ\nLMNOP\n')
  expect(submission.content).not.toContain('0A9ZO')
  const adif = await exporter.generateExport(
    { operation, qsos, exportType: 'randomgram-adif' },
    ctx,
  )
  expect(adif.content).toBe('core-adif-export')
  expect(invokeLocal).toHaveBeenCalledExactlyOnceWith(
    'export',
    'generateExport',
    expect.objectContaining({ qsos: [saved], mainHandler: manifest.key }),
    undefined,
    'adif',
  )
  expect(hostCall.mock.calls.map(([method]) => method)).toEqual(['getSettings', 'setSettings'])
})
