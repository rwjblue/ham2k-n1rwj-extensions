import type { PanelRenderArgs } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { applySceneEvent, createPanelStateStore } from '../src/panel-state.ts'

const args: PanelRenderArgs = {
  panelKey: 'reception',
  qsoCount: 0,
  reason: 'render',
  instanceId: 'one',
  config: {},
  operation: { stationCall: 'N1RWJ' },
}

describe('info navigation', () => {
  it('returns to the original report page after navigating info tabs and pages', () => {
    const stateFor = createPanelStateStore()
    const state = stateFor(args)
    state.selection = { page: 4, sort: 'snr', direction: 'asc' }
    applySceneEvent(state, 'details', 'details:toggle')
    expect(state.selection).toMatchObject({ details: true, page: 0, detailsTab: 'status' })
    applySceneEvent(state, 'details-about', 'details:about')
    applySceneEvent(state, 'next', 'page:next')
    expect(state.selection).toMatchObject({ detailsTab: 'about', page: 1 })
    applySceneEvent(state, 'details-about', 'details:about')
    expect(state.selection.page).toBe(1)
    applySceneEvent(state, 'details', 'details:toggle')
    expect(state.selection).toMatchObject({
      details: false,
      page: 4,
      sort: 'snr',
      direction: 'asc',
    })
    applySceneEvent(state, 'details', 'details:toggle')
    expect(state.selection).toMatchObject({ detailsTab: 'status', page: 0 })
    expect(stateFor({ ...args, instanceId: 'two' }).selection).toEqual({})
  })

  it('resets the saved report page when configuration changes while info is open', () => {
    const stateFor = createPanelStateStore()
    const state = stateFor(args)
    state.selection.page = 5
    applySceneEvent(state, 'details', 'details:toggle')
    const changed = stateFor({ ...args, config: { band: '20m' } })
    applySceneEvent(changed, 'details', 'details:toggle')
    expect(changed.selection.page).toBe(0)
  })

  it('ignores tab actions outside the info pane and mismatched controls', () => {
    const state = createPanelStateStore()(args)
    applySceneEvent(state, 'details-about', 'details:about')
    expect(state.selection).toEqual({})
    applySceneEvent(state, 'details', 'details:toggle')
    applySceneEvent(state, 'details-status', 'details:about')
    applySceneEvent(state, 'details-about', 'details:invalid')
    expect(state.selection.detailsTab).toBe('status')
  })
})
