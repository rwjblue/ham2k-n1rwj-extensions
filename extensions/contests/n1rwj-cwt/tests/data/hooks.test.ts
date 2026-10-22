import { host } from '@ham2k/extension-sdk'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DataFile, fileCache } from '../../src/data/hooks.ts'
import { DEFAULT_SOURCE } from '../../src/data/source.ts'

const ctx = { online: false, locale: 'es' }

beforeEach(async () => {
  vi.spyOn(host, 'kvGet').mockResolvedValue(null)
  vi.spyOn(host, 'kvSet').mockResolvedValue(undefined)
  vi.spyOn(host, 'getSettings').mockResolvedValue({})
  await fileCache.remove()
})
afterEach(() => vi.restoreAllMocks())

it('localizes automatic discovery while retaining the personal data-file identity', async () => {
  expect(DataFile.key).toBe('n1rwj-cwt_history')
  expect(host.kvSet).toHaveBeenCalledWith('last-good-cwt-file', null)
  if (typeof DataFile.name !== 'function' || typeof DataFile.description !== 'function')
    throw new Error('Expected localized data-file metadata')
  for (const [locale, name, description] of [
    ['en', 'CWops CWT call history (N1RWJ)', 'Automatically discovers the latest N1MM CWOPS file'],
    [
      'es',
      'Historial de indicativos CWT de CWops (N1RWJ)',
      'Busca automáticamente el archivo CWOPS más reciente de N1MM',
    ],
  ]) {
    const context = { ...ctx, locale }
    expect(await DataFile.name({}, context)).toBe(name)
    expect(await DataFile.description({}, context)).toContain(description)
  }
})

it.each(['https://n1mmwp.hamdocs.com/mmfiles/cwops_3992-aaa-txt/', '/tmp/old-file.txt', ''])(
  'uses automatic discovery regardless of a legacy source setting (%s)',
  async (source) => {
    vi.mocked(host.getSettings).mockResolvedValue({
      extensions: { 'extension_n1rwj-cwt': { source } },
    })
    const url = DataFile.url
    expect(typeof url === 'function' ? await url({}, ctx) : url).toBe(DEFAULT_SOURCE)
    expect(host.getSettings).not.toHaveBeenCalled()
  },
)
