import type { ExportOptionsRequest } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createEvidenceRetriever } from '../src/export/history.ts'
import { createRbnExportHook } from '../src/export/hook.ts'
import { NOW, payload } from './data/fixtures.ts'

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
  it('freezes one interval for all formats and reuses one service retrieval', async () => {
    let now = NOW
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const retriever = createEvidenceRetriever({ fetch, timers, now: () => now })
    const hook = createRbnExportHook(retriever, () => now)
    const options = await hook.suggestExportOptions?.(args, { online: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(options).toHaveLength(6)
    expect(new Set(options?.map((option) => option.exportKey)).size).toBe(1)
    if (!options) throw new Error('Missing export options')
    const firstKey = options[0].exportKey
    for (const option of options) {
      now += 1000
      const result = await hook.generateExport(
        { ...args, exportType: option.exportType, exportKey: option.exportKey },
        { online: true },
      )
      expect(result.content.length).toBeGreaterThan(0)
    }
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain(`until=${Math.ceil(NOW / 1000)}`)
    expect(firstKey).toContain(String(NOW))
  })
  it('withholds precise operator location from maps and every archived attempt while retaining provider evidence', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify(payload()) })
    const hook = createRbnExportHook(
      createEvidenceRetriever({ fetch, timers, now: () => NOW }),
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
    const hook = createRbnExportHook(
      createEvidenceRetriever({ fetch, timers, now: () => NOW }),
      () => NOW,
    )
    expect(await hook.suggestExportOptions?.({ ...args, qsos: [] }, { online: true })).toEqual([])
    const result = await hook.generateExport(
      { ...args, exportType: 'rbnReception-json' },
      { online: false },
    )
    const evidence = JSON.parse(result.content)
    expect(evidence.complete).toBe(false)
    expect(evidence.reports).toEqual([])
    expect(evidence.warnings.join(' ')).toContain('Offline')
    expect(fetch).not.toHaveBeenCalled()
  })
})
