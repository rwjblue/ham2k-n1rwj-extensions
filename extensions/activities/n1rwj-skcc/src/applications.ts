// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0

import type { AwardId, AwardOptions, AwardReport } from './awards.ts'
import { AWARD_IDS, analyzeAwards } from './awards.ts'
import { exchangeFromAdif, ownFromAdif } from './exports.ts'
import type { Qson, Roster } from './model.ts'
import { memberNumber, object, text } from './model.ts'
import { lookupMember } from './roster.ts'

export interface ParsedAdif {
  records: Record<string, string>[]
  errors: string[]
}

/** ADIF is length-delimited: a name containing <EOR> is still a name. */
export function parseAdif(source: string): ParsedAdif {
  const records: Record<string, string>[] = [],
    errors: string[] = []
  if (source.length > 25000000)
    return { records, errors: ['ADIF exceeds the 25 MB analysis limit'] }
  let record: Record<string, string> = {},
    cursor = 0,
    recordInvalid = false
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor)
    if (open < 0) break
    const close = source.indexOf('>', open + 1)
    if (close < 0) {
      errors.push('Unterminated ADIF field')
      break
    }
    const tag = source
      .slice(open + 1, close)
      .trim()
      .toUpperCase()
    cursor = close + 1
    if (tag === 'EOH') {
      record = {}
      recordInvalid = false
      continue
    }
    if (tag === 'EOR') {
      if (!recordInvalid && Object.keys(record).length) records.push(record)
      record = {}
      recordInvalid = false
      if (records.length > 100000) {
        errors.push('ADIF exceeds the 100,000 contact analysis limit')
        break
      }
      continue
    }
    const match = tag.match(/^([A-Z0-9_]+):(\d+)(?::[A-Z])?$/)
    if (!match) {
      errors.push(`Invalid ADIF field declaration near character ${open}`)
      recordInvalid = true
      continue
    }
    const length = Number(match[2])
    if (!Number.isSafeInteger(length) || cursor + length > source.length) {
      errors.push(`Truncated ${match[1]} field`)
      break
    }
    const value = source.slice(cursor, cursor + length)
    cursor += length
    if (match[1] in record && record[match[1]] !== value) {
      errors.push(`Conflicting ${match[1]} fields in one record`)
      recordInvalid = true
    }
    record[match[1]] = value
  }
  if (Object.keys(record).length) errors.push('Unterminated ADIF record was skipped')
  return { records, errors }
}

