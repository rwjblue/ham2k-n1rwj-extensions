import { describe, expect, it } from 'vitest'
import { clusterSkimmerLines, parseClusterReport } from '../../src/cluster/parser.ts'

const at = Date.parse('2026-11-11T00:00:04Z')
const line = (text: string) => ({ seq: 7, at, text })

describe('RBN skimmer lines', () => {
  it('preserves exact portable calls and receiver suffixes across midnight', () => {
    expect(
      parseClusterReport(line('DX de KM3T-5-#: 7032.1 N1RWJ/P CW 23 dB 27 WPM CQ FN42 2359Z')),
    ).toEqual({
      id: 'cluster:0000000000000007',
      call: 'N1RWJ/P',
      receiver: 'KM3T-5',
      frequencyKhz: 7032.1,
      band: '40m',
      mode: 'CW',
      snrDb: 23,
      wpm: 27,
      timeMs: Date.parse('2026-11-10T23:59:00Z'),
      receiverLatitude: null,
      receiverLongitude: null,
      country: null,
    })
  })

  it('subscribes to and parses a bell-prefixed spot with a tight timestamp', () => {
    const text = '\x07DX\t de  KM3T-5-#: 7032.1 N1RWJ/P CW 23 dB 27 WPM CQ0000Z FN42'
    expect(clusterSkimmerLines.test(text)).toBe(true)
    expect(parseClusterReport(line(text))).toMatchObject({
      call: 'N1RWJ/P',
      receiver: 'KM3T-5',
      mode: 'CW',
      snrDb: 23,
      wpm: 27,
      timeMs: Date.parse('2026-11-11T00:00:00Z'),
    })
  })

  it.each(['RTTY', 'FT4', 'FT8'])('accepts explicit %s and optional text fields', (mode) => {
    expect(
      parseClusterReport(line(`DX de VE7CC-#: 3573.0 N8ADO ${mode} -14dB Q:4 Z:4,5 4 0000Z 3`)),
    ).toMatchObject({
      receiver: 'VE7CC',
      band: '80m',
      mode,
      snrDb: -14,
      wpm: null,
    })
  })

  // RBN Aggregator uses SNR first, then WPM or the FT mode. DXSpider
  // abbreviates RTTY to RTT in its condensed skimmer format.
  it.each([
    ['21 dB 17 WPM CQ', 'CW', 21, 17],
    ['-17 dB 6 FT4 CQ KM08 1035', 'FT4', -17, null],
    ['-3 dB 6 FT8 CQ EL99 789', 'FT8', -3, null],
    ['RTT 12dB Q:3', 'RTTY', 12, null],
    ['17 dB 45 BPS RTTY CQ', 'RTTY', 17, null],
    ['CW 22dB **SEEME** FN20', 'CW', 22, null],
  ])('recognizes the mode and measurements in %s', (comment, mode, snrDb, wpm) => {
    expect(parseClusterReport(line(`DX de W3OA-#: 14054.5 W8OB ${comment} 0000Z`))).toMatchObject({
      mode,
      snrDb,
      wpm,
      receiverLatitude: null,
      receiverLongitude: null,
    })
  })

  it.each([
    ['2358', 'Q:2+'],
    ['2355', 'Q:5*+'],
  ])('keeps grouped CW stamped %sZ with %s and preserves its report time', (utc, quality) => {
    expect(
      parseClusterReport(line(`DX de 3B8GL-#: 7027.5 C8K CW 6dB ${quality} Z:24,39 ${utc}Z`)),
    ).toMatchObject({
      call: 'C8K',
      receiver: '3B8GL',
      mode: 'CW',
      timeMs: Date.parse(`2026-11-10T23:${utc.slice(2)}:00Z`),
    })
  })

  it.each([
    'DX de W1NT: 7002.5 WI3W CW 22dB FN20 0000Z',
    'DX de W1NT-#: 7002.5 WI3W 22dB FN20 0000Z',
    'DX de W1NT-#: 7002.5 WI3W PSK31 22dB FN20 0000Z',
    'DX de W1NT-#: 7002.5 WI3W 22dB FN20 0000Z CW',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB FT8 0000Z',
    'DX de W1NT-#: 7002.5 WI3W PSK31 22dB CW 0000Z',
    'DX de W1NT-#: 7002.5 WI3W 22dB 25 WPM CQ FT8 0000Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB FN20',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB FN20 2358Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB Q:2+ Z:5 2354Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB Q:20 Z:5 2358Z',
    'DX de W1NT-#: 7002.5 WI3W RTT 22dB Q:2+ Z:5 2358Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB Q:2+ Z:5 0001Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB FN20 0001Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB 2360Z',
    'DX de W1NT-#: 7002.5 WI3W CW 22dB 2359Z 0000Z',
    'DX de W1NT-#: 144 WI3W CW 22dB FN20 0000Z',
    'DX de W1NT-#: 7002.5 BAD CW 22dB FN20 0000Z',
    'DX de W1NT-#: 7002.5 WI3W-7 CW 22dB FN20 0000Z',
  ])('rejects invalid, stale, or ambiguous report %s', (text) => {
    expect(parseClusterReport(line(text))).toBeNull()
  })
})
