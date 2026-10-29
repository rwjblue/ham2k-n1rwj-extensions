// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { defineExtension } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createActivity } from './activity.ts'
import { createExports } from './exports.ts'
import { createZombieLookup } from './lookup.ts'
import { TYPE } from './model.ts'
import { createZombiePanel } from './panel.ts'
import { createScoringHook } from './scorer.ts'
import { createZombieSettings } from './settings.ts'

export function createZombieHooks() {
  const { activity, refHandler, history } = createActivity(manifest)
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
    panel: createZombiePanel(),
    lookup: createZombieLookup(history),
    ...createExports(manifest),
    settings: createZombieSettings(manifest),
  }
}

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const hooks = createZombieHooks()
    registerHook('activity', { key: manifest.key, hook: hooks.activity })
    registerHook(`ref:${TYPE}`, { key: manifest.key, hook: hooks.refHandler })
    registerHook('scoring', { key: TYPE, hook: hooks.scoring })
    registerHook('panel', { key: manifest.key, hook: hooks.panel })
    registerHook('lookup', { key: manifest.key, hook: hooks.lookup })
    registerHook('adifFields', { key: manifest.key, hook: hooks.adifFields })
    registerHook('export', { key: manifest.key, hook: hooks.exports })
    registerHook('settingsPanel', { key: manifest.key, hook: hooks.settings })
  },
})
