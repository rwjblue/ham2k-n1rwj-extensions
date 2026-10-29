// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { DynamicSettingsPanel } from '@ham2k/extension-sdk'
import { zombieAboutDefinition } from './about.ts'

export function createZombieSettings(manifest: {
  key: string
  icon: string
}): DynamicSettingsPanel {
  return {
    kind: 'dynamic',
    async getPanels() {
      return [
        {
          key: manifest.key,
          title: 'Zombie Shuffle',
          icon: manifest.icon,
          section: 'activities',
          sidebar: false,
        },
      ]
    },
    async getDefinition() {
      return zombieAboutDefinition()
    },
    async onChangeField() {
      // The event guide has no editable global settings.
    },
  }
}
