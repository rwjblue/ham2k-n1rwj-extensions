import { defineExtension } from '@ham2k/extension-sdk'
import { callFilterCategory } from '../../../../packages/spot-filters/src/index.ts'
import manifest from '../manifest.json'
import { BigfootActivity, BigfootRefHandler } from './activity.ts'
import { BigfootLookup } from './annotations.ts'
import { BigfootAdifFields, BigfootExports } from './exports.ts'
import { BigfootPanel } from './panel.ts'
import { bigfootScoringHook } from './scorer.ts'
import { BigfootSpotFilter } from './spot-filter.ts'

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { key: manifest.key, hook: BigfootActivity })
    registerHook('ref:bigfoot', { hook: BigfootRefHandler })
    registerHook('panel', { key: manifest.key, hook: BigfootPanel })
    registerHook('scoring', { key: manifest.key, hook: bigfootScoringHook })
    // Prefer this operation's event marker in the compact call annotation.
    // Other lookup sources' detailed notes still accumulate in the host.
    registerHook('lookup', { key: manifest.key, priority: 110, hook: BigfootLookup })
    registerHook(callFilterCategory, { key: manifest.key, hook: BigfootSpotFilter })
    registerHook('export', { key: manifest.key, hook: BigfootExports })
    registerHook('adifFields', { key: manifest.key, hook: BigfootAdifFields })
  },
})
