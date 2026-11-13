// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type DynamicSettingsPanel, defineExtension, host } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createLotwTransferHook } from './lotw/transfer.ts'

const settings = {
  kind: 'dynamic',
  async getPanels() {
    return [
      {
        key: manifest.key,
        title: 'LoTW Uploads',
        icon: 'cloud-upload-outline',
        section: 'exports',
        sidebar: false,
      },
    ]
  },
  async getDefinition() {
    return {
      elements: [
        { type: 'header', style: 'section', key: 'lotw', title: 'LoTW' },
        { type: 'action', key: 'about', label: 'About LoTW Uploads', method: 'showAbout' },
      ],
    }
  },
  async onChangeField() {},
  async showAbout() {
    await host.showMessage({
      presentation: 'dialog',
      title: 'About LoTW Uploads',
      text: 'LoTW uploads are still being developed and are unavailable in this build. The planned upload appears in an operation’s Exports panel and records upload history with each contact.',
    })
  },
} satisfies DynamicSettingsPanel & { showAbout(): Promise<void> }

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('settingsPanel', { hook: settings })
    registerHook('transfer', {
      hook: createLotwTransferHook({
        async connect() {
          // Certificate import, secure entropy, and binary HTTP do not have
          // supported host adapters yet. Refuse setup before any signing or
          // network access; ordinary settings must never hold a private key.
          throw new Error(
            'LoTW upload is unavailable in this build. Certificate setup is not ready.',
          )
        },
      }),
    })
  },
})
