import { describe, expect, it, vi } from 'vitest'
import manifest from '../manifest.json'
import { createActivity } from '../src/activity.ts'
import { object, type Qson } from '../src/model.ts'
import { zombieSpcSuggestion } from '../src/spc.ts'

const operation: Qson = { uuid: 'zombie-operation', refs: [{ type: 'zombie', ref: '2026' }] }
const context = { online: false }

describe('Zombie SPC lookup suggestions', () => {
  it.each([
    [{ call: 'K1ABC', guess: { country: 'United States', state: ' nc ' } }, 'NC'],
    [{ call: 'K1ABC', guess: { entityPrefix: 'K', state: 'WA' } }, 'WA'],
    [{ call: 'VE3ABC', guess: { country: 'Canada', state: 'Ontario' } }, 'ONTARIO'],
    [{ call: 'VE2ABC', guess: { country: 'CA', state: 'QC' } }, 'QC'],
    [{ call: 'KL7ABC', guess: { country: 'United States', state: 'AK' } }, 'AK'],
    [{ call: 'KH6ABC', guess: { country: 'U.S.A.', state: 'HI' } }, 'HI'],
    [{ call: 'ZL1ABC', guess: { country: 'New Zealand', state: 'Auckland' } }, 'NEW ZEALAND'],
    [{ call: 'DL1ABC', guess: { country: 'Germany', state: 'Bavaria' } }, 'GERMANY'],
  ] satisfies [Qson, string][])(
    'suggests the actual exchange location from %j',
    (their, expected) => {
      expect(zombieSpcSuggestion(their)).toBe(expected)
    },
  )

  it('uses the host country file offline for DX but never guesses a US state or Canadian province from a call district', () => {
    expect(zombieSpcSuggestion({ call: 'ZL1ABC' })).toBe('NEW ZEALAND')
    expect(zombieSpcSuggestion({ call: 'K1ABC' })).toBe('')
    expect(zombieSpcSuggestion({ call: 'VE3ABC' })).toBe('')
    expect(zombieSpcSuggestion({ call: '' })).toBe('')
    expect(zombieSpcSuggestion({ call: 'K1ABC K2ABC' })).toBe('')
    expect(zombieSpcSuggestion({ call: '?' })).toBe('')
  })

  it('preserves explicit general-location corrections and clearing ahead of directory suggestions', () => {
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC',
        state: 'CT',
        guess: { state: 'MA', country: 'United States' },
      }),
    ).toBe('CT')
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC',
        state: '',
        guess: { state: 'MA', country: 'United States' },
      }),
    ).toBe('')
    expect(
      zombieSpcSuggestion({ call: 'DL1ABC', country: '', guess: { country: 'Germany' } }),
    ).toBe('')
    expect(
      zombieSpcSuggestion({
        call: 'DL1ABC',
        country: 'New Zealand',
        guess: { country: 'Germany' },
      }),
    ).toBe('NEW ZEALAND')
  })

  it('rejects stale directory answers and avoids a portable station’s home-QTH state', () => {
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC',
        guess: { call: 'K2ABC', country: 'United States', state: 'CT' },
      }),
    ).toBe('')
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC/P',
        guess: { country: 'United States', state: 'CT', locationScope: 'qth' },
      }),
    ).toBe('')
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC/P',
        guess: { country: 'United States', state: 'VT', locationScope: 'portable' },
      }),
    ).toBe('VT')
    expect(
      zombieSpcSuggestion({
        call: 'F/K1ABC',
        guess: { country: 'United States', state: 'CT', locationScope: 'qth' },
      }),
    ).toBe('FRANCE')
    expect(
      zombieSpcSuggestion({
        call: 'K1ABC/P',
        state: 'NH',
        guess: { country: 'United States', state: 'CT', locationScope: 'qth' },
      }),
    ).toBe('NH')
  })

  it('ignores malformed location values without mutating the received lookup', () => {
    const their: Qson = { call: 'K1ABC', guess: { country: 'United States', state: '123' } }
    const before = JSON.stringify(their)
    expect(zombieSpcSuggestion(their)).toBe('')
    expect(zombieSpcSuggestion({ call: 'DL1ABC', country: 'X'.repeat(81) })).toBe('')
    expect(JSON.stringify(their)).toBe(before)
  })
})

