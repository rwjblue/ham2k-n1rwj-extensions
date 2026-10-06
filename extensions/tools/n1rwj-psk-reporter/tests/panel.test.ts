import type { FetchResponse, JSONValue, PanelContent, PanelRenderArgs } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { renderReceptionScene } from '../../../../packages/reception/src/ui/scene.ts'
import { environment } from '../../../../packages/reception/tests/environment.ts'
import { fakeTimers } from '../../../../packages/reception/tests/timers.ts'
import { parsePskPayload } from '../src/data/parser.ts'
import type { HistoryHost } from '../src/history/client.ts'
import { createLiveReception } from '../src/live.ts'
import { createPskPanel as createPanel, pskPanelModel } from '../src/panel.ts'
import { fakeSocket, publication } from './socket-fixture.ts'

const connection = { state: 'live' as const, message: '', capped: false }
const now = Date.UTC(2026, 8, 23, 18)
const args: PanelRenderArgs = {
  panelKey: 'psk-reporter',
  instanceId: 'one',
  environment: environment(),
  operation: { uuid: 'op', stationCall: 'N1RWJ', grid: 'FN42FK' },
  qsoCount: 0,
  reason: 'operation',
  config: {},
  clock: { nowMillis: now, realNowMillis: now },
}
const report = parsePskPayload(
  JSON.stringify({
    sc: 'N1RWJ',
    rc: 'CU3AT',
    sl: 'FN42FK',
    rl: 'HM68',
    md: 'FT8',
    b: '20m',
    f: 14074000,
    t: now / 1000,
    rp: -12,
  }),
)
if (!report) throw new Error('Invalid reception fixture')

const renderedPanels = new WeakMap<
  ReturnType<typeof createPanel>,
  { scenes: Map<string, PanelContent>; sequence: number }
>()

function createPskPanel(...parameters: Parameters<typeof createPanel>) {
  const panel = createPanel(...parameters)
  const state = { scenes: new Map<string, PanelContent>(), sequence: 0 }
  renderedPanels.set(panel, state)
  const render = panel.render
  panel.render = async (renderArgs, ctx) => {
    const content = await render(renderArgs, ctx)
    state.scenes.set(renderArgs.instanceId ?? '', content)
    return content
  }
  return panel
}

function sceneState(content: PanelContent) {
  if (content.kind !== 'scene') throw new Error('Expected native scene')
  return content.scene
}

function sceneText(content: PanelContent): string {
  if (content.kind !== 'scene') throw new Error('Expected native scene')
  return content.scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
}

