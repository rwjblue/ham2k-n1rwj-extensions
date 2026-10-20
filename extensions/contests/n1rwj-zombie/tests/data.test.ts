import { host } from '@ham2k/extension-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SOURCE } from '../../../../packages/n1mm/src/source.ts'
import {
  checkedZombieSnapshot,
  createZombieData,
  createZombieFileCache,
  ZOMBIE_DEFAULT_SOURCE,
  zombieSource,
  zombieSourceUrl,
} from '../src/data.ts'
import { parseZombieHistory } from '../src/history.ts'

// Factual rows from ZOMBIE_004.txt, LastEdit 2025-10-18; downloaded from
// https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/ on 2026-10-19.
const published2025 = `!!Order!!,Call,Name,Exch1,MISC,
# LastEdit,2025-10-18
# Send new info/corr.  DIRECT  to WB9SBD
# ZOMBIE
AA2YO,SKULL,856,NJ,
AB8DF,SOG,248,MI,
AB8FJ,BUZZ,513,OH,
AB9CA,COBWEB,3333,IN,
AD4TJ,JASON,1603,VA,
AF3Z,GLUG,1446,PA,
AF4JF,MAX,636,MO,
K0EMT,BEAR,1299,IN,
K1RF,RAVEN,2034,CT,
K2TW,RENFIELD,2036,VA,
K4BAI,PHANTOM,986,GA,
K6AUS,PAZUZU,2064,MA,
K8NGW,ROTTY,1871,MI,
K8WTF,GORE,2027,OH,
K9GHO,FRED,1132,IL,
K9VIC,ORLO,2028,IL,
KA1BSZ,CLYDE,802,VT,
KB5FCF,MUNCHIE,830,OK,
KB8GAE,SPOOK,2033,OH,
KK0U,BLUCHER,2035,MO,
KQ2RP,POE,917,NJ,
KR2Q,PUS,1829,NJ,
KY4UH,POE,1896,GA,
N0MII,LURCH,3333,MO,
N2DA,GORT,1644,VA,
N2TNN,DRAQ,3333,VA,
N3AAZ,ZOO,2004,MD,
N3FB,FRANKENSTEIN,1471,PA,
N3VO,DOBBY,1660,MD,
N4IU,ITT,1825,FL,
N4MJ,FENRIR,2054,TN,
N5GW,PUTRID,601,MS,
N8IE,GUTS,667,OH,
N9BSO,DEADMANFRED,1400,MO,
NX1K,ZED,1447,MA,
VA2NB,SPIKE,922,QC,
VA3LMI,GUL,1855,ON,
VA3RKM,BOB,884,ON,
VE2FK,DUB,418,QC
VE3CBY,CRITTER,968,ON,
VE3DN,MURDOC,1396,ON,
VE3HQZ,MRSLANT,2059,ON,
VE3MGY,DRAC,3333,ON,
VE9QR,BOOS,1890,NB,
W0IIT,DUDLEY,1375,MO,
W0ITT,DUDLEY,1375,MO,
W1PID,JIM,792,NH,
W2BPL,DAZEN,2043,MA,
W2EB,BILE,284,NY,
W2QL,FESTER,703,VA,
W3ZOM,CHARLIE,1220,CA,
W4BHJ,TOMBSTONE,704,NC,
W4CMG,CAT,1457,TN,
W4EMB,ROT,1727,TN,
W4KAC,RAT,1438,NC,
W4SDM,VECNA,1279,VA,
W9ET,ET,2102,WI,
WA1GWH,GOMEZ,1444,NY,
WA2TDL,SPIRIT,716,NY,
WA5BDU,NICK,651,AR,
WB2JNA,JEFF,002,MD,
WB3GCK,BONES,1177,PA,
WB9HFK,IGOR,1370,IL,
WB9RCE,REDSKELETON,1852,IL,
WB9SBD,JOE,2101,WI,
WO9B,SCAR,1281,WI,
`
const body =
  '# ZOMBIE\n# LastEdit,2025-10-18\n!!Order!!,Call,Name,Exch1,MISC\nK1ABC,OLD NICK,002,MA\n'
