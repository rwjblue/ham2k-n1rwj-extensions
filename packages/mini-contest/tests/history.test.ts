import { describe, expect, it, vi } from 'vitest'
import { config as mst } from '../../../extensions/contests/n1rwj-mst/src/config.ts'
import { config as sst } from '../../../extensions/contests/n1rwj-sst/src/config.ts'
import { createHistory, parseHistory } from '../src/history.ts'
import type { Qson } from '../src/model.ts'

const file = '# K1USNSST\n!!Order!!,Call,Name,Exch1,UserText\nK1ABC,BOB,MA,\n'
describe('contest-aware N1MM files', () => {
  it('reads the real MST column shape without treating Misc or serials as an exchange hint', () => {
    const parsed = parseHistory(
      mst,
      '# ICWC-MST\n!!Order!!,Call,Name,Misc,UserText,\nK1ABC,BOB,DX,,\nK2ABC,AL,123,,\n',
    )
    expect(parsed.records).toEqual({
      K1ABC: { call: 'K1ABC', name: 'BOB' },
      K2ABC: { call: 'K2ABC', name: 'AL' },
    })
  })
  it('supports official SST location variants and never treats Alaska/Hawaii as states', () => {
    const rows = ['AK', 'HI', 'PR', 'NF', 'NL', 'LB', 'NU', 'PE', 'DX']
      .map((value, i) => `K${i}ABC,BOB,${value},`)
      .join('\n')
    const parsed = parseHistory(sst, `# K1USNSST\n!!Order!!,Call,Name,Exch1,UserText\n${rows}\n`)
    expect(Object.values(parsed.records).map((entry) => entry.location)).toEqual([
      'DX',
      'DX',
      'DX',
      'NF',
      'NL',
      'LB',
      'NU',
      'PE',
      'DX',
    ])
  })
  it('merges duplicate nonempty fields and preserves earlier values against empty duplicates', () => {
    expect(parseHistory(sst, `${file}K1ABC,,CT,\nK1ABC,ROB,,\n`).records.K1ABC).toEqual({
      call: 'K1ABC',
      name: 'ROB',
      location: 'CT',
    })
  })
  it('keeps names and valid rows when the SST file contains unsupported locations', () => {
    // K1USNSST-064.txt (2026-10-06), lines 5314 and 10108.
    const parsed = parseHistory(sst, `${file}KE2ET,LARRY,CWA,\nSM4X,LARS,SM,\n`)
    expect(parsed).toMatchObject({
      count: 3,
      warnings: 2,
      records: {
        K1ABC: { call: 'K1ABC', name: 'BOB', location: 'MA' },
        KE2ET: { call: 'KE2ET', name: 'LARRY' },
        SM4X: { call: 'SM4X', name: 'LARS' },
      },
    })
    expect(parsed.records.KE2ET).not.toHaveProperty('location')
    expect(parsed.records.SM4X).not.toHaveProperty('location')
  })
  it('omits numeric and unknown location hints without replacing an earlier valid duplicate', () => {
    const parsed = parseHistory(sst, `${file}K2ABC,AL,1234,\nK1ABC,ROB,CWA,\nK3ABC,JIM,,\n`)
    expect(parsed.records).toEqual({
      K1ABC: { call: 'K1ABC', name: 'ROB', location: 'MA' },
      K2ABC: { call: 'K2ABC', name: 'AL' },
      K3ABC: { call: 'K3ABC', name: 'JIM' },
    })
    // One duplicate plus two unsupported locations; blanks are not warnings.
    expect(parsed.warnings).toBe(3)
  })
  it('ignores MST exchange values without generating SST location warnings', () => {
    const parsed = parseHistory(mst, '# ICWC-MST\n!!Order!!,Call,Name,Exch1\nK1ABC,BOB,CWA\n')
    expect(parsed.records.K1ABC).toEqual({ call: 'K1ABC', name: 'BOB' })
    expect(parsed.warnings).toBe(0)
  })
  it('accepts a later valid duplicate and keeps Exch1 precedence over State', () => {
    const parsed = parseHistory(
      sst,
      '# K1USNSST\n!!Order!!,Call,Name,Exch1,State\nKE2ET,LARRY,CWA,CA\nKE2ET,,WA,\nSM4X,LARS,SM,MA\nK1ABC,BOB,,MA\n',
    )
    expect(parsed.records).toEqual({
      KE2ET: { call: 'KE2ET', name: 'LARRY', location: 'WA' },
      SM4X: { call: 'SM4X', name: 'LARS' },
      K1ABC: { call: 'K1ABC', name: 'BOB', location: 'MA' },
    })
    expect(parsed.warnings).toBe(3)
  })
  it('rejects wrong-contest, HTML and malformed data', () => {
    for (const body of [
      file.replace('K1USNSST', 'CWOPS'),
      '<html>Error</html>',
      'not a dataset',
      `${file}INVALID,BOB,MA,\n`,
    ])
      expect(() => parseHistory(sst, body)).toThrow()
    expect(() => parseHistory(mst, file)).toThrow('another contest')
  })
})
describe('prefill source precedence and bounded reads', () => {
  it.each([mst, sst])(
    'scopes older history to $type before the host caps results',
    async (config) => {
      const operation: Qson = { uuid: 'op', refs: [{ type: config.type }] }
      const older: Qson = {
        uuid: 'older',
        their: { call: 'K1ABC' },
        refs: [{ type: config.type, name: 'BOB', location: 'MA' }],
      }
      const unrelated: Qson = {
        their: { call: 'K1ABC' },
        refs: [{ type: 'cwt', name: 'OTHER', number: '1234' }],
      }
      const rows = [...Array.from({ length: 5 }, () => unrelated), older]
      const history = createHistory(config)
      history.update({ operation, qsos: [] })
      expect(
        await history.suggestions(
          operation,
          { their: { call: 'K1ABC' } },
          {
            online: false,
            getHistoryForCall: async (_call, options) =>
              rows
                .filter(
                  (row) =>
                    !options?.refType ||
                    (row.refs as Qson[]).some((ref) => ref.type === options.refType),
                )
                .slice(0, 5),
          },
        ),
      ).toEqual(config.type === 'mst' ? { name: 'BOB' } : { name: 'BOB', location: 'MA' })
    },
  )

  const operation: Qson = {
    uuid: 'op',
    createdAtMillis: 12,
    stationCall: 'N1RWJ',
    refs: [{ type: 'sst', ref: '2026-09-21-0000' }],
  }
  const contact = (uuid: string, name: string, location: string, startAtMillis: number): Qson => ({
    uuid,
    startAtMillis,
    their: { call: 'K1ABC' },
    refs: [{ type: 'sst', name, location }],
  })
  it('uses current-operation fields, then file fields, then compatible older history', async () => {
    const history = createHistory(sst)
    const old = contact('old', 'OLD', 'CT', 1)
    const current = contact('current', 'CURRENT', '', 2)
    history.update({ operation, qsos: [current] })
    const getQsos = vi.fn(async () => {
      throw new Error('Must not read the full log')
    })
    const ctx = { online: false, getQsos, getHistoryForCall: vi.fn(async () => [old, current]) }
    expect(
      await history.suggestions(
        operation,
        { their: { call: 'K1ABC' } },
        ctx,
        parseHistory(sst, file),
      ),
    ).toEqual({ name: 'CURRENT', location: 'MA' })
    expect(getQsos).not.toHaveBeenCalled()
  })
  it('uses exact calls before base calls and never copies a base-call location to a portable call', async () => {
    const history = createHistory(sst)
    const parsed = parseHistory(sst, `${file}K1ABC/P,PORTABLE,,\n`)
    expect(
      await history.suggestions(
        operation,
        { their: { call: 'K1ABC/P' } },
        { online: false },
        parsed,
      ),
    ).toEqual({ name: 'PORTABLE' })
  })
  it('ignores the QSO being edited, deleted rows, and other contests', async () => {
    const history = createHistory(sst)
    const rows = [
      contact('editing', 'EDIT', 'CT', 3),
      { ...contact('deleted', 'DELETED', 'MA', 2), deleted: true },
      {
        ...contact('other', 'OTHER', 'VT', 1),
        refs: [{ type: 'cwt', name: 'OTHER', number: '1234' }],
      },
    ]
    expect(
      await history.suggestions(
        operation,
        { uuid: 'editing', their: { call: 'K1ABC' } },
        { online: false, getHistoryForCall: async () => rows },
      ),
    ).toEqual({})
  })
  it('falls back to cached file suggestions when targeted history fails', async () => {
    const history = createHistory(sst)
    expect(
      await history.suggestions(
        operation,
        { their: { call: 'K1ABC' } },
        {
          online: false,
          getHistoryForCall: async () => {
            throw new Error('offline')
          },
        },
        parseHistory(sst, file),
      ),
    ).toEqual({ name: 'BOB', location: 'MA' })
  })
  it('revalidates operation membership once after resumed scoring and preserves current corrections', async () => {
    const history = createHistory(sst)
    const current = contact('current', 'CORRECTED', 'VT', 2)
    history.update({ operation, qsos: [current] })
    history.update({ operation, qsos: [], resumeFrom: {} })
    const getQsos = vi.fn(async () => [current])
    const ctx = { online: false, getQsos, getHistoryForCall: async () => [current] }
    const draft = { their: { call: 'K1ABC' } }
    for (let i = 0; i < 3; i++)
      expect(await history.suggestions(operation, draft, ctx, parseHistory(sst, file))).toEqual({
        name: 'CORRECTED',
        location: 'VT',
      })
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
  it('does not resurrect a current contact deleted since scoring', async () => {
    const history = createHistory(sst)
    history.update({ operation, qsos: [contact('gone', 'DELETED', 'VT', 2)] })
    const getQsos = vi.fn(async () => [])
    const ctx = { online: false, getQsos, getHistoryForCall: async () => [] }
    expect(
      await history.suggestions(
        operation,
        { their: { call: 'K1ABC' } },
        ctx,
        parseHistory(sst, file),
      ),
    ).toEqual({ name: 'BOB', location: 'MA' })
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
})
