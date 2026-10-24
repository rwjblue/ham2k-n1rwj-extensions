// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { DataFileDefinition, DynamicSettingsPanel, JSONValue } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import {
  createN1mmSource,
  DEFAULT_SOURCE,
  sourceValidationError,
} from '../../../../packages/n1mm/src/source.ts'
import { zombieAboutDefinition } from './about.ts'
import { parseZombieHistory, type ZombieHistoryFile } from './history.ts'

export interface ZombieSnapshot {
  schema: 1
  body: string
  url: string
  fetchedAt: string
}
export interface LoadedFile {
  snapshot: ZombieSnapshot
  parsed: ZombieHistoryFile
}
interface Storage {
  read(): Promise<unknown>
  write(value: JSONValue): Promise<void>
}
export const zombieSource = createN1mmSource({ filePrefix: 'ZOMBIE', label: 'Zombie Shuffle' })
// The unfiltered category's first page contains only recent uploads. A useful
// annual file can be years old, so ask N1MM to filter before it paginates.
export const ZOMBIE_DEFAULT_SOURCE = `${DEFAULT_SOURCE}?CMDsearch=ZOMBIE&sort=newest&view=list`

export function zombieSourceUrl(selected: string): string {
  if (!selected || sourceValidationError(selected)) return ZOMBIE_DEFAULT_SOURCE
  if (
    /^https:\/\/n1mm(?:wp)?\.hamdocs\.com\/mmfiles\/categories\/callhistory\/?(?:[?#].*)?$/i.test(
      selected,
    )
  ) {
    const category = selected.split(/[?#]/)[0]?.replace(/\/?$/, '/')
    return `${category}?CMDsearch=ZOMBIE&sort=newest&view=list`
  }
  return selected
}

export function checkedZombieSnapshot(raw: unknown): LoadedFile {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('schema' in raw) ||
    raw.schema !== 1 ||
    !('body' in raw) ||
    typeof raw.body !== 'string' ||
    !('url' in raw) ||
    typeof raw.url !== 'string' ||
    !('fetchedAt' in raw) ||
    typeof raw.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(raw.fetchedAt))
  )
    throw new Error('Invalid Zombie history snapshot. Previous data retained.')
  return {
    snapshot: { schema: 1, body: raw.body, url: raw.url, fetchedAt: raw.fetchedAt },
    parsed: parseZombieHistory(raw.body),
  }
}

/** Host KV keeps one last-good runtime copy. The native Data Files manager
 * persists each successful snapshot and replays it when starting offline. */
export function createZombieFileCache(storage: Storage) {
  let current: LoadedFile | undefined
  let error: string | undefined
  let generation = 0
  let ready: Promise<void> | undefined
  let mutations: Promise<void> = Promise.resolve()
  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutations.then(operation)
    mutations = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
  return {
    current: () => current,
    error: () => error,
    failed: (cause: unknown) => {
      error = String(cause)
    },
    load(): Promise<void> {
      ready ??= (async () => {
        const before = generation
        try {
          const raw = await storage.read()
          if (raw !== null && raw !== undefined && generation === before && !current)
            current = checkedZombieSnapshot(raw)
        } catch (cause) {
          if (generation === before) error = String(cause)
        }
      })()
      return ready
    },
    replace(snapshot: ZombieSnapshot): Promise<ZombieSnapshot> {
      const candidate = { ...snapshot }
      return mutate(async () => {
        try {
          const next = checkedZombieSnapshot(candidate)
          await storage.write({ ...next.snapshot })
          generation++
          current = next
          error = undefined
          return next.snapshot
        } catch (cause) {
          error = String(cause)
          throw cause
        }
      })
    },
    accept(raw: unknown): void {
      try {
        const next = checkedZombieSnapshot(raw)
        if (
          !current ||
          Date.parse(next.snapshot.fetchedAt) >= Date.parse(current.snapshot.fetchedAt)
        ) {
          generation++
          current = next
          error = undefined
        }
      } catch (cause) {
        error = String(cause)
      }
    },
    remove(): Promise<void> {
      return mutate(async () => {
        try {
          await storage.write(null)
          generation++
          current = undefined
          error = undefined
        } catch (cause) {
          error = String(cause)
          throw cause
        }
      })
    },
  }
}

function object(value: JSONValue | undefined): Record<string, JSONValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function createZombieData(manifest = { key: 'n1rwj-zombie', icon: 'ghost' }) {
  const cache = createZombieFileCache({
    read: () => host.kvGet('last-good-zombie-file'),
    write: (value) => host.kvSet('last-good-zombie-file', value),
  })
  // Activation is synchronous; this one bounded read catches its own errors.
  // Native persisted Data Files replay supersedes an in-flight KV restore.
  void cache.load()
  async function savedSource(): Promise<string> {
    const settings = await host.getSettings()
    const mine = object(object(settings.extensions)[`extension_${manifest.key}`])
    return typeof mine.source === 'string' ? mine.source.trim() : ''
  }
  const dataFile: DataFileDefinition = {
    key: `${manifest.key}_history`,
    name: 'Zombie Shuffle N1MM call history',
    description:
      'Zombie name, exchanged number and SPC suggestions. Prior-year bonus assignments are excluded; confirm exchanges on the air.',
    category: manifest.key,
    fetchType: 'raw',
    maxAgeInDays: 1,
    async url() {
      return zombieSourceUrl(await savedSource())
    },
    async rawToJSONData({ body, url }) {
      try {
        const downloaded = await zombieSource.sourceText(body, url, host.fetch, host)
        return await cache.replace({
          schema: 1,
          ...downloaded,
          fetchedAt: new Date().toISOString(),
        })
      } catch (cause) {
        cache.failed(cause)
        throw cause
      }
    },
    onLoadRawData: (raw: unknown) => cache.accept(raw),
    onRemoveRawData: () => cache.remove(),
  }
  const settings: DynamicSettingsPanel = {
    kind: 'dynamic',
    async getPanels() {
      return [
        {
          key: manifest.key,
          title: 'Zombie Shuffle',
          icon: manifest.icon,
          section: 'activities',
          sidebar: false,
          dataFilesSection: true,
        },
      ]
    },
    async getDefinition() {
      await cache.load()
      const selected = await savedSource()
      const loaded = cache.current()
      const about = zombieAboutDefinition()
      return {
        title: about.title,
        subtitle: about.subtitle,
        elements: [
          { type: 'divider', title: 'Call history' },
          {
            type: 'markdown',
            text: [
              loaded
                ? `${loaded.parsed.count} calls loaded. File date: ${loaded.parsed.sourceUpdatedAt ?? 'unknown'}. Source event year: ${loaded.parsed.sourceYear ?? 'unknown'}. Downloaded: ${loaded.snapshot.fetchedAt}. Parser warnings: ${loaded.parsed.warnings}.`
                : 'No Zombie call-history file loaded. Download it in Data Files to enable offline suggestions.',
              cache.error() ?? '',
              sourceValidationError(selected) ?? '',
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
          {
            type: 'field',
            fieldType: 'text',
            key: 'source',
            label: 'N1MM call-history source',
            uppercase: false,
            value: selected || ZOMBIE_DEFAULT_SOURCE,
          },
          {
            type: 'markdown',
            text: 'Leave blank to discover the latest available Zombie file, or paste an HTTPS N1MM entry/text URL. Category URLs are filtered to Zombie files and sorted newest first before N1MM paginates them. Refresh in Data Files after changing it. Files need not be published every year. The last successful download remains available offline. The known 2025 bonus number 3333 is omitted from 2026 suggestions. Files with an unknown event year also omit known bonus values 3333 and 4321; names and SPC remain available. Explicit exchange edits and clearing always win.',
          },
          { type: 'divider', title: 'About Zombie Shuffle' },
          ...about.elements,
        ],
      }
    },
    async validateField({ panelKey, fieldKey, value }) {
      return panelKey === manifest.key && fieldKey === 'source' && typeof value === 'string'
        ? sourceValidationError(value)
        : null
    },
    async onChangeField({ panelKey, fieldKey, value }) {
      if (panelKey !== manifest.key || fieldKey !== 'source' || typeof value !== 'string') return
      const error = sourceValidationError(value)
      if (error) throw new Error(error)
      await host.setSettings({ source: value.trim() })
    },
  }
  return { dataFile, settings, cache }
}
