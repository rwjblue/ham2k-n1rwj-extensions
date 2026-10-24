// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import {
  type AdifFieldsHook,
  type AdifImportHook,
  adifForExport,
  type ExportHook,
  exportFilename,
  exportTypeDefinition,
  type OperationSegmentPayload,
  operationForQso,
} from '@ham2k/extension-sdk'
import { getExchange, isQualified, numberToken, ownExchange, reportFor } from './exchange.ts'
import { KEY, memberNumber, object, type Qson, refOf, TYPE, text } from './model.ts'
import { calculateEventReports, calculateEventScore, type EventScoreReport } from './scorer.ts'

const PREFIX = 'APP_N1RWJ_SKCC_'
const FIELDS = {
  number: 'NUMBER',
  name: 'NAME',
  spc: 'SPC',
  operatorCall: 'OPERATOR',
  key: 'KEY',
  qualified: 'QUALIFIED',
  grid: 'GRID',
  wpm: 'WPM',
  power: 'POWER',
  region: 'REGION',
  event: 'EVENT',
  keyDeclared: 'KEY_DECLARED',
  morseKeyType: 'MORSE_KEY_TYPE',
  keyInfo: 'KEY_INFO',
  rst: 'RST',
} as const
const MORSE_KEYS = ['SK', 'SS', 'BUG', 'FAB', 'SP', 'DP', 'CPU']

