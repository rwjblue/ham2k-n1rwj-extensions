import { defineExtension } from '@ham2k/extension-sdk'
import { createContestHooks } from '../../../../packages/mini-contest/src/index.ts'
import manifest from '../manifest.json'
import { config } from './config.ts'

const hooks = createContestHooks(config, manifest)
defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { hook: hooks.activity })
    registerHook('ref:wrt', { hook: hooks.refHandler })
    registerHook('adifFields', { hook: hooks.adifFields })
    registerHook('export', { hook: hooks.exports })
    registerHook('scoring', { hook: hooks.scoring })
  },
})
