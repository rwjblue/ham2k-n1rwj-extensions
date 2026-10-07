import type { AdifFieldsHook, ExportHook, ExportRequest } from '@ham2k/extension-sdk'
import { adifForExport, exportFilename, exportTypeDefinition } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { eventFromOperation, REF_TYPE } from './activity.ts'
import { buildProgress, type Contact, type Qson, qualifyingContacts } from './rules.ts'

// The core ADIF writer requires the declared main handler to exist, even
// when an event adds no exchange or award fields to the ordinary QSO.
export const BigfootAdifFields = {
  async fieldsForOneQSO() {
    return []
  },
} satisfies AdifFieldsHook

function eligibleQsos(operation: Qson, qsos: Qson[]): Qson[] {
  const event = eventFromOperation(operation)
  if (!event) return []
  // Resolve repeated UUID revisions before filtering, including deletions.
  const keyed = new Map<string, Qson>()
  const unkeyed: Qson[] = []
  for (const qso of qsos) {
    if (typeof qso.uuid === 'string' && qso.uuid.trim()) keyed.set(qso.uuid.trim(), qso)
    else unkeyed.push(qso)
  }
  return [...keyed.values(), ...unkeyed].filter(
    (qso) => qualifyingContacts([qso], event).length > 0,
  )
}

function filename(
  args: { operation: Qson; qsos: Qson[]; compactFilenames?: boolean },
  extension: string,
) {
  const event = eventFromOperation(args.operation)
  return exportFilename({
    stationCall: args.operation.stationCall,
    activity: `BIGFOOT-${event?.year ?? ''}`,
    startAtMillis: event?.startAtMillis,
    extension,
    compact: args.compactFilenames,
  })
}

function csv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function worksheetCsv(contacts: Contact[]): string {
  const progress = buildProgress(contacts)
  const slotsFor = (mode: 'MIXED' | 'CW', uuid: string) => {
    const slots = progress[mode].slots.flatMap((slot, index) =>
      slot.contact?.uuid === uuid
        ? [slot.call === 'W7O' ? `O${index === 4 ? '1' : '2'}` : slot.letter]
        : [],
    )
    if (progress[mode].bonus?.uuid === uuid) slots.push('Skunk Ape')
    return slots.join(' ')
  }
  const rows = [
    [
      'Callsign',
      'UTC date',
      'UTC time',
      'Band',
      'Mode',
      'Report sent',
      'Report received',
      'Mixed slot',
      'CW slot',
    ],
    ...contacts.map((contact) => [
      contact.call,
      contact.utcDate,
      new Date(contact.at).toISOString().slice(11, 19),
      contact.band,
      contact.mode,
      contact.sentReport,
      contact.receivedReport,
      slotsFor('MIXED', contact.uuid),
      slotsFor('CW', contact.uuid),
    ]),
  ]
  return `${rows.map((row) => row.map(csv).join(',')).join('\r\n')}\r\n`
}

export const BigfootExports = {
  async getExportTypes() {
    return [
      exportTypeDefinition(REF_TYPE, 'adif', 'BIGFOOT'),
      exportTypeDefinition(REF_TYPE, 'csv', 'BIGFOOT worksheet'),
    ]
  },
  async suggestExportOptions(args) {
    if (!eventFromOperation(args.operation)) return []
    const qsos = eligibleQsos(args.operation, args.qsos)
    return [
      {
        exportType: 'bigfoot-adif',
        format: 'adif',
        label: 'BIGFOOT ADIF',
        filename: filename(args, 'adi'),
        qsoCount: qsos.length,
      },
      {
        exportType: 'bigfoot-csv',
        format: 'csv',
        label: 'BIGFOOT worksheet (CSV)',
        filename: filename(args, 'csv'),
        qsoCount: qsos.length,
      },
    ].map((option) => ({
      ...option,
      icon: manifest.icon,
      color: manifest.accentColor,
      templateData: { activity: `BIGFOOT-${eventFromOperation(args.operation)?.year}` },
      selectedByDefault: true,
      // The host scopes by effective operation refs, including segments;
      // individual contacts need no bigfoot ref of their own.
      refType: REF_TYPE,
    }))
  },
  async generateExport(args: ExportRequest) {
    const event = eventFromOperation(args.operation)
    if (!event || (args.exportType !== 'bigfoot-adif' && args.exportType !== 'bigfoot-csv'))
      return { filename: '', mimeType: '', content: '' }
    const qsos = eligibleQsos(args.operation, args.qsos)
    if (args.exportType === 'bigfoot-csv')
      return {
        filename: filename(args, 'csv'),
        mimeType: 'text/csv',
        content: worksheetCsv(qualifyingContacts(qsos, event)),
      }
    return {
      filename: filename(args, 'adi'),
      mimeType: 'text/plain',
      content: await adifForExport({ ...args, qsos, mainHandler: manifest.key }),
    }
  },
} satisfies ExportHook
