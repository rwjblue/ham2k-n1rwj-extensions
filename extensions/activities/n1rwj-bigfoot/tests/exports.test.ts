import assert from 'node:assert/strict'
import type { ExportRequest } from '@ham2k/extension-sdk'
import { hooks } from '@ham2k/extension-sdk'
import { afterEach, test, vi } from 'vitest'
import manifest from '../manifest.json' with { type: 'json' }
import { BigfootAdifFields, BigfootExports, worksheetCsv } from '../src/exports.ts'
import { EVENT_2026, type Qson, qualifyingContacts } from '../src/rules.ts'

const operation: Qson = {
  uuid: 'hunt',
  stationCall: 'N1RWJ',
  refs: [
    { type: 'bigfoot', ref: '2026' },
    { type: 'potaActivation', ref: 'US-0001' },
  ],
}

function qso(call = 'W7B', overrides: Qson = {}): Qson {
  return {
    uuid: call,
    their: { call, sent: '579' },
    our: { sent: '599' },
    band: '20m',
    mode: 'CW',
    startAtMillis: Date.UTC(2026, 9, 19, 23, 58),
    ...overrides,
  }
}

function request(qsos: Qson[], overrides: Partial<ExportRequest> = {}): ExportRequest {
  return { operation, qsos, exportType: 'bigfoot-csv', ...overrides }
}

afterEach(() => vi.restoreAllMocks())

test('options count eligible contacts, including imports without per-contact activity refs', async () => {
  const qsos = [
    qso(),
    qso('W7O'),
    qso('W7O', { uuid: 'second-o', band: '40m' }),
    qso('W4S'),
    qso('N1RWJ'),
    qso('W7I', { startAtMillis: EVENT_2026.startAtMillis - 1 }),
    qso('W7G', { startAtMillis: EVENT_2026.endAtMillis }),
    qso('W7F', { deleted: true }),
    qso('W7T', { band: '6m' }),
    qso('W7B', { uuid: 'fm', mode: 'FM' }),
    qso('W7B', { uuid: 'missing-time', startAtMillis: null }),
  ]
  const options = await BigfootExports.suggestExportOptions({ operation, qsos })
  assert.deepEqual(
    options.map((option) => option.exportType),
    ['bigfoot-adif', 'bigfoot-csv'],
  )
  assert.deepEqual(
    options.map((option) => option.qsoCount),
    [4, 4],
  )
  for (const option of options) {
    assert.equal(option.refType, 'bigfoot')
    assert.equal(option.templateData?.activity, 'BIGFOOT-2026')
  }
  const result = await BigfootExports.generateExport(request(qsos))
  const rows = result.content.trim().split('\r\n')
  assert.equal(rows.length, 5)
  assert.doesNotMatch(result.content, /N1RWJ|W7I|W7G|W7F|W7T|FM/)
  assert.match(result.content, /"W4S".*"Skunk Ape","Skunk Ape"/)
})

test('edits and deletions replace older UUID revisions before export filtering', async () => {
  const original = qso()
  const revisions: Qson[] = [
    { ...original, deleted: true },
    { ...original, their: { call: 'N1RWJ' } },
    { ...original, startAtMillis: EVENT_2026.endAtMillis },
  ]
  for (const revision of revisions) {
    const options = await BigfootExports.suggestExportOptions({
      operation,
      qsos: [original, revision],
    })
    assert.equal(options[0].qsoCount, 0)
    const result = await BigfootExports.generateExport(request([original, revision]))
    assert.equal(result.content.trim().split('\r\n').length, 1)
  }
})

test('CSV keeps entered reports and quotes commas, quotes and newlines', () => {
  const raw = qso('W7B', { our: { sent: '59,"9' }, their: { call: 'W7B', sent: '57\n9' } })
  const result = worksheetCsv(qualifyingContacts([raw], EVENT_2026))
  assert.match(result, /"59,""9","57\n9"/)
  assert.match(result, /"2026-10-19","23:58:00","20m","CW"/)
  const emptyReports = qso('W7I', { our: {}, their: { call: 'W7I' } })
  assert.match(worksheetCsv(qualifyingContacts([emptyReports], EVENT_2026)), /"CW","","","I","I"/)
  assert.ok(result.endsWith('\r\n'))
})

test('CSV attributes independent mixed and CW O pairs, leaving repeats unallocated', () => {
  const result = worksheetCsv(
    qualifyingContacts(
      [
        qso('W7O', { uuid: 'phone', mode: 'SSB', startAtMillis: Date.UTC(2026, 9, 19, 23, 57) }),
        qso('W7O', { uuid: 'cw-first' }),
        qso('W7O', { uuid: 'cw-repeat', startAtMillis: Date.UTC(2026, 9, 19, 23, 59) }),
        qso('W7O', { uuid: 'cw-second', band: '40m', startAtMillis: Date.UTC(2026, 9, 20, 0, 1) }),
      ],
      EVENT_2026,
    ),
  )
  const lines = result.trim().split('\r\n')
  assert.match(lines[1], /"SSB","599","579","O1",""$/)
  assert.match(lines[2], /"CW","599","579","O2","O1"$/)
  assert.match(lines[3], /"CW","599","579","",""$/)
  assert.match(lines[4], /"CW","599","579","","O2"$/)
})

