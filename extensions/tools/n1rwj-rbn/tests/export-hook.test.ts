import type {
  ExportHook,
  ExportOptionsRequest,
  ExportSettings,
  GlobalExportSettings,
} from '@ham2k/extension-sdk'
import { prepareExportOption, resolveExportSettings } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createRbnClient } from '../src/data/client.ts'
import type { ReceiverMetadata } from '../src/data/receivers.ts'
import { createEvidenceArchive } from '../src/export/archive.ts'
import { createEvidenceRetriever } from '../src/export/history.ts'
import { createRbnExportHook } from '../src/export/hook.ts'
import { NOW, payload, spotPayload } from './data/fixtures.ts'

const args: ExportOptionsRequest = {
  operation: {
    uuid: 'operation',
    stationCall: 'N1RWJ',
    lat: 41.0123456789,
    lon: -71.9123456789,
    grid: 'FN41aa12',
  },
  qsos: [
    {
      uuid: 'qso',
      our: { call: 'N1RWJ' },
      their: { call: 'W1AW', grid: 'FM19' },
      startAtMillis: NOW - 120_000,
      freq: 14060,
      band: '20m',
      mode: 'CW',
    },
  ],
}
const timers = { setTimeout: () => 1, clearTimeout: () => {} }

/** Use the published preparation path the host applies to registered types. */
async function preparedOptions(
  hook: ExportHook,
  request: ExportOptionsRequest = args,
  overrides: ExportSettings = {},
  global: GlobalExportSettings = {},
) {
  const definitions = (await hook.getExportTypes?.({}, { online: true })) ?? []
  const options = (await hook.suggestExportOptions?.(request, { online: true })) ?? []
  return options.map((option) => {
    const definition = definitions.find((candidate) => candidate.exportType === option.exportType)
    if (!definition) throw new Error('Missing registered RBN export type')
    return prepareExportOption(
      { ...option, exportSettings: resolveExportSettings(definition, global, overrides) },
      request.operation,
      request.qsos,
      request.compactFilenames ?? false,
    )
  })
}

