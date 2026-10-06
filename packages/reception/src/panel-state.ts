import type { PanelRenderArgs, PanelSceneControl } from '@ham2k/extension-sdk'
import { type PanelConfig, readConfig, receptionBands, receptionWindowMinutes } from './config.ts'
import type { SceneSelection } from './ui/scene.ts'

export interface PanelState {
  active: boolean
  epoch: number
  renderVersion: number
  controls?: Map<string, PanelSceneControl>
  signature: string
  config: PanelConfig
  selection: Partial<SceneSelection>
  bands?: readonly string[]
  reportPage?: number
}

/** One store per extension; placements may disappear without a teardown hook. */
export function createPanelStateStore() {
  const selections = new Map<string, PanelState>()
  let epoch = 0
  return (args: PanelRenderArgs, identity = ''): PanelState => {
    const config = readConfig(args.config)
    const signature = JSON.stringify([args.operation?.uuid, args.operation?.stationCall, identity])
    const key = args.instanceId ?? ''
    let state = selections.get(key)
    if (!state || state.signature !== signature) {
      if (state) state.active = false
      state = { active: true, epoch: ++epoch, renderVersion: 0, signature, config, selection: {} }
      selections.delete(key)
      selections.set(key, state)
      if (selections.size > 32) {
        const oldest = selections.keys().next().value as string
        const evicted = selections.get(oldest)
        if (evicted) evicted.active = false
        selections.delete(oldest)
      }
    } else if (JSON.stringify(state.config) !== JSON.stringify(config)) {
      for (const field of ['view', 'band', 'sort', 'direction', 'windowMinutes'] as const) {
        if (state.config[field] !== config[field]) delete state.selection[field]
      }
      state.selection.page = 0
      state.reportPage = 0
      state.config = config
      state.epoch = ++epoch
      state.controls = undefined
    }
    return state
  }
}

export function applySceneEvent(
  state: PanelState,
  controlId: string,
  action: string,
  cwSpeed = true,
): void {
  const [prefix, value] = action.split(':')
  if (action !== `${prefix}:${value}`) return
  if (
    controlId === 'band' &&
    prefix === 'band' &&
    (state.bands ?? receptionBands).includes(value)
  ) {
    state.selection = { ...state.selection, band: value, page: 0 }
    state.reportPage = 0
  } else if (
    controlId === 'window' &&
    prefix === 'window' &&
    String(Number(value)) === value &&
    receptionWindowMinutes.includes(Number(value))
  ) {
    state.selection = { ...state.selection, windowMinutes: Number(value), page: 0 }
    state.reportPage = 0
  } else if (
    controlId === 'sort' &&
    prefix === 'sort' &&
    ['age', 'call', 'snr', 'distance', 'frequency', ...(cwSpeed ? ['wpm'] : [])].includes(value)
  ) {
    state.selection = { ...state.selection, sort: value as SceneSelection['sort'], page: 0 }
  } else if (controlId === 'view' && action === 'view:cycle' && !state.selection.details) {
    const views = ['both', 'map', 'list'] as const
    const current = state.selection.view ?? state.config.view
    state.selection = {
      ...state.selection,
      view: views[(views.indexOf(current) + 1) % views.length],
      page: 0,
    }
    state.reportPage = 0
  } else if (
    controlId === 'view' &&
    prefix === 'view' &&
    ['both', 'map', 'list'].includes(value) &&
    !state.selection.details
  ) {
    state.selection = { ...state.selection, view: value as SceneSelection['view'], page: 0 }
    state.reportPage = 0
  } else if (controlId === 'direction' && action === 'direction:toggle') {
    state.selection = {
      ...state.selection,
      direction: (state.selection.direction ?? state.config.direction) === 'asc' ? 'desc' : 'asc',
      page: 0,
    }
  } else if (
    (controlId === 'previous' && action === 'page:previous') ||
    (controlId === 'next' && action === 'page:next')
  ) {
    state.selection = {
      ...state.selection,
      page: Math.max(
        0,
        Math.min(499, (state.selection.page ?? 0) + (controlId === 'next' ? 1 : -1)),
      ),
    }
  } else if (controlId === 'details' && action === 'details:toggle') {
    const opening = !state.selection.details
    if (opening) state.reportPage = state.selection.page ?? 0
    state.selection = {
      ...state.selection,
      details: opening,
      detailsTab: 'status',
      page: opening ? 0 : (state.reportPage ?? 0),
    }
  } else if (
    state.selection.details &&
    (value === 'status' || value === 'about') &&
    controlId === `details-${value}` &&
    prefix === 'details'
  ) {
    if (state.selection.detailsTab !== value)
      state.selection = { ...state.selection, detailsTab: value, page: 0 }
  }
}
