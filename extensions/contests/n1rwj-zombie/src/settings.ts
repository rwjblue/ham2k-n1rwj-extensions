// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import { type DynamicSettingsPanel, host } from '@ham2k/extension-sdk'
import { zombieAboutDefinition } from './about.ts'

export function createZombieSettings(
  manifest: { key: string; icon: string },
  deps: Pick<typeof host, 'showForm'> = host,
): DynamicSettingsPanel & { showAbout(): Promise<null> } {
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
      return {
        title: 'Zombie Shuffle',
        elements: [
          {
            type: 'action',
            style: 'row',
            key: 'about',
            label: 'About Zombie Shuffle',
            icon: 'information-outline',
            method: 'showAbout',
          },
        ],
      }
    },
    async onChangeField() {
      // The event guide has no editable global settings.
    },
    async showAbout() {
      await deps.showForm(zombieAboutDefinition())
      return null
    },
  } satisfies DynamicSettingsPanel & Record<string, unknown>
}