const snapshot = {
  schema: 1 as const,
  body,
  url: 'https://n1mmwp.hamdocs.com/mmfile/get/file/ZOMBIE_004.txt',
  fetchedAt: '2026-10-19T12:00:00.000Z',
}
beforeEach(() => {
  vi.spyOn(host, 'kvGet').mockResolvedValue(null)
  vi.spyOn(host, 'kvSet').mockResolvedValue(undefined)
  vi.spyOn(host, 'getSettings').mockResolvedValue({})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Zombie N1MM data', () => {
  it('maps the published 66 entries and blanks only its four obsolete bonus assignments', () => {
    const file = parseZombieHistory(published2025)
    expect(file).toMatchObject({
      count: 66,
      warnings: 0,
      sourceYear: 2025,
      sourceUpdatedAt: '2025-10-18',
    })
    expect(
      Object.values(file.records)
        .filter((row) => !row.zombieNumber)
        .map((row) => row.call),
    ).toEqual(['AB9CA', 'N0MII', 'N2TNN', 'VE3MGY'])
    expect(file.records.AB9CA).toEqual({
      call: 'AB9CA',
      zombieName: 'COBWEB',
      zombieNumber: '',
      spc: 'IN',
    })
    expect(file.records.WB2JNA?.zombieNumber).toBe('002')
  })
  it('keeps multiword names and locations, merges nonblank duplicate fields, and clears a superseded bonus number', () => {
    const parsed = parseZombieHistory(`${body}K1ABC,,3333,\nK1ABC,DEAD FRED,,NEW ZEALAND\n`)
    expect(parsed.records.K1ABC).toEqual({
      call: 'K1ABC',
      zombieName: 'DEAD FRED',
      zombieNumber: '',
      spc: 'NEW ZEALAND',
    })
  })
  it('never identifies a new event year from an edit date, revision suffix or download date', () => {
    const loaded = checkedZombieSnapshot({
      ...snapshot,
      body: body.replace('2025-10-18', '2026-10-18'),
      url: snapshot.url.replace('_004', '_2026'),
    })
    expect(loaded.parsed.sourceYear).toBeUndefined()
    const unknown = parseZombieHistory(
      body.replace('2025-10-18', '2024-10-18').replace('002', '4321'),
    )
    expect(unknown.records.K1ABC?.zombieNumber).toBe('')
    expect(unknown.records.K1ABC?.zombieName).toBe('OLD NICK')
  })
  it('retains this event bonus and a later ordinary assignment of the old bonus when the event is explicit', () => {
    const parsed = parseZombieHistory(
      '# ZOMBIE 2026\n!!Order!!,Call,Name,Exch1,MISC\nK1ABC,NICK,4321,MA\nK2ABC,IGOR,3333,CT',
    )
    expect(parsed.sourceYear).toBe(2026)
    expect(parsed.records.K1ABC?.zombieNumber).toBe('4321')
    expect(parsed.records.K2ABC?.zombieNumber).toBe('3333')
  })
  it('rejects malformed and wrong-contest refreshes without treating ordinary callsign lookup names as an exchange', () => {
    for (const invalid of [
      '<html>Error</html>',
      'garbage',
      body.replace('# ZOMBIE', '# CWT'),
      `${body}INVALID,NICK,2,MA`,
    ])
      expect(() => parseZombieHistory(invalid)).toThrow()
  })
  it('discovers the latest available revision independently of the current year', () => {
    expect(
      zombieSource.latestEntry(
        '<a href="https://n1mmwp.hamdocs.com/mmfiles/zombie_005-txt/">new</a><a href="https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/">old</a>',
        DEFAULT_SOURCE,
      ),
    ).toBe('https://n1mmwp.hamdocs.com/mmfiles/zombie_005-txt/')
  })
  it('filters the default category before pagination can hide the older annual file', async () => {
    const unrelatedFirstPage =
      '<html><a href="https://n1mmwp.hamdocs.com/mmfiles/cwops_2026-txt/">CWops October 2026</a><a href="https://n1mmwp.hamdocs.com/mmfiles/k1usnsst_2026-txt/">SST October 2026</a></html>'
    expect(() => zombieSource.latestEntry(unrelatedFirstPage, DEFAULT_SOURCE)).toThrow(
      'No Zombie Shuffle entry found',
    )
    const data = createZombieData()
    if (typeof data.dataFile.url !== 'function') throw new Error('Expected configured source')
    expect(await data.dataFile.url({}, { online: true })).toBe(ZOMBIE_DEFAULT_SOURCE)
    expect(ZOMBIE_DEFAULT_SOURCE).toBe(`${DEFAULT_SOURCE}?CMDsearch=ZOMBIE&sort=newest&view=list`)
    const form = await data.settings.getDefinition({ panelKey: 'n1rwj-zombie' }, { online: false })
    expect(form.elements).toContainEqual(
      expect.objectContaining({ key: 'source', value: ZOMBIE_DEFAULT_SOURCE }),
    )
  })
  it('filters pasted category URLs while preserving explicit entry and text sources', () => {
    for (const category of [
      DEFAULT_SOURCE,
      'https://n1mmwp.hamdocs.com/mmfiles/categories/callhistory',
      `${DEFAULT_SOURCE}?sort=titleDesc&view=list`,
    ]) {
      expect(zombieSourceUrl(category)).toMatch(
        /\/categories\/callhistory\/\?CMDsearch=ZOMBIE&sort=newest&view=list$/,
      )
    }
    for (const direct of [snapshot.url, 'https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/'])
      expect(zombieSourceUrl(direct)).toBe(direct)
  })
  it('downloads through the common nonce adapter and replays the successful snapshot offline', async () => {
    const entryUrl = 'https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/'
    const form = `<html><form action="${snapshot.url}"><input name="cmdm_nonce" value="nonce"><input name="id" value="123"><input name="shortcodeId" value="download"></form></html>`
    const fetch = vi
      .spyOn(host, 'fetch')
      .mockResolvedValueOnce({ status: 200, body: form })
      .mockResolvedValueOnce({ status: 200, body })
    const data = createZombieData()
    const saved = await data.dataFile.rawToJSONData?.({
      body: `<html><a href="https://n1mmwp.hamdocs.com/mmfiles/cwops_2026-txt/">CWops October 2026</a><a href="${entryUrl}">Zombie October 2025</a></html>`,
      url: ZOMBIE_DEFAULT_SOURCE,
      options: {},
    })
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      entryUrl,
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      snapshot.url,
      expect.objectContaining({
        method: 'POST',
        body: 'cmdm_nonce=nonce&id=123&shortcodeId=download',
      }),
    )
    expect(data.cache.current()?.parsed.records.K1ABC).toEqual({
      call: 'K1ABC',
      spc: 'MA',
      zombieName: 'OLD NICK',
      zombieNumber: '002',
    })
    const offline = createZombieData()
    offline.dataFile.onLoadRawData?.(saved)
    expect(offline.cache.current()).toEqual(data.cache.current())
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('keeps its last successful file on malformed data and network failure', async () => {
    const data = createZombieData()
    data.dataFile.onLoadRawData?.(snapshot)
    const previous = data.cache.current()
    await expect(
      data.dataFile.rawToJSONData?.({ body: '<html>Error</html>', url: snapshot.url, options: {} }),
    ).rejects.toThrow()
    expect(data.cache.current()).toBe(previous)
    const fetch = vi.spyOn(host, 'fetch').mockRejectedValue(new Error('Offline'))
    const form = `<html><form action="${snapshot.url}"><input name="cmdm_nonce" value="nonce"><input name="id" value="123"><input name="shortcodeId" value="download"></form></html>`
    await expect(
      data.dataFile.rawToJSONData?.({ body: form, url: snapshot.url, options: {} }),
    ).rejects.toThrow('Offline')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(data.cache.current()).toBe(previous)
  })
  it('restores last-good runtime storage once and clears it on native removal', async () => {
    const read = vi.fn(async () => snapshot)
    const write = vi.fn(async () => undefined)
    const cache = createZombieFileCache({ read, write })
    await Promise.all([cache.load(), cache.load()])
    expect(read).toHaveBeenCalledTimes(1)
    expect(cache.current()?.parsed.count).toBe(1)
    await cache.remove()
    expect(cache.current()).toBeUndefined()
    expect(write).toHaveBeenCalledWith(null)
  })
  it('rejects failed storage writes and leaves the live file intact', async () => {
    const write = vi.fn(async () => {
      throw new Error('Storage failed')
    })
    const cache = createZombieFileCache({ read: async () => null, write })
    cache.accept(snapshot)
    const previous = cache.current()
    await expect(
      cache.replace({ ...snapshot, body: body.replace('OLD NICK', 'NEW') }),
    ).rejects.toThrow('Storage failed')
    expect(cache.current()).toBe(previous)
  })
  it('provides native manual refresh controls and validates sources without hiding offline data', async () => {
    vi.mocked(host.getSettings).mockResolvedValue({
      extensions: { 'extension_n1rwj-zombie': { source: '/tmp/history.txt' } },
    })
    const data = createZombieData()
    data.dataFile.onLoadRawData?.(snapshot)
    expect(await data.settings.getPanels?.({}, { online: false })).toEqual([
      expect.objectContaining({ key: 'n1rwj-zombie', dataFilesSection: true }),
    ])
    if (typeof data.dataFile.url !== 'function') throw new Error('Expected configured source')
    expect(await data.dataFile.url({}, { online: false })).toBe(ZOMBIE_DEFAULT_SOURCE)
    const form = await data.settings.getDefinition({ panelKey: 'n1rwj-zombie' }, { online: false })
    expect(JSON.stringify(form)).toContain('Source event year: 2025')
    expect(JSON.stringify(form)).toContain('Refresh in Data Files')
    const args = {
      panelKey: 'n1rwj-zombie',
      fieldKey: 'source',
      value: 'https://evil.example/file.txt',
      state: {},
    }
    await expect(data.settings.onChangeField(args, { online: false })).rejects.toThrow('HTTPS N1MM')
    const setSettings = vi.spyOn(host, 'setSettings').mockResolvedValue(undefined)
    await data.settings.onChangeField({ ...args, value: '  ' }, { online: false })
    expect(setSettings).toHaveBeenCalledWith({ source: '' })
  })
})
