import { describe, expect, it } from 'vitest'
import {
  calendarSourceUrl,
  maxCalendarBodyLength,
  parseCalendarDownload,
  parseCalendarSource,
  safeRulesUrl,
} from '../src/source.ts'
import { NOW, occurrence, payload } from './fixtures.ts'

describe('ContestClock calendar normalization', () => {
  it('reads UTC sessions, modes, verification and source links without deriving contest rules', () => {
    expect(parseCalendarSource(payload())).toEqual([
      {
        id: `cwops-cwt-20261007T1300@contestcal:${Date.parse('2026-10-07T13:00:00Z')}/${Date.parse('2026-10-07T14:00:00Z')}`,
        name: 'CWops Test (CWT)',
        start: Date.parse('2026-10-07T13:00:00Z'),
        end: Date.parse('2026-10-07T14:00:00Z'),
        modes: ['CW'],
        verified: true,
        rulesUrl: 'https://cwops.org/cwops-tests/',
        sourceUrl: calendarSourceUrl,
        localTime: null,
      },
    ])
  })

  it('retains the gaps between split sessions even when their provider UID is reused', () => {
    const base = {
      contest_id: 'makrothen-rtty',
      uid: 'makrothen',
      name: 'Makrothen RTTY Contest',
      modes: ['RTTY'],
      rules_url: 'https://www.pl259.org/makrothen/makrothen-rules/',
    }
    const rows = [
      occurrence({ ...base, start: '2026-10-11T08:00:00Z', end: '2026-10-11T16:00:00Z' }),
      occurrence({ ...base, start: '2026-10-10T00:00:00Z', end: '2026-10-10T08:00:00Z' }),
      occurrence({ ...base, start: '2026-10-10T16:00:00Z', end: '2026-10-11T00:00:00Z' }),
    ]
    const events = parseCalendarSource(payload(rows))
    expect(events).toHaveLength(3)
    expect(new Set(events.map((event) => event.id)).size).toBe(3)
    expect(events.map(({ start, end }) => [start, end])).toEqual([
      [Date.parse('2026-10-10T00:00:00Z'), Date.parse('2026-10-10T08:00:00Z')],
      [Date.parse('2026-10-10T16:00:00Z'), Date.parse('2026-10-11T00:00:00Z')],
      [Date.parse('2026-10-11T08:00:00Z'), Date.parse('2026-10-11T16:00:00Z')],
    ])
    expect(parseCalendarSource(payload([rows[0], rows[0]]))).toHaveLength(1)
  })

  it('keeps unrecorded modes empty, unknown modes literal, and unverified records unverified', () => {
    expect(
      parseCalendarSource(payload([occurrence({ modes: [], verified: 'true' })]))[0],
    ).toMatchObject({
      modes: [],
      verified: false,
    })
    expect(
      parseCalendarSource(
        payload([occurrence({ modes: ['RTTY', 'Digital', 'RTTY', 'New-mode'] })]),
      )[0].modes,
    ).toEqual(['RTTY', 'Digital', 'New-mode'])
  })

  it('preserves local rolling wall clocks without interpreting them in the device timezone', () => {
    const local = occurrence({
      local_rolling: true,
      start: null,
      end: null,
      start_wall: '2026-10-10T06:00:00',
      end_wall: '2026-10-10T18:00:00',
    })
    expect(parseCalendarSource(payload([local]))[0]).toMatchObject({
      start: null,
      end: null,
      localTime: '2026-10-10 06:00:00 – 2026-10-10 18:00:00 local',
    })
    expect(() =>
      parseCalendarSource(payload([{ ...local, start: '2026-10-10T06:00:00Z' }])),
    ).toThrow()
    expect(() => parseCalendarSource(payload([{ ...local, end_wall: null }]))).toThrow()
  })

  it('neutralizes unsafe links while preserving an otherwise useful calendar event', () => {
    const unsafe = [
      'javascript:alert(1)',
      'data:text/html,test',
      '//example.org/rules',
      'https://user:password@example.org/rules',
      'https://example.org\\@evil.org/rules',
      `https://example.org/${String.fromCharCode(10)}script`,
      'https://example.org:99999/rules',
      'https://-example.org/',
      'https://example..org/',
      'https://example.org/<script>',
    ]
    for (const rules_url of unsafe) {
      expect(safeRulesUrl(rules_url)).toBeNull()
      expect(parseCalendarSource(payload([occurrence({ rules_url })]))[0].rulesUrl).toBeNull()
    }
    for (const url of [
      'https://example.org/rules?year=2026#start',
      'http://example.org/~contest/rules.html',
      'https://example.org:8443/rules',
    ])
      expect(safeRulesUrl(url)).toBe(url)
  })

  it('skips malformed records but refuses a response consisting entirely of invalid records', () => {
    const invalid = [
      null,
      [],
      {},
      occurrence({ name: '' }),
      occurrence({ name: `bad${String.fromCharCode(0)}name` }),
      occurrence({ name: 'a'.repeat(241) }),
      occurrence({ uid: null, contest_id: null }),
      occurrence({ modes: [`CW${String.fromCharCode(10)}script`] }),
      occurrence({ modes: 'CW' }),
      occurrence({ start: '2026-02-30T13:00:00Z' }),
      occurrence({ start: '2026-10-07' }),
      occurrence({ start: '2026-10-07T13:00:00-04:00' }),
      occurrence({ end: '2026-10-07T12:00:00Z' }),
      occurrence({ start: null, end: null }),
    ]
    expect(parseCalendarSource(payload([...invalid, occurrence()]))).toHaveLength(1)
    expect(() => parseCalendarSource(payload(invalid))).toThrow('no valid events')
  })

  it('accepts a counted empty response and rejects oversized, truncated or changed envelopes', () => {
    expect(parseCalendarSource(payload([]))).toEqual([])
    for (const body of [
      '<html>Unavailable</html>',
      '{}',
      '[]',
      JSON.stringify({ count: 2, occurrences: [occurrence()] }),
      JSON.stringify({ count: '1', occurrences: [occurrence()] }),
      payload(Array.from({ length: 2_001 }, () => occurrence())),
      ' '.repeat(maxCalendarBodyLength + 1),
    ])
      expect(() => parseCalendarSource(body)).toThrow()
  })

  it('reads the static endpoint’s thirty-day server window across DST and month boundaries', () => {
    const loaded = parseCalendarDownload(payload())
    expect(loaded.from).toBe(NOW)
    expect(loaded.through).toBe(Date.parse('2026-11-06T12:00:00Z'))
    expect(loaded.events).toHaveLength(1)
    for (const query of [
      { kind: 'dates' },
      { filters: ['CW'] },
      { filters: null },
      { from: '2026-02-30T12:00:00Z' },
      { to: '2026-10-21T12:00:00Z' },
      { from: null },
    ])
      expect(() => parseCalendarDownload(payload([], query))).toThrow('calendar coverage')
  })
})
