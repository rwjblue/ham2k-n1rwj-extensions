import type { FetchResponse, PanelContent, PanelRenderArgs } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { renderReceptionScene } from '../../../../packages/reception/src/ui/scene.ts'
import { environment } from '../../../../packages/reception/tests/environment.ts'
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

it('keeps suffixes exact and filters stale or unrelated reports', () => {
  expect(
    pskPanelModel({ ...args, config: { watchCall: 'N1RWJ/P' } }, [report], now, connection).rows,
  ).toEqual([])
  expect(pskPanelModel(args, [report], now + 16 * 60_000, connection).rows).toEqual([])
  expect(pskPanelModel(args, [report], now - 120_000, connection).rows).toEqual([])
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
    expect(sceneText(await s.render())).toMatch(/(?:request|history).*duration:.*15000 ms/i)
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