function readFields(fields: Record<string, string>, ours: boolean): Qson {
  const result: Qson = {}
  const cleared = new Set(
    (fields[`${PREFIX}${ours ? 'MY_' : ''}CLEAR_FIELDS`.toLowerCase()] ?? '').split(','),
  )
  for (const [property, suffix] of Object.entries(FIELDS)) {
    if (cleared.has(suffix)) {
      result[property] = ''
      continue
    }
    const field = `${PREFIX}${ours ? 'MY_' : ''}${suffix}`.toLowerCase()
    if (!(field in fields)) continue
    const raw = fields[field] ?? ''
    if (property === 'qualified' || property === 'keyDeclared') {
      const value = raw.toUpperCase()
      result[property] =
        value === 'Y' || value === 'YES' || value === 'TRUE'
          ? true
          : value === 'N' || value === 'NO' || value === 'FALSE'
            ? false
            : ''
    } else result[property] = raw
  }
  return result
}
function standardEvidence(fields: Record<string, string>, ours: boolean, custom: Qson): Qson {
  const mappings = ours
    ? {
        key: 'my_morse_key_type',
        morseKeyType: 'my_morse_key_type',
        keyInfo: 'my_morse_key_info',
        name: 'my_name',
        grid: 'my_gridsquare',
        power: 'tx_pwr',
        rst: 'rst_sent',
      }
    : {
        key: 'morse_key_type',
        morseKeyType: 'morse_key_type',
        keyInfo: 'morse_key_info',
        name: 'name',
        grid: 'gridsquare',
        power: 'rx_pwr',
        rst: 'rst_rcvd',
      }
  for (const [property, field] of Object.entries(mappings))
    if (!(property in custom) && fields[field] !== undefined) custom[property] = fields[field]
  const prefix = ours ? 'my_' : ''
  // STATE has different vocabularies in other countries, and is not a DX SPC.
  if (
    !('spc' in custom) &&
    ['1', '6', '110', '291'].includes(fields[`${prefix}dxcc`] ?? '') &&
    fields[`${prefix}state`] !== undefined
  )
    custom.spc = fields[`${prefix}state`]
  return custom
}
export function ownFromAdif(fields: Record<string, string>): Qson {
  return standardEvidence(fields, true, readFields(fields, true))
}
/** The standard SKCC field is membership evidence, never a key-policy attestation. */
export function exchangeFromAdif(fields: Record<string, string>): Qson | undefined {
  const received = readFields(fields, false)
  if (!('number' in received) && 'skcc' in fields) received.number = fields.skcc ?? ''
  if (!Object.keys(received).length) return undefined
  standardEvidence(fields, false, received)
  const own = ownFromAdif(fields)
  return {
    type: TYPE,
    ref: memberNumber(received.number) ?? '',
    ...received,
    ...(Object.keys(own).length ? { our: own } : {}),
  }
}
export const SKCCAdifImport: AdifImportHook = {
  async refsForRecords({ records }) {
    return records.map(({ fields }) => {
      const ref = exchangeFromAdif(fields)
      return ref ? { refs: [ref as { type: string; [key: string]: Qson[string] }] } : null
    })
  },
}
function persistedFields(exchange: Qson, ours: boolean): { name: string; value: string }[] {
  const result = Object.entries(FIELDS).flatMap(([property, suffix]) => {
    if (!(property in exchange)) return []
    const raw = exchange[property]
    const value =
      property === 'qualified' || property === 'keyDeclared'
        ? isQualified(raw) === true
          ? 'Y'
          : isQualified(raw) === false
            ? 'N'
            : ''
        : typeof raw === 'number'
          ? String(raw)
          : text(raw)
    return [{ name: PREFIX + (ours ? 'MY_' : '') + suffix, value }]
  })
  const clear = result
    .filter((field) => !field.value)
    .map((field) => field.name.slice((PREFIX + (ours ? 'MY_' : '')).length))
  // ADIF exporters may omit empty values; the explicit clear list survives.
  if (clear.length)
    result.push({ name: `${PREFIX + (ours ? 'MY_' : '')}CLEAR_FIELDS`, value: clear.join(',') })
  return result.filter((field) => field.value)
}
export const SKCCAdifFields: AdifFieldsHook = {
  async fieldsForOneQSO({ qso, operation }) {
    if (!refOf(qso) && !refOf(operation) && !Object.keys(object(object(qso.their).skcc)).length)
      return []
    const received = getExchange(qso)
    const ours = ownExchange(qso, operation)
    const fields = [...persistedFields(received, false), ...persistedFields(ours, true)]
    if (memberNumber(received.number))
      fields.unshift({ name: 'SKCC', value: numberToken(received.number) })
    if (text(received.name)) fields.push({ name: 'NAME', value: text(received.name) })
    if (reportFor(qso, 'their')) fields.push({ name: 'RST_RCVD', value: reportFor(qso, 'their') })
    if (reportFor(qso, 'our')) fields.push({ name: 'RST_SENT', value: reportFor(qso, 'our') })
    for (const [exchange, prefix] of [
      [received, ''],
      [ours, 'MY_'],
    ] as const) {
      const key = text(exchange.morseKeyType) || text(exchange.key)
      if (MORSE_KEYS.includes(key)) fields.push({ name: `${prefix}MORSE_KEY_TYPE`, value: key })
      if (text(exchange.keyInfo))
        fields.push({ name: `${prefix}MORSE_KEY_INFO`, value: text(exchange.keyInfo) })
    }
    return fields
  },
}
function csv(value: unknown): string {
  const raw = typeof value === 'number' ? String(value) : text(value)
  const safe = /^[=+@-]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}