test('ADIF delegates to the core writer with source fields and resolved settings', async () => {
  const delegate = vi
    .spyOn(hooks, 'invokeOne')
    .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<CALL:3>W7B <EOR>' } }])
  const source = qso('W7B', {
    mode: 'USB',
    our: { sent: '55' },
    their: { call: 'W7B', sent: '47', name: 'Copied Name' },
  })
  const exportSettings = {
    includePrivateData: false,
    includeLookupData: true,
    customTemplates: true,
    adifNotesTemplate: 'Hunt notes',
  }
  const exportData = { activity: 'BIGFOOT-2026', qsoCount: 1 }
  const segments = [{ fromMillis: EVENT_2026.startAtMillis, operation }]
  const result = await BigfootExports.generateExport(
    request([source, qso('N1RWJ')], {
      exportType: 'bigfoot-adif',
      includePrivateData: false,
      includeLookupData: true,
      exportSettings,
      exportData,
      exportTitle: 'My hunt',
      segments,
      operatorFallback: 'station',
    }),
  )
  assert.equal(delegate.mock.calls.length, 1)
  const [category, key, method, delegated] = delegate.mock.calls[0]
  assert.equal(category, 'export')
  assert.equal(key, 'adif')
  assert.equal(method, 'generateExport')
  const args = delegated as ExportRequest
  assert.equal(args.exportType, 'adif')
  assert.equal(args.mainHandler, manifest.key)
  assert.deepEqual(await BigfootAdifFields.fieldsForOneQSO(), [])
  assert.deepEqual(args.qsos, [source])
  assert.equal(args.qsos[0], source)
  assert.equal(args.includePrivateData, false)
  assert.equal(args.includeLookupData, true)
  assert.equal(args.exportSettings, exportSettings)
  assert.equal(args.exportData, exportData)
  assert.equal(args.exportTitle, 'My hunt')
  assert.equal(args.segments, segments)
  assert.equal(args.operatorFallback, 'station')
  assert.equal(args.includeFieldsFrom, undefined)
  assert.equal(result.content, '<CALL:3>W7B <EOR>')
})

test('both private-data choices survive ADIF delegation', async () => {
  const delegate = vi
    .spyOn(hooks, 'invokeOne')
    .mockResolvedValue([{ key: 'adif', ok: true, value: { content: 'ADIF' } }])
  for (const includePrivateData of [true, false])
    await BigfootExports.generateExport(
      request([qso()], { exportType: 'bigfoot-adif', includePrivateData }),
    )
  assert.deepEqual(
    delegate.mock.calls.map((call) => (call[3] as ExportRequest).includePrivateData),
    [true, false],
  )
})

test('option and generated filenames agree for both formats and compact preferences', async () => {
  vi.spyOn(hooks, 'invokeOne').mockResolvedValue([
    { key: 'adif', ok: true, value: { content: 'ADIF' } },
  ])
  for (const compactFilenames of [false, true]) {
    const options = await BigfootExports.suggestExportOptions({
      operation,
      qsos: [qso()],
      compactFilenames,
    })
    for (const option of options) {
      const result = await BigfootExports.generateExport(
        request([qso()], { exportType: option.exportType, compactFilenames }),
      )
      assert.equal(result.filename, option.filename)
      assert.equal(
        result.filename,
        compactFilenames
          ? `N1RWJ-bigfoot-2026-20261013.${option.format === 'adif' ? 'adi' : 'csv'}`
          : `2026-10-13 N1RWJ for BIGFOOT-2026.${option.format === 'adif' ? 'adi' : 'csv'}`,
      )
    }
  }
})

test('unrelated and unknown editions offer no exports and never delegate', async () => {
  const delegate = vi.spyOn(hooks, 'invokeOne')
  for (const refs of [[], [{ type: 'custom', ref: '2026' }], [{ type: 'bigfoot', ref: '2027' }]]) {
    const other = { ...operation, refs }
    assert.deepEqual(
      await BigfootExports.suggestExportOptions({ operation: other, qsos: [qso()] }),
      [],
    )
    for (const exportType of ['bigfoot-adif', 'bigfoot-csv'])
      assert.deepEqual(
        await BigfootExports.generateExport(request([qso()], { operation: other, exportType })),
        { filename: '', mimeType: '', content: '' },
      )
  }
  assert.deepEqual(await BigfootExports.generateExport(request([qso()], { exportType: 'adif' })), {
    filename: '',
    mimeType: '',
    content: '',
  })
  assert.equal(delegate.mock.calls.length, 0)
})
