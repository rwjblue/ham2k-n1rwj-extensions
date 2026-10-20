import type { HookContext } from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import {
  type MatchRequest,
  maxFilterCalls,
  readDescriptor,
  readMatches,
} from '../../../../packages/spot-filters/src/index.ts'
import { BigfootSpotFilter } from '../src/spot-filter.ts'

const ctx = new Proxy({} as HookContext, {
  get(_target, key) {
    throw new Error(`Static roster must not read context: ${String(key)}`)
  },
})

it('offers the fixed 2026 roster without selecting itself or reading operation context', async () => {
  const result = await BigfootSpotFilter.describe({}, ctx)
  expect(readDescriptor(result)).toEqual({
    version: 1,
    label: 'BIGFOOT 2026',
    available: true,
    defaultSelected: false,
  })
})

it('normalizes and matches only the full event calls, including the W4S bonus', async () => {
  const calls = [
    ' w7b ',
    'w7i',
    'W7G',
    'W7F',
    'w7o',
    'W7O',
    'W7T',
    'W4S',
    'W3S',
    'W7B/P',
    'EA8/W7I',
    'W7G/W2ABC',
    'W7OO',
    'W4S/4',
    '',
    'K1ABC',
  ]
  const original = [...calls]
  expect(await BigfootSpotFilter.matchCalls({ version: 1, calls }, ctx)).toEqual({
    version: 1,
    available: true,
    calls: ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7T', 'W4S'],
  })
  expect(calls).toEqual(original)
})

it('returns a validated subset for normalized consumers, including empty and nonmatching batches', async () => {
  for (const calls of [[], ['W3S', 'K1ABC'], ['W7O', 'W7O', 'W4S']]) {
    const result = await BigfootSpotFilter.matchCalls({ version: 1, calls }, ctx)
    expect(readMatches(result, calls)).toEqual(result)
    expect(result.available).toBe(true)
  }
  const calls = Array(maxFilterCalls).fill('W7O')
  expect(await BigfootSpotFilter.matchCalls({ version: 1, calls }, ctx)).toEqual({
    version: 1,
    available: true,
    calls: ['W7O'],
  })
})

it.each([
  undefined,
  null,
  {},
  { version: 2, calls: ['W7B'] },
  { version: 1, calls: 'W7B' },
  { version: 1, calls: [null] },
  { version: 1, calls: [42] },
  { version: 1, calls: ['W'.repeat(65)] },
  { version: 1, calls: Array(maxFilterCalls + 1).fill('W7B') },
])('rejects malformed or oversized requests: %j', async (request) => {
  await expect(BigfootSpotFilter.matchCalls(request as MatchRequest, ctx)).rejects.toThrow(
    'Unsupported spot call-filter request',
  )
})
