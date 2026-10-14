import type { PanelEnvironment, PanelRenderArgs, PanelScene } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'

import { exchangeScene, Panel } from '../src/panel.ts'

const txGroups = ['0O1ZI', 'ABCDE', '9Y8X7']

function args(patch: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    panelKey: 'exchange',
    operation: { refs: [{ type: 'randomgram', ref: '48', alphabet: 'alphanumeric', txGroups }] },
    qso: {
      our: { sent: '599' },
      refs: [{ type: 'randomgram', ourSerial: 1, theirGroup: '7WX8Z' }],
    },
    qsoCount: 0,
    config: {},
    reason: 'qso',
    ...patch,
  }
}

function layerText(scene: PanelScene, id: string): string | undefined {
  return scene.layers.find((layer) => layer.id === id)?.text?.literal
}

function environment(width: number, height: number, scale = 1): PanelEnvironment {
  const role = {
    fontFamily: 'Roboto',
    fontFamilyFallback: [],
    fontSize: 14,
    scaledFontSize: 14 * scale,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  return {
    version: 1,
    width,
    height,
    safeInsets: { left: 0, right: 0, top: 0, bottom: 0 },
    brightness: 'dark',
    colors: {
      surface: '#121212',
      surfaceContainer: '#202020',
      onSurface: '#ffffff',
      onSurfaceVariant: '#eeeeee',
      accent: '#ffffff',
      primary: '#ffffff',
      onPrimary: '#121212',
      secondary: '#ffffff',
      outline: '#eeeeee',
      outlineVariant: '#eeeeee',
      error: '#ffaaaa',
      onError: '#121212',
    },
    typography: {
      body: role,
      label: role,
      title: role,
      display: role,
      mono: { ...role, fontFamily: 'RobotoMono' },
    },
    locale: 'en',
    textDirection: 'ltr',
    devicePixelRatio: 3,
    reducedMotion: true,
    highContrast: false,
  }
}

describe('RandomGram operating panel', () => {
  it('exposes one stable panel and refreshes when the draft or operation changes', async () => {
    expect(await Panel.getPanels()).toMatchObject([
      { key: 'exchange', on: ['operation', 'qso', 'qsoLogged'] },
    ])
    const result = await Panel.render(args())
    expect(result.kind).toBe('svgScene')
    expect(result.triggers).toEqual(['operation', 'qso', 'qsoLogged'])
    expect(result.scene.controls).toBeUndefined()
  })

  it('shows literal selected and received groups with a separate RST and list position', () => {
    const scene = exchangeScene(args())
    expect(layerText(scene, 'tx-group')).toBe('0O1ZI')
    expect(layerText(scene, 'rx-group')).toBe('7WX8Z')
    expect(layerText(scene, 'rst')).toBe('RST 599')
    expect(layerText(scene, 'tx-details')).toBe('Item 1 / 3 · 2 after this')
    expect(scene.layers.find((layer) => layer.id === 'tx-group')?.text).toMatchObject({
      fontFamily: 'RobotoMono',
      fontWeight: 700,
    })
    const payload = JSON.stringify(scene)
    expect(payload).not.toContain('ABCDE')
    expect(payload).not.toContain('9Y8X7')
  })

  it('repeats the same projection without changing the draft or the issued list', () => {
    const input = args()
    const before = JSON.stringify(input)
    const first = exchangeScene(input)
    expect(exchangeScene(input)).toEqual(first)
    expect(JSON.stringify(input)).toBe(before)
    expect(first.values).toEqual({})
  })

  it('uses the saved literal when a past contact is reopened after list changes', () => {
    const scene = exchangeScene(
      args({
        qso: {
          our: { sent: '579', exchange: '0ZZ8O' },
          refs: [{ type: 'randomgram', ourSerial: 2 }],
        },
      }),
    )
    expect(layerText(scene, 'tx-group')).toBe('0ZZ8O')
    expect(layerText(scene, 'rst')).toBe('RST 579')
    expect(layerText(scene, 'tx-details')).toBe('Item 2 / 3 · 1 after this')
  })

  it('shows explicit sent corrections and preserves a cleared received group and RST', () => {
    const scene = exchangeScene(
      args({
        qso: {
          our: { sent: '', exchange: 'ABCDE' },
          their: { exchange: '7WX8Z' },
          refs: [{ type: 'randomgram', ourSerial: 1, ourGroup: '1Z0OI', theirGroup: '' }],
        },
      }),
    )
    expect(layerText(scene, 'tx-group')).toBe('1Z0OI')
    expect(layerText(scene, 'rst')).toBe('RST —')
    expect(layerText(scene, 'rx-group')).toBe('— — — — —')
  })

  it.each([
    [{ qso: {} }, 'Enter a callsign to select a group'],
    [{ operation: { refs: [{ type: 'randomgram' }] } }, 'Load your TX list in activity setup'],
    [{ qso: { refs: [{ type: 'randomgram', ourSerial: 4 }] } }, 'TX list exhausted'],
    [{ qso: { refs: [{ type: 'randomgram', ourSerial: 'nope' }] } }, 'TX group unavailable'],
    [{ operation: {} }, 'Add RandomGram to this operation'],
  ] satisfies [Partial<PanelRenderArgs>, string][])(
    'explains unavailable exchanges without displaying a stale group',
    (patch, status) => {
      const scene = exchangeScene(args(patch))
      expect(layerText(scene, 'tx-state')).toBe(status)
      expect(layerText(scene, 'tx-group')).toBeUndefined()
    },
  )

  it.each([1, 2])(
    'keeps the complete TX group within a narrow phone panel at text scale %s',
    (scale) => {
      const scene = exchangeScene(args({ environment: environment(248, 200, scale) }))
      const layer = scene.layers.find((layer) => layer.id === 'tx-group')
      if (!layer?.text || layer.text.size === undefined || layer.text.letterSpacing === undefined)
        throw new Error('Missing TX group typography')
      expect(layer.text?.literal).toBe('0O1ZI')
      // Roboto Mono advances each glyph by about 0.6em; use 0.7em
      // to leave room for full glyphs and the explicit character spacing.
      expect(5 * 0.7 * layer.text.size * scale + 4 * layer.text.letterSpacing).toBeLessThanOrEqual(
        layer.width,
      )
      expect(layer.x).toBeGreaterThanOrEqual(0)
      expect(layer.x + layer.width).toBeLessThanOrEqual(scene.width)
      expect(layer.y + layer.height).toBeLessThanOrEqual(scene.height)
      expect(scene.width).toBe(248)
    },
  )
})
