import type { PanelRenderArgs, PanelScene, PanelSceneEvent } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { bindPanelEvents, readPanelEvent } from '../src/panel-events.ts'
import { applySceneEvent, createPanelStateStore } from '../src/panel-state.ts'

const args: PanelRenderArgs = {
  panelKey: 'reception',
  instanceId: 'one',
  operation: { uuid: 'op', stationCall: 'N1RWJ' },
  config: {},
  qsoCount: 0,
  reason: 'render',
}
function scene(): PanelScene {
  return {
    version: 1,
    width: 640,
    height: 640,
    values: {},
    strings: { band: 'all' },
    layers: [],
    controls: [
      {
        id: 'band',
        label: 'Band',
        kind: 'nativeDropdown',
        value: 'band',
        event: 'band:set',
        x: 0,
        y: 0,
        width: 200,
        height: 56,
        options: [
          { value: 'all', label: 'All bands' },
          { value: '40m', label: '40m' },
        ],
      },
      {
        id: 'refresh',
        label: 'Refresh reports',
        kind: 'button',
        event: 'refresh:reports',
        x: 210,
        y: 0,
        width: 44,
        height: 44,
      },
    ],
  }
}

describe('placement scene events', () => {
  it('commits a rendered string choice through authoritative placement state', () => {
    const state = createPanelStateStore()(args)
    const current = scene()
    bindPanelEvents(state, current)
    const event = readPanelEvent(state, {
      controlId: 'band',
      action: current.controls?.[0].event ?? '',
      phase: 'commit',
      sequence: 1,
      text: '40m',
    })
    expect(event).toEqual({ controlId: 'band', action: 'band:40m', strings: { band: '40m' } })
    if (!event) throw new Error('Missing choice event')
    applySceneEvent(state, event.controlId, event.action)
    expect(state.selection).toEqual({ band: '40m', page: 0 })
  })

  it('rejects malformed phases, choices, action pairs, and invalid sequences', () => {
    const state = createPanelStateStore()(args)
    const current = scene()
    bindPanelEvents(state, current)
    const valid: PanelSceneEvent = {
      controlId: 'band',
      action: current.controls?.[0].event ?? '',
      phase: 'commit',
      sequence: 4,
      text: '40m',
    }
    for (const extra of [
      { phase: 'change' },
      { phase: 'activate' },
      { text: 'bogus' },
      { text: undefined },
      { action: 'band:set' },
      { action: current.controls?.[1].event },
      { controlId: 'unknown' },
      { sequence: NaN },
      { sequence: 1.5 },
      { sequence: -1 },
    ])
      expect(readPanelEvent(state, { ...valid, ...extra } as PanelSceneEvent)).toBeUndefined()
    expect(readPanelEvent(state, valid)).toBeDefined()
    // The host counter belongs to a mounted Flutter widget, not the persistent
    // placement. A remounted pane may restart at one with the same context.
    expect(readPanelEvent(state, { ...valid, sequence: 1 })).toBeDefined()
    expect(readPanelEvent(state, { ...valid, sequence: 5 })).toBeDefined()
    expect(
      readPanelEvent(state, {
        ...valid,
        controlId: 'refresh',
        action: current.controls?.[1].event ?? '',
        phase: 'commit',
        sequence: 6,
      }),
    ).toBeUndefined()
  })

  it('invalidates queued actions on operation or saved-config changes and separates placements', () => {
    const stateFor = createPanelStateStore()
    const first = stateFor(args)
    const current = scene()
    bindPanelEvents(first, current)
    const action: PanelSceneEvent = {
      controlId: 'refresh',
      action: current.controls?.[1].event ?? '',
      phase: 'activate',
      sequence: 1,
    }
    const other = stateFor({ ...args, instanceId: 'two' })
    bindPanelEvents(other, scene())
    expect(readPanelEvent(other, action)).toBeUndefined()
    const changed = stateFor({ ...args, config: { watchCall: 'W1AW' } })
    bindPanelEvents(changed, scene())
    expect(readPanelEvent(changed, action)).toBeUndefined()
    const operation = stateFor({ ...args, operation: { uuid: 'another', stationCall: 'N1RWJ' } })
    bindPanelEvents(operation, scene())
    expect(readPanelEvent(first, action)).toBeUndefined()
    expect(readPanelEvent(operation, action)).toBeUndefined()
    expect(first.active).toBe(false)
  })

  it('bounds abandoned placements and accepts only currently visible, enabled controls', () => {
    const stateFor = createPanelStateStore()
    const first = stateFor(args)
    const current = scene()
    bindPanelEvents(first, current)
    const action: PanelSceneEvent = {
      controlId: 'refresh',
      action: current.controls?.[1].event ?? '',
      phase: 'activate',
      sequence: 1,
    }
    const hidden = scene()
    hidden.controls = []
    bindPanelEvents(first, hidden)
    expect(readPanelEvent(first, action)).toBeUndefined()
    const disabled = scene()
    if (!disabled.controls) throw new Error('Missing fixture controls')
    disabled.controls[1].disabled = true
    bindPanelEvents(first, disabled)
    expect(readPanelEvent(first, action)).toBeUndefined()
    for (let index = 0; index < 32; index++) stateFor({ ...args, instanceId: `new-${index}` })
    expect(first.active).toBe(false)
  })
})