describe('RBN export workflow', () => {
  it('uses a station title for blank SDK-prepared titles and preserves explicit titles in all formats', async () => {
    const archive = createEvidenceArchive()
    await archive.appendLive(
      { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 900_000, endMs: NOW },
      { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() },
    )
    const hook = createRbnExportHook(archive, () => NOW)
    const options = await preparedOptions(hook)
    expect(options.map((option) => option.format)).toEqual([
      'html',
      'md',
      'csv',
      'json',
      'svg',
      'qso.csv',
    ])
    for (const option of options) {
      // The published SDK currently strips title templates from non-ADIF types.
      expect(option.exportTitle).toBe('')
      for (const requested of [option.exportTitle, ' \t\n ', ' Summit reception evidence ']) {
        const title = requested.trim() || 'N1RWJ reception report'
        const result = await hook.generateExport(
          { ...args, ...option, exportTitle: requested },
          { online: true },
        )
        if (option.format === 'html') {
          expect(result.content).toContain(`<title>${title}</title>`)
          expect(result.content).toContain(`<h1>${title}</h1>`)
        } else if (option.format === 'md') {
          expect(result.content.split('\n')[0]).toBe(`# ${title}`)
        } else if (option.format === 'json') {
          expect(JSON.parse(result.content).exportMetadata.title).toBe(title)
        } else if (option.format === 'svg') {
          expect(result.content).toContain(`<title>${title}</title>`)
        } else {
          // Both CSV formats include the report title in each retained data row.
          expect(result.content.split('\r\n')[1]).toMatch(new RegExp(`^"${title}"`))
        }
      }
    }
  })
  it('freezes saved evidence for all formats without retrieving history', async () => {
    let now = NOW
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const archive = createEvidenceRetriever({ fetch, timers, now: () => now })
    await archive.appendLive(
      { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 15 * 60_000, endMs: NOW },
      { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() },
    )
    const hook = createRbnExportHook(archive, () => now)
    const options = await preparedOptions(hook)
    expect(fetch).not.toHaveBeenCalled()
    expect(options).toHaveLength(6)
    expect(new Set(options?.map((option) => option.exportKey)).size).toBe(6)
    expect(new Set(options.map((option) => option.exportData.rbnDatasetKey)).size).toBe(1)
    expect(
      options?.filter((option) => option.selectedByDefault).map((option) => option.format),
    ).toEqual(['html'])
    if (!options) throw new Error('Missing export options')
    const firstKey = options[0].exportKey
    const baseline = await Promise.all(
      options.map((option) => hook.generateExport({ ...args, ...option }, { online: true })),
    )
    await archive.appendLive(
      { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 15 * 60_000, endMs: NOW + 1000 },
      {
        startedAtMs: NOW + 1000,
        retrievedAtMs: NOW + 1000,
        payload: payload({ spots: [spotPayload({ id: 999 })] }),
      },
    )
    for (const [index, option] of options.entries()) {
      now += 1000
      const result = await hook.generateExport({ ...args, ...option }, { online: true })
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content).toBe(baseline[index].content)
      if (option.format === 'json')
        expect(
          JSON.parse(result.content).reports.map((report: { id: string }) => report.id),
        ).toEqual(['123'])
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(firstKey).toMatch(/^rbn:/)
  })
  it('keeps format checkbox identities independent and rejects a key for a different format', async () => {
    const hook = createRbnExportHook(createEvidenceArchive(), () => NOW)
    const options = await preparedOptions(hook)
    if (!options) throw new Error('Missing export options')
    // Mirror the host selection key to catch accidental coupling of formats.
    const selected = new Map(
      options.map((option) => [
        `N1RWJ|n1rwj-rbn:${option.exportKey ?? option.exportType}`,
        option.selectedByDefault ?? false,
      ]),
    )
    expect(selected.size).toBe(6)
    expect([...selected.values()].filter(Boolean)).toHaveLength(1)
    const html = options.find((option) => option.format === 'html')
    const csv = options.find((option) => option.format === 'csv')
    if (!html || !csv) throw new Error('Missing companion formats')
    selected.set(`N1RWJ|n1rwj-rbn:${csv.exportKey}`, true)
    expect(selected.get(`N1RWJ|n1rwj-rbn:${html.exportKey}`)).toBe(true)
    expect([...selected.values()].filter(Boolean)).toHaveLength(2)
    await expect(
      hook.generateExport(
        {
          ...args,
          exportType: csv.exportType,
          exportKey: html.exportKey,
          exportData: csv.exportData,
        },
        { online: true },
      ),
    ).rejects.toThrow('does not match the requested format')
  })
  it('preserves checkbox choices across filename and privacy reloads while round-tripping distinct frozen datasets', async () => {
    const archive = createEvidenceArchive()
    const request = {
      operationId: 'operation',
      call: 'N1RWJ',
      startMs: NOW - 900_000,
      endMs: NOW,
      origin: {
        latitude: 41.0123456789,
        longitude: -71.9123456789,
        label: 'Private station location',
      },
    }
    await archive.appendLive(request, { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() })
    const hook = createRbnExportHook(archive, () => NOW)
    const first = await preparedOptions(hook)
    const json = first.find((option) => option.format === 'json')
    if (!json) throw new Error('Missing JSON export')
    const selection = new Map<string, boolean>()
    const keyOf = (option: typeof json) =>
      `N1RWJ|n1rwj-rbn:${option.exportKey ?? option.exportType}`
    const reloadSelections = (options: typeof first) => {
      for (const option of options)
        if (!selection.has(keyOf(option)))
          selection.set(keyOf(option), option.selectedByDefault ?? false)
    }
    reloadSelections(first)
    // The operator replaces the default HTML choice with observations CSV.
    selection.set('N1RWJ|n1rwj-rbn:rbn:html', false)
    selection.set('N1RWJ|n1rwj-rbn:rbn:csv', true)

    await archive.appendLive(request, {
      startedAtMs: NOW + 1,
      retrievedAtMs: NOW + 1,
      payload: payload({ spots: [spotPayload({ id: 999 })] }),
    })
    const filenameSettings: ExportSettings = {
      customTemplates: true,
      compactFilenameTemplate: '{{ log.station }}-custom-{{ log.format }}',
      includePrivateData: false,
    }
    const compactArgs = { ...args, compactFilenames: true }
    const filenames = await preparedOptions(hook, compactArgs, filenameSettings)
    reloadSelections(filenames)
    expect(filenames.map((option) => option.exportKey)).toEqual(
      first.map((option) => option.exportKey),
    )
    expect(filenames[0].filename).not.toBe(first[0].filename)
    expect(selection.size).toBe(6)
    expect([...selection].filter(([, checked]) => checked).map(([key]) => key)).toEqual([
      'N1RWJ|n1rwj-rbn:rbn:csv',
    ])

    const privacy = await preparedOptions(hook, compactArgs, filenameSettings, {
      includePrivateData: true,
    })
    reloadSelections(privacy)
    expect(privacy.map((option) => option.exportKey)).toEqual(
      first.map((option) => option.exportKey),
    )
    expect(selection.get('N1RWJ|n1rwj-rbn:rbn:html')).toBe(false)
    expect(selection.get('N1RWJ|n1rwj-rbn:rbn:csv')).toBe(true)
    const reloadedJson = privacy.find((option) => option.format === 'json')
    if (!reloadedJson) throw new Error('Missing prepared JSON export')
    expect(reloadedJson.exportData.rbnDatasetKey).not.toBe(json.exportData.rbnDatasetKey)
    expect(reloadedJson.exportData.format).toBe('json')
    // The SDK deliberately omits ADIF-only privacy settings for these formats.
    expect(reloadedJson.exportSettings.includePrivateData).toBeUndefined()
    const publicResult = await hook.generateExport({ ...args, ...json }, { online: true })
    const reloadedResult = await hook.generateExport(
      { ...compactArgs, ...reloadedJson },
      { online: true },
    )
    expect(
      JSON.parse(publicResult.content).reports.map((report: { id: string }) => report.id),
    ).toEqual(['123'])
    expect(
      JSON.parse(reloadedResult.content).reports.map((report: { id: string }) => report.id),
    ).toEqual(['123', '999'])
    expect(publicResult.content).not.toContain(String(args.operation.lat))
    expect(reloadedResult.content).not.toContain(String(args.operation.lat))
  })
  it('rejects missing or invalid prepared dataset tokens rather than silently collecting a different snapshot', async () => {
    const hook = createRbnExportHook(createEvidenceArchive(), () => NOW)
    const options = await preparedOptions(hook)
    const option = options.find((item) => item.format === 'json')
    if (!option) throw new Error('Missing JSON export')
    await expect(
      hook.generateExport({ ...args, ...option, exportData: undefined }, { online: true }),
    ).rejects.toThrow('dataset token is missing or invalid')
    await expect(
      hook.generateExport(
        { ...args, ...option, exportData: { ...option.exportData, rbnDatasetKey: 1 } },
        { online: true },
      ),
    ).rejects.toThrow('dataset token is missing or invalid')
    await expect(
      hook.generateExport(
        { ...args, ...option, exportData: { ...option.exportData, rbnDatasetKey: 'invalid' } },
        { online: true },
      ),
    ).rejects.toThrow('dataset token is missing or invalid')
    await expect(
      hook.generateExport(
        { ...args, ...option, exportData: { ...option.exportData, rbnDatasetKey: 'rbn:999' } },
        { online: true },
      ),
    ).rejects.toThrow('expired')
    // Direct callers that did not receive an option can still read current saved data.
    await expect(
      hook.generateExport({ ...args, exportType: option.exportType }, { online: true }),
    ).resolves.toMatchObject({ mimeType: 'application/json' })
  })
  it('withholds precise operator location from maps and every archived attempt while retaining provider evidence', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const archive = createEvidenceRetriever({ fetch, timers, now: () => NOW })
    await archive.appendLive(
      {
        operationId: 'operation',
        call: 'N1RWJ',
        startMs: NOW - 15 * 60_000,
        endMs: NOW,
        origin: { latitude: 41.0123456789, longitude: -71.9123456789, label: 'FN41aa12' },
      },
      { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() },
    )
    const hook = createRbnExportHook(
      archive,
      () => NOW,
      () => ({ call: 'W3LPL', grid: 'FN42', country: 'United States', continent: 'NA' }),
    )
    const result = await hook.generateExport(
      { ...args, exportType: 'rbnReception-json' },
      { online: true },
    )
    const evidence = JSON.parse(result.content)
    expect(result.content).not.toContain(String(args.operation.lat))
    expect(result.content).not.toContain('FN41aa12')
    expect(evidence.request.origin.label).toContain('6-character grid center')
    expect(evidence.attempts[0].request.origin).toEqual(evidence.request.origin)
    expect(evidence.reports[0]).toMatchObject({
      receiverGrid: 'FN42',
      receiverLocationSource: 'rbn-directory',
      raw: { spotter_grid: 'FM19' },
    })
    expect(evidence.qsoContext[0].status).toBe('unmatched')
  })
  it('exports honest partial evidence offline and declines operations without dates or collection', async () => {
    const fetch = vi.fn()
    const hook = createRbnExportHook(createEvidenceArchive(), () => NOW)
    expect(await hook.suggestExportOptions?.({ ...args, qsos: [] }, { online: true })).toEqual([])
    const result = await hook.generateExport(
      { ...args, exportType: 'rbnReception-json' },
      { online: false },
    )
    const evidence = JSON.parse(result.content)
    expect(evidence.complete).toBe(false)
    expect(evidence.reports).toEqual([])
    expect(evidence.warnings.join(' ')).toContain('offline')
    expect(evidence.warnings.join(' ')).toContain('opt in')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('offers a normalized cached snapshot without contacts or recording and never refreshes it', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const client = createRbnClient({ fetch, now: () => NOW })
    await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
    fetch.mockClear()
    const hook = createRbnExportHook(
      createEvidenceArchive(),
      () => NOW,
      undefined,
      client.readSnapshots,
    )
    const emptyLog = { ...args, qsos: [] }
    const options = await preparedOptions(hook, emptyLog)
    expect(options).toHaveLength(6)
    const option = options?.find((item) => item.format === 'json')
    if (!option) throw new Error('Missing cached reception export')
    const result = await hook.generateExport({ ...emptyLog, ...option }, { online: true })
    const evidence = JSON.parse(result.content)
    expect(evidence.collectionSource).toBe('snapshot')
    expect(evidence.complete).toBe(false)
    expect(evidence.reports).toHaveLength(1)
    expect(evidence.reports[0]).toMatchObject({
      raw: {},
      retrievalKind: 'snapshot',
      receiverGrid: null,
    })
    expect(evidence.warnings.join(' ')).toContain('not operation-scoped')
    expect(fetch).not.toHaveBeenCalled()
    expect(
      await hook.suggestExportOptions?.(
        { ...emptyLog, operation: { ...args.operation, stationCall: 'N1RWJ/P' } },
        { online: true },
      ),
    ).toEqual([])
  })
  it('guards operation ownership and bounds the lifetime of offered datasets', async () => {
    const hook = createRbnExportHook(createEvidenceArchive(), () => NOW)
    const options = await preparedOptions(hook)
    const option = options?.[0]
    if (!option) throw new Error('Missing export option')
    await expect(
      hook.generateExport(
        { ...args, ...option, operation: { ...args.operation, uuid: 'another' } },
        { online: true },
      ),
    ).rejects.toThrow('another operation')
    for (let index = 0; index < 8; index++)
      await hook.suggestExportOptions?.(args, { online: true })
    await expect(hook.generateExport({ ...args, ...option }, { online: true })).rejects.toThrow(
      'expired',
    )
  })
  it.each(['empty', 'older'] as const)(
    'supplements an %s archive with cached reports while retaining original archive rows and failures',
    async (kind) => {
      const archive = createEvidenceArchive()
      const original = spotPayload({
        id: 123,
        snr: 7,
        timestamp: new Date(NOW - 600_000).toISOString(),
      })
      await archive.appendLive(
        { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 900_000, endMs: NOW - 300_000 },
        kind === 'empty'
          ? {
              startedAtMs: NOW - 300_000,
              retrievedAtMs: NOW - 300_000,
              error: 'Earlier poll failed',
            }
          : {
              startedAtMs: NOW - 300_000,
              retrievedAtMs: NOW - 300_000,
              payload: payload({ spots: [original] }),
            },
      )
      const fetch = vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify(
          payload({
            spots: [
              spotPayload({ id: 123, snr: 20, timestamp: new Date(NOW - 600_000).toISOString() }),
              spotPayload({ id: 124 }),
            ],
          }),
        ),
      })
      const client = createRbnClient({ fetch, now: () => NOW })
      await client.getSnapshot({ call: 'N1RWJ', windowMinutes: 15 })
      fetch.mockClear()
      const hook = createRbnExportHook(archive, () => NOW, undefined, client.readSnapshots)
      const result = await hook.generateExport(
        { ...args, exportType: 'rbnReception-json' },
        { online: true },
      )
      const evidence = JSON.parse(result.content)
      expect(evidence.collectionSource).toBe('archive-and-snapshot')
      expect(evidence.reports.map((report: { id: string }) => report.id)).toEqual(['123', '124'])
      expect(evidence.reports[1]).toMatchObject({ raw: {}, retrievalKind: 'snapshot' })
      expect(evidence.attempts).toHaveLength(1)
      if (kind === 'empty') expect(evidence.attempts[0].errors).toEqual(['Earlier poll failed'])
      else
        expect(evidence.reports[0]).toMatchObject({
          snrDb: 7,
          raw: original,
          retrievalKind: 'live',
        })
      expect(evidence.complete).toBe(false)
      expect(evidence.request.endMs).toBe(NOW)
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it('freezes directory metadata with the offered dataset across companion files', async () => {
    const archive = createEvidenceArchive()
    await archive.appendLive(
      { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 900_000, endMs: NOW },
      { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() },
    )
    const node: ReceiverMetadata = {
      call: 'W3LPL',
      grid: 'FN42',
      country: 'United States',
      continent: 'NA',
    }
    const lookup = vi.fn(() => node)
    const hook = createRbnExportHook(archive, () => NOW, lookup)
    const options = await preparedOptions(hook)
    const json = options?.find((option) => option.format === 'json')
    const csv = options?.find((option) => option.format === 'csv')
    if (!json || !csv) throw new Error('Missing companion exports')
    node.grid = 'EM12'
    const jsonResult = await hook.generateExport({ ...args, ...json }, { online: true })
    const csvResult = await hook.generateExport({ ...args, ...csv }, { online: true })
    expect(JSON.parse(jsonResult.content).reports[0].receiverGrid).toBe('FN42')
    expect(csvResult.content).toContain('FN42')
    expect(csvResult.content).not.toContain('EM12')
    expect(lookup).toHaveBeenCalledTimes(1)
  })
  it('omits one transmitter origin when generation receives moving operation segments', async () => {
    const hook = createRbnExportHook(createEvidenceArchive(), () => NOW)
    const options = await preparedOptions(hook)
    const option = options?.find((item) => item.format === 'json')
    if (!option) throw new Error('Missing export option')
    const result = await hook.generateExport(
      {
        ...args,
        ...option,
        segments: [
          {
            fromMillis: NOW - 60_000,
            operation: { ...args.operation, lat: 32, lon: -96, grid: 'EM12' },
          },
        ],
      },
      { online: true },
    )
    const evidence = JSON.parse(result.content)
    expect(evidence.request.origin).toBeUndefined()
    expect(evidence.warnings.join(' ')).toContain('different locations')
  })
})
