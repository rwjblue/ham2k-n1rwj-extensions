import type { HookContext } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { ANNOUNCED_2026_BONUS_CALLS } from '../src/bonus.ts'
import { createZombieHistory } from '../src/history.ts'
import { createZombieLookup } from '../src/lookup.ts'
import type { Qson } from '../src/model.ts'

const operation: Qson = {
  uuid: 'zombie-op',
  createdAtMillis: 1,
  stationCall: 'N1RWJ',
  refs: [{ type: 'zombie', ref: '2026' }],
}
function setup() {
  const history = createZombieHistory()
  history.update({ operation, qsos: [] })
  const lookup = createZombieLookup(history)
  const ctx: HookContext = {
    online: false,
    getQsos: vi.fn(async () => []),
    getHistoryForCall: vi.fn(async (call: string) => [
      {
        uuid: `prior-${call}`,
        their: { call },
        refs: [
          {
            type: 'zombie',
            ref: '2025',
            theirZombieName: call === 'K1ABC' ? 'OLD NICK' : call === 'K2ABC' ? 'DEAD FRED' : '',
            theirZombieNumber: call === 'K1ABC' ? '0007' : call === 'K2ABC' ? '3333' : '',
            theirSpc: call === 'K1ABC' ? 'MA' : call === 'K2ABC' ? 'CT' : '',
          },
        ],
      },
    ]),
  }
  const query = (qso: Qson = { their: { call: 'K1ABC' } }, op: Qson = operation) =>
    lookup.lookupCall(
      {
        operation: op,
        qso,
        callInfo: { call: 'K1ABC', name: 'Ordinary Directory Name', state: 'NY' },
      },
      ctx,
    )
  return { history, lookup, ctx, query }
}

function notes(
  results: Awaited<ReturnType<ReturnType<typeof createZombieLookup>['lookupCall']>>,
): string {
  return JSON.stringify(results[0]?.notes ?? [])
}

