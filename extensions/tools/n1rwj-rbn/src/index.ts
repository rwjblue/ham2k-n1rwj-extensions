import { defineExtension, host } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import {
  rbnClient,
  rbnEvidence,
  rbnFetch,
  rbnRecorder,
  setRbnSettings,
} from './data/host-client.ts'
import { createReceiverData } from './data/receivers.ts'
import { createRbnExportHook } from './export/hook.ts'
import { createRbnPanel } from './panel.ts'
import { createRbnSpots } from './spots/index.ts'

defineExtension({
  ...manifest,
  onHide() {
    rbnClient.pause?.()
    rbnRecorder.pause()
  },
  onActivation({ registerHook }) {
    const receivers = createReceiverData()
    // Share receiver metadata, never receiver selection. Spots preferences are
    // owned by createRbnSpots; My Signal uses its own per-panel configuration.
    const { spots, settings, activity } = createRbnSpots({
      fetch: rbnFetch,
      healthTimers: host,
      lookup: receivers.lookup,
      receiverEntries: receivers.entries,
      continentNear: receivers.continentNear,
      setSettings: setRbnSettings,
    })
    registerHook('spots', { hook: spots })
    registerHook('activity', { hook: activity })
    registerHook('settingsPanel', { hook: settings })
    registerHook('dataFile', { key: receivers.dataFile.key, hook: receivers.dataFile })
    registerHook('export', {
      hook: createRbnExportHook(rbnEvidence, Date.now, receivers.lookup, rbnClient.readSnapshots),
    })
    registerHook('panel', {
      key: manifest.key,
      hook: createRbnPanel({
        enrichReports: receivers.enrichReports,
        observeCollection: rbnRecorder.observe,
      }),
    })
  },
})
