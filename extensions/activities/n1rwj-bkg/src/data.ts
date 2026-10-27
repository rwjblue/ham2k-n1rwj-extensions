// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { DataFileDefinition } from '@ham2k/extension-sdk'
import { KEY, object, ROSTER_URL, type Roster } from './model.ts'
import { parseRoster } from './roster.ts'

/** The host persists this raw conversion on disk and replays it on cold starts.
 * host.kvSet is intentionally unused: it is only an in-memory cache. */
export function createData(now: () => number = Date.now) {
  let roster: Roster | undefined
  let error: string | undefined
  function checked(raw: unknown) {
    const value = object(raw)
    if (
      value.schema !== 1 ||
      typeof value.body !== 'string' ||
      typeof value.downloadedAt !== 'number'
    )
      throw new Error('Invalid cached BKG roster')
    return parseRoster(value.body, value.downloadedAt)
  }
  function install(next: Roster) {
    if (
      roster &&
      (next.generatedAt < roster.generatedAt || next.downloadedAt < roster.downloadedAt)
    )
      return false
    if (roster && next.members.length < roster.members.length * 0.8)
      throw new Error('BKG roster lost more than 20% of its members; previous roster retained')
    roster = next
    error = undefined
    return true
  }
  const dataFile: DataFileDefinition = {
    key: `${KEY}_members`,
    category: KEY,
    name: 'BKG member roster',
    description:
      'Daily offline membership data from BKG.club. Refresh here for new members. Existing native chase caches may need an extension reload and a chase rebuild on a device with the complete log.',
    url: ROSTER_URL,
    maxAgeInDays: 1,
    fetchType: 'raw',
    async rawToJSONData({ body }) {
      try {
        const snapshot = { schema: 1, body, downloadedAt: now() }
        if (!install(checked(snapshot)))
          throw new Error('Older BKG snapshot; previous roster retained')
        return snapshot
      } catch (cause) {
        error = String(cause)
        throw cause
      }
    },
    onLoadRawData(raw) {
      try {
        install(checked(raw))
      } catch (cause) {
        error = String(cause)
      }
    },
    async onRemoveRawData() {
      roster = undefined
      error = undefined
    },
  }
  return { dataFile, getRoster: () => roster, error: () => error }
}
