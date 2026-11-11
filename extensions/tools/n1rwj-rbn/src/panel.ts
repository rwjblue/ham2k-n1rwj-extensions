import type { JSONValue, PanelHook, PanelRenderArgs } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import type { MapTheme } from '../../../../packages/reception/src/map/index.ts'
import { bindPanelEvents, readPanelEvent } from '../../../../packages/reception/src/panel-events.ts'
import {
  applySceneEvent,
  createPanelStateStore,
} from '../../../../packages/reception/src/panel-state.ts'
import { ageLabel, receptionView, utcLabel } from '../../../../packages/reception/src/reports.ts'
import { renderReceptionScene } from '../../../../packages/reception/src/ui/scene.ts'
import type { UiModel } from '../../../../packages/reception/src/ui/types.ts'
import type { RbnCluster } from './cluster/index.ts'
import { liveClusterEnabled } from './cluster-settings.ts'
import { configFields, operationOrigin, rbnBands, readConfig, watchedCall } from './config.ts'
import type { RbnClient } from './data/client.ts'
import { rbnClient } from './data/host-client.ts'
import { receiverFamily } from './data/identity.ts'
import type { RbnReport, RbnSnapshot } from './model.ts'
import { isValidCall, latestReports, receiverCoordinates } from './model.ts'
import { rbnDetailsSections, rbnPresentation } from './presentation.ts'
import { toReceptionReport } from './reception.ts'
import { ownSettings } from './spots/preferences.ts'

const liveTickSeconds = 5
const liveLeaseMs = 20_000
const slowLeaseMs = 75_000

interface ClusterDisplay {
  status: 'Off' | 'Offline' | 'Connecting' | 'Connected' | 'Reconnecting' | 'Unavailable'
  hasReports: boolean
}

const mapTheme: MapTheme = {
  surface: '#ffffff',
  land: '#f3f6f8',
  text: '#172832',
  muted: '#526876',
  border: '#cbd8df',
  accent: '#086f63',
}

function refreshDetails(snapshot: RbnSnapshot): string[] {
  const refresh = snapshot.refresh
  const needsAttention = Boolean(
    snapshot.error || (refresh && ['pending', 'offline', 'rate-limit'].includes(refresh.state)),
  )
  return [
    needsAttention && snapshot.lastAttemptMs !== null
      ? `Last request attempt: ${utcLabel(snapshot.lastAttemptMs)}.`
      : '',
    refresh?.state !== 'pending' && snapshot.lastRequestDurationMs !== undefined
      ? `Last request duration: ${snapshot.lastRequestDurationUpperBound ? 'up to ' : ''}${snapshot.lastRequestDurationMs} ms.`
      : '',
    !needsAttention
      ? ''
      : refresh?.state === 'pending'
        ? 'Request in progress; cached reports remain available. Refresh reuses this request.'
        : refresh?.state === 'offline'
          ? 'No request sent: Ham2K reports the device is offline. Reconnect to resume checks.'
          : refresh?.state === 'cooldown'
            ? 'Local refresh cooldown; reusing the last result.'
            : refresh?.state === 'rate-limit'
              ? 'Requests paused after HTTP 429; wait until the retry time below.'
              : '',
    needsAttention &&
    refresh?.state !== 'pending' &&
    refresh?.manualAtMs != null &&
    refresh.automaticAtMs != null
      ? `${refresh.state === 'rate-limit' ? `Manual refresh allowed from ${utcLabel(refresh.manualAtMs)}.` : 'Manual refresh is available now.'} Automatic check eligible from ${utcLabel(refresh.automaticAtMs)} while visible.`
      : '',
  ].filter(Boolean)
}

function reportMinuteKey(report: RbnReport): string {
  return [
    report.call,
    receiverFamily(report.receiver),
    report.band,
    report.mode,
    Math.round(report.frequencyKhz * 10),
    Math.floor(report.timeMs / 60_000),
  ].join('|')
}

