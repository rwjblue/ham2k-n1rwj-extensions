import { defineExtension } from '@ham2k/extension-sdk'
import { createHistoryData } from '../../../../packages/mini-contest/src/data.ts'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import manifest from '../manifest.json'
import { config } from './config.ts'

const data = createHistoryData(config, manifest)
const hooks = createContestHooks(config, manifest, data.current)
defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { hook: hooks.activity })
    registerHook('ref:wrt', { hook: hooks.refHandler })
    registerHook('adifFields', { hook: hooks.adifFields })
    registerHook('export', { hook: hooks.exports })
    registerHook('scoring', { hook: hooks.scoring })
    registerHook('dataFile', {
      key: data.dataFile.key,
      hook: {
        ...data.dataFile,
        description:
          'Name and state/province or country prefix suggestions. Verify the exchange on the air.',
      },
    })
  },
})
