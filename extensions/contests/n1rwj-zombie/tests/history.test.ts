import type { JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { checkedZombieSnapshot } from '../src/data.ts'
import { createZombieHistory, historicalNumber, zombieHistoryContact } from '../src/history.ts'

type Qson = Record<string, JSONValue>
const operation: Qson = {
  uuid: 'op',
  stationCall: 'N1RWJ',
  createdAtMillis: 1,
  refs: [{ type: 'zombie', ref: '2026' }],
}
const qso: Qson = { their: { call: 'K1ABC' } }
const contact = (
  uuid: string,
  name: string,
  number: string,
  spc: string,
  year = 2026,
  time = 1,
): Qson => ({
  uuid,
  their: { call: 'K1ABC' },
  startAtMillis: time,
  refs: [
    {
      type: 'zombie',
      ref: String(year),
      theirSpc: spc,
      theirZombieName: name,
      theirZombieNumber: number,
    },
  ],
})
const file = checkedZombieSnapshot({
  schema: 1,
  body: '# ZOMBIE\n# LastEdit,2025-10-18\n!!Order!!,Call,Name,Exch1,MISC\nK1ABC,FILE,002,MA',
  url: 'https://n1mmwp.hamdocs.com/zombie.txt',
  fetchedAt: '2026-10-19T12:00:00Z',
})

describe('Zombie exchange history', () => {
  it.each([
    ['3333', 2025, 2026, ''],
    ['03333', 2025, 2026, ''],
    ['4321', 2026, 2026, '4321'],
    ['4321', 2026, 2027, ''],
    ['3333', 2026, 2027, '3333'],
    ['4321', 2025, 2026, '4321'],
    ['3333', undefined, 2026, ''],
    ['4321', undefined, 2026, ''],
    ['002', undefined, 2026, '002'],
    ['000', undefined, 2026, ''],
    ['1234567', undefined, 2026, '1234567'],
    ['9007199254740992', undefined, 2026, ''],
  ])(
    'filters %s only with its source-year bonus semantics',
    (number, sourceYear, eventYear, expected) => {
      expect(historicalNumber(number, sourceYear, eventYear)).toBe(expected)
    },
  )
  it('uses only native Zombie exchange fields and excludes unrelated, deleted and event rows', () => {
    expect(
      zombieHistoryContact({
        ...contact('old', '', '', ''),
        their: { call: 'K1ABC', name: 'Ordinary name' },
      }),
    ).toMatchObject({ zombieName: '', zombieNumber: '', spc: '' })
    const excluded: Qson[] = [
      { ...contact('deleted', 'IGOR', '1', 'CT'), deleted: true },
      { ...contact('event', 'IGOR', '1', 'CT'), band: 'event' },
      { their: { call: 'K1ABC' }, refs: [{ type: 'cwt', name: 'NORMAL', number: '4321' }] },
    ]
    for (const row of excluded) expect(zombieHistoryContact(row)).toBeUndefined()
  })
  it('prefers the captured event year over a subsequently edited operation reference', () => {
    const captured = {
      ...contact('saved', 'IGOR', '3333', 'CT', 2026),
      our: { zombie: { ref: '2025' } },
    }
    expect(zombieHistoryContact(captured)?.eventYear).toBe(2025)
  })
  it('uses current-operation corrections then same-event copied fields then downloaded fields then older history', async () => {
    const history = createZombieHistory()
    const current = contact('current', 'CURRENT', '', '', 2026, 3)
    const sameYear = contact('same-year', 'SAME YEAR', '4321', '', 2026, 2)
    const old = contact('old', 'OLD', '666', 'CT', 2024)
    history.update({ operation, qsos: [current] })
    const getQsos = vi.fn(async () => {
      throw new Error('Must not read full log')
    })
    const ctx = {
      online: false,
      getQsos,
      getHistoryForCall: vi.fn(async () => [old, sameYear, current]),
    }
    expect(await history.suggestions(operation, qso, ctx, file)).toEqual({
      zombieName: 'CURRENT',
      zombieNumber: '4321',
      spc: 'MA',
    })
    expect(getQsos).not.toHaveBeenCalled()
    expect(ctx.getHistoryForCall).toHaveBeenCalledWith('K1ABC', { refType: 'zombie' })
  })
  it('does not filter current-operation copied bonus-looking numbers', async () => {
    const history = createZombieHistory()
    const copied = contact('current', 'IGOR', '3333', 'CT')
    history.update({ operation, qsos: [copied] })
    expect(await history.suggestions(operation, qso, { online: false }, file)).toEqual({
      zombieName: 'IGOR',
      zombieNumber: '3333',
      spc: 'CT',
    })
  })
  it('omits only the stale number from an older bonus contact', async () => {
    const history = createZombieHistory()
    history.update({ operation, qsos: [] })
    const ctx = {
      online: false,
      getHistoryForCall: async () => [contact('old', 'COBWEB', '3333', 'IN', 2025)],
    }
    expect(await history.suggestions(operation, qso, ctx)).toEqual({
      zombieName: 'COBWEB',
      spc: 'IN',
    })
  })
  it('does not use another band-independent identity as a portable SPC', async () => {
    const history = createZombieHistory()
    history.update({ operation, qsos: [] })
    expect(
      await history.suggestions(operation, { their: { call: 'K1ABC/P' } }, { online: false }, file),
    ).toEqual({ zombieName: 'FILE', zombieNumber: '002' })
  })
  it('uses the latest contact within each source and excludes the edited QSO', async () => {
    const history = createZombieHistory()
    const rows = [
      contact('old', 'OLD', '1', 'CT', 2026, 1),
      contact('new', 'NEW', '002', 'MA', 2026, 2),
      contact('editing', 'EDITING', '3', 'VT', 2026, 3),
    ]
    history.update({ operation, qsos: rows })
    expect(
      await history.suggestions(operation, { ...qso, uuid: 'editing' }, { online: false }),
    ).toEqual({ zombieName: 'NEW', zombieNumber: '002', spc: 'MA' })
  })
  it('shares one operation read after resumed scoring and keeps failed history optional', async () => {
    const history = createZombieHistory()
    const current = contact('current', 'CORRECTED', '002', 'VT')
    history.update({ operation, qsos: [] })
    history.update({ operation, qsos: [], resumeFrom: {} })
    const getQsos = vi.fn(async () => [current])
    const ctx = { online: false, getQsos, getHistoryForCall: async () => [current] }
    for (let i = 0; i < 3; i++)
      expect(await history.suggestions(operation, qso, ctx, file)).toEqual({
        zombieName: 'CORRECTED',
        zombieNumber: '002',
        spc: 'VT',
      })
    expect(getQsos).toHaveBeenCalledTimes(1)
    const offline = createZombieHistory()
    expect(
      await offline.suggestions(
        operation,
        qso,
        {
          online: false,
          getHistoryForCall: async () => {
            throw new Error('Unavailable')
          },
        },
        file,
      ),
    ).toEqual({ zombieName: 'FILE', zombieNumber: '002', spc: 'MA' })
  })
  it('does not reclassify a deleted current-operation contact as older history', async () => {
    const history = createZombieHistory()
    history.update({ operation, qsos: [contact('gone', 'DELETED', '1', 'CT')] })
    const getQsos = vi.fn(async () => [])
    expect(
      await history.suggestions(
        operation,
        qso,
        { online: false, getQsos, getHistoryForCall: async () => [] },
        file,
      ),
    ).toEqual({ zombieName: 'FILE', zombieNumber: '002', spc: 'MA' })
    expect(getQsos).toHaveBeenCalledTimes(1)
  })
  it('returns no suggestions outside the activity or without a callsign', async () => {
    const history = createZombieHistory()
    expect(await history.suggestions({}, qso, { online: false }, file)).toEqual({})
    expect(await history.suggestions(operation, {}, { online: false }, file)).toEqual({})
  })
})
