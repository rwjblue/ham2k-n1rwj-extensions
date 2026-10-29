import { describe, expect, it } from 'vitest'
import { parseN1mm } from '../src/parse.ts'

describe('shared N1MM documents', () => {
  it.each([
    ['ICWC-MST', 'Last Edit', 'Misc'],
    ['K1USNSST', '1-Last Edit', 'Exch1'],
    ['CWOPS', 'LastEdit', 'Exch1'],
  ])('retains raw columns and metadata for %s', (contest, dateLabel, column) => {
    const parsed = parseN1mm(
      `!!Order!!,Call,Name,${column},UserText\n# ${contest}\n# ${dateLabel},2026-09-14\nK1ABC,Pat,DX,Example`,
    )
    expect(parsed.usable).toBe(true)
    expect(parsed.associations).toEqual([contest])
    expect(parsed.sourceUpdatedAt).toBe('2026-09-14')
    expect(parsed.rows).toEqual([
      {
        line: 4,
        call: 'K1ABC',
        fields: { call: 'K1ABC', name: 'Pat', [column.toLowerCase()]: 'DX', usertext: 'Example' },
      },
    ])
  })

  it('retains duplicate rows for contest-specific nonblank merging', () => {
    const parsed = parseN1mm('!!Order!!;Call;Name;Exch1\nK1ABC;"Pat; Jr.";MA\nK1ABC;;RI')
    expect(parsed.rows.map((row) => row.fields.name)).toEqual(['Pat; Jr.', ''])
    expect(parsed.issues).toContainEqual(expect.objectContaining({ code: 'duplicate-call' }))
  })

  it('rejects directives it cannot apply and never interprets Misc as an exchange', () => {
    const parsed = parseN1mm('!!Order!!,Call,Name,Misc\n!!MapStateToSect!!\nK1ABC,Pat,123')
    expect(parsed.usable).toBe(false)
    expect(parsed.rows[0]?.fields.exch1).toBeUndefined()
    expect(parsed.rows[0]?.fields.misc).toBe('123')
  })
})