function renderedEvent(
  panel: ReturnType<typeof createPskPanel>,
  renderArgs: PanelRenderArgs,
  controlId: string,
  text?: string,
) {
  const state = renderedPanels.get(panel)
  const content = state?.scenes.get(renderArgs.instanceId ?? '')
  const control = content && sceneState(content).controls?.find((entry) => entry.id === controlId)
  if (!state || !control?.event) throw new Error(`Missing rendered control ${controlId}`)
  const native = control.kind === 'nativeDropdown' || control.kind === 'nativeSegmented'
  return {
    ...renderArgs,
    event: {
      controlId,
      action: control.event,
      phase: native ? ('commit' as const) : ('activate' as const),
      sequence: ++state.sequence,
      ...(native ? { text } : {}),
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function settle() {
  for (let n = 0; n < 40; n++) await Promise.resolve()
}

function backgroundPanel(fetch: HistoryHost['fetch']) {
  let clock = now
  const socket = fakeSocket()
  const live = createLiveReception(
    () => socket.socket,
    () => clock,
    () => 0,
    {
      fetch,
      read: async (key) =>
        key === 'psk-reports-v1'
          ? JSON.stringify({
              version: 1,
              reports: [
                {
                  id: 'cached',
                  sc: 'N1RWJ',
                  rc: 'K1ABC',
                  sl: 'FN42',
                  rl: 'FN31',
                  f: 14074000,
                  b: '20m',
                  md: 'FT8',
                  t: now / 1000 - 60,
                },
              ],
            })
          : null,
      write: async () => {},
    },
  )
  const panel = createPskPanel(live)
  const currentArgs = (instanceId = 'one'): PanelRenderArgs => ({
    ...args,
    instanceId,
    config: { view: 'list', band: '20m' },
    clock: { nowMillis: clock - 86_400_000, realNowMillis: clock },
  })
  return {
    panel,
    live,
    socket,
    args: currentArgs,
    stop: () => live.stop(),
    render: (instanceId = 'one', online = true) =>
      panel.render(currentArgs(instanceId), { online }),
    event: (controlId: string, text?: string, online = true) =>
      panel.onEvent?.(renderedEvent(panel, currentArgs(), controlId, text), { online }),
    advance: (ms: number) => {
      clock += ms
    },
  }
}

async function detailsText(s: ReturnType<typeof backgroundPanel>) {
  const pages: string[] = []
  for (let page = 0; page < 30; page++) {
    const content = await s.render()
    pages.push(sceneText(content))
    if (
      content.kind !== 'scene' ||
      !content.scene.controls?.some((control) => control.id === 'next')
    )
      return pages.join('\n')
    await s.event('next', undefined)
  }
  throw new Error('Status details did not reach their final page')
}

function historyResponse(receiver = 'W1AW'): FetchResponse {
  return {
    status: 200,
    body: `<pskreporter><receptionReport senderCallsign="N1RWJ" receiverCallsign="${receiver}" receiverLocator="FN31" frequency="14074000" mode="FT8" flowStartSeconds="${now / 1000}"/></pskreporter>`,
  }
}

it('uses a temporary Report window for cached filtering, snapshot requests, details, and reload per placement', async () => {
  const live = createLiveReception(
    () => fakeSocket().socket,
    () => now,
  )
  const base = live.snapshot('fixture', 'N1RWJ', 'outgoing', 15, false, now)
  const snapshot = vi.spyOn(live, 'snapshot').mockReturnValue({
    ...base,
    reports: [
      report,
      {
        ...report,
        id: 'older',
        receiver: { ...report.receiver, call: 'K1OLD' },
        timeMs: now - 20 * 60_000,
      },
    ],
  })
  const forceHistory = vi.spyOn(live, 'forceHistory')
  const panel = createPskPanel(live)
  const list = { ...args, config: { view: 'list' } }
  const originalConfig = { ...list.config }
  expect(sceneText(await panel.render(list, { online: false }))).not.toContain('K1OLD')
  const before = snapshot.mock.calls.length
  expect(
    await panel.onEvent?.(renderedEvent(panel, list, 'window', '30'), { online: false }),
  ).toEqual({
    values: {},
    strings: { window: '30' },
  })
  expect(snapshot).toHaveBeenCalledTimes(before)
  expect(forceHistory).not.toHaveBeenCalled()
  const selected = await panel.render(list, { online: false })
  expect(sceneState(selected).strings?.window).toBe('30')
  expect(sceneText(selected)).toContain('K1OLD')
  expect(snapshot).toHaveBeenLastCalledWith('one', 'N1RWJ', 'outgoing', 30, false, now)
  const second = { ...list, instanceId: 'two' }
  const other = await panel.render(second, { online: false })
  expect(sceneState(other).strings?.window).toBe('15')
  expect(sceneText(other)).not.toContain('K1OLD')
  await panel.onEvent?.(renderedEvent(panel, list, 'refresh'), { online: false })
  expect(forceHistory).toHaveBeenLastCalledWith('N1RWJ', 'outgoing', 30, false, now)
  await panel.onEvent?.(renderedEvent(panel, list, 'details'), { online: false })
  expect(sceneText(await panel.render(list, { online: false }))).toContain('Last 30 minutes')
  expect(list.config).toEqual(originalConfig)
  live.stop()
})

it('preserves a Report window across unrelated settings and resets it for a saved default or new operation', async () => {
  const s = backgroundPanel(async () => historyResponse())
  await s.render('one', false)
  await s.event('window', '60', false)
  const unrelated = { ...s.args(), config: { ...s.args().config, projection: 'azimuthal' } }
  expect(sceneState(await s.panel.render(unrelated, { online: false })).strings?.window).toBe('60')
  const saved = { ...unrelated, config: { ...unrelated.config, windowMinutes: 5 } }
  expect(sceneState(await s.panel.render(saved, { online: false })).strings?.window).toBe('5')
  await s.panel.onEvent?.(renderedEvent(s.panel, saved, 'window', '30'), { online: false })
  const nextOperation = { ...saved, operation: { ...saved.operation, uuid: 'new-operation' } }
  expect(sceneState(await s.panel.render(nextOperation, { online: false })).strings?.window).toBe(
    '5',
  )
  await s.panel.onEvent?.(renderedEvent(s.panel, nextOperation, 'window', '30'), { online: false })
  const clearedOperation = { ...saved, operation: {} }
  expect(
    sceneState(await s.panel.render(clearedOperation, { online: false })).strings?.window,
  ).toBe('5')
  const restarted = createPskPanel(s.live)
  expect(sceneState(await restarted.render(s.args(), { online: false })).strings?.window).toBe('15')
  s.stop()
})

it('keeps a larger Report window on the exact MQTT topic and normal pending-history cooldown', async () => {
  const request = deferred<FetchResponse>()
  const fetch = vi.fn<HistoryHost['fetch']>(() => request.promise)
  const s = backgroundPanel(fetch)
  const forceHistory = vi.spyOn(s.live, 'forceHistory')
  await s.render()
  await settle()
  s.socket.socket.onopen?.()
  s.socket.receive([0x20, 2, 0, 0])
  s.socket.receive([0x90, 3, 0, 1, 0])
  const sent = s.socket.sent.map((packet) => [...packet])
  expect(sent.map((packet) => new TextDecoder().decode(new Uint8Array(packet))).join('')).toContain(
    'pskr/filter/v2/+/+/N1RWJ/#',
  )
  expect(fetch.mock.calls[0]?.[0]).toContain('senderCallsign=N1RWJ&flowStartSeconds=-900')
  await s.event('window', '30')
  const pending = await s.render()
  expect(sceneState(pending).strings?.window).toBe('30')
  expect(sceneText(pending)).toContain('K1ABC')
  expect(pending.triggers).toEqual(['tick:1'])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(s.socket.sent).toEqual(sent)
  expect(forceHistory).not.toHaveBeenCalled()
  request.resolve(historyResponse())
  await settle()
  expect(sceneText(await s.render())).toContain('Collection gap · history queued')
  expect(fetch).toHaveBeenCalledTimes(1)
  s.advance(5 * 60_000)
  await s.render()
  await settle()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1]?.[0]).toContain('senderCallsign=N1RWJ&flowStartSeconds=-1800')
  expect(forceHistory).not.toHaveBeenCalled()
  s.stop()
})

it('uses the same renderer for both directions without RBN branding or invented CW speed', () => {
  for (const incoming of [false, true]) {
    const call = incoming ? 'CU3AT' : 'N1RWJ'
    const model = pskPanelModel(
      {
        ...args,
        operation: { ...args.operation, stationCall: call },
        config: { receptionDirection: incoming ? 'incoming' : 'outgoing' },
      },
      [report],
      now,
      connection,
    )
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).toMatchObject({
      call: incoming ? 'N1RWJ' : 'CU3AT',
      frequencyKhz: 14074,
      snrDb: -12,
    })
    expect(model.mapOptions?.stations[0].key).toBe(model.rows[0].call)
    const { scene } = renderReceptionScene(model, environment())
    const text = scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
    expect(text).toContain(incoming ? 'Transmitter' : 'Receiver')
    expect(text).toContain('PSK Reporter')
    expect(text).not.toMatch(/RBN|Vail/)
    expect(JSON.stringify(scene.controls?.find((control) => control.id === 'refresh'))).toContain(
      'Force reload',
    )
    expect(JSON.stringify(scene.controls)).not.toContain('CW speed')
  }
})

