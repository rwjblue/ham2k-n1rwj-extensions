import { describe, expect, it } from 'vitest'
import { callKeys, lookupMember, parseRoster } from '../src/roster.ts'

const header =
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS'
const rows = [
  '1C|K1ABC|Alice|MA|W1OLD|291|02 Jan 2006|15 Jan 2007||||A',
  '2T|K2ABC|Bob|ON|W1SHARED|1|01 Feb 2006|10 Mar 2007|12 Apr 2008|||A',
  '3S|K3ABC/SK|Charlie|CA|K3ABC, W1SHARED|291|03 Mar 2006|04 Apr 2007|05 May 2008|06 Jun 2009|07 Jul 2010|SK',
  '4|Reserved-01||TX||291|08 Jun 2006|||||IA',
]
const body = [header, ...rows].join('\n')

describe('SKCC roster decoding', () => {
  it('maps the status-aware schema, award dates, aliases and reserved inactive records', () => {
    const roster = parseRoster(body, { downloadedAt: 1 })
    expect(roster.members).toHaveLength(4)
    expect(roster.members[2]).toMatchObject({
      number: '3',
      suffix: 'S',
      status: 'SK',
      oldCalls: ['K3ABC', 'W1SHARED'],
      joinDate: '2006-03-03',
      tx8Date: '2009-06-06',
    })
    expect(roster.members[3]).toMatchObject({
      number: '4',
      call: 'RESERVED-01',
      status: 'IA',
      name: '',
    })
    expect(parseRoster(body, { downloadedAt: 2 }).revision).toBe(roster.revision)
    expect(parseRoster(body.replace('Alice', 'Alicia')).revision).not.toBe(roster.revision)
  })
  it('maps reordered headers, CRLF and BOM without assuming field positions', () => {
    const reordered = body
      .split('\n')
      .map((line) => line.split('|').reverse().join('|'))
      .join('\r\n')
    expect(parseRoster(`\uFEFF${reordered}`, { downloadedAt: 1 }).members).toEqual(
      parseRoster(body, { downloadedAt: 1 }).members,
    )
  })
  it('treats historical call markers as authoritative even when the source status says active', () => {
    const inconsistent = parseRoster(
      `${header}\n5|K5ABC/EX|Erin|MA|K5ABC|291|02 Jan 2006|||||A\n6|K6ABC/SK|Fred|CA|K6ABC|291|02 Jan 2006|||||A`,
    )
    expect(lookupMember(inconsistent, 'K5ABC')?.status).toBe('IA')
    expect(lookupMember(inconsistent, 'K6ABC')?.status).toBe('SK')
  })
  it('supports the rich public schema and recognizes its inactive privacy placeholders', () => {
    const rich =
      'SKCCNR|CALL|NAME|QTH|SPC|OLDCALL|SKCC|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|DXENTITY\n1C|K1ABC|Alice|Boston|MA|W1OLD|1|291|02 Jan 2006|15 Jan 2007||||USA\n170|call|name|qth|spc|oldcall|skcc|||||||'
    const roster = parseRoster(rich)
    expect(roster.members[0]).toMatchObject({ qth: 'Boston', status: 'A' })
    expect(roster.members[1]).toMatchObject({
      number: '170',
      status: 'IA',
      call: '',
      name: '',
      oldCalls: [],
    })
    expect(lookupMember(roster, 'CALL')).toBeUndefined()
  })
  it.each([
    '<html>Unavailable</html>',
    header,
    `${header}\n${rows[0]}\n${rows[0]}`,
    body.replace('02 Jan 2006', '31 Feb 2006'),
    body.replace('02 Jan 2006', '2026-01-02'),
    body.replace('1C|', '1Q|'),
    body.replace('|A\n', '|UNKNOWN\n'),
    body.replace('K1ABC|', 'NOTACALL|'),
    body.replace('W1OLD|', 'bad alias|'),
    body.replace('|NAME|', '|CALL|'),
    `${body}\nK9ABC`,
    `${body}\u0000`,
  ])('rejects malformed datasets without silently dropping rows: %s', (invalid) => {
    expect(() => parseRoster(invalid)).toThrow()
  })
})

describe('SKCC identity resolution', () => {
  const roster = parseRoster(body)
  it('finds unambiguous current, old and portable calls', () => {
    for (const call of [' k1abc ', 'W1OLD', 'K1ABC/P', 'EA8/K1ABC', 'K1ABC/4'])
      expect(lookupMember(roster, call)?.number).toBe('1')
    expect(lookupMember(roster, 'K3ABC')?.status).toBe('SK')
  })
  it('requires an explicit matching number for ambiguous or reassigned calls', () => {
    expect(lookupMember(roster, 'W1SHARED')).toBeUndefined()
    expect(lookupMember(roster, 'W1SHARED', '0002T')?.number).toBe('2')
    expect(lookupMember(roster, 'W1SHARED', '3S')?.number).toBe('3')
    expect(lookupMember(roster, 'K1ABC', '2')).toBeUndefined()
    expect(lookupMember(roster, 'K9NEW', '1C')?.number).toBe('1')
    for (const number of ['', null, 'abc', '0', '999999'])
      expect(lookupMember(roster, 'K1ABC', number)).toBeUndefined()
  })
  it('does not mistake historical status markers or two operator calls for portable suffixes', () => {
    for (const call of ['K1ABC/SK', 'K1ABC/EX', 'K1ABC/SK/P', 'K1ABC/K2ABC'])
      expect(lookupMember(roster, call)).toBeUndefined()
    expect(lookupMember(roster, 'K3ABC/SK')?.number).toBe('3')
    expect(callKeys('K1ABC/EX')).toEqual(['K1ABC/EX'])
  })
  it('indexes once, so repeated keystroke lookups do not scan member records', () => {
    let reads = 0
    const indexed = {
      ...roster,
      get members() {
        reads++
        return roster.members
      },
    }
    for (let count = 0; count < 100; count++) lookupMember(indexed, 'K1ABC')
    expect(reads).toBe(1)
  })
})
