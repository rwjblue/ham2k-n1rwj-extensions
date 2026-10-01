import type { JSONValue, SettingsField } from '@ham2k/extension-sdk'
import {
  type PanelConfig as ReceptionPanelConfig,
  readConfig as readReceptionConfig,
  receptionConfigFields,
} from '../../../../packages/reception/src/config.ts'

export interface PanelConfig extends ReceptionPanelConfig {
  minSnrDb: number | null
}

export {
  operationOrigin,
  receptionBands as rbnBands,
  watchedCall,
} from '../../../../packages/reception/src/config.ts'

export function readConfig(config: Record<string, JSONValue> = {}): PanelConfig {
  const raw = config.minSnrDb
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : null
  return {
    ...readReceptionConfig(config),
    minSnrDb: value !== null && Number.isFinite(value) ? value : null,
  }
}

export const configFields: SettingsField[] = receptionConfigFields().flatMap((field) => [
  field,
  ...(field.key === 'band'
    ? [
        {
          type: 'field' as const,
          fieldType: 'number' as const,
          key: 'minSnrDb',
          label: 'Minimum SNR (dB)',
          value: null,
          placeholder: 'No minimum',
          description:
            'Show only latest reports at or above this SNR on the map and list. Reports without SNR are hidden. Leave blank to show all reports.',
        },
      ]
    : []),
])