it.each(['FN31', '', 'ZZ99'])(
  'retains a non-callsign receiver in the list and maps it only with a valid grid (%s)',
  (grid) => {
    const reception = parsePskPayload(
      JSON.stringify({
        sc: 'N1RWJ',
        rc: 'US-E-015',
        rl: grid,
        md: 'FT8',
        b: '20m',
        f: 14074000,
        t: now / 1000,
      }),
    )
    if (!reception) throw new Error('Expected a report from the SWL receiver')
    const model = pskPanelModel(args, [reception], now, connection)
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).toMatchObject({ call: 'US-E-015', frequencyKhz: 14074 })
    const { scene } = renderReceptionScene(model, environment(), { view: 'list' })
    expect(scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')).toContain('US-E-015')
    if (grid === 'FN31') {
      expect(model.mapOptions?.stations).toHaveLength(1)
      expect(model.mapOptions?.stations[0]).toMatchObject({ key: 'US-E-015', label: 'US-E-015' })
      expect(model.rows[0].distanceKm).toBeGreaterThan(0)
    } else {
      expect(model.mapOptions?.stations).toEqual([])
      expect(model.rows[0].distanceKm).toBeUndefined()
      expect(model.rows[0].bearingDeg).toBeUndefined()
    }
  },
)

it('shows transmitters heard by an explicitly watched non-callsign receiver', () => {
  const reception = { ...report, receiver: { ...report.receiver, call: 'US-E-015' } }
  const model = pskPanelModel(
    { ...args, config: { watchCall: 'US-E-015', receptionDirection: 'incoming' } },
    [reception],
    now,
    connection,
  )
  expect(model.rows.map((row) => row.call)).toEqual(['N1RWJ'])
  expect(model.mapOptions?.stations.map((station) => station.key)).toEqual(['N1RWJ'])
  expect(model.mapOptions?.origin?.label).toBe('US-E-015')
  expect(model.details?.purpose).toContain('US-E-015 reports hearing')
})

