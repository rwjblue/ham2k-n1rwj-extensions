# Shared reception components

RBN and PSK Reporter consume this workspace's ES2020 source. Each extension
bundles its own copy and owns its state; neither depends on the other being
installed. Host-provided libraries remain external and declared by each
extension's manifest. Declare this private workspace as a dev dependency
(`"@n1rwj/reception": "*"`) so the official packaging task also copies its
`assets/` notices into the consumer. The wildcard follows the local workspace
through synchronized release bumps; the lockfile pins its resolution.

| Module | Responsibility |
| --- | --- |
| `reports.ts` | Directed transmitter/receiver observations, latest-per-link selection, rows and map points |
| `callsign.ts`, `geography.ts` | Exact callsigns, distance and bearing |
| `config.ts` | Operation location/callsign defaults and configurable panel fields |
| `panel-state.ts` | Bounded per-placement state, defaults reconciliation, and report-page restoration |
| `panel-events.ts` | Visible-control registration, context guards, and native commit translation |
| `timers.ts` | Injected host timeouts with one pending callback per slot and cancellation guards |
| `map/` | Bundled geography, projections, paths, label placement and themes |
| `ui/` | Pure panel scenes, native choices, responsive cards/tables, artwork, report info and pagination |

Reports preserve both endpoints. SNR belongs to the receiver even when the UI
shows remote transmitters. Keys include transmitter, receiver, band and mode;
the newest observation wins, not the strongest SNR. Unknown locations stay
in the report list without guessed coordinates. Portable suffixes are exact.

Feed adapters own transport, parsing, rate limits, connection state, and
location enrichment. Presentation options supply attribution, endpoint labels,
optional CW-speed sorting and the refresh action. Shared rendering performs no
network or storage operations. RBN retains HTTP snapshot caching and its
receiver-directory adapter; PSK manages an MQTT stream independently.

The API-5 panel uses native Band and Sort choices. Band and sort choices
stay per panel placement until the saved default changes, the operation changes,
or the extension restarts. RBN also offers a temporary direct Map/Receivers/Both
choice; PSK continues to follow its saved view. Choices commit strings to extension
logic, rather than using local-only widget state. Event actions are validated
against the latest scene and its operation/configuration context. A slow render
cannot replace newer placement state. Host event counters may restart after a
pane remount; the extension relies on the host's serialized event queue rather
than persisting a sequence threshold across widget lifetimes.

Native controls use concrete rectangles in logical pixels. Narrow toolbars use
outlined menu buttons for Band, Window and RBN View, with visible current values
and down arrows. Compact choices show only their values, without a label row
or prefixes on wrapped buttons. Wide toolbars retain dropdowns and segmented View.
Refresh and Details/Back also use outlined native buttons.
The artwork is generated for the remaining space, preserving cartographic scale
and attribution. Typography reserves scaled space while the host scales text once.
The default drawn-control rendering path remains for focused artwork tests; it is
not a runtime compatibility strategy for extensions declaring API 5. See the
[native-control implementation and acceptance notes](../../docs/NATIVE-RECEPTION-CONTROLS.md).

Reception schedulers use API-3 host timeouts for relative deadlines and finite
visibility leases. Panel-provided real-time samples supply epoch timestamps;
virtual sandbox `Date` does not drive timer deadlines. Feed adapters own timer
budgets and persistence. The shared helper neither polls nor renews visibility.

The info button opens **Status** (scope, freshness, warnings, refresh guidance)
and **About** (interpretation, sources, and map origin). Feed-specific facts
come from `UiModel.details`; the shared renderer owns wrapping, card layout,
selected-band freshness and bounded pagination. See the
[design review and mockups](../../docs/RECEPTION-INFO-DESIGN.md).

Tests migrated with the map and UI. They retain coverage for typography,
contrast, small panes, dense maps, pagination and sandbox payload limits.
RBN's own panel tests protect its refresh and configuration behavior. PSK
tests cover both directions using the same renderer. Bundle tests verify that
both consumers receive the original map and library license notices.

See [map attribution](assets/MAP_ATTRIBUTION.md). `mise run rbn:geography`
retains its existing command name but writes the shared geography here.