describe('Zombie static identity lookup', () => {
  it('annotates all announced bonus stations on spots without requiring contact history', async () => {
    const { lookup, ctx } = setup()
    for (const call of ANNOUNCED_2026_BONUS_CALLS) {
      const results = await lookup.lookupCall({ operation, qso: {}, callInfo: { call } }, ctx)
      expect(results[0]).toMatchObject({
        call,
        scope: 'operation',
        note: '⚡ 2026 bonus station',
        emoji: '⚡',
      })
      expect(notes(results)).toContain('**Announced 2026 bonus station**')
      expect(notes(results)).toContain('Expected number **4321**')
      expect(notes(results)).toContain('NA5N’s October 29 QRP-L announcement')
      expect(notes(results)).toContain('confirm the full exchange on air')
      expect(results[0]).not.toHaveProperty('online')
      expect(results[0]).not.toHaveProperty('exchange')
      expect(results[0]).not.toHaveProperty('name')
      expect(results[0]).not.toHaveProperty('state')
    }
    expect(ctx.getQsos).not.toHaveBeenCalled()
  })

  it('keeps the announced assignment separate from copied corrections, clearing and history hints', async () => {
    const { lookup, history, ctx } = setup()
    vi.spyOn(history, 'suggestions').mockResolvedValue({
      zombieNumber: '0007',
      zombieName: 'OLD GHOST',
      spc: 'NM',
    })
    const qso: Qson = {
      their: { call: 'NA5N' },
      refs: [{ type: 'zombie', theirZombieNumber: '002', theirZombieName: '', theirSpc: '' }],
    }
    const original = JSON.stringify(qso)
    const results = await lookup.lookupCall({ operation, qso, callInfo: { call: 'NA5N' } }, ctx)
    expect(notes(results)).toContain('**Announced 2026 bonus station**')
    expect(notes(results)).toContain('**Current exchange** · #002')
    expect(notes(results)).not.toContain('History hints')
    expect(notes(results)).not.toContain('OLD GHOST')
    expect(JSON.stringify(qso)).toBe(original)
  })

  it('uses the live callsign and selected event for announcements, including when history fails', async () => {
    const { lookup, history, ctx } = setup()
    vi.spyOn(history, 'suggestions').mockRejectedValue(new Error('History unavailable'))
    const query = (qso: Qson, op: Qson = operation) =>
      lookup.lookupCall({ operation: op, qso, callInfo: { call: 'NA5N' } }, ctx)
    expect(notes(await query({ their: { call: 'na5n/qrp' } }))).toContain(
      '**Announced 2026 bonus station**',
    )
    expect(notes(await query({ their: { call: 'K1ABC' } }))).not.toContain('bonus station')
    expect(await query({ their: { call: '' } })).toEqual([])
    expect(await query({ their: { call: null } })).toEqual([])
    for (const year of ['2025', '2027'])
      expect(await query({}, { refs: [{ type: 'zombie', ref: year }] })).toEqual([])
  })

  it('does not mark an unknown spot as a Zombie participant', async () => {
    const { lookup, ctx } = setup()
    expect(
      await lookup.lookupCall({ operation, qso: {}, callInfo: { call: 'K9XYZ' } }, ctx),
    ).toEqual([])
    expect(
      (
        await lookup.lookupCall(
          { operation, qso: { their: { call: 'K9XYZ' } }, callInfo: { call: 'K9XYZ' } },
          ctx,
        )
      )[0],
    ).toMatchObject({ note: '👻 Zombie Shuffle exchange' })
  })
  it('adds separate history hints without modifying ordinary identity or needing a full log read', async () => {
    const { query, ctx } = setup()
    for (let count = 0; count < 3; count++) {
      const results = await query()
      expect(results[0]).toMatchObject({
        call: 'K1ABC',
        scope: 'operation',
        source: 'n1rwj-zombie',
      })
      expect(results[0]).not.toHaveProperty('name')
      expect(results[0]).not.toHaveProperty('state')
      expect(results[0]).not.toHaveProperty('online')
      expect(notes(results)).toContain('History hints — confirm on air')
      expect(notes(results)).toContain('**OLD NICK** · #0007 · MA')
      expect(notes(results)).not.toContain('Ordinary Directory Name')
      expect(notes(results)).not.toContain('rebirth ready')
      expect(notes(results)).not.toContain('resting')
      expect(notes(results)).not.toContain('eligible at')
    }
    expect(ctx.getQsos).not.toHaveBeenCalled()
    expect(ctx.getHistoryForCall).toHaveBeenCalledWith('K1ABC', { refType: 'zombie' })
  })

  it('honors the corrected or cleared QSO callsign ahead of stale callInfo', async () => {
    const { query, ctx } = setup()
    const corrected = await query({ their: { call: 'K2ABC' } })
    expect(corrected[0]?.call).toBe('K2ABC')
    expect(notes(corrected)).toContain('DEAD FRED')
    expect(notes(corrected)).not.toContain('OLD NICK')
    expect(notes(corrected)).not.toContain('3333')
    expect(await query({ their: { call: '' } })).toEqual([])
    expect(await query({ their: { call: null } })).toEqual([])
    expect(ctx.getHistoryForCall).toHaveBeenCalledTimes(1)
    expect((await query({}))[0]?.call).toBe('K1ABC')
  })

  it('shows current exchange fields separately and suppresses corresponding hints including deliberate blanks', async () => {
    const { query } = setup()
    const current = await query({
      their: { call: 'K1ABC', name: 'Normal Name' },
      refs: [{ type: 'zombie', theirZombieName: 'Real Ghost', theirZombieNumber: '0002' }],
    })
    expect(notes(current)).toContain('**Current exchange** · **Real Ghost** · #0002')
    expect(notes(current)).toContain('History hints — confirm on air** · MA')
    expect(notes(current)).not.toContain('OLD NICK')
    expect(notes(current)).not.toContain('0007')
    expect(notes(current)).not.toContain('Normal Name')
    const cleared = await query({
      their: { call: 'K1ABC' },
      refs: [{ type: 'zombie', theirSpc: '', theirZombieNumber: '', theirZombieName: '' }],
    })
    expect(notes(cleared)).not.toContain('OLD NICK')
    expect(notes(cleared)).not.toContain('0007')
    expect(notes(cleared)).not.toContain('History hints')
    expect(notes(cleared)).toContain('New visitors are welcome')
  })

  it('escapes copied text before displaying Markdown and never creates HTML or links', async () => {
    const { query } = setup()
    const results = await query({
      their: { call: 'K1ABC' },
      refs: [
        {
          type: 'zombie',
          theirZombieName: '[Ghost](https://evil.test)<b>',
          theirZombieNumber: '0007',
          theirSpc: '**DX**',
        },
      ],
    })
    const rawNotes = results[0]?.notes
    const markdown = Array.isArray(rawNotes) ? rawNotes.join('\n') : ''
    expect(markdown).toContain('\\[Ghost\\]\\(https://evil\\.test\\)&lt;b&gt;')
    expect(markdown).toContain('\\*\\*DX\\*\\*')
    expect(markdown).not.toContain('<b>')
    expect(markdown).not.toContain('[Ghost](https://evil.test)')
  })

  it('annotates unknown calls without inventing a number, name, participant status or current bonus assignment', async () => {
    const { query } = setup()
    const results = await query({ their: { call: 'K3ABC' } })
    expect(results[0]?.call).toBe('K3ABC')
    expect(notes(results)).toContain('Copy the SPC, Zombie number and spooky name on air')
    expect(notes(results)).not.toContain('#')
    expect(notes(results)).not.toContain('History hints')
    expect(notes(results)).not.toContain('bonus exchange')
  })

  it('guards the confirmed event profile without using a wall-clock event gate', async () => {
    const { query } = setup()
    expect(await query({}, {})).toEqual([])
    expect(await query({}, { refs: [{ type: 'zombie', ref: '2025' }] })).toEqual([])
    expect(await query({}, { refs: [{ type: 'zombie', ref: '2027' }] })).toEqual([])
    expect(
      (await query({ their: { call: 'K1ABC' }, startAtMillis: Date.UTC(2020, 0, 1) }))[0]?.call,
    ).toBe('K1ABC')
  })

  it('keeps copied fields when optional history is unavailable', async () => {
    const { lookup, history, ctx } = setup()
    vi.spyOn(history, 'suggestions').mockRejectedValue(new Error('History unavailable'))
    const results = await lookup.lookupCall(
      {
        operation,
        callInfo: { call: 'K1ABC' },
        qso: {
          their: { call: 'K1ABC' },
          refs: [
            {
              type: 'zombie',
              theirZombieName: 'Copied Ghost',
              theirZombieNumber: '002',
              theirSpc: 'MA',
            },
          ],
        },
      },
      ctx,
    )
    expect(notes(results)).toContain('**Copied Ghost** · #002 · MA')
    expect(notes(results)).not.toContain('History hints')
  })
})