it('allows receiver IDs in the watch field while rejecting malformed IDs and MQTT wildcards', async () => {
  const panel = createPskPanel(createLiveReception(() => fakeSocket().socket))
  const fields = (await panel.getPanels({}, { online: false }))[0].form
  const field = fields?.find((field) => field.type === 'field' && field.key === 'watchCall')
  if (field?.type !== 'field' || !field.pattern) throw new Error('Expected watch ID validation')
  expect(field.label).toBe('Watch callsign or receiver ID')
  const pattern = new RegExp(field.pattern)
  for (const value of [
    '',
    'N1RWJ',
    'N1RWJ/P',
    'SWL',
    'FWG',
    'I0-1589',
    'US-E-015',
    'My SWL',
    'SWL_1',
  ])
    expect(pattern.test(value), value).toBe(true)
  for (const value of ['#', '+', 'SWL+#', 'N1RWJ.P', 'SWL\n1', 'SWL\0', 'ÉCOUTE', 'X'.repeat(255)])
    expect(pattern.test(value), value).toBe(false)
})

it('keeps suffixes exact and filters stale or unrelated reports', () => {
  expect(
    pskPanelModel({ ...args, config: { watchCall: 'N1RWJ/P' } }, [report], now, connection).rows,
  ).toEqual([])
  expect(pskPanelModel(args, [report], now + 16 * 60_000, connection).rows).toEqual([])
  expect(pskPanelModel(args, [report], now - 120_000, connection).rows).toEqual([])
})

it.each(['outgoing', 'incoming'] as const)(
  'explains %s scope and keeps live connection separate from recent history',
  (direction) => {
    const model = pskPanelModel(
      { ...args, config: { receptionDirection: direction, windowMinutes: 30 } },
      [report],
      now,
      {
        ...connection,
        history: { message: 'Collection gap · history queued', pending: false },
      },
    )
    expect(model.details?.facts).toEqual([
      { label: 'Direction', value: direction === 'incoming' ? 'Who I hear' : 'Who hears me' },
      { label: 'Window', value: 'Last 30 minutes' },
      { label: 'Live feed', value: 'Connected' },
      { label: 'Recent history', value: 'Collection gap · history queued' },
    ])
    expect(model.details?.purpose).toContain(
      direction === 'incoming' ? 'reports hearing' : 'is being heard',
    )
    expect(model.details?.purpose).toContain('N1RWJ')
    expect(model.details?.status).toBe(
      direction === 'incoming' ? 'Connected · waiting for reports' : 'Live reception',
    )
    expect(model.details?.status).not.toContain('history')
    expect(model.fetchedAt).toBeUndefined()
    expect(JSON.stringify(model.details)).not.toMatch(/Data checked|Last successful check|never/)
    expect(model.details?.activity).toEqual([])
    const about = model.details?.sections.flatMap((section) => section.paragraphs).join(' ')
    expect(about).toContain('requires uploads from your receiving software')
    expect(about).toContain('Changing the watched callsign does not move the map origin')
    expect(about).toContain('one station, band, and mode')
    expect(about).toContain('An empty result does not prove')
  },
)

