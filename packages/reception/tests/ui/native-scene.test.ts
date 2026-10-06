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
  it('points to the visible native RBN Map choice when Both has no room for artwork', () => {
    const { scene } = renderReceptionScene(
      model,
      environment(390, 400),
      { view: 'both' },
      { nativeControls: true },
    )
    expect(scene.layers.some((layer) => layer.id === 'reception-map-0')).toBe(false)
    expect(scene.layers.find((layer) => layer.id === 'map-compact')?.text?.literal).toBe(
      'Choose Map above for a larger map.',
    )
    expect(scene.controls?.find((control) => control.id === 'view')?.options).toContainEqual({
      value: 'map',
      label: 'Map',
    })
    bounds(scene)
  })

  it.each([false, true])(
    'keeps the settings guidance when direct native View is unavailable (%s)',
    (nativeControls) => {
      const configuredModel = nativeControls
        ? {
            ...model,
            presentation: { ...model.presentation, source: 'PSK Reporter', viewCycle: false },
          }
        : model
      const { scene } = renderReceptionScene(
        configuredModel,
        environment(390, 400),
        { view: 'both' },
        { nativeControls },
      )
      expect(scene.layers.some((layer) => layer.id === 'reception-map-0')).toBe(false)
      expect(scene.layers.find((layer) => layer.id === 'map-compact')?.text?.literal).toBe(
        'Choose Map in panel settings for a larger map.',
      )
      expect(scene.controls?.some((control) => control.id === 'view' && control.options)).toBe(
        false,
      )
      bounds(scene)
    },
  )

  it('binds filters, sort, and direct views to named strings and extension events', () => {
    const { scene } = renderReceptionScene(
      model,
      environment(),
      { view: 'list' },
      { nativeControls: true },
    )
    expect(scene.strings).toEqual({ band: 'all', window: '15', view: 'list', sort: 'age' })
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
      kind: 'nativeButton',
      label: 'Refresh',
      event: 'refresh:reports',
      variant: 'text',
    })
    expect(scene.controls?.find((control) => control.id === 'details')).toMatchObject({
      kind: 'nativeButton',
      label: 'Details',
      event: 'details:toggle',
      variant: 'text',
    })
    expect(
      scene.layers.some((layer) => /^(refresh|details)-(background|label)$/.test(layer.id)),
    ).toBe(false)
    bounds(scene)
  })

  it('offers the source report windows as temporary named string choices', () => {
    const first = renderReceptionScene(
      { ...model, defaultWindowMinutes: 30 },
      environment(320, 900),
      { view: 'map' },
      { nativeControls: true },
    )
    expect(first.selection.windowMinutes).toBe(30)
    expect(first.scene.controls?.find((control) => control.id === 'window')).toMatchObject({
      kind: 'nativeDropdown',
      label: 'Window',
      value: 'window',
      event: 'window:set',
      options: [1, 3, 5, 10, 15, 30, 45, 60].map((minutes) => ({
        value: String(minutes),
        label: `${minutes} min`,
      })),
    })
    expect(first.scene.strings?.window).toBe('30')
    const changed = renderReceptionScene(
      { ...model, defaultWindowMinutes: 30 },
      environment(320, 900),
      { view: 'map', windowMinutes: 5 },
      { nativeControls: true },
    )
    expect(changed.selection.windowMinutes).toBe(5)
    expect(changed.scene.strings?.window).toBe('5')
    expect(
      renderReceptionScene(model, environment(), { windowMinutes: 2 }).selection.windowMinutes,
    ).toBe(15)
    bounds(first.scene)
    bounds(changed.scene)
  })

  it.each([320, 390, 430])(
    'keeps Band and Window beside each other at %ipx with normal text',
    (width) => {
      const { scene } = renderReceptionScene(
        model,
        environment(width, 900),
        { view: 'map' },
        { nativeControls: true },
      )
      const band = scene.controls?.find((control) => control.id === 'band')
      const window = scene.controls?.find((control) => control.id === 'window')
      const refresh = scene.controls?.find((control) => control.id === 'refresh')
      const details = scene.controls?.find((control) => control.id === 'details')
      expect(window?.y).toBe(band?.y)
      expect(details?.y).toBe(refresh?.y)
      expect(refresh?.y).toBe(8)
      // Before native actions/window, the mobile RBN map began at y=201.
      // The extra 4px reserves Material's action height; no toolbar row is added.
      expect(scene.layers.find((layer) => layer.id === 'reception-map-0')).toMatchObject({
        x: 12,
        y: 205,
        width: width - 24,
        height: 659,
      })
      bounds(scene)
    },
  )

  it('moves meaningful action captions below metadata for large text without double scaling', () => {
    const { scene } = renderReceptionScene(
      model,
      environment(320, 900, 2),
      { view: 'map' },
      { nativeControls: true },
    )
    const status = scene.layers.find((layer) => layer.id === 'status')
    const summary = scene.layers.find((layer) => layer.id === 'summary')
    const refresh = scene.controls?.find((control) => control.id === 'refresh')
    const details = scene.controls?.find((control) => control.id === 'details')
    const band = scene.controls?.find((control) => control.id === 'band')
    const window = scene.controls?.find((control) => control.id === 'window')
    if (!summary || !refresh || !details || !band || !window)
      throw new Error('Missing responsive native header')
    assertFixedSceneRect(summary)
    assertFixedSceneRect(refresh)
    assertFixedSceneRect(details)
    assertFixedSceneRect(band)
    assertFixedSceneRect(window)
    expect(status?.text?.size).toBe(13)
    expect(refresh.y).toBeGreaterThanOrEqual(summary.y + summary.height + 6)
    expect(details.y).toBe(refresh.y)
    expect(refresh.width).toBeGreaterThanOrEqual(140)
    expect(details.width).toBeGreaterThanOrEqual(140)
    expect(band.y).toBeGreaterThanOrEqual(refresh.y + refresh.height + 6)
    expect(window.y).toBeGreaterThanOrEqual(band.y + band.height + 8)
    expect(refresh.label).toBe('Refresh')
    expect(details.label).toBe('Details')
    // At 2x text this reserves an additional header row and separate fields.
    // The map remains useful rather than hiding any native control caption.
    expect(scene.layers.find((layer) => layer.id === 'reception-map-0')).toMatchObject({
      y: 610,
      width: 296,
      height: 238,
    })
    bounds(scene)
  })

  it.each([
    [390, 844, 1.6, 383, 416],
    [430, 900, 2, 456, 392],
  ])(
    'reserves readable toolbar space and map bounds at %ix%i with text scale %i',
    (width, height, scale, mapY, mapHeight) => {
      const { scene } = renderReceptionScene(
        model,
        environment(width, height, scale),
        { view: 'map' },
        { nativeControls: true },
      )
      expect(scene.layers.find((layer) => layer.id === 'reception-map-0')).toMatchObject({
        y: mapY,
        width: width - 24,
        height: mapHeight,
      })
      for (const id of ['refresh', 'details', 'band', 'window', 'view'])
        expect(scene.controls?.some((control) => control.id === id)).toBe(true)
      bounds(scene)
    },
  )

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
    expect(scene.strings?.window).toBe('15')
    expect(
      scene.controls
        ?.find((control) => control.id === 'sort')
        ?.options?.map((option) => option.value),
    ).not.toContain('wpm')
  })

  it.each([320, 390, 430])('retains the PSK saved view and a single field row at %ipx', (width) => {
    const { scene, selection } = renderReceptionScene(
      {
        ...model,
        defaultView: 'map',
        defaultWindowMinutes: 45,
        presentation: {
          ...model.presentation,
          source: 'PSK Reporter',
          stationLabel: 'Transmitter',
          viewCycle: false,
          cwSpeed: false,
        },
      },
      environment(width, 900),
      {},
      { nativeControls: true },
    )
    expect(selection.view).toBe('map')
    expect(scene.strings?.window).toBe('45')
    expect(scene.controls?.some((control) => control.id === 'view')).toBe(false)
    expect(scene.controls?.find((control) => control.id === 'window')?.y).toBe(
      scene.controls?.find((control) => control.id === 'band')?.y,
    )
    // PSK has no temporary View row. Its baseline map was y=145, height=719.
    expect(scene.layers.find((layer) => layer.id === 'reception-map-0')).toMatchObject({
      y: 149,
      width: width - 24,
      height: 715,
    })
    bounds(scene)
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
        expect(scene.controls?.find((control) => control.id === 'details')).toMatchObject({
          kind: 'nativeButton',
          label: 'Back',
          event: 'details:toggle',
        })
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
