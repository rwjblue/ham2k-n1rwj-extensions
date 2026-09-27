# N1RWJ PSK Reporter

Live PSK Reporter reception maps for Ham2K with **extension API 3** and native
SVG panels. The regular package uses the published `@ham2k/extension-sdk`
**0.8.1** and `@ham2k/extension-tools` **0.7.0**, with a WebSocket permission
for `mqtt.pskreporter.info`, and HTTPS access to `retrieve.pskreporter.info`
for recent history.

## Build and install

```sh
mise run pack n1rwj-psk-reporter
```

Install `dist/n1rwj-psk-reporter-0.6.1.h2kext` through Ham2K's extension installer,
allow its declared network hosts, and add **PSK Reporter** to an operation's layout.
It follows the operation's station callsign and location unless overridden.
Choose **Who hears me** for outgoing reception or **Who I hear** for reports
uploaded by your receiving software. No fixture reports appear in the app.
The extension key is unchanged, so this replaces the earlier offline preview.

## Verification

`mise run check` includes the normal bundle's binary MQTT smoke test, strict
TypeScript checks, deterministic transport/panel tests and official packaging.
The smoke test exercises the actual published SDK's socket, HTTP, storage and
force-reload and timer bridges with fixture responses in a Node VM without
ambient browser or Node timers. It does not
validate native Ham2K UI, real HTTP access or operating-system lifecycle.