it('preserves history diagnostics once and exposes pending, retry, and duration states accurately', () => {
  const warning = 'History unavailable: HTTP 503. Full response diagnostic.'
  const retrying = pskPanelModel(args, [report], now, {
    state: 'retrying',
    message: 'Connection closed',
    retryAt: now + 5000,
    capped: true,
    cacheWarning: warning,
    history: {
      message: 'History unavailable',
      pending: false,
      warning,
      lastRequestDurationMs: 1234,
      lastRequestDurationUpperBound: true,
    },
  })
  expect(retrying.warnings).toEqual([
    'Report capacity reached; this window is incomplete.',
    warning,
  ])
  expect(retrying.details?.activity).toEqual([
    'Last history request duration: up to 1234 ms.',
    'Live feed retries at 18:00:05 UTC.',
    'Force reload retries recent history, bypassing the automatic cooldown.',
  ])
  expect(retrying.details?.sections.flatMap((section) => section.paragraphs).join(' ')).toContain(
    'includes time until the next panel render observed completion',
  )
  const pending = pskPanelModel(args, [report], now, {
    ...connection,
    history: { message: 'Loading recent reports', pending: true, lastRequestDurationMs: 999 },
  })
  expect(pending.details?.activity?.join(' ')).toContain('History request in progress')
  expect(pending.details?.activity?.join(' ')).not.toContain('duration')
  expect(pending.warnings).toEqual([])
})

it('does not open a socket or fabricate reports while offline', async () => {
  const open = vi.fn(() => {
    throw new Error('Unexpected socket')
  })
  const hook = createPskPanel(createLiveReception(open))
  const panels = await hook.getPanels({}, { online: false })
  expect(panels[0].on).toEqual(['operation', 'tick:5'])
  const content = await hook.render(args, { online: false })
  expect(content.kind).toBe('scene')
  if (content.kind !== 'scene') throw new Error('Expected scene')
  const text = content.scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
  expect(text).toContain('Offline · reception paused')
  expect(open).not.toHaveBeenCalled()
  expect(text).not.toContain('CU3AT')
})

it('filters cached reports through the native Band choice per placement and respects a saved Band change', async () => {
  const fetch = vi.fn<HistoryHost['fetch']>(async () => historyResponse())
  const s = backgroundPanel(fetch)
  expect(sceneText(await s.render('one', false))).toContain('K1ABC')
  await s.event('band', '40m', false)
  expect(sceneText(await s.render('one', false))).toContain('No 40m reports in this time window.')
  expect(sceneText(await s.render('one', false))).not.toContain('K1ABC')
  expect(sceneText(await s.render('two', false))).toContain('K1ABC')
  await s.event('details', undefined, false)
  expect(await detailsText(s)).toContain('Latest report · 40m')
  await s.event('details', undefined, false)
  await s.render('one', false)
  await s.event('band', 'all', false)
  expect(sceneText(await s.render('one', false))).toContain('All bands · 1 receiver')
  expect(sceneText(await s.render('one', false))).toContain('K1ABC')
  await s.event('band', '40m', false)
  const saved = { ...s.args(), config: { view: 'list', band: 'all' } }
  expect(sceneText(await s.panel.render(saved, { online: false }))).toContain('K1ABC')
  s.stop()
})

