import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PanelContent, PanelEnvironment, PanelRenderArgs } from '@ham2k/extension-sdk'
import { createBigfootPanel } from '../extensions/activities/n1rwj-bigfoot/src/panel.ts'
import { huntPanelPreview } from '../extensions/activities/n1rwj-bigfoot/src/panel-preview.ts'
import type { Qson } from '../extensions/activities/n1rwj-bigfoot/src/rules.ts'
import { scenePreviewSvg } from './rbn-preview.ts'

export function bigfootPreviewEnvironment(
  width = 560,
  height = 660,
  reducedMotion = false,
): PanelEnvironment {
  const type = (fontSize: number, fontWeight = 400) => ({
    fontFamily: 'Roboto',
    fontFamilyFallback: [],
    fontSize,
    scaledFontSize: fontSize,
    fontWeight,
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
      surface: '#102E27',
      surfaceContainer: '#19382E',
      onSurface: '#F3E7C6',
      onSurfaceVariant: '#ABC2AE',
      accent: '#E8BC68',
      primary: '#E8BC68',
      onPrimary: '#15362D',
      secondary: '#ABC2AE',
      outline: '#4E6C50',
      outlineVariant: '#375746',
      error: '#FFB4AB',
      onError: '#690005',
    },
    typography: {
      body: type(14),
      label: type(12, 500),
      title: type(18, 700),
      display: type(34, 800),
      mono: { ...type(14), fontFamily: 'RobotoMono' },
    },
    locale: 'en',
    textDirection: 'ltr',
    devicePixelRatio: 1,
    reducedMotion,
    highContrast: false,
  }
}

export type BigfootPreviewFixture = {
  name: string
  content: PanelContent
  environment: PanelEnvironment
}

export async function bigfootPreviewFixtures(): Promise<BigfootPreviewFixture[]> {
  const fixtures: BigfootPreviewFixture[] = []
  const qso = (call: string, id = call, band = '20m', mode = 'CW'): Qson => ({
    uuid: id,
    their: { call },
    band,
    mode,
    startAtMillis: Date.UTC(2026, 9, 20, 1),
  })
  const seed = [qso('W7I'), qso('W7O'), qso('W7T')]
  async function scenario(
    name: string,
    initial: Qson[],
    addition: Qson[],
    environment = bigfootPreviewEnvironment(),
  ) {
    const panel = createBigfootPanel()
    let qsos = initial
    const ctx = { online: false, getQsos: async () => qsos }
    const args: PanelRenderArgs = {
      instanceId: name,
      panelKey: 'hunt',
      operation: { uuid: `preview-${name}`, refs: [{ type: 'bigfoot', ref: '2026' }] },
      config: {},
      reason: 'initial',
      qsoCount: qsos.length,
      environment,
      clock: { nowMillis: 1_000_000, realNowMillis: 1_000_000 },
    }
    const first = await panel.render(args, ctx)
    if (name === 'idle' || name === 'narrow' || name === 'compact')
      fixtures.push({ name, content: first, environment })
    qsos = [...initial, ...addition]
    const render = async (reason: string, now: number) =>
      panel.render(
        { ...args, reason, qsoCount: qsos.length, clock: { nowMillis: now, realNowMillis: now } },
        ctx,
      )
    if (name === 'greeting') {
      await panel.onEvent?.(
        { ...args, event: { action: 'wave', controlId: 'wave', phase: 'activate', sequence: 1 } },
        ctx,
      )
      fixtures.push({ name, content: await render('event', 1_000_100), environment })
    } else if (addition.length) {
      fixtures.push({ name, content: await render('qsoLogged', 1_001_000), environment })
      if (name === 'new-letter')
        for (let i = 1; i <= 4; i++)
          fixtures.push({
            name: `new-letter-${i}`,
            content: await render('tick', 1_001_000 + i * 1000),
            environment,
          })
    }
  }
  await scenario('idle', seed, [])
  await scenario('narrow', seed, [], bigfootPreviewEnvironment(320, 620))
  await scenario('compact', seed, [], bigfootPreviewEnvironment(480, 380))
  await scenario('tiny', seed, [qso('W7B')], bigfootPreviewEnvironment(280, 300))
  await scenario('new-letter', seed, [qso('W7B')])
  await scenario('second-o', [qso('W7O')], [qso('W7O', 'o-two', '40m')])
  await scenario('mixed-o', [qso('W7O')], [qso('W7O', 'phone-o', '20m', 'SSB')])
  await scenario('bonus', seed, [qso('W4S')])
  await scenario(
    'complete',
    ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7O'].map((call, i) =>
      qso(call, `sweep-${i}`, i === 5 ? '40m' : '20m'),
    ),
    [qso('W7T')],
  )
  await scenario('reduced-motion', seed, [qso('W7B')], bigfootPreviewEnvironment(560, 660, true))
  await scenario('greeting', seed, [])
  return fixtures
}

/** Synthetic documents only. This never reaches the user's logger or radio. */
export async function previewBigfoot(output: string, fixtureFile?: string) {
  const fixtures = await bigfootPreviewFixtures()
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BIGFOOT forest · synthetic scene preview</title><style>body{margin:0;background:#081e19;color:#f3e7c6;font:15px system-ui;padding:28px}h1{font-size:25px}p{color:#abc2ae;max-width:760px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button{background:#294d3a;border:1px solid #4f7052;border-radius:20px;color:#f3e7c6;padding:9px 14px;cursor:pointer}button[aria-pressed=true]{background:#e8bc68;color:#15362d}#scene{max-width:100%;width:560px}#scene svg{max-width:100%;height:auto;display:block}#scene text{font-family:system-ui,sans-serif}</style><h1>BIGFOOT Hunt · the forest trail</h1><p>Synthetic preview generated from the extension's actual scene documents. Browser text approximates native rendering. Choose a state or play the new-letter poses; Flutter runs the native transitions.</p><nav>${fixtures.map((fixture, i) => `<button data-index="${i}" aria-pressed="${i === 0}">${fixture.name}</button>`).join('')}<button id="play">Play letter celebration</button></nav><main id="scene"></main><script>const scenes=${JSON.stringify(fixtures.map(({ content, environment }) => (content.kind === 'svgScene' ? scenePreviewSvg(content.scene, environment, 'BIGFOOT') : ''))).replace(/</g, '\\u003c')};const holder=document.getElementById('scene');let timer;function show(i){holder.innerHTML=scenes[i];document.querySelectorAll('[data-index]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.index)===i)))}document.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>{clearInterval(timer);show(Number(b.dataset.index))});document.getElementById('play').onclick=()=>{clearInterval(timer);const start=${fixtures.findIndex((fixture) => fixture.name === 'new-letter')};let i=0;show(start);timer=setInterval(()=>{show(start+(++i));if(i===4)clearInterval(timer)},1000)};show(0)</script></html>`
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(output, html)
  await writeFile(`${output.replace(/\.html$/, '')}.json`, JSON.stringify({ fixtures }, null, 2))
  await writeFile(`${output.replace(/\.html$/, '')}-panel.svg`, huntPanelPreview)
  if (fixtureFile) await writeFile(fixtureFile, JSON.stringify({ fixtures }, null, 2))
  console.log(`BIGFOOT preview: ${resolve(output)} (${fixtures.length} synthetic states)`)
}
