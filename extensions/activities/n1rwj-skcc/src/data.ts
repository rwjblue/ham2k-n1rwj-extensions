// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type DataFileDefinition, host, type JSONValue } from '@ham2k/extension-sdk'
import { KEY, type Roster } from './model.ts'
import { parseRoster, ROSTER_URL } from './roster.ts'

export interface RosterSnapshot {
  schema: 1
  body: string
  source: string
  downloadedAt: number
}
interface Storage {
  read(): Promise<unknown>
  write(value: JSONValue): Promise<void>
}
const sourcePattern =
  /^https:\/\/(?:www\.)?skccgroup\.com\/(?:skimmer-data\.txt|membership_data\/skccdata\.txt)$/

export function checkedSnapshot(value: unknown): { snapshot: RosterSnapshot; roster: Roster } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schema' in value) ||
    value.schema !== 1 ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    !('source' in value) ||
    typeof value.source !== 'string' ||
    !sourcePattern.test(value.source) ||
    !('downloadedAt' in value) ||
    typeof value.downloadedAt !== 'number' ||
    !Number.isSafeInteger(value.downloadedAt) ||
    value.downloadedAt < 0 ||
    value.downloadedAt > 8640000000000000
  )
    throw new Error('Invalid SKCC roster snapshot. Previous data retained.')
  const snapshot: RosterSnapshot = {
    schema: 1,
    body: value.body,
    source: value.source,
    downloadedAt: value.downloadedAt,
  }
  return { snapshot, roster: parseRoster(snapshot.body, snapshot) }
}

/** Native Data Files durably persist snapshots. A host-memory KV last-good
 * copy also permits runtime reloads before native replay; cold app starts
 * rely on the native cache. Lookup hooks never perform network work. */
export function createRosterCache(storage: Storage, onChange: () => void = () => undefined) {
  let current: ReturnType<typeof checkedSnapshot> | undefined
  let lastError: string | undefined
  let generation = 0
  let ready: Promise<void> | undefined
  let mutations = Promise.resolve()
  function notify() {
    try {
      onChange()
    } catch {
      /* Optional invalidation must not break the cache. */
    }
  }
  function install(next: ReturnType<typeof checkedSnapshot>) {
    if (current && next.snapshot.downloadedAt < current.snapshot.downloadedAt) return
    const changed = !current || current.roster.revision !== next.roster.revision
    generation++
    current = next
    lastError = undefined
    if (changed) notify()
  }
  function checkSize(next: ReturnType<typeof checkedSnapshot>) {
    // SKCC memberships are permanent. A large loss is likely a partial download.
    if (current && next.roster.members.length < current.roster.members.length * 0.9)
      throw new Error('SKCC roster lost more than 10% of its records. Previous data retained.')
  }
  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutations.then(operation)
    mutations = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
  return {
    getRoster: () => current?.roster,
    error: () => lastError,
    load(): Promise<void> {
      ready ??= (async () => {
        const before = generation
        try {
          const saved = await storage.read()
          if (saved !== null && saved !== undefined && generation === before && !current)
            install(checkedSnapshot(saved))
        } catch (cause) {
          if (generation === before) lastError = String(cause)
        }
      })()
      return ready
    },
    replace(snapshot: RosterSnapshot): Promise<RosterSnapshot> {
      const candidate = { ...snapshot }
      return mutate(async () => {
        try {
          const next = checkedSnapshot(candidate)
          checkSize(next)
          if (current && next.snapshot.downloadedAt < current.snapshot.downloadedAt)
            return current.snapshot
          await storage.write({ ...next.snapshot })
          // An accepted newer native replay may arrive while storage writes.
          if (current && next.snapshot.downloadedAt < current.snapshot.downloadedAt) {
            await storage.write({ ...current.snapshot })
            return current.snapshot
          }
          install(next)
          return next.snapshot
        } catch (cause) {
          lastError = String(cause)
          throw cause
        }
      })
    },
    accept(raw: unknown): void {
      try {
        const next = checkedSnapshot(raw)
        checkSize(next)
        install(next)
      } catch (cause) {
        lastError = String(cause)
      }
    },
    remove(): Promise<void> {
      return mutate(async () => {
        try {
          await storage.write(null)
          generation++
          current = undefined
          lastError = undefined
          notify()
        } catch (cause) {
          lastError = String(cause)
          throw cause
        }
      })
    },
  }
}

export function createData(options: { onChange?: () => void } = {}) {
  const cache = createRosterCache(
    {
      read: () => host.kvGet('last-good-skcc-roster'),
      write: (value) => host.kvSet('last-good-skcc-roster', value),
    },
    options.onChange,
  )
  void cache.load()
  const dataFile: DataFileDefinition = {
    key: `${KEY}_members`,
    category: KEY,
    name: 'SKCC member roster',
    description:
      'Offline names, SKCC numbers, status and award dates. Confirm exchanges and key use on air. After roster changes, reload the extension, then toggle EXP CHASE off/on on a device holding the complete log to rebuild native lifetime checklists.',
    url: ROSTER_URL,
    fetchType: 'raw',
    maxAgeInDays: 1,
    async rawToJSONData({ body, url }) {
      return cache.replace({ schema: 1, body, source: url, downloadedAt: Date.now() })
    },
    onLoadRawData: (raw) => cache.accept(raw),
    onRemoveRawData: () => cache.remove(),
  }
  return { dataFile, getRoster: cache.getRoster, load: cache.load, error: cache.error }
}
