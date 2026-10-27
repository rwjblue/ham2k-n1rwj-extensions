import type { HookContext, PanelContent } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createChasing } from '../src/chasing.ts'
import { createData } from '../src/data.ts'
import { createLookup } from '../src/lookup.ts'
import { callKeys, DAY, findMember, type Qson, ROSTER_URL, workedMembers } from '../src/model.ts'
import { createPanel, spotRows } from '../src/panel.ts'
import { parseRoster } from '../src/roster.ts'
import { args, at, body, entries, qso, roster, spot } from './fixtures.ts'

const ctx: HookContext = { online: false }
function markdown(content: PanelContent) {
  if (content.kind !== 'markdown') throw new Error(`Expected Markdown, got ${content.kind}`)
  return content.content
}
describe('public roster and portable identity', () => {
  it('projects the v2 feed into indexed public member identities', () => {
    const data = roster()
    expect(data.members).toHaveLength(3)
    expect(data.byCall.get('N0BBB')).toEqual({
      number: 2,
      call: 'N0BBB',
      name: 'Blair',
      qth: 'Rhode Island',
      sponsor: 1,
    })
    expect(data.members[0]).not.toHaveProperty('photo')
    expect(data.generatedAt).toBe(at)
  })
  it.each(['n0bbb', 'N0BBB/P', 'F/N0BBB', 'N0BBB/1', 'N0BBB/QRP'])('recognizes %s', (call) => {
    expect(findMember(roster(), call)?.number).toBe(2)
  })
  it.each(['N0BBB/W9HUNT', 'N0BBB/SK', 'N0BBB/EX', '', 'N0BBB,VE3ABC'])(
    'never guesses ambiguous or historical identity %s',
    (call) => {
      expect(findMember(roster(), call)).toBeUndefined()
    },
  )
  it('prefers a full callsign match to a portable fallback', () => {
    expect(callKeys('F/N0BBB')).toEqual(['F/N0BBB', 'N0BBB'])
  })
  it('retains a legacy source typo without rejecting valid members or guessing O/zero corrections', () => {
    const data = parseRoster(
      body([...entries, { ...entries[0], bkg_number: 4, callsign: 'KOCSM' }]),
      at,
    )
    expect(data.byNumber.get(4)?.call).toBe('KOCSM')
    expect(findMember(data, 'N0BBB')?.number).toBe(2)
    expect(findMember(data, 'K0CSM')).toBeUndefined()
  })
  it.each([
    '<html>Unavailable</html>',
    body([], {}),
    body(entries, { schema_version: '3' }),
    body(entries, { generated_at: 'bad' }),
    body(entries, { content_hash: 'bad' }),
    body([...entries, entries[0]]),
    body([{ ...entries[0], bkg_number: -1 }]),
    body([{ ...entries[0], sponsor_bkg_number: 99 }]),
    body([{ ...entries[0], callsign: 'N0AAA/P' }]),
  ])('rejects invalid snapshots without creating a partial roster', (value) => {
    expect(() => parseRoster(value, at)).toThrow()
  })
})
describe('native daily cache', () => {
  it('is a daily raw Data File and needs no custom download/storage API', async () => {
    const data = createData(() => at)
    expect(data.dataFile).toMatchObject({ url: ROSTER_URL, fetchType: 'raw', maxAgeInDays: 1 })
    const saved = await data.dataFile.rawToJSONData?.({
      body: body(),
      url: ROSTER_URL,
      options: {},
    })
    expect(data.getRoster()?.members).toHaveLength(3)
    const cold = createData()
    expect(cold.getRoster()).toBeUndefined()
    await cold.dataFile.onLoadRawData?.(JSON.parse(JSON.stringify(saved)))
    expect(cold.getRoster()?.byCall.get('N0BBB')?.number).toBe(2)
  })
  it('retains last-good data on invalid refresh, invalid replay, truncation and older snapshots', async () => {
    const data = createData(() => at)
    const saved = await data.dataFile.rawToJSONData?.({
      body: body(),
      url: ROSTER_URL,
      options: {},
    })
    for (const invalid of ['<html>error</html>', body([entries[0]])]) {
      await expect(
        data.dataFile.rawToJSONData?.({ body: invalid, url: ROSTER_URL, options: {} }),
      ).rejects.toThrow()
      expect(data.getRoster()?.members).toHaveLength(3)
    }
    await data.dataFile.onLoadRawData?.({ schema: 1, body: body(), downloadedAt: at - DAY })
    expect(data.getRoster()?.downloadedAt).toBe(at)
    await data.dataFile.onLoadRawData?.({ schema: 99 })
    expect(data.error()).toBeDefined()
    await data.dataFile.onLoadRawData?.(saved)
    expect(data.error()).toBeUndefined()
    await data.dataFile.onRemoveRawData?.()
    expect(data.getRoster()).toBeUndefined()
  })
  it('accepts a newly published roster without a runtime restart', async () => {
    const data = createData(() => at + DAY)
    await data.dataFile.onLoadRawData?.({ schema: 1, body: body(), downloadedAt: at })
    await data.dataFile.rawToJSONData?.({
      body: body([...entries, { ...entries[0], bkg_number: 4, callsign: 'W9HUNT' }], {
        generated_at: new Date(at + DAY).toISOString(),
      }),
      url: ROSTER_URL,
      options: {},
    })
    expect(findMember(data.getRoster(), 'W9HUNT')?.number).toBe(4)
  })
})
describe('additive lookup and native Worked the Gang', () => {
  it('adds member notes and a stable identity without overriding QRZ, typed values or exchanges', async () => {
    const hook = createLookup(roster)
    const input = {
      qso: {
        band: '20m',
        mode: 'SSB',
        their: { call: 'N0BBB/P', name: '', state: 'MA', exchange: 'typed' },
      },
      callInfo: { call: 'N0BBB/P', name: 'QRZ' },
      operation: {},
    }
    const before = JSON.stringify(input)
    const [result] = await hook.lookupCall(input, ctx)
    expect(result).toMatchObject({
      notes: ['**BKG #2** · Blair · Rhode Island'],
      n1rwjBkg: { number: 2, call: 'N0BBB/P' },
    })
    for (const field of ['name', 'state', 'note', 'emoji', 'exchange', 'online'])
      expect(result).not.toHaveProperty(field)
    expect(JSON.stringify(input)).toBe(before)
    expect(await hook.lookupCall({ ...input, qso: { their: { call: '' } } }, ctx)).toEqual([])
    expect(await createLookup(() => undefined).lookupCall(input, ctx)).toEqual([])
  })
  it('accepts a nonmember hunter and portable 2m CW contacts, with stable number targets', async () => {
    const hook = createChasing(roster)
    expect(await hook.holdersFor({ station: { call: 'W9HUNT/P' } }, ctx)).toEqual(['W9HUNT'])
    const result = await hook.claimsForQsos({ qsos: [qso('N0BBB/P')] }, ctx)
    expect(result.qso).toEqual([
      {
        holder: 'W9HUNT',
        ref: '2',
        band: null,
        mode: null,
        level: 'worked',
        label: 'N0BBB · BKG #2',
      },
      {
        holder: 'W9HUNT',
        ref: '2',
        band: '2m',
        mode: null,
        level: 'worked',
        label: 'N0BBB · BKG #2',
      },
      {
        holder: 'W9HUNT',
        ref: '2',
        band: null,
        mode: 'CW',
        level: 'worked',
        label: 'N0BBB · BKG #2',
      },
      {
        holder: 'W9HUNT',
        ref: '2',
        band: '2m',
        mode: 'CW',
        level: 'worked',
        label: 'N0BBB · BKG #2',
      },
    ])
    const newRoster = parseRoster(
      body([...entries, { ...entries[0], bkg_number: 4, callsign: 'W9HUNT' }]),
      at,
    )
    expect(
      await createChasing(() => newRoster).holdersFor({ station: { call: 'W9HUNT' } }, ctx),
    ).toEqual(['W9HUNT'])
  })
  it.each([
    ['2m', 'CW', true],
    ['2M', 'cw', true],
    ['20m', 'CW', false],
    ['6m', 'CW', false],
    ['70cm', 'CW', false],
    ['2m', 'SSB', false],
    ['2m', 'FM', false],
    ['2m', 'FT8', false],
    ['', 'CW', false],
    ['2m', '', false],
  ])(
    'applies identical chase and operation-counter eligibility to %s %s',
    async (band, mode, eligible) => {
      const contact = { ...qso(), band, mode }
      const hook = createChasing(roster)
      expect(hook.program.version).toBe(2)
      const result = await hook.claimsForQsos({ qsos: [contact] }, ctx)
      expect(result.qso).toHaveLength(eligible ? 4 : 0)
      expect(workedMembers([contact], roster()).size).toBe(eligible ? 1 : 0)
      if (eligible) expect(result.qso[3]).toMatchObject({ band: '2m', mode: 'CW' })
    },
  )
  it('handles spot candidates without manufacturing stored evidence and excludes deleted/event/self contacts', async () => {
    const hook = createChasing(roster)
    const result = await hook.claimsForQsos(
      {
        qsos: [
          qso('N0BBB', 'spot-candidate'),
          { ...qso('N0BBB', 'deleted'), deleted: true },
          { ...qso('N0BBB', 'event'), band: 'event' },
          { ...qso('N0BBB', 'self'), our: { call: 'N0BBB' } },
          qso('W9UNKNOWN', 'unknown'),
          { ...qso(), uuid: '' },
        ],
      },
      ctx,
    )
    expect(result['spot-candidate']).toHaveLength(4)
    for (const uuid of ['deleted', 'event', 'self', 'unknown']) expect(result[uuid]).toEqual([])
    expect(Object.keys(result)).not.toContain('')
    expect(() => createChasing(() => undefined).claimsForQsos({ qsos: [qso()] }, ctx)).toThrow(
      'roster unavailable',
    )
  })
  it('keeps a saved member identity across renames/reuse, but never carries it to a corrected different callsign', async () => {
    const renamed = parseRoster(
      body([
        entries[0],
        { ...entries[1], callsign: 'N0REN' },
        entries[2],
        { ...entries[0], bkg_number: 4, callsign: 'N0BBB' },
      ]),
      at,
    )
    const hook = createChasing(() => renamed)
    const saved = {
      ...qso(),
      their: { call: 'N0BBB', guess: { n1rwjBkg: { number: 2, call: 'N0BBB' } } },
    }
    expect((await hook.claimsForQsos({ qsos: [saved] }, ctx)).qso[0].ref).toBe('2')
    saved.their.call = 'VE3ABC'
    expect((await hook.claimsForQsos({ qsos: [saved] }, ctx)).qso[0].ref).toBe('3')
  })
  it('counts distinct mixed targets once and uses the latest roster on later calls', async () => {
    let current = roster()
    const hook = createChasing(() => current)
    const results = await hook.claimsForQsos({ qsos: [qso()] }, ctx)
    const summary = await hook.summarizeClaims(
      { holder: 'W9HUNT', slots: [...results.qso, ...results.qso] },
      ctx,
    )
    expect(summary.members).toMatchObject({ total: 1 })
    current = parseRoster(
      body([...entries, { ...entries[0], bkg_number: 4, callsign: 'N0NEW' }]),
      at,
    )
    expect((await hook.claimsForQsos({ qsos: [qso('N0NEW')] }, ctx)).qso[0].ref).toBe('4')
  })
})
describe('automatic identity and contextual panels', () => {
  it('works outside operations without setup or log reads and distinguishes absent from unavailable', async () => {
    const getQsos = vi.fn(async () => [])
    const panel = createPanel(roster, undefined, async () => 'N0BBB')
    const home = args()
    delete (home as Partial<typeof home>).operation
    const content = markdown(await panel.render(home, { ...ctx, getQsos }))
    expect(content).toContain('N0BBB · BKG #2')
    expect(content).toContain('1 direct recruits')
    expect(getQsos).not.toHaveBeenCalled()
    const nonmember = markdown(
      await createPanel(roster, undefined, async () => 'W9HUNT').render(home, ctx),
    )
    expect(nonmember).toContain('Work a BKG member on 2m CW to join')
    const missing = markdown(
      await createPanel(
        () => undefined,
        undefined,
        async () => 'W9HUNT',
      ).render(home, ctx),
    )
    expect(missing).toContain('Membership is unknown')
    expect(missing).not.toContain('to join')
    expect(await panel.getPanels({}, ctx)).toEqual([
      expect.not.objectContaining({ form: expect.anything() }),
    ])
  })
  it('prefers the operation operator and updates same-count edits without log/spot reads while typing', async () => {
    let contacts: Qson[] = [qso(), qso('N0BBB/P', 'duplicate')]
    const getQsos = vi.fn(async () => contacts)
    const getSpots = vi.fn(async () => [spot('N0BBB')])
    const panel = createPanel(roster, undefined, async () => 'N0BBB')
    const render = (reason: string) =>
      panel.render(args({ reason, qsoCount: 2, qso: { their: { call: 'VE3ABC' } } }), {
        ...ctx,
        getQsos,
        getSpots,
      })
    expect(markdown(await render('initial'))).toContain('N0AAA · BKG #1')
    expect(markdown(await render('qso'))).toContain('1 distinct BKG members worked')
    await render('qso')
    await render('tick')
    expect(getQsos).toHaveBeenCalledTimes(1)
    expect(getSpots).toHaveBeenCalledTimes(1)
    contacts = [qso(), qso('VE3ABC', 'duplicate')]
    expect(markdown(await render('qsoLogged'))).toContain('2 distinct BKG members worked')
    expect(getQsos).toHaveBeenCalledTimes(2)
  })
  it('keeps call clearing explicit and does not retry a failing log read per keystroke', async () => {
    const getQsos = vi.fn(async () => {
      throw new Error('unavailable')
    })
    const panel = createPanel(roster, undefined, async () => 'N0AAA')
    await panel.render(args(), { ...ctx, getQsos })
    const rendered = await panel.render(
      args({ reason: 'qso', qso: { callField: { call: '' }, their: { call: 'N0BBB' } } }),
      { ...ctx, getQsos },
    )
    expect(markdown(rendered)).not.toContain('**N0BBB**')
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
  it('shows stale-cache/refresh-error context without withdrawing membership', async () => {
    const panel = createPanel(
      roster,
      () => 'bad response',
      async () => 'N0AAA',
    )
    const rendered = markdown(
      await panel.render(
        args({ operation: {}, clock: { nowMillis: at + DAY, realNowMillis: at + DAY } }),
        ctx,
      ),
    )
    expect(rendered).toContain('BKG #1')
    expect(rendered).toContain('refresh due')
    expect(rendered).toContain('Previous valid data retained')
  })
  it('highlights fresh member spots with 2m CW first, deduplicates and ignores stale/unknown calls', () => {
    const rows = spotRows(
      [
        spot('N0AAA'),
        spot('N0BBB/P', '2m'),
        spot('N0BBB'),
        spot('W9UNKNOWN'),
        spot('VE3ABC', '20m', 'CW', DAY),
      ],
      roster,
      at,
    )
    expect(rows.map((row) => row.call)).toEqual(['N0BBB', 'N0AAA'])
    expect(rows[0].joining).toBe(true)
  })
})
