import { describe, expect, it } from 'vitest'
import { checkedSnapshot, createFileCache, type Snapshot } from '../../src/data/cache.ts'

const body = '!!Order!!,Call,Name,Exch1\n# CWOPS\nK1ABC,Pat,123'
const snapshot: Snapshot = {
  schema: 1,
  body,
  url: 'n1mm-history:CWOPS',
  fetchedAt: '2026-10-29T12:00:00Z',
}

describe('native CWT file snapshots', () => {
  it('returns JSON for native persistence and restores it without auxiliary storage', async () => {
    const cache = createFileCache()
    const saved = await cache.replace(snapshot)
    const offline = createFileCache()
    offline.accept(JSON.parse(JSON.stringify(saved)))
    expect(offline.current()).toEqual(cache.current())
    expect(offline.current()?.parsed.records.K1ABC?.number).toBe('123')
    await offline.remove()
    expect(offline.current()).toBeUndefined()
  })
  it.each([
    null,
    {},
    { ...snapshot, schema: 2 },
    { ...snapshot, fetchedAt: 'invalid' },
    { ...snapshot, body: '<html>Access denied</html>' },
    { ...snapshot, body: '# CWOPS' },
    { ...snapshot, body: '!!Unsupported!!\nK1ABC,Pat' },
    { ...snapshot, body: '# NAQPCW\nK1ABC,Pat' },
    { ...snapshot, body: `${body}\nTHIS IS CORRUPT\nK2XYZ,"unfinished` },
    { ...snapshot, body: 'x'.repeat(5_000_001) },
  ])('rejects malformed data and preserves the last good runtime index', async (invalid) => {
    const cache = createFileCache()
    await cache.replace(snapshot)
    const previous = cache.current()
    expect(() => checkedSnapshot(invalid)).toThrow()
    cache.accept(invalid)
    expect(cache.current()).toBe(previous)
    await expect(cache.replace(invalid as Snapshot)).rejects.toThrow()
    expect(cache.current()).toBe(previous)
    expect(cache.error()).toBeDefined()
    await cache.replace(snapshot)
    expect(cache.error()).toBeUndefined()
  })
  it('retains the newest snapshot by actual time on refresh and native replay', async () => {
    const cache = createFileCache()
    await cache.replace(snapshot)
    const older = {
      ...snapshot,
      body: body.replace('123', '456'),
      fetchedAt: '2026-10-29T13:00:00+02:00',
    }
    cache.accept(older)
    expect(await cache.replace(older)).toEqual(snapshot)
    expect(cache.current()?.parsed.records.K1ABC?.number).toBe('123')
  })
  it('owns a copy of input snapshots and applies removal in invocation order', async () => {
    const cache = createFileCache()
    const input = { ...snapshot }
    const pending = cache.replace(input)
    input.body = 'damaged'
    await pending
    expect(cache.current()?.snapshot.body).toBe(body)
    await Promise.all([cache.replace(snapshot), cache.remove()])
    expect(cache.current()).toBeUndefined()
  })
})
