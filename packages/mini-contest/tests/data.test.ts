import { host } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import mstManifest from '../../../extensions/contests/n1rwj-mst/manifest.json'
import { config as mst } from '../../../extensions/contests/n1rwj-mst/src/config.ts'
import sstManifest from '../../../extensions/contests/n1rwj-sst/manifest.json'
import { config as sst } from '../../../extensions/contests/n1rwj-sst/src/config.ts'
import { DEFAULT_SOURCE } from '../../n1mm/src/source.ts'
import { createHistoryData } from '../src/data.ts'

const start = new Date('2026-09-30T12:00:00Z')
const entry =
  '<html><form action="/mmfile/get/file/"><input name="cmdm_nonce" value="nonce"><input name="id" value="123"><input name="shortcodeId" value="download"></form></html>'
const downloadUrl = 'https://n1mm.hamdocs.com/mmfile/get/file/'

function useHostTimers() {
  vi.useFakeTimers()
  vi.setSystemTime(start)
  // Developer time travel can freeze Date while host timers continue to run.
  vi.spyOn(Date, 'now').mockReturnValue(start.getTime())
  vi.spyOn(host, 'setTimeout').mockImplementation((callback, delay) =>
    Number(setTimeout(callback, delay)),
  )
  vi.spyOn(host, 'clearTimeout').mockImplementation((id) => clearTimeout(id))
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe.each([
  { config: mst, manifest: mstManifest },
  { config: sst, manifest: sstManifest },
])('$config.shortName history downloads', ({ config, manifest }) => {
  const entryUrl = `https://n1mm.hamdocs.com/mmfiles/${config.historyPrefix}123-txt/`
  const listing = `<html><a href="${entryUrl}">${config.shortName}</a></html>`
  const body = `# ${config.historyAliases[0]}\n!!Order!!,Call,Name,Exch1\nK1ABC,BOB,MA\n`
  const expectedRecord =
    config.type === 'mst'
      ? { call: 'K1ABC', name: 'BOB' }
      : { call: 'K1ABC', name: 'BOB', location: 'MA' }

  it('allows a slow discovery and download with a frozen Date.now clock', async () => {
    useHostTimers()
    const fetch = vi
      .spyOn(host, 'fetch')
      .mockImplementationOnce(async () => {
        await delay(3600)
        return { status: 200, body: entry }
      })
      .mockImplementationOnce(async () => {
        await delay(4000)
        return { status: 200, body }
      })
    const { dataFile, current } = createHistoryData(config, manifest)

    const pending = dataFile.rawToJSONData?.({
      body: listing,
      url: DEFAULT_SOURCE,
      options: {},
    })
    await vi.advanceTimersByTimeAsync(7600)
    const snapshot = await pending

    expect(fetch).toHaveBeenNthCalledWith(1, entryUrl, { timeout: 8000 })
    expect(fetch).toHaveBeenNthCalledWith(2, downloadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'cmdm_nonce=nonce&id=123&shortcodeId=download',
      timeout: 8000,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(snapshot).toEqual({
      schema: 1,
      body,
      url: downloadUrl,
      fetchedAt: '2026-09-30T12:00:07.600Z',
    })
    expect(current()).toMatchObject({ count: 1, records: { K1ABC: expectedRecord } })
    expect(Date.now()).toBe(start.getTime())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains the last loaded snapshot and suggestions after a network failure', async () => {
    useHostTimers()
    vi.spyOn(host, 'getSettings').mockResolvedValue({})
    const fetch = vi
      .spyOn(host, 'fetch')
      .mockResolvedValueOnce({ status: 200, body: entry })
      .mockRejectedValueOnce(new Error('Network request failed'))
    const { dataFile, settings, current } = createHistoryData(config, manifest)
    const saved = {
      schema: 1,
      body,
      url: downloadUrl,
      fetchedAt: '2026-09-29T12:00:00.000Z',
    }
    dataFile.onLoadRawData?.(saved)
    const previous = current()

    await expect(
      dataFile.rawToJSONData?.({ body: listing, url: DEFAULT_SOURCE, options: {} }),
    ).rejects.toThrow('Network request failed')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(current()).toBe(previous)
    expect(current()?.records.K1ABC).toEqual(expectedRecord)
    expect(vi.getTimerCount()).toBe(0)
    expect(
      await settings.getDefinition({ panelKey: manifest.key }, { online: false }),
    ).toMatchObject({
      elements: [
        {
          type: 'markdown',
          text: expect.stringContaining(`Downloaded: ${saved.fetchedAt}.`),
        },
        {},
        {},
      ],
    })
  })

  it('does not start the download POST when a late discovery finishes after the deadline', async () => {
    useHostTimers()
    const fetch = vi.spyOn(host, 'fetch').mockImplementationOnce(async () => {
      await delay(9000)
      return { status: 200, body: entry }
    })
    const { dataFile, current } = createHistoryData(config, manifest)
    dataFile.onLoadRawData?.({
      schema: 1,
      body,
      url: downloadUrl,
      fetchedAt: '2026-09-29T12:00:00.000Z',
    })
    const previous = current()

    const rejected = expect(
      dataFile.rawToJSONData?.({ body: listing, url: DEFAULT_SOURCE, options: {} }),
    ).rejects.toThrow('N1MM download timed out. Previous data retained.')
    await vi.advanceTimersByTimeAsync(8000)
    await rejected

    expect(fetch).toHaveBeenCalledExactlyOnceWith(entryUrl, { timeout: 8000 })
    expect(current()).toBe(previous)
    expect(current()?.records.K1ABC).toEqual(expectedRecord)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(current()).toBe(previous)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains the cached snapshot when a late POST returns after the shared deadline', async () => {
    useHostTimers()
    const fetch = vi
      .spyOn(host, 'fetch')
      .mockImplementationOnce(async () => {
        await delay(3500)
        return { status: 200, body: entry }
      })
      .mockImplementationOnce(async () => {
        await delay(5000)
        return { status: 200, body: body.replace('BOB', 'NEW') }
      })
    const { dataFile, current } = createHistoryData(config, manifest)
    dataFile.onLoadRawData?.({
      schema: 1,
      body,
      url: downloadUrl,
      fetchedAt: '2026-09-29T12:00:00.000Z',
    })
    const previous = current()

    const rejected = expect(
      dataFile.rawToJSONData?.({ body: listing, url: DEFAULT_SOURCE, options: {} }),
    ).rejects.toThrow('N1MM download timed out. Previous data retained.')
    await vi.advanceTimersByTimeAsync(8000)
    await rejected

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(current()).toBe(previous)
    await vi.advanceTimersByTimeAsync(500)
    expect(current()).toBe(previous)
    expect(current()?.records.K1ABC).toEqual(expectedRecord)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('SST history with unsupported location fields', () => {
  it('refreshes and replays names and valid locations, while keeping the cache after a fatal parse failure', async () => {
    vi.spyOn(host, 'getSettings').mockResolvedValue({})
    const { dataFile, settings, current } = createHistoryData(sst, sstManifest)
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
    expect(
      await settings.getDefinition({ panelKey: sstManifest.key }, { online: false }),
    ).toMatchObject({
      elements: [
        { type: 'markdown', text: expect.stringContaining('Parser warnings: 2.') },
        {},
        {},
      ],
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
