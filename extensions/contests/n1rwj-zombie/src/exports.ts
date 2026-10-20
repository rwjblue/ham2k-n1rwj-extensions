// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { AdifFieldsHook, ExportHook, ExportRequest } from '@ham2k/extension-sdk'
import {
  adifForExport,
  exportFilename,
  exportTypeDefinition,
  startMillisOf,
} from '@ham2k/extension-sdk'
import { effectiveSent, exchangeText, received, sent } from './exchange.ts'
import { EVENT_REF, type Qson, RULES_URL, refOf, TYPE, text } from './model.ts'
import { scoreLog, summaryText } from './scorer.ts'

type Manifest = { key: string }

export function createExports(manifest: Manifest) {
  const activityName = (operation: Qson) =>
    `Zombie-Shuffle-${text(refOf(operation)?.ref) || EVENT_REF}`
  const filename = (operation: Qson, qsos: Qson[], extension: string, compact?: boolean) =>
    exportFilename({
      stationCall: operation.stationCall,
      activity: activityName(operation),
      startAtMillis: startMillisOf(operation, qsos),
      extension,
      compact,
    })
  const adifFields = {
    async fieldsForOneQSO({ operation, qso }, _ctx) {
      if (!refOf(operation)) return []
      const fields = [{ name: 'CONTEST_ID', value: 'ZOMBIE' }]
      const ours = exchangeText(effectiveSent(operation, qso))
      const theirs = exchangeText(received(qso))
      if (ours) fields.push({ name: 'STX_STRING', value: ours })
      if (theirs) fields.push({ name: 'SRX_STRING', value: theirs })
      // RST_SENT/RST_RCVD come from native our.sent/their.sent. A Zombie
      // number is a membership number/area code, not an ADIF serial number.
      return fields
    },
  } satisfies AdifFieldsHook
  const exports = {
    async getExportTypes(_args, _ctx) {
      return [
        exportTypeDefinition(TYPE, 'adif', 'Zombie Shuffle'),
        exportTypeDefinition(TYPE, 'text', 'Zombie Shuffle score summary'),
      ]
    },
    async suggestExportOptions({ operation, qsos, compactFilenames }, _ctx) {
      if (!refOf(operation)) return []
      return [
        {
          exportType: `${TYPE}-adif`,
          templateData: { activity: activityName(operation) },
          format: 'adif',
          label: 'Zombie Shuffle ADIF',
          filename: filename(operation, qsos ?? [], 'adi', compactFilenames),
          refType: TYPE,
          selectedByDefault: true,
        },
        {
          exportType: `${TYPE}-text`,
          templateData: { activity: activityName(operation) },
          format: 'text',
          label: 'Zombie Shuffle score summary',
          filename: filename(operation, qsos ?? [], 'txt', compactFilenames),
          refType: TYPE,
          selectedByDefault: true,
        },
      ]
    },
    async generateExport(args: ExportRequest, _ctx) {
      if (!refOf(args.operation)) return { filename: '', mimeType: '', content: '' }
      if (args.exportType === `${TYPE}-adif`) {
        const content = await adifForExport({
          operation: args.operation,
          qsos: args.qsos,
          segments: args.segments,
          includeLookupData: args.includeLookupData,
          includePrivateData: args.includePrivateData,
          exportSettings: args.exportSettings,
          exportData: args.exportData,
          exportTitle: args.exportTitle,
          mainHandler: manifest.key,
        })
        return {
          filename: filename(args.operation, args.qsos, 'adi', args.compactFilenames),
          mimeType: 'text/plain',
          content,
        }
      }
      if (args.exportType !== `${TYPE}-text`) return { filename: '', mimeType: '', content: '' }
      const op = refOf(args.operation)
      const ours = sent(args.operation)
      const { scoresheet } = scoreLog(args.operation, args.qsos, args.segments)
      const excluded =
        args.qsos.filter((qso) => !qso.deleted && qso.band !== 'event').length - scoresheet.qsos
      const content = [
        `Zombie Shuffle ${text(op?.ref) || EVENT_REF} score summary`,
        '',
        `Callsign: ${text(args.operation.stationCall)}`,
        `State / province / country: ${ours.spc}`,
        `Zombie number sent: ${ours.zombieNumber}`,
        `Zombie name: ${ours.zombieName}`,
        `Event-day UTC offset: ${text(op?.utcOffset) || 'NOT CONFIGURED'}`,
        `Operating window: ${op?.flexibleHours === true ? 'Flexible hours (HI / AK / DX), local event date' : '15:00–midnight local event date'}`,
        '',
        summaryText(scoresheet),
        `Excluded / unscored contacts: ${excluded}. Review scoring alerts for duplicates, incomplete exchanges, mode/band and event hours.`,
        '',
        'Review this summary and complete any additional information requested by the organizer before submitting.',
        'Keep the ADIF log for your records. The organizer requests a summary, not your full log.',
        `Current rules and submission instructions: ${RULES_URL}`,
        '',
      ].join('\n')
      return {
        filename: filename(args.operation, args.qsos, 'txt', args.compactFilenames),
        mimeType: 'text/plain',
        content,
      }
    },
  } satisfies ExportHook
  return { adifFields, exports }
}
