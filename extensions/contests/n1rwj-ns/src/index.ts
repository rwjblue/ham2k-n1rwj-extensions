import { defineExtension } from '@ham2k/extension-sdk'
import { createHistoryData } from '../../../../packages/mini-contest/src/data.ts'
import manifest from '../manifest.json'
import { config } from './config.ts'
import { createNsHooks } from './hooks.ts'

const data = createHistoryData(config, manifest)
const hooks = createNsHooks(data.current)
defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { hook: hooks.activity })
    registerHook('ref:ns', { hook: hooks.refHandler })
    registerHook('adifFields', { hook: hooks.adifFields })
    registerHook('export', { hook: hooks.exports })
    registerHook('scoring', { hook: hooks.scoring })
    registerHook('dataFile', { key: data.dataFile.key, hook: data.dataFile })
    registerHook('panel', { hook: hooks.panel })
  },
})
