# Native reception controls

RBN and PSK Reporter use `PanelContent.kind: 'scene'` and declare extension API 5.
The installed SDK 0.12.0 supplies `PanelScene`, string state and native choices;
extension-tools 0.8.0 validates and packages API 5 with the same shared libraries.
No dependency ranges or synchronized release versions changed for this work.

## Rendering and state

`packages/reception/src/ui/scene.ts` remains pure. Native Band and Sort dropdowns
and Status/About choices surround the existing map, cards, text and pagination.
RBN has a direct Map/Receivers/Both choice. PSK retains its saved View behavior.
Refresh, info, sort direction and pagination retain compact drawn controls with
full accessible descriptions. Native buttons display their whole accessible
label, which is unsuitable for those compact actions without a separate design.
Long information pages retain wrapped, paginated text layers; host `nativeText`
is a single-line display and does not solve long diagnostic text layout.

Controls have full rectangles. A pure toolbar calculation wraps choices and uses
a dropdown when segmented labels would crowd at the current width/text scale.
The map is generated at the space left below the toolbar, rather than fitting an
old full-size map into a smaller `layout.scene` viewport. Scene units equal host
logical pixels; `scaledFontSize` reserves space while text layers keep `fontSize`.
No layout-only controls or unbounded intrinsic-width rows are emitted.

`panel-events.ts` binds each visible control to a bounded placement context.
Native choices require `commit` and a valid `event.text`; drawn actions require
`activate`. Responses include `values: {}` plus the committed string patch.
The adapters apply those choices to `panel-state.ts`, then render authoritative
state. No filtering choice is local-only, and no new extension-wide preference
is written. Saved defaults, temporary selections and persisted source settings
remain separate.

Operation changes reset placement state. Saved default changes reconcile only
the corresponding choices. Any saved configuration change invalidates queued
actions; only the latest rendered visible controls may act. Context epochs and
render versions reject stale work. The host serializes/coalesces events and
supersedes old responses. Its event sequence restarts when a widget remounts, so
the extension validates sequence shape without rejecting restarted counters.
The store retains at most 32 placements. Refresh starts asynchronous source work
and returns promptly, retaining cached reports and the existing pending ticks.

## Compatibility

API-5 packages require an API-5 host even if a drawn renderer exists in source.
Older apps must use the previously published compatible package until updated.
`environment.version` and placement `instanceId` are not API-5 capability tests.
There is no invented runtime fallback or new shared-library requirement.

On October 6, 2026, installed macOS Next 26.9.0 build 177 accepted a temporary
API-5 pilot importing this shared renderer, placement state and event adapter.
Synthetic RBN/PSK reports verified Band and Sort commits, RBN view selection,
Status/About tabs, narrow toolbar wrapping and the narrow-view dropdown fallback.
The PSK fixture also remained readable at the app's largest font scale in its
dark panel theme. Dropdown keyboard selection worked after pointer focus.
Earlier SDK sample
checks also exercised switches and pending text edits before an action.
These checks cover native rendering with synthetic data, rather than production
network adapters, saved-config forms or every platform. See `VERIFICATION.md`
for the acceptance scope and remaining checks.

## Verification and acceptance

Deterministic tests retain finite concrete rectangles for artwork/drawn controls
and add the same assertions for rectangle-based native controls. They cover
wrapping, segmented fallback, bounds, payload limits, OS text-space reservation,
per-placement state, valid native commits, wrong phases/values, operation changes,
hidden controls, remounted widgets with restarted sequences, and pending refresh behavior.

`mise run reception:preview` renders actual renderer fixtures with schematic
native-control rectangles. `mise run rbn:preview` accepts both scene kinds and
can approximate live RBN snapshots. Neither reproduces Material widget layout,
keyboard behavior or accessibility. `mise run verify-host` checks the installed
JavaScript kernel with simulated wakes; native scheduling remains separate.

Before publishing, test the final panels in the intended native hosts:

- Narrow and short panes: choices remain usable and complete cards remain visible;
  a compact map is explicitly omitted rather than squeezed or overlapped.
- Large OS text and long labels: no clipped selected values or overflowing rows;
  toolbar wrapping and map space respond without double scaling.
- Light/dark themes, high contrast and reduced motion retain readable attribution,
  status, choices and report text.
- Keyboard and screen reader navigation exposes names, selection and actions;
  focus survives dropdown interaction and returns appropriately after actions.
- Multiple placements remain independent across changes and refreshes. Old queued
  events and slow renders cannot affect a new operation/configuration.
- Background/resume cancels visibility work correctly and retains bounded cached
  reports; asynchronous reload stays responsive during success and failure.

These reception-only changes do not alter CWT or CQ WW and require no contest PR
synchronization. A future release must follow the normal shared-workspace consumer
and synchronized-version rules; implementation commits do not publish artifacts.
