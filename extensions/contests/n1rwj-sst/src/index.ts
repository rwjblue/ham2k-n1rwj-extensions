import type { KeyerSetsHook } from '@ham2k/extension-sdk'
import { defineExtension } from '@ham2k/extension-sdk'
import { createMiniContest } from '../../../../packages/mini-contest/src/index.ts'
import { callFilterCategory } from '../../../../packages/spot-filters/src/index.ts'
import keyerSet from '../assets/SST.h2kset.json'
import manifest from '../manifest.json'
import { config } from './config.ts'

const hooks = createMiniContest(config, manifest)
defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook(callFilterCategory, { hook: hooks.callFilter })
    registerHook('activity', { hook: hooks.activity })
    registerHook('ref:sst', { hook: hooks.refHandler })
    registerHook('adifFields', { hook: hooks.adifFields })
    registerHook('export', { hook: hooks.exports })
    registerHook('scoring', { hook: hooks.scoring })
    registerHook('dataFile', { key: hooks.dataFile.key, hook: hooks.dataFile })
    registerHook('keyerSets', {
      hook: {
        async getSets() {
          const { name, messages, labels } = keyerSet
          return [{ kind: 'cw', id: 'sst-cw', name, messages, labels }]
        },
      } satisfies KeyerSetsHook,
    })
  },
})
