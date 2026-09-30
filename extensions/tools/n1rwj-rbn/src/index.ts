import { defineExtension, host } from '@ham2k/extension-sdk'
import type { ActivityHook } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { rbnClient, rbnFetch, setRbnSettings } from './data/host-client.ts'
import { createReceiverData } from './data/receivers.ts'
import { createRbnPanel } from './panel.ts'
import { createRbnSpots } from './spots/index.ts'

defineExtension({
  ...manifest,
  onHide() {
    rbnClient.pause?.()
  },
  onActivation({ registerHook }) {
    const receivers = createReceiverData()
    // Share receiver metadata, never receiver selection. Spots preferences are
    // owned by createRbnSpots; My Signal uses its own per-panel configuration.
    const { spots, settings } = createRbnSpots({
      fetch: rbnFetch,
      healthTimers: host,
      lookup: receivers.lookup,
      receiverEntries: receivers.entries,
      continentNear: receivers.continentNear,
      setSettings: setRbnSettings,
    })
    registerHook('spots', { hook: spots })
    // HaLo resolves reference icons through logging controls, including refs
    // already saved on QSOs. Keep this unconditional and outside contest UI.
    registerHook('activity', {
      hook: {
        async loggingControls() {
          return [
            {
              key: `${manifest.key}/station`,
              label: 'RBN',
              icon: manifest.icon,
              input: { kind: 'refList', refType: 'rbn' },
            },
          ]
        },
      } satisfies ActivityHook,
    })
    registerHook('settingsPanel', { hook: settings })
    registerHook('dataFile', { key: receivers.dataFile.key, hook: receivers.dataFile })
    registerHook('panel', {
      key: manifest.key,
      hook: createRbnPanel({ enrichReports: receivers.enrichReports }),
    })
  },
})
