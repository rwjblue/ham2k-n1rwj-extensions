import { defineExtension } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createActivity } from './activity.ts'
import { createCommands } from './commands.ts'
import { createExports } from './exports.ts'
import { Panel } from './panel.ts'
import { createRetirementStore } from './retirement.ts'
import { scoring } from './scoring.ts'

const retired = createRetirementStore()
const { activity, refHandler } = createActivity(retired)
const { exports, adifFields } = createExports(manifest)

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { key: manifest.key, hook: activity })
    registerHook('ref:randomgram', { key: manifest.key, hook: refHandler })
    registerHook('adifFields', { key: manifest.key, hook: adifFields })
    registerHook('export', { key: manifest.key, hook: exports })
    registerHook('scoring', { key: manifest.key, hook: scoring })
    registerHook('command', { key: manifest.key, hook: createCommands(retired) })
    registerHook('panel', { key: manifest.key, hook: Panel })
  },
})
