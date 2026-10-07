import type {
  JSONValue,
  PanelContent,
  PanelEnvironment,
  PanelRenderArgs,
} from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createRbnClient } from '../src/data/client.ts'
import { createReceiverData } from '../src/data/receivers.ts'
import type { RbnSnapshot } from '../src/model.ts'
import { createRbnPanel as createPanel, panelModel } from '../src/panel.ts'
import { payload, spotPayload } from './data/fixtures.ts'

const typography = {
  fontFamily: null,
  fontFamilyFallback: [],
  fontSize: 14,
  scaledFontSize: 14,
  fontWeight: 400,
  lineHeight: 1.3,
  letterSpacing: 0,
}
const environment: PanelEnvironment = {
  version: 1,
  width: 1200,
  height: 800,
  safeInsets: { left: 0, top: 0, right: 0, bottom: 0 },
  brightness: 'light',
  colors: {
    surface: '#ffffff',
    surfaceContainer: '#f3f6f8',
    onSurface: '#172832',
    onSurfaceVariant: '#526876',
    accent: '#086f63',
    primary: '#086f63',
    onPrimary: '#ffffff',
    secondary: '#086f63',
    outline: '#cbd8df',
    outlineVariant: '#cbd8df',
    error: '#ba1a1a',
    onError: '#ffffff',
  },
  typography: {
    body: typography,
    label: typography,
    title: { ...typography, fontSize: 20, scaledFontSize: 20 },
    display: typography,
    mono: typography,
  },
  locale: 'en',
  textDirection: 'ltr',
  devicePixelRatio: 2,
  reducedMotion: true,
  highContrast: false,
}
const now = Date.UTC(2026, 8, 21, 14)
const args: PanelRenderArgs = {
  panelKey: 'my-signal',
  instanceId: 'test-panel',
  environment,
  operation: { stationCall: 'K8BTU/TEST', grid: 'EM99dq' },
  qsoCount: 0,
  reason: 'tick',
  config: { watchCall: 'K8BTU' },
}
const snapshot: RbnSnapshot = {
  call: 'K8BTU',
  windowMinutes: 15,
  status: 'ready',
  lastAttemptMs: now,
  lastSuccessMs: now,
  error: null,
  capped: false,
  reports: [
    {
      id: '1',
      call: 'K8BTU',
      receiver: 'W1NT',
      frequencyKhz: 7034,
      band: '40m',
      mode: 'CW',
      snrDb: 0,
      wpm: 20,
      timeMs: now - 60_000,
      receiverLatitude: 43,
      receiverLongitude: -71,
      country: 'United States',
    },
    {
      id: '2',
      call: 'K8BTU',
      receiver: 'UNKNOWN',
      frequencyKhz: 7034,
      band: '40m',
      mode: 'CW',
      snrDb: null,
      wpm: null,
      timeMs: now - 120_000,
      receiverLatitude: null,
      receiverLongitude: null,
      country: null,
    },
  ],
}

const renderedPanels = new WeakMap<
  ReturnType<typeof createPanel>,
  { scenes: Map<string, PanelContent>; sequence: number }
>()

