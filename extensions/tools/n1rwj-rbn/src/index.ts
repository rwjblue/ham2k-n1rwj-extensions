import { defineExtension, host } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createRbnCluster, type RbnCluster } from './cluster/index.ts'
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
import { ownSettings } from './spots/preferences.ts'

let cluster: RbnCluster | undefined
let pauseSpots: (() => void) | undefined

defineExtension({
  ...manifest,
  onShow() {
    cluster?.resume()
  },
  onHide() {
    pauseSpots?.()
    cluster?.pause()
    rbnClient.pause?.()
    rbnRecorder.pause()
  },
  onActivation({ registerHook }) {
    const receivers = createReceiverData()
    const live = createRbnCluster(host)
    cluster = live
    // Share receiver metadata, never receiver selection. Spots preferences are
    // owned by createRbnSpots; My Signal uses its own per-panel configuration.
    const { spots, settings, activity, pause } = createRbnSpots({
      fetch: rbnFetch,
      healthTimers: host,
      lookup: receivers.lookup,
      receiverEntries: receivers.entries,
      continentNear: receivers.continentNear,
      setSettings: setRbnSettings,
      cluster: live,
      publishSpots: (spots) => host.spots.replace(spots, { source: manifest.key }),
    })
    pauseSpots = pause
    registerHook('cluster', { key: manifest.key, hook: { onLines: live.hook.onLines } })
    registerHook('spots', { hook: spots })
    registerHook('activity', { hook: activity })
    registerHook('settingsPanel', { hook: settings })
    registerHook('dataFile', { key: receivers.dataFile.key, hook: receivers.dataFile })
    registerHook('export', {
      hook: createRbnExportHook(
        rbnEvidence,
        Date.now,
        receivers.lookup,
        rbnClient.readSnapshots,
        async () => ownSettings(await host.getSettings()),
      ),
    })
    registerHook('panel', {
      key: manifest.key,
      hook: createRbnPanel({
        enrichReports: receivers.enrichReports,
        observeCollection: rbnRecorder.observe,
        cluster: live,
      }),
    })
  },
})
