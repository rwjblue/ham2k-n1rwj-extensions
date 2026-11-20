import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import type { ExtensionDefinition, JSONValue, KeyerSetsHook } from '@ham2k/extension-sdk'
import { renderTemplate, templateContext } from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { selectExtensions } from '../scripts/lib/extensions.ts'

const contests = [
  { contest: 'SST', type: 'sst', setup: { ourLocation: ' dx ' }, exchange: 'ROB DX' },
  { contest: 'CWT', type: 'cwt', setup: { ourNumber: ' 109 ' }, exchange: 'ROB 109' },
  { contest: 'MST', type: 'mst', setup: {}, exchange: '109 ROB' },
] as const

it.each(contests)(
  '$contest offers the standalone set and keys the live contest exchange',
  async ({ contest, type, setup, exchange }) => {
    const key = `n1rwj-${type}`
    const [{ dir, manifest }] = await selectExtensions(process.cwd(), key)
    const sharedModules = Object.fromEntries(
      await Promise.all(
        Object.keys(manifest.sharedDependencies ?? {}).map(async (name) => {
          const module = await import(name)
          return [name, name === 'i18next' ? module.default : module]
        }),
      ),
    )
    const definitions: ExtensionDefinition[] = []
    runInNewContext(
      await readFile(`${dir}/build/index.js`, 'utf8'),
      {
        __polo: {
          sharedModules,
          defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
        },
      },
      { timeout: 5000 },
    )
    expect(definitions).toHaveLength(1)
    const hooks: KeyerSetsHook[] = []
    await definitions[0].onActivation({
      registerHook(category, { hook }) {
        if (category === 'keyerSets') hooks.push(hook as KeyerSetsHook)
      },
      async hostCall(method) {
        throw new Error(`Unexpected host call: ${method}`)
      },
    })
    expect(manifest.api).toBe(21)
    expect(manifest.hooks).toContain('keyerSets')
    expect(hooks).toHaveLength(1)
    const sets = await hooks[0].getSets({}, { online: false, locale: 'en' })

    const standalone = await readFile(`${dir}/build/assets/${contest}.h2kset`, 'utf8')
    expect(standalone).toBe(await readFile(`${dir}/assets/${contest}.h2kset.json`, 'utf8'))
    const { name, messages, labels } = JSON.parse(standalone)
    expect(JSON.parse(standalone)).toMatchObject({ 'ham2k-set': 1, kind: 'cw-messages' })
    expect(sets).toEqual([{ kind: 'cw', id: `${type}-cw`, name, messages, labels }])
    const [set] = sets
    if (set.kind !== 'cw') throw new Error('Expected a CW set')
    const { messages: cwMessages } = set
    expect(set.labels).toHaveLength(8)

    const operationRef = { type, ourName: ' Rob Jackson ', ...setup }
    const qso = {
      their: { call: 'W1AW?' },
      refs: [
        { type: 'other-contest', ourSerial: 42 },
        { type: 'mst', ourSerial: 109 },
      ],
    }
    function expand(refs: Record<string, JSONValue>[], draft: Record<string, JSONValue> = qso) {
      return cwMessages.map((message, index) =>
        renderTemplate(
          message,
          templateContext({
            operation: { stationCall: 'n0dev/p, N1DEV', refs },
            qso: draft,
            keyer: { messages: cwMessages, current: index + 1 },
          }),
        ),
      )
    }
    expect(expand([operationRef])).toEqual([
      `CQ ${contest} N0DEV/P`,
      exchange,
      `TU N0DEV/P ${contest}`,
      'N0DEV/P',
      'W1AW?',
      exchange,
      'QRS PSE',
      'AGN?',
    ])
    const station = expand([operationRef], { ...qso, our: { call: 'n1dev' } })
    expect([station[0], station[2], station[3]]).toEqual([
      `CQ ${contest} N1DEV`,
      `TU N1DEV ${contest}`,
      'N1DEV',
    ])
    const incomplete = expand([{ ...operationRef, ourName: ' ' }])
    expect([incomplete[1], incomplete[5]]).toEqual(['', ''])
    expect(expand([{ ...operationRef, type: 'other-contest' }])[1]).toBe('')
    if (type === 'cwt') {
      expect(expand([{ ...operationRef, ourNumber: 'cwa' }])[1]).toBe('ROB CWA')
      expect(expand([{ ...operationRef, ourNumber: 've3' }])[1]).toBe('ROB VE3')
    }
    if (type === 'mst') {
      expect(
        expand([operationRef], { ...qso, refs: [{ type: 'other-contest', ourSerial: 42 }] })[1],
      ).toBe('')
      expect(expand([operationRef], { ...qso, refs: [{ type: 'mst', ourSerial: 110 }] })[1]).toBe(
        '110 ROB',
      )
    }
  },
)
