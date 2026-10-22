import type { DataFileDefinition } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import manifest from '../../manifest.json'
import { tFor } from '../cwt/i18n.ts'
import { createFileCache } from './cache.ts'
import { DEFAULT_SOURCE, sourceText } from './source.ts'

export const fileCache = createFileCache({
  read: () => host.kvGet('last-good-cwt-file'),
  write: (value) => host.kvSet('last-good-cwt-file', value),
})

export const DataFile: DataFileDefinition = {
  key: `${manifest.key}_history`,
  name: (_args, ctx) => tFor(ctx)('historyFileName'),
  description: (_args, ctx) => tFor(ctx)('historyFileDescription'),
  url: DEFAULT_SOURCE,
  maxAgeInDays: 1,
  fetchType: 'raw',
  category: manifest.key,
  async rawToJSONData({ body, url }) {
    const source = await sourceText(body, url, host.fetch, host)
    return fileCache.replace({ schema: 1, ...source, fetchedAt: new Date().toISOString() })
  },
  onLoadRawData(data: unknown) {
    fileCache.accept(data)
  },
  onRemoveRawData: () => fileCache.remove(),
}
