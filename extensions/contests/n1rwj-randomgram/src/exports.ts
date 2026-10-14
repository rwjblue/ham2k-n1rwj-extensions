// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { AdifFieldsHook, ExportHook, ExportRequest, HookContext } from '@ham2k/extension-sdk'
import {
  adifForExport,
  exportFilename,
  exportTypeDefinition,
  startMillisOf,
} from '@ham2k/extension-sdk'
import { receivedGroup, sentGroup, validGroup } from './exchange.ts'
import { BANDS, object, type Qson, REF_TYPE, refOf, text } from './model.ts'

function matchesEvent(operation: Qson, qso: Qson): boolean {
  const event = refOf(operation)
  const contact = refOf(qso)
  return !!event && !!contact && (!text(contact.ref) || text(contact.ref) === text(event.ref))
}

function listeningOnly(qso: Qson): boolean {
  return refOf(qso)?.listeningOnly === true
}

function participant(operation: Qson): string {
  // A supplied SWL identifier may be different from the station's callsign.
  // Keep the submission header on one line even if pasted setup contains a newline.
  return (text(refOf(operation)?.participant).trim() || text(operation.stationCall).trim()).replace(
    /\s+/g,
    ' ',
  )
}

export type ReceivedSubmission = {
  groups: string[]
  repeated: number
  invalid: number
}

/** Organizer submission contains received groups only, once each, in logged order. */
export function receivedSubmission(operation: Qson, qsos: Qson[]): ReceivedSubmission {
  const groups: string[] = []
  const seen = new Set<string>()
  let repeated = 0
  let invalid = 0
  for (const qso of qsos) {
    if (qso.deleted || !matchesEvent(operation, qso) || refOf(qso)?.skipped === true) continue
    const listening = listeningOnly(qso)
    if (qso.band === 'event' && !listening) continue
    if (!listening && (text(qso.mode).toUpperCase() !== 'CW' || !BANDS.includes(text(qso.band)))) {
      invalid++
      continue
    }
    const group = receivedGroup(qso)
    const alphabet = refOf(operation)?.alphabet === 'letters' ? 'letters' : 'alphanumeric'
    if (!validGroup(group, alphabet)) {
      invalid++
      continue
    }
    if (seen.has(group)) {
      repeated++
      continue
    }
    seen.add(group)
    groups.push(group)
  }
  return { groups, repeated, invalid }
}

/** Also used by the report command when the host hides exports on SWL-only logs. */
export function submissionText(operation: Qson, qsos: Qson[]): string {
  const { groups } = receivedSubmission(operation, qsos)
  return `${participant(operation)}\n\n${groups.length ? `${groups.join('\n')}\n` : ''}`
}

async function withListeningEntries(
  operation: Qson,
  qsos: Qson[],
  ctx: HookContext,
): Promise<Qson[]> {
  const uuid = text(operation.uuid)
  if (!uuid || !ctx.getQsos) return qsos
  // The host's export payload contains contacts only. Read once while listing
  // or generating a submission to recover our own durable listening notes.
  const fullLog = await ctx.getQsos(uuid)
  if (!fullLog)
    throw new Error('The RandomGram log is unavailable. Retry before submitting received groups.')
  const merged = [...qsos]
  const seen = new Set(qsos.map((qso) => text(qso.uuid)).filter(Boolean))
  for (const qso of fullLog) {
    if (qso.deleted || qso.band !== 'event' || !listeningOnly(qso) || !matchesEvent(operation, qso))
      continue
    const noteUuid = text(qso.uuid)
    if (noteUuid && seen.has(noteUuid)) continue
    if (noteUuid) seen.add(noteUuid)
    merged.push(qso)
  }
  return merged
}

function submissionLabel(submission: ReceivedSubmission): string {
  const details = [`${submission.groups.length} received groups`]
  if (submission.repeated) details.push(`${submission.repeated} repeated groups omitted`)
  if (submission.invalid) details.push(`${submission.invalid} invalid entries omitted`)
  return `RandomGram submission (${details.join('; ')})`
}

