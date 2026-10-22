import { host } from '@ham2k/extension-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkedSnapshot, createData, createRosterCache, type RosterSnapshot } from '../src/data.ts'
import { ROSTER_URL } from '../src/roster.ts'

const body =
  'SKCCNR|CALL|NAME|SPC|OLDCALL|DXCODE|JOINDATE|CENTDATE|TRIBDATE|TX8DATE|SENDATE|MBRSTATUS\n1C|K1ABC|Alice|MA||291|02 Jan 2006|15 Jan 2007||||A'
const snapshot: RosterSnapshot = { schema: 1, body, source: ROSTER_URL, downloadedAt: 100 }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(host, 'kvGet').mockResolvedValue(null)
  vi.spyOn(host, 'kvSet').mockResolvedValue(undefined)
})

describe('SKCC offline roster persistence', () => {
  it('validates snapshot provenance, version, timestamps and dataset before accepting it', () => {
    expect(checkedSnapshot(snapshot).roster.members[0].name).toBe('Alice')
    for (const invalid of [
      null,
      {},
      { ...snapshot, schema: 2 },
      { ...snapshot, source: 'https://example.com/roster' },
      { ...snapshot, downloadedAt: NaN },
      { ...snapshot, downloadedAt: 8640000000000001 },
      { ...snapshot, downloadedAt: 0.5 },
      { ...snapshot, body: '<html>Error</html>' },
    ])
      expect(() => checkedSnapshot(invalid)).toThrow()
  })
  it('restores once, reports changed content, and removes the saved data through native controls', async () => {
    const read = vi.fn(async () => snapshot)
    const write = vi.fn(async () => undefined)
    const changed = vi.fn()
    const cache = createRosterCache({ read, write }, changed)
    await Promise.all([cache.load(), cache.load()])
    expect(read).toHaveBeenCalledTimes(1)
    expect(cache.getRoster()?.members[0].name).toBe('Alice')
    expect(changed).toHaveBeenCalledTimes(1)
    await cache.replace({ ...snapshot, downloadedAt: 200 })
    expect(changed).toHaveBeenCalledTimes(1)
    await cache.replace({ ...snapshot, body: body.replace('Alice', 'Alicia'), downloadedAt: 300 })
    expect(changed).toHaveBeenCalledTimes(2)
    await cache.remove()
    expect(write).toHaveBeenLastCalledWith(null)
    expect(cache.getRoster()).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(3)
  })
  it('retains the last good roster for invalid native replay, partial refresh, and storage failure', async () => {
    const write = vi.fn(async () => undefined)
    const cache = createRosterCache({ read: async () => null, write })
    const large = { ...snapshot, body: `${body}\n2|K2ABC|Bob|NY||291|02 Jan 2006|||||A` }
    cache.accept(large)
    const good = cache.getRoster()
    cache.accept({ ...snapshot, body: 'error', downloadedAt: 200 })
    expect(cache.getRoster()).toBe(good)
    await expect(cache.replace({ ...snapshot, downloadedAt: 200 })).rejects.toThrow(
      'lost more than 10%',
    )
    expect(cache.getRoster()).toBe(good)
    write.mockRejectedValueOnce(new Error('Storage unavailable'))
    await expect(cache.replace({ ...large, downloadedAt: 200 })).rejects.toThrow(
      'Storage unavailable',
    )
    expect(cache.getRoster()).toBe(good)
  })
  it('prevents an outstanding startup read or older native replay from overwriting newer data', async () => {
    let restore!: (value: unknown) => void
    const cache = createRosterCache({
      read: () =>
        new Promise((resolve) => {
          restore = resolve
        }),
      write: async () => undefined,
    })
    const loading = cache.load()
    cache.accept({ ...snapshot, body: body.replace('Alice', 'Alicia'), downloadedAt: 200 })
    restore(snapshot)
    await loading
    cache.accept(snapshot)
    expect(cache.getRoster()?.members[0].name).toBe('Alicia')
  })
  it('serializes remove/replace and does not resurrect data from an outstanding startup read', async () => {
    let restore!: (value: unknown) => void
    const cache = createRosterCache({
      read: () =>
        new Promise((resolve) => {
          restore = resolve
        }),
      write: async () => undefined,
    })
    const loading = cache.load()
    await cache.remove()
    restore(snapshot)
    await loading
    expect(cache.getRoster()).toBeUndefined()
    await Promise.all([cache.replace(snapshot), cache.remove()])
    expect(cache.getRoster()).toBeUndefined()
  })
  it('keeps optional invalidation failures separate from successful data persistence', async () => {
    const cache = createRosterCache(
      { read: async () => null, write: async () => undefined },
      () => {
        throw new Error('Unavailable')
      },
    )
    await cache.replace(snapshot)
    expect(cache.getRoster()?.members).toHaveLength(1)
    expect(cache.error()).toBeUndefined()
  })
  it('uses one native data file with automatic daily refresh and no auxiliary network or settings requests', async () => {
    const fetch = vi.spyOn(host, 'fetch')
    const settings = vi.spyOn(host, 'getSettings')
    const data = createData()
    await data.load()
    expect(data.dataFile).toMatchObject({
      key: 'n1rwj-skcc_members',
      category: 'n1rwj-skcc',
      url: ROSTER_URL,
      fetchType: 'raw',
      maxAgeInDays: 1,
    })
    const saved = await data.dataFile.rawToJSONData?.({ body, url: ROSTER_URL, options: {} })
    expect(data.getRoster()?.members[0].name).toBe('Alice')
    const offline = createData()
    offline.dataFile.onLoadRawData?.(saved)
    await offline.load()
    expect(offline.getRoster()).toEqual(data.getRoster())
    await expect(
      data.dataFile.rawToJSONData?.({ body: '<html>Offline</html>', url: ROSTER_URL, options: {} }),
    ).rejects.toThrow()
    expect(data.getRoster()?.members[0].name).toBe('Alice')
    await data.dataFile.onRemoveRawData?.()
    expect(data.getRoster()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
    expect(settings).not.toHaveBeenCalled()
  })
})
