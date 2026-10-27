import { expect, it } from 'vitest'
import { bkgEnvironment, bkgPreviewFixtures } from '../../../../scripts/bkg-preview.ts'
import { createPanel } from '../src/panel.ts'
import { args, roster } from './fixtures.ts'

it('renders branded scenes in both contexts with all layers inside their panes', async () => {
  const fixtures = await bkgPreviewFixtures()
  expect(fixtures).toHaveLength(6)
  for (const { content, environment, name } of fixtures) {
    expect(content.kind, name).toBe('scene')
    if (content.kind !== 'scene') continue
    expect(content.scene.layers.length).toBeLessThan(128)
    expect(new Set(content.scene.layers.map((layer) => layer.id)).size).toBe(
      content.scene.layers.length,
    )
    expect(content.scene.layers.some((layer) => layer.id === 'fist')).toBe(true)
    for (const layer of content.scene.layers) {
      expect(layer.x, `${name}/${layer.id}`).toBeGreaterThanOrEqual(0)
      expect(layer.y, `${name}/${layer.id}`).toBeGreaterThanOrEqual(0)
      expect(layer.x + layer.width, `${name}/${layer.id}`).toBeLessThanOrEqual(
        environment.width + 0.01,
      )
      expect(layer.y + layer.height, `${name}/${layer.id}`).toBeLessThanOrEqual(
        environment.height + 0.01,
      )
    }
  }
})
it('uses accessible Markdown on very small, high-contrast and enlarged-text panes', async () => {
  for (const environment of [
    bkgEnvironment(160, 180),
    { ...bkgEnvironment(), highContrast: true },
    {
      ...bkgEnvironment(),
      typography: {
        ...bkgEnvironment().typography,
        body: { ...bkgEnvironment().typography.body, scaledFontSize: 28 },
      },
    },
  ]) {
    const result = await createPanel(roster, undefined, async () => 'W9HUNT').render(
      args({ environment }),
      { online: false },
    )
    expect(result.kind).toBe('markdown')
  }
})