describe('Zombie native SPC prefill', () => {
  it('offers an SPC value after a lookup resolves while leaving event number and spooky name unsuggested', async () => {
    const { activity, history } = createActivity(manifest)
    history.update({ operation, qsos: [] })
    const before = await activity.loggingControls(
      { operation, qso: { their: { call: 'K1ABC' } } },
      context,
    )
    expect(before[0]?.input).toMatchObject({ field: 'theirSpc', suggestedValue: ' ' })
    const lookup = {
      their: {
        call: 'K1ABC',
        name: 'Ordinary Name',
        guess: { name: 'Directory Name', state: 'NC', country: 'United States', number: '4321' },
      },
    }
    const original = JSON.stringify(lookup)
    const after = await activity.loggingControls({ operation, qso: lookup }, context)
    expect(after.map((control) => control.input)).toMatchObject([
      { field: 'theirSpc', suggestedValue: 'NC' },
      { field: 'theirZombieNumber', suggestedValue: ' ' },
      { field: 'theirZombieName', suggestedValue: ' ' },
    ])
    expect(JSON.stringify(lookup)).toBe(original)
  })

  it('keeps a copied Zombie history location ahead of general lookup data', async () => {
    const { activity, history } = createActivity(manifest)
    history.update({
      operation,
      qsos: [
        {
          uuid: 'copied-zombie',
          their: { call: 'K1ABC' },
          refs: [
            { type: 'zombie', theirSpc: 'CT', theirZombieNumber: '002', theirZombieName: 'IGOR' },
          ],
        },
      ],
    })
    const controls = await activity.loggingControls(
      {
        operation,
        qso: { their: { call: 'K1ABC', guess: { state: 'MA', country: 'United States' } } },
      },
      context,
    )
    expect(controls[0]?.input).toMatchObject({ suggestedValue: 'CT' })
    expect(controls[1]?.input).toMatchObject({ suggestedValue: '002' })
    expect(controls[2]?.input).toMatchObject({ suggestedValue: 'IGOR' })
  })

  it('uses only the native suggestedValue path, preserving copied SPC edits and explicit clearing on later lookups', async () => {
    const { activity, history } = createActivity(manifest)
    history.update({ operation, qsos: [] })
    for (const copied of ['TRANSYLVANIA', '']) {
      const qso: Qson = {
        their: { call: 'K1ABC', guess: { state: 'MA', country: 'United States' } },
        refs: [
          {
            type: 'zombie',
            theirSpc: copied,
            theirZombieNumber: '0002',
            theirZombieName: 'OLD NICK',
          },
        ],
      }
      const before = JSON.stringify(qso)
      const controls = await activity.loggingControls({ operation, qso }, context)
      expect(controls[0]?.input).toMatchObject({
        kind: 'text',
        field: 'theirSpc',
        suggestedValue: 'MA',
      })
      // Host ExchangeFieldsModel.applySuggestedValues checks _touched and a
      // held restored value before applying this suggestion. The extension
      // must not bypass that protection by patching the received ref at save.
      const patch = await activity.processQsoBeforeSave({ operation, qso }, context)
      expect(patch).not.toHaveProperty('refs')
      expect(object(patch?.their).exchange).toBe(
        [copied, '0002', 'OLD NICK'].filter(Boolean).join(' '),
      )
      expect(JSON.stringify(qso)).toBe(before)
    }
  })

  it('clears an untouched old suggestion when the next callsign has no usable location, without new network or full-log reads', async () => {
    const { activity, history } = createActivity(manifest)
    history.update({ operation, qsos: [] })
    const getQsos = vi.fn(async () => {
      throw new Error('No full-log lookup')
    })
    const stations: Qson[] = [
      { call: 'K1ABC', guess: { state: 'NC', country: 'United States' } },
      { call: 'K2ABC' },
      { call: '' },
    ]
    for (const their of stations) {
      const controls = await activity.loggingControls(
        { operation, qso: { their } },
        { ...context, getQsos },
      )
      expect(controls[0]?.input).toMatchObject({
        suggestedValue: their.call === 'K1ABC' ? 'NC' : ' ',
      })
    }
    expect(getQsos).not.toHaveBeenCalled()
  })
})
