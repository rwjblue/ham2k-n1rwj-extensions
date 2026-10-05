import type { JSONValue } from '@ham2k/extension-sdk'
import {
  isMapLocation,
  type MapStation,
  renderReceptionMap,
} from '../../../../../packages/reception/src/map/index.ts'
import {
  buildReceptionAnalysis,
  type QsoReceptionContext,
  type ReceptionAnalysis,
  type ReceptionSummary,
} from './analysis.ts'
import type { RbnEvidence, RbnEvidenceReport } from './evidence.ts'

export interface EvidenceRenderOptions {
  title?: string
  synthetic?: boolean
  qsos?: readonly Record<string, JSONValue>[]
}

const quarterMs = 15 * 60_000
const mapTheme = {
  surface: '#eef4f7',
  land: '#dce7e9',
  text: '#173342',
  muted: '#536e7c',
  border: '#b5cbd3',
  accent: '#007a7a',
}
const interpretation =
  'These are sampled reception observations, not contacts or a coverage boundary. Reported RBN SNR belongs to each receiver; antennas and noise differ. Compare the same receiver on the same band and mode. Missing reports do not prove that nobody heard the station.'

function text(value: unknown): string {
  return String(value ?? '')
}

function escapeHtml(value: unknown): string {
  return text(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function escapeMarkdown(value: unknown): string {
  return escapeHtml(value)
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1')
    .replace(/[\r\n]+/g, ' ')
}

/** Quoting alone does not stop a spreadsheet from evaluating provider text. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""'
  let cell = text(value)
  if (typeof value === 'string') {
    let offset = 0
    while (offset < cell.length && (cell.charCodeAt(offset) <= 32 || /\s/.test(cell[offset])))
      offset++
    if (/^[=+@-]/.test(cell.slice(offset)) || ['\t', '\r', '\n'].includes(cell[0]))
      cell = `'${cell}`
  }
  return `"${cell.replace(/"/g, '""')}"`
}

function csv(rows: readonly (readonly (string | number | boolean | null | undefined)[])[]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function iso(timeMs: number | null | undefined): string {
  return timeMs !== null && timeMs !== undefined && Number.isFinite(timeMs)
    ? new Date(timeMs).toISOString()
    : 'Unknown'
}

function timeLabel(timeMs: number): string {
  return iso(timeMs).slice(11, 16)
}

function number(value: number | null, suffix = ''): string {
  return value !== null && Number.isFinite(value)
    ? `${Number(value.toFixed(1))}${suffix}`
    : 'Unknown'
}

function title(evidence: RbnEvidence, options: EvidenceRenderOptions): string {
  return options.title ?? `${evidence.request.call} reception report`
}

function isSynthetic(options: EvidenceRenderOptions): boolean {
  return options.synthetic ?? /^SYNTHETIC EXAMPLE\b/i.test(options.title ?? '')
}

function groups(
  analysis: ReceptionAnalysis,
): { band: string; mode: string; summaries: ReceptionSummary[] }[] {
  const grouped = new Map<string, { band: string; mode: string; summaries: ReceptionSummary[] }>()
  for (const summary of analysis.receiverSummaries) {
    const key = `${summary.band}\u0000${summary.mode}`
    const group = grouped.get(key) ?? { band: summary.band, mode: summary.mode, summaries: [] }
    group.summaries.push(summary)
    grouped.set(key, group)
  }
  return [...grouped.values()].sort(
    (a, b) => a.band.localeCompare(b.band) || a.mode.localeCompare(b.mode),
  )
}

function mapStations(reports: readonly RbnEvidenceReport[]): MapStation[] {
  const stations = new Map<string, MapStation>()
  for (const report of [...reports].sort(
    (a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id),
  )) {
    if (report.receiverLatitude === null || report.receiverLongitude === null) continue
    const station = {
      key: report.receiver,
      label: report.receiver,
      latitude: report.receiverLatitude,
      longitude: report.receiverLongitude,
      ageMinutes: 0,
    }
    if (isMapLocation(station)) stations.set(report.receiver, station)
  }
  return [...stations.values()]
}

function mapSvg(
  evidence: RbnEvidence,
  reports: readonly RbnEvidenceReport[],
  namespace = '',
): string {
  const rendered = renderReceptionMap({
    width: 960,
    height: 500,
    theme: mapTheme,
    origin: evidence.request.origin
      ? { ...evidence.request.origin, label: evidence.request.call }
      : undefined,
    stations: mapStations(reports),
    projection: 'regional',
  })
  // The map combines standalone geometry layers with an identical frame
  // clipping definition in each layer. An exported document needs it once.
  let frameDefined = false
  const svg = rendered.replace(
    /<defs><clipPath id="map-frame">[\s\S]*?<\/clipPath><\/defs>/g,
    (definition) => {
      if (frameDefined) return ''
      frameDefined = true
      return definition
    },
  )
  // Several inline SVGs share a document. Their clipping definitions must
  // stay local to their map even when every map comes from the same renderer.
  return namespace
    ? svg
        .replace(/id="([^"]+)"/g, `id="${namespace}$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${namespace}$1)`)
    : svg
}

function collectionStatus(evidence: RbnEvidence): string {
  return evidence.complete
    ? 'Requested historical interval retrieved; this is not a record of every transmission.'
    : 'Partial collection: the retained evidence does not cover a verified complete service retrieval.'
}

function warnings(evidence: RbnEvidence, analysis: ReceptionAnalysis): string[] {
  return [...new Set([...evidence.warnings, ...analysis.warnings])]
}

function timelineWindows(evidence: RbnEvidence, bins: readonly ReceptionSummary[]): number[] {
  const first = Math.floor(evidence.request.startMs / quarterMs) * quarterMs
  const count = Math.ceil((evidence.request.endMs - first) / quarterMs)
  // Long requested intervals keep every populated window, without expanding
  // thousands of empty columns. The caption explains that sparse presentation.
  const populated = bins.map((bin) => bin.startMs)
  const full =
    count > 0 && count <= 96
      ? Array.from({ length: count }, (_, index) => first + index * quarterMs)
      : []
  // Retrieval ranges include their final instant. A report exactly at a
  // quarter-hour endpoint belongs to the next half-open aggregation window.
  return [...new Set([...full, ...populated])].sort((a, b) => a - b)
}

function timelineHtml(
  evidence: RbnEvidence,
  analysis: ReceptionAnalysis,
  band: string,
  mode: string,
): string {
  const bins = analysis.timeBins.filter((bin) => bin.band === band && bin.mode === mode)
  const windows = timelineWindows(evidence, bins)
  const receivers = [...new Set(bins.map((bin) => bin.receiver))].sort()
  if (windows.length > 96 || windows.length * receivers.length > 8_000) {
    const rows = bins
      .map(
        (bin) =>
          `<tr><th scope="row">${escapeHtml(iso(bin.startMs))}</th><td>${escapeHtml(bin.receiver)}</td><td>${number(bin.medianSnrDb, ' dB')}</td><td>${bin.count}</td><td>${bin.snrCount ? `${number(bin.minSnrDb)}–${number(bin.maxSnrDb)} dB` : 'Unknown'}</td><td>${bin.count - bin.snrCount}</td></tr>`,
      )
      .join('')
    return `<div class="scroll"><table><caption>UTC fifteen-minute windows [start, end). This large timeline uses one row per populated receiver/window instead of an empty-cell matrix; every populated window is retained. Each row is this receiver's median reported SNR and distinct report count. Omitted empty windows do not establish no reception. Edge windows may be partial.</caption><thead><tr><th>Window start UTC</th><th>Receiver</th><th>Median SNR</th><th>Reports</th><th>Range</th><th>Unknown SNR</th></tr></thead><tbody>${rows}</tbody></table></div>`
  }
  const cells = new Map(bins.map((bin) => [`${bin.receiver}\u0000${bin.startMs}`, bin]))
  const sparse =
    Math.ceil(
      (evidence.request.endMs - Math.floor(evidence.request.startMs / quarterMs) * quarterMs) /
        quarterMs,
    ) > 96
  const header = windows
    .map((start) => {
      const minutes =
        Math.max(
          0,
          Math.min(start + quarterMs, evidence.request.endMs) -
            Math.max(start, evidence.request.startMs),
        ) / 60_000
      return `<th scope="col"><span>${escapeHtml(iso(start).slice(0, 10))}</span>${timeLabel(start)}${minutes < 15 ? `<small>${number(minutes)} min requested</small>` : ''}</th>`
    })
    .join('')
  const rows = receivers
    .map((receiver) => {
      const values = windows
        .map((start) => {
          const bin = cells.get(`${receiver}\u0000${start}`)
          if (!bin) return '<td class="empty">—</td>'
          const detail = `${iso(bin.startMs)} to ${iso(bin.endMs)}; ${bin.count} distinct reports; ${bin.snrCount} SNR values; range ${number(bin.minSnrDb)} to ${number(bin.maxSnrDb)} dB`
          const intensity =
            bin.medianSnrDb === null
              ? 0
              : Math.max(0.04, Math.min(0.28, (bin.medianSnrDb + 10) / 150))
          return `<td class="observed" style="background:rgba(0,122,122,${intensity.toFixed(3)})" title="${escapeHtml(detail)}"><strong>${bin.medianSnrDb === null ? 'SNR unknown' : number(bin.medianSnrDb, ' dB')}</strong><small>${bin.count} report${bin.count === 1 ? '' : 's'}</small></td>`
        })
        .join('')
      return `<tr><th scope="row">${escapeHtml(receiver)}</th>${values}</tr>`
    })
    .join('')
  return `<div class="scroll"><table class="timeline"><caption>UTC fifteen-minute windows [start, end). Each cell is this receiver's median reported SNR and distinct report count. — means no retained observation, not no reception.${sparse ? ' Only populated windows are shown for this long interval.' : ''} Edge windows may be partial.</caption><thead><tr><th scope="col">Receiver</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`
}

function timelineMarkdown(analysis: ReceptionAnalysis, band: string, mode: string): string[] {
  const bins = analysis.timeBins.filter((bin) => bin.band === band && bin.mode === mode)
  const windows = [...new Set(bins.map((bin) => bin.startMs))].sort((a, b) => a - b)
  const receivers = [...new Set(bins.map((bin) => bin.receiver))].sort()
  const lines = [
    '### Reception timeline',
    '',
    'UTC fifteen-minute windows [start, end); only populated windows are shown. Cells show median receiver SNR / distinct reports. — means no retained observation, not no reception. Compare the same receiver, band and mode; edge windows may be partial.',
    '',
  ]
  if (windows.length > 12 || windows.length * Math.min(receivers.length, 16) > 192) {
    lines.push(
      '| Window start UTC | Receiver | Median SNR | Reports | Unknown SNR |',
      '| --- | --- | ---: | ---: | ---: |',
      ...bins
        .slice(0, 96)
        .map(
          (bin) =>
            `| ${iso(bin.startMs)} | ${escapeMarkdown(bin.receiver)} | ${number(bin.medianSnrDb, ' dB')} | ${bin.count} | ${bin.count - bin.snrCount} |`,
        ),
      '',
      ...(bins.length > 96
        ? [
            `Showing 96 of ${bins.length} populated receiver/window rows; the HTML and JSON companions retain every window.`,
            '',
          ]
        : []),
    )
    return lines
  }
  const cells = new Map(bins.map((bin) => [`${bin.receiver}\u0000${bin.startMs}`, bin]))
  lines.push(
    `| Receiver | ${windows.map((start) => `${iso(start).slice(0, 10)} ${timeLabel(start)}`).join(' | ')} |`,
    `| --- | ${windows.map(() => '---:').join(' | ')} |`,
    ...receivers.slice(0, 16).map((receiver) => {
      const values = windows.map((start) => {
        const bin = cells.get(`${receiver}\u0000${start}`)
        return bin ? `${number(bin.medianSnrDb, ' dB')} / ${bin.count}` : '—'
      })
      return `| ${escapeMarkdown(receiver)} | ${values.join(' | ')} |`
    }),
    '',
    ...(receivers.length > 16
      ? [
          `Showing 16 of ${receivers.length} receiver rows; the HTML and JSON companions retain every receiver.`,
          '',
        ]
      : []),
  )
  return lines
}

function receiverTableHtml(summaries: readonly ReceptionSummary[]): string {
  const rows = summaries
    .map(
      (summary) =>
        `<tr><th scope="row">${escapeHtml(summary.receiver)}</th><td>${escapeHtml(summary.receiverGrid ?? 'Unknown')}</td><td>${summary.count}</td><td>${number(summary.medianSnrDb, ' dB')}</td><td>${summary.snrCount ? `${number(summary.minSnrDb)}–${number(summary.maxSnrDb)} dB` : 'Unknown'}</td><td>${summary.count - summary.snrCount}</td><td>${number(summary.distanceKm, ' km')}</td><td>${escapeHtml(iso(summary.latest.timeMs))}</td></tr>`,
    )
    .join('')
  return `<div class="scroll"><table><caption>Receiver summaries across the requested interval. Distance is estimated from the supplied station origin.</caption><thead><tr><th>Receiver</th><th>Grid</th><th>Reports</th><th>Median SNR</th><th>Range</th><th>Unknown SNR</th><th>Distance</th><th>Latest UTC</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

function qsoTableHtml(context: readonly QsoReceptionContext[]): string {
  if (!context.length) return ''
  const rows = context
    .map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.contactCall ?? 'Unknown')}</th><td>${escapeHtml(iso(row.timeMs))}</td><td>${escapeHtml(row.band ?? 'Unknown')} ${escapeHtml(row.mode ?? '')}</td><td>${escapeHtml(row.receiver ?? 'Unmatched')}</td><td>${number(row.snrDb, ' dB')}</td><td>${number(row.ageSeconds === null ? null : row.ageSeconds / 60, ' min')}</td><td>${number(row.receiverToContactKm, ' km')}</td><td>${escapeHtml(row.reason ?? row.contactLocation?.precision ?? '')}</td></tr>`,
    )
    .join('')
  return `<section><h2>Nearby reception evidence at QSO time</h2><p>A nearby skimmer's SNR is not the contact station's SNR. Matches use preceding observations on the same band and mode, and an explicitly recorded contact location; unmatched contacts remain visible.</p><div class="scroll"><table><thead><tr><th>Contact</th><th>QSO UTC</th><th>Band / mode</th><th>Receiver</th><th>Receiver SNR</th><th>Age</th><th>To contact</th><th>Location or reason</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
}

function collectionJournalHtml(evidence: RbnEvidence): string {
  if (!evidence.attempts.length)
    return '<p class="note">No retrieval journal was retained for this dataset.</p>'
  const rows = evidence.attempts
    .map((attempt) => {
      const accepted = attempt.pages.reduce((sum, page) => sum + page.acceptedRows, 0)
      const state =
        attempt.kind === 'live'
          ? 'Live snapshot; interval completeness unverified'
          : attempt.complete
            ? 'Historical retrieval completed'
            : `Partial: ${attempt.stopReason}`
      return `<tr><td>${escapeHtml(iso(attempt.startedAtMs))}</td><td>${escapeHtml(attempt.kind)}</td><td>${escapeHtml(iso(attempt.request.startMs))}<br>${escapeHtml(iso(attempt.request.endMs))}</td><td>${attempt.pages.length}</td><td>${accepted}</td><td>${escapeHtml(state)}${accepted === 0 && attempt.pages.some((page) => page.status === 200) ? '<br>No accepted reports in successful responses' : ''}</td><td>${escapeHtml(attempt.errors.join('; ') || 'None')}</td></tr>`
    })
    .join('')
  return `<details><summary>Collection journal (${evidence.attempts.length} retained attempts)</summary><div class="scroll"><table><caption>A failure, an empty successful response, and a time with no collection are different states. Historical recovery does not erase earlier interruptions.</caption><thead><tr><th>Attempt UTC</th><th>Source</th><th>Requested UTC range</th><th>Pages</th><th>Accepted rows</th><th>Result</th><th>Errors</th></tr></thead><tbody>${rows}</tbody></table></div></details>`
}

const styles = `:root{color-scheme:light;font-family:system-ui,-apple-system,sans-serif;color:#173342;background:#f3f7f9}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:32px 24px}header{padding:28px;background:#173342;color:white;border-radius:16px}h1{margin:4px 0 12px;font-size:clamp(26px,4vw,42px)}h2{font-size:24px}h3{font-size:18px}.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase}p{line-height:1.55}section{background:white;margin-top:24px;padding:24px;border:1px solid #d8e3e9;border-radius:14px}.status{padding:14px 18px;border-left:4px solid #007a7a;background:#e6f3f1}.status.partial{border-color:#9a6000;background:#fff4dc}.metrics{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.metric{flex:1;min-width:160px;padding:14px;background:#ffffff18;border-radius:8px}.metric strong{display:block;font-size:28px}.metric span{font-size:13px}.map svg{display:block;width:100%;height:auto}.scroll{overflow:auto;margin-top:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #d8e3e9;text-align:left;padding:10px;vertical-align:top}thead th{background:#eef4f7}caption{text-align:left;color:#536e7c;font-size:12px;line-height:1.5;padding-bottom:10px}.timeline th,.timeline td{min-width:105px;border:1px solid #d8e3e9;text-align:center}.timeline th:first-child{position:sticky;left:0;background:#eef4f7;z-index:1;text-align:left}.timeline th span{display:block;font-size:10px;color:#536e7c}.timeline small{display:block;font-size:11px;margin-top:4px}.empty{color:#728995}.note{color:#536e7c;font-size:13px}.synthetic{font-weight:700;color:#ffdb8a}li{line-height:1.5;margin:6px 0}footer{color:#536e7c;font-size:12px;padding:20px 0}@media print{body{background:white}main{max-width:none;padding:0}header,section{break-inside:avoid;border-radius:0}section{padding:12px}.scroll{overflow:visible}table{font-size:10px}.timeline th,.timeline td{min-width:0;padding:4px}.timeline th:first-child{position:static}header{color:#173342;background:white;border-bottom:2px solid #173342}.metric{background:#eef4f7}.synthetic{color:#8b5900}}`

export function renderEvidenceHtml(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  const notes = warnings(evidence, analysis)
  const sections = groups(analysis)
    .map((group, index) => {
      const reports = analysis.reports.filter(
        (report) => report.band === group.band && report.mode === group.mode,
      )
      const mapped = mapStations(reports).length
      const receivers = new Set(reports.map((report) => report.receiver)).size
      const unlocated = receivers - mapped
      return `<section><h2>${escapeHtml(group.band)} · ${escapeHtml(group.mode)}</h2><div class="map">${mapSvg(evidence, reports, `rbn-map-${index}-`)}</div><p class="note">${mapped} located reporting receivers; ${unlocated} receiver${unlocated === 1 ? ' lacks' : 's lack'} usable coordinates. Maps use the latest retained location per receiver. Paths connect recorded endpoints; they do not measure the ionospheric path or imply coverage between sites.</p><h3>Reception timeline</h3>${timelineHtml(evidence, analysis, group.band, group.mode)}<h3>Receiver details</h3>${receiverTableHtml(group.summaries)}</section>`
    })
    .join('')
  const empty = analysis.reports.length
    ? ''
    : '<section><h2>No retained observations</h2><p>The retrieval produced no retained exact-call observations in this interval. This does not establish that the station was unheard.</p></section>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title(evidence, options))}</title><style>${styles}</style></head><body><main><header><div class="eyebrow">RBN via Vail · Reception observations</div><h1>${escapeHtml(title(evidence, options))}</h1>${isSynthetic(options) ? '<p class="synthetic">SYNTHETIC EXAMPLE — invented observations, not an actual activation.</p>' : ''}<p>${escapeHtml(evidence.request.call)} · ${escapeHtml(iso(evidence.request.startMs))} to ${escapeHtml(iso(evidence.request.endMs))}</p><div class="metrics"><div class="metric"><strong>${analysis.counts.observations}</strong><span>Distinct observations</span></div><div class="metric"><strong>${analysis.counts.receivers}</strong><span>Reporting receivers</span></div><div class="metric"><strong>${analysis.counts.unknownSnr}</strong><span>Observations with unknown SNR</span></div><div class="metric"><strong>${analysis.counts.unlocated}</strong><span>Observations without receiver coordinates</span></div></div></header><section><h2>Collection and interpretation</h2><p class="status${evidence.complete ? '' : ' partial'}">${escapeHtml(collectionStatus(evidence))}</p><p>${interpretation}</p><p class="note">Data retrieved ${escapeHtml(iso(evidence.retrievedAtMs))}. Observation timestamps determine the windows; retrieval time does not. First report: ${escapeHtml(iso(analysis.firstObservationMs))}; last report: ${escapeHtml(iso(analysis.lastObservationMs))}.</p>${notes.length ? `<ul>${notes.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : ''}${collectionJournalHtml(evidence)}</section>${sections}${empty}${qsoTableHtml(analysis.qsoContext)}<footer>Offline report. Geographic outlines: Natural Earth via the shared reception map. Keep the CSV or JSON companion for individual observations, provider rows and retrieval details.</footer></main></body></html>\n`
}

export function renderEvidenceMarkdown(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  const notes = warnings(evidence, analysis)
  const lines = [
    `# ${escapeMarkdown(title(evidence, options))}`,
    '',
    ...(isSynthetic(options)
      ? ['**SYNTHETIC EXAMPLE — invented observations, not an actual activation.**', '']
      : []),
    `Station: ${escapeMarkdown(evidence.request.call)}`,
    `Interval: ${iso(evidence.request.startMs)} to ${iso(evidence.request.endMs)}`,
    `Data retrieved: ${iso(evidence.retrievedAtMs)}`,
    '',
    `**${analysis.counts.observations} distinct observations · ${analysis.counts.receivers} reporting receivers · ${analysis.counts.unknownSnr} observations with unknown SNR.**`,
    '',
    collectionStatus(evidence),
    '',
    interpretation,
    '',
    ...notes.flatMap((warning) => [`- ${escapeMarkdown(warning)}`]),
    '',
  ]
  for (const group of groups(analysis)) {
    const reports = analysis.reports.filter(
      (report) => report.band === group.band && report.mode === group.mode,
    )
    const mapped = mapStations(reports).length
    const receivers = new Set(reports.map((report) => report.receiver)).size
    lines.push(
      `## ${escapeMarkdown(group.band)} · ${escapeMarkdown(group.mode)}`,
      '',
      `${reports.length} observations; ${mapped} located receivers; ${receivers - mapped} receivers without usable coordinates.`,
      '',
      ...timelineMarkdown(analysis, group.band, group.mode),
      '### Receiver details',
      '',
      '| Receiver | Grid | Reports | Median SNR | Range | Unknown SNR | Distance | Latest UTC |',
      '| --- | --- | ---: | ---: | --- | ---: | ---: | --- |',
      ...group.summaries
        .slice(0, 16)
        .map(
          (summary) =>
            `| ${escapeMarkdown(summary.receiver)} | ${escapeMarkdown(summary.receiverGrid ?? 'Unknown')} | ${summary.count} | ${number(summary.medianSnrDb, ' dB')} | ${summary.snrCount ? `${number(summary.minSnrDb)}–${number(summary.maxSnrDb)} dB` : 'Unknown'} | ${summary.count - summary.snrCount} | ${number(summary.distanceKm, ' km')} | ${iso(summary.latest.timeMs)} |`,
        ),
      '',
      ...(group.summaries.length > 16
        ? [
            `Showing 16 of ${group.summaries.length} receiver rows; the HTML and JSON companions retain every receiver.`,
            '',
          ]
        : []),
    )
  }
  if (!analysis.reports.length)
    lines.push(
      'No retained exact-call observations. This does not establish that the station was unheard.',
      '',
    )
  if (analysis.qsoContext.length)
    lines.push(
      `Contact context: ${analysis.qsoContext.filter((row) => row.status === 'matched').length} of ${analysis.qsoContext.length} contacts have nearby preceding receiver evidence. Receiver SNR is not the contact station's SNR. See the JSON or contact-context CSV for matches and explicit unmatched reasons.`,
      '',
    )
  lines.push(
    'Keep the HTML timeline, observation CSV or detailed JSON companion for the full evidence. Maps show sampled receiver sites, not a coverage area.',
    '',
  )
  return lines.join('\n')
}

export function renderEvidenceCsv(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  return csv([
    [
      'export_title',
      'synthetic',
      'provider',
      'operation_id',
      'station_call',
      'observation_id',
      'observation_utc',
      'receiver',
      'receiver_grid',
      'receiver_latitude',
      'receiver_longitude',
      'receiver_location_source',
      'country',
      'frequency_khz',
      'band',
      'mode',
      'reported_snr_db',
      'cw_wpm',
      'first_retrieved_utc',
      'collection_complete',
    ],
    ...analysis.reports.map((report) => [
      title(evidence, options),
      isSynthetic(options),
      evidence.provider,
      evidence.request.operationId,
      report.call,
      report.id,
      iso(report.timeMs),
      report.receiver,
      report.receiverGrid,
      report.receiverLatitude,
      report.receiverLongitude,
      report.receiverLocationSource,
      report.country,
      report.frequencyKhz,
      report.band,
      report.mode,
      report.snrDb,
      report.wpm,
      iso(report.retrievedAtMs),
      evidence.complete,
    ]),
  ])
}

export function renderEvidenceQsoCsv(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  return csv([
    [
      'export_title',
      'synthetic',
      'qso_id',
      'station_call',
      'contact_call',
      'qso_utc',
      'band',
      'mode',
      'status',
      'reason',
      'contact_grid',
      'contact_location_source',
      'contact_location_precision',
      'observation_id',
      'receiver',
      'receiver_grid',
      'receiver_location_source',
      'receiver_location_precision',
      'observation_utc',
      'first_retrieved_utc',
      'observation_age_seconds',
      'receiver_to_contact_km',
      'distance_from_origin_km',
      'frequency_difference_khz',
      'reported_receiver_snr_db',
    ],
    ...analysis.qsoContext.map((row) => [
      title(evidence, options),
      isSynthetic(options),
      row.qsoId,
      row.stationCall,
      row.contactCall,
      iso(row.timeMs),
      row.band,
      row.mode,
      row.status,
      row.reason,
      row.contactLocation?.grid,
      row.contactLocation?.source,
      row.contactLocation?.precision,
      row.reportId,
      row.receiver,
      row.receiverGrid,
      row.receiverLocationSource,
      row.receiverLocationPrecision,
      iso(row.reportTimeMs),
      iso(row.firstSeenMs),
      row.ageSeconds,
      row.receiverToContactKm,
      row.distanceFromOriginKm,
      row.frequencyDifferenceKhz,
      row.snrDb,
    ]),
  ])
}

export function renderEvidenceJson(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  return `${JSON.stringify({ ...evidence, exportMetadata: { title: title(evidence, options), synthetic: isSynthetic(options) }, interpretation, qsoContext: analysis.qsoContext }, null, 2)}\n`
}

export function renderEvidenceMap(
  evidence: RbnEvidence,
  options: EvidenceRenderOptions = {},
): string {
  const analysis = buildReceptionAnalysis(evidence, options.qsos)
  const synthetic =
    isSynthetic(options) && !/^SYNTHETIC EXAMPLE\b/i.test(title(evidence, options))
      ? 'SYNTHETIC EXAMPLE — '
      : ''
  const description = `${synthetic}${title(evidence, options)}. ${collectionStatus(evidence)} ${interpretation}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="620" viewBox="0 0 960 620" role="img"><title>${escapeHtml(title(evidence, options))}</title><desc>${escapeHtml(description)}</desc><rect width="960" height="620" fill="${mapTheme.surface}"/><text x="20" y="30" font-family="sans-serif" font-size="20" fill="${mapTheme.text}">${escapeHtml(`${synthetic}${title(evidence, options)}`.slice(0, 95))}</text><text x="20" y="56" font-family="sans-serif" font-size="13" fill="${mapTheme.muted}">All retained bands and modes · ${analysis.counts.observations} observations · ${analysis.counts.receivers} receivers</text><text x="20" y="78" font-family="sans-serif" font-size="12" fill="${mapTheme.muted}">${escapeHtml(evidence.complete ? 'Service interval retrieved; sampled reception sites, not global coverage.' : 'Partial collection; sampled reception sites, not global coverage.')}</text><g transform="translate(0 94)">${mapSvg(evidence, analysis.reports)}</g><text x="20" y="612" font-family="sans-serif" font-size="11" fill="${mapTheme.muted}">Paths connect receiver locations. SNR is not aggregated across bands or modes. Unlocated observations remain in the archive.</text></svg>\n`
}
