import type { KeyerSetsHook } from '@ham2k/extension-sdk'
import { contestScorer, defineExtension } from '@ham2k/extension-sdk'
import { callFilterCategory } from '../../../../packages/spot-filters/src/index.ts'
import keyerSet from '../assets/CWT.h2kset.json'
import manifest from '../manifest.json'
import { AdifFieldsHook, CWTScorer, ExportHook, RefHandler } from './cwt/index.ts'
import { DataFile, fileCache } from './data/hooks.ts'
import { callFilter } from './data/spot-filter.ts'
import { createPrefill } from './integration/prefill.ts'

const prefill = createPrefill(fileCache)

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    registerHook('activity', { hook: prefill.activity })
    registerHook('ref:cwt', { hook: RefHandler })
    registerHook('adifFields', { hook: AdifFieldsHook })
    registerHook('export', { hook: ExportHook })
    registerHook('scoring', {
      hook: prefill.scoring(contestScorer(CWTScorer, { scope: { refTypes: ['cwt'] } })),
    })
    registerHook('lookup', { hook: prefill.lookup })
    registerHook('keyerSets', {
      hook: {
        async getSets() {
          const { name, messages, labels } = keyerSet
          return [{ kind: 'cw', id: 'cwt-cw', name, messages, labels }]
        },
      } satisfies KeyerSetsHook,
    })
    registerHook('dataFile', { key: DataFile.key, hook: DataFile })
    registerHook(callFilterCategory, { hook: callFilter })
  },
})
