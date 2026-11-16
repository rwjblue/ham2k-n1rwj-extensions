import type { PanelScene } from '@ham2k/extension-sdk'
import { expect, it } from 'vitest'
import { environment } from '../../packages/reception/tests/environment.ts'
import { scenePreviewSvg } from '../../scripts/rbn-preview.ts'

it('reserves the native map rectangle in the portable SVG preview', () => {
  const env = environment(390, 740)
  const scene: PanelScene = {
    version: 1,
    width: env.width,
    height: env.height,
    values: {},
    layers: [],
    controls: [
      {
        id: 'reception-map',
        kind: 'map',
        label: 'Reception map',
        x: 12,
        y: 144,
        width: 366,
        height: 300,
        markers: [{ id: 'W1AW', lat: 41.7, lon: -72.7 }],
      },
    ],
  }
  const svg = scenePreviewSvg(scene, env)
  expect(svg).toContain('translate(12 144)')
  expect(svg).toContain('<rect width="366" height="300"/>')
  expect(svg).toContain('Reception map — native map placeholder')
  expect(svg).toContain('Map rendered by HaLo')
  expect(svg).not.toContain('W1AW')
  expect(scene.controls?.[0]).toMatchObject({
    markers: [{ id: 'W1AW', lat: 41.7, lon: -72.7 }],
  })
})
