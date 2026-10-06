import { hooks, prepareExportOption, resolveExportSettings } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import mstManifest from '../../../extensions/contests/n1rwj-mst/manifest.json'
import { config as mst } from '../../../extensions/contests/n1rwj-mst/src/config.ts'
import sstManifest from '../../../extensions/contests/n1rwj-sst/manifest.json'
import { config as sst } from '../../../extensions/contests/n1rwj-sst/src/config.ts'
import wrtManifest from '../../../extensions/contests/n1rwj-wrt/manifest.json'
import { config as wrt } from '../../../extensions/contests/n1rwj-wrt/src/config.ts'
import { createExports } from '../src/exports.ts'
import type { Qson } from '../src/model.ts'

const ctx = { online: false }
const contests = [
  [mst, mstManifest, '2026-10-05-1300'],
  [sst, sstManifest, '2026-10-05-0000'],
  [wrt, wrtManifest, '2026-10-09-0145'],
] as const

function operationFor(type: string, session: string): Qson {
  return {
    stationCall: 'N1RWJ',
    refs: [{ type, ref: session, ourName: 'ROB', ourLocation: 'RI', power: 'LP' }],
  }
}

function qsoFor(type: string, mode: string): Qson {
  return {
    their: { call: 'K1ABC' },
    refs: [{ type, ourSerial: 1, theirSerial: '023', name: 'BOB', location: 'MA' }],
    mode,
    band: '20m',
    freq: 14080,
    startAtMillis: Date.parse('2026-10-05T13:01:00Z'),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('contest export registration', () => {
  it('registers six independent activity/format settings without requiring an operation', async () => {
    const types: string[] = []
    for (const [config, manifest] of contests) {
      const { exports } = createExports(config, manifest)
      const definitions = await exports.getExportTypes()
      expect(definitions).toEqual([
        {
          exportType: `${config.type}-adif`,
          activationType: config.type,
          format: 'adif',
          label: config.shortName,
          defaults: undefined,
        },
        {
          exportType: `${config.type}-cabrillo`,
          activationType: config.type,
          format: 'cabrillo',
          label: config.shortName,
          defaults: undefined,
        },
      ])
      types.push(...definitions.map(({ exportType }) => exportType))
      expect(await exports.suggestExportOptions({ operation: {}, qsos: [] }, ctx)).toEqual([])
    }
    expect(new Set(types).size).toBe(6)
  })

  it('offers registered types with session metadata for custom and compact filenames', async () => {
    for (const [config, manifest, session] of contests) {
      const { exports } = createExports(config, manifest)
      const operation = operationFor(config.type, session)
      const qsos = [qsoFor(config.type, config.mode)]
      const definitions = await exports.getExportTypes()
      for (const compact of [false, true]) {
        const options = await exports.suggestExportOptions(
          { operation, qsos, compactFilenames: compact },
          ctx,
        )
        expect(options.map(({ exportType }) => exportType)).toEqual(
          definitions.map(({ exportType }) => exportType),
        )
        for (const [index, option] of options.entries()) {
          const definition = definitions[index]
          if (!definition) throw new Error('Expected a registered contest export type')
          expect(option.templateData).toEqual({ activity: `${config.shortName}-${session}` })
          const prepared = prepareExportOption(
            {
              ...option,
              exportSettings: resolveExportSettings(
                definition,
                {},
                {
                  customTemplates: true,
                  filenameTemplate: '{{ log.activity }} {{ log.station }}',
                  compactFilenameTemplate: '{{ log.station }}-{{ log.activity }}',
                },
              ),
            },
            operation,
            qsos,
            compact,
          )
          expect(prepared.filename).toBe(
            `${compact ? `N1RWJ-${config.shortName}-${session}` : `${config.shortName}-${session} N1RWJ`}.${index ? 'log' : 'adi'}`,
          )
        }
        const cabrillo = options[1]
        if (!cabrillo) throw new Error('Expected the Cabrillo option')
        expect(
          (
            await exports.generateExport(
              { operation, qsos, exportType: cabrillo.exportType, compactFilenames: compact },
              ctx,
            )
          ).filename,
        ).toBe(cabrillo.filename)
      }
    }
  })

  it('keeps legacy file generation equivalent and refuses core or other contest export types', async () => {
    const invoke = vi
      .spyOn(hooks, 'invokeOne')
      .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<eoh>\n<eor>' } }])
    for (const [config, manifest, session] of contests) {
      const { exports } = createExports(config, manifest)
      const operation = operationFor(config.type, session)
      const qsos = [qsoFor(config.type, config.mode)]
      for (const [registered, legacy] of [
        [`${config.type}-cabrillo`, 'cabrillo'],
        [`${config.type}-adif`, 'contest-adif'],
      ]) {
        expect(
          await exports.generateExport({ operation, qsos, exportType: registered }, ctx),
        ).toEqual(await exports.generateExport({ operation, qsos, exportType: legacy }, ctx))
      }
      const previous = invoke.mock.calls.length
      for (const args of [
        { operation, qsos, exportType: 'adif' },
        { operation, qsos, exportType: 'cwt-adif' },
        { operation: {}, qsos, exportType: 'contest-adif' },
      ]) {
        expect(await exports.generateExport(args, ctx)).toEqual({
          filename: '',
          mimeType: '',
          content: '',
        })
      }
      expect(invoke).toHaveBeenCalledTimes(previous)
    }
    expect(invoke).toHaveBeenCalledTimes(6)
  })
})
