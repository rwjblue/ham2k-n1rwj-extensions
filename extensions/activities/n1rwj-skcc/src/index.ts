import { defineExtension } from '@ham2k/extension-sdk'
import { callFilterCategory } from '../../../../packages/spot-filters/src/index.ts'
import manifest from '../manifest.json'
import { createActivity, SKCCRefHandler } from './activity.ts'
import { createAuditStore } from './audit-store.ts'
import { createAwardExports } from './award-exports.ts'
import { createChasing } from './chasing.ts'
import { createData } from './data.ts'
import { SKCCAdifFields, SKCCAdifImport, SKCCExports } from './exports.ts'
import { createLookup } from './lookup.ts'
import { createPanel } from './panel.ts'
import { createPreferences } from './preferences.ts'
import { createScoringHook } from './scorer.ts'
import { createSettings } from './settings.ts'
import { createSpotFilter } from './spot-filter.ts'

defineExtension({
  ...manifest,
  adifFieldsScope: 'always',
  onActivation({ registerHook }) {
    const data = createData()
    const preferences = createPreferences()
    const audit = createAuditStore()
    const getPreferences = async () => {
      await preferences.load()
      return preferences.get()
    }
    registerHook('dataFile', { key: data.dataFile.key, hook: data.dataFile })
    registerHook('activity', {
      key: manifest.key,
      hook: createActivity(data.getRoster, getPreferences),
    })
    registerHook('ref:skcc', { key: manifest.key, hook: SKCCRefHandler })
    registerHook('lookup', { key: manifest.key, hook: createLookup(data.getRoster) })
    registerHook(callFilterCategory, { key: manifest.key, hook: createSpotFilter(data.getRoster) })
    registerHook('scoring', { key: manifest.key, hook: createScoringHook() })
    registerHook('adifFields', { key: manifest.key, hook: SKCCAdifFields })
    registerHook('adifImport', { key: manifest.key, hook: SKCCAdifImport })
    registerHook('export', { key: manifest.key, hook: SKCCExports })
    registerHook('export', {
      key: `${manifest.key}_awards`,
      hook: createAwardExports(data.getRoster, preferences, audit),
    })
    registerHook('panel', {
      key: manifest.key,
      hook: createPanel(data.getRoster, preferences, audit),
    })
    registerHook('settingsPanel', {
      key: manifest.key,
      hook: createSettings(preferences, data.getRoster, audit),
    })
    // Native chasing owns its durable cross-log claims. A file import does not
    // assert that it contains complete history, so it never replaces our snapshot.
    for (const registration of createChasing(data.getRoster)) registerHook('chasing', registration)
  },
})