export function createExports(manifest: { key: string }) {
  const adifFields = {
    async fieldsForOneQSO({ qso, operation }, _ctx: HookContext) {
      if (
        qso.deleted ||
        qso.band === 'event' ||
        listeningOnly(qso) ||
        !matchesEvent(operation, qso)
      )
        return []
      // Keep a malformed correction in the log export even though display and
      // keying correctly refuse to treat it as an available code group.
      const ours =
        sentGroup(operation, qso) ||
        text(refOf(qso)?.ourGroup).trim() ||
        text(object(qso.our).exchange).trim()
      const theirs = receivedGroup(qso)
      const fields: { name: string; value: string }[] = []
      // Groups are literal strings: neither a numeric serial nor an ADIF contest ID.
      if (ours) fields.push({ name: 'STX_STRING', value: ours })
      if (theirs) {
        fields.push({ name: 'SRX_STRING', value: theirs })
        fields.push({
          name: 'COMMENT',
          value: [`RandomGram ${text(refOf(operation)?.ref)}`, `RX: ${theirs}`]
            .filter(Boolean)
            .join(' '),
        })
      }
      return fields
    },
  } satisfies AdifFieldsHook

  const activity = (operation: Qson) =>
    ['RandomGram', text(refOf(operation)?.ref)].filter(Boolean).join('-')
  const filename = (operation: Qson, qsos: Qson[], extension: string, compact?: boolean) =>
    exportFilename({
      stationCall: participant(operation),
      activity: activity(operation),
      startAtMillis: startMillisOf(operation, qsos),
      extension,
      compact,
    })

  const exports = {
    async getExportTypes() {
      return [
        exportTypeDefinition(REF_TYPE, 'text', 'RandomGram received groups'),
        exportTypeDefinition(REF_TYPE, 'adif', 'RandomGram'),
      ]
    },
    async suggestExportOptions({ operation, qsos, compactFilenames }, ctx: HookContext) {
      if (!refOf(operation)) return []
      const submissionQsos = await withListeningEntries(operation, qsos, ctx)
      const submission = receivedSubmission(operation, submissionQsos)
      const contacts = qsos.filter(
        (qso) =>
          !qso.deleted &&
          qso.band !== 'event' &&
          !listeningOnly(qso) &&
          matchesEvent(operation, qso),
      )
      return [
        {
          exportType: `${REF_TYPE}-text`,
          templateData: { activity: activity(operation) },
          format: 'text',
          label: submissionLabel(submission),
          filename: filename(operation, submissionQsos, 'txt', compactFilenames),
          refType: REF_TYPE,
          qsoCount: submission.groups.length,
          selectedByDefault: true,
        },
        {
          exportType: `${REF_TYPE}-adif`,
          templateData: { activity: activity(operation) },
          format: 'adif',
          label: 'RandomGram ADIF (contacts only)',
          filename: filename(operation, contacts, 'adi', compactFilenames),
          refType: REF_TYPE,
          qsoCount: contacts.length,
          selectedByDefault: false,
        },
      ]
    },
    async generateExport(args: ExportRequest, ctx: HookContext) {
      if (!refOf(args.operation)) return { filename: '', mimeType: '', content: '' }
      if (args.exportType === `${REF_TYPE}-text`) {
        const qsos = await withListeningEntries(args.operation, args.qsos, ctx)
        // The operator sees counts/omissions in the option label, keeping the
        // sponsor's file free of outgoing groups and non-submission commentary.
        return {
          filename: filename(args.operation, qsos, 'txt', args.compactFilenames),
          mimeType: 'text/plain',
          content: submissionText(args.operation, qsos),
        }
      }
      if (args.exportType !== `${REF_TYPE}-adif`) return { filename: '', mimeType: '', content: '' }
      const qsos = args.qsos.filter(
        (qso) =>
          !qso.deleted &&
          qso.band !== 'event' &&
          !listeningOnly(qso) &&
          matchesEvent(args.operation, qso),
      )
      // A listening-only annotation has no contact time/callsign exchange and
      // belongs in the received-group submission, not an invented ADIF QSO.
      const content = await adifForExport({
        operation: args.operation,
        qsos,
        segments: args.segments,
        includeLookupData: args.includeLookupData,
        includePrivateData: args.includePrivateData,
        exportSettings: args.exportSettings,
        exportData: args.exportData,
        exportTitle: args.exportTitle,
        mainHandler: manifest.key,
      })
      return {
        filename: filename(args.operation, qsos, 'adi', args.compactFilenames),
        mimeType: 'text/plain',
        content,
      }
    },
  } satisfies ExportHook
  return { adifFields, exports }
}