it('accepts a reported band outside the tune form and ignores invalid native commits', async () => {
  const live = createLiveReception(() => {
    throw new Error('Unexpected socket')
  })
  const cached = live.snapshot('one', 'N1RWJ', 'outgoing', 15, false, now)
  vi.spyOn(live, 'snapshot').mockReturnValue({
    ...cached,
    reports: [report, { ...report, id: '2m', band: '2m', frequencyHz: 144174000 }],
  })
  const panel = createPskPanel(live)
  const initial = await panel.render(args, { online: false })
  if (initial.kind !== 'scene') throw new Error('Expected native scene')
  expect(initial.scene.controls?.find((control) => control.id === 'band')?.options).toContainEqual({
    label: '2m',
    value: '2m',
  })
  expect(initial.scene.controls?.some((control) => control.id === 'view')).toBe(false)
  const band = renderedEvent(panel, args, 'band', '2m')
  for (const invalid of [
    { ...band.event, controlId: 'sort' },
    { ...band.event, controlId: 'unknown' },
    { ...band.event, text: 'bogus' },
    { ...band.event, action: `${band.event.action}:extra` },
    { ...band.event, phase: 'change' as const },
    { ...band.event, phase: 'activate' as const },
    { ...band.event, text: undefined, value: 2 },
    { ...band.event, sequence: -1 },
    { ...band.event, sequence: Number.NaN },
    { ...band.event, sequence: 1.5 },
  ])
    expect(await panel.onEvent?.({ ...args, event: invalid }, { online: false })).toEqual({
      values: {},
    })
  expect(await panel.render(args, { online: false })).toEqual(initial)
  expect(await panel.onEvent?.(band, { online: false })).toEqual({
    values: {},
    strings: { band: '2m' },
  })
  expect(await panel.onEvent?.(band, { online: false })).toEqual({
    values: {},
    strings: { band: '2m' },
  })
  const filtered = sceneText(await panel.render(args, { online: false }))
  expect(filtered).toContain('2m · 1 receiver')
  expect(filtered).toContain('144174.0')
  expect(filtered).not.toContain('14074.0')
  live.stop()
})

it('rejects stale context commits and accepts remounted host sequences for each placement', async () => {
  const live = createLiveReception(() => {
    throw new Error('Unexpected socket')
  })
  const panel = createPskPanel(live)
  await panel.render(args, { online: false })
  let obsolete = renderedEvent(panel, args, 'band', '40m')
  const contexts: PanelRenderArgs[] = [
    { ...args, operation: { ...args.operation, uuid: 'other-operation' } },
    { ...args, config: { watchCall: 'CU3AT' } },
    { ...args, config: { receptionDirection: 'incoming' } },
    { ...args, config: { view: 'list', band: '20m' } },
    { ...args, instanceId: 'another-placement' },
  ]
  for (const current of contexts) {
    const before = await panel.render(current, { online: false })
    expect(await panel.onEvent?.({ ...current, event: obsolete.event }, { online: false })).toEqual(
      { values: {} },
    )
    expect(await panel.render(current, { online: false })).toEqual(before)
    obsolete = renderedEvent(panel, current, 'band', '40m')
  }
  const secondArgs = { ...args, instanceId: 'another-placement' }
  await panel.render(args, { online: false })
  await panel.render(secondArgs, { online: false })
  const first = renderedEvent(panel, args, 'band', '20m')
  first.event.sequence = 100
  const second = renderedEvent(panel, secondArgs, 'band', '40m')
  second.event.sequence = 1
  expect(await panel.onEvent?.(first, { online: false })).toEqual({
    values: {},
    strings: { band: '20m' },
  })
  expect(await panel.onEvent?.(second, { online: false })).toEqual({
    values: {},
    strings: { band: '40m' },
  })
  expect(sceneState(await panel.render(args, { online: false })).strings?.band).toBe('20m')
  expect(sceneState(await panel.render(secondArgs, { online: false })).strings?.band).toBe('40m')
  expect(await panel.onEvent?.(second, { online: false })).toEqual({
    values: {},
    strings: { band: '40m' },
  })
  expect(sceneState(await panel.render(secondArgs, { online: false })).strings?.band).toBe('40m')
  const remounted = renderedEvent(panel, args, 'band', 'all')
  remounted.event.sequence = 1
  expect(await panel.onEvent?.(remounted, { online: false })).toEqual({
    values: {},
    strings: { band: 'all' },
  })
  expect(sceneState(await panel.render(args, { online: false })).strings?.band).toBe('all')
  expect(sceneState(await panel.render(secondArgs, { online: false })).strings?.band).toBe('40m')
  live.stop()
})