export function worksheetCsv(
  qsos: Qson[],
  operation: Qson,
  segments: OperationSegmentPayload[] = [],
): string {
  const header = [
    'UTC start',
    'UTC end',
    'Station call',
    'Operator call',
    'Band',
    'Mode',
    'RST sent',
    'RST received',
    'Name',
    'SPC',
    'SKCC received',
    'Their key',
    'Their qualification',
    'My SKCC',
    'My key',
    'My qualification',
    'My watts',
    'Their watts',
    'Grid',
    'Event region',
    'Event',
  ]
  const time = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : ''
  const rows = qsos
    .filter((qso) => qso.band !== 'event' && qso.deleted !== true)
    .map((qso) => {
      const received = getExchange(qso),
        ours = ownExchange(qso, operationForQso(operation, qso, segments))
      return [
        time(qso.startAtMillis),
        time(qso.endAtMillis),
        object(qso.their).call,
        received.operatorCall,
        qso.band,
        qso.mode,
        reportFor(qso, 'our'),
        reportFor(qso, 'their'),
        received.name,
        received.spc,
        received.number,
        received.key,
        isQualified(received.qualified) === undefined
          ? 'unknown'
          : String(isQualified(received.qualified)),
        ours.number,
        ours.key,
        isQualified(ours.qualified) === undefined ? 'unknown' : String(isQualified(ours.qualified)),
        object(qso.our).power ?? ours.power,
        object(qso.their).power ?? received.power,
        received.grid,
        received.region,
        received.event ?? ours.event,
      ]
    })
  return `${[header, ...rows].map((row) => row.map(csv).join(',')).join('\r\n')}\r\n`
}
export function scoreReport(qsos: Qson[], operation: Qson): string {
  return formatScoreReport(calculateEventScore(qsos, operation))
}
function formatScoreReport(score: EventScoreReport): string {
  return `${[
    score.label,
    score.status,
    `Qualified contacts: ${score.qsos}`,
    `SPC multipliers: ${score.mults}`,
    `C/T/S bonus: ${score.membershipBonus}`,
    `Designated/club station bonus: ${score.specialBonus}`,
    `Grid bonus: ${score.gridBonus}`,
    `Birthday bonus: ${score.birthdayBonus}`,
    `Base: ${score.base}`,
    `Reviewed additional theme bonus: ${score.themeBonus}`,
    `Final score: ${score.total === undefined ? 'NOT REVIEWED' : score.total}`,
    `Contacts needing evidence: ${score.pending}`,
    `Duplicate contacts: ${score.duplicates}`,
    '',
    'Review the official event rules and enter the totals on the SKCC submission page. This file does not submit an entry or certify award credit.',
  ].join('\n')}\n`
}
export function eventScoreReports(
  qsos: Qson[],
  operation: Qson,
  segments: OperationSegmentPayload[] = [],
): string {
  return calculateEventReports(qsos, operation, segments).map(formatScoreReport).join('\n')
}
export const SKCCExports: ExportHook = {
  async getExportTypes() {
    return [
      exportTypeDefinition(TYPE, 'adif', 'SKCC'),
      exportTypeDefinition(TYPE, 'csv', 'SKCC worksheet'),
      exportTypeDefinition(TYPE, 'txt', 'SKCC event score'),
    ]
  },
  async suggestExportOptions(args) {
    if (!refOf(args.operation) && !args.qsos.some((qso) => !!refOf(qso))) return []
    return ['adif', 'csv', 'txt'].map((format) => ({
      exportType: `${TYPE}-${format}`,
      format,
      label:
        format === 'adif'
          ? 'SKCC ADIF'
          : format === 'csv'
            ? 'SKCC exchange worksheet'
            : 'SKCC event score review',
      filename: exportFilename({
        stationCall: args.operation.stationCall,
        activity: 'SKCC',
        extension: format === 'adif' ? 'adi' : format,
        compact: args.compactFilenames,
      }),
      refType: TYPE,
      selectedByDefault: format === 'adif',
    }))
  },
  async generateExport(args) {
    const format = (args.exportType ?? '').replace(/^skcc-/, '')
    if (!args.exportType?.startsWith('skcc-') || !['adif', 'csv', 'txt'].includes(format))
      return { filename: '', mimeType: '', content: '' }
    const qsos = args.qsos.filter((qso) => qso.band !== 'event' && qso.deleted !== true)
    const content =
      format === 'adif'
        ? await adifForExport({ ...args, qsos, mainHandler: KEY })
        : format === 'csv'
          ? worksheetCsv(qsos, args.operation, args.segments)
          : eventScoreReports(qsos, args.operation, args.segments)
    return {
      filename: exportFilename({
        stationCall: args.operation.stationCall,
        activity: 'SKCC',
        extension: format === 'adif' ? 'adi' : format,
        compact: args.compactFilenames,
      }),
      mimeType: format === 'csv' ? 'text/csv' : 'text/plain',
      content,
    }
  },
}
