import type { SvgScene } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { wrapInfoText } from '../../src/ui/details.ts'
import { renderReceptionScene } from '../../src/ui/scene.ts'
import type { UiModel } from '../../src/ui/types.ts'
import { environment } from '../environment.ts'
import { assertFixedSceneRect } from './fixed-scene-rect.ts'

const model: UiModel = {
  title: 'PSK Reporter',
  watchCall: 'N1RWJ',
  status: 'Live reception',
  statusKind: 'live',
  generatedAt: '18:00:00 UTC',
  presentation: {
    source: 'PSK Reporter',
    stationLabel: 'Receiver',
    refreshLabel: 'Reload recent history',
  },
  details: {
    purpose: 'Receivers reporting N1RWJ.',
    facts: [
      { label: 'Window', value: 'Last 30 minutes' },
      { label: 'Live feed', value: 'Connected' },
    ],
    sections: [
      {
        title: 'Reading the map',
        paragraphs: ['Reports are observations, not confirmed contacts.'],
      },
    ],
  },
  rows: [
    { call: 'W1AW', band: '20m', mode: 'FT8', age: '2 min ago', timeMs: 200, distanceKm: 500 },
    { call: 'VE3EID', band: '40m', mode: 'FT8', age: '8 min ago', timeMs: 100, distanceKm: 200 },
  ],
}
const text = (scene: SvgScene) =>
  scene.layers.flatMap((layer) => layer.text?.literal ?? []).join(' ')

describe('report info layout', () => {
  it('wraps the source and callsign above the tabs at large text sizes', () => {
    const { scene } = renderReceptionScene(model, environment(320, 640, 1.5), { details: true })
    const identity = scene.layers.filter((layer) => layer.id.startsWith('summary'))
    expect(identity.length).toBeGreaterThan(1)
    expect(identity.map((layer) => layer.text?.literal).join(' ')).toBe('PSK Reporter · N1RWJ')
    const tabs = scene.controls?.find((control) => control.id === 'details-status')
    if (!tabs) throw new Error('Missing status tab')
    assertFixedSceneRect(tabs)
    const lastLine = identity[identity.length - 1]
    expect(tabs.y).toBeGreaterThanOrEqual(lastLine.y + lastLine.height)
  })
  it('shows scoped freshness rather than a newer report from a hidden band', () => {
    const { scene, pageCount } = renderReceptionScene(model, environment(390, 740), {
      details: true,
      band: '40m',
    })
    expect(pageCount).toBe(1)
    expect(text(scene)).toContain('Latest report · 40m')
    expect(text(scene)).toContain('8 min ago')
    expect(text(scene)).not.toContain('2 min ago')
    expect(text(scene)).toContain('1 receiver · 1 band · 200 km max')
    expect(scene.layers.some((layer) => layer.id === 'page-count')).toBe(false)
    const empty = renderReceptionScene(model, environment(390, 740), { details: true, band: '10m' })
    expect(text(empty.scene)).toContain('None in this view')
  })

  it('makes selected tabs and attention discoverable without relying on color', () => {
    const { scene } = renderReceptionScene(
      { ...model, warnings: ['History unavailable.'] },
      environment(390, 740),
      { details: true, detailsTab: 'about' },
    )
    expect(scene.controls).toContainEqual(
      expect.objectContaining({
        id: 'details-about',
        label: 'About, selected',
        event: 'details:about',
      }),
    )
    expect(scene.controls).toContainEqual(
      expect.objectContaining({
        id: 'details-status',
        label: 'Status (1)',
        event: 'details:status',
      }),
    )
    expect(text(scene)).toContain('Reading the map')
    expect(text(scene)).not.toContain('Latest report')
    expect(scene.layers.find((layer) => layer.id === 'details-about-background')?.svg).toContain(
      '<path',
    )
  })

  it('wraps long unbroken diagnostics without dropping a character', () => {
    const token = `https://example.invalid/${'W'.repeat(300)}`
    const lines = wrapInfoText(token, 220, environment().typography.body)
    expect(lines.length).toBeGreaterThan(10)
    expect(lines.join('')).toBe(token)
    expect(lines.every((line) => line.length <= 26)).toBe(true)
  })

  it.each([
    [320, 580, 1],
    [390, 740, 1],
    [900, 640, 1],
    [390, 740, 1.8],
    [477, 8192, 1],
    [320, 280, 1],
  ])(
    'preserves every diagnostic within native limits at %sx%s, scale %s',
    (width, height, scale) => {
      const warnings = Array.from(
        { length: 70 },
        (_, index) => `Diagnostic ${index}: cached reports are available while history is loading.`,
      )
      const source = { ...model, warnings }
      for (const detailsTab of ['status', 'about'] as const) {
        const host = environment(width, height, scale)
        host.safeInsets = { top: 4, bottom: 6, left: 2, right: 3 }
        const initial = renderReceptionScene(source, host, { details: true, detailsTab })
        const shown: string[] = []
        for (let page = 0; page < initial.pageCount; page++) {
          const { scene } = renderReceptionScene(source, host, { details: true, detailsTab, page })
          shown.push(
            scene.layers
              .filter((layer) => /^info-\d+-\d+-\d+$/.test(layer.id))
              .flatMap((layer) => layer.text?.literal ?? [])
              .join(' '),
          )
          expect(scene.layers.length).toBeLessThanOrEqual(128)
          const items = [...scene.layers, ...(scene.controls ?? [])]
          for (const item of items) {
            assertFixedSceneRect(item)
            expect(item.x).toBeGreaterThanOrEqual(0)
            expect(item.y).toBeGreaterThanOrEqual(0)
            expect(item.x + item.width).toBeLessThanOrEqual(width)
            expect(item.y + item.height).toBeLessThanOrEqual(height)
          }
          const next = scene.controls?.find((control) => control.id === 'next')
          expect(Boolean(next)).toBe(page + 1 < initial.pageCount)
        }
        const all = shown.join(' ').replace(/\s+/g, ' ')
        if (detailsTab === 'status') {
          // Tiny panes can show the explicit enlargement state instead.
          if (all.includes('Enlarge this panel')) continue
          for (const warning of warnings) expect(all).toContain(warning)
          if (height >= 580) expect(initial.pageCount).toBeGreaterThan(1)
          expect(all).toContain('Receivers reporting N1RWJ.')
        } else expect(all).toContain('Reports are observations, not confirmed contacts.')
      }
    },
  )
})
