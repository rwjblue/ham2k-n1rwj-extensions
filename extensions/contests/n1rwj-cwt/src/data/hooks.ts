import type { DataFileDefinition } from '@ham2k/extension-sdk'
import manifest from '../../manifest.json'
import { tFor } from '../cwt/i18n.ts'
import { createFileCache } from './cache.ts'
import { DEFAULT_SOURCE } from './source.ts'

export const fileCache = createFileCache()

export const DataFile: DataFileDefinition = {
  key: `${manifest.key}_history`,
  name: (_args, ctx) => tFor(ctx)('historyFileName'),
  description: (_args, ctx) => tFor(ctx)('historyFileDescription'),
  url: DEFAULT_SOURCE,
  maxAgeInDays: 1,
  fetchType: 'raw',
  category: manifest.key,
  async rawToJSONData({ body, url }) {
    return fileCache.replace({ schema: 1, body, url, fetchedAt: new Date().toISOString() })
  },
  onLoadRawData(data: unknown) {
    fileCache.accept(data)
  },
  onRemoveRawData: () => fileCache.remove(),
}
