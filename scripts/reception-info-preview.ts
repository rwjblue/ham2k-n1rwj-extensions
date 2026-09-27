import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PanelEnvironment, PanelRenderArgs, SvgScene } from '@ham2k/extension-sdk'
import type { LiveSnapshot } from '../extensions/tools/n1rwj-psk-reporter/src/live.ts'
import type { RbnSnapshot } from '../extensions/tools/n1rwj-rbn/src/model.ts'
import type { ReceptionReport } from '../packages/reception/src/reports.ts'
import type { UiModel } from '../packages/reception/src/ui/types.ts'
import { scenePreviewSvg } from './rbn-preview.ts'

type DetailsTab = 'status' | 'about'
type PreviewLive = Pick<
  LiveSnapshot,
  'state' | 'message' | 'retryAt' | 'capped' | 'history' | 'cacheWarning'
>

/** The task loads actual source exports after bundling sandbox JSON imports. */
export interface ReceptionPreviewRuntime {
  panelModel(args: PanelRenderArgs, snapshot: RbnSnapshot, now: number): UiModel
  pskPanelModel(
    args: PanelRenderArgs,
    reports: readonly ReceptionReport[],
    now: number,
    live: PreviewLive,
  ): UiModel
  renderReceptionScene(
    model: UiModel,
    environment: PanelEnvironment,
    selection: { details: true; detailsTab: DetailsTab; page: number },
  ): { scene: SvgScene; pageCount: number }
}

interface Scenario {
  id: string
  title: string
  purpose: string
  source: 'PSK Reporter' | 'RBN'
  width: number
  height: number
  dark?: boolean
  scale?: number
  incoming?: boolean
  state?: 'loading' | 'offline' | 'rate-limit'
}

const now = Date.UTC(2026, 8, 27, 18, 30)
const scenarios: Scenario[] = [
  {
    id: 'psk-phone',
    title: 'PSK Reporter · phone',
    source: 'PSK Reporter',
    width: 390,
    height: 740,
    purpose:
      'A healthy feed: establish what is being observed, how fresh it is, and what reload does.',
  },
  {
    id: 'rbn-phone',
    title: 'RBN · phone',
    source: 'RBN',
    width: 390,
    height: 740,
    purpose: 'Separate the latest receiver observation from the last successful service check.',
  },
  {
    id: 'psk-desktop',
    title: 'PSK Reporter · desktop',
    source: 'PSK Reporter',
    width: 900,
    height: 640,
    purpose: 'Keep the same information hierarchy while using the wider panel.',
  },
  {
    id: 'rbn-desktop',
    title: 'RBN · desktop',
    source: 'RBN',
    width: 900,
    height: 640,
    purpose: 'Current status and reference information stay separate at desktop size too.',
  },
  {
    id: 'rbn-rate-limit',
    title: 'RBN · rate limited / dark',
    source: 'RBN',
    width: 390,
    height: 740,
    dark: true,
    state: 'rate-limit',
    purpose:
      'Explain why cached reports are still visible, when requests resume, and why another reload cannot bypass the server limit.',
  },
  {
    id: 'psk-incoming',
    title: 'PSK Reporter · who I hear',
    source: 'PSK Reporter',
    width: 390,
    height: 740,
    incoming: true,
    purpose:
      'Make reception direction unambiguous: these stations were heard by N1RWJ, and SNR was measured at N1RWJ.',
  },
  {
    id: 'psk-loading',
    title: 'PSK Reporter · history loading',
    source: 'PSK Reporter',
    width: 390,
    height: 740,
    state: 'loading',
    purpose:
      'Show history loading independently from the live feed, while available reports remain useful.',
  },
  {
    id: 'psk-offline',
    title: 'PSK Reporter · offline',
    source: 'PSK Reporter',
    width: 390,
    height: 740,
    state: 'offline',
    purpose:
      'Put the paused connection first and describe the cached reports without implying they are live.',
  },
  {
    id: 'psk-large-text',
    title: 'PSK Reporter · narrow / 150% text',
    source: 'PSK Reporter',
    width: 320,
    height: 640,
    scale: 1.5,
    purpose:
      'Stress the actual pagination and wrapping at narrow width with increased host text scaling.',
  },
]

