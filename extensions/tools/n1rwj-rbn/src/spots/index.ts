import type {
  ActivityHook,
  DeviceLocation,
  DynamicSettingsPanel,
  FetchOptions,
  FetchResponse,
  HookContext,
  JSONValue,
  Spot,
  SpotsHook,
} from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import type { TimerDriver } from '../../../../../packages/reception/src/timers.ts'
import manifest from '../../manifest.json'
import type { RbnCluster } from '../cluster/index.ts'
import { liveClusterEnabled } from '../cluster-settings.ts'
import type { Continent } from '../data/continents.ts'
import { rbnAboutDefinition } from './about.ts'
import { createSpotFeed } from './feed.ts'
import { createHealthCheck } from './health.ts'
import { createLiveSpots, maxLiveBoardSpots } from './live.ts'
import { bands, type ReceiverLookup, selectSpots } from './model.ts'
import {
  allowSpotMerging,
  ownSettings,
  readPreferences,
  tokens,
  validateEdit,
  validation,
} from './preferences.ts'
import { planSpotQueries, type ReceiverQueryEntry } from './queries.ts'
import { settingsDefinition } from './settings.ts'

const maxCachedFeeds = 8
const maxCachedReports = 100_000
const spotBands = new Set<string>(bands.map(({ name }) => name))

interface Options {
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>
  lookup: ReceiverLookup
  receiverEntries?: () => readonly ReceiverQueryEntry[]
  now?: () => number
  healthTimers?: TimerDriver
  getSettings?: typeof host.getSettings
  setSettings?: typeof host.setSettings
  getLocation?: typeof host.getLocation
  showForm?: typeof host.showForm
  continentNear?: (location: DeviceLocation) => Continent | null
  cluster?: RbnCluster
  publishSpots?: (spots: Spot[]) => Promise<void>
}

interface FeedEntry {
  mode: string
  feed: ReturnType<typeof createSpotFeed>
  reports: Spot[]
  attempted: boolean
}

interface BoardView {
  raw: Record<string, unknown>
  preferences: ReturnType<typeof readPreferences>
  entry: FeedEntry | undefined
  online: boolean
  distanceUnits?: string
  clusterEnabled: boolean
  loading: boolean
}

