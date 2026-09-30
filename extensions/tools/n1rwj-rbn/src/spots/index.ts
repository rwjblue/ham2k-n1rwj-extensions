import type {
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
import type { Continent } from '../data/continents.ts'
import { createSpotFeed } from './feed.ts'
import { allCalls, discoverFilters, type FilterBridge, matchFilter } from './filters.ts'
import { createHealthCheck } from './health.ts'
import { type ReceiverLookup, selectSpots } from './model.ts'
import {
  ownSettings,
  readPreferences,
  spotModes,
  tokens,
  validateEdit,
  validation,
} from './preferences.ts'
import { settingsDefinition } from './settings.ts'

interface Options {
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>
  lookup: ReceiverLookup
  now?: () => number
  healthTimers?: TimerDriver
  bridge?: FilterBridge
  getSettings?: typeof host.getSettings
  setSettings?: typeof host.setSettings
  getLocation?: typeof host.getLocation
  continentNear?: (location: DeviceLocation) => Continent | null
}

export function createRbnSpots(options: Options) {
  const getSettings = options.getSettings ?? host.getSettings
  const setSettings = options.setSettings ?? host.setSettings
  const now = options.now ?? Date.now
  const checkHealth = createHealthCheck(options.fetch, now, options.healthTimers)
  const feeds = new Map(
    spotModes.map((mode) => [mode, createSpotFeed({ ...options, source: manifest.key, mode })]),
  )
  let status = ''
  let generation = 0
  let location: DeviceLocation | null = null
  let locationStarted = false
  let locating = false
  // Serialize geographic defaults and explicit edits so a slow discovery cannot
  // overwrite an operator's choice. Keep saved history selections even if absent.
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
  // Temporary source-side preference/discovery. Native relevance will instead
  // follow the operation in the logger; migrate explicit choices before removal.
  async function selection(online: boolean, forSettings = false) {
    return serialized(async () => {
      const raw = ownSettings(await getSettings())
      if (raw.spotContinents === undefined) {
        locateOnce()
        await initializeContinents(raw)
      }
      const key = typeof raw.spotCallFilter === 'string' ? raw.spotCallFilter : allCalls
      const discovered = await discoverFilters(online, options.bridge).catch((error: unknown) => {
        if (!forSettings && key !== allCalls) throw error
        status = 'Call-history filters could not be loaded. Retry after enabling the extension.'
        return { providers: [], failed: true }
      })
      const provider = discovered.providers.find((entry) => entry.key === key)
      const unavailable =
        key !== allCalls && !provider?.available
          ? provider?.reason ||
            'The selected call-history extension is unavailable. Enable it or choose another filter.'
          : ''
      return {
        raw,
        key,
        provider,
        unavailable,
        providers: discovered.providers,
        discoveryFailed: discovered.failed,
        generation,
      }
    })
  }
  const spots: SpotsHook = {
    sourceName: 'RBN',
    async fetchSpots(_args, ctx) {
      try {
        const selected = await selection(ctx.online)
        if (selected.raw.spotContinents === undefined && locating) {
          status =
            'Finding a local receiver continent. Refresh Spots after location is available, or choose a continent in RBN settings.'
          return []
        }
        if (selected.unavailable) {
          status = selected.unavailable
          return []
        }
        const prefs = readPreferences(selected.raw)
        const feed = feeds.get(prefs.mode)
        if (!feed) return []
        let reports: Spot[]
        try {
          reports = await feed.get(ctx.online)
          status = ctx.online ? feed.getStatus() : 'Offline: showing unexpired cached reports only.'
        } catch (error) {
          status = `${error instanceof Error ? error.message : 'RBN unavailable.'} Showing available unexpired reports.`
          reports = await feed.get(false)
        }
        // Compatibility bridge only: the feed cache above retains every report.
        // Once native relevance can preserve our history-based preference, remove
        // this match call and selectSpots' allowedCalls gate, keeping receiver filters.
        const allowed =
          selected.key === allCalls
            ? undefined
            : await matchFilter(
                selected.key,
                reports.map((spot) => spot.their.call),
                ctx.online,
                options.bridge,
              )
        // A settings edit while the network was pending invalidates this answer.
        if (selected.generation !== generation) return []
        return selectSpots(reports, allowed, prefs, options.lookup, now())
      } catch (error) {
        status =
          error instanceof Error ? error.message : 'Spot filters unavailable. No spots shown.'
        return []
      }
    },
  }
  const resetGroups = {
    mode: { spotMode: 'all' },
    speed: { spotMinWpm: '', spotMaxWpm: '' },
    skimmers: { spotSkimmers: '' },
    grids: { spotGrids: '' },
    distance: { spotRadiusGrid: '', spotRadiusMiles: '' },
    allContinents: { spotContinents: [] },
  } satisfies Record<string, Record<string, JSONValue>>
  async function reset(group: keyof typeof resetGroups | 'all' | 'history' | 'continents') {
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
      if (group === 'all' || group === 'history') {
        values.spotCallFilter = allCalls
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
      return group === 'all'
        ? 'All RBN spot settings reset. Changes apply on the next Spots refresh.'
        : 'RBN spot filter reset. Changes apply on the next Spots refresh.'
    })
  }
  const actions = {
    resetAllSpotSettings: (_args: unknown, _ctx: HookContext) => reset('all'),
    resetSpotCallFilter: (_args: unknown, _ctx: HookContext) => reset('history'),
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
      return [{ key: manifest.key, title: 'RBN', icon: 'radar' }]
    },
    async getDefinition(_args, ctx) {
      const [selected, health] = await Promise.all([
        selection(ctx.online, true),
        checkHealth(ctx.online),
      ])
      return settingsDefinition(selected, defaultContinents(selected.raw), status, health)
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
        await setSettings({
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
        })
      })
      status = ''
    },
  }
  return { spots, settings }
}
