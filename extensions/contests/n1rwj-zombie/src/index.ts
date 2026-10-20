// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { defineExtension } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createActivity } from './activity.ts'
import { createZombieData } from './data.ts'
import { createExports } from './exports.ts'
import { TYPE } from './model.ts'
import { createScoringHook } from './scorer.ts'

export function createZombieHooks() {
  const data = createZombieData()
  const { activity, refHandler, history } = createActivity(manifest, data.cache.current)
  const base = createScoringHook()
  const scoring = {
    ...base,
    async scoreQsos(...args: Parameters<typeof base.scoreQsos>): ReturnType<typeof base.scoreQsos> {
      history.update(args[0])
      return base.scoreQsos(...args)
    },
  }
  return {
    activity,
    refHandler,
    scoring,
    ...createExports(manifest),
    dataFile: data.dataFile,
    settings: data.settings,
  }
}

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const hooks = createZombieHooks()
    registerHook('activity', { key: manifest.key, hook: hooks.activity })
    registerHook(`ref:${TYPE}`, { key: manifest.key, hook: hooks.refHandler })
    registerHook('scoring', { key: TYPE, hook: hooks.scoring })
    registerHook('adifFields', { key: manifest.key, hook: hooks.adifFields })
    registerHook('export', { key: manifest.key, hook: hooks.exports })
    registerHook('dataFile', { key: hooks.dataFile.key, hook: hooks.dataFile })
    registerHook('settingsPanel', { key: manifest.key, hook: hooks.settings })
  },
})
