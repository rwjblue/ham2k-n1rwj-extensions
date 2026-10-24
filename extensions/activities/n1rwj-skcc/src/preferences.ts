// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { host, type JSONValue } from '@ham2k/extension-sdk'
import { KEY, type KeyType, memberNumber, memberSuffix, object, text } from './model.ts'

export interface Preferences {
  myNumber: string
  myName: string
  mySpc: string
  myKey: KeyType
  maxWpm: number
  spotAgeMinutes: number
  personalTarget: number
  bragBonusNumber: string
  month: string
  rebuildChecklists: boolean
}
export const DEFAULTS: Preferences = {
  myNumber: '',
  myName: '',
  mySpc: '',
  myKey: '',
  maxWpm: 0,
  spotAgeMinutes: 15,
  personalTarget: 5,
  bragBonusNumber: '',
  month: '',
  rebuildChecklists: false,
}
export const KEY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'SK', label: 'Straight key' },
  { value: 'BUG', label: 'Bug' },
  { value: 'SS', label: 'Sideswiper / cootie' },
  { value: 'WAIVER', label: 'SKCC-approved waiver' },
  { value: 'OTHER', label: 'Other key' },
]
export function validMonth(value: string): boolean {
  return value === '' || /^20\d{2}-(0[1-9]|1[0-2])$/.test(value)
}
export function normalizePreferences(input: unknown): Preferences {
  const raw = object(input)
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = raw[key]
    const n =
      typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback
  }
  return {
    myNumber: memberNumber(raw.myNumber)
      ? `${memberNumber(raw.myNumber)}${memberSuffix(raw.myNumber)}`
      : '',
    myName: text(raw.myName).slice(0, 80),
    mySpc: text(raw.mySpc).toUpperCase().slice(0, 40),
    myKey: KEY_OPTIONS.some((option) => option.value === raw.myKey) ? (raw.myKey as KeyType) : '',
    maxWpm: integer('maxWpm', 0, 0, 80),
    spotAgeMinutes: integer('spotAgeMinutes', 15, 1, 60),
    personalTarget: integer('personalTarget', 5, 1, 1000),
    bragBonusNumber: memberNumber(raw.bragBonusNumber) ?? '',
    month: validMonth(text(raw.month)) ? text(raw.month) : '',
    rebuildChecklists: raw.rebuildChecklists === true,
  }
}

export function createPreferences(deps: Pick<typeof host, 'getSettings' | 'setSettings'> = host) {
  let current = { ...DEFAULTS }
  let loading: Promise<void> | undefined
  let mutations = Promise.resolve()
  let generation = 0
  function load(): Promise<void> {
    if (!loading) {
      const before = generation
      loading = deps
        .getSettings()
        .then((settings) => {
          if (generation === before)
            current = normalizePreferences(object(settings.extensions)[`extension_${KEY}`])
        })
        .catch(() => {
          loading = undefined
        })
    }
    return loading
  }
  return {
    get: () => ({ ...current }),
    load,
    set(key: string, value: JSONValue): Promise<void> {
      if (!Object.keys(DEFAULTS).includes(key))
        return Promise.reject(new Error('Unknown SKCC setting'))
      const result = mutations.then(async () => {
        await load()
        const next = normalizePreferences({ ...current, [key]: value })
        await deps.setSettings({ [key]: next[key as keyof Preferences] })
        generation++
        current = next
      })
      mutations = result.then(
        () => undefined,
        () => undefined,
      )
      return result
    },
  }
}
export type PreferencesStore = ReturnType<typeof createPreferences>
