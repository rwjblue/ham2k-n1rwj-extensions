import { host } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import mstManifest from '../../../extensions/contests/n1rwj-mst/manifest.json'
import { config as mst } from '../../../extensions/contests/n1rwj-mst/src/config.ts'
import sstManifest from '../../../extensions/contests/n1rwj-sst/manifest.json'
import { config as sst } from '../../../extensions/contests/n1rwj-sst/src/config.ts'
import { createHistoryData } from '../src/data.ts'

afterEach(() => vi.restoreAllMocks())
describe.each([
  { config: mst, manifest: mstManifest },
  { config: sst, manifest: sstManifest },
])('$config.shortName native N1MM history', ({ config, manifest }) => {
  const body = `# ${config.historyAliases[0]}\n!!Order!!,Call,Name,Exch1\nK1ABC,BOB,MA\n`
  it('delegates download to the host, persists JSON, replays offline, and removes data', async () => {
    const fetch = vi.spyOn(host, 'fetch')
    const kv = vi.spyOn(host, 'kvSet')
    const { dataFile, current } = createHistoryData(config, manifest)
    const url = `n1mm-history:${config.historyStem}`
    expect(dataFile).toMatchObject({
      key: `${manifest.key}_history`,
      url,
      fetchType: 'raw',
      maxAgeInDays: 1,
    })
    const saved = await dataFile.rawToJSONData?.({ body, url, options: {} })
    expect(saved).toMatchObject({ schema: 1, body, url })
    expect(current()?.records.K1ABC).toEqual(
      config.type === 'mst'
        ? { call: 'K1ABC', name: 'BOB' }
        : { call: 'K1ABC', name: 'BOB', location: 'MA' },
    )
    const offline = createHistoryData(config, manifest)
    offline.dataFile.onLoadRawData?.(JSON.parse(JSON.stringify(saved)))
    expect(offline.current()).toEqual(current())
    await offline.dataFile.onRemoveRawData?.()
    expect(offline.current()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
    expect(kv).not.toHaveBeenCalled()
  })
  it('retains history when a refresh or native replay is invalid or older', async () => {
    const { dataFile, current } = createHistoryData(config, manifest)
    const url = `n1mm-history:${config.historyStem}`
    const snapshot = { schema: 1, body, url, fetchedAt: '2026-10-29T12:00:00Z' }
    dataFile.onLoadRawData?.(snapshot)
    const previous = current()
    for (const invalid of [
      null,
      { ...snapshot, schema: 2 },
      { ...snapshot, body: 42 },
      { ...snapshot, url: 42 },
      { ...snapshot, fetchedAt: 'invalid' },
      { ...snapshot, body: '<html>Error</html>' },
      { ...snapshot, body: body.replace('BOB', 'OLDER'), fetchedAt: '2026-10-29T13:00:00+02:00' },
    ]) {
      dataFile.onLoadRawData?.(invalid)
      expect(current()).toBe(previous)
    }
    await expect(
      dataFile.rawToJSONData?.({ body: '<html>Error</html>', url, options: {} }),
    ).rejects.toThrow()
    expect(current()).toBe(previous)
  })
})

describe('SST history with unsupported location fields', () => {
  it('refreshes and replays names and valid locations, while keeping the cache after a fatal parse failure', async () => {
    const { dataFile, current } = createHistoryData(sst, sstManifest)
    const url = 'https://n1mm.hamdocs.com/history.txt'
    dataFile.onLoadRawData?.({
      schema: 1,
      body: '# K1USNSST\n!!Order!!,Call,Name,Exch1\nK1ABC,OLD,CT\n',
      url,
      fetchedAt: '2026-09-29T12:00:00.000Z',
    })
    const body =
      '# K1USNSST\n!!Order!!,Call,Name,Exch1\nK1ABC,BOB,MA\nKE2ET,LARRY,CWA\nSM4X,LARS,SM\n'
    const snapshot = await dataFile.rawToJSONData?.({ body, url, options: {} })
    expect(snapshot).toMatchObject({ schema: 1, body, url })
    expect(current()).toEqual({
      count: 3,
      warnings: 2,
      updatedAt: undefined,
      records: {
        K1ABC: { call: 'K1ABC', name: 'BOB', location: 'MA' },
        KE2ET: { call: 'KE2ET', name: 'LARRY' },
        SM4X: { call: 'SM4X', name: 'LARS' },
      },
    })

    const restarted = createHistoryData(sst, sstManifest)
    restarted.dataFile.onLoadRawData?.(JSON.parse(JSON.stringify(snapshot)))
    expect(restarted.current()).toEqual(current())

    const previous = current()
    await expect(
      dataFile.rawToJSONData?.({ body: `${body}INVALID,NAME,MA\n`, url, options: {} }),
    ).rejects.toThrow('Invalid call-history file. Previous data retained.')
    expect(current()).toBe(previous)
  })
})
