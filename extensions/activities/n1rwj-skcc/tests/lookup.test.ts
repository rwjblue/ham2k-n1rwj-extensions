import type { AnnotatedCallInfo, HookContext } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createLookup } from '../src/lookup.ts'
import type { Qson } from '../src/model.ts'
import { parseRoster } from '../src/roster.ts'

const roster = parseRoster(
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS\n1C|K1ABC|Alice [a](b)<i>|MA||291|02 Jan 2006|15 Jan 2007||||A\n2|K2ABC/SK|Bob|ON|K2ABC|1|01 Feb 2006|||||SK',
)
const lookup = createLookup(() => roster)
const ctx: HookContext = { online: false, getQsos: vi.fn(), getHistoryForCall: vi.fn() }
const query = (qso: Qson = {}, callInfo: AnnotatedCallInfo = { call: 'K1ABC' }) =>
  lookup.lookupCall({ qso, operation: {}, callInfo }, ctx)

describe('SKCC global lookup', () => {
  it('supplies offline identity annotations and name fallback without claiming participation', async () => {
    const result = (await query())[0]
    expect(result).toMatchObject({
      call: 'K1ABC',
      source: 'n1rwj-skcc',
      scope: 'general',
      name: 'Alice [a](b)<i>',
      notes: expect.arrayContaining(['**SKCC 1C** · Member']),
    })
    expect(result).not.toHaveProperty('note')
    expect(result).not.toHaveProperty('emoji')
    expect(result).not.toHaveProperty('refs')
    expect(result).not.toHaveProperty('online')
    expect(result).not.toHaveProperty('state')
    expect(JSON.stringify(result.notes)).toContain('Roster SPC: MA')
    expect(ctx.getQsos).not.toHaveBeenCalled()
    expect(ctx.getHistoryForCall).not.toHaveBeenCalled()
  })
  it('preserves corrected and deliberately cleared calls, names, SPC and membership numbers', async () => {
    expect(await query({ their: { call: '' } })).toEqual([])
    expect(await query({ their: { call: null } })).toEqual([])
    expect((await query({ their: { call: 'K2ABC' } }))[0]).toMatchObject({
      call: 'K2ABC',
      notes: expect.arrayContaining(['**SKCC 2** · Silent key']),
    })
    for (const name of ['', 'Copied Name', null])
      expect((await query({ their: { name } }))[0]).not.toHaveProperty('name')
    const result = (await query({ refs: [{ type: 'skcc', name: '', spc: '' }] }))[0]
    expect(result).not.toHaveProperty('name')
    expect(JSON.stringify(result.notes)).not.toContain('Alice')
    expect(JSON.stringify(result.notes)).not.toContain('Roster SPC')
    expect(await query({ refs: [{ type: 'skcc', number: '' }] })).toEqual([])
    expect((await query({}, { call: 'K1ABC', name: 'Previous source' }))[0]).not.toHaveProperty(
      'name',
    )
  })
  it('augments QRZ and call notes without taking over the compact name line or station details', async () => {
    const callInfo = {
      call: 'K1ABC',
      name: 'Alice “Ali” Anderson',
      location: 'Austin, TX',
      city: 'Austin',
      state: 'TX',
      grid: 'EM10aa',
      image: 'https://example.org/qrz-photo.jpg',
      note: 'A friend from the local club',
      emoji: '👋',
    }
    const original = structuredClone(callInfo)
    const [result] = await query({}, callInfo)
    expect(callInfo).toEqual(original)
    expect(result).toMatchObject({
      call: 'K1ABC',
      source: 'n1rwj-skcc',
      notes: expect.arrayContaining(['**SKCC 1C** · Member']),
    })
    // These flat fields enter the host's first-answer-wins merge; `note`
    // additionally hides the name in the compact logging UI.
    for (const field of ['name', 'note', 'emoji', 'image', 'location', 'city', 'state', 'grid'])
      expect(result).not.toHaveProperty(field)
  })
  it('escapes external text in markdown and skips unknown or unavailable members', async () => {
    const notes = (await query())[0].notes?.join('\n')
    expect(notes).toContain('Alice \\[a\\]\\(b\\)&lt;i&gt;')
    expect(await query({}, { call: 'K9XYZ' })).toEqual([])
    expect(
      await createLookup(() => undefined).lookupCall(
        { qso: {}, operation: {}, callInfo: { call: 'K1ABC' } },
        ctx,
      ),
    ).toEqual([])
  })
})
