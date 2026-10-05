import { host } from '@ham2k/extension-sdk'
import { createPersistentStorage } from '../../../../../packages/reception/src/storage.ts'
import manifest from '../../manifest.json'
import { createEvidenceRetriever } from '../export/history.ts'
import { createReceptionRecorder } from '../export/recorder.ts'
import { createRbnClient } from './client.ts'
import { createRbnTransport } from './transport.ts'

/** All network access stays on the SDK bridge; the sandbox has no global fetch. */
// Share a write queue with the Spots preferences: the host merges one settings
// group per write, so independent read/modify/write operations can lose fields.
let settingsWrite = Promise.resolve()
export function setRbnSettings(values: Parameters<typeof host.setSettings>[0]) {
  const pending = settingsWrite.then(() => host.setSettings(values))
  settingsWrite = pending.catch(() => {})
  return pending
}
const storage = createPersistentStorage(
  { getSettings: () => host.getSettings(), setSettings: setRbnSettings },
  manifest.key,
)
export const rbnFetch = createRbnTransport(
  (url, options) => host.fetch(url, options),
  Date.now,
  storage,
  host,
)
export const rbnEvidence = createEvidenceRetriever({ fetch: rbnFetch, storage, now: Date.now })
export const rbnRecorder = createReceptionRecorder(
  (request, result) => rbnEvidence.appendLive(request, result),
  () => host.log('RBN reception evidence could not be saved.'),
)
export const rbnClient = createRbnClient({
  fetch: rbnFetch,
  storage,
  timers: host,
  observeTimeLowerBound: rbnFetch.observeTimeLowerBound,
  prepareCollection: rbnRecorder.prepare,
})
