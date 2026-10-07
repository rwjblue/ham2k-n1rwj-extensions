import type { PanelHook, PanelRenderArgs } from '@ham2k/extension-sdk'
import { defineExtension, host } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { createCalendarData } from './data.ts'
import { createCalendarPanel } from './panel.ts'
import { createCalendarStorage } from './storage.ts'

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const storage = createCalendarStorage(host, manifest.key)
    // Panel age/coverage warnings use real time; display status follows the app clock.
    let realNow = Date.now()
    function rememberClock(args: PanelRenderArgs) {
      realNow = args.clock?.realNowMillis ?? Date.now()
    }
    const data = createCalendarData(manifest.key, () => realNow)
    const panel = createCalendarPanel({
      readCalendar: data.readCalendar,
      stateHost: storage,
      now: Date.now,
      showForm: (form) => host.showForm(form),
    })
    const clockedPanel: PanelHook = {
      ...panel,
      render(args, context) {
        rememberClock(args)
        return panel.render(args, context)
      },
      onEvent(args, context) {
        rememberClock(args)
        return panel.onEvent?.(args, context) ?? Promise.resolve({ values: {} })
      },
    }
    registerHook('panel', {
      key: manifest.key,
      hook: clockedPanel,
    })
    registerHook('dataFile', { key: data.dataFile.key, hook: data.dataFile })
  },
})
