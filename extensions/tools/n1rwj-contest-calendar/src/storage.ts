import type { JSONValue } from '@ham2k/extension-sdk'

export interface CalendarSettingsHost {
  getSettings(): Promise<Record<string, JSONValue>>
  setSettings(values: Record<string, JSONValue>): Promise<void>
}

/** The host namespaces setSettings; kvGet/kvSet do not survive restarts. */
export function createCalendarStorage(host: CalendarSettingsHost, extensionKey: string) {
  let settings: Promise<Record<string, JSONValue>> | undefined
  let writing = Promise.resolve()

  function load() {
    settings ??= host
      .getSettings()
      .then((all) => {
        const extensions = all.extensions
        const group =
          extensions && typeof extensions === 'object' && !Array.isArray(extensions)
            ? extensions[`extension_${extensionKey}`]
            : undefined
        return group && typeof group === 'object' && !Array.isArray(group) ? { ...group } : {}
      })
      .catch((error: unknown) => {
        settings = undefined
        throw error
      })
    return settings
  }

  return {
    async get(key: string): Promise<JSONValue | null> {
      return (await load())[key] ?? null
    },
    set(key: string, value: unknown): Promise<void> {
      const pending = writing.then(async () => {
        const current = await load()
        const json = JSON.parse(JSON.stringify(value)) as JSONValue
        await host.setSettings({ [key]: json })
        current[key] = json
      })
      writing = pending.catch(() => {})
      return pending
    },
  }
}