function previewEnvironment(scenario: Scenario): PanelEnvironment {
  const dark = scenario.dark === true
  const typography = (fontSize: number, fontWeight = 400, fontFamily = 'sans-serif') => ({
    fontFamily,
    fontFamilyFallback: [],
    fontSize,
    scaledFontSize: fontSize * (scenario.scale ?? 1),
    fontWeight,
    lineHeight: 1.2,
    letterSpacing: 0,
  })
  return {
    version: 1,
    width: scenario.width,
    height: scenario.height,
    safeInsets: { left: 0, top: 0, right: 0, bottom: 0 },
    brightness: dark ? 'dark' : 'light',
    colors: {
      surface: dark ? '#132129' : '#ffffff',
      surfaceContainer: dark ? '#1d303a' : '#f1f5f7',
      onSurface: dark ? '#e4eff2' : '#172832',
      onSurfaceVariant: dark ? '#aec2cd' : '#526876',
      accent: dark ? '#7adac5' : '#086f63',
      primary: dark ? '#7adac5' : '#086f63',
      onPrimary: dark ? '#00382f' : '#ffffff',
      secondary: dark ? '#a3c8ed' : '#245fc2',
      outline: dark ? '#3b5664' : '#cbd8df',
      outlineVariant: dark ? '#3b5664' : '#cbd8df',
      error: dark ? '#ffb4ab' : '#ba1a1a',
      onError: dark ? '#690005' : '#ffffff',
    },
    typography: {
      body: typography(15),
      label: typography(13),
      title: typography(20, 600),
      display: typography(32),
      mono: typography(14, 400, 'monospace'),
    },
    locale: 'en-US',
    textDirection: 'ltr',
    devicePixelRatio: 1,
    reducedMotion: true,
    highContrast: false,
  }
}

const receivers = [
  {
    call: 'W3LPL',
    country: 'United States',
    latitude: 39.348,
    longitude: -76.973,
    band: '20m',
    snrDb: 18,
  },
  { call: 'CU3AT', country: 'Azores', latitude: 38.7, longitude: -27.2, band: '20m', snrDb: -12 },
  { call: 'G4IRN', country: 'England', latitude: 51.4, longitude: -0.6, band: '20m', snrDb: -6 },
  { call: 'VE3EID', country: 'Canada', latitude: 43.7, longitude: -79.4, band: '40m', snrDb: 11 },
  { call: 'DL1A', country: 'Germany', latitude: 48.1, longitude: 11.6, band: '15m', snrDb: -3 },
  { call: 'VK4CT', country: 'Australia', latitude: -27.5, longitude: 153, band: '20m', snrDb: -19 },
]

function pskReports(incoming: boolean, offline: boolean): ReceptionReport[] {
  const watched = {
    call: 'N1RWJ',
    country: 'United States',
    location: {
      latitude: 42.438,
      longitude: -71.542,
      grid: 'FN42FK',
      source: 'reported-grid' as const,
    },
  }
  return receivers.map((receiver, index) => {
    const remote = {
      call: receiver.call,
      country: receiver.country,
      location: {
        latitude: receiver.latitude,
        longitude: receiver.longitude,
        source: 'reported-grid' as const,
      },
    }
    return {
      id: `synthetic-${index}`,
      transmitter: incoming ? remote : watched,
      receiver: incoming ? watched : remote,
      frequencyHz:
        receiver.band === '40m' ? 7074000 : receiver.band === '15m' ? 21074000 : 14074000,
      band: receiver.band,
      mode: 'FT8',
      timeMs: now - (index + (offline ? 8 : 0)) * 60_000 - 15_000,
      snrDb: receiver.snrDb,
    }
  })
}