export function createRbnSpots(options: Options) {
  const getSettings = options.getSettings ?? host.getSettings
  const setSettings = options.setSettings ?? host.setSettings
  const now = options.now ?? Date.now
  const checkHealth = createHealthCheck(options.fetch, now, options.healthTimers)
  // Cache by receiver query as well as mode: changing skimmers or loading the
  // directory must not reuse a worldwide snapshot missing the chosen receivers.
  const feeds = new Map<string, FeedEntry>()
  const live =
    options.cluster && options.publishSpots
      ? createLiveSpots(options.cluster, options.healthTimers ?? host, now, options.publishSpots)
      : undefined
  let board: BoardView | undefined
  let boardLifecycle = 0
  function pruneFeeds() {
    let count = [...feeds.values()].reduce((sum, entry) => sum + entry.reports.length, 0)
    for (const [key, entry] of feeds) {
      if (feeds.size <= maxCachedFeeds && count <= maxCachedReports) break
      count -= entry.reports.length
      feeds.delete(key)
    }
  }
  function cachedReports(mode: string): Spot[] {
    return [...feeds.values()].flatMap((entry) => (entry.mode === mode ? entry.reports : []))
  }
  let status = ''
  let generation = 0
  let location: DeviceLocation | null = null
  let locationStarted = false
  let locating = false
  // Serialize geographic defaults and edits so a slow location fix cannot
  // overwrite an operator's choice.
  let queue: Promise<unknown> = Promise.resolve()
  function serialized<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn)
    queue = result.catch(() => undefined)
    return result
  }
  function defaultContinents(raw: Record<string, unknown>): Continent[] {
    const local = location && options.continentNear?.(location)
    if (local) return [local]
    const previous = raw.spotLastContinents ?? raw.spotContinents
    return validation('spotContinents', previous) === null
      ? [...new Set(previous as Continent[])]
      : []
  }
  // Called inside the settings queue. Explicit [] means all continents and is
  // never replaced by an automatic suggestion, even after a restart.
  async function initializeContinents(raw: Record<string, unknown>) {
    if (raw.spotContinents !== undefined) return
    const values = defaultContinents(raw)
    if (!values.length) return
    generation++
    await setSettings({ spotContinents: values, spotLastContinents: values })
    raw.spotContinents = values
    raw.spotLastContinents = values
  }
  function locateOnce() {
    if (locationStarted || !options.continentNear) return
    locationStarted = true
    locating = true
    // GPS can prompt or take longer than a hook deadline. Never hold the
    // settings queue or a Spots fetch open while it resolves.
    void Promise.resolve()
      .then(() => (options.getLocation ?? host.getLocation)())
      .then(async (value) => {
        location = value
        await serialized(async () => {
          const raw = ownSettings(await getSettings())
          await initializeContinents(raw)
        })
      })
      .catch(() => undefined)
      .finally(() => {
        locating = false
      })
  }
  function spotSettings() {
    return serialized(async () => {
      const raw = ownSettings(await getSettings())
      if (raw.spotContinents === undefined) {
        locateOnce()
        await initializeContinents(raw)
      }
      return { raw, generation }
    })
  }

  function makeView(
    raw: Record<string, unknown>,
    online: boolean,
    distanceUnits?: string,
  ): BoardView {
    const preferences = readPreferences(raw)
    let entry: FeedEntry | undefined
    if (online) {
      const queries = planSpotQueries(preferences, options.receiverEntries?.())
      const key = JSON.stringify([preferences.mode, queries])
      entry = feeds.get(key) ?? {
        mode: preferences.mode,
        feed: createSpotFeed({ ...options, source: manifest.key, mode: preferences.mode, queries }),
        reports: [],
        attempted: false,
      }
      feeds.delete(key)
      feeds.set(key, entry)
      pruneFeeds()
    }
    return {
      raw,
      preferences,
      entry,
      online,
      distanceUnits,
      clusterEnabled: Boolean(live && liveClusterEnabled(raw)),
      loading: false,
    }
  }

  async function refreshVail(view: BoardView, publish = view.clusterEnabled) {
    const entry = view.entry
    if (!entry || view.loading) return
    view.loading = true
    try {
      entry.reports = await entry.feed.get(true)
      pruneFeeds()
      if (board === view) status = entry.feed.getStatus()
    } catch (error) {
      if (board === view)
        status = `${error instanceof Error ? error.message : 'RBN unavailable.'} Showing available unexpired reports.`
    } finally {
      entry.attempted = true
      view.loading = false
      if (publish) live?.queueDelivery()
    }
  }

  function select(view: BoardView): Spot[] {
    const { raw, preferences, distanceUnits, entry } = view
    const reports =
      entry?.attempted && !entry.feed.getStatus() ? entry.reports : cachedReports(preferences.mode)
    const clusterReports: Spot[] = []
    if (view.clusterEnabled) {
      for (const report of options.cluster?.getSnapshot().reports ?? []) {
        if (
          !spotBands.has(report.band) ||
          (preferences.mode !== 'all' && preferences.mode !== report.mode)
        )
          continue
        clusterReports.push({
          their: { call: report.call },
          freq: report.frequencyKhz,
          band: report.band,
          mode: report.mode,
          refs: [{ type: 'rbn', ref: report.call }],
          spot: {
            timeInMillis: report.timeMs,
            source: manifest.key,
            sourceInfo: {
              spotter: report.receiver,
              snr: report.snrDb,
              wpm: report.wpm,
              transport: 'cluster',
            },
          },
        })
      }
    }
    const selected = selectSpots(
      [...reports, ...clusterReports],
      preferences,
      options.lookup,
      now(),
      distanceUnits,
    )
    return (live ? selected.slice(0, maxLiveBoardSpots) : selected).map((spot) =>
      allowSpotMerging(raw)
        ? { ...spot, refs: spot.refs?.filter((ref) => ref.type !== 'rbn') }
        : spot,
    )
  }

  function demand(view: BoardView) {
    return {
      enabled: view.online && view.clusterEnabled,
      mode: view.preferences.mode,
      render: () => (board === view && !view.loading ? select(view) : undefined),
      fallback: () => refreshVail(view),
      nextVailRequestAt: () => view.entry?.feed.nextRequestAt() ?? 0,
    }
  }

  function updateBoardSettings(raw: Record<string, unknown>) {
    if (!board || !live?.active) return
    const view = makeView(raw, board.online, board.distanceUnits)
    board = view
    live.change(demand(view))
    if (!live.fresh) void refreshVail(view, true)
  }

  function pause() {
    boardLifecycle++
    board = undefined
    live?.pause()
  }

  const spots: SpotsHook = {
    sourceName: 'RBN',
    async fetchSpots(_args, ctx) {
      const lifecycle = boardLifecycle
      try {
        const { raw, generation: settingsGeneration } = await spotSettings()
        if (raw.spotContinents === undefined && locating) {
          status =
            'Finding a local receiver continent. Refresh Spots after location is available, or choose a continent in RBN settings.'
          return []
        }
        const view = makeView(raw, ctx.online, ctx.distanceUnits)
        if (lifecycle !== boardLifecycle) return select(view)
        board = view
        if (ctx.online) {
          const needsSnapshot = !live?.active
          live?.renew(demand(view))
          if (needsSnapshot || !live?.fresh) await refreshVail(view)
        } else {
          live?.pause()
          status = 'Offline: showing unexpired cached reports only.'
        }
        // If preferences changed during the request, only the newer view may supply spots.
        if (settingsGeneration !== generation && board === view) return []
        return board ? select(board) : select(view)
      } catch (error) {
        status = error instanceof Error ? error.message : 'RBN spots unavailable.'
        return []
      }
    },
  }
  const resetGroups = {
    merging: { spotAllowMerging: true },
    mode: { spotMode: 'all' },
    speed: { spotMinWpm: '', spotMaxWpm: '' },
    skimmers: { spotSkimmers: '' },
    grids: { spotGrids: '' },
    distance: { spotRadiusGrid: '', spotRadiusMiles: '' },
    allContinents: { spotContinents: [] },
  } satisfies Record<string, Record<string, JSONValue>>
  async function reset(group: keyof typeof resetGroups | 'all' | 'continents') {
    return serialized(async () => {
      const raw = ownSettings(await getSettings())
      const values: Record<string, JSONValue> = {}
      if (group === 'all') {
        for (const [key, defaults] of Object.entries(resetGroups)) {
          if (key !== 'allContinents') Object.assign(values, defaults)
        }
      } else if (group in resetGroups) {
        Object.assign(values, resetGroups[group as keyof typeof resetGroups])
      }
      if (
        group === 'allContinents' &&
        validation('spotContinents', raw.spotContinents) === null &&
        (raw.spotContinents as string[]).length
      ) {
        values.spotLastContinents = raw.spotContinents as Continent[]
      }
      if (group === 'all' || group === 'continents') {
        const defaults = defaultContinents(raw)
        values.spotContinents = defaults
        if (defaults.length) values.spotLastContinents = defaults
      }
      // Reset related fields together, even if the saved pair is invalid.
      // Never write the whole extension group: it also holds reception caches.
      generation++
      await setSettings(values)
      status = ''
      updateBoardSettings({ ...raw, ...values })
      return group === 'all'
        ? 'All RBN spot settings reset. Changes apply on the next Spots refresh.'
        : 'RBN spot filter reset. Changes apply on the next Spots refresh.'
    })
  }
  const actions = {
    async showAbout(_args: unknown, _ctx: HookContext) {
      await (options.showForm ?? host.showForm)(rbnAboutDefinition())
      return null
    },
    resetAllSpotSettings: (_args: unknown, _ctx: HookContext) => reset('all'),
    resetSpotMode: (_args: unknown, _ctx: HookContext) => reset('mode'),
    resetSpotSpeed: (_args: unknown, _ctx: HookContext) => reset('speed'),
    resetSpotSkimmers: (_args: unknown, _ctx: HookContext) => reset('skimmers'),
    resetSpotGrids: (_args: unknown, _ctx: HookContext) => reset('grids'),
    resetSpotContinents: (_args: unknown, _ctx: HookContext) => reset('continents'),
    clearSpotContinents: (_args: unknown, _ctx: HookContext) => reset('allContinents'),
    resetSpotDistance: (_args: unknown, _ctx: HookContext) => reset('distance'),
  }
  const settings: DynamicSettingsPanel & typeof actions = {
    ...actions,
    kind: 'dynamic',
    async getPanels() {
      return [
        { key: manifest.key, title: 'RBN', icon: 'radar', section: 'spotting', sidebar: false },
      ]
    },
    async getDefinition(_args, ctx) {
      const [{ raw }, health] = await Promise.all([spotSettings(), checkHealth(ctx.online)])
      const liveStatus =
        board?.clusterEnabled && live?.active
          ? live.fresh
            ? 'Live RBN reports are arriving from the DX cluster.'
            : 'Using Vail ReRBN while waiting for recent DX cluster reports.'
          : ''
      return settingsDefinition(
        raw,
        defaultContinents(raw),
        [liveStatus, status].filter(Boolean).join(' '),
        health,
      )
    },
    async validateField({ fieldKey, value, state }) {
      return validateEdit(fieldKey, value, state)
    },
    async onChangeField({ fieldKey, value }) {
      await serialized(async () => {
        // Recheck persisted siblings inside the queue: simultaneous edits must
        // not save a distance limit with no origin even if form state is stale.
        const raw = ownSettings(await getSettings())
        const error = validateEdit(fieldKey, value, raw)
        if (error) throw new Error(error)
        generation++
        const values = {
          ...(fieldKey === 'spotContinents' &&
          Array.isArray(value) &&
          (value.length ||
            (validation('spotContinents', raw.spotContinents) === null &&
              (raw.spotContinents as string[]).length))
            ? {
                spotLastContinents: [
                  ...new Set((value.length ? value : raw.spotContinents) as string[]),
                ],
              }
            : {}),
          [fieldKey]: (fieldKey === 'spotSkimmers' || fieldKey === 'spotGrids'
            ? tokens(value).join(', ')
            : fieldKey === 'spotRadiusGrid'
              ? String(value).trim().toUpperCase()
              : fieldKey === 'spotContinents'
                ? [...new Set(value as string[])]
                : fieldKey === 'spotRadiusMiles' ||
                    fieldKey === 'spotMinWpm' ||
                    fieldKey === 'spotMaxWpm'
                  ? value === null || String(value).trim() === ''
                    ? ''
                    : Number(value)
                  : value) as JSONValue,
        }
        await setSettings(values)
        status = ''
        updateBoardSettings({ ...raw, ...values })
      })
    },
  }
  const activity: ActivityHook = {
    async loggingControls() {
      if (allowSpotMerging(ownSettings(await getSettings()))) return []
      return [
        {
          key: `${manifest.key}/station`,
          label: 'RBN',
          icon: manifest.icon,
          input: { kind: 'refList', refType: 'rbn' },
        },
      ]
    },
  }
  return { spots, settings, activity, pause }
}
