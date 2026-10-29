// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { DataFileDefinition } from '@ham2k/extension-sdk'
import { KEY, type Roster } from './model.ts'
import { parseRoster, ROSTER_URL } from './roster.ts'

export interface RosterSnapshot {
  schema: 1
  body: string
  source: string
  downloadedAt: number
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

/** Native Data Files persist snapshots and replay them offline. Only the
 * parsed roster lives in memory; host KV cannot hold whole datasets. */
export function createRosterCache(onChange: () => void = () => undefined) {
  let current: ReturnType<typeof checkedSnapshot> | undefined
  let lastError: string | undefined
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
    current = next
    lastError = undefined
    if (changed) notify()
  }
  function checkSize(next: ReturnType<typeof checkedSnapshot>) {
    // SKCC memberships are permanent. A large loss is likely a partial download.
    if (current && next.roster.members.length < current.roster.members.length * 0.9)
      throw new Error('SKCC roster lost more than 10% of its records. Previous data retained.')
  }
  return {
    getRoster: () => current?.roster,
    error: () => lastError,
    async replace(snapshot: RosterSnapshot): Promise<RosterSnapshot> {
      try {
        const next = checkedSnapshot(snapshot)
        checkSize(next)
        install(next)
        return { ...(current ?? next).snapshot }
      } catch (cause) {
        lastError = String(cause)
        throw cause
      }
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
    async remove(): Promise<void> {
      current = undefined
      lastError = undefined
      notify()
    },
  }
}

export function createData(options: { onChange?: () => void } = {}) {
  const cache = createRosterCache(options.onChange)
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
  return { dataFile, getRoster: cache.getRoster, error: cache.error }
}