function modelFor(
  scenario: Scenario,
  environment: PanelEnvironment,
  runtime: ReceptionPreviewRuntime,
): UiModel {
  const args: PanelRenderArgs = {
    panelKey: scenario.source === 'RBN' ? 'my-signal' : 'psk-reporter',
    instanceId: 'synthetic-preview',
    environment,
    operation: { uuid: 'preview', stationCall: 'N1RWJ', grid: 'FN42FK' },
    qsoCount: 0,
    config: { windowMinutes: 30, receptionDirection: scenario.incoming ? 'incoming' : 'outgoing' },
    reason: 'preview',
    clock: { nowMillis: now, realNowMillis: now },
  }
  if (scenario.source === 'PSK Reporter') {
    const offline = scenario.state === 'offline'
    const pending = scenario.state === 'loading'
    return runtime.pskPanelModel(args, pskReports(scenario.incoming === true, offline), now, {
      state: offline ? 'offline' : 'live',
      message: offline ? 'Offline · reception paused' : '',
      capped: false,
      history: {
        pending,
        message: pending
          ? 'Loading recent reports'
          : offline
            ? 'History paused while offline'
            : 'Recent history loaded',
        ...(pending ? {} : { lastRequestDurationMs: 320 }),
      },
    })
  }
  const limited = scenario.state === 'rate-limit'
  return runtime.panelModel(
    args,
    {
      call: 'N1RWJ',
      windowMinutes: 30,
      reports: receivers.map((receiver, index) => ({
        id: `synthetic-${index}`,
        call: 'N1RWJ',
        receiver: receiver.call,
        frequencyKhz: receiver.band === '40m' ? 7030 : receiver.band === '15m' ? 21030 : 14030,
        band: receiver.band,
        mode: 'CW',
        snrDb: receiver.snrDb + 20,
        wpm: 28,
        timeMs: now - (index + (limited ? 6 : 0)) * 60_000 - 30_000,
        receiverLatitude: receiver.latitude,
        receiverLongitude: receiver.longitude,
        country: receiver.country,
      })),
      status: limited ? 'stale' : 'ready',
      lastAttemptMs: now - 15_000,
      lastSuccessMs: now - (limited ? 5 * 60_000 : 15_000),
      lastRequestDurationMs: 245,
      error: limited ? 'Vail ReRBN rate limit reached (HTTP 429).' : null,
      ...(limited ? { failureKind: 'rate-limit' as const } : {}),
      capped: false,
      refresh: {
        state: limited ? 'rate-limit' : 'cooldown',
        manualAtMs: limited ? now + 2 * 60_000 : now,
        automaticAtMs: now + (limited ? 2 * 60_000 : 45_000),
      },
    },
    now,
  )
}

interface RenderedScenario extends Scenario {
  tabs: Record<DetailsTab, string[]>
}

