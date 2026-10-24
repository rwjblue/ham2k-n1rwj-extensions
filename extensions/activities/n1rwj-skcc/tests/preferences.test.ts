import type { JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import {
  createPreferences,
  DEFAULTS,
  normalizePreferences,
  validMonth,
} from '../src/preferences.ts'

describe('SKCC preference normalization', () => {
  it('normalizes member identifiers, key choices, text and numeric form values', () => {
    expect(
      normalizePreferences({
        myNumber: ' 00123t ',
        myName: ' Alice ',
        mySpc: ' ma ',
        myKey: 'BUG',
        maxWpm: '18',
        spotAgeMinutes: '30',
        personalTarget: 10,
        bragBonusNumber: '0007S',
        month: '2026-10',
        rebuildChecklists: true,
      }),
    ).toEqual({
      myNumber: '123T',
      myName: 'Alice',
      mySpc: 'MA',
      myKey: 'BUG',
      maxWpm: 18,
      spotAgeMinutes: 30,
      personalTarget: 10,
      bragBonusNumber: '7',
      month: '2026-10',
      rebuildChecklists: true,
    })
  })
  it('rejects coercible booleans/arrays, invalid bounds and unknown values', () => {
    expect(
      normalizePreferences({
        myNumber: 'NONE',
        myKey: 'electronic',
        maxWpm: true,
        spotAgeMinutes: [5],
        personalTarget: 1.5,
        bragBonusNumber: '0',
        month: '2026-13',
        rebuildChecklists: 'true',
      }),
    ).toEqual(DEFAULTS)
    expect(
      normalizePreferences({ maxWpm: 81, spotAgeMinutes: -1, personalTarget: Infinity }),
    ).toEqual(DEFAULTS)
    for (const value of [null, [], false, 'text'])
      expect(normalizePreferences(value)).toEqual(DEFAULTS)
    expect(
      normalizePreferences({ myName: 'a'.repeat(100), mySpc: 'x'.repeat(50) }).myName,
    ).toHaveLength(80)
    expect(validMonth('')).toBe(true)
    expect(validMonth('2026-1')).toBe(false)
  })
})

describe('SKCC preference persistence', () => {
  it('reads only the namespaced settings once and merges concurrent field saves', async () => {
    const getSettings = vi.fn(async () => ({
      extensions: {
        'extension_n1rwj-skcc': { myName: 'Loaded', myKey: 'SK' },
        another: { myName: 'Wrong' },
      },
    }))
    const setSettings = vi.fn(async (_patch: Record<string, JSONValue>) => undefined)
    const store = createPreferences({ getSettings, setSettings })
    await Promise.all([store.load(), store.load()])
    await Promise.all([store.set('maxWpm', '18'), store.set('spotAgeMinutes', 30)])
    expect(getSettings).toHaveBeenCalledTimes(1)
    expect(store.get()).toMatchObject({
      myName: 'Loaded',
      myKey: 'SK',
      maxWpm: 18,
      spotAgeMinutes: 30,
    })
    expect(setSettings.mock.calls).toEqual([[{ maxWpm: 18 }], [{ spotAgeMinutes: 30 }]])
    const copy = store.get()
    copy.myName = 'Mutation'
    expect(store.get().myName).toBe('Loaded')
  })
  it('waits for initial preferences before saving, preserving fields the form did not edit', async () => {
    let resolve!: (value: Record<string, JSONValue>) => void
    const getSettings = vi.fn(
      () =>
        new Promise<Record<string, JSONValue>>((done) => {
          resolve = done
        }),
    )
    const setSettings = vi.fn(async (_patch: Record<string, JSONValue>) => undefined)
    const store = createPreferences({ getSettings, setSettings })
    const load = store.load()
    const save = store.set('myName', 'Edited')
    resolve({ extensions: { 'extension_n1rwj-skcc': { myName: 'Old', myNumber: '123T' } } })
    await Promise.all([load, save])
    expect(store.get()).toMatchObject({ myName: 'Edited', myNumber: '123T' })
  })
  it('retains current values after failed writes, retries failed loads and rejects inherited keys', async () => {
    const getSettings = vi
      .fn(async () => ({ extensions: {} }))
      .mockRejectedValueOnce(new Error('Unavailable'))
    const setSettings = vi
      .fn(async (_patch: Record<string, JSONValue>) => undefined)
      .mockRejectedValueOnce(new Error('Write failed'))
    const store = createPreferences({ getSettings, setSettings })
    await store.load()
    await expect(store.set('myName', 'Lost')).rejects.toThrow('Write failed')
    expect(store.get().myName).toBe('')
    await store.set('myName', 'Saved')
    expect(store.get().myName).toBe('Saved')
    expect(getSettings).toHaveBeenCalledTimes(2)
    for (const key of ['unknown', '__proto__', 'constructor', 'toString'])
      await expect(store.set(key, '')).rejects.toThrow('Unknown SKCC setting')
    expect(setSettings).toHaveBeenCalledTimes(2)
  })
})
