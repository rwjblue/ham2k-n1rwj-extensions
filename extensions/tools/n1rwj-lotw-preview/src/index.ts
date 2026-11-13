// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type DynamicSettingsPanel, defineExtension, host } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createLotwRuntimeConnection } from './lotw/runtime.ts'
import { createLotwTransferHook } from './lotw/transfer.ts'

const settings = {
  kind: 'dynamic',
  async getPanels() {
    return [
      {
        key: manifest.key,
        title: 'LoTW Upload Preview',
        icon: 'cloud-upload-outline',
        section: 'exports',
        sidebar: false,
      },
    ]
  },
  async getDefinition() {
    return {
      elements: [
        { type: 'action', key: 'about', label: 'About LoTW Upload Preview', method: 'showAbout' },
      ],
    }
  },
  async onChangeField() {},
  async showAbout() {
    await host.showMessage({
      presentation: 'dialog',
      title: 'About LoTW Upload Preview',
      text: 'Enable EXP PUSH. In Settings → Exports & Imports → Services, choose Logbook of the World, select the .p12 file you exported from TQSL, and select Test before saving. Use Exports → Push to Services to send unsent contacts for its callsign. Check processing in LoTW under Your Account → Your Activity → Result.',
    })
  },
} satisfies DynamicSettingsPanel & { showAbout(): Promise<void> }

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const connection = createLotwRuntimeConnection()
    registerHook('settingsPanel', { hook: settings })
    registerHook('account', { hook: connection.account })
    registerHook('transfer', { hook: createLotwTransferHook(connection) })
  },
})
