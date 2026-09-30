import type { FetchResponse, JSONValue, PanelContent, PanelRenderArgs } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { renderReceptionScene } from '../../../../packages/reception/src/ui/scene.ts'
import { environment } from '../../../../packages/reception/tests/environment.ts'
import { fakeTimers } from '../../../../packages/reception/tests/timers.ts'
import { parsePskPayload } from '../src/data/parser.ts'
import type { HistoryHost } from '../src/history/client.ts'
import { createLiveReception } from '../src/live.ts'
import { createPskPanel, pskPanelModel } from '../src/panel.ts'
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

function sceneText(content: PanelContent): string {
  if (content.kind !== 'svgScene') throw new Error('Expected native scene')
  return content.scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
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
    socket,
    render: (instanceId = 'one', online = true) =>
      panel.render(currentArgs(instanceId), { online }),
    event: (controlId: string, action: string, online = true) =>
      panel.onEvent?.(
        {
          ...currentArgs(),
          event: { controlId, action, phase: 'activate', sequence: 1 },
        },
        { online },
      ),
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
      content.kind !== 'svgScene' ||
      !content.scene.controls?.some(
        (control) => control.id === 'next' && control.event === 'page:next',
      )
    )
      return pages.join('\n')
    await s.event('next', 'page:next')
  }
  throw new Error('Status details did not reach their final page')
}

function historyResponse(receiver = 'W1AW'): FetchResponse {
  return {
    status: 200,
    body: `<pskreporter><receptionReport senderCallsign="N1RWJ" receiverCallsign="${receiver}" receiverLocator="FN31" frequency="14074000" mode="FT8" flowStartSeconds="${now / 1000}"/></pskreporter>`,
  }
}

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
  expect(content.kind).toBe('svgScene')
  if (content.kind !== 'svgScene') throw new Error('Expected scene')
  const text = content.scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
  expect(text).toContain('Offline · reception paused')
  expect(open).not.toHaveBeenCalled()
  expect(text).not.toContain('CU3AT')
})

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
  expect((await panel.render(args, { online: true })).kind).toBe('svgScene')
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
  await s.event('refresh', 'refresh:reports')
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
    await s.event('sort', 'sort:call')
    const ready = await s.render()
    expect(ready.triggers).toBeUndefined()
    expect(sceneText(ready)).toContain('W1AW')

    s.advance(1_000)
    await s.event('refresh', 'refresh:reports')
    await settle()
    const pending = await s.render()
    expect(pending.triggers).toEqual(['tick:1'])
    expect(sceneText(pending)).toContain('W1AW')
    expect(sceneText(pending)).toContain('Sort: Receiver ▾')
    await s.event('refresh', 'refresh:reports')
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
    expect(sceneText(completed)).toContain('Sort: Receiver ▾')
    expect(sceneText(completed)).toContain(outcome === 'success' ? 'K2XYZ' : 'History unavailable')
    expect(fetch).toHaveBeenCalledTimes(2)

    await s.event('details', 'details:toggle')
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
  await s.event('refresh', 'refresh:reports', false)
  expect(fetch).toHaveBeenCalledTimes(1)
  request.resolve(historyResponse())
  await settle()
  const completed = await s.render('one', false)
  expect(completed.triggers).toBeUndefined()
  expect(sceneText(completed)).not.toContain('W1AW')
})
