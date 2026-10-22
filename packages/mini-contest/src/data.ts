import type { DataFileDefinition } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import { createN1mmSource, DEFAULT_SOURCE } from '../../n1mm/src/source.ts'
import { type HistoryFile, parseHistory } from './history.ts'
import type { ContestManifest, DownloadedContestConfig } from './model.ts'

interface Snapshot {
  schema: 1
  body: string
  url: string
  fetchedAt: string
}
export function createHistoryData(config: DownloadedContestConfig, manifest: ContestManifest) {
  let current: { snapshot: Snapshot; parsed: HistoryFile } | undefined
  const source = createN1mmSource({ filePrefix: config.historyPrefix, label: config.shortName })
  function accept(raw: unknown) {
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
      throw new Error('Invalid history snapshot. Previous data retained.')
    const parsed = parseHistory(config, raw.body)
    if (!current || raw.fetchedAt >= current.snapshot.fetchedAt)
      current = {
        snapshot: { schema: 1, body: raw.body, url: raw.url, fetchedAt: raw.fetchedAt },
        parsed,
      }
  }
  const dataFile: DataFileDefinition = {
    key: `${manifest.key}_history`,
    name: `${config.shortName} N1MM call history`,
    description:
      config.exchange === 'serial-name'
        ? 'Name suggestions only. Received serials must always be copied on the air.'
        : 'Name and state/province/DX suggestions; verify the received exchange on the air.',
    category: manifest.key,
    fetchType: 'raw',
    maxAgeInDays: 1,
    url: DEFAULT_SOURCE,
    async rawToJSONData({ body, url }) {
      const downloaded = await source.sourceText(body, url, host.fetch, host)
      const snapshot: Snapshot = { schema: 1, ...downloaded, fetchedAt: new Date().toISOString() }
      accept(snapshot)
      return { ...snapshot }
    },
    onLoadRawData(raw: unknown) {
      try {
        accept(raw)
      } catch {
        // An invalid cached snapshot must not replace the last good history.
      }
    },
    async onRemoveRawData() {
      current = undefined
    },
  }
  return { dataFile, current: () => current?.parsed }
}
