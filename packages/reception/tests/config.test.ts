import { describe, expect, it } from 'vitest'
import { readConfig, receptionConfigFields } from '../src/config.ts'

describe('reception report windows', () => {
  it.each([1, 3, 5, 10, 15, 30, 45, 60])('preserves a saved %i-minute window', (minutes) => {
    expect(readConfig({ windowMinutes: minutes }).windowMinutes).toBe(minutes)
    expect(readConfig({ windowMinutes: String(minutes) }).windowMinutes).toBe(minutes)
  })

  it('keeps the 15-minute default for missing or unsupported values', () => {
    expect(readConfig().windowMinutes).toBe(15)
    for (const windowMinutes of [0, -1, 2, 1.5, 61, 'invalid', null]) {
      expect(readConfig({ windowMinutes }).windowMinutes).toBe(15)
    }
  })

  it.each([
    ['Receiver', true],
    ['Station', false],
  ] as const)('offers all windows for %s panels', (stationLabel, cwSpeed) => {
    expect(
      receptionConfigFields(stationLabel, cwSpeed).find(
        (field) => field.type === 'field' && field.key === 'windowMinutes',
      ),
    ).toMatchObject({
      fieldType: 'select',
      value: 15,
      options: [
        { label: 'Last 1 minute', value: 1 },
        { label: 'Last 3 minutes', value: 3 },
        { label: 'Last 5 minutes', value: 5 },
        { label: 'Last 10 minutes', value: 10 },
        { label: 'Last 15 minutes', value: 15 },
        { label: 'Last 30 minutes', value: 30 },
        { label: 'Last 45 minutes', value: 45 },
        { label: 'Last 60 minutes', value: 60 },
      ],
    })
  })
})
