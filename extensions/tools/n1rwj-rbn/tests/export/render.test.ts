import type { JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import type { RbnEvidence, RbnEvidenceReport } from '../../src/export/evidence.ts'
import {
  renderEvidenceCsv,
  renderEvidenceHtml,
  renderEvidenceJson,
  renderEvidenceMap,
  renderEvidenceMarkdown,
  renderEvidenceQsoCsv,
} from '../../src/export/render.ts'

const startMs = Date.UTC(2026, 9, 5, 14)

function report(overrides: Partial<RbnEvidenceReport> = {}): RbnEvidenceReport {
  return {
    id: 'one',
    call: 'N1RWJ',
    receiver: 'W3LPL',
    frequencyKhz: 14060,
    band: '20m',
    mode: 'CW',
    snrDb: 16,
    wpm: 22,
    timeMs: startMs + 5 * 60_000,
    receiverLatitude: 39.5,
    receiverLongitude: -77,
    country: 'United States',
    raw: { id: 'one', unknown_field: '<original provider value>' },
    retrievedAtMs: startMs + 35 * 60_000,
    firstSeenMs: startMs + 35 * 60_000,
    lastSeenMs: startMs + 35 * 60_000,
    retrievalKind: 'history',
    receiverGrid: 'FM19',
    receiverLocationSource: 'provider-grid',
    ...overrides,
  }
}

function evidence(reports = [report()], overrides: Partial<RbnEvidence> = {}): RbnEvidence {
  return {
    schemaVersion: 1,
    provider: 'vail-rerbn',
    request: {
      operationId: 'operation-1',
      call: 'N1RWJ',
      startMs,
      endMs: startMs + 30 * 60_000,
      origin: { latitude: 41.5, longitude: -73, label: 'N1RWJ' },
    },
    retrievedAtMs: startMs + 35 * 60_000,
    reports,
    attempts: [],
    complete: true,
    warnings: [],
    ...overrides,
  }
}

describe('RBN export rendering', () => {
  it('renders every band and mode independently with unknown observations retained', () => {
    const data = evidence([
      report(),
      report({ id: 'two', snrDb: 20, timeMs: startMs + 8 * 60_000 }),
      report({ id: 'three', snrDb: null, timeMs: startMs + 20 * 60_000 }),
      report({ id: 'four', mode: 'FT8', snrDb: -12 }),
      report({
        id: 'five',
        receiver: 'UNKNOWN',
        band: '40m',
        receiverLatitude: null,
        receiverLongitude: null,
        receiverGrid: null,
        receiverLocationSource: null,
      }),
    ])
    const html = renderEvidenceHtml(data)
    expect(html).toContain('<h2>20m · CW</h2>')
    expect(html).toContain('<h2>20m · FT8</h2>')
    expect(html).toContain('<h2>40m · CW</h2>')
    expect(html).toContain('<strong>18 dB</strong><small>2 reports</small>')
    expect(html).toContain('<strong>SNR unknown</strong><small>1 report</small>')
    expect(html).toContain('1 receiver lacks usable coordinates')
    expect(html).toContain('Compare the same receiver on the same band and mode')
    expect(html).toContain('no retained observation, not no reception')
    expect(html).toContain('id="rbn-map-0-map-frame"')
    expect(html.match(/id="rbn-map-0-map-frame"/g)).toHaveLength(1)
    expect(html).toContain('url(#rbn-map-0-map-frame)')
    expect(html).toContain('id="rbn-map-1-map-frame"')
    expect(html).not.toMatch(/<script|<link|<img|(?:src|href)="https?:\/\//)
    const markdown = renderEvidenceMarkdown(data)
    expect(markdown).toContain('### Reception timeline')
    expect(markdown).toContain('| Receiver | 2026-10-05 14:00 | 2026-10-05 14:15 |')
    expect(markdown).toContain('| W3LPL | 18 dB / 2 | Unknown / 1 |')
    expect(markdown).toContain('only populated windows are shown')
  })

  it('keeps large sparse timelines linear and explains compact Markdown omissions', () => {
    const reports = Array.from({ length: 100 }, (_, index) =>
      report({
        id: `report-${index}`,
        receiver: `RECEIVER-${index}`,
        timeMs: startMs + index * 15 * 60_000,
        receiverLatitude: null,
        receiverLongitude: null,
      }),
    )
    const data = evidence(reports, {
      request: { ...evidence().request, endMs: startMs + 100 * 15 * 60_000 },
    })
    const html = renderEvidenceHtml(data)
    expect(html).toContain('one row per populated receiver/window')
    expect(html).toContain('every populated window is retained')
    expect(html).toContain('<td>RECEIVER-99</td>')
    expect(html).not.toContain('<td class="empty">')
    const markdown = renderEvidenceMarkdown(data)
    expect(markdown).toContain('| Window start UTC | Receiver | Median SNR | Reports |')
    expect(markdown).toContain('Showing 96 of 100 populated receiver/window rows')
  })

  it('retains a report exactly on the requested quarter-hour endpoint', () => {
    const html = renderEvidenceHtml(evidence([report({ timeMs: startMs + 30 * 60_000 })]))
    expect(html).toContain('14:30<small>0 min requested</small>')
    expect(html).toContain('<strong>16 dB</strong><small>1 report</small>')
  })

  it('distinguishes partial collection, empty responses, and failed attempts', () => {
    const data = evidence([], {
      complete: false,
      warnings: ['Collection paused while the app was hidden.'],
      attempts: [
        {
          id: 'attempt-1',
          kind: 'history',
          request: evidence().request,
          startedAtMs: startMs,
          completedAtMs: startMs + 1000,
          pages: [
            {
              offset: 0,
              startedAtMs: startMs,
              completedAtMs: startMs + 1000,
              status: 200,
              total: 0,
              receivedRows: 0,
              acceptedRows: 0,
              duplicateRows: 0,
              filteredRows: 0,
              invalidRows: 0,
              error: null,
            },
          ],
          complete: false,
          stopReason: 'error',
          errors: ['Subsequent page request failed.'],
        },
      ],
    })
    const html = renderEvidenceHtml(data)
    expect(html).toContain('Partial collection:')
    expect(html).toContain('No retained observations')
    expect(html).toContain('No accepted reports in successful responses')
    expect(html).toContain('Subsequent page request failed.')
    expect(html).toContain('Collection paused while the app was hidden.')
    expect(html).not.toContain('band closed')
  })

  it('escapes provider and operator text in HTML, Markdown, and SVG', () => {
    const unsafe = '<script>alert("danger")</script>'
    const data = evidence([report({ receiver: unsafe, country: unsafe })], { warnings: [unsafe] })
    if (data.request.origin) data.request.origin.label = unsafe
    const html = renderEvidenceHtml(data, { title: unsafe })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;danger&quot;)&lt;/script&gt;')
    const svg = renderEvidenceMap(data, { title: unsafe })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    const markdown = renderEvidenceMarkdown(data, { title: 'a | b\n<c>' })
    expect(markdown).toContain('a \\| b &lt;c&gt;')
    expect(markdown).not.toContain('<script>')
  })

  it('keeps CSV values quoted and defuses text formulas while retaining negative measurements', () => {
    const output = renderEvidenceCsv(
      evidence([
        report({ receiver: '=HYPERLINK("x")', country: 'one,two\nthree', snrDb: -5 }),
        report({ id: 'two', receiver: '\t+cmd', snrDb: null }),
        report({ id: 'three', receiver: ' @cmd' }),
      ]),
    )
    expect(output).toContain('"\'=HYPERLINK(""x"")"')
    expect(output).toContain('"\'\t+cmd"')
    expect(output).toContain('"\' @cmd"')
    expect(output).toContain('"one,two\nthree"')
    expect(output).toContain('"-5"')
    expect(output).toContain('"reported_snr_db"')
    expect(output).toContain('\r\n')
  })

  it('preserves original provider evidence and includes only normalized QSO context', () => {
    const qsos: Record<string, JSONValue>[] = [
      {
        uuid: 'qso-1',
        startAtMillis: startMs + 10 * 60_000,
        band: '20m',
        mode: 'CW',
        freq: 14060,
        our: { call: 'N1RWJ' },
        their: {
          call: 'K1ABC',
          grid: 'FM19',
          name: 'Private person',
          email: 'private@example.test',
        },
        notes: 'Private QSO note',
      },
    ]
    const output = JSON.parse(renderEvidenceJson(evidence(), { qsos }))
    expect(output.reports[0].raw.unknown_field).toBe('<original provider value>')
    expect(output.qsoContext[0]).toMatchObject({
      qsoId: 'qso-1',
      contactCall: 'K1ABC',
      status: 'matched',
      snrDb: 16,
    })
    expect(JSON.stringify(output)).not.toMatch(/Private person|Private QSO note|private@example/)
    const html = renderEvidenceHtml(evidence(), { qsos })
    expect(html).toContain('Nearby reception evidence at QSO time')
    expect(html).toContain("A nearby skimmer's SNR is not the contact station's SNR")
    expect(renderEvidenceQsoCsv(evidence(), { qsos })).toContain('"reported_receiver_snr_db"')
  })

  it('marks synthetic fixtures through all formats, including an inferred sample title', () => {
    const options = { title: 'SYNTHETIC EXAMPLE — N1RWJ activation reception' }
    const data = evidence()
    expect(renderEvidenceHtml(data, options)).toContain(
      'invented observations, not an actual activation',
    )
    expect(renderEvidenceMarkdown(data, options)).toContain('**SYNTHETIC EXAMPLE')
    expect(renderEvidenceMap(data, options)).toContain('SYNTHETIC EXAMPLE')
    expect(renderEvidenceMap(data, options)).not.toContain('SYNTHETIC EXAMPLE — SYNTHETIC EXAMPLE')
    expect(renderEvidenceCsv(data, options)).toContain('"true"')
    expect(JSON.parse(renderEvidenceJson(data, options)).exportMetadata).toEqual({
      title: options.title,
      synthetic: true,
    })
  })
})
