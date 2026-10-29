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
  it('notifies on changed content and removal while keeping the last good roster', async () => {
    const changed = vi.fn()
    const cache = createRosterCache(changed)
    cache.accept(snapshot)
    expect(changed).toHaveBeenCalledTimes(1)
    await cache.replace({ ...snapshot, downloadedAt: 200 })
    expect(changed).toHaveBeenCalledTimes(1)
    const newer = { ...snapshot, body: body.replace('Alice', 'Alicia'), downloadedAt: 300 }
    await cache.replace(newer)
    cache.accept(snapshot)
    expect(await cache.replace(snapshot)).toEqual(newer)
    expect(cache.getRoster()?.members[0].name).toBe('Alicia')
    expect(changed).toHaveBeenCalledTimes(2)
    cache.accept({ ...newer, body: 'error' })
    expect(cache.getRoster()?.members[0].name).toBe('Alicia')
    await cache.remove()
    expect(cache.getRoster()).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(3)
  })
  it('rejects partial refreshes and preserves the previous index', async () => {
    const cache = createRosterCache()
    const large = { ...snapshot, body: `${body}\n2|K2ABC|Bob|NY||291|02 Jan 2006|||||A` }
    cache.accept(large)
    const good = cache.getRoster()
    await expect(cache.replace({ ...snapshot, downloadedAt: 200 })).rejects.toThrow(
      'lost more than 10%',
    )
    expect(cache.getRoster()).toBe(good)
  })
  it('keeps optional invalidation failures separate from valid native snapshots', async () => {
    const cache = createRosterCache(() => {
      throw new Error('Unavailable')
    })
    await cache.replace(snapshot)
    expect(cache.getRoster()?.members).toHaveLength(1)
    expect(cache.error()).toBeUndefined()
  })
  it('uses one native data file with automatic daily refresh and no auxiliary network or settings requests', async () => {
    const fetch = vi.spyOn(host, 'fetch')
    const settings = vi.spyOn(host, 'getSettings')
    const data = createData()
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
    expect(offline.getRoster()).toEqual(data.getRoster())
    await expect(
      data.dataFile.rawToJSONData?.({ body: '<html>Offline</html>', url: ROSTER_URL, options: {} }),
    ).rejects.toThrow()
    expect(data.getRoster()?.members[0].name).toBe('Alice')
    await data.dataFile.onRemoveRawData?.()
    expect(data.getRoster()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
    expect(settings).not.toHaveBeenCalled()
    expect(host.kvGet).not.toHaveBeenCalled()
    expect(host.kvSet).not.toHaveBeenCalled()
  })
})