function createRbnPanel(...parameters: Parameters<typeof createPanel>) {
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

function sceneText(content: PanelContent): string {
  if (content.kind !== 'scene') throw new Error('Expected native scene')
  return content.scene.layers.map((layer) => layer.text?.literal ?? '').join('\n')
}
function sceneState(content: PanelContent) {
  if (content.kind !== 'scene') throw new Error('Expected native scene')
  return content.scene
}
function setup(current = snapshot) {
  const getSnapshot = vi.fn().mockResolvedValue(current)
  return {
    getSnapshot,
    panel: createRbnPanel({ client: { getSnapshot }, now: () => now, settings: async () => ({}) }),
  }
}
function event(
  panel: ReturnType<typeof createRbnPanel>,
  controlId: string,
  text?: string,
  extra: Partial<PanelRenderArgs> = {},
) {
  const renderArgs = { ...args, ...extra }
  const state = renderedPanels.get(panel)
  const content = state?.scenes.get(renderArgs.instanceId ?? '')
  const control = content && sceneState(content).controls?.find((entry) => entry.id === controlId)
  const action = control?.menu
    ? control.menu.find((item) => item.event.endsWith(`:${text}`))?.event
    : control?.event
  if (!state || !control || !action) throw new Error(`Missing rendered control ${controlId}`)
  const native = control.kind === 'nativeDropdown' || control.kind === 'nativeSegmented'
  return {
    ...renderArgs,
    event: {
      controlId,
      action,
      phase: native ? ('commit' as const) : ('activate' as const),
      sequence: ++state.sequence,
      ...(native ? { text } : {}),
    },
  }
}
async function detailsText(panel: ReturnType<typeof createRbnPanel>, renderArgs: PanelRenderArgs) {
  const pages: string[] = []
  for (let page = 0; page < 30; page++) {
    const content = await panel.render(renderArgs, { online: true })
    pages.push(sceneText(content))
    if (
      content.kind !== 'scene' ||
      !content.scene.controls?.some((control) => control.id === 'next')
    )
      return pages.join('\n')
    await panel.onEvent?.(event(panel, 'next', undefined, renderArgs), { online: true })
  }
  throw new Error('Status details did not reach their final page')
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

describe('RBN native panel integration', () => {
  it.each([320, 390])(
    'uses compact menus for band, window, and view on a %dpx phone',
    async (width) => {
      const { panel, getSnapshot } = setup()
      const phone = { ...args, environment: { ...environment, width, height: 800 } }
      const initial = await panel.render(phone, { online: true })
      for (const id of ['band', 'window', 'view'])
        expect(sceneState(initial).controls?.find((control) => control.id === id)).toMatchObject({
          kind: 'nativeButton',
          variant: 'outlined',
          menu: expect.any(Array),
        })
      const before = getSnapshot.mock.calls.length
      await panel.onEvent?.(event(panel, 'band', '20m', phone), { online: true })
      await panel.onEvent?.(event(panel, 'window', '30', phone), { online: true })
      await panel.onEvent?.(event(panel, 'view', 'list', phone), { online: true })
      expect(getSnapshot).toHaveBeenCalledTimes(before)
      const selected = await panel.render(phone, { online: true })
      expect(sceneState(selected).strings).toMatchObject({
        band: '20m',
        window: '30',
        view: 'list',
      })
      for (const [id, label] of [
        ['band', '20m ▾'],
        ['window', '30 min ▾'],
        ['view', 'List ▾'],
      ])
        expect(sceneState(selected).controls?.find((control) => control.id === id)?.label).toBe(
          label,
        )
      expect(sceneText(selected)).toContain('No 20m reports in this time window.')
      expect(sceneText(selected)).not.toContain('W1NT')
      expect(
        sceneState(selected).layers.some((layer) => layer.id.startsWith('reception-map-')),
      ).toBe(false)
      expect(getSnapshot).toHaveBeenLastCalledWith(
        { call: 'K8BTU', windowMinutes: 30 },
        { instanceId: args.instanceId, online: true, waitForRequest: false },
      )
      await panel.onEvent?.(event(panel, 'refresh', undefined, phone), { online: true })
      expect(getSnapshot).toHaveBeenLastCalledWith(
        { call: 'K8BTU', windowMinutes: 30 },
        { force: true, instanceId: args.instanceId, online: true, waitForRequest: false },
      )
      await panel.onEvent?.(event(panel, 'details', undefined, phone), { online: true })
      expect(await detailsText(panel, phone)).toContain('Last 30 minutes')
      await panel.onEvent?.(event(panel, 'details', undefined, phone), { online: true })
      await panel.render(phone, { online: true })
      await panel.onEvent?.(event(panel, 'band', 'all', phone), { online: true })
      await panel.onEvent?.(event(panel, 'view', 'both', phone), { online: true })
      const restored = await panel.render(phone, { online: true })
      expect(sceneState(restored).strings).toMatchObject({
        band: 'all',
        window: '30',
        view: 'both',
      })
      expect(sceneText(restored)).toContain('W1NT')
      expect(
        sceneState(restored).layers.some((layer) => layer.id.startsWith('reception-map-')),
      ).toBe(true)
      expect(phone.config).toEqual(args.config)
    },
  )

  it.each([320, 390])(
    'rejects invalid, hidden, and stale compact menu actions on a %dpx phone',
    async (width) => {
      const { panel, getSnapshot } = setup()
      const phone = { ...args, environment: { ...environment, width, height: 800 } }
      const initial = await panel.render(phone, { online: true })
      for (const [id, value] of [
        ['band', '20m'],
        ['window', '30'],
        ['view', 'map'],
      ]) {
        const choice = event(panel, id, value, phone)
        for (const invalid of [
          { ...choice.event, phase: 'commit' as const },
          { ...choice.event, phase: 'change' as const },
          { ...choice.event, action: `${choice.event.action}:invalid` },
          { ...choice.event, controlId: id === 'band' ? 'window' : 'band' },
        ])
          expect(await panel.onEvent?.({ ...phone, event: invalid }, { online: true })).toEqual({
            values: {},
          })
      }
      expect(getSnapshot).toHaveBeenCalledTimes(1)
      expect(await panel.render(phone, { online: true })).toEqual(initial)
      const hidden = event(panel, 'window', '30', phone)
      await panel.onEvent?.(event(panel, 'details', undefined, phone), { online: true })
      const details = await panel.render(phone, { online: true })
      expect(await panel.onEvent?.(hidden, { online: true })).toEqual({ values: {} })
      expect(await panel.render(phone, { online: true })).toEqual(details)
      await panel.onEvent?.(event(panel, 'details', undefined, phone), { online: true })
      await panel.render(phone, { online: true })
      const obsolete = event(panel, 'band', '20m', phone)
      const current = { ...phone, operation: { ...phone.operation, uuid: 'another-operation' } }
      const fresh = await panel.render(current, { online: true })
      expect(
        await panel.onEvent?.({ ...current, event: obsolete.event }, { online: true }),
      ).toEqual({ values: {} })
      expect(await panel.render(current, { online: true })).toEqual(fresh)
    },
  )

  it('uses a temporary Report window for queries, collection ownership, details, and refresh per placement', async () => {
    const getSnapshot = vi.fn().mockResolvedValue(snapshot)
    const observeCollection = vi.fn()
    const panel = createRbnPanel({
      client: { getSnapshot },
      now: () => now,
      settings: async () => ({}),
      observeCollection,
    })
    const originalConfig = { ...args.config }
    await panel.render(args, { online: true })
    expect(sceneState(await panel.render(args, { online: true })).strings?.window).toBe('15')
    const before = getSnapshot.mock.calls.length
    expect(await panel.onEvent?.(event(panel, 'window', '30'), { online: true })).toEqual({
      values: {},
      strings: { window: '30' },
    })
    // Selection changes do not perform a forced request inside the event.
    expect(getSnapshot).toHaveBeenCalledTimes(before)
    const selected = await panel.render(args, { online: true })
    expect(sceneState(selected).strings?.window).toBe('30')
    expect(getSnapshot).toHaveBeenLastCalledWith(
      { call: 'K8BTU', windowMinutes: 30 },
      { instanceId: args.instanceId, online: true, waitForRequest: false },
    )
    expect(observeCollection).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: { ...args.config, windowMinutes: 30 } }),
      now,
    )
    const other = { ...args, instanceId: 'another-placement' }
    expect(sceneState(await panel.render(other, { online: true })).strings?.window).toBe('15')
    expect(getSnapshot.mock.calls[getSnapshot.mock.calls.length - 1]?.[0]).toEqual({
      call: 'K8BTU',
      windowMinutes: 15,
    })
    await panel.onEvent?.(event(panel, 'refresh'), { online: true })
    expect(getSnapshot).toHaveBeenLastCalledWith(
      { call: 'K8BTU', windowMinutes: 30 },
      { force: true, instanceId: args.instanceId, online: true, waitForRequest: false },
    )
    expect(
      observeCollection.mock.calls[observeCollection.mock.calls.length - 1]?.[0].config
        .windowMinutes,
    ).toBe(30)
    await panel.onEvent?.(event(panel, 'details'), { online: true })
    expect(await detailsText(panel, args)).toContain('Last 30 minutes')
    expect(args.config).toEqual(originalConfig)
  })

  it('preserves a Report window across unrelated settings and resets it when its saved default or operation changes', async () => {
    const { panel, getSnapshot } = setup()
    await panel.render(args, { online: true })
    await panel.onEvent?.(event(panel, 'window', '60'), { online: true })
    const unrelated = { ...args, config: { ...args.config, projection: 'azimuthal' } }
    expect(sceneState(await panel.render(unrelated, { online: true })).strings?.window).toBe('60')
    expect(getSnapshot.mock.calls[getSnapshot.mock.calls.length - 1]?.[0].windowMinutes).toBe(60)
    const saved = { ...unrelated, config: { ...unrelated.config, windowMinutes: 5 } }
    expect(sceneState(await panel.render(saved, { online: true })).strings?.window).toBe('5')
    await panel.onEvent?.(event(panel, 'window', '30', saved), { online: true })
    const nextOperation = { ...saved, operation: { ...saved.operation, uuid: 'new-operation' } }
    expect(sceneState(await panel.render(nextOperation, { online: true })).strings?.window).toBe(
      '5',
    )
    expect(getSnapshot.mock.calls[getSnapshot.mock.calls.length - 1]?.[0]).toEqual({
      call: 'K8BTU',
      windowMinutes: 5,
    })
    await panel.onEvent?.(event(panel, 'window', '30', nextOperation), { online: true })
    const clearedOperation = { ...saved, operation: {} }
    expect(sceneState(await panel.render(clearedOperation, { online: true })).strings?.window).toBe(
      '5',
    )
    expect(sceneState(await setup().panel.render(args, { online: true })).strings?.window).toBe(
      '15',
    )
  })

  it('keeps Report window changes behind the existing server rate limit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, body: JSON.stringify({ error: { retryAfter: 120 } }) })
      .mockResolvedValue({ status: 200, body: JSON.stringify(payload({ spots: [], total: 0 })) })
    const client = createRbnClient({ fetch })
    const panel = createRbnPanel({ client, settings: async () => ({}) })
    const at = (elapsed: number) => ({
      ...args,
      clock: { nowMillis: now, realNowMillis: now + elapsed },
    })
    await panel.render(at(0), { online: true })
    await client.getSnapshot({ call: 'K8BTU', windowMinutes: 15 }, { realNowMillis: now })
    await panel.render(at(0), { online: true })
    await panel.onEvent?.(event(panel, 'window', '30', at(0)), { online: true })
    await panel.render(at(0), { online: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(sceneState(await panel.render(at(119_999), { online: true })).strings?.window).toBe('30')
    expect(fetch).toHaveBeenCalledTimes(1)
    await panel.render(at(120_000), { online: true })
    await client.getSnapshot({ call: 'K8BTU', windowMinutes: 30 }, { realNowMillis: now + 120_000 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[0]).toContain(`since=${Math.floor((now + 120_000) / 1000) - 1800}`)
  })

  it('separates snapshot freshness, report interpretation, and request diagnostics', () => {
    const model = panelModel(args, { ...snapshot, lastRequestDurationMs: 217 }, now)
    expect(model.details?.facts).toEqual([
      { label: 'Direction', value: 'Who hears me' },
      { label: 'Window', value: 'Last 15 minutes' },
      { label: 'Last successful check', value: '14:00:00 UTC' },
      { label: 'Source', value: 'RBN via Vail ReRBN' },
    ])
    expect(model.lastReport).toBe('1 min ago')
    expect(model.details?.activity).toEqual(['Last request duration: 217 ms.'])
    expect(model.warnings).toContain(
      'TEST OPERATION — observing K8BTU; these reports belong to that station.',
    )
    const about = model.details?.sections.flatMap((section) => section.paragraphs).join(' ')
    expect(about).toContain('Changing the watched callsign does not move the map origin')
    expect(about).toContain('one receiver, band, and mode')
    expect(about).toContain('An empty result does not prove')
    expect(about).toContain('includes time until the next panel render observed completion')
    expect(about).toContain('A recent check can return older reports or no reports')
    expect(model.note).toBeUndefined()
    expect(model.presentation?.details).toBeUndefined()
  })

  it('keeps a complete failure once and never reports an unsuccessful check as successful', () => {
    const error = 'Request failed. Host detail: an exact diagnostic; retry later.'
    const model = panelModel(
      args,
      {
        ...snapshot,
        status: 'error',
        reports: [],
        error,
        storageWarning: error,
        lastSuccessMs: null,
        lastRequestDurationMs: 1000,
        lastRequestDurationUpperBound: true,
        refresh: { state: 'rate-limit', manualAtMs: now + 120000, automaticAtMs: now + 120000 },
      },
      now,
    )
    expect(model.warnings?.filter((warning) => warning === error)).toHaveLength(1)
    expect(model.fetchedAt).toBeUndefined()
    expect(model.details?.facts).toContainEqual({
      label: 'Last successful check',
      value: 'None yet',
    })
    expect(model.details?.activity).toEqual([
      'Last request attempt: 14:00:00 UTC.',
      'Last request duration: up to 1000 ms.',
      'Requests paused after HTTP 429; wait until the retry time below.',
      'Manual refresh allowed from 14:02:00 UTC. Automatic check eligible from 14:02:00 UTC while visible.',
    ])
  })

  it('keeps failure and request diagnostics readable across phone status pages without duplicating the error', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('TimeoutException: Future not completed'))
    const panel = createRbnPanel({ client: createRbnClient({ fetch }), settings: async () => ({}) })
    const phoneArgs = {
      ...args,
      environment: { ...environment, width: 393, height: 700 },
      clock: { nowMillis: now, realNowMillis: now },
    }
    await panel.render(phoneArgs, { online: true })
    await panel.onEvent?.(event(panel, 'details', undefined, phoneArgs), { online: true })
    // Observe completion before checking the following render's cooldown details.
    await panel.render(phoneArgs, { online: true })
    const result = (await detailsText(panel, phoneArgs)).replace(/\s+/g, ' ')
    expect(result).toContain('request timed out')
    expect(result).not.toContain('request budget')
    expect(result).toContain('Host detail: TimeoutException: Future not completed')
    expect(result).toContain('Last request attempt: 14:00:00 UTC')
    expect(result).toContain('None yet')
    expect(result).toContain('Local refresh cooldown')
    expect(result).toContain('Manual refresh is available now')
    expect(result).toContain('Automatic check eligible from 14:01:00 UTC')
    expect(result.match(/Host detail:/g)).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['rate-limit', 'rate limited'],
    ['timeout', 'request timed out'],
    ['request', 'request failed'],
    ['http', 'HTTP error'],
    ['response', 'invalid response'],
    ['offline', 'offline'],
  ] as const)('identifies %s in the collapsed status', (failureKind, label) => {
    const model = panelModel(
      args,
      { ...snapshot, status: 'stale', error: 'Failure detail.', failureKind },
      now,
    )
    expect(model.status).toBe(`Cached · ${label}`)
    expect(model.details?.activity?.join(' ')).not.toContain('Failure detail.')
    expect(model.warnings?.join(' ')).toContain('Failure detail.')
  })
  it('keeps My Signal queries, maps, and receiver reports independent of Spots filters', async () => {
    let preferences: Record<string, JSONValue> = {}
    const getSnapshot = vi.fn().mockResolvedValue(snapshot)
    const panel = createRbnPanel({
      client: { getSnapshot },
      now: () => now,
      settings: async () => preferences,
    })
    const before = await panel.render(args, { online: true })
    expect(sceneText(before)).toContain('W1NT')
    expect(sceneText(before)).toContain('UNKNOWN')
    preferences = {
      extensions: {
        'extension_n1rwj-rbn': {
          spotCallFilter: 'unavailable-history-provider',
          spotMode: 'FT8',
          spotSkimmers: 'DL1AAA',
          spotGrids: 'JO',
          spotContinents: ['EU'],
          spotRadiusGrid: 'JO31',
          spotRadiusMiles: 1,
        },
      },
    }
    // These restrictions exclude both fixture receivers from Spots. Neither
    // located nor unlocated My Signal reports may disappear, even after restart.
    expect(await panel.render(args, { online: true })).toEqual(before)
    const restarted = createRbnPanel({
      client: { getSnapshot },
      now: () => now,
      settings: async () => preferences,
    })
    expect(await restarted.render(args, { online: true })).toEqual(before)
    expect(getSnapshot).toHaveBeenCalledTimes(3)
    for (const [query] of getSnapshot.mock.calls) {
      expect(query).toEqual({ call: 'K8BTU', windowMinutes: 15 })
    }
  })
  it('applies directory updates to cached reports on the next render and falls back after removal', async () => {
    const receivers = createReceiverData()
    const current = { ...snapshot, reports: [{ ...snapshot.reports[0], country: null }] }
    const panel = createRbnPanel({
      client: { getSnapshot: async () => current },
      now: () => now,
      settings: async () => ({}),
      enrichReports: receivers.enrichReports,
    })
    const before = await panel.render(args, { online: false })
    expect(sceneText(before)).toContain('Country unknown')
    receivers.dataFile.onLoadRawData({
      schema: 1,
      nodes: [{ call: 'W1NT', grid: 'FN43', country: 'United States' }],
    })
    expect(sceneText(await panel.render(args, { online: false }))).toContain('United States')
    expect(current.reports[0].country).toBeNull()
    await receivers.dataFile.onRemoveRawData()
    expect(await panel.render(args, { online: false })).toEqual(before)
  })
  it('registers the stable panel identity and bounded refresh triggers', async () => {
    const { panel } = setup()
    expect((await panel.getPanels({}, { online: true }))[0]).toMatchObject({
      key: 'my-signal',
      multiple: true,
      on: ['operation', 'tick:60'],
    })
  })
  it('renders immediately while the first request runs, then returns to the normal cadence', async () => {
    let clock = now
    const request = deferred<{ status: number; body: string }>()
    const fetch = vi.fn(() => request.promise)
    const client = createRbnClient({ fetch, now: () => clock })
    const panel = createRbnPanel({ client, now: () => clock, settings: async () => ({}) })
    const pending = await panel.render(args, { online: true })
    expect(pending.triggers).toEqual(['tick:1'])
    expect(sceneText(pending)).toContain('Checking Vail ReRBN…')
    expect(sceneText(pending)).not.toContain('unavailable')
    clock += 1_000
    expect((await panel.render(args, { online: true })).triggers).toEqual(['tick:1'])
    expect(fetch).toHaveBeenCalledTimes(1)

    clock += 5_250
    const finished = client.getSnapshot({ call: 'K8BTU', windowMinutes: 15 })
    request.resolve({
      status: 200,
      body: JSON.stringify(
        payload({
          spots: [
            spotPayload({ callsign: 'K8BTU', timestamp: new Date(now - 60_000).toISOString() }),
          ],
        }),
      ),
    })
    await finished
    const ready = await panel.render(args, { online: true })
    expect(ready.triggers).toBeUndefined()
    expect(sceneText(ready)).toContain('Recent reports')
    expect(sceneText(ready)).toContain('W3LPL')
    expect(fetch).toHaveBeenCalledTimes(1)
    await panel.onEvent?.(event(panel, 'details', undefined), { online: true })
    expect(await detailsText(panel, args)).toContain('Last request duration: 6250 ms.')
  })
  it('shows a pending refresh and request duration without presenting pending work as a failure', () => {
    const refreshing: RbnSnapshot = {
      ...snapshot,
      refresh: { state: 'pending', manualAtMs: null, automaticAtMs: null },
      lastRequestDurationMs: 217,
    }
    const pending = panelModel(args, refreshing, now)
    expect(pending.status).toBe('Cached · refreshing')
    expect(pending.statusKind).toBe('cached')
    expect(pending.details?.activity?.join(' ')).toContain('Request in progress')
    expect(pending.details?.activity?.join(' ')).toContain('Refresh reuses this request')
    expect(pending.details?.activity?.join(' ')).not.toContain('Manual refresh is available')
    expect(pending.details?.activity?.join(' ')).not.toContain('Last request duration')
    expect(pending.warnings?.join(' ')).not.toContain('request')
    expect(
      panelModel(args, { ...snapshot, lastRequestDurationMs: 217 }, now).details?.activity?.join(
        ' ',
      ),
    ).toContain('Last request duration: 217 ms.')
    expect(
      panelModel(
        args,
        {
          ...snapshot,
          lastRequestDurationMs: 1000,
          lastRequestDurationUpperBound: true,
        },
        now,
      ).details?.activity?.join(' '),
    ).toContain('Last request duration: up to 1000 ms.')
  })
  it('reuses reports on reveal until 60 seconds since the last request, even across placements', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      body: JSON.stringify(
        payload({
          spots: [
            spotPayload({ callsign: 'K8BTU', timestamp: new Date(now - 60_000).toISOString() }),
          ],
        }),
      ),
    }))
    const client = createRbnClient({ fetch, now: () => now })
    const makePanel = () => createRbnPanel({ client, settings: async () => ({}) })
    let panel = makePanel()
    const renderAt = (elapsed: number, reason: string, extra: Partial<PanelRenderArgs> = {}) =>
      panel.render(
        {
          ...args,
          ...extra,
          reason,
          // Network age must follow real time even when display time travels.
          clock: { nowMillis: now + 86_400_000, realNowMillis: now + elapsed },
        },
        { online: true },
      )
    await renderAt(0, 'initial')
    await client.getSnapshot({ call: 'K8BTU', windowMinutes: 15 }, { realNowMillis: now })
    const initial = await renderAt(0, 'tick')
    expect(sceneText(initial)).toContain('Recent reports')
    expect(sceneText(initial)).toContain('W3LPL')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await renderAt(30_000, 'visible')).toEqual(initial)
    await renderAt(45_000, 'config', { config: { ...args.config, view: 'list', band: '40m' } })
    // Placement/UI state can be recreated without losing the extension-wide client cache.
    panel = makePanel()
    expect(await renderAt(59_999, 'initial', { instanceId: 'another-placement' })).toEqual(initial)
    expect(fetch).toHaveBeenCalledTimes(1)
    await renderAt(60_000, 'visible')
    expect(fetch).toHaveBeenCalledTimes(2)
    await renderAt(60_001, 'tick')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('refreshes within the visibility lease and stops after a long absence', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(now)
      const fetch = vi.fn(async () => ({
        status: 200,
        body: JSON.stringify(payload({ spots: [], total: 0 })),
      }))
      const panel = createRbnPanel({
        client: createRbnClient({
          fetch,
          timers: {
            setTimeout: (callback, delay) => Number(setTimeout(callback, delay)),
            clearTimeout: (id) => clearTimeout(id),
          },
        }),
        settings: async () => ({}),
      })
      await panel.getPanels({}, { online: true })
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(fetch).not.toHaveBeenCalled()
      await panel.render({ ...args, reason: 'initial' }, { online: true })
      expect(fetch).toHaveBeenCalledTimes(1)
      // One refresh may run during the 75-second lease. Without another host
      // render, that lease expires and every subsequent refresh is cancelled.
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(fetch).toHaveBeenCalledTimes(2)
      await panel.render({ ...args, reason: 'visible' }, { online: true })
      expect(fetch).toHaveBeenCalledTimes(3)
      await panel.render({ ...args, reason: 'tick' }, { online: true })
      expect(fetch).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })
  it('explains missing panel context before any network or settings work', async () => {
    const { panel, getSnapshot } = setup()
    for (const extra of [{ environment: undefined }, { instanceId: undefined }]) {
      const result = await panel.render({ ...args, ...extra }, { online: true })
      expect(result.kind).toBe('markdown')
      expect('content' in result && result.content).toContain(
        'extension API 5 and native panel controls',
      )
    }
    expect(getSnapshot).not.toHaveBeenCalled()
  })
  it('manually refreshes immediately without refetching on the post-event render', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      body: JSON.stringify(payload({ spots: [], total: 0 })),
    }))
    const panel = createRbnPanel({ client: createRbnClient({ fetch }), settings: async () => ({}) })
    const clockAt = (elapsed: number) => ({
      nowMillis: now - 86_400_000,
      realNowMillis: now + elapsed,
    })
    await panel.render({ ...args, clock: clockAt(0) }, { online: true })
    await Promise.all([
      panel.onEvent?.(event(panel, 'refresh', undefined, { clock: clockAt(1) }), { online: true }),
      panel.onEvent?.(event(panel, 'refresh', undefined, { clock: clockAt(1) }), { online: true }),
    ])
    expect(fetch).toHaveBeenCalledTimes(2)
    const refreshed = await panel.render(
      { ...args, clock: clockAt(1), reason: 'event' },
      { online: true },
    )
    expect(sceneText(refreshed)).toContain('No recent reports')
    expect(fetch).toHaveBeenCalledTimes(2)
    await panel.render({ ...args, clock: clockAt(60_000) }, { online: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    await panel.render({ ...args, clock: clockAt(60_001) }, { online: true })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('returns from manual refresh while HTTP is pending, reuses it, and preserves display choices on failure', async () => {
    let clock = now
    const request = deferred<{ status: number; body: string }>()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify(
          payload({
            spots: [
              spotPayload({
                callsign: 'K8BTU',
                timestamp: new Date(now - 60_000).toISOString(),
                frequency: 7034,
              }),
            ],
          }),
        ),
      })
      .mockImplementation(() => request.promise)
    const client = createRbnClient({ fetch, now: () => clock })
    await client.getSnapshot({ call: 'K8BTU', windowMinutes: 15 })
    const getSnapshot = vi.spyOn(client, 'getSnapshot')
    const panel = createRbnPanel({ client, now: () => clock, settings: async () => ({}) })
    const configured = { ...args, config: { ...args.config, view: 'list', band: '40m' } }
    await panel.render(configured, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call', configured), { online: true })
    clock += 1
    await panel.onEvent?.(event(panel, 'refresh', undefined, configured), { online: true })
    expect(getSnapshot).toHaveBeenLastCalledWith(
      { call: 'K8BTU', windowMinutes: 15 },
      { instanceId: 'test-panel', force: true, online: true, waitForRequest: false },
    )
    const pending = await panel.render(configured, { online: true })
    expect(pending.triggers).toEqual(['tick:1'])
    expect(sceneText(pending)).toContain('Cached · refreshing')
    expect(sceneText(pending)).toContain('W3LPL')
    expect(sceneState(pending).strings?.sort).toBe('call')
    await panel.onEvent?.(event(panel, 'refresh', undefined, configured), { online: true })
    await panel.render(configured, { online: true })
    expect(fetch).toHaveBeenCalledTimes(2)

    clock += 15_000
    const finished = client.getSnapshot({ call: 'K8BTU', windowMinutes: 15 })
    request.reject(new Error('TimeoutException after 0:00:15: Future not completed'))
    await finished
    const failed = await panel.render(configured, { online: true })
    expect(failed.triggers).toBeUndefined()
    expect(sceneText(failed)).toContain('Cached · request timed out')
    expect(sceneText(failed)).toContain('W3LPL')
    expect(sceneState(failed).strings?.sort).toBe('call')
    expect(fetch).toHaveBeenCalledTimes(2)
    await panel.onEvent?.(event(panel, 'details', undefined, configured), { online: true })
    const details = await detailsText(panel, configured)
    expect(details).toContain('Last request duration: 15000 ms.')
    expect(details).toContain('Host detail: TimeoutException')
  })
  it('keeps manual refresh offline and rate-limit protections across callsigns', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, body: JSON.stringify({ error: { retryAfter: 120 } }) })
      .mockResolvedValue({ status: 200, body: JSON.stringify(payload({ spots: [], total: 0 })) })
    const client = createRbnClient({ fetch })
    const panel = createRbnPanel({ client, settings: async () => ({}) })
    const refreshAt = async (elapsed: number, online = true) => {
      const extra = {
        config: { watchCall: elapsed === 0 ? 'K8BTU' : 'N1RWJ', windowMinutes: 30 },
        clock: { nowMillis: now - 86_400_000, realNowMillis: now + elapsed },
      }
      // Establish the actual visible control without starting an automatic request.
      await panel.render({ ...args, ...extra }, { online: false })
      return panel.onEvent?.(event(panel, 'refresh', undefined, extra), { online })
    }
    await refreshAt(0, false)
    expect(fetch).not.toHaveBeenCalled()
    await refreshAt(0)
    const query = { call: 'K8BTU', windowMinutes: 30 }
    await client.getSnapshot(query, { realNowMillis: now })
    await client.getSnapshot(query, { realNowMillis: now })
    expect(fetch).toHaveBeenCalledTimes(1)
    await refreshAt(60_000)
    await refreshAt(119_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await refreshAt(120_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toContain('call=N1RWJ&since=')
  })
  it('uses the real clock for networking and stale report ages', async () => {
    const { panel, getSnapshot } = setup({ ...snapshot, status: 'stale', error: 'Offline.' })
    const result = await panel.render(
      { ...args, clock: { nowMillis: now - 604800000, realNowMillis: now + 60000 } },
      { online: false },
    )
    expect(getSnapshot).toHaveBeenCalledWith(
      { call: 'K8BTU', windowMinutes: 15 },
      {
        instanceId: 'test-panel',
        online: false,
        realNowMillis: now + 60000,
        waitForRequest: false,
      },
    )
    expect(sceneText(result)).toContain('2 min')
    expect(sceneText(result)).toContain('Cached')
  })
  it('keeps unknown receiver measurements and zero SNR; derives location only from exact coordinates', () => {
    const model = panelModel(args, snapshot, now)
    expect(model.rows[0]).toMatchObject({ call: 'W1NT', snrDb: 0, age: '1 min ago' })
    expect(model.rows[0].distanceKm).toBeGreaterThan(800)
    expect(model.rows[1].distanceKm).toBeUndefined()
    expect(model.warnings?.join(' ')).toContain('TEST OPERATION — observing K8BTU')
    expect(model.fetchedAt).toBe('14:00:00 UTC')
    expect(model.mapOptions?.stations).toHaveLength(1)
    expect(model.bands).toEqual([
      'all',
      '160m',
      '80m',
      '60m',
      '40m',
      '30m',
      '20m',
      '17m',
      '15m',
      '12m',
      '10m',
      '6m',
    ])
    expect(model.mapOptions?.origin?.label).toBe('K8BTU')
  })
  it('filters the map and list by the latest SNR per receiver, band, and mode', () => {
    const reports = [
      { ...snapshot.reports[0], id: 'strong-old', snrDb: 30, timeMs: now - 120_000 },
      { ...snapshot.reports[0], id: 'weak-new', snrDb: 9 },
      { ...snapshot.reports[0], id: 'other-mode', mode: 'RTTY', snrDb: 10 },
      { ...snapshot.reports[0], id: 'other-band', band: '20m', snrDb: 15 },
      { ...snapshot.reports[0], id: 'weak-station', receiver: 'WEAK', snrDb: 5 },
      snapshot.reports[1],
    ]
    const current = { ...snapshot, reports }
    const model = panelModel({ ...args, config: { ...args.config, minSnrDb: 10 } }, current, now)
    expect(model.rows.map((row) => [row.call, row.band, row.mode, row.snrDb])).toEqual([
      ['W1NT', '40m', 'RTTY', 10],
      ['W1NT', '20m', 'CW', 15],
    ])
    expect(model.mapOptions?.stations.map((station) => station.label)).toEqual(['W1NT'])
    expect(model.warnings).not.toContain('Unlocated receivers are listed but not mapped.')
    expect(model.status).toContain('≥ 10 dB')
    expect(model.details?.facts).toContainEqual({
      label: 'Minimum SNR',
      value: '10 dB (inclusive)',
    })
    // Filtering never rewrites the cached snapshot or substitutes an older strong report.
    expect(current.reports).toEqual(reports)
    expect(panelModel(args, current, now).rows).toHaveLength(5)
  })
  it.each([
    [-10, [-10, 0, 10]],
    [0, [0, 10]],
    [11, []],
  ])('handles a minimum SNR of %i including empty results', (minSnrDb, expected) => {
    const reports = [-20, -10, 0, 10, null, Number.NaN, Infinity].map((snrDb, index) => ({
      ...snapshot.reports[0],
      id: String(index),
      receiver: `RX${index}`,
      snrDb,
    }))
    const model = panelModel(
      { ...args, config: { ...args.config, minSnrDb } },
      { ...snapshot, reports },
      now,
    )
    expect(model.rows.map((row) => row.snrDb)).toEqual(expected)
    expect(model.mapOptions?.stations).toHaveLength(expected.length)
  })
  it('keeps saved SNR filtering per placement across refreshes and restart and restores reports when cleared', async () => {
    const { panel, getSnapshot } = setup()
    const configured = { ...args, config: { ...args.config, minSnrDb: 1 } }
    const filtered = await panel.render(configured, { online: true })
    expect(sceneText(filtered)).toContain('≥ 1 dB')
    expect(sceneText(filtered)).toContain('0 receivers')
    expect(sceneText(filtered)).not.toContain('W1NT')
    await panel.onEvent?.(event(panel, 'refresh', undefined, configured), { online: true })
    expect(await panel.render(configured, { online: true })).toEqual(filtered)
    expect(await setup().panel.render(configured, { online: true })).toEqual(filtered)
    expect(
      sceneText(await panel.render({ ...args, instanceId: 'other' }, { online: true })),
    ).toContain('W1NT')
    for (const minSnrDb of ['', null]) {
      const cleared = await panel.render(
        { ...configured, config: { ...configured.config, minSnrDb } },
        { online: true },
      )
      expect(sceneText(cleared)).toContain('W1NT')
      expect(sceneText(cleared)).toContain('UNKNOWN')
      expect(sceneText(cleared)).not.toContain('≥')
    }
    for (const [query] of getSnapshot.mock.calls) {
      expect(query).toEqual({ call: 'K8BTU', windowMinutes: 15 })
    }
  })
  it('passes every supported mode to the list while mapping a receiver only once', () => {
    const reports = ['CW', 'RTTY', 'FT8', 'FT4'].map((mode, index) => ({
      ...snapshot.reports[0],
      id: String(index),
      mode,
      wpm: mode === 'CW' ? 20 : null,
    }))
    const model = panelModel(args, { ...snapshot, reports }, now)
    expect(model.rows.map((row) => row.mode)).toEqual(reports.map((report) => report.mode))
    expect(model.rows.map((row) => row.wpm)).toEqual([20, undefined, undefined, undefined])
    expect(model.mapOptions?.stations).toHaveLength(1)
    expect(model.details?.sections.flatMap((section) => section.paragraphs).join(' ')).toContain(
      'CW, RTTY, FT8, and FT4 reports',
    )
    expect(model.details?.sections.flatMap((section) => section.paragraphs).join(' ')).toContain(
      'Reverse Beacon Network via Vail ReRBN',
    )
    expect(model.details?.sections.flatMap((section) => section.paragraphs).join(' ')).toContain(
      'HamDB registered grids',
    )
  })
  it('plots UNKNOWN when the receiver directory supplies its location', () => {
    const directory = createReceiverData()
    directory.dataFile.onLoadRawData({
      schema: 1,
      nodes: [{ call: 'UNKNOWN', grid: 'JO21BX', country: 'Kazakhstan', continent: 'AS' }],
    })
    const model = panelModel(
      args,
      { ...snapshot, reports: directory.enrichReports(snapshot.reports) },
      now,
    )
    const station = model.mapOptions?.stations.find((station) => station.key === 'UNKNOWN')
    expect(station).toMatchObject({ label: 'UNKNOWN', longitude: 4.125 })
    expect(station?.latitude).toBeCloseTo(51.9791667)
    expect(model.rows[1]).toMatchObject({ call: 'UNKNOWN', country: 'Kazakhstan' })
    expect(model.rows[1].distanceKm).toBeGreaterThan(0)
  })
  it('handles Home with no operation, keeps explicit overrides, and exposes error provenance', async () => {
    const home = { ...args, operation: undefined } as unknown as PanelRenderArgs
    const model = panelModel(
      home,
      { ...snapshot, status: 'stale', error: 'RBN request failed (503).', capped: true },
      now,
    )
    expect(model.mapOptions?.origin).toBeUndefined()
    expect(model.rows[0].distanceKm).toBeUndefined()
    expect(model.warnings?.join(' ')).toContain('503')
    expect(model.warnings?.join(' ')).toContain('500-report limit')
    const { panel, getSnapshot } = setup()
    expect((await panel.render(home, { online: true })).kind).toBe('scene')
    expect(getSnapshot).toHaveBeenCalledWith(
      { call: 'K8BTU', windowMinutes: 15 },
      { instanceId: 'test-panel', online: true, waitForRequest: false },
    )
    await panel.render({ ...home, config: {} }, { online: true })
    expect(getSnapshot).toHaveBeenLastCalledWith(
      { call: '', windowMinutes: 15 },
      { instanceId: 'test-panel', online: true, waitForRequest: false },
    )
  })
  it('applies saved view and band together and keeps them across refreshes per placement', async () => {
    const { panel } = setup()
    const initial = await panel.render(args, { online: true })
    expect(sceneText(initial)).toContain('W1NT')
    const changed = {
      ...args,
      config: { ...args.config, view: 'map', band: '15m' },
      reason: 'config',
    }
    const filtered = await panel.render(changed, { online: true })
    expect(sceneText(filtered)).toContain('15m · 0 receivers')
    expect(sceneText(filtered)).not.toContain('W1NT')
    expect(sceneState(filtered).controls?.some((control) => control.id === 'sort')).toBe(false)
    expect(await panel.render({ ...changed, reason: 'tick' }, { online: true })).toEqual(filtered)
    expect(
      sceneText(await panel.render({ ...args, instanceId: 'other' }, { online: true })),
    ).toContain('W1NT')
    const list = await panel.render(
      { ...changed, config: { ...changed.config, view: 'list' } },
      { online: true },
    )
    expect(sceneText(list)).toContain('No 15m reports in this time window.')
    expect(sceneState(list).controls?.find((control) => control.id === 'sort')).toMatchObject({
      kind: 'nativeDropdown',
      value: 'sort',
    })
    // Saved preferences are also authoritative after an extension restart.
    const restarted = await setup().panel.render(changed, { online: true })
    expect(sceneState(restarted).strings).toEqual(sceneState(filtered).strings)
    expect(sceneState(restarted).layers).toEqual(sceneState(filtered).layers)
  })
  it('selects native views per placement until the saved default changes', async () => {
    const { panel } = setup()
    expect(sceneState(await panel.render(args, { online: true })).strings?.view).toBe('both')
    await panel.onEvent?.(event(panel, 'band', '40m'), { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'snr'), { online: true })
    for (const view of ['map', 'list', 'both']) {
      expect(await panel.onEvent?.(event(panel, 'view', view), { online: true })).toEqual({
        values: {},
        strings: { view },
      })
      const rendered = await panel.render(args, { online: true })
      expect(sceneState(rendered).strings?.view).toBe(view)
      expect(sceneText(rendered)).toContain('40m · 2 receivers')
      expect(
        sceneState(await panel.render({ ...args, reason: 'tick' }, { online: true })).strings?.view,
      ).toBe(view)
    }
    await panel.onEvent?.(event(panel, 'view', 'map'), { online: true })
    expect(
      sceneState(await panel.render({ ...args, instanceId: 'other' }, { online: true })).strings
        ?.view,
    ).toBe('both')
    const unrelated = { ...args, config: { ...args.config, projection: 'azimuthal' } }
    expect(sceneState(await panel.render(unrelated, { online: true })).strings?.view).toBe('map')
    const saved = { ...unrelated, config: { ...unrelated.config, view: 'list' } }
    const list = await panel.render(saved, { online: true })
    expect(sceneState(list).strings).toMatchObject({ view: 'list', sort: 'snr', band: '40m' })
    expect(sceneText(list)).toContain('40m · 2 receivers')
    await panel.onEvent?.(event(panel, 'view', 'both', saved), { online: true })
    expect(sceneState(await setup().panel.render(saved, { online: true })).strings?.view).toBe(
      'list',
    )
    expect(
      sceneState(
        await panel.render(
          { ...saved, operation: { ...saved.operation, uuid: 'other' } },
          { online: true },
        ),
      ).strings?.view,
    ).toBe('list')
  })
  it('filters from the native Band choice until the saved Band changes', async () => {
    const { panel } = setup()
    await panel.render(args, { online: true })
    await panel.onEvent?.(event(panel, 'band', '20m'), { online: true })
    const filtered = await panel.render(args, { online: true })
    expect(sceneText(filtered)).toContain('20m · 0 receivers')
    expect(sceneText(filtered)).not.toContain('W1NT')
    if (filtered.kind !== 'scene') throw new Error('Expected native scene')
    expect(
      sceneText(await panel.render({ ...args, instanceId: 'other' }, { online: true })),
    ).toContain('W1NT')
    await panel.onEvent?.(event(panel, 'details', undefined), { online: true })
    expect(await detailsText(panel, args)).toContain('Latest report · 20m')
    await panel.onEvent?.(event(panel, 'details', undefined), { online: true })
    await panel.render(args, { online: true })
    await panel.onEvent?.(event(panel, 'band', 'all'), { online: true })
    expect(sceneText(await panel.render(args, { online: true }))).toContain('W1NT')
    await panel.onEvent?.(event(panel, 'band', '20m'), { online: true })
    const unrelated = { ...args, config: { ...args.config, view: 'list' } }
    expect(sceneText(await panel.render(unrelated, { online: true }))).toContain(
      'No 20m reports in this time window.',
    )
    const savedBand = { ...unrelated, config: { ...unrelated.config, band: '40m' } }
    expect(sceneText(await panel.render(savedBand, { online: true }))).toContain(
      '40m · 2 receivers',
    )
  })
  it.each<PanelRenderArgs['config']>([
    { windowMinutes: 30 },
    { projection: 'azimuthal' },
    { grid: 'FN31' },
    { watchCall: 'N1RWJ' },
    { minSnrDb: 0 },
    { view: 'list', band: '40m' },
  ])('preserves sort choices after saving %j', async (config) => {
    const { panel } = setup()
    await panel.render(args, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call'), { online: true })
    await panel.onEvent?.(event(panel, 'direction'), { online: true })
    const result = await panel.render(
      { ...args, config: { ...args.config, ...config }, reason: 'config' },
      { online: true },
    )
    expect(sceneState(result).strings?.sort).toBe('call')
    expect(sceneText(result)).toContain('↑')
  })
  it('applies changed sort defaults without clearing the saved view or band', async () => {
    const { panel } = setup()
    const configured = { ...args, config: { ...args.config, view: 'list', band: '40m' } }
    await panel.render(configured, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call', configured), { online: true })
    const result = await panel.render(
      { ...configured, config: { ...configured.config, sort: 'snr', direction: 'asc' } },
      { online: true },
    )
    expect(sceneState(result).strings).toMatchObject({ view: 'list', band: '40m', sort: 'snr' })
    expect(sceneText(result)).toContain('40m · 2 receivers')
    expect(sceneText(result)).toContain('↑')
  })
  it('resets session sort choices when switching operations', async () => {
    const { panel } = setup()
    await panel.render(args, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call'), { online: true })
    const result = await panel.render(
      { ...args, operation: { ...args.operation, uuid: 'another-operation' } },
      { online: true },
    )
    expect(sceneState(result).strings?.sort).toBe('age')
  })
  it.each([snapshot, { ...snapshot, status: 'empty' as const, reports: [] }])(
    'offers view and all supported bands through the host settings form ($status)',
    async (current) => {
      const { panel } = setup(current)
      const result = await panel.render(args, { online: true })
      if (result.kind !== 'scene') throw new Error('Expected native scene')
      expect(result.scene.controls?.find((control) => control.id === 'view')).toMatchObject({
        kind: 'nativeSegmented',
        value: 'view',
        label: 'View',
        options: [
          { value: 'map', label: 'Map' },
          { value: 'list', label: 'Receivers' },
          { value: 'both', label: 'Both' },
        ],
      })
      expect(result.scene.controls?.find((control) => control.id === 'band')).toMatchObject({
        kind: 'nativeDropdown',
        value: 'band',
        options: expect.arrayContaining([{ label: 'All bands', value: 'all' }]),
      })
      const fields = (await panel.getPanels({}, { online: true }))[0].form
      for (const [key, label, values] of [
        ['view', 'View', ['both', 'map', 'list']],
        [
          'band',
          'Band',
          ['all', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'],
        ],
      ] as const) {
        const field = fields?.find((field) => field.type === 'field' && field.key === key)
        if (field?.type !== 'field' || !Array.isArray(field.options))
          throw new Error('Expected settings options')
        expect(field.label).toBe(label)
        expect(field.options.map((option) => option.value)).toEqual(values)
      }
    },
  )
  it('ignores malformed native commits and drawn actions without starting requests', async () => {
    const { panel, getSnapshot } = setup()
    const initial = await panel.render(args, { online: true })
    const band = event(panel, 'band', '20m')
    const refresh = event(panel, 'refresh')
    for (const invalid of [
      { ...band.event, controlId: 'sort' },
      { ...band.event, controlId: 'unknown' },
      { ...band.event, action: `${band.event.action}:extra` },
      { ...band.event, text: 'bogus' },
      { ...band.event, text: undefined, value: 20 },
      { ...band.event, phase: 'change' as const },
      { ...band.event, phase: 'activate' as const },
      { ...band.event, sequence: -1 },
      { ...band.event, sequence: 1.5 },
      { ...band.event, sequence: Number.NaN },
      { ...refresh.event, phase: 'commit' as const },
      { ...refresh.event, action: `${refresh.event.action}:extra` },
    ])
      expect(await panel.onEvent?.({ ...args, event: invalid }, { online: true })).toEqual({
        values: {},
      })
    for (const extra of [{ environment: undefined }, { instanceId: undefined }])
      expect(await panel.onEvent?.({ ...refresh, ...extra }, { online: true })).toEqual({
        values: {},
      })
    expect(getSnapshot).toHaveBeenCalledTimes(1)
    expect(await panel.render(args, { online: true })).toEqual(initial)
    expect(await panel.onEvent?.(band, { online: true })).toEqual({
      values: {},
      strings: { band: '20m' },
    })
    const filtered = await panel.render(args, { online: true })
    expect(sceneState(filtered).strings?.band).toBe('20m')
    expect(await panel.onEvent?.(band, { online: true })).toEqual({
      values: {},
      strings: { band: '20m' },
    })
    expect(await panel.render(args, { online: true })).toEqual(filtered)
  })
  it('rejects commits from an old operation, callsign, configuration, or placement', async () => {
    const { panel } = setup()
    await panel.render(args, { online: true })
    let obsolete = event(panel, 'band', '20m')
    for (const current of [
      { ...args, operation: { ...args.operation, uuid: 'another' } },
      { ...args, config: { ...args.config, watchCall: 'N1RWJ' } },
      { ...args, config: { ...args.config, band: '40m' } },
      { ...args, instanceId: 'another-placement' },
    ]) {
      const before = await panel.render(current, { online: true })
      expect(
        await panel.onEvent?.({ ...current, event: obsolete.event }, { online: true }),
      ).toEqual({ values: {} })
      expect(await panel.render(current, { online: true })).toEqual(before)
      obsolete = event(panel, 'band', '20m', current)
    }
  })
  it('commits details tabs and rejects controls hidden by the details page', async () => {
    const { panel } = setup()
    await panel.render(args, { online: true })
    const hidden = event(panel, 'band', '20m')
    await panel.onEvent?.(event(panel, 'details'), { online: true })
    const status = await panel.render(args, { online: true })
    expect(sceneState(status).strings?.detailsTab).toBe('status')
    expect(await panel.onEvent?.(hidden, { online: true })).toEqual({ values: {} })
    expect(await panel.onEvent?.(event(panel, 'detailsTab', 'about'), { online: true })).toEqual({
      values: {},
      strings: { detailsTab: 'about' },
    })
    const about = await panel.render(args, { online: true })
    expect(sceneState(about).strings?.detailsTab).toBe('about')
    expect(sceneText(about)).toContain('Vail')
    expect(await panel.onEvent?.(event(panel, 'detailsTab', 'status'), { online: true })).toEqual({
      values: {},
      strings: { detailsTab: 'status' },
    })
    expect(sceneState(await panel.render(args, { online: true })).strings?.detailsTab).toBe(
      'status',
    )
    await panel.onEvent?.(event(panel, 'details'), { online: true })
    expect(sceneState(await panel.render(args, { online: true })).strings?.band).toBe('all')
  })
  it('retains placement choices across host sequence resets without saving them', async () => {
    const { panel } = setup()
    const other = { ...args, instanceId: 'other-placement' }
    await panel.render(args, { online: true })
    await panel.render(other, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call'), { online: true })
    const first = event(panel, 'band', '20m')
    first.event.sequence = 100
    expect(await panel.onEvent?.(first, { online: true })).toEqual({
      values: {},
      strings: { band: '20m' },
    })
    const second = event(panel, 'band', '40m', other)
    second.event.sequence = 1
    expect(await panel.onEvent?.(second, { online: true })).toEqual({
      values: {},
      strings: { band: '40m' },
    })
    expect(sceneState(await panel.render(args, { online: true })).strings?.band).toBe('20m')
    expect(sceneState(await panel.render(other, { online: true })).strings?.band).toBe('40m')
    // A widget remount restarts the host counter while retaining the placement.
    const remounted = event(panel, 'band', 'all')
    remounted.event.sequence = 1
    expect(await panel.onEvent?.(remounted, { online: true })).toEqual({
      values: {},
      strings: { band: 'all' },
    })
    expect(sceneState(await panel.render(args, { online: true })).strings).toMatchObject({
      band: 'all',
      sort: 'call',
    })
    expect(sceneState(await panel.render(other, { online: true })).strings?.band).toBe('40m')
    expect(sceneState(await setup().panel.render(args, { online: true })).strings?.band).toBe('all')
  })
  it.each(['operation', 'config', 'rerender'] as const)(
    'discards a slow render superseded by %s and retains the latest event registry',
    async (change) => {
      const pending = deferred<RbnSnapshot>()
      const getSnapshot = vi
        .fn()
        .mockImplementationOnce(() => pending.promise)
        .mockResolvedValue(snapshot)
      const panel = createRbnPanel({
        client: { getSnapshot },
        now: () => now,
        settings: async () => ({}),
      })
      const obsolete = panel.render(args, { online: false })
      const current: PanelRenderArgs =
        change === 'operation'
          ? { ...args, operation: { ...args.operation, uuid: 'new-operation' } }
          : change === 'config'
            ? { ...args, config: { ...args.config, band: '40m' } }
            : args
      const latest = await panel.render(current, { online: false })
      expect(latest.kind).toBe('scene')
      const choice = event(panel, 'band', '20m', current)
      pending.resolve(snapshot)
      expect(await obsolete).toEqual({ kind: 'markdown', content: '' })
      expect(await panel.onEvent?.(choice, { online: false })).toEqual({
        values: {},
        strings: { band: '20m' },
      })
      expect(sceneState(await panel.render(current, { online: false })).strings?.band).toBe('20m')
    },
  )
  it('sorts both ways through native actions and exposes full test/error details', async () => {
    const { panel } = setup({
      ...snapshot,
      status: 'stale',
      error: 'RBN request failed (503).',
      capped: true,
    })
    const listArgs = { ...args, config: { ...args.config, view: 'list' } }
    await panel.render(listArgs, { online: true })
    await panel.onEvent?.(event(panel, 'sort', 'call', listArgs), { online: true })
    const descending = sceneText(await panel.render(listArgs, { online: true }))
    expect(descending.indexOf('W1NT')).toBeLessThan(descending.indexOf('UNKNOWN'))
    await panel.onEvent?.(event(panel, 'direction', undefined, listArgs), { online: true })
    const ascending = sceneText(await panel.render(listArgs, { online: true }))
    expect(ascending.indexOf('UNKNOWN')).toBeLessThan(ascending.indexOf('W1NT'))
    await panel.onEvent?.(event(panel, 'details', undefined, listArgs), { online: true })
    const details = await detailsText(panel, listArgs)
    expect(details).toContain('503')
    expect(details).toContain('TEST')
    expect(details).toContain('500-report')
  })
  it('keeps successful cached scenes stable and unavailable reports aging', async () => {
    let time = now
    let current = snapshot
    const panel = createRbnPanel({
      client: { getSnapshot: async () => current },
      now: () => time,
      settings: async () => ({}),
    })
    const initial = await panel.render(args, { online: true })
    time += 30000
    expect(await panel.render(args, { online: true })).toEqual(initial)
    current = { ...snapshot, status: 'stale', error: 'Offline.' }
    time = now + 60000
    const stale = await panel.render(args, { online: true })
    time += 60000
    expect(await panel.render(args, { online: true })).not.toEqual(stale)
  })
})
