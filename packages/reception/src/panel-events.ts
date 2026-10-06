import type { PanelScene, PanelSceneEvent } from '@ham2k/extension-sdk'
import type { PanelState } from './panel-state.ts'

/** Bind only the controls actually rendered to this placement and identity. */
export function bindPanelEvents(state: PanelState, scene: PanelScene): void {
  const prefix = `epoch:${state.epoch}:`
  const controls = (scene.controls ?? []).slice(0, 64)
  for (const control of controls) {
    if (control.event) control.event = prefix + control.event
    for (const item of control.menu ?? []) item.event = prefix + item.event
  }
  state.controls = new Map(controls.map((control) => [control.id, control]))
}

/** Native choices commit strings; drawn actions activate without a value. */
export function readPanelEvent(
  state: PanelState,
  event: PanelSceneEvent,
):
  | {
      controlId: string
      action: string
      strings?: Record<string, string>
    }
  | undefined {
  if (!state.active || !Number.isInteger(event.sequence) || event.sequence < 0) return
  if (state.lastSequence !== undefined && event.sequence <= state.lastSequence) return
  const control = state.controls?.get(event.controlId)
  if (!control || control.disabled || control.opacity === 0) return
  const prefix = `epoch:${state.epoch}:`
  if (!event.action.startsWith(prefix)) return
  const action = event.action.slice(prefix.length)
  const nativeChoice = control.kind === 'nativeDropdown' || control.kind === 'nativeSegmented'
  let result: { controlId: string; action: string; strings?: Record<string, string> }
  if (nativeChoice) {
    if (event.phase !== 'commit' || event.action !== control.event || !control.value) return
    if (
      typeof event.text !== 'string' ||
      !control.options?.some((option) => option.value === event.text)
    )
      return
    if (
      !['band', 'sort', 'view', 'detailsTab'].includes(control.id) ||
      action !== `${control.id}:set`
    )
      return
    result = {
      controlId: control.id === 'detailsTab' ? `details-${event.text}` : control.id,
      action: `${control.id === 'detailsTab' ? 'details' : control.id}:${event.text}`,
      strings: { [control.value]: event.text },
    }
  } else {
    if (
      event.phase !== 'activate' ||
      (event.action !== control.event && !control.menu?.some((item) => item.event === event.action))
    )
      return
    result = { controlId: control.id, action }
  }
  state.lastSequence = event.sequence
  return result
}
