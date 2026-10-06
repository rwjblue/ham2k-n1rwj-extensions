import type { PanelScene } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { renderReceptionScene } from '../../src/ui/scene.ts'
import type { UiModel } from '../../src/ui/types.ts'
import { environment } from '../environment.ts'
import { assertFixedSceneRect } from './fixed-scene-rect.ts'

const model: UiModel = {
  title: 'My Signal',
  watchCall: 'N1RWJ',
  status: 'Recent reports',
  presentation: {
    source: 'RBN via Vail ReRBN',
    stationLabel: 'Receiver',
    viewCycle: true,
    refreshLabel: 'Refresh reports (30-second minimum between requests)',
  },
  bands: ['all', '20m', '40m'],
  rows: [{ call: 'W1NT', band: '20m', mode: 'CW', age: '1 min ago', timeMs: 1000 }],
  mapOptions: {
    width: 520,
    height: 360,
    origin: { latitude: 41, longitude: -73, label: 'N1RWJ' },
    stations: [{ key: 'W1NT', label: 'W1NT', latitude: 43, longitude: -71, ageMinutes: 1 }],
    theme: {
      surface: '#ffffff',
      land: '#f1f5f7',
      text: '#172832',
      muted: '#526876',
      border: '#cbd8df',
      accent: '#086f63',
    },
  },
  warnings: ['Reports can be incomplete.'],
  details: {
    purpose: 'See where N1RWJ is heard.',
    facts: [],
    sections: [
      {
        title: 'Reading reports',
        paragraphs: [
          'Reports are observations, not contacts.',
          'Outline data: Natural Earth. Reports: Reverse Beacon Network via Vail ReRBN.',
        ],
      },
    ],
  },
}

function bounds(scene: PanelScene): void {
  expect(scene.layout).toBeUndefined()
  expect(scene.layers.length).toBeLessThanOrEqual(128)
  expect(scene.controls?.length ?? 0).toBeLessThanOrEqual(64)
  expect(
    scene.layers.reduce(
      (sum, layer) => sum + (layer.svg?.length ?? 0) + (layer.text?.literal?.length ?? 0),
      0,
    ),
  ).toBeLessThanOrEqual(1048576)
  for (const item of [...scene.layers, ...(scene.controls ?? [])]) {
    assertFixedSceneRect(item)
    expect(item.x, item.id).toBeGreaterThanOrEqual(0)
    expect(item.y, item.id).toBeGreaterThanOrEqual(0)
    expect(item.x + item.width, item.id).toBeLessThanOrEqual(scene.width + 0.01)
    expect(item.y + item.height, item.id).toBeLessThanOrEqual(scene.height + 0.01)
  }
  for (const [index, control] of (scene.controls ?? []).entries()) {
    assertFixedSceneRect(control)
    expect(control.width).toBeGreaterThanOrEqual(44)
    expect(control.height).toBeGreaterThanOrEqual(44)
    for (const other of (scene.controls ?? []).slice(index + 1)) {
      assertFixedSceneRect(other)
      expect(
        control.x + control.width <= other.x ||
          other.x + other.width <= control.x ||
          control.y + control.height <= other.y ||
          other.y + other.height <= control.y,
        `${control.id} overlaps ${other.id}`,
      ).toBe(true)
    }
    if (control.value) {
      expect(scene.values[control.value]).toBeUndefined()
      expect(control.options?.map((option) => option.value)).toContain(
        scene.strings?.[control.value],
      )
    }
  }
}

