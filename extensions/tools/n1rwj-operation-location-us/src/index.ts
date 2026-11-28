// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT

import type { DataFileDefinition } from '@ham2k/extension-sdk'
import { defineExtension, host } from '@ham2k/extension-sdk'

import manifest from '../manifest.json' with { type: 'json' }
import type { RegisterOperationLocation } from './operation-location.ts'
import { createResolver } from './resolve.ts'

const dataFile: DataFileDefinition = {
  key: manifest.key,
  category: manifest.key,
  name: 'U.S. state and county boundaries',
  description: "Boundaries for filling a new operation's state and county from its GPS fix",
  url: 'https://raw.githubusercontent.com/rwjblue/ham2k-n1rwj-extensions/main/data/us-operation-location/operation-location-us.ndjson',
  maxAgeInDays: 365,
  fetchType: 'ham2k',
  fields: { key: 'key' },
}

const resolve = createResolver(
  async (key) => (await host.dbLookupSelectOne(manifest.key, key))?.data,
)

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('dataFile', { key: manifest.key, hook: dataFile })
    const registerLocation = registerHook as typeof registerHook & RegisterOperationLocation
    registerLocation('operationLocation', { key: manifest.key, hook: { resolve } })
  },
})
