import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PanelContent, PanelEnvironment, PanelRenderArgs } from '@ham2k/extension-sdk'
import type { Qson } from '../extensions/contests/n1rwj-zombie/src/model.ts'
import { createZombiePanel } from '../extensions/contests/n1rwj-zombie/src/panel.ts'
import { zombiePanelPreview } from '../extensions/contests/n1rwj-zombie/src/panel-preview.ts'
import { scenePreviewSvg } from './rbn-preview.ts'

const EVENT_START = Date.UTC(2026, 9, 30, 19)
const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function zombiePreviewEnvironment(
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
      surface: '#211A35',
      surfaceContainer: '#342744',
      onSurface: '#F6EAD3',
      onSurfaceVariant: '#C6B8D8',
      accent: '#F2C46D',
      primary: '#B9D98D',
      onPrimary: '#283529',
      secondary: '#C6B8D8',
      outline: '#8F7896',
      outlineVariant: '#605075',
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

export type ZombiePreviewFixture = {
  name: string
  description: string
  content: PanelContent
  environment: PanelEnvironment
  nowMillis: number
  qsoCount: number
}

/** Every document comes through the real hook with a closed synthetic log.
 * There is deliberately no fetch, host, radio or user-data adapter here. */
export async function zombiePreviewFixtures(): Promise<ZombiePreviewFixture[]> {
  const fixtures: ZombiePreviewFixture[] = []
  const contact = (
    call: string,
    zombieName: string,
    zombieNumber: string,
    minute: number,
    band = '20m',
    id = `${call}-${band}-${minute}`,
    spc = 'MA',
  ): Qson => ({
    uuid: id,
    mode: 'CW',
    band,
    freq: band === '40m' ? 7030 : band === '15m' ? 21060 : band === '10m' ? 28060 : 14060,
    startAtMillis: EVENT_START + minute * MINUTE,
    our: {
      call: 'N1RWJ',
      sent: '579',
      zombie: { ref: '2026', spc: 'RI', zombieNumber: '00123', zombieName: 'COUNT ROB' },
    },
    their: { call, sent: '559' },
    refs: [
      {
        type: 'zombie',
        theirSpc: spc,
        theirZombieNumber: zombieNumber,
        theirZombieName: zombieName,
      },
    ],
  })
  const first = contact('K1ABC', 'OLD NICK', '0007', 10)
  const seed = [
    first,
    contact('K2BOO', 'RADIO GHOST', '0210', 25, '40m', 'ghost-40', 'NY'),
    contact('K3SPK', 'COUNT BYTE', '0888', 40, '15m', 'byte-15', 'PA'),
  ]
  type Scenario = {
    name: string
    description: string
    initial: Qson[]
    at: number
    addition?: Qson[]
    view?: 'scene' | 'watch' | 'book'
    environment?: PanelEnvironment
    from?: number
    poses?: boolean
  }
  async function scenario(input: Scenario) {
    const panel = createZombiePanel()
    const environment = input.environment ?? zombiePreviewEnvironment()
    let qsos = input.initial
    const ctx = { online: false, getQsos: async () => qsos }
    const args: PanelRenderArgs = {
      instanceId: input.name,
      panelKey: 'graveyard',
      operation: {
        uuid: `zombie-preview-${input.name}`,
        stationCall: 'N1RWJ',
        refs: [
          {
            type: 'zombie',
            ref: '2026',
            ourSpc: 'RI',
            ourZombieNumber: '00123',
            ourZombieName: 'COUNT ROB',
            utcOffset: '-04:00',
            flexibleHours: false,
          },
        ],
      },
      config: { view: input.view ?? 'scene', motion: true },
      reason: 'initial',
      qsoCount: qsos.length,
      environment,
      clock: {
        nowMillis: input.from ?? input.at - 1000,
        realNowMillis: input.from ?? input.at - 1000,
      },
    }
    await panel.render(args, ctx)
    qsos = [...input.initial, ...(input.addition ?? [])]
    const render = (now: number, reason: string) =>
      panel.render(
        {
          ...args,
          reason,
          qsoCount: qsos.length,
          clock: { nowMillis: now, realNowMillis: now },
        },
        ctx,
      )
    const content = await render(input.at, input.addition?.length ? 'qsoLogged' : 'tick')
    fixtures.push({
      name: input.name,
      description: input.description,
      content,
      environment,
      nowMillis: input.at,
      qsoCount: qsos.length,
    })
    if (input.poses) {
      for (let step = 1; step <= 4; step++) {
        const now = input.at + step * 1000
        fixtures.push({
          name: `${input.name}-${step}s`,
          description: `${input.description} Static pose ${step} second${step === 1 ? '' : 's'} later.`,
          content: await render(now, 'tick'),
          environment,
          nowMillis: now,
          qsoCount: qsos.length,
        })
      }
    }
  }
  await scenario({
    name: 'empty',
    description: 'An active, configured event with no logged contacts.',
    initial: [],
    at: EVENT_START + MINUTE,
  })
  await scenario({
    name: 'first-contact',
    description: 'The first complete QSO welcomes a visitor and starts a celebration.',
    initial: [],
    addition: [first],
    at: EVENT_START + 10 * MINUTE,
    poses: true,
  })
  await scenario({
    name: 'resting',
    description: 'Three visitors are resting. Each callsign and actual band has its own timer.',
    initial: seed,
    at: EVENT_START + HOUR,
  })
  await scenario({
    name: 'ready',
    description: 'The first visitor is eligible again; the other timers are still running.',
    initial: seed,
    at: EVENT_START + 2 * HOUR + 15 * MINUTE,
  })
  await scenario({
    name: 'exact-2h',
    description: 'The first timer crosses from resting to eligible at exactly two elapsed hours.',
    initial: seed,
    from: EVENT_START + 2 * HOUR + 10 * MINUTE - 1,
    at: EVENT_START + 2 * HOUR + 10 * MINUTE,
  })
  await scenario({
    name: 'bonus',
    description: 'A newly logged 4321 bonus contact brings out the sparkles.',
    initial: seed,
    addition: [contact('K4LUX', 'COUNT SPARK', '4321', 55, '20m', 'bonus-soul', 'VA')],
    at: EVENT_START + 55 * MINUTE,
  })
  await scenario({
    name: 'rebirth',
    description: 'A qualifying repeat on the same band earns another visit after two hours.',
    initial: seed,
    addition: [contact('K1ABC', 'OLD NICK', '0007', 130, '20m', 'nick-reborn')],
    at: EVENT_START + 130 * MINUTE,
  })
  await scenario({
    name: 'book',
    description: 'The actual Book of the Undead Markdown view, with complete copied exchanges.',
    initial: seed,
    view: 'book',
    at: EVENT_START + HOUR,
  })
  await scenario({
    name: 'watch',
    description: 'The detailed rebirth watch retains the full eligible-at times.',
    initial: seed,
    view: 'watch',
    at: EVENT_START + 2 * HOUR + 15 * MINUTE,
  })
  await scenario({
    name: 'narrow',
    description: 'Narrow 280 × 620 panel with three visitors and rebirth timers.',
    initial: seed,
    environment: zombiePreviewEnvironment(280, 620),
    at: EVENT_START + HOUR,
  })
  await scenario({
    name: 'compact',
    description: 'Short 480 × 380 panel with the same log and score.',
    initial: seed,
    environment: zombiePreviewEnvironment(480, 380),
    at: EVENT_START + HOUR,
  })
  await scenario({
    name: 'tiny',
    description: 'Minimum 280 × 300 panel with the same log and score.',
    initial: seed,
    environment: zombiePreviewEnvironment(280, 300),
    at: EVENT_START + HOUR,
  })
  await scenario({
    name: 'ended',
    description: 'Local midnight ends the event and clears the rebirth queue.',
    initial: seed,
    at: EVENT_START + 9 * HOUR,
  })
  await scenario({
    name: 'reduced-motion',
    description: 'A new bonus contact under the native reduced-motion preference.',
    initial: seed,
    addition: [contact('K4LUX', 'COUNT SPARK', '4321', 55, '20m', 'quiet-bonus', 'VA')],
    environment: zombiePreviewEnvironment(560, 660, true),
    at: EVENT_START + 55 * MINUTE,
  })
  return fixtures
}

function html(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A small, escaped Markdown approximation for the preview's two text views. */
function markdownPreview(value: string): string {
  const inline = (text: string) =>
    html(text)
      .replace(/\\([\\`*_{}[\]()#+.!|~-])/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
      )
  const blocks = value.split(/\n\s*\n/).map((block) => {
    const heading = /^(#{1,6}) (.*)$/.exec(block)
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`
    if (block.startsWith('|')) {
      const rows = block.split('\n').filter((row) => !/^\|\s*:?-{2,}/.test(row))
      return `<div class="table-scroll"><table>${rows
        .map(
          (row, index) =>
            `<tr>${row
              .split('|')
              .slice(1, -1)
              .map(
                (cell) =>
                  `<${index === 0 ? 'th' : 'td'}>${inline(cell.trim())}</${index === 0 ? 'th' : 'td'}>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</table></div>`
    }
    return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`
  })
  return `<article class="markdown-preview">${blocks.join('')}</article>`
}

export async function previewZombie(output: string, fixtureFile?: string) {
  const fixtures = await zombiePreviewFixtures()
  const previews = fixtures.map(({ content, environment }) => {
    if (content.kind === 'svgScene' || content.kind === 'scene')
      return scenePreviewSvg(content.scene, environment, 'Zombie Shuffle')
    if (content.kind === 'markdown') return markdownPreview(content.content)
    throw new Error(`Unexpected Zombie preview content: ${content.kind}`)
  })
  const payload = JSON.stringify(
    fixtures.map((fixture, index) => ({
      name: fixture.name,
      description: fixture.description,
      width: fixture.environment.width,
      height: fixture.environment.height,
      now: new Date(fixture.nowMillis).toISOString(),
      qsoCount: fixture.qsoCount,
      preview: previews[index],
    })),
  ).replace(/</g, '\\u003c')
  const document = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zombie Shuffle · synthetic graveyard preview</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#151124;color:#f6ead3;font:15px/1.5 system-ui,sans-serif;padding:28px}main{max-width:1080px;margin:auto}header{max-width:830px}h1{font-size:27px;margin:0 0 8px}p{color:#c6b8d8;margin:8px 0 16px}nav{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:22px 0 12px}label{font-weight:650}select,button{background:#342744;color:#f6ead3;border:1px solid #806c91;border-radius:10px;font:inherit;padding:9px 12px}select{min-width:190px}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #f2c46d;outline-offset:3px}button:hover{background:#493653}#play{color:#24342a;background:#b9d98d;border-color:#d6eabb}#details{min-height:56px;max-width:800px}#details small{color:#a797bd}#scene{max-width:100%;margin-top:16px}#scene>svg{display:block;width:100%;height:auto;border-radius:16px;box-shadow:0 20px 60px #09070e66}#scene text{font-family:system-ui,sans-serif}.markdown-preview{background:#29203b;border:1px solid #665279;border-radius:16px;padding:22px;overflow-wrap:anywhere;box-shadow:0 20px 60px #09070e66}.markdown-preview h2{color:#f2c46d;font-size:23px}.markdown-preview h3{margin:22px 0 7px;font-size:18px;color:#b9d98d}.markdown-preview p{margin-bottom:16px}.markdown-preview a{color:#f2c46d}.markdown-preview table{border-collapse:collapse;width:100%;font-size:13px}.markdown-preview th,.markdown-preview td{padding:10px 8px;border-bottom:1px solid #665279;text-align:left}.table-scroll{overflow:auto}footer{max-width:800px;margin-top:25px;color:#a797bd;font-size:12px}@media(max-width:540px){body{padding:14px}h1{font-size:23px}nav{gap:7px}select{max-width:100%}.markdown-preview{padding:15px}}
</style></head><body><main><header><h1>Zombie Shuffle · midnight radio club</h1><p>Synthetic contacts rendered by the extension's actual panel hook. Choose a state, compare compact sizes, or play five still poses of a contact celebration.</p></header>
<nav aria-label="Preview states"><label for="state">State</label><select id="state">${fixtures.map((fixture, index) => `<option value="${index}">${html(fixture.name)}</option>`).join('')}</select><button id="previous" aria-label="Previous state">← Previous</button><button id="next" aria-label="Next state">Next →</button><button id="play">Play contact poses</button></nav>
<section id="details" aria-live="polite"></section><section id="scene" aria-label="Selected panel preview"></section><footer>Browser SVG and Markdown are approximations. Native text measurement, controls, animation and accessibility require the Ham2K renderer. These fixtures use a synthetic log and never access a radio, network or user's contacts.</footer></main>
<script>
const fixtures=${payload};const holder=document.getElementById('scene');const select=document.getElementById('state');const details=document.getElementById('details');let current=0;let timer;
function stop(){if(timer!==undefined){clearInterval(timer);timer=undefined}}
function show(index){current=(index+fixtures.length)%fixtures.length;const f=fixtures[current];select.value=String(current);holder.style.width=f.width+'px';holder.innerHTML=f.preview;details.replaceChildren();const description=document.createElement('div');description.textContent=f.description;const meta=document.createElement('small');meta.textContent=f.width+' × '+f.height+' logical pixels · '+f.qsoCount+' synthetic contacts · '+f.now;details.append(description,meta);history.replaceState(null,'','#'+encodeURIComponent(f.name))}
select.onchange=()=>{stop();show(Number(select.value))};document.getElementById('previous').onclick=()=>{stop();show(current-1)};document.getElementById('next').onclick=()=>{stop();show(current+1)};document.getElementById('play').onclick=()=>{stop();const poses=['first-contact','first-contact-1s','first-contact-2s','first-contact-3s','first-contact-4s'];let pose=0;show(fixtures.findIndex(f=>f.name===poses[0]));timer=setInterval(()=>{pose++;show(fixtures.findIndex(f=>f.name===poses[pose]));if(pose===poses.length-1)stop()},1000)};const requested=decodeURIComponent(location.hash.slice(1));const index=fixtures.findIndex(f=>f.name===requested);show(index>=0?index:0);
</script></body></html>`
  const path = resolve(output)
  const stem = path.replace(/\.html?$/i, '')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, document)
  await writeFile(`${stem}.json`, JSON.stringify({ fixtures }, null, 2))
  await writeFile(`${stem}-panel.svg`, zombiePanelPreview)
  if (fixtureFile) {
    await mkdir(dirname(resolve(fixtureFile)), { recursive: true })
    await writeFile(fixtureFile, JSON.stringify({ fixtures }, null, 2))
  }
  console.log(`Zombie preview: ${path} (${fixtures.length} synthetic states)`)
}