/** Reconcile display rows while preserving the original Vail observations for exports. */
function mergeDisplayReports(vail: RbnReport[], live: readonly RbnReport[]): RbnReport[] {
  if (!live.length) return vail
  const byMinute = new Map<string, RbnReport[]>()
  for (const report of live) {
    const key = reportMinuteKey(report)
    const group = byMinute.get(key)
    if (group) group.push(report)
    else byMinute.set(key, [report])
  }
  const matched = new Set<RbnReport>()
  const reconciled = vail.map((report) => {
    const candidates = byMinute.get(reportMinuteKey(report)) ?? []
    const exact = candidates.find((candidate) => candidate.receiver === report.receiver)
    // A bare Vail call can cover several physical receivers. Reuse its finer
    // timestamp and measurements only when one observed suffix fits the spot.
    const aliases =
      exact || receiverFamily(report.receiver) !== report.receiver
        ? []
        : candidates.filter(
            (candidate) =>
              candidate.snrDb !== null &&
              candidate.snrDb === report.snrDb &&
              (candidate.wpm === null || report.wpm === null || candidate.wpm === report.wpm),
          )
    const received = exact ?? (aliases.length === 1 ? aliases[0] : undefined)
    if (!received) return report
    matched.add(received)
    return {
      ...report,
      receiver: received.receiver,
      snrDb: report.snrDb ?? received.snrDb,
      wpm: report.wpm ?? received.wpm,
      receiverLatitude: (exact ? report.receiverLatitude : null) ?? received.receiverLatitude,
      receiverLongitude: (exact ? report.receiverLongitude : null) ?? received.receiverLongitude,
      country: (exact ? report.country : null) ?? received.country,
    }
  })
  return [...reconciled, ...live.filter((report) => !matched.has(report))]
}

function clusterDisplayStatus(
  live: ReturnType<RbnCluster['getSnapshot']>,
  enabled: boolean,
  online: boolean,
  available: boolean,
): ClusterDisplay['status'] {
  if (!available) return 'Unavailable'
  if (!enabled || live.error === 'off') return 'Off'
  if (!online) return 'Offline'
  if (live.error === 'disconnected') return 'Reconnecting'
  if (live.state === 'unavailable') return 'Unavailable'
  return live.state === 'connected' ? 'Connected' : 'Connecting'
}

export function panelModel(
  args: PanelRenderArgs,
  snapshot: RbnSnapshot,
  now: number,
  settings: Record<string, JSONValue> = {},
  cluster?: ClusterDisplay,
): UiModel {
  const config = readConfig(args.config)
  const pending = snapshot.refresh?.state === 'pending'
  const origin = operationOrigin(args.operation, config.gridOverride)
  const reports = latestReports(snapshot.reports).filter(
    (report) =>
      config.minSnrDb === null ||
      (report.snrDb !== null && Number.isFinite(report.snrDb) && report.snrDb >= config.minSnrDb),
  )
  const bands = [...new Set([...rbnBands, ...reports.map((report) => report.band), config.band])]
  const view = receptionView(reports.map(toReceptionReport), snapshot.call, 'outgoing', now, origin)
  const frameOptions = {
    origin: origin ? { ...origin, label: snapshot.call } : undefined,
    stations: view.stations,
    projection: config.projection,
    theme: mapTheme,
  }
  const test = String(args.operation?.stationCall ?? '')
    .toUpperCase()
    .split(/[/,]/)
    .some((part) => part === 'TEST' || part === 'T')
  const warnings = [
    ...new Set(
      [
        snapshot.error ?? '',
        test
          ? `TEST OPERATION — observing ${snapshot.call}; these reports belong to that station.`
          : '',
        snapshot.storageWarning ?? '',
        snapshot.capped ? '500-report limit reached; some reports may be missing.' : '',
        reports.some((report) => !receiverCoordinates(report))
          ? 'Unlocated receivers are listed but not mapped.'
          : '',
      ].filter(Boolean),
    ),
  ]
  const themeMode = settings.themeMode
  const failureLabel = snapshot.failureKind
    ? {
        'rate-limit': 'rate limited',
        timeout: 'request timed out',
        request: 'request failed',
        http: 'HTTP error',
        response: 'invalid response',
        offline: 'offline',
      }[snapshot.failureKind]
    : snapshot.error
      ? 'refresh unavailable'
      : 'awaiting refresh'
  const brightness =
    args.environment?.brightness ??
    (themeMode === 'light' || themeMode === 'dark' ? themeMode : undefined)
  const vailStatus = pending
    ? snapshot.lastSuccessMs === null
      ? 'Checking Vail ReRBN…'
      : 'Cached · refreshing'
    : snapshot.status === 'ready'
      ? 'Recent reports'
      : snapshot.status === 'empty'
        ? 'No recent reports'
        : snapshot.status === 'stale'
          ? `Cached · ${failureLabel}`
          : snapshot.failureKind
            ? `Vail ReRBN · ${failureLabel}`
            : 'Vail ReRBN unavailable'
  const vailStatusKind = pending
    ? snapshot.lastSuccessMs === null
      ? 'empty'
      : 'cached'
    : snapshot.status === 'ready'
      ? 'live'
      : snapshot.status === 'stale'
        ? 'cached'
        : snapshot.status
  const showingCluster = cluster?.hasReports && reports.length > 0
  const connected = cluster?.status === 'Connected'
  const status = showingCluster
    ? connected
      ? 'Live cluster reports'
      : 'Recent cluster reports'
    : vailStatus
  return {
    presentation: {
      ...rbnPresentation,
      ...(cluster?.hasReports ? { source: 'RBN · DX cluster and Vail' } : {}),
      viewCycle: true,
    },
    title: test ? 'My Signal · TEST observation' : 'My Signal',
    watchCall: snapshot.call,
    fetchedAt: snapshot.lastSuccessMs === null ? undefined : utcLabel(snapshot.lastSuccessMs),
    generatedAt: utcLabel(now),
    lastReport: reports.length
      ? ageLabel(Math.max(...reports.map((report) => report.timeMs)), now)
      : undefined,
    status: status + (config.minSnrDb === null ? '' : ` · ≥ ${config.minSnrDb} dB`),
    statusKind: showingCluster ? (connected ? 'live' : 'cached') : vailStatusKind,
    locationLabel: origin
      ? `Map origin ${origin.label} · ${origin.latitude.toFixed(3)}°, ${origin.longitude.toFixed(3)}°`
      : 'Set an operation location or a map origin grid in panel settings.',
    details: {
      purpose: `See where ${snapshot.call || 'the watched station'} is being heard.`,
      facts: [
        { label: 'Direction', value: 'Who hears me' },
        {
          label: 'Window',
          value: `Last ${config.windowMinutes} ${config.windowMinutes === 1 ? 'minute' : 'minutes'}`,
        },
        ...(config.minSnrDb === null
          ? []
          : [{ label: 'Minimum SNR', value: `${config.minSnrDb} dB (inclusive)` }]),
        {
          label: cluster ? 'Last successful Vail check' : 'Last successful check',
          value: snapshot.lastSuccessMs === null ? 'None yet' : utcLabel(snapshot.lastSuccessMs),
        },
        ...(cluster ? [{ label: 'DX cluster', value: cluster.status }] : []),
        {
          label: 'Source',
          value: cluster?.hasReports ? 'RBN via DX cluster and Vail ReRBN' : 'RBN via Vail ReRBN',
        },
      ],
      activity: refreshDetails(snapshot),
      sections: rbnDetailsSections,
    },
    warnings,
    bands,
    mapOptions: { ...frameOptions, width: 520, height: 360 },
    rows: view.rows,
    defaultBand: config.band,
    defaultSort: config.sort,
    defaultDirection: config.direction,
    defaultView: config.view,
    defaultWindowMinutes: config.windowMinutes,
    theme: { brightness, ...args.environment?.colors },
  }
}