it('commits Status and About tabs while retaining the configured view and rejecting hidden filters', async () => {
  const s = backgroundPanel(vi.fn(async () => historyResponse()))
  await s.render('one', false)
  const hidden = renderedEvent(s.panel, s.args(), 'band', '40m')
  await s.event('details', undefined, false)
  const status = await s.render('one', false)
  expect(sceneState(status).strings?.detailsTab).toBe('status')
  expect(await s.panel.onEvent?.(hidden, { online: false })).toEqual({ values: {} })
  expect(await s.event('detailsTab', 'about', false)).toEqual({
    values: {},
    strings: { detailsTab: 'about' },
  })
  const about = await s.render('one', false)
  expect(sceneState(about).strings?.detailsTab).toBe('about')
  expect(sceneText(about)).toContain('PSK Reporter')
  expect(await s.event('detailsTab', 'status', false)).toEqual({
    values: {},
    strings: { detailsTab: 'status' },
  })
  expect(sceneState(await s.render('one', false)).strings?.detailsTab).toBe('status')
  await s.event('details', undefined, false)
  const reports = await s.render('one', false)
  expect(sceneState(reports).strings?.band).toBe('20m')
  expect(sceneState(reports).controls?.some((control) => control.id === 'view')).toBe(false)
  expect(sceneState(reports).layers.some((layer) => layer.id.startsWith('map-'))).toBe(false)
  s.stop()
})

it.each(['operation', 'config', 'rerender'] as const)(
  'discards restoration superseded by %s and retains the latest event registry',
  async (change) => {
    const open = vi.fn(() => {
      throw new Error('Unexpected socket')
    })
    const live = createLiveReception(open)
    const restore = live.restore.bind(live)
    const pending = deferred<boolean>()
    vi.spyOn(live, 'restore').mockImplementationOnce(async (realTime) => {
      const restored = await restore(realTime)
      await pending.promise
      return restored
    })
    const panel = createPskPanel(live)
    const obsolete = panel.render(args, { online: false })
    const current: PanelRenderArgs =
      change === 'operation'
        ? { ...args, operation: { ...args.operation, uuid: 'new-operation' } }
        : change === 'config'
          ? { ...args, config: { band: '40m' } }
          : args
    const latest = await panel.render(current, { online: false })
    expect(latest.kind).toBe('scene')
    const choice = renderedEvent(panel, current, 'band', '20m')
    pending.resolve(true)
    expect(await obsolete).toEqual({ kind: 'markdown', content: '' })
    expect(await panel.onEvent?.(choice, { online: false })).toEqual({
      values: {},
      strings: { band: '20m' },
    })
    expect(sceneState(await panel.render(current, { online: false })).strings?.band).toBe('20m')
    expect(open).not.toHaveBeenCalled()
    live.stop()
  },
)

it('discards a render hidden during cache restoration and allows a later render to resume', async () => {
  const stored = deferred<JSONValue>()
  const timers = fakeTimers(now)
  const open = vi.fn(() => fakeSocket().socket)
  const fetch = vi.fn<HistoryHost['fetch']>(async () => historyResponse())
  const live = createLiveReception(
    open,
    () => now,
    () => 0,
    {
      read: async (key) => (key === 'psk-reports-v1' ? stored.promise : null),
      write: async () => {},
      fetch,
    },
    timers.driver,
  )
  const panel = createPskPanel(live)
  const obsolete = panel.render(args, { online: true })
  live.pause()
  stored.resolve(null)
  expect(await obsolete).toEqual({ kind: 'markdown', content: '' })
  await settle()
  expect(open).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  expect(timers.pending.size).toBe(0)
  expect((await panel.render(args, { online: true })).kind).toBe('scene')
  await settle()
  expect(open).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  live.stop()
})

it('checks restoration validity after its promise settles, before the render resumes', async () => {
  const open = vi.fn(() => fakeSocket().socket)
  const live = createLiveReception(open)
  const restore = live.restore
  live.restore = async (realTime) => {
    const restored = await restore(realTime)
    live.pause()
    return restored
  }
  expect(await createPskPanel(live).render(args, { online: true })).toEqual({
    kind: 'markdown',
    content: '',
  })
  expect(open).not.toHaveBeenCalled()
})

