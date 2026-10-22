import type { HookContext } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import {
  type MatchRequest,
  maxFilterCalls,
  readDescriptor,
  readMatches,
} from '../../../../packages/spot-filters/src/index.ts'
import type { Roster } from '../src/model.ts'
import { parseRoster } from '../src/roster.ts'
import { createSpotFilter } from '../src/spot-filter.ts'

const body =
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS\n1C|K1ABC|Alice|MA|W1OLD, W1SHARED|291|02 Jan 2006|15 Jan 2007||||A\n2|K2ABC/SK|Bob|NY|K2ABC, W1SHARED|291|02 Jan 2006|||||SK\n3|K3ABC|Charlie|CA||291|02 Jan 2006|||||IA'
const ctx = new Proxy({} as HookContext, {
  get(_target, key) {
    throw new Error(`No log reads in filter: ${String(key)}`)
  },
})

describe('SKCC member spot filter', () => {
  it('does not select itself and reports unavailable until offline data is loaded', async () => {
    let roster: Roster | undefined
    const filter = createSpotFilter(() => roster)
    expect(readDescriptor(await filter.describe({}, ctx))).toMatchObject({
      version: 1,
      available: false,
      defaultSelected: false,
    })
    expect(await filter.matchCalls({ version: 1, calls: ['K1ABC'] }, ctx)).toMatchObject({
      available: false,
      calls: [],
    })
    roster = parseRoster(body)
    expect(readDescriptor(await filter.describe({}, ctx))).toMatchObject({
      label: 'SKCC members',
      available: true,
      defaultSelected: false,
    })
    roster = undefined
    expect((await filter.matchCalls({ version: 1, calls: ['K1ABC'] }, ctx)).available).toBe(false)
  })
  it('matches only unambiguous active identities while preserving input and deduplicating matches', async () => {
    const filter = createSpotFilter(() => parseRoster(body))
    const calls = [
      'K1ABC',
      'K1ABC',
      'K1ABC/P',
      'EA8/K1ABC',
      'W1OLD',
      'W1SHARED',
      'K2ABC',
      'K2ABC/SK',
      'K3ABC',
      'K1ABC/SK',
      'K1ABC/EX/P',
      'K1ABC/K9XYZ',
      'K9XYZ',
    ]
    const previous = [...calls]
    const result = await filter.matchCalls({ version: 1, calls }, ctx)
    expect(result).toEqual({
      version: 1,
      available: true,
      calls: ['K1ABC', 'K1ABC/P', 'EA8/K1ABC', 'W1OLD'],
    })
    expect(readMatches(result, calls)).toEqual(result)
    expect(calls).toEqual(previous)
    expect((await filter.matchCalls({ version: 1, calls: [' k1abc '] }, ctx)).calls).toEqual([
      'K1ABC',
    ])
    expect(
      (await filter.matchCalls({ version: 1, calls: Array(maxFilterCalls).fill('K1ABC') }, ctx))
        .calls,
    ).toEqual(['K1ABC'])
  })
  it.each([
    undefined,
    null,
    {},
    { version: 2, calls: [] },
    { version: 1, calls: 'K1ABC' },
    { version: 1, calls: [null] },
    { version: 1, calls: ['A'.repeat(65)] },
    { version: 1, calls: Array(maxFilterCalls + 1).fill('K1ABC') },
  ])('rejects malformed requests %j', async (args) => {
    await expect(
      createSpotFilter(() => undefined).matchCalls(args as MatchRequest, ctx),
    ).rejects.toThrow('Unsupported spot call-filter request')
  })
})