function gallery(scenarios: RenderedScenario[]): string {
  // Escape '<' so no future source text can terminate this JSON script element.
  const data = JSON.stringify(scenarios).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reception info panes — rendered scene mockups</title>
<style>
:root{color-scheme:light;--ink:#173b43;--muted:#547078;--line:#cbdcd9;--accent:#0a7568}*{box-sizing:border-box}body{margin:0;background:#edf3f0;color:var(--ink);font:15px/1.55 system-ui,-apple-system,sans-serif}header{background:#143d43;color:#fff;padding:36px max(24px,calc((100vw - 1250px)/2)) 30px}.eyebrow{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#9ce1c7;font-weight:700}h1{font-size:clamp(28px,4vw,44px);line-height:1.15;letter-spacing:-.035em;margin:10px 0 14px;max-width:850px}header p{color:#d3e4e4;max-width:760px;margin:0}main{max-width:1300px;margin:auto;padding:26px 24px 48px}.purpose{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin:0 0 30px}.purpose article{border-top:2px solid #84b7a5;padding-top:12px}.purpose h2{font-size:17px;margin:0 0 4px}.purpose p{color:var(--muted);margin:0;font-size:14px}.workbench{display:grid;grid-template-columns:285px minmax(0,1fr);gap:24px;align-items:start}aside{background:#fff;border:1px solid var(--line);border-radius:14px;padding:21px;position:sticky;top:20px}label,.control-label{font-size:12px;font-weight:750;letter-spacing:.05em;text-transform:uppercase;display:block;margin-bottom:8px}select{width:100%;padding:12px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font:inherit;font-size:14px}.tabs{border:0;padding:0;display:flex;gap:6px;margin:8px 0 20px}button{font:inherit;color:var(--ink);background:#f2f6f4;border:1px solid var(--line);border-radius:8px;padding:9px 12px;cursor:pointer}button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}button:disabled{opacity:.35;cursor:default}button:focus-visible,select:focus-visible{outline:3px solid #b3902d;outline-offset:2px}.control-label{margin-top:22px}.scenario-purpose{margin:20px 0;color:var(--muted);font-size:14px}.spec{border-top:1px solid var(--line);padding-top:15px;font-size:12px;color:var(--muted)}.spec strong{color:var(--ink)}.pager{display:flex;justify-content:space-between;align-items:center;margin:18px 0 0}.pager span{font-size:12px;font-variant-numeric:tabular-nums}.canvas{border:1px solid var(--line);border-radius:14px;background:#dfe9e5;padding:22px;min-width:0}.canvas-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:17px}.canvas-title h2{font-size:15px;margin:0}.canvas-title span{font-size:12px;color:var(--muted)}.frame{margin:auto;background:#fff;box-shadow:0 10px 34px #21483a20;border:1px solid #bfd1ca;border-radius:10px;overflow:hidden}.frame svg{display:block;width:100%;height:auto}.notice{font-size:12px;color:var(--muted);margin:17px 0 0}.source{margin-top:28px;font-size:12px;color:var(--muted)}code{font-size:12px}a{color:var(--accent)}@media(max-width:850px){.workbench{grid-template-columns:1fr}aside{position:static}.purpose{gap:15px}.canvas{padding:15px}}@media(max-width:540px){header{padding:28px 20px}main{padding:22px 12px}.purpose{grid-template-columns:1fr;gap:16px}.canvas-title{display:block}.canvas-title span{display:block}.canvas{padding:12px}.workbench{gap:16px}}
</style></head><body>
<header><div class="eyebrow">PSK Reporter + Reverse Beacon Network</div><h1>Can I trust these reports,<br>and what should I do next?</h1><p>The info button answers that question first. Status describes this panel now; About explains the source, measurements, and limits.</p></header>
<main><section class="purpose" aria-label="Primary purposes"><article><h2>1. Establish context</h2><p>Confirm the callsign, direction, time window, and active filter.</p></article><article><h2>2. Assess freshness</h2><p>Distinguish the connection, the latest report, and a completed service check.</p></article><article><h2>3. Choose a next step</h2><p>Understand reload, a pending request, or a service limit before acting.</p></article></section>
<div class="workbench"><aside><label for="scenario">Scenario</label><select id="scenario"></select><div class="control-label">Info pane tab</div><fieldset class="tabs" aria-label="Info pane tab"><button id="status" type="button" aria-pressed="true">Status</button><button id="about" type="button" aria-pressed="false">About</button></fieldset><p class="scenario-purpose" id="purpose"></p><div class="spec" id="spec"></div><div class="pager"><button id="previous" type="button" aria-label="Previous mockup page">←</button><span id="page" aria-live="polite"></span><button id="next" type="button" aria-label="Next mockup page">→</button></div><p class="notice">Use these gallery controls to inspect every rendered page. The controls inside each image are illustrative.</p></aside>
<section class="canvas" aria-label="Rendered panel"><div class="canvas-title"><h2 id="title">PSK Reporter · phone</h2><span>Actual scene code · synthetic data</span></div><div class="frame" id="frame"></div><p class="notice"><strong>Rendered scene mockups; native Flutter not verified.</strong> Browser SVG approximates native fonts and text measurement. These are reproducible outputs of the real panel adapters and renderer, not separately drawn designs.</p></section></div>
<p class="source">Fixture clock: 2026-09-27 18:30:00 UTC. Reports and service states are synthetic fixtures using example callsigns. No network requests. Regenerate with <code>mise run reception:preview</code>. Source: <code>scripts/reception-info-preview.ts</code>.</p></main>
<script type="application/json" id="fixtures">${data}</script>
<script>
const fixtures = JSON.parse(document.getElementById('fixtures').textContent);
const el = id => document.getElementById(id);
const selector = el('scenario');
for (const fixture of fixtures) { const option = document.createElement('option'); option.value = fixture.id; option.textContent = fixture.title; selector.append(option); }
const initial = new URLSearchParams(location.hash.slice(1));
if (fixtures.some(f => f.id === initial.get('scenario'))) selector.value = initial.get('scenario');
let tab = initial.get('tab') === 'about' ? 'about' : 'status';
let page = Math.max(0, Number(initial.get('page')) || 0);
function render() {
 const fixture = fixtures.find(f => f.id === selector.value); const pages = fixture.tabs[tab]; page = Math.min(page, pages.length - 1);
 el('frame').style.maxWidth = [fixture.width, 'px'].join(''); el('frame').innerHTML = pages[page];
 el('purpose').textContent = fixture.purpose; el('title').textContent = fixture.title;
 el('spec').innerHTML = ['<strong>', fixture.width, ' × ', fixture.height, '</strong> logical pixels<br>', fixture.dark ? 'Dark' : 'Light', ' theme · ', Math.round((fixture.scale || 1) * 100), '% text size'].join('');
 el('page').textContent = [tab === 'status' ? 'Status' : 'About', ' · ', page + 1, ' of ', pages.length].join('');
 el('previous').disabled = page === 0; el('next').disabled = page + 1 >= pages.length;
 for (const value of ['status','about']) el(value).setAttribute('aria-pressed', String(tab === value));
 history.replaceState(null, '', ['#', new URLSearchParams({ scenario: fixture.id, tab, page: String(page) })].join(''));
}

selector.addEventListener('change', () => { page = 0; render(); });
for (const value of ['status','about']) el(value).addEventListener('click', () => { tab = value; page = 0; render(); });
el('previous').addEventListener('click', () => { page--; render(); });
el('next').addEventListener('click', () => { page++; render(); });
render();
</script></body></html>\n`
}

function overview(scenarios: RenderedScenario[]): string {
  const panels: Array<{ id: string; tab: DetailsTab; label: string }> = [
    { id: 'psk-phone', tab: 'status', label: 'PSK Reporter · Status' },
    { id: 'rbn-phone', tab: 'status', label: 'RBN · Status' },
    { id: 'rbn-rate-limit', tab: 'status', label: 'RBN · Service limit / dark' },
    { id: 'psk-phone', tab: 'about', label: 'PSK Reporter · About' },
  ]
  const cells = panels.map((panel, index) => {
    const scenario = scenarios.find((value) => value.id === panel.id)
    if (!scenario) throw new Error(`Missing overview scenario: ${panel.id}`)
    const x = 32 + index * 310
    const svg = Buffer.from(scenario.tabs[panel.tab][0]).toString('base64')
    return `<text x="${x}" y="114" font-size="16" font-weight="600">${panel.label}</text><text x="${x}" y="136" font-size="12" fill="#547078">Page 1 of ${scenario.tabs[panel.tab].length} · 390 × 740 logical pixels</text><image x="${x}" y="152" width="280" height="561.44" href="data:image/svg+xml;base64,${svg}"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1274" height="776" viewBox="0 0 1274 776" role="img" aria-label="PSK Reporter and RBN information panes showing Status, service rate limits, and About"><title>Reception info-pane overview</title><rect width="1274" height="776" fill="#edf3f0"/><g font-family="sans-serif" fill="#173b43"><text x="32" y="45" font-size="27" font-weight="700">Reception info: trust the reports, understand the next step</text><text x="32" y="73" font-size="14" fill="#547078">Actual panel adapters and scene renderer · synthetic reports and service states · 2026-09-27 18:30 UTC</text>${cells.join('')}<text x="32" y="751" font-size="13" fill="#547078">Rendered scene mockups; native Flutter not verified. The gallery includes every page, desktop, offline, incoming, loading, and enlarged-text views.</text></g></svg>\n`
}

export async function previewReceptionInfo(
  root: string,
  runtime: ReceptionPreviewRuntime,
): Promise<void> {
  const output = join(root, 'docs/images/reception-info')
  await mkdir(output, { recursive: true })
  const rendered: RenderedScenario[] = []
  for (const scenario of scenarios) {
    const environment = previewEnvironment(scenario)
    const model = modelFor(scenario, environment, runtime)
    const tabs: Record<DetailsTab, string[]> = { status: [], about: [] }
    for (const tab of ['status', 'about'] as const) {
      let pageCount = 1
      for (let page = 0; page < pageCount; page++) {
        const result = runtime.renderReceptionScene(model, environment, {
          details: true,
          detailsTab: tab,
          page,
        })
        pageCount = result.pageCount
        if (pageCount > 40)
          throw new Error(`Unexpected pagination: ${scenario.id}/${tab} has ${pageCount} pages.`)
        tabs[tab].push(scenePreviewSvg(result.scene, environment, scenario.source))
      }
    }
    rendered.push({ ...scenario, tabs })
    // Small shareable outputs complement the self-contained gallery; all other
    // pages live only in the gallery so they do not duplicate repository assets.
    await writeFile(join(output, `${scenario.id}.svg`), tabs.status[0])
    if (scenario.id === 'psk-phone' || scenario.id === 'rbn-phone')
      await writeFile(join(output, `${scenario.id}-about.svg`), tabs.about[0])
  }
  await writeFile(join(output, 'index.html'), gallery(rendered))
  await writeFile(join(output, 'overview.svg'), overview(rendered))
  await writeFile(
    join(output, 'README.md'),
    `# Reception info-pane mockups\n\nOpen [the interactive gallery](./index.html) to inspect Status and About at every page and size. The gallery is self-contained and makes no network requests. Individual SVGs show each scenario's first Status page, plus the phone About pages.\n\nRegenerate with \`mise run reception:preview\`. Fixtures have a fixed 2026-09-27 18:30 UTC clock and synthetic reports and service states. The task bundles and invokes the actual PSK/RBN panel adapters and shared scene renderer; it does not call host or network methods.\n\n**Rendered scene mockups; native Flutter not verified.** The portable SVG approximation does not exercise native fonts, text measurement, controls, focus, or event handling. Runtime tests and an actual Ham2K acceptance check remain separate evidence.\n`,
  )
  console.log(
    `Rendered ${rendered.length} scenarios with ${rendered.reduce((sum, value) => sum + value.tabs.status.length + value.tabs.about.length, 0)} pages: ${join(output, 'index.html')}`,
  )
}