function adifTime(date: string | undefined, time: string | undefined): number | undefined {
  if (!date || !/^\d{8}$/.test(date) || !time || !/^\d{4}(?:\d{2})?$/.test(time)) return undefined
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6) || '00'}Z`
  const result = Date.parse(iso)
  return Number.isFinite(result) && new Date(result).toISOString().slice(0, 19) === iso.slice(0, 19)
    ? result
    : undefined
}
function positiveNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}
function bandFromFrequency(frequency: number | undefined): string {
  if (frequency === undefined) return ''
  const ranges: [number, number, string][] = [
    [1.8, 2, '160m'],
    [3.5, 4, '80m'],
    [5, 5.5, '60m'],
    [7, 7.3, '40m'],
    [10.1, 10.15, '30m'],
    [14, 14.35, '20m'],
    [18.068, 18.168, '17m'],
    [21, 21.45, '15m'],
    [24.89, 24.99, '12m'],
    [28, 29.7, '10m'],
    [50, 54, '6m'],
    [144, 148, '2m'],
  ]
  return ranges.find(([from, to]) => frequency >= from && frequency <= to)?.[2] ?? ''
}

export function qsosFromAdif(
  source: string,
  roster: Roster | undefined,
  options: AwardOptions = {},
): { qsos: Qson[]; records: number; skipped: number; errors: string[] } {
  const parsed = parseAdif(source),
    qsos: Qson[] = []
  const selected = roster?.members.find(
    (member) => member.number === memberNumber(options.myNumber),
  )
  let skipped = 0
  for (const [index, fields] of parsed.records.entries()) {
    const at = adifTime(fields.QSO_DATE, fields.TIME_ON)
    const call = text(fields.CALL).toUpperCase()
    const normalized = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key.toLowerCase(), value]),
    )
    const ref = exchangeFromAdif(normalized)
    if (!ref || at === undefined || !call) {
      skipped++
      continue
    }
    const own = ownFromAdif(normalized)
    let ownCall = text(fields.STATION_CALLSIGN || fields.OPERATOR).toUpperCase()
    // The attestation is a deliberate import choice, never the default or native-claims behavior.
    if (
      options.attestImportedEligibility &&
      memberNumber(ref.number ?? ref.ref) &&
      text(fields.MODE).toUpperCase() === 'CW'
    ) {
      if (!ownCall && selected) ownCall = selected.call
      const ownIdentity = lookupMember(roster, ownCall, own.number ?? selected?.number)
      if (!('qualified' in ref)) ref.qualified = true
      if (!('qualified' in own)) own.qualified = true
      if (!('number' in own) && ownIdentity) own.number = ownIdentity.number
      if (!('name' in own) && ownIdentity) own.name = ownIdentity.name
    }
    if (fields.APP_SKCCLOGGER_KEYTYPE && !('key' in own))
      own.key = fields.APP_SKCCLOGGER_KEYTYPE.toUpperCase()
    ref.our = own
    const ours: Qson = { call: ownCall, skcc: own }
    const theirs: Qson = { call }
    for (const [target, field, property] of [
      [ours, 'TX_PWR', 'power'],
      [theirs, 'RX_PWR', 'power'],
    ] as const) {
      const value = positiveNumber(fields[field])
      if (value !== undefined) target[property] = value
    }
    for (const [target, field, property] of [
      [ours, 'MY_DXCC', 'dxcc'],
      [theirs, 'DXCC', 'dxcc'],
      [ours, 'MY_CONT', 'continent'],
      [theirs, 'CONT', 'continent'],
      [ours, 'RST_SENT', 'rst'],
      [theirs, 'RST_RCVD', 'rst'],
    ] as const) {
      if (fields[field]) target[property] = fields[field]
    }
    const qso: Qson = {
      uuid: `adif:${index}:${at}:${call}`,
      startAtMillis: at,
      band: text(fields.BAND).toLowerCase() || bandFromFrequency(positiveNumber(fields.FREQ)),
      mode: text(fields.MODE).toUpperCase(),
      our: ours,
      their: theirs,
      refs: [ref],
    }
    const off = adifTime(fields.QSO_DATE_OFF ?? fields.QSO_DATE, fields.TIME_OFF)
    // A date-less end time earlier than start means the next UTC day, as in ADIF loggers.
    if (off !== undefined) qso.endAtMillis = off < at && !fields.QSO_DATE_OFF ? off + 86400000 : off
    qsos.push(qso)
  }
  return { qsos, records: parsed.records.length, skipped, errors: parsed.errors }
}

export function analyzeAdif(
  source: string,
  roster: Roster | undefined,
  options: AwardOptions = {},
): AwardReport {
  const { qsos, ...info } = qsosFromAdif(source, roster, options)
  const report = analyzeAwards(qsos, roster, {
    ...options,
    scope: options.scope ?? 'complete-history',
  })
  report.import = info
  if (options.attestImportedEligibility)
    report.limitations.unshift(
      'The operator explicitly attested approved keying and exchanged SKCC identities for imported SKCC-tagged CW contacts. This is not club verification.',
    )
  return report
}

function markdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|<>]/g, '\\$&').replace(/[\r\n]+/g, ' ')
}
function csv(value: string | number): string {
  let content = String(value)
  if (/^[=+@-]/.test(content)) content = `'${content}`
  return `"${content.replace(/"/g, '""')}"`
}

export function reportMarkdown(report: AwardReport): string {
  const lines = [
    `SKCC award audit — ${report.scope === 'complete-history' ? 'supplied complete-history file' : 'selected contacts'}`,
    '',
    `UTC month: ${report.month}. ${report.rows.length} distinct contacts analyzed.`,
    `Roster revision: ${markdown(report.rosterRevision || 'unavailable')}. Reanalyze after a roster refresh.`,
    '',
    '| Program | Progress | Status |',
    '| --- | ---: | --- |',
  ]
  for (const award of AWARD_IDS) {
    const summary = report.awards[award]
    const bonus = summary.bonusPoints ? ` + ${summary.bonusPoints} bonus points` : ''
    lines.push(
      `| ${summary.label} | ${summary.total}${summary.target ? ` / ${summary.target}` : ''} ${summary.unit}${bonus} | ${summary.ready ? 'Threshold reached; review and apply' : award === 'MARATHON' ? 'Needs sponsor confirmation' : 'Calculated from supplied records'} |`,
    )
  }
  if (report.import)
    lines.push(
      '',
      `ADIF: ${report.import.records} records, ${report.import.skipped} skipped.`,
      ...report.import.errors.map((error) => `- ${markdown(error)}`),
    )
  const rejected = report.rows.filter((row) => row.issues.length)
  if (rejected.length)
    lines.push(
      '',
      `${rejected.length} contacts need evidence or cannot qualify:`,
      ...rejected
        .slice(0, 30)
        .map(
          (row) => `- ${markdown(row.call || '(no call)')}: ${row.issues.map(markdown).join('; ')}`,
        ),
      ...(rejected.length > 30
        ? ['Additional rejected contacts are included in the audit export.']
        : []),
    )
  lines.push('', ...report.limitations.map((item) => `- ${item}`))
  return lines.join('\n')
}