describe('native reception choices', () => {
  it('binds filters, sort, and direct views to named strings and extension events', () => {
    const { scene } = renderReceptionScene(
      model,
      environment(),
      { view: 'list' },
      { nativeControls: true },
    )
    expect(scene.strings).toEqual({ band: 'all', view: 'list', sort: 'age' })
    expect(scene.controls?.find((control) => control.id === 'band')).toMatchObject({
      kind: 'nativeDropdown',
      value: 'band',
      event: 'band:set',
      options: [
        { value: 'all', label: 'All bands' },
        { value: '20m', label: '20m' },
        { value: '40m', label: '40m' },
      ],
    })
    expect(scene.controls?.find((control) => control.id === 'view')).toMatchObject({
      kind: 'nativeSegmented',
      value: 'view',
      event: 'view:set',
      options: [
        { value: 'map', label: 'Map' },
        { value: 'list', label: 'Receivers' },
        { value: 'both', label: 'Both' },
      ],
    })
    expect(
      scene.controls
        ?.find((control) => control.id === 'sort')
        ?.options?.map((option) => option.value),
    ).toContain('wpm')
    expect(scene.controls?.find((control) => control.id === 'refresh')).toMatchObject({
      kind: 'button',
      label: model.presentation?.refreshLabel,
      event: 'refresh:reports',
    })
    bounds(scene)
  })

  it('wraps native choices and falls back to a dropdown when segments would crowd the artwork', () => {
    const wide = renderReceptionScene(
      model,
      environment(1366, 900),
      { view: 'map' },
      { nativeControls: true },
    ).scene
    const narrow = renderReceptionScene(
      model,
      environment(320, 900, 2),
      { view: 'map' },
      { nativeControls: true },
    ).scene
    const band = narrow.controls?.find((control) => control.id === 'band')
    const view = narrow.controls?.find((control) => control.id === 'view')
    if (!band || !view) throw new Error('Missing native toolbar')
    assertFixedSceneRect(band)
    assertFixedSceneRect(view)
    expect(view.kind).toBe('nativeDropdown')
    expect(view.y).toBeGreaterThanOrEqual(band.y + band.height + 8)
    expect(wide.controls?.find((control) => control.id === 'view')?.y).toBe(
      wide.controls?.find((control) => control.id === 'band')?.y,
    )
    const map = narrow.layers.find((layer) => layer.id === 'reception-map-0')
    expect(map?.y).toBeGreaterThanOrEqual(view.y + view.height + 8)
    expect(map?.width).toBe(296)
    expect(narrow.width).toBe(320)
    expect(narrow.layers.find((layer) => layer.id === 'status')?.text?.size).toBe(13)
    bounds(narrow)
  })

  it('keeps PSK view configuration and hides CW-only sort choices', () => {
    const psk = {
      ...model,
      presentation: {
        source: 'PSK Reporter',
        stationLabel: 'Transmitter' as const,
        cwSpeed: false,
      },
    }
    const { scene } = renderReceptionScene(
      psk,
      environment(),
      { view: 'list' },
      { nativeControls: true },
    )
    expect(scene.controls?.some((control) => control.id === 'view')).toBe(false)
    expect(scene.strings?.view).toBeUndefined()
    expect(
      scene.controls
        ?.find((control) => control.id === 'sort')
        ?.options?.map((option) => option.value),
    ).not.toContain('wpm')
  })

  it('keeps readable paginated provenance while replacing only the info tabs', () => {
    const text: string[] = []
    for (const detailsTab of ['status', 'about'] as const) {
      const first = renderReceptionScene(
        model,
        environment(320, 580, 1.6),
        { details: true, detailsTab },
        { nativeControls: true },
      )
      for (let page = 0; page < first.pageCount; page++) {
        const { scene } = renderReceptionScene(
          model,
          environment(320, 580, 1.6),
          { details: true, detailsTab, page },
          { nativeControls: true },
        )
        expect(scene.strings).toEqual({ detailsTab })
        expect(scene.controls?.find((control) => control.id === 'detailsTab')?.event).toBe(
          'detailsTab:set',
        )
        expect(scene.controls?.some((control) => control.kind === 'nativeText')).toBe(false)
        text.push(scene.layers.map((layer) => layer.text?.literal ?? '').join(' '))
        bounds(scene)
      }
    }
    expect(text.join(' ').replace(/\s+/g, ' ')).toContain('Natural Earth')
    expect(text.join(' ').replace(/\s+/g, ' ')).toContain('Reports are observations, not contacts.')
  })

  it.each([
    [320, 250, 1],
    [390, 844, 1.6],
    [600, 350, 2],
    [1366, 900, 2],
    [100, 80, 1],
  ])(
    'preserves concrete artwork/control bounds at %ix%i with text scale %i',
    (width, height, scale) => {
      for (const view of ['both', 'map', 'list'] as const) {
        const host = environment(width, height, scale)
        host.brightness = 'dark'
        host.highContrast = true
        host.reducedMotion = true
        const first = renderReceptionScene(model, host, { view }, { nativeControls: true })
        bounds(first.scene)
        expect(
          renderReceptionScene(
            model,
            { ...host, devicePixelRatio: 3 },
            { view },
            { nativeControls: true },
          ),
        ).toEqual(first)
        expect(first.scene.layers.some((layer) => layer.transitionMs || layer.pulse)).toBe(false)
      }
    },
  )
})