export function createRbnPanel(
  dependencies: {
    client?: RbnClient
    now?: () => number
    settings?: () => Promise<Record<string, JSONValue>>
    enrichReports?: (reports: readonly RbnReport[]) => RbnReport[]
    observeCollection?: (args: PanelRenderArgs, time: number) => void
    cluster?: Pick<RbnCluster, 'getSnapshot' | 'renew' | 'release'>
  } = {},
): PanelHook {
  const client = dependencies.client ?? rbnClient
  const now = dependencies.now ?? Date.now
  const settings = dependencies.settings ?? (() => host.getSettings())
  const stateFor = createPanelStateStore()
  const cluster = dependencies.cluster
  return {
    async getPanels() {
      return [
        {
          key: 'my-signal',
          title: 'My Signal',
          icon: 'radar',
          description:
            'Where your CW, RTTY, FT8, and FT4 signals are heard, with a map and RBN receiver reports.',
          // The host withholds renders behind a tab or while the app is hidden.
          // This cadence also renews the client's bounded visibility lease.
          on: ['operation', 'tick:60'],
          multiple: true,
          form: configFields,
        },
      ]
    },
    async render(args, ctx) {
      if (!args.environment || !args.instanceId) {
        if (args.instanceId) cluster?.release(`panel:${args.instanceId}`)
        return {
          kind: 'markdown',
          title: 'RBN · App update needed',
          content:
            '**My Signal requires extension API 5 and native panel controls.**\n\nThis app build does not supply the panel environment and placement identity. Update Ham2K to use the reception map and sortable receiver list. No RBN request was made.',
        }
      }
      const config = readConfig(args.config)
      const call = watchedCall(args.operation, config.watchCall)
      const state = stateFor(args)
      const windowMinutes = state.selection.windowMinutes ?? config.windowMinutes
      const effectiveArgs = { ...args, config: { ...args.config, windowMinutes } }
      const epoch = state.epoch
      const renderVersion = ++state.renderVersion
      const suppliedTime = args.clock?.realNowMillis
      const realTime =
        typeof suppliedTime === 'number' && Number.isFinite(suppliedTime) ? suppliedTime : undefined
      dependencies.observeCollection?.(effectiveArgs, realTime ?? now())
      const [snapshot, preferences] = await Promise.all([
        client.getSnapshot(
          { call, windowMinutes },
          {
            instanceId: args.instanceId,
            online: ctx.online,
            waitForRequest: false,
            ...(realTime === undefined ? {} : { realNowMillis: realTime }),
          },
        ),
        settings().catch(() => undefined),
      ])
      if (!state.active || state.epoch !== epoch || state.renderVersion !== renderVersion)
        return { kind: 'markdown', content: '' }
      const time = realTime ?? now()
      const enabled = preferences !== undefined && liveClusterEnabled(ownSettings(preferences))
      const hasCall = isValidCall(call)
      const wantsLive = Boolean(cluster && enabled && hasCall && ctx.online)
      const live = cluster?.getSnapshot(call)
      const fastTick = wantsLive && live?.error !== 'unsupported' && live?.error !== 'off'
      const lease = `panel:${args.instanceId}`
      if (wantsLive) cluster?.renew(lease, fastTick ? liveLeaseMs : slowLeaseMs, call)
      else cluster?.release(lease)
      const cutoff = time - windowMinutes * 60_000
      const liveReports = enabled
        ? (live?.reports.filter(
            (report) => report.call === call && report.timeMs >= cutoff && report.timeMs <= time,
          ) ?? [])
        : []
      const clusterDisplay: ClusterDisplay | undefined = live && {
        status: clusterDisplayStatus(
          live,
          enabled,
          ctx.online,
          preferences !== undefined && hasCall,
        ),
        hasReports: liveReports.length > 0,
      }
      const reports = mergeDisplayReports(snapshot.reports, liveReports)
      // Live reports can arrive after Vail's snapshot. Age those rows against
      // the current clock while retaining the HTTP-only panel's age reference.
      const ageReference = liveReports.length
        ? time
        : snapshot.status === 'ready' || snapshot.status === 'empty'
          ? (snapshot.lastSuccessMs ?? time)
          : Math.max(snapshot.lastSuccessMs ?? 0, Math.floor(time / 60_000) * 60_000)
      const rendered = renderReceptionScene(
        {
          ...panelModel(
            effectiveArgs,
            {
              ...snapshot,
              reports: dependencies.enrichReports?.(reports) ?? reports,
            },
            ageReference,
            preferences,
            clusterDisplay,
          ),
          defaultWindowMinutes: config.windowMinutes,
        },
        args.environment,
        {
          ...state.selection,
          view: state.selection.view ?? config.view,
          band: state.selection.band ?? config.band,
          windowMinutes,
        },
        { nativeControls: true },
      )
      state.selection = rendered.selection
      state.bands = rendered.bands
      bindPanelEvents(state, rendered.scene)
      const tick =
        snapshot.refresh?.state === 'pending' ? 1 : fastTick ? liveTickSeconds : undefined
      return {
        kind: 'scene',
        title: `My Signal${call ? ` · ${call}` : ''}`,
        scene: rendered.scene,
        ...(tick ? { triggers: [`tick:${tick}`] } : {}),
      }
    },
    async onEvent(args, ctx) {
      if (!args.instanceId || !args.environment) return { values: {} }
      const state = stateFor(args)
      const event = readPanelEvent(state, args.event)
      if (!event) return { values: {} }
      const config = readConfig(args.config)
      const windowMinutes = state.selection.windowMinutes ?? config.windowMinutes
      const { controlId, action } = event
      if (controlId === 'refresh' && action === 'refresh:reports') {
        const suppliedTime = args.clock?.realNowMillis
        dependencies.observeCollection?.(
          { ...args, config: { ...args.config, windowMinutes } },
          typeof suppliedTime === 'number' && Number.isFinite(suppliedTime) ? suppliedTime : now(),
        )
        // Start a request without holding the event open. Its post-event render
        // reads the shared cache and polls the pending result through tick:1.
        await client.getSnapshot(
          {
            call: watchedCall(args.operation, config.watchCall),
            windowMinutes,
          },
          {
            instanceId: args.instanceId,
            force: true,
            online: ctx.online,
            waitForRequest: false,
            ...(typeof suppliedTime === 'number' && Number.isFinite(suppliedTime)
              ? { realNowMillis: suppliedTime }
              : {}),
          },
        )
      } else {
        applySceneEvent(state, controlId, action)
      }
      // The host schedules an authoritative render after every scene event.
      // Structural changes (sort/filter/page/view) therefore need no numeric patch.
      return { values: {}, ...(event.strings ? { strings: event.strings } : {}) }
    },
  }
}
