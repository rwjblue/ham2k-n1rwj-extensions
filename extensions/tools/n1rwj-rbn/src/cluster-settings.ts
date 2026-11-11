export const liveClusterSettingKey = 'liveClusterUpdates'

export function liveClusterEnabled(settings: Record<string, unknown>): boolean {
  return settings[liveClusterSettingKey] !== false
}
