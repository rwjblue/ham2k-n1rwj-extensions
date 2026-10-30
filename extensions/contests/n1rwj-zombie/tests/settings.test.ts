import { host } from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import manifest from '../manifest.json'
import { zombieAboutDefinition } from '../src/about.ts'
import { createZombieSettings } from '../src/settings.ts'

afterEach(() => vi.restoreAllMocks())

it('offers an About row and opens the offline guide without reading or saving settings', async () => {
  const getSettings = vi.spyOn(host, 'getSettings').mockResolvedValue({
    extensions: {
      'extension_n1rwj-zombie': { source: 'https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/' },
    },
  })
  const fetch = vi.spyOn(host, 'fetch')
  const kvGet = vi.spyOn(host, 'kvGet')
  const kvSet = vi.spyOn(host, 'kvSet')
  const setSettings = vi.spyOn(host, 'setSettings')
  const showForm = vi.fn(async () => null)
  const settings = createZombieSettings(manifest, { showForm })
  expect(await settings.getPanels?.({}, { online: false })).toEqual([
    {
      key: manifest.key,
      title: 'Zombie Shuffle',
      icon: manifest.icon,
      sidebar: false,
    },
  ])
  const form = await settings.getDefinition({ panelKey: manifest.key }, { online: false })
  expect(form.elements).toEqual([
    {
      type: 'action',
      style: 'row',
      key: 'about',
      label: 'About Zombie Shuffle',
      icon: 'information-outline',
      method: 'showAbout',
    },
  ])
  expect(showForm).not.toHaveBeenCalled()
  await expect(settings.showAbout()).resolves.toBeNull()
  expect(showForm).toHaveBeenCalledExactlyOnceWith(zombieAboutDefinition())
  expect(JSON.stringify(form)).not.toMatch(/N1MM|download|Data Files|source setting/i)
  await settings.onChangeField(
    { panelKey: manifest.key, fieldKey: 'source', value: '', state: {} },
    { online: false },
  )
  for (const method of [getSettings, fetch, kvGet, kvSet, setSettings])
    expect(method).not.toHaveBeenCalled()
})