/** Review sheet, deliberately not represented as a sponsor-approved application template. */
export function applicationCsv(report: AwardReport, award: AwardId): string {
  const rows: (string | number)[][] = [
    [
      'Program',
      'Scope',
      'Call',
      'SKCC',
      'Name',
      'SPC',
      'UTC',
      'Band',
      'Reference',
      'Points',
      'Key',
    ],
  ]
  for (const credit of report.awards[award].credits)
    rows.push([
      award,
      report.scope,
      credit.call,
      credit.number,
      credit.name,
      credit.spc,
      new Date(credit.at).toISOString(),
      credit.band,
      credit.ref,
      credit.points,
      credit.key ?? '',
    ])
  return rows.map((row) => row.map(csv).join(',')).join('\r\n')
}

export function applicationText(report: AwardReport, award: AwardId): string {
  const summary = report.awards[award]
  const lines = [
    `SKCC ${summary.label} — review worksheet`,
    `Scope: ${report.scope}; UTC month: ${report.month}`,
    `Calculated: ${summary.total} ${summary.unit}. This is not sponsor approval.`,
    'Review eligibility and use the club application instructions before submitting.',
    '',
    'UTC | Call | SKCC | Name | SPC | Band | Reference | Points | Key',
  ]
  for (const credit of summary.credits)
    lines.push(
      [
        new Date(credit.at).toISOString(),
        credit.call,
        credit.number,
        credit.name,
        credit.spc,
        credit.band,
        credit.ref,
        credit.points,
        credit.key ?? '',
      ].join(' | '),
    )
  lines.push('', 'Excluded / not selected:')
  for (const row of summary.excluded) lines.push(`${row.qsoId}: ${row.reasons.join('; ')}`)
  lines.push('', ...report.limitations)
  return lines.join('\n')
}

export function auditCsv(report: AwardReport): string {
  const lines: (string | number)[][] = [
    ['QSO', 'Call', 'SKCC', 'UTC', 'Band', 'Program', 'Result', 'Reason'],
  ]
  const selected = new Map(
    AWARD_IDS.map((award) => [
      award,
      new Set(report.awards[award].credits.map((credit) => credit.qsoId)),
    ]),
  )
  const reasons = new Map(
    AWARD_IDS.map((award) => [
      award,
      new Map(
        report.awards[award].excluded.map((entry) => [entry.qsoId, entry.reasons.join('; ')]),
      ),
    ]),
  )
  for (const row of report.rows)
    for (const award of AWARD_IDS) {
      const included = selected.get(award)?.has(row.id)
      lines.push([
        row.id,
        row.call,
        row.number,
        row.at ? new Date(row.at).toISOString() : '',
        row.band,
        award,
        included ? 'Selected' : 'Excluded',
        reasons.get(award)?.get(row.id) ?? '',
      ])
    }
  return lines.map((row) => row.map(csv).join(',')).join('\r\n')
}

/** A bounded snapshot for UI context, not a second live claims database. */
export function compactReport(report: AwardReport, limit = 5000): Qson {
  const awards: Qson = {}
  for (const id of AWARD_IDS) {
    const summary = report.awards[id]
    awards[id] = {
      label: summary.label,
      total: summary.total,
      target: summary.target,
      unit: summary.unit,
      ready: summary.ready,
      bonusPoints: summary.bonusPoints ?? 0,
      numbers: [...new Set(summary.credits.map((credit) => credit.number))].slice(0, limit),
    }
  }
  return {
    scope: report.scope,
    month: report.month,
    rosterRevision: report.rosterRevision,
    contacts: report.rows.length,
    awards,
    limitations: report.limitations,
    imported: object(report.import),
  }
}
