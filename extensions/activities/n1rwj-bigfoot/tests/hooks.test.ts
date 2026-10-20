import assert from 'node:assert/strict'
import type { ExtensionDefinition, RegisterHookParams } from '@ham2k/extension-sdk'
import { afterEach, test, vi } from 'vitest'
import manifest from '../manifest.json' with { type: 'json' }
import {
  BigfootActivity,
  BigfootRefHandler,
  eventFromOperation,
  RULES_URL,
} from '../src/activity.ts'
import { EVENT_2026 } from '../src/rules.ts'

const definitions = vi.hoisted(() => [] as ExtensionDefinition[])
vi.mock('@ham2k/extension-sdk', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@ham2k/extension-sdk')>()
  return {
    ...sdk,
    defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
  }
})

afterEach(() => vi.useRealTimers())

test('activation registers the promised hooks without host access', async () => {
  await import('../src/index.ts')
  assert.equal(definitions.length, 1)
  assert.equal(definitions[0].key, manifest.key)
  const registered = new Map<string, RegisterHookParams>()
  const hostCall = vi.fn(async () => {
    throw new Error('Unexpected activation host call')
  })
  await definitions[0].onActivation({
    hostCall,
    registerHook(category, params) {
      registered.set(category, params)
    },
  })
  assert.deepEqual([...registered.keys()].sort(), [...manifest.hooks].sort())
  assert.equal(registered.get('activity')?.hook, BigfootActivity)
  assert.equal(registered.get('ref:bigfoot')?.hook, BigfootRefHandler)
  assert.equal(registered.get('lookup')?.priority, 110)
  assert.ok(registered.has('spotCallFilter:v1'))
  assert.equal(hostCall.mock.calls.length, 0)
})

test('only the confirmed edition is offered and stored in setup', async () => {
  const suggestions = await BigfootActivity.suggest({
    searchTerm: 'BIGFOOT',
    scoped: false,
    operation: {},
  })
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].ref, '2026')
  const controls = await BigfootActivity.operationControls()
  const elements = controls[0].input.form.elements
  const select = elements.find((element) => element.type === 'field' && element.key === 'ref')
  assert.ok(select && select.type === 'field')
  assert.equal(select.value, '2026')
  assert.deepEqual(select.options, [{ value: '2026', label: '2026 · October 13–21 UTC' }])
})

test('nearby suggestions span the thirty-day lead through the event end, without annual extrapolation', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const nearby = () => BigfootActivity.suggest({ operation: {}, scoped: false })
  const lead = EVENT_2026.startAtMillis - 30 * 86_400_000
  vi.setSystemTime(lead - 1)
  assert.deepEqual(await nearby(), [])
  vi.setSystemTime(lead)
  assert.equal((await nearby()).length, 1)
  vi.setSystemTime(EVENT_2026.startAtMillis)
  assert.equal((await nearby()).length, 1)
  vi.setSystemTime(EVENT_2026.endAtMillis - 1)
  assert.equal((await nearby()).length, 1)
  vi.setSystemTime(EVENT_2026.endAtMillis)
  assert.deepEqual(await nearby(), [])
  vi.setSystemTime(Date.UTC(2027, 9, 20))
  assert.deepEqual(await nearby(), [])
})

test('explicit and scoped searches find the past confirmed edition but reject unrelated searches', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2028, 0, 1))
  for (const searchTerm of ['bigfoot', 'sasquatch', 'skunk ape', 'W7O', '2026']) {
    const result = await BigfootActivity.suggest({ operation: {}, searchTerm })
    assert.equal(result[0]?.ref, '2026')
  }
  assert.equal((await BigfootActivity.suggest({ operation: {}, scoped: true }))[0]?.ref, '2026')
  for (const searchTerm of ['pota', '2027', 'bigfoot 2027'])
    assert.deepEqual(await BigfootActivity.suggest({ operation: {}, searchTerm }), [])
})

test('reference handling preserves unknown editions without claiming a schedule or rules', async () => {
  const known = { type: 'bigfoot', ref: '2026' }
  assert.deepEqual(await BigfootRefHandler.validateRef({ ref: known }), {
    valid: true,
    normalized: '2026',
  })
  assert.equal((await BigfootRefHandler.decorateRef({ ref: known })).label, 'BIGFOOT Hunt 2026')
  assert.deepEqual(await BigfootRefHandler.suggestOperationTitle({ ref: known, operation: {} }), {
    for: 'BIGFOOT Hunt 2026',
    priority: 100,
  })
  assert.equal((await BigfootRefHandler.linkForRef({ ref: known }))?.url, RULES_URL)
  const unknown = { type: 'bigfoot', ref: '2027' }
  assert.deepEqual(await BigfootRefHandler.validateRef({ ref: unknown }), { valid: false })
  const decorated = await BigfootRefHandler.decorateRef({ ref: unknown })
  assert.equal(decorated.ref, '2027')
  assert.match(decorated.label ?? '', /unknown edition/)
  assert.equal(await BigfootRefHandler.suggestOperationTitle({ ref: unknown, operation: {} }), null)
  assert.equal(await BigfootRefHandler.linkForRef({ ref: unknown }), null)
})

test('only a BIGFOOT operation ref selects event rules', () => {
  assert.equal(eventFromOperation({ refs: [{ type: 'bigfoot', ref: '2026' }] }), EVENT_2026)
  for (const refs of [[], [{ type: 'bigfoot', ref: '2027' }], [{ type: 'custom', ref: '2026' }]])
    assert.equal(eventFromOperation({ refs }), undefined)
})
