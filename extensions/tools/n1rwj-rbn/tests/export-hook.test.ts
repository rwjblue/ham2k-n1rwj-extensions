import type { ExportOptionsRequest } from '@ham2k/extension-sdk'
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
describe('RBN export workflow', () => {
  it('freezes saved evidence for all formats without retrieving history', async () => {
    let now = NOW
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const archive = createEvidenceRetriever({ fetch, timers, now: () => now })
    await archive.appendLive(
      { operationId: 'operation', call: 'N1RWJ', startMs: NOW - 15 * 60_000, endMs: NOW },
      { startedAtMs: NOW, retrievedAtMs: NOW, payload: payload() },
    )
    const hook = createRbnExportHook(archive, () => now)
    const options = await hook.suggestExportOptions?.(args, { online: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(options).toHaveLength(6)
    expect(new Set(options?.map((option) => option.exportKey)).size).toBe(6)
    expect(
      options?.filter((option) => option.selectedByDefault).map((option) => option.format),
    ).toEqual(['html'])
    if (!options) throw new Error('Missing export options')
    const firstKey = options[0].exportKey
    const baseline = await Promise.all(
      options.map((option) =>
        hook.generateExport(
          { ...args, exportType: option.exportType, exportKey: option.exportKey },
          { online: true },
        ),
      ),
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
      const result = await hook.generateExport(
        { ...args, exportType: option.exportType, exportKey: option.exportKey },
        { online: true },
      )
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
    const options = await hook.suggestExportOptions?.(args, { online: true })
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
        },
        { online: true },
      ),
    ).rejects.toThrow('does not match the requested format')
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
    const options = await hook.suggestExportOptions?.(emptyLog, { online: true })
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
    const options = await hook.suggestExportOptions?.(args, { online: true })
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
    const options = await hook.suggestExportOptions?.(args, { online: true })
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
    const options = await hook.suggestExportOptions?.(args, { online: true })
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
