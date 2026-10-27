import { defineExtension } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createChasing } from './chasing.ts'
import { createData } from './data.ts'
import { createLookup } from './lookup.ts'
import { createPanel } from './panel.ts'

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const data = createData()
    registerHook('dataFile', { key: data.dataFile.key, hook: data.dataFile })
    registerHook('lookup', { key: manifest.key, hook: createLookup(data.getRoster), priority: -2 })
    registerHook('panel', { key: manifest.key, hook: createPanel(data.getRoster, data.error) })
    registerHook('chasing', { key: manifest.key, hook: createChasing(data.getRoster) })
  },
})