The implementation first passed against upstream source commit
[17b15fdcafdd](https://github.com/ham2k/halo/commit/17b15fdcafdd), then passed the
same contract, build, packer and binary bridge checks against the published
SDK 0.6.0/tools 0.5.0. Timer support is checked against SDK 0.8.1/tools 0.7.0.
The code uses the SDK's socket and timer types and regular entry point; no SDK
implementation is copied into this repository.

For future SDK/tools compatibility checks, an optional isolated candidate build
uses the same entry point and manifest:

```sh
mise run psk:build-live --sdk /path/to/extension-sdk --tools /path/to/extension-tools
```

The SDK directory must contain built `dist/` files. Omitting flags uses the
installed packages. This writes a development package and `toolchain.json` under
`dist/psk-development/`, leaving the normal package and dependency pins unchanged.

A bounded live-network probe uses the same transport and store under Node:

```sh
mise run psk:probe N1RWJ
mise run psk:probe CU3AT --incoming
```

It subscribes only to that callsign, runs for at most 75 seconds, reports whether
MQTT connected and whether reports arrived, and closes its connection. The local
probe established connection, subscription and heartbeat with the live broker;
CU3AT had no reports during that observation. Fixtures validate binary report
ingestion and scene generation separately. Native UI and lifecycle tests with
an API-3-capable app remain pending.

## Reception behavior

The info button beside reload opens **Status** for the watched callsign,
direction, window, live-feed/history state, and latest report on the selected
band. **About** explains the source, measurements, map origin, and reload
behavior. Warnings and next steps appear before general reference material.
Closing info returns to the report page you were viewing. See the
[design review and rendered mockups](../../../docs/RECEPTION-INFO-DESIGN.md).

- The shared [reception workspace](../../../packages/reception/README.md)
  supplies RBN's map, SVG renderer, settings, and panel state. Settings offer
  **Who hears me** and **Who I hear**, map/list layouts, band/window selection,
  projection and sorting. The default fitted map is north-up (Natural Earth 1)
  and keeps distant continents recognizable; the optional station-centered
  view supplies distance rings. Callsign and location follow the operation unless
  overridden. SNR belongs to the receiver; reported grids are never replaced
  with callsign-prefix guesses.
- `src/transport/mqtt.ts` implements the needed MQTT 3.1.1 clean-session QoS-0
  subscriber packets. It handles fragmented/coalesced binary packets, strict
  UTF-8, CONNECT/CONNACK, SUBSCRIBE/SUBACK, UNSUBSCRIBE/UNSUBACK, PUBLISH,
  PINGREQ/PINGRESP and DISCONNECT. Packet, frame and callback work limits reject
  malformed or excessive input. Retained publications are ignored.
- `src/transport/client.ts` negotiates `mqtt` over
  `wss://mqtt.pskreporter.info:1886`. Handshakes and subscription ACKs time out
  after 10 seconds. Host timers send a ping every 15 seconds and allow 15
  seconds for its reply. Failures retry with exponential 5–60 second backoff
  plus jitter while a subscription remains visible. A minute of stable connection resets backoff.
  Closed-session callbacks cannot affect the replacement session.
- `src/live.ts` shares **one socket per extension**, up to eight distinct narrow
  callsign/direction subscriptions and 32 placement leases. It validates topics
  against report payloads and exact watched calls before storing reports. The
  cache retains at most 1,000 newest links and expires them after one hour.
  Capacity loss is visible. A new callsign cannot display the prior call's data.
  Reports and capacity-loss state are saved in the extension's persistent settings,
  with changed snapshots checkpointed by a host timer after 30 seconds. Reports
  arriving during a write schedule another checkpoint; writes never overlap.
  Hiding attempts a final flush when the write cooldown permits. Three consecutive
  storage failures stop automatic retries until new activity occurs.
  Restart restores the full hour with original timestamps and exact callsigns;
  the newest reports win if live delivery overlaps restoration. An abrupt close
  can lose reports since the last checkpoint. Storage failures are shown in the panel.
- Panels normally render on the host's five-second tick cadence plus operation
  or UI events. Pending history requests add one-second render ticks so their
  results appear promptly. The first render observing completion removes that
  fast tick and returns to five seconds. Renders renew subscription visibility;
  MQTT deadlines and cache checkpoints run independently. Connection status is separate from report age; connecting
  is not presented as live reception. No per-report render or whole-log query occurs.
- Recent history uses PSK Reporter's documented XML query API on startup,
  after a collection gap, and when a larger report window needs older data.
  It requests the configured 15/30/60-minute window across all bands, with a
  1,000-record limit. History and MQTT reports share the same bounded cache;
  newer observations win. Exact callsign and direction filtering also applies
  to history. Unlocated stations remain in the list.
- Automatic HTTP requests share one queue and are spaced at least five minutes
  apart across all placements. A host timer wakes queued eligible work at its
  deadline; successful history requests do not start periodic polling. The
  cooldown persists across extension reloads. A pending relative delay is
  conservatively reapplied on restart, so developer clock changes cannot bypass it.
  Failures increase the delay up to an hour. Hidden or replaced subscriptions
  do not start queued work or ingest late responses. Requests use the host's
  timeout without an extension override; the inspected host allows 15 seconds
  for headers, then 30 seconds for the body. Rendering returns cached/live
  reports while HTTP runs independently, so neither automatic history nor manual
  reload blocks panel rendering or MQTT delivery.
- The **Force reload** arrow explicitly bypasses the local history cooldown,
  including failure backoff, but still obeys offline state and serializes requests.
  The action returns immediately; repeated clicks for the same pending request
  share its result, including a forced reload queued behind another callsign.
  It does not
  bypass server limits or browser challenges. Use it sparingly: the provider
  recommends no more than one retrieval every five minutes.
- Connection and history status are displayed separately. Challenges, HTTP
  errors, unsupported XML, response limits and cache capacity are reported;
  unsuccessful backfill never clears live reports or claims complete coverage.
  Details include the last history request duration. With real host clock samples,
  this is labeled as an upper bound through the render that observes completion;
  hiding the panel can extend that bound. Waiting for completion does not trigger
  another HTTP request on each one-second tick.

## Visibility and remaining native tests

Host timers expire each callsign/direction subscription after 30 seconds without
rendering, even when no socket event arrives. Placements watching the same topic
share its timer. Removing the last lease closes the socket and cancels queued
history work. The extension's `onHide` callback pauses reception immediately;
a fresh render renews visibility and reconnects. SDK timer callbacks are guarded
against cancellation, replaced sessions, and unloading. Relative delays remain
independent of the sandbox's developer clock. At most 14 timer slots are used,
within the host's limit of 16.

Native tab hiding, app backgrounding, sleep/resume and extension unload still
need verification in Ham2K. These callbacks do not promise continuous capture
while the app or its timers are suspended.

This is a **live window with best-effort backfill**, without a promise of background
capture or complete history. Cache contents can remain visible while offline or reconnecting. Incoming
reports require uploads from receiving software. Portable prefixes and suffixes
remain part of the exact watched callsign. MQTT uses dots for slashes in topics
and decodes dotted payload calls, matching
[GridTracker's MQTT client](https://gitlab.com/gridtracker.org/gridtracker2/-/blob/10d0e195b34c3d2d46dd8d79ccf927ea13dbd6f6/src/renderer/lib/mqttPsk.js).
The displayed calls and HTTP queries retain slashes. Portable delivery still
needs a live native test with a transmitting or receiving portable station.

History follows the [PSK Reporter query API](https://pskreporter.info/pskdev.html).
The September 24, 2026 command-line API probe received a Cloudflare browser
challenge instead of XML. Native `host.fetch` access remains unverified; this
implementation handles that failure without interrupting the MQTT feed. The
deterministic tests and SDK bundle smoke verify fixtures, not provider availability.
History responses, live reports and the automatic-request cooldown use the host's
persistent extension settings. The host's `kvGet`/`kvSet` are memory-only and are
not used for persistence. Timers service visible subscriptions, eligible history
work and pending cache writes; they do not renew visibility themselves.

Before publishing, install on a host supporting extension API 3 and native SVG
panels, and test both directions,
multiple placements, callsign/operation changes, hidden tabs, app backgrounding,
panel removal, sleep/resume, disconnects, denied grants and extension reload.
Check native binary delivery and UI on each intended platform.
Also check first-open history, force reload, returning after a gap, multiple
panels sharing the HTTP cooldown, a callsign change during a request, and an
HTTP denial or browser challenge while MQTT continues receiving. Verify cached
reports and the cooldown survive a full app restart, including an offline restart,
and verify portable calls in both directions.

Reports originate at [PSK Reporter](https://pskreporter.info/); the MQTT distribution
is operated by M0LTE ([feed schema and topics](https://www.mqtt.pskreporter.info/)).
The packet implementation follows [MQTT 3.1.1](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html).
Reception reports are not QSOs, confirmations or proof of coverage. The extension
neither submits spots nor logs contacts. See [shared map attribution](../../../packages/reception/assets/MAP_ATTRIBUTION.md).
