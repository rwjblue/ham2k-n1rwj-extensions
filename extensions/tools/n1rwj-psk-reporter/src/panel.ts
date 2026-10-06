import type { PanelHook, PanelRenderArgs, SettingsField } from '@ham2k/extension-sdk'
import {
  operationOrigin,
  readConfig,
  receptionBands,
  receptionConfigFields,
  watchedCall,
} from '../../../../packages/reception/src/config.ts'
import { receptionMapTheme } from '../../../../packages/reception/src/map/theme.ts'
import { bindPanelEvents, readPanelEvent } from '../../../../packages/reception/src/panel-events.ts'
import {
  applySceneEvent,
  createPanelStateStore,
} from '../../../../packages/reception/src/panel-state.ts'
import {
  ageLabel,
  type ReceptionReport,
  receptionView,
  utcLabel,
} from '../../../../packages/reception/src/reports.ts'
import { renderReceptionScene } from '../../../../packages/reception/src/ui/scene.ts'
import type { UiModel } from '../../../../packages/reception/src/ui/types.ts'
import { watchStationPattern } from './data/receiver.ts'
import type { LiveReception, LiveSnapshot } from './live.ts'

function realNowMillis(args: PanelRenderArgs): number | undefined {
  const value = args.clock?.realNowMillis
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export const configFields: SettingsField[] = [
  {
    type: 'field',
    fieldType: 'select',
    key: 'receptionDirection',
    label: 'Reception',
    value: 'outgoing',
    options: [
      { label: 'Who hears me', value: 'outgoing' },
      { label: 'Who I hear', value: 'incoming' },
    ],
  },
  ...receptionConfigFields('Station', false).map((field) =>
    field.key === 'watchCall'
      ? {
          ...field,
          label: 'Watch callsign or receiver ID',
          description:
            'Leave blank to follow this operation. Who I hear accepts your receiving software’s exact ID, such as SWL or US-E-015. Who hears me requires a transmitting callsign.',
          pattern: watchStationPattern,
          patternError:
            'Use an exact callsign or receiver ID, with slashes instead of dots and no wildcards.',
        }
      : field,
  ),
]

/** Pure presentation shared by recorded fixtures and live snapshots. */
export function pskPanelModel(
  args: PanelRenderArgs,
  reports: readonly ReceptionReport[],
  now: number,
  live: Pick<LiveSnapshot, 'state' | 'message' | 'retryAt' | 'capped' | 'history' | 'cacheWarning'>,
): UiModel {
  const config = readConfig(args.config)
  const incoming = args.config.receptionDirection === 'incoming'
  const call = watchedCall(args.operation, config.watchCall)
  const origin = operationOrigin(args.operation, config.gridOverride)
  const selected = reports.filter(
    (report) =>
      report.timeMs >= now - config.windowMinutes * 60_000 && report.timeMs <= now + 60_000,
  )
  const view = receptionView(selected, call, incoming ? 'incoming' : 'outgoing', now, origin)
  const feedState = {
    idle: 'Not connected',
    connecting: 'Connecting',
    subscribing: 'Subscribing',
    live: 'Connected',
    retrying: 'Reconnecting',
    invalid: incoming ? 'Receiver ID required' : 'Callsign required',
    limit: 'Subscription limit reached',
    offline: 'Paused while offline',
  }[live.state]
  const liveStatus =
    live.state === 'live'
      ? view.rows.length
        ? 'Live reception'
        : 'Connected · waiting for reports'
      : live.state === 'retrying'
        ? `${live.message} · retry in ${Math.max(0, Math.ceil(((live.retryAt ?? now) - now) / 1000))}s`
        : live.message ||
          (live.state === 'subscribing'
            ? 'Subscribing to reception reports'
            : 'Connecting to PSK Reporter')
  return {
    title: call ? `PSK Reporter · ${call}` : 'PSK Reporter',
    watchCall: call,
    generatedAt: utcLabel(now),
    lastReport: view.rows.length
      ? ageLabel(Math.max(...view.rows.map((row) => row.timeMs ?? 0)), now)
      : undefined,
    status: [liveStatus, live.history?.message].filter(Boolean).join(' · '),
    statusKind:
      live.state === 'live'
        ? 'live'
        : view.rows.length
          ? 'cached'
          : live.state === 'retrying'
            ? 'error'
            : 'empty',
    warnings: [
      ...new Set([
        ...(live.capped ? ['Report capacity reached; this window is incomplete.'] : []),
        ...(live.history?.warning ? [live.history.warning] : []),
        ...(live.cacheWarning ? [live.cacheWarning] : []),
      ]),
    ],
    details: {
      status: liveStatus,
      purpose: incoming
        ? `See which transmitters ${call || 'the watched station'} reports hearing.`
        : `See where ${call || 'the watched station'} is being heard.`,
      facts: [
        { label: 'Direction', value: incoming ? 'Who I hear' : 'Who hears me' },
        {
          label: 'Window',
          value: `Last ${config.windowMinutes} ${config.windowMinutes === 1 ? 'minute' : 'minutes'}`,
        },
        { label: 'Live feed', value: feedState },
        { label: 'Recent history', value: live.history?.message || 'Not requested' },
      ],
      activity: [
        live.history?.pending
          ? 'History request in progress; cached and live reports remain available. Repeated reloads share this request.'
          : live.history?.lastRequestDurationMs !== undefined
            ? `Last history request duration: ${live.history.lastRequestDurationUpperBound ? 'up to ' : ''}${live.history.lastRequestDurationMs} ms.`
            : '',
        live.state === 'retrying' && live.retryAt !== undefined
          ? `Live feed retries at ${utcLabel(live.retryAt)}.`
          : live.state === 'offline'
            ? 'Reconnect this device to resume live reports and history requests.'
            : '',
        live.state !== 'offline' && live.history?.warning?.startsWith('History unavailable:')
          ? 'Force reload retries recent history, bypassing the automatic cooldown.'
          : '',
      ].filter(Boolean),
      sections: [
        {
          title: 'Reading the reports',
          paragraphs: [
            'Live reports: PSK Reporter via M0LTE’s MQTT service. Recent history: PSK Reporter. Rows keep the latest report for one station, band, and mode; the map shows each located station once.',
            'Who hears me shows receivers reporting the watched callsign. Who I hear shows transmitters it reports and requires uploads from your receiving software. SNR is measured at the receiver.',
            'Reports are observations, not contacts. An empty result does not prove your signal cannot be heard: missing uploads, reporting delays, and collection gaps affect completeness.',
          ],
        },
        {
          title: 'Map and location',
          paragraphs: [
            'Paths connect the map origin to stations in this view; they are not a coverage boundary. Reported grids give approximate locations, distances, and bearings. Unlocated stations remain in the list.',
            'Changing the watched callsign does not move the map origin. Set a matching origin grid in panel settings when observing another station.',
          ],
        },
        {
          title: 'Live feed and recent history',
          paragraphs: [
            'Live reports arrive while visible. History is requested on opening and after collection gaps, shared across panels at least five minutes apart. Failures can delay retries further. Force reload bypasses this cooldown.',
            'History may be delayed or incomplete. Pending requests retain cached and live reports, share repeated reloads, and check for completion each second while visible.',
            'Live connection and history are separate; connected does not guarantee recent reports. Latest report is when the signal was heard, relative to the shown age reference. A duration marked “up to” includes time until the next panel render observed completion.',
          ],
        },
      ],
    },
    locationLabel: origin
      ? `Map origin ${origin.label}`
      : 'Set an operation location or map origin grid.',
    presentation: {
      source: 'PSK Reporter',
      stationLabel: incoming ? 'Transmitter' : 'Receiver',
      cwSpeed: false,
      refreshLabel: 'Force reload recent history (bypasses five-minute cooldown)',
    },
    bands: [...new Set([...receptionBands, ...view.rows.map((row) => row.band)])],
    rows: view.rows,
    mapOptions: {
      width: 520,
      height: 360,
      origin: origin ? { ...origin, label: call } : undefined,
      stations: view.stations,
      stationLabel: incoming ? 'transmitter' : 'receiver',
      projection: config.projection,
      theme: receptionMapTheme(args.environment?.brightness ?? 'light'),
    },
    defaultBand: config.band,
    defaultView: config.view,
    defaultSort: config.sort === 'wpm' ? 'age' : config.sort,
    defaultDirection: config.direction,
    defaultWindowMinutes: config.windowMinutes,
  }
}

export function createPskPanel(live: LiveReception): PanelHook {
  const stateFor = createPanelStateStore()
  return {
    async getPanels() {
      return [
        {
          key: 'psk-reporter',
          title: 'PSK Reporter',
          icon: 'radar',
          description: 'Live PSK Reporter reception maps for a watched callsign.',
          on: ['operation', 'tick:5'],
          multiple: true,
          form: configFields,
        },
      ]
    },
    async render(args, ctx) {
      if (!args.environment || !args.instanceId)
        return {
          kind: 'markdown',
          content:
            'PSK Reporter requires a Ham2K version with extension API 5 and native panel controls.',
        }
      const state = stateFor(args, String(args.config.receptionDirection ?? 'outgoing'))
      const epoch = state.epoch
      const renderVersion = ++state.renderVersion
      const config = readConfig(args.config)
      const windowMinutes = state.selection.windowMinutes ?? config.windowMinutes
      const effectiveArgs = { ...args, config: { ...args.config, windowMinutes } }
      const realTime = realNowMillis(args)
      const now = realTime ?? Date.now()
      const restored = await live.restore(realTime)
      if (
        !restored.isCurrent() ||
        !state.active ||
        state.epoch !== epoch ||
        state.renderVersion !== renderVersion
      )
        return { kind: 'markdown', content: '' }
      const snapshot = live.snapshot(
        args.instanceId,
        watchedCall(args.operation, config.watchCall),
        args.config.receptionDirection === 'incoming' ? 'incoming' : 'outgoing',
        windowMinutes,
        ctx.online !== false,
        realTime,
      )
      const model = {
        ...pskPanelModel(effectiveArgs, snapshot.reports, now, snapshot),
        defaultWindowMinutes: config.windowMinutes,
      }
      const rendered = renderReceptionScene(
        model,
        args.environment,
        {
          ...state.selection,
          view: config.view,
          band: state.selection.band ?? config.band,
          windowMinutes,
        },
        { nativeControls: true },
      )
      state.selection = rendered.selection
      state.bands = rendered.bands
      bindPanelEvents(state, rendered.scene)
      return {
        kind: 'scene',
        title: model.title,
        scene: rendered.scene,
        ...(snapshot.history?.pending ? { triggers: ['tick:1'] } : {}),
      }
    },
    async onEvent(args, ctx) {
      if (args.instanceId && args.environment) {
        const state = stateFor(args, String(args.config.receptionDirection ?? 'outgoing'))
        const event = readPanelEvent(state, args.event)
        if (!event) return { values: {} }
        if (event.controlId === 'refresh' && event.action === 'refresh:reports') {
          const config = readConfig(args.config)
          live.forceHistory(
            watchedCall(args.operation, config.watchCall),
            args.config.receptionDirection === 'incoming' ? 'incoming' : 'outgoing',
            state.selection.windowMinutes ?? config.windowMinutes,
            ctx.online !== false,
            realNowMillis(args),
          )
          return { values: {} }
        }
        applySceneEvent(state, event.controlId, event.action, false)
        return { values: {}, ...(event.strings ? { strings: event.strings } : {}) }
      }
      return { values: {} }
    },
  }
}
