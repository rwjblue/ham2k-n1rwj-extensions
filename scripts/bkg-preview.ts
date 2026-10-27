import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PanelContent, PanelEnvironment, PanelRenderArgs } from '@ham2k/extension-sdk'
import { createPanel } from '../extensions/activities/n1rwj-bkg/src/panel.ts'
import { parseRoster } from '../extensions/activities/n1rwj-bkg/src/roster.ts'
import { scenePreviewSvg } from './rbn-preview.ts'

export function bkgEnvironment(width = 380, height = 650): PanelEnvironment {
  const type = (fontSize: number) => ({
    fontFamily: 'monospace',
    fontFamilyFallback: [],
    fontSize,
    scaledFontSize: fontSize,
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: 0,
  })
  return {
    version: 1,
    width,
    height,
    safeInsets: { left: 0, top: 0, right: 0, bottom: 0 },
    brightness: 'dark',
    colors: {
      surface: '#0B0906',
      surfaceContainer: '#16120C',
      onSurface: '#EFE6CF',
      onSurfaceVariant: '#B3A88D',
      accent: '#D4AF37',
      primary: '#D4AF37',
      onPrimary: '#0B0906',
      secondary: '#FFD700',
      outline: '#3A2F1B',
      outlineVariant: '#3A2F1B',
      error: '#FFB4AB',
      onError: '#690005',
    },
    typography: {
      body: type(14),
      label: type(12),
      title: type(18),
      display: type(32),
      mono: type(14),
    },
    locale: 'en',
    textDirection: 'ltr',
    devicePixelRatio: 1,
    reducedMotion: false,
    highContrast: false,
  }
}
export async function bkgPreviewFixtures(): Promise<
  { name: string; content: PanelContent; environment: PanelEnvironment }[]
> {
  const at = Date.UTC(2026, 9, 29, 14)
  const roster = parseRoster(
    JSON.stringify({
      schema_version: '2',
      generated_at: new Date(at).toISOString(),
      content_hash: `sha256:${'0'.repeat(64)}`,
      members: [
        {
          bkg_number: 1,
          callsign: 'N0AAA',
          name: 'Alex · synthetic preview',
          qth: 'Utah',
          sponsor_bkg_number: null,
        },
        {
          bkg_number: 256,
          callsign: 'N0BBB',
          name: 'Blair · synthetic preview',
          qth: 'Rhode Island',
          sponsor_bkg_number: 1,
        },
        {
          bkg_number: 257,
          callsign: 'N0CCC',
          name: 'Charlie · synthetic preview',
          qth: 'Ontario',
          sponsor_bkg_number: 256,
        },
      ],
    }),
    at,
  )
  const fixtures = []
  for (const [name, width, height, call, operation, available] of [
    ['home-member', 380, 650, 'N0BBB', false, true],
    ['operation-member', 560, 700, 'N0BBB', true, true],
    ['home-prospective', 380, 650, 'W9HUNT', false, true],
    ['operation-narrow', 280, 580, 'W9HUNT', true, true],
    ['compact', 420, 350, 'N0BBB', true, true],
    ['roster-unavailable', 380, 650, 'W9HUNT', false, false],
  ] as const) {
    const environment = bkgEnvironment(width, height)
    const panel = createPanel(
      () => (available ? roster : undefined),
      undefined,
      async () => call,
    )
    const args: PanelRenderArgs = {
      panelKey: 'gang',
      operation: operation ? { uuid: 'synthetic-operation', operatorCall: call } : {},
      qsoCount: 1,
      qso: operation ? { their: { call: 'N0AAA' } } : undefined,
      config: {},
      reason: 'initial',
      environment,
      clock: { nowMillis: at, realNowMillis: at },
    }
    const content = await panel.render(args, {
      online: false,
      getQsos: async () => [
        {
          uuid: 'synthetic-contact',
          their: { call: 'N0AAA' },
          our: { call },
          band: '2m',
          mode: 'CW',
        },
      ],
      getSpots: async () => [
        {
          their: { call: 'N0AAA' },
          band: '2m',
          mode: 'CW',
          spot: { timeInMillis: at - 60_000, source: 'synthetic' },
        },
        {
          their: { call: 'N0CCC' },
          band: '40m',
          mode: 'CW',
          spot: { timeInMillis: at - 120_000, source: 'synthetic' },
        },
      ],
    })
    fixtures.push({ name, content, environment })
  }
  return fixtures
}
export async function previewBkg(output: string) {
  const path = resolve(output)
  await mkdir(dirname(path), { recursive: true })
  const fixtures = await bkgPreviewFixtures()
  const figures = []
  for (const { name, content, environment } of fixtures) {
    if (content.kind !== 'scene') throw new Error(`Expected scene for ${name}`)
    const svg = scenePreviewSvg(content.scene, environment, 'BKG')
    await writeFile(path.replace(/\.html$/, `-${name}.svg`), svg)
    // Separate documents preserve each native layer's SVG ID namespace.
    // Inline copies otherwise share clip-path IDs across preview fixtures.
    figures.push(
      `<figure><figcaption>${name} · ${environment.width} × ${environment.height}</figcaption><img alt="${name} static BKG preview" width="${environment.width}" height="${environment.height + 42}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></figure>`,
    )
  }
  await writeFile(
    path,
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>BKG panel previews</title><style>body{margin:24px;background:#080706;color:#efe6cf;font:14px monospace}main{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}figure{margin:0}figcaption{padding:10px 0;color:#d4af37}img{display:block;max-width:100%;height:auto}</style><h1>BKG Companion</h1><p>Synthetic static previews. Native UI and chase ranking are not tested here.</p><main>${figures.join('')}</main></html>`,
  )
  await writeFile(path.replace(/\.html$/, '.json'), `${JSON.stringify(fixtures, null, 2)}\n`)
  console.log(`BKG previews: ${path}`)
}