it('renders cached reports immediately, shares pending history across placements, and retains live MQTT updates', async () => {
  const request = deferred<FetchResponse>()
  const fetch = vi.fn<HistoryHost['fetch']>(() => request.promise)
  const s = backgroundPanel(fetch)
  const initial = await s.render()
  expect(initial.triggers).toEqual(['tick:1'])
  expect(sceneText(initial)).toContain('K1ABC')
  expect(sceneText(initial)).toContain('Loading recent reports')
  await settle()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('timeout')

  s.socket.socket.onopen?.()
  s.socket.receive([0x20, 2, 0, 0])
  s.socket.receive([0x90, 3, 0, 1, 0])
  s.socket.receive(
    publication(
      'pskr/filter/v2/20m/FT8/N1RWJ/CU3AT/FN42/HM68/291/149',
      JSON.stringify({
        sc: 'N1RWJ',
        rc: 'CU3AT',
        sl: 'FN42',
        rl: 'HM68',
        t: now / 1000,
        f: 14074000,
        md: 'FT8',
        b: '20m',
        rp: -12,
      }),
    ),
  )
  s.advance(1_000)
  const pending = await s.render('two')
  expect(pending.triggers).toEqual(['tick:1'])
  expect(sceneText(pending)).toContain('Live reception')
  expect(sceneText(pending)).toContain('CU3AT')
  expect(sceneText(pending)).toContain('K1ABC')
  await s.event('refresh', undefined)
  await s.render()
  expect(fetch).toHaveBeenCalledTimes(1)

  s.advance(7_000)
  request.resolve(historyResponse())
  await settle()
  const completed = await s.render()
  expect(completed.triggers).toBeUndefined()
  expect(sceneText(completed)).toContain('W1AW')
  expect(sceneText(completed)).toContain('CU3AT')
  expect((await s.panel.getPanels({}, { online: true }))[0].on).toEqual(['operation', 'tick:5'])
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each(['success', 'failure'] as const)(
  'returns from force reload while HTTP is pending and restores the normal cadence on %s',
  async (outcome) => {
    const request = deferred<FetchResponse>()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(historyResponse())
      .mockImplementation(() => request.promise)
    const s = backgroundPanel(fetch)
    await s.render()
    await settle()
    await s.event('sort', 'call')
    const ready = await s.render()
    expect(ready.triggers).toBeUndefined()
    expect(sceneText(ready)).toContain('W1AW')

    s.advance(1_000)
    await s.event('refresh', undefined)
    await settle()
    const pending = await s.render()
    expect(pending.triggers).toEqual(['tick:1'])
    expect(sceneText(pending)).toContain('W1AW')
    expect(sceneState(pending).strings?.sort).toBe('call')
    await s.event('refresh', undefined)
    await s.render()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[1]).not.toHaveProperty('timeout')

    s.advance(15_000)
    if (outcome === 'success') request.resolve(historyResponse('K2XYZ'))
    else request.reject(new Error('TimeoutException after 0:00:15: Future not completed'))
    await settle()
    const completed = await s.render()
    expect(completed.triggers).toBeUndefined()
    expect(sceneText(completed)).toContain('W1AW')
    expect(sceneState(completed).strings?.sort).toBe('call')
    expect(sceneText(completed)).toContain(outcome === 'success' ? 'K2XYZ' : 'History unavailable')
    expect(fetch).toHaveBeenCalledTimes(2)

    await s.event('details', undefined)
    expect(await detailsText(s)).toMatch(/(?:request|history).*duration:.*15000 ms/i)
  },
)

it('does not start an offline force reload and drops the fast trigger when pending HTTP settles', async () => {
  const request = deferred<FetchResponse>()
  const fetch = vi.fn(() => request.promise)
  const s = backgroundPanel(fetch)
  expect((await s.render()).triggers).toEqual(['tick:1'])
  await settle()
  const offline = await s.render('one', false)
  expect(offline.triggers).toEqual(['tick:1'])
  expect(sceneText(offline)).toContain('K1ABC')
  expect(sceneText(offline)).toContain('Offline · reception paused')
  await s.event('refresh', undefined, false)
  expect(fetch).toHaveBeenCalledTimes(1)
  request.resolve(historyResponse())
  await settle()
  const completed = await s.render('one', false)
  expect(completed.triggers).toBeUndefined()
  expect(sceneText(completed)).not.toContain('W1AW')
})
