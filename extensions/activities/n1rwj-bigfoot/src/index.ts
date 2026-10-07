import { defineExtension } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { BigfootActivity, BigfootRefHandler } from './activity.ts'
import { BigfootAdifFields, BigfootExports } from './exports.ts'
import { BigfootPanel } from './panel.ts'
import { bigfootScoringHook } from './scorer.ts'

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { key: manifest.key, hook: BigfootActivity })
    registerHook('ref:bigfoot', { hook: BigfootRefHandler })
    registerHook('panel', { key: manifest.key, hook: BigfootPanel })
    registerHook('scoring', { key: manifest.key, hook: bigfootScoringHook })
    registerHook('export', { key: manifest.key, hook: BigfootExports })
    registerHook('adifFields', { key: manifest.key, hook: BigfootAdifFields })
  },
})
