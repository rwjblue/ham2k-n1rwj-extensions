import type { DeviceLocation, JSONValue } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import type { Continent } from '../../src/data/continents.ts'
import { createRbnSpots } from '../../src/spots/index.ts'

const ctx = { online: true }
const panelKey = 'n1rwj-rbn'
function harness(saved: Record<string, JSONValue> = {}) {
  const preferences = { ...saved }
  let finishLocation: (value: DeviceLocation | null) => void = () => {}
  const pending = new Promise<DeviceLocation | null>((resolve) => {
    finishLocation = resolve
  })
  const getLocation = vi.fn(() => pending)
  const continentNear = vi.fn((_location: DeviceLocation): Continent | null => 'NA')
  const fetch = vi.fn(async () => ({ status: 200, body: '{"spots":[]}' }))
  const options = {
    fetch,
    getLocation,
    continentNear,
    lookup: () => undefined,
    getSettings: async () => ({ extensions: { 'extension_n1rwj-rbn': { ...preferences } } }),
    setSettings: async (values: Record<string, JSONValue>) => {
      Object.assign(preferences, values)
    },
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
  }
  const runtime = createRbnSpots(options)
  return {
    ...runtime,
    preferences,
    getLocation,
    continentNear,
    fetch,
    finishLocation,
    restart: () => createRbnSpots(options),
    definition: () => runtime.settings.getDefinition({ panelKey }, ctx),
    edit: (value: string[]) =>
      runtime.settings.onChangeField(
        { panelKey, fieldKey: 'spotContinents', value, state: {} },
        ctx,
      ),
  }
}

it('does not block hooks on GPS and persists a local default across restarts', async () => {
  const runtime = harness()
  await runtime.definition()
  expect(await runtime.spots.fetchSpots({}, ctx)).toEqual([])
  expect(runtime.fetch.mock.calls).toEqual([
    ['https://vailrerbn.com/api/v1/health', { timeout: 2000 }],
  ])
  expect(runtime.getLocation).toHaveBeenCalledTimes(1)
  runtime.finishLocation({ latitude: 42, longitude: -71 })
  await vi.waitFor(() => expect(runtime.preferences.spotContinents).toEqual(['NA']))
  expect(runtime.preferences.spotLastContinents).toEqual(['NA'])
  await runtime.restart().settings.getDefinition({ panelKey }, ctx)
  expect(runtime.getLocation).toHaveBeenCalledTimes(1)
  expect((await runtime.definition()).elements).toContainEqual(
    expect.objectContaining({ key: 'spotContinents', value: ['NA'] }),
  )
})

it('preserves an explicit continent or all-continents choice, including a race with GPS', async () => {
  for (const choice of [[], ['EU']]) {
    const runtime = harness()
    await runtime.definition()
    await runtime.edit(choice)
    runtime.finishLocation({ latitude: 42, longitude: -71 })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await runtime.restart().settings.getDefinition({ panelKey }, ctx)
    expect(runtime.preferences.spotContinents).toEqual(choice)
    expect(runtime.getLocation).toHaveBeenCalledTimes(1)
  }
  const saved = harness({ spotContinents: [] })
  await saved.definition()
  expect(saved.getLocation).not.toHaveBeenCalled()
})

it('falls back to the last selection when location is unavailable and remembers explicit changes', async () => {
  const runtime = harness({ spotLastContinents: ['NA'] })
  runtime.finishLocation(null)
  await runtime.definition()
  expect(runtime.preferences.spotContinents).toEqual(['NA'])
  await runtime.edit(['EU', 'EU'])
  await runtime.edit([])
  expect(runtime.preferences).toMatchObject({ spotContinents: [], spotLastContinents: ['EU'] })
})

it('retries inference when directory metadata arrives without requesting GPS again', async () => {
  const runtime = harness()
  runtime.continentNear.mockReturnValue(null)
  runtime.finishLocation({ latitude: 42, longitude: -71 })
  await runtime.definition()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(runtime.preferences.spotContinents).toBeUndefined()
  runtime.continentNear.mockReturnValue('NA')
  await runtime.spots.fetchSpots({}, ctx)
  expect(runtime.preferences.spotContinents).toEqual(['NA'])
  expect(runtime.getLocation).toHaveBeenCalledTimes(1)
})
