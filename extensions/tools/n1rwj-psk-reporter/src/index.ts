import { defineExtension, host } from '@ham2k/extension-sdk'
import { createPersistentStorage } from '../../../../packages/reception/src/storage.ts'
import manifest from '../manifest.json'
import type { LiveReception } from './live.ts'
import { createLiveReception } from './live.ts'
import { createPskPanel } from './panel.ts'

let reception: LiveReception | undefined

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const live = createLiveReception(
      (url, options) => host.webSocket(url, options),
      Date.now,
      Math.random,
      {
        fetch: (url, options) => host.fetch(url, options),
        ...createPersistentStorage(host, manifest.key),
      },
      host,
    )
    reception = live
    registerHook('panel', { key: manifest.key, hook: createPskPanel(live) })
  },
  onHide() {
    reception?.pause()
  },
})
