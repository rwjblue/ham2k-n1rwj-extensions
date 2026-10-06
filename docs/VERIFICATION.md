# Verification and compatibility

## SDK capability adoption — 2026-10-06

Implemented SST setup suggestions with state/province names while retaining
freeform corrections and clearing. CWT, MST, SST and WRT now register their own
ADIF/Cabrillo export types and filename defaults, preserving exchange fields,
contest tags, compact names and legacy generic requests. CWT runtime, tests and
documentation are synchronized to [Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1),
whose source branch `codex/cwt-call-history` was verified and updated with signed
commit `a63546d341ee66c08a3aef37c1614e0f0703072e`. CQ WW behavior and PR #2 were
unchanged. Mini-contest-only, reception-only and personal tooling changes are
exempt from those official contest synchronization requirements.

RBN and PSK Reporter declare API 5 and return `kind: 'scene'`. Native Band,
Sort and Status/About choices preserve the existing cartography, readable text
and pagination. RBN has direct temporary Map/Receivers/Both selection; PSK keeps
its saved View behavior. Context guards and render versions reject obsolete
operation/configuration work. Host event counters restart on widget remount, so
the extension does not persist a counter threshold across widget lifetimes.

RBN text exports cover HTML, Markdown, observations CSV, JSON, SVG and contact
context CSV. Exports use a frozen saved/cache dataset without starting network
requests. Archive collection defaults to off, its response queue is bounded,
raw archive rows win duplicates, and missing coverage is explicit. Format
selection keys are independent while companion observations and receiver
metadata share one dataset. PNG/ZIP and custom transport/email remain absent.

`mise run format` and `mise run check` passed: **1,143 tests across 87 files**,
strict runtime/test/task typechecks, lint, seven ES2020 builds and official
packaging. The independent geometry review checked 3,240 combinations of pane
size, text scaling, view and details state without out-of-bounds items.
`mise run reception:preview` regenerated nine scenarios and 51 pages with
schematic native controls; these are browser SVG approximations, not Flutter
widget screenshots. The RBN export examples remain explicitly synthetic.

`mise run verify-host` passed all seven bundles against installed **Ham2K Next
26.9.0 build 177**, kernel SHA-256
`c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
Timer wakes are simulated under Node VM; this does not establish Flutter UI,
accessibility, native exports or background/resume behavior.

The actual installed macOS app accepted a temporary API-5 official SDK sample
and rendered native dropdown, segmented and switch controls. Their values
reached extension logic, and an edited text field committed before a following
simulated action. No real spot, radio action, upload or email occurred. The Mac
then locked, preventing final reception-panel acceptance and temporary pilot
cleanup. The production renderer still needs narrow/short pane, large OS text,
theme, keyboard and screen-reader acceptance. Native save/share of RBN exports
and lifecycle behavior remain separate acceptance work. The temporary SDK Pilot
and its Home tab must be removed when the Mac is unlocked.

SDK 0.12.0, tools 0.8.0, shared-library ranges and synchronized version **0.7.6**
remain unchanged. These are implementation commits, not a release or catalog
publication. Previously uncommitted export designs and unrelated contest work
were preserved in their original Jujutsu change rather than overwritten.

## Non-Ham2K dependency review — 2026-10-05

Updated the independently committed development dependencies:

| Dependency | Previous | Current |
| --- | --- | --- |
| Biome | 2.5.14 | 2.5.15 |
| Node types (root and tasks) | 24.13.6 | 24.19.1 |
| LiquidJS | 10.29.0 | 10.30.0 |
| Vitest | 5.0.1 | 5.0.3 |
| mise GitHub Action | v4 | v5 |

Reviewed the primary [Biome](https://github.com/biomejs/biome/releases/tag/%40biomejs/biome%402.5.15),
[LiquidJS](https://github.com/harttle/liquidjs/releases/tag/v10.30.0), and
[Vitest](https://github.com/vitest-dev/vitest/releases/tag/v5.0.3) release
notes. Updated Biome's schema alongside the package and refreshed compatible
transitive dependencies, including Vite, Rolldown, Chai, and PostCSS.
Ham2K dependency versions are unchanged in this commit.

[mise-action v5.1.1](https://github.com/jdx/mise-action/releases/tag/v5.1.1)
keeps its GitHub token within the action by default. Release and catalog
steps already receive explicit `GH_TOKEN` values. `auto_update: true`
retains automatic mise refreshes despite v5's new cache default. Workflow
validation passed with actionlint 1.7.12; shell-script checking was disabled
because the workflows' shell commands are unchanged.

Node 24.21.0, TypeScript 7.0.2, esbuild 0.28.2, semver, D3, and the other
direct dependencies are already current. `npm outdated` now reports only
newer Node-type and i18next majors. Keep Node types on major 24 to match
the runtime and i18next 23.16.8 to match the host. Both npm dependency
trees audit with zero vulnerabilities.

`mise run format` and `mise run check` passed with the updated toolchain:
**1,053 tests across 77 files**, strict typechecks, lint, seven ES2020
builds, and official packaging of every extension.

These repository tooling changes are exempt from upstream CWT and CQ WW
behavior synchronization. Include root dependency updates under
**Shared changes** in the next authored release notes.

## Ham2K dependency review — 2026-10-05

Updated the published [extension SDK](https://www.npmjs.com/package/@ham2k/extension-sdk)
from 0.9.0 to 0.12.0 and [extension tools](https://www.npmjs.com/package/@ham2k/extension-tools)
from 0.7.0 to 0.8.0 after comparing their published code and contracts. The
[HaLo Next feed](https://updates.ham2k.net/halo-next/latest.json) still lists
26.9.0 build 177. All seven declared Ham2K shared libraries already match
their latest publications. Keep i18next 23.16.8 and the existing manifest
ranges, matching the host's shared-library contract.

SDK 0.12 includes viewport lookup helpers, optional activation radii, and
the API-5 panel scene contract with native controls and layouts. Our panels
retain API 3 and `svgScene`, which the SDK preserves as a compatible alias;
contest manifests retain API 1. Geometry tests now require concrete numeric
bounds before checking our SVG hit targets against the viewport. New scene
layout controls may omit those bounds, so the broader SDK types no longer
guarantee them.

The SDK's ADIF helper now forwards optional `operatorFallback`. Our CWT,
CQ WW, and mini-contest callers omit it, preserving host defaults. Scorer
helpers are unchanged; no contest runtime migration is required. Verified
the source branches of [CWT PR #1](https://github.com/ham2k/extensions/pull/1)
and [CQ WW PR #2](https://github.com/ham2k/extensions/pull/2). Repository
toolchain updates and reception-only tests/documentation are exempt from
their behavior synchronization requirements.

`mise run format` and `mise run check` passed: **1,053 tests across 77
files**, strict runtime/test/task typechecks, lint, seven ES2020 builds,
and official packaging of every extension.

`mise run verify-host` passed for all seven extensions against installed
**Ham2K Next 26.9.0 build 177**, kernel SHA-256
`c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
This executes the installed JavaScript kernel under Node VM with simulated
timer wakes; native UI, operating-system scheduling, and on-air behavior
remain outside its scope. Put these universal root dependency changes in
**Shared changes** when authoring the next release's notes.

## Release 0.7.6 publication — 2026-10-02

Published [v0.7.6](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.6)
from signed commit `02f6a921b75bc4db149a233dc0facdd589886453` at 17:23:03 UTC
(13:23 US Eastern time). GitHub verifies the signature, and the release tag
resolves to this tested commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37040297643)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37040336140)
succeeded. All seven bundles and seven checksum files are present, and the
published body matches `docs/releases/v0.7.6.md` exactly.

`mise run release:catalog v0.7.6 --dry-run` downloaded and validated every
published asset and selected RBN alone. The catalog job returned **approved**
on `stable` for RBN at 17:23:54 UTC. CQ WW, CWT, MST, PSK Reporter, SST, and
WRT were skipped as intended.

The preparation checks below remain the runtime verification scope;
publication does not establish native UI or on-air acceptance. These records
are personal repository documentation, exempt from upstream CWT and CQ WW
behavior synchronization.

## Release 0.7.6 preparation — 2026-10-02

Prepared synchronized version 0.7.6 for optional RBN spot separation and
in-panel My Signal view cycling. Reviewed the diff from v0.7.5: the runtime
changes affect RBN alone. The shared reception view control is opt-in and
only RBN enables it; PSK Reporter still renders its configured view and
has no new control. The lockfile changes only synchronize workspace
versions. `docs/releases/v0.7.6.md` selects RBN alone for catalog submission.

`mise run release:notes v0.7.6`, `mise run format`, and
`mise run release v0.7.6 --dry-run` passed, including **1,053 tests across
77 files**, lint, strict typechecks, seven ES2020 builds, official packaging,
and every release bundle/checksum pair. `mise run verify-host` passed for
all extensions against installed **Ham2K Next 26.9.0 build 177** using its
JavaScript kernel under Node VM and simulated timer wakes.

Deterministic tests cover default merging without an activity control,
explicit separation, cached reports, settings validation, resets and
restarts; placement-specific view cycling, saved defaults, independent
band/sort selections, distinct view icons, and unchanged map geometry
across widths and font scales. Static screenshots use sample reports and
approximate native text. No native app or on-air acceptance was performed
for these changes or the release archives.

RBN/reception UI changes and personal versioning, packaging, and publication
records are exempt from upstream CWT and CQ WW behavior synchronization.

## Release 0.7.5 publication — 2026-10-01

Published [v0.7.5](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.5)
from signed commit `bc7613c6f5885414802a55ad6d110fe31fb8e6e7` at 22:13:14 UTC
(18:13 US Eastern time). GitHub verifies the signature, and the release tag
resolves to this tested commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36933681677)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36933712586)
succeeded. All seven bundles and seven checksum files are present, and the
published body matches `docs/releases/v0.7.5.md` exactly.

`mise run release:catalog v0.7.5 --dry-run` downloaded and validated every
published asset and selected RBN and PSK Reporter. The catalog job returned
**approved** on `stable` for PSK Reporter at 22:13:56 UTC and RBN at
22:13:57 UTC. CQ WW, CWT, MST, SST, and WRT were skipped as intended.

The preparation checks below remain the runtime verification scope; publication
does not establish native UI or scheduling behavior for the new SNR option.
These publication records are personal repository documentation, exempt from
upstream CWT and CQ WW synchronization.

## Release 0.7.5 preparation — 2026-10-01

Prepared synchronized version 0.7.5 for the optional RBN My Signal minimum
SNR setting and the reception time-window and band-menu improvements.
Reviewed the diff from v0.7.4: runtime changes affect RBN and PSK Reporter;
CQ WW changes add synchronized regression coverage without changing runtime
behavior. All package, manifest, and lockfile changes in the release
preparation are synchronized version updates. The authored
`docs/releases/v0.7.5.md` selects RBN and PSK Reporter for catalog publication.

`mise run release:notes v0.7.5`, `mise run format`, and
`mise run release v0.7.5 --dry-run` passed, including **1,044 tests across
77 files**, lint, strict typechecks, seven ES2020 builds, official packaging,
and validation of all seven bundle/checksum pairs. `mise run verify-host`
passed for every extension against the installed **Ham2K Next 26.9.0 build
177** JavaScript kernel under Node VM, including simulated timer wakes.

The new SNR option has deterministic coverage for optional configuration,
inclusive thresholds, zero and negative values, missing measurements,
latest-report precedence, map/list filtering, persistence, and clearing.
These checks do not establish native UI or scheduling behavior. Earlier
local candidates have the focused native macOS time-window and band-menu
acceptance recorded below; those candidates predate the SNR option and are
not these exact release archives.

The shared reception workspace affects RBN and PSK Reporter only. Reception
changes and personal release versioning, packaging, and documentation are
exempt from CWT and CQ WW upstream behavior synchronization.

## Reception time windows and band menus: native macOS acceptance — 2026-09-30

Installed the local RBN and PSK Reporter candidates containing commit
`8b38ab47` through **Settings → Features & Extensions → Install from file**
in published **Ham2K Next 26.9.0 build 177**. Both candidates declare
**0.7.4 / extension API 3** and differ from the published v0.7.4 artifacts.
Read-only comparisons confirmed that each installed `index.js` matched the
script in its candidate archive byte-for-byte. Version numbers alone were
not used to identify the tested implementation.

| Candidate bundle | Archive SHA-256 | Installed and archived `index.js` SHA-256 |
| --- | --- | --- |
| `n1rwj-rbn-0.7.4.h2kext` | `41a1f8e6571fbbe3a9749e730ddabe703761ef49673af4643ec20ad2b3c4a259` | `18083601ecfa192888b6c764b5da08ae0b04a9748e0fd47cb4f1d30168f2b61d` |
| `n1rwj-psk-reporter-0.7.4.h2kext` | `4e5fea1d859d9b76d0a98f59a994fc6bae853032850b8c20af7d8bbb3df93788` | `5a24a3bc4adbd1fa9da2c1e2730cfa6f1a2d612dfbdee7133577972f13bc0072` |

Both installed scripts contain the shared reception renderer, placement
state, and validated event handlers, the **1, 3, 5, 10, 15, 30, 45, and 60
minute** choices, and the new native band menu. Native accessibility text and
screenshots confirmed the following in the existing **W8CAR/TEST** operation,
which remained at **zero QSOs**:

- Both panel band labels opened native menus. Selecting **20m** in RBN and
  **40m** in PSK Reporter changed the active filter. Views without matching
  reports displayed the corresponding band-specific empty-report message.
- Both native tune dialogs offered all eight report-window choices. Saving
  **1 minute** succeeded in each panel, and each panel's report details showed
  **Last 1 minute**.
- PSK Reporter watched public **OE3OBB** in a **45-minute** window with an
  explicit **FN42** test map origin; that origin was a rendering fixture, not
  a verified transmitter location. Live and recent-history reports populated
  approximately **450 receivers on 40m** during the observation. Selecting
  **20m** removed the 40m rows and receiver markers; **All bands** restored
  them. Report details showed **Last 45 minutes**. The service reported an
  incomplete history caused by its report limit, so these counts do not
  establish complete reception coverage or raw-feed parity.
- RBN watched public **W6WX** with explicit **CM87XH** origin and a
  **45-minute** window in the combined map/list view. **All bands** displayed
  **3 receivers, 4 bands, and 6 rows** in the observed snapshot. Selecting
  **20m** narrowed this to **2 receivers, 1 band, and 2 rows**, with **WT8P**
  and **N6TV** on the map. Details showed **Latest report · 20m** and
  **Last 45 minutes**; the selected view included a report aged **44 minutes**.

No code defect was observed in these native interactions. The screenshots
were inspected during the run and were not saved as repository artifacts.
These are focused native macOS checks; they do not establish phone or Linux
acceptance, complete service history, or background/restart lifecycle behavior.
After testing, RBN's captured settings were restored: blank watched callsign
and map-origin grid, **15-minute** window, **Map** view, saved and in-panel
**All bands**, and report-time sorting in descending order. The temporary
PSK Reporter panel was removed and the layout saved. The original **INFO /
SPOTS / MAP / My Signal** tabs remained, with **MAP** selected. Returned to
the original **N1RWJ for CWT 1900z / ROB CWA** operation with **21 QSOs**;
the test operation still had **zero QSOs**. The radio remained at
**7047.41 kHz CW / 75 W**. Both locally built candidates remain installed
intentionally.

The reception workspace is consumed by RBN and PSK Reporter only. These
changes and their verification are exempt from CWT and CQ WW upstream
synchronization; no contest behavior changed.

## Release 0.7.4 publication — 2026-09-30

Published [v0.7.4](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.4)
from signed commit `772dbd2f07bd44331c1de8efbe07dfc88ba3c3d9` at
15:31:37 US Eastern time (19:31:37 UTC). GitHub verifies the signature as
valid, and the tag and workflow target that exact tested commit. The published
body matches the authored [release notes](releases/v0.7.4.md) byte-for-byte.

The [main Check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36766188253)
and [Release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36766290761)
passed. All seven bundles and seven matching checksum files were uploaded by
19:32:05 UTC. Catalog submissions returned **approved** on `stable` for
**CWT**, **MST**, **RBN**, and **SST** at 19:32:27, 19:32:30, 19:32:34, and
19:32:39 UTC respectively. CQ WW, PSK Reporter, and WRT were explicitly
skipped according to their reviewed no-change sections.

`mise run release:catalog v0.7.4 --dry-run` downloaded and validated every
published bundle and checksum without resubmitting anything. It selected
the same four catalog entries and skipped the same three unchanged extensions.
Published archive SHA-256 values for the changed entries:

| Extension | SHA-256 |
| --- | --- |
| CWT | `f1cdd8d8e393123a4a1eb30b911c70171b1737d56fb04a964abefd8a2f878186` |
| MST | `f16527451a9f96eed101d9d3c89474e11b2d59c69e18eda057a80459245d7321` |
| RBN | `42911876756bb45ea97a5e88c6227f497eef2621197f91198544e90b3b7a80e3` |
| SST | `e13e05afe43cc614f3c294b9772c54eb3973f767e2a7672d82f81b9f3231d6a6` |

Publication validation does not extend native UI/device verification. The
release notes retain the unverified RBN badge rendering and chip behavior.
CWT remains synchronized to its upstream PR source branch as recorded below.
These publication records are personal repository documentation, exempt from
upstream runtime synchronization.

## Release 0.7.4 preparation — 2026-09-30

Prepared synchronized version **0.7.4** after reviewing changes since v0.7.3.
The authored [release notes](releases/v0.7.4.md) select **CWT, MST, SST, and
RBN** for catalog publication. CQ WW, PSK Reporter, and WRT explicitly have
no extension-specific changes; WRT does not invoke the changed N1MM downloader.
The root lockfile changes only synchronized workspace versions, with no
universal dependency update. GitHub archives all seven extension bundles.

`mise run format`, `mise run release:notes v0.7.4`, and
`mise run release v0.7.4 --dry-run` passed, including **965 tests across 74
files**, lint, strict application/task typechecks, ES2020 builds, official
packaging, synchronized versions, and checksums for all fourteen assets.
RBN remains verified against the installed Next build 177 JavaScript kernel;
native UI badge rendering and chip behavior remain unverified.

CWT runtime, adapters, documentation, and regression behavior match the live
`codex/cwt-call-history` source branch at `8da9a0ca` for
[Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1).
Upstream validation passed **130 tests**, typecheck, and official build/pack;
the upstream checkout remains clean. MST/SST-specific code, RBN, and personal
release versioning/packaging are exempt from that synchronization. CQ WW
behavior is unchanged.

## RBN reference badge — 2026-09-30

RBN registers one unconditional `activity.loggingControls` descriptor with
`input: { kind: 'refList', refType: 'rbn' }` and the existing `radar` icon.
HaLo's `packages/halo_widgets/lib/src/activity_controls.dart` matches
references through `input.refType`; a reference handler alone cannot supply
the icon. `qso_row_badges.dart` retains the badge for `refList`, while treating
primary exchange inputs as contest metadata. The host's icon catalog contains
`radar`. The descriptor is returned even for an empty operation or offline
context, so existing saved `{ type: 'rbn', ref: <full callsign> }` references
are recognized without migration, redecoration, or deleting data.

The supported control adds one collapsed, user-hideable **RBN** chip in the
logging panel's secondary controls. Opening it edits the QSO's RBN references;
it does not join the primary callsign/RST/exchange focus loop. No operation
controls, activity suggestions, scoring, or export hooks were added.
The HALO-741 station references, Spots labels/grouping, newest-report
deduplication, receiver filtering, and export behavior remain unchanged.

Focused bundle regressions cover registration for new and saved references,
including portable callsigns, offline use, and preservation of unrelated
references. Station-reference tests cover all four supported modes and the
existing filtering and deduplication behavior.

`mise run format` and `mise run check` passed **965 tests across 74 files**,
lint, strict typechecks, all seven ES2020 builds, and official packaging.
`mise run verify-host n1rwj-rbn` passed against the installed Next 26.9.0
build 177 JavaScript kernel, confirming the new `activity/n1rwj-rbn` hook
alongside the existing hooks and declared shared-library compatibility.
This runs the installed kernel under Node VM, with simulated timer delivery;
it does not exercise the native app UI. Native badge rendering and chip
behavior have not been verified for this change.

This is an RBN-only change, exempt from CWT and CQ WW upstream
synchronization: no contest or shared runtime code changed. It is included
in v0.7.4 above.

## N1MM call-history refresh timeouts — 2026-09-30

CWT, MST, and SST follow-up N1MM requests previously allowed only 3.5 seconds
for both response headers and body. A controlled native-host test reproduced
the reported `TimeoutException after 0:00:00.895180` at `hostResponse`: headers
arrived after 2.6 seconds, then the body exceeded the remaining allowance.
The hook itself has a separate ten-second deadline.

Discovery and download now share an eight-second real-time host timer, with
late results discarded before replacing cached history. The deadline does
not use the developer clock. Older API-1 hosts without timers allow 4.5
seconds per discovery/download request (nine seconds total); a selected
entry permits one eight-second request. API requirements remain unchanged.
Direct text and disk-cache replay do not start a timer or download again.

An in-process native-host probe using current host source `e66a39ba`, the
published SDK 0.9, and the changed downloader confirmed API-1 timer support.
With the sandbox clock frozen at January 1, 2000, a four-second discovery
plus a 0.1-second POST succeeded in 4.137 seconds. A four-second discovery
plus a 4.6-second POST rejected at 8.013 seconds with the readable N1MM
timeout error. The probe's previous snapshot remained unchanged after the
late response finished; the sandbox clock remained frozen throughout.
These are controlled native-host tests, not a test in the user's UI.
The older native host passed the same frozen-clock success case in 4.132
seconds using the timer-unavailable fallback. Its slow POST timed out at
8.511 seconds, and the probe retained its previous snapshot after the late
response finished. All four final native mock-network cases passed.

`mise run format` and `mise run check` passed **960 tests across 74 files**,
lint, strict typechecks, all seven builds, and official packaging. New
regressions cover slow successful requests, a frozen developer clock, total
deadline exhaustion, suppression of a late discovery's POST, late download
results retaining the previous history, timer cleanup, and the older-host
fallback. Tests exercise both MST and SST data-file hooks.

Live Node HTTP checks resolved the current listing and downloaded CWT
(`216,050` characters), MST (`213,025`), and SST (`277,193`) through the
changed downloader in approximately 1.27, 1.48, and 1.53 seconds. These are
network adapter checks, separate from native-host tests and native UI use.

The CWT runtime, hook adapter, tests, and relevant README are synchronized
to the verified `codex/cwt-call-history` source checkout for
[Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1).
MST/SST-specific adapters, tests, and documentation are exempt from that
upstream CWT synchronization. WRT uses the contest engine without downloaded
history; CQ WW and the reception extensions do not use this downloader.
This fix is included in v0.7.4, and the user's updated client has not been
tested directly.

## Release 0.7.3 publication — 2026-09-30

Published [v0.7.3](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.3)
from signed commit `236b11a248221ec32d3a82e075f555aa079f52c4` at
14:24:36 US Eastern time (18:24:36 UTC). GitHub verifies the signature as
valid, and the tag and workflow target that exact tested commit. The published
body matches the authored [release notes](releases/v0.7.3.md) byte-for-byte.

The [main Check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36758235873)
and [Release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36758360368)
passed. The upload job finished at 18:25:12 UTC, with all seven bundles and
seven matching checksum files uploaded by 18:25:10 UTC. The catalog job
finished successfully at 18:25:32 UTC and approved **CWT**, **PSK Reporter**,
and **RBN** on `stable` at 18:25:27, 18:25:28, and 18:25:30 UTC respectively.
CQ WW, MST, SST, and WRT were explicitly skipped according to their reviewed
no-change sections. All submitted release notes were accepted.

`mise run release:catalog v0.7.3 --dry-run` downloaded and validated every
published bundle and checksum without resubmitting anything. It selected the
same three catalog entries and skipped the same four unchanged extensions.
Published archive SHA-256 values for the changed entries:

| Extension | SHA-256 |
| --- | --- |
| CWT | `55aa589edb84e2e4c1bbd195e35a07e539dcf2e44cbb8c68a8297f806c37bd88` |
| PSK Reporter | `d5fde5f1abdc6ce993536c2fb6fd6e5722f78ae00728863b4d192a046d9fad28` |
| RBN | `82741e672584dd1aa02a37a79df9d0d5000816843dd7f914cc34fbc45cd96e83` |

Publication validation does not extend the native UI/device acceptance
record. The release notes retain Vail's receiver-node and report-parity
limitations and the unverified native behavior of the new station reference.
CWT remains synchronized to its upstream PR source branch as recorded in
preparation below. These publication records are personal repository
documentation, exempt from upstream runtime synchronization.

## Release 0.7.3 preparation — 2026-09-30

Prepared synchronized version **0.7.3** from main after reviewing the full
diff since v0.7.2. The authored [release notes](releases/v0.7.3.md) contain
all seven extension sections. Catalog extraction selects only **CWT, PSK
Reporter, and RBN**; CQ WW, MST, SST, and WRT explicitly have no
extension-specific changes. No root dependency or shared runtime update is
included; the lockfile diff changes only synchronized workspace versions.

`mise run format`, `mise run release:notes v0.7.3`, and
`mise run release v0.7.3 --dry-run` pass. The release dry run includes lint,
strict application/task typechecks, **947 tests across 73 files**, ES2020
builds, official archive validation, synchronized-version checks, and SHA-256
validation of all seven bundles and seven checksum files.

CWT's opt-in history-filter behavior, supporting tests, and documentation
are already synchronized to live [Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1):
the source bookmark `codex/cwt-call-history`, its origin bookmark, and the
upstream checkout resolve to `05b5495e5e44ea857e8c5297d0a28f7a558f3b9a`.
RBN, PSK Reporter, and personal versioning/packaging changes do not affect
upstream CWT or CQ WW behavior and are exempt from synchronization.

The unfinished Settings Report extension and investigation drafts remain in
the separate `unfinished` workspace; the QRZ experiment remains on its
unmerged bookmark. Neither is included in the release candidate. The checks
above do not establish new native installation/UI acceptance. Live receiver
comparisons and remaining Vail identity/report-parity limits are recorded below.

## RBN fresh retry — 2026-09-30 16:57 UTC (unreleased)

Repeated the comparison after the operator requested another attempt. Froze
**16:47:00–16:57:00 UTC** (`since=1790786820&until=1790787420`), reread current
source, and ran the same actual runtime with All calls, all modes/continents,
no grid-region or CW speed restriction, and the existing response/pagination
bounds. All **28 API requests returned HTTP 200**, the slowest in 1,169 ms.
Requests ran at 17:01:07–17:01:10 UTC. No timeout, rate-limit or feed warning
occurred. Refetched the live directory (350 nodes) and retained the geographic
planner's 11 directed IDs plus nine global-band queries.

The visible built-in browser comparison used 40m and the same receiver groups,
100 rows, unrestricted modes/station/speed, and UTC minute labels. Split the
radius receiver list into three groups so row bounds did not hide the window.

| Comparison | API | Direct RBN website |
| --- | ---: | ---: |
| KM3T-2/-3, separately queried across all bands | 0 reports each | 3 raw 40m CW rows, 2 unique stations |
| Bare KM3T, 40m CW | 7 raw reports, 3 unique stations | Full family: 8 rows, 4 unique stations |
| FN41FR, 100 miles, 40m CW | 11 unique API reception IDs, 4 unique stations | 12 rows, the same 4 unique stations |

The radius matches **K3WA (7010 kHz), KG4EXY (7064), VE3DZZ (7026), and
WA8VTD (7002.6)** with no missing/extra station. Runtime results total
**863 station/band/mode spots**, including **16 on 40m** and four CW on 40m.
The feed parsed 12,433 reports; local selection retained 2,114 rows including
query overlap, or 1,242 original API reception IDs. Offline NA filtering of
that evidence retained the same 863/16/four results.

Exact node filtering still cannot be confirmed: Vail returns zero for the
suffixed IDs. The website's exact pair shows only **KG4EXY and VE3DZZ**;
its additional **K3WA and WA8VTD** reports come from KM3T-5. This demonstrates
that replacing KM3T-2/-3 with the bare family would silently widen the choice.
The saved IDs therefore remain strict, accompanied by the explanatory notice.
Bare KM3T returned 602 reports and 556 deduplicated spots across all bands.
Vail is missing the family's WA8VTD CW report visible on the website; W1NT
supplies that station to the radius result. The missing row is absent from
the complete directed API response before local filtering. Raw source parity
and exact node identity remain limitations, as do minute-level boundary times
and the unverified digital website comparison described below.

New evidence is saved locally in `dist/verification/rbn-20260930-1657/`:
`compact-summary.json`, `requests.json`, raw payloads, source hashes, parsed and
selected reports, receiver directory, browser DOM captures and screenshots.
No further runtime edits were needed by this retry. The **990-test** full
working-copy check below remains valid. Before committing the receiver-filtering
changes, an isolated checkout excluding the pending station-reference fix,
Settings Report extension, and investigation drafts passed **941 tests across
72 files**, lint, strict typechecks, ES2020 builds, and official packaging.
No build was installed or published.

## RBN live receiver comparison — 2026-09-30 (unreleased)

Completed the requested one-time retry after approximately 30 minutes. Vail
responded successfully. This run found an additional identity mismatch;
the earlier directed-query change alone does **not** fix exact suffixed IDs.
Vail returns `KM3T` and `W1NT`, while the RBN directory and website identify
`KM3T-1/-2/-3/-5` and `W1NT-2/-6`. The exposed API payload has no original
node-ID field. Its [documented spotter filter](https://vailrerbn.com/docs/endpoints)
cannot recover those identities from the bare reports.

The frozen API interval was **2026-09-30 14:33:00–14:43:00 UTC**, inclusive:
`since=1790778780&until=1790779380`. Ran the actual current feed, parser,
query planner, receiver directory adapter, and selector with a fixed clock.
Call-history was **All calls** (`allowedCalls` undefined), modes/continents
were unrestricted, grid regions were blank, and CW speed bounds were absent.
Every request used the runtime's four-second timeout, maximum 1 MB response,
1,000 rows per page, and at most two pages. Request URLs, statuses, totals,
timings, responses, parsed reports, selected spots, runner source, and source
hashes are saved locally under
`dist/verification/rbn-20260930-1443/`, with the repeat under `after-fix/`.

Opened the direct RBN website in a visible Codex in-app browser, first without
receiver/band/mode/station/speed restrictions. Then applied only the equivalent
receiver and 40m constraints. Read the displayed `z` times as UTC. Used a
one-hour age view to retain the frozen interval and 100 visible rows. The
combined radius list hit that bound, so split it into KM3T-family, W1NT-family,
and other nearby receivers; each view reached beyond the frozen interval or
had no reports. Saved DOM rows and screenshots. Website times have minute
precision, so rows labelled 14:43 are a boundary comparison rather than proof
of exact second-level inclusion. Excluding that minute preserves the same
interior station matches. API requests ran well after the frozen interval,
allowing ingestion time; residual differences remain documented below.

| Selection / source | Raw reports | Unique station/band/mode results |
| --- | ---: | ---: |
| API `spotter=KM3T-2`, all bands/modes | 0 (HTTP 200) | 0 |
| API `spotter=KM3T-3`, all bands/modes | 0 (HTTP 200) | 0 |
| Website KM3T-2/-3, 40m | 14 CW rows | 8 CW stations |
| API bare `KM3T`, all bands/modes | 633 | 575 |
| API bare `KM3T`, 40m CW subset | 21 | 8 |
| Website all nearby directory nodes, 40m | 30 CW rows | 9 CW stations |
| Updated radius feed after local filtering | 2,082 parsed reports including overlapping queries | 871 across all bands/modes; 50 on 40m, including 9 CW |

Both exact IDs were queried separately with band and mode omitted, for example
`https://vailrerbn.com/api/v1/spots?spotter=KM3T-2&since=1790778780&until=1790779380&limit=1000&offset=0`.
The bare control changes only `spotter` to `KM3T`. Its eight matching 40m CW
calls are **K1ZHG, KA2QPG, KB2FSB, KU3J, N2ESE, N2QLV, VE3NFN, VE3YTX**,
with matching frequencies. The radius adds **VA3CJW**, also matching the website.
No unique 40m CW station is missing or extra in this radius comparison.

Raw reception reports are **not identical**. The website's full KM3T family
has 22 rows versus Vail's 21: the call-count comparison has one fewer N2QLV
and KA2QPG report, and one additional K1ZHG report in Vail (the latter at the
14:43 boundary). Website KA2QPG/VE3NFN times also differ by about one minute.
W1NT has eight website rows versus seven API reports: its N2QLV report at
14:40, 7061 kHz is absent from Vail. The combined receiver-family API controls
therefore have 28 reports versus 30 website rows. Repeated reports, lost
suffixes, and minute-level timing prevent exact node-level reconciliation.
The direct website main view returned CW rows; API FT8/FT4 totals were retained
and checked through runtime parsing/filtering, but were not independently
matched to a digital website view. This verifies the compared CW station set,
not full upstream report parity across modes.

The live directory contained 350 nodes. Before this follow-up fix, radius
planning used nine directed IDs plus nine global-band queries: 25 successful
requests, 9,998 parsed reports, and 651 deduplicated spots (43 on 40m). Global
page bounds still truncated busy bands. Adding the bare-family queries
retrieved reports beyond those pages. The repeat used 11 directed IDs plus
nine global-band queries, retaining the supplement for report-grid-only
receivers: all 27 API requests succeeded, producing 11,261 parsed reports.
Local filtering selected 2,082 reports; normal station/band/mode deduplication
produced 871 spots, **220 more**, with no previously selected result removed.
The 40m increase from 43 to 50 comprises seven digital results; CW remains nine.
Deduplicating the overlapping responses by their original API report IDs gives
1,265 selected receptions, including 87 on 40m and 28 CW receptions on 40m.
An offline replay of the pre-fix feed with the original exact directory lookup
and an NA continent selection yields only **two** spots, neither on 40m:
bare KM3T/W1NT reports had no matching directory continent.
Reapplying an NA continent filter offline to this same fresh evidence also
produced 871/50/nine; that check is not a separate live NA request simulation.

The fix queries bare families for geography and derives cached directory
metadata only when all sibling nodes agree on each field, including any bare
node. Conflicting grids are excluded from region/radius filtering; exact
suffixed reports retain exact metadata. Missing grids retain the documented
approximate report-grid fallback. Exact suffix choices remain unchanged and
strict; settings now explain the API limitation and offer the bare callsign
as an explicit family selection. No original receiver ID is fabricated.

Regressions cover query alias bounds, consensus and ambiguous metadata,
persisted-directory reload/removal, radius/continent integration, and the
suffix notice without silently changing the selection. `mise run format` and
`mise run check` passed **990 tests across 77 files**, strict typechecks, lint,
ES2020 builds and official packaging. Live verification uses the actual source
with a network adapter; it is not a native Ham2K installation/UI test. Nothing
was published or installed. RBN-only changes are exempt from CWT/CQ WW PR
synchronization; unrelated working-copy changes were preserved.

## RBN Spots timeout recovery — 2026-09-30 (unreleased)

The reported `TimeoutException after 0:00:01.999978` matches the native
Spots feed's explicit two-second HTTP request allowance. Local host source
in `app/lib/services/extension_service.dart` gives Spots a ten-second fan-out
budget; `packages/halo_extension_host/lib/halo_extension_host.dart` bounds
each requested HTTP timeout across headers and body. The feed now allows
four seconds per page, keeping its two sequential pages within eight seconds
of network time and reserving approximately two seconds for other hook work.

Each receiver/band query now keeps successful pages independently. Failed
queries merge their fresh pages with unexpired prior reports, deduplicated
and bounded to 2,000 reports per query. Successful queries replace their own
cache, including empty results. An incomplete refresh returns available
reports with a settings warning instead of discarding all successful queries.
The warning survives throttled refreshes and clears after recovery. Existing
mode/scope cache fallback, current receiver/history filters, coalescing, and
shared API backoff remain in effect.

Two live CW requests (20m and KM3T-2) each exceeded a 15-second allowance
without an HTTP response. The health endpoint also returned no HTTP response
within ten seconds, both with default networking and forced IPv4. These
observations establish a feed/connectivity failure from this machine during
verification; they do not establish a worldwide service outage. Restarting
cannot repair that failure and removes the in-memory Spots cache.

The isolated timeout fix passes **882 tests across 68 files**, lint,
strict typechecks, ES2020 builds, and official package validation. The full
checkout also passes `mise run format` and `mise run check`, including
**941 tests across 74 files** with the other pending changes.
Seven new regressions cover cold-start partial failures, second-page failures,
cache expiry and recovery, per-query replacement, concurrent refreshes,
partial success with HTTP 429 backoff, and settings warnings. The installed
JavaScript-kernel check passes against the running Next 26.9.0 build 177.
These are deterministic and kernel/bundle checks; native live recovery is
unverified while the feed is unavailable. The local RBN 0.7.2 candidate has
not been published or installed by this verification.

These changes affect only RBN source, tests, and documentation, so they are
exempt from synchronization to the CWT and CQ WW upstream PRs.

## RBN receiver filtering — 2026-09-30 (unreleased)

The native Spots feed previously downloaded at most 2,000 worldwide reports
per band before applying local receiver filters. A live Vail ReRBN ten-minute
40m query returned 3,583 reports in total; its first 1,000 included no reports
named KM3T-2 or KM3T-3. This established the worldwide snapshot bound, but did
not establish why those IDs were missing: the later live comparison above
found that Vail reports bare receiver names. Subsequent API timeouts prevented
measuring matches on the omitted pages during the initial investigation.
The official RBN directory places both receivers in FN42ET, approximately
74.97 miles from FN41FR, so both pass a 100-mile radius.

The feed now queries each selected receiver across bands before pagination
when the selection has up to 32 IDs. Geographic selections resolve candidates
from the current receiver directory. Queries retain exact local ID matching,
directory-grid precedence, and report-grid fallback; a worldwide supplement
preserves unknown receivers when no receiver continent is selected. Larger
selections retain the bounded worldwide feed. Mode and query scope identify
the cache, so receiver edits and directory loads can immediately retrieve
the new selection; offline and failed refreshes reapply current filters to
unexpired cached reports.

The reported website comparison also had two independent restrictions: the
operator selected a CWT/MST/SST call-history filter, while the website showed
all calls over six hours. RBN Spots retain ten minutes and collapse repeated
station/band/mode reports. The guide and settings now explain how to compare
equivalent views.

Deterministic tests cover the capped worldwide-feed reproduction, exact KM3T
IDs, FN41FR within 100 miles, unknown receiver fallback, query pagination,
empty selections, cache scope changes, mode isolation, directory reloads,
offline filtering, and failed-refresh reuse. `mise run format` and
`mise run check` pass, including **934 tests across 73 files**, lint, strict
typechecks, ES2020 builds, and official packaging. These are unit/bundle
checks; live directed-query and native Ham2K verification remain outstanding
because Vail ReRBN timed out during follow-up requests. The local RBN 0.7.2
candidate has not been published or installed by this verification.

RBN source, tests, and documentation are independent of CWT/CQ WW behavior,
so this change is exempt from synchronization to either upstream contest PR.

## Release 0.7.2 publication — 2026-09-29

Published [v0.7.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.2)
from signed commit `e67b396ed0cb6b5bd4800bb218accf40510cd2a2` at 23:14:26 US
Eastern time on September 29 (03:14:26 UTC on September 30). GitHub verified
both the release commit and RBN fix commit `23ecb31a`.

Local `mise run release v0.7.2 --dry-run` and the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36663504231)
passed **833 tests across 67 files**, lint, strict typechecks, ES2020 builds,
official packaging, synchronized-version checks, and bundle/checksum validation.
The workflow uploaded all seven bundles and seven matching checksum files;
the catalog approved every extension on `stable` between 03:15:10 and 03:15:17 UTC.
The SDK 0.8.1 to 0.9.0 update appears under **Shared changes** in the authored
notes and selects all seven catalog entries.

`mise run release:catalog v0.7.2 --dry-run` downloaded and validated the actual
GitHub assets without resubmitting them. Published RBN bundle SHA-256:
`eac5f17c0dd6de53c164afa99d976b60c68add784234cdf6ee9acea8ab1606b3`.

The live RBN directory reproduced the reported parse exception because it
included `UNKNOWN`. The fixed parser loaded all 350 entries, including its
supplied grid, country, and continent. Deterministic tests cover noncallsign
receiver IDs in reports, directory/cache replay, map positions, and exact
Spots receiver/grid filters, while preserving transmitter callsign checks and
malformed-directory rejection. Native HaLo build-177 startup verification
remains outstanding; the local host-source checkout was build 170.

CWT behavior remains synchronized with
[PR #1](https://github.com/ham2k/extensions/pull/1) at `9106257d`.
Immutable GitHub blobs for all seven CQ WW runtime/translation files exactly
match [PR #2](https://github.com/ham2k/extensions/pull/2) at `928c2482`;
official CQ WW's 55 tests, repository typechecks, build, and packaging passed.
No upstream edits were needed for this release. RBN changes and personal
release packaging do not affect either temporary contest extension's behavior.

## Release 0.6.0 publication — 2026-09-27

Rebased the WRT stack onto main's RBN mode-default update (`4437fcf2`) and
pushed signed release commit `1edadb2f32aa5220df9173d1d1c1230e6d0b1b69` to main.
GitHub verified its signature, and the
[main CI run](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36286103313)
succeeded before publication.

[v0.6.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.6.0)
was published at 01:38:27 UTC on September 27 (September 26 in US Eastern time).
The [upload job](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36286148410/job/108527191360)
passed checks and uploaded all seven bundles and seven matching checksum files.
Local `mise run release v0.6.0 --dry-run` passed **698 tests across 57 files**,
strict typechecks, lint, builds, official packaging, version checks, and checksums.
`mise run verify-host` loaded all seven extensions against Ham2K build 175
without compatibility problems; this runs the installed kernel under Node VM.

The [catalog job](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36286148410/job/108527265840)
returned **approved** for MST, RBN, SST, and WRT on `stable` between 01:39:13
and 01:39:18 UTC. CQ WW, CWT, and PSK Reporter were skipped according to the
authored release notes. The same notes file supplies the GitHub release body
and each catalog entry's relevant section.

A separate `mise run release:catalog v0.6.0 --dry-run` downloaded and validated
all published GitHub bundles and checksums without resubmitting them. The
published WRT bundle's SHA-256 is
`ac9ba8a8721673f5e89bf609e37f2a31563cf9f0321305b7dc29dcd19bf9e05e`.
Native WRT UI and on-air testing remain pending. Release bookkeeping and the
WRT/MST/SST/RBN changes do not alter CWT or CQ WW behavior, so no upstream-PR
synchronization was required.


## WRT implementation — 2026-09-26

Prepared v0.6.0 with `n1rwj-wrt`, extending only the MST/SST mini-contest
engine. After rebasing onto the RBN mode-default change on main, full checks passed
**698 tests across 57 files**, lint, strict
TypeScript checks, ES2020 builds, and official packaging for seven extensions.
WRT adds 18 tests for UTC sessions, mode/band restrictions, duplicates,
callsign multipliers, checkpoint resume, exchange hints, explicit clearing,
ADIF/Cabrillo fields, and sandbox activation without network hooks.
Existing MST/SST tests remain passing.

`mise run verify-host n1rwj-wrt` loaded all five WRT hooks against the running
**Ham2K 26.9.0 build 175** kernel from
`/Applications/Ham2K Mac Logger (Next).app`, with no compatibility problems.
Kernel SHA-256:
`ee7338084608394a7a9409f4feda32a5438ec642ca8876db249f684d614dee63`.
The declared shared-library ranges remain unchanged. The published SDK
contract and host `ExchangeFieldsModel` confirm that typed values and deliberate
clearing take precedence over `suggestedValue`.

This is deterministic unit/bundle verification and installed JavaScript kernel
execution under Node VM, **not native UI or on-air testing**. Test those before
claiming an end-to-end operating verification. At the implementation check, the prepared version and local bundles had
not yet been published; the publication record above covers the subsequent release.

The WRT rules and sponsor-linked N1MM definition were checked directly;
[provenance](PROVENANCE.md#weekly-rtty-test) records those sources and the
unlisted ADIF contest identifier. WRT does not download history or submit
scores. Its operation-history adapter is consumed unchanged; changes to the
mini-contest engine affect only MST, SST, and WRT. CWT/CQ WW runtime source
is unchanged, so their temporary upstream PR synchronization is not required.


## Release 0.4.2 publication — 2026-09-25

Published [v0.4.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.4.2)
from signed commit `de99b092c25b925d0b622020b2a971038cbcdab4` at 14:13 UTC
on September 25. GitHub verified the commit signature. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36146050962)
passed checks and uploaded all five bundles and matching checksum files.

Local `mise run release v0.4.2 --dry-run` passed **589 tests across 48 files**,
lint, strict typechecks, builds, official packaging, synchronized-version checks,
and checksums. `mise run release:notes v0.4.2` validated and previewed every
extension's notes. After upload, `mise run release:catalog v0.4.2 --dry-run`
downloaded and validated the actual published bundles and checksums; it did
not submit them again. Published bundle SHA-256 digests are:

| Extension | SHA-256 |
| --- | --- |
| CWT | `8430279581282bd77e9b0d1186f2200b94ea63c0de20756ec26f51840d6809b6` |
| ICWC MST | `90d54c13e232fa857b1d8d1b5c2429693ae2f0b8260ced58231ddd8401f94899` |
| PSK Reporter | `c29a2b564c3047dfb073e6d353bde4754172250a74e30d9067fa4f180ba5e1ea` |
| RBN | `277b1a1b9f7c138f9fd82cee298babc63f4d44fb8b5f15fa1788c9c82a1658c8` |
| K1USN SST | `6324ed7171a0dbdc01184e5c9a8bfecf94427a806acec97e0dad58435bd89123` |

The catalog job accepted all five exact archives on `stable` between
14:14:18 and 14:14:25 UTC, each **pending review**, with notes extracted
from the same authored GitHub release body. This is submission evidence,
not confirmation of catalog approval or installation availability.

Tests cover persistent report caches, original report ages, exact portable
callsigns, shared server backoff, automatic cooldowns, forced refreshes,
offline resume, and fresh sandbox instances using the SDK settings bridge.
These are deterministic and bundle checks. Native portable delivery, full
app restart/resume, and PSK historical API availability remain unverified;
the command-line history probe encountered a Cloudflare challenge.

Contest behavior and dependencies are unchanged from v0.4.1. The contest
version bumps and these publication records are personal packaging and
repository documentation, exempt from upstream CWT synchronization.

## Dependency updates and contest history filtering — 2026-09-23

Checked all root/workspace npm dependencies, the separate `mise/tasks` package,
installed transitive packages, project Node tooling, and GitHub Actions.
Updated SDK 0.5.0 → 0.5.7, tools 0.3.0 → 0.4.0, TypeScript 6.0.3 → 7.0.2
(root and tasks), LiquidJS 10.28.0 → 10.29.0, D3 Geo types 3.1.0 → 3.1.1,
and semver types 7.7.1 → 7.8.0. The root lock also updates magic-string,
Rolldown (including platform bindings), and its OXC types within parent ranges.
TypeScript 7's platform packages account for most of the added lockfile entries.

Kept Node 24.21.0 and Node types 24.13.6 aligned with the declared Node 24
runtime; kept i18next 23.16.8 aligned with the host compatibility range.
Other direct npm dependencies were current. Transitive packages whose latest
release falls outside their parent's range were left to their upstream owners;
no overrides or shared-library range changes were introduced.

Updated Actions to [checkout v7](https://github.com/actions/checkout/releases/tag/v7.0.1),
[upload-artifact v7](https://github.com/actions/upload-artifact/releases/tag/v7.0.1),
and [mise-action v4](https://github.com/jdx/mise-action/releases/tag/v4.3.0).
The workflows use GitHub-hosted Ubuntu runners, retain their current inputs,
and pass `mise exec actionlint@1.7.12 shellcheck@0.11.0 -- actionlint`.
These workflow updates have not yet run on GitHub.

The installed SDK's `HistoryForCallOptions` and `docs/hooks.md` confirm the
optional `refType` filter. Host source at
`652eeb84f89b837de336d40eec34563cde8b8dd1` was inspected in
`app/lib/services/extension_service.dart` and
`packages/halo_core/lib/src/repo/qsos_repository.dart`: the filter is applied
in the database query before ordering and limiting. CWT, MST, and SST now pass
their own contest type on every exact/base history query. Local validation,
source precedence, and bounded current-operation revalidation remain intact.

`mise run check` passed: **473 tests across 39 files**, lint, all three
TypeScript projects, all four ES2020 bundles, and official packaging.
`npm audit` reported zero vulnerabilities. `mise run release:notes v0.4.1`
validated the next release's notes; package/manifest versions remain 0.4.0
until release preparation. This does not replace the published 0.4.0 artifacts.

The CWT filter, three regression cases, documentation, and required SDK/tools
updates are mirrored in the checkout based on PR #1's verified source branch
`codex/cwt-call-history`; upstream CWT's **120 tests**, typecheck, build, and
official packaging passed, as did the **96 repository bundle checks**.
MST/SST changes and general monorepo dependency/CI
tooling are exempt from that synchronization. These checks are unit/build
verification, not a new native Ham2K runtime test. Older hosts ignore options
and can still miss matching history beyond their five unfiltered results.

## Release 0.4.0 publication — 2026-09-23

Published [v0.4.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.4.0)
from signed commit `bf6fa7a4b0afb415628c98ae88c259aa943e8d66` at 17:58 UTC
on September 23. GitHub verified the commit signature. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35899278672)
passed, attached all four bundles and checksum files, and submitted every
bundle with its extension-specific notes to catalog channel `stable`.
All four submissions were accepted as **pending review** at 17:59 UTC;
catalog approval remains unverified.

`mise run release:catalog v0.4.0 --dry-run` downloaded the published assets
and validated matching versions, every checksum, and per-extension notes
without resubmitting. Published archive digests:

| Published bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.4.0.h2kext` | `332547b31e5f5048b864f956db25de9ebf8efdd1651c06cd55dc387034e57aeb` |
| `n1rwj-mst-0.4.0.h2kext` | `6a9cfbc1f0efcae31939235079cc0cb3d126230398bc2e411f39c400b06e4e6f` |
| `n1rwj-rbn-0.4.0.h2kext` | `fa15e9fb74f92d90935b8fbf03823ac10c0719a51ee39f074cd3ddf9c5694fcf` |
| `n1rwj-sst-0.4.0.h2kext` | `5ecbed5f1ba54617f51e504bf0cc74e66a84d17fe8eb4ba4c050fd0ec593dfa1` |

No new native installation or interaction acceptance was performed during
publication. This record is personal packaging documentation, exempt from
CWT upstream synchronization.

## Release 0.4.0 preparation — 2026-09-23

Prepared synchronized version **0.4.0** with native RBN Spots, reusable
CWT/MST/SST call-history filters, receiver geography controls, and distinct
My Signal/Spots settings. The authored release document gives each catalog
entry only its own extension notes. Corrected the RBN installation instructions
to use the current **My Signal** panel name.

`mise run release:notes v0.4.0`, `mise run format`, and
`mise run release v0.4.0 --dry-run` passed: **468 tests across 39 files**,
lint, both strict TypeScript checks, four official builds and package
validations, synchronized versions, and archive checksums.
`mise run verify-host` accepted all four 0.4.0 bundles and their registered
hooks against the installed Next **26.9.0 build 170** JavaScript kernel.
This kernel check runs under Node VM; no new native installation or interaction
acceptance was performed for the versioned 0.4.0 archives. Earlier native
candidate observations and their limits are recorded below.

The CWT implementation and shared spot-filter sources are mirrored on
[upstream PR #1](https://github.com/ham2k/extensions/pull/1), whose source
branch remains `codex/cwt-call-history`. Its four queued commits were signed
and pushed after **117 CWT tests**, repository-wide typechecks, and CWT
build/pack passed. The reusable matcher and contract match byte-for-byte;
the CWT adapter differs only in its repository-specific i18n import path.
RBN/MST/SST changes, personal versioning/packaging, and release tooling are
exempt from the temporary CWT synchronization requirement.

## Release 0.3.4 publication — 2026-09-21

Published [v0.3.4](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.3.4)
from signed commit `f1851580c6f6ef948ae799b1520460d78b3e351a` at 02:35 UTC
on September 22 (September 21 locally). GitHub verified the commit signature.
The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35679997989)
passed, attached all four bundles and checksum files, and submitted every
bundle to catalog channel `stable`. All four submissions were accepted as
**pending review** at 02:35 UTC; catalog approval remains unverified.

`mise run release:catalog v0.3.4 --dry-run` downloaded the published assets
and validated matching versions and every checksum without resubmitting.
Published archive digests:

| Published bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.3.4.h2kext` | `5e2b1753d10c79c143e296728453089359f61132566f624e4fe0709405a4cfe6` |
| `n1rwj-mst-0.3.4.h2kext` | `f5ec39191ee55093285480ea53dfc5650e071a001cc7b208d0ddedbb27a4b7e0` |
| `n1rwj-rbn-0.3.4.h2kext` | `a4c71dc6837ff97bcd9921e811fc923b7a29a45f29fded854a7437ff837a8f04` |
| `n1rwj-sst-0.3.4.h2kext` | `4cb7399413adda32913a79e7c98df4556f4ec91ac14da14db6af6eed71c0bad8` |

No new native installation or interaction acceptance was performed during
publication. This record is personal packaging documentation, exempt from
CWT upstream synchronization.

## Release 0.3.4 preparation — 2026-09-21

Prepared synchronized version **0.3.4** with the RBN receiver-directory
cache introduced in `79f8f532`. Reviewed directory parsing, location fallback,
cache retention, and registration changes. Contest runtime behavior is unchanged.

`mise run format` and `mise run release v0.3.4 --dry-run` passed:
**419 tests across 32 files**, lint, strict typechecks, official builds and
packaging, and all eight bundle/checksum paths. `mise run verify-host` passed
for all four extensions against the running **Ham2K Next 26.9.0 build 170**
kernel, SHA-256
`b001f0c0ede236f2dfb5a24788aaaebd49709bb193ff487b90337b115790f743`,
including the `dataFile/n1rwj-rbn_receivers` hook.

These checks exercise automated tests and the installed JavaScript kernel
under Node VM, not native installation, UI interactions, or live directory
refresh. RBN changes and personal release packaging/documentation are exempt
from CWT upstream synchronization.

## Release 0.3.3 publication — 2026-09-21

Published [v0.3.3](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.3.3)
from signed commit `a306ccee520c4bb26c450eb33f913621eff138f7`. GitHub verified
the commit signature. The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35673953580)
passed its checks, attached all four bundles and checksum files, and submitted
all four bundles to catalog channel `stable`. The catalog reported each as
**pending review** at 00:57 UTC on September 22; approval remains unverified.

`mise run release:catalog v0.3.3 --dry-run` downloaded the published artifacts
and validated synchronized versions and every checksum without resubmitting.
These are the published archive digests, distinct from the local candidate
archive digests recorded below:

| Published bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.3.3.h2kext` | `de9fdf234b13564b6a52407ed5f4a4d05195f4ba0f0d752590f04b780ef980df` |
| `n1rwj-mst-0.3.3.h2kext` | `c38a4f4c2a7b7345ef953655a514af5b59402c1806adc6afe58437672b37d195` |
| `n1rwj-rbn-0.3.3.h2kext` | `4d47d65d9925ec1f1357c0e9c8252c0bd7de3e9a33ab66c5571c11591089930b` |
| `n1rwj-sst-0.3.3.h2kext` | `53393201c84417066a95c6a6a76f789ea39dd391b4a24977e62409fa329a5e64` |

No new native installation or interaction acceptance was performed during
publication. This publication record is personal packaging documentation,
exempt from CWT upstream synchronization.

## Release 0.3.3 preparation — 2026-09-21

Reviewed the four commits after published `v0.3.2`: Vail ReRBN migration,
settings preservation, compact layout, and manual refresh/reduced scheduled
renders. No remaining release-blocking defects were identified. Corrected the
refresh integration tests' mock responses to include the required `offset`
and `limit` fields; previously they exercised error caching. The tests now
also assert populated report reuse across placements and a successful manual
refresh with an updated check timestamp. Updated the root operator instructions
for View/Band in panel settings and corrected the stale catalog status.

Prepared synchronized version **0.3.3** across the root, all four extensions,
shared workspaces, and lockfile. `mise run format` and
`mise run release v0.3.3 --dry-run` passed: **411 tests across 30 files**, lint,
strict typechecks, official builds/packaging, and all eight asset/checksum paths.
`mise run verify-host` passed for every extension against the running
**Ham2K Next 26.9.0 build 170** kernel, SHA-256
`b001f0c0ede236f2dfb5a24788aaaebd49709bb193ff487b90337b115790f743`.

| Candidate bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.3.3.h2kext` | `7ad8a6a0b1f254ad0a5ac8bb93b6a86f40a9151a2d96f91c47a7ac813c7ce3b3` |
| `n1rwj-mst-0.3.3.h2kext` | `35ce89e7f3dca610e20e29669bfa03898ae8974394b65e6f7e103b098a7a356c` |
| `n1rwj-rbn-0.3.3.h2kext` | `87bc1605f9751c5f503a14e5a3cdc4af9f1629af8948d6bbd11c52b75a5bfece` |
| `n1rwj-sst-0.3.3.h2kext` | `7be067967bb44c323ce9988d43e97e9259384fb817c970cb2e3c8d8b852f5159` |

These are local release candidates, not published or newly installed native
artifacts. Earlier native checks below cover the layout/settings candidate;
the final manual-refresh button still lacks native interaction acceptance.
RBN changes, release documentation, and personal packaging are exempt from
CWT upstream synchronization; contest runtime behavior is unchanged.

## Manual RBN refresh — 2026-09-21 (unreleased)

Added **↻** beside Details in the existing status row. Layout tests at 320,
390, and 1366 logical pixels confirm separate touch targets of at least 44
pixels, no overlap with status text, and unchanged map bounds. Static SVG
previews were inspected at phone, desktop, and enlarged-text sizes; these are
fixture-based previews, not native acceptance screenshots.

Panel tests cover the manual 30-second cooldown, concurrent tap deduplication,
reuse on the host's post-event render, retained display choices, waiting for
the action to complete, offline state, and server-directed 429 backoff across
queries. The native host disables scene buttons while an awaited action is
pending; this was verified in source, not by clicking the installed app.

`mise run format` and `mise run check` passed: 411 tests in 30 files, lint,
typechecks, builds, and official packaging. The installed-kernel check passed
against Next 26.9.0 build 170. The local package has not been installed or
published by this verification. RBN-only changes require no CWT upstream sync.

## RBN refresh budget and visibility — 2026-09-21 (unreleased)

The panel now declares `tick:60`, matching its existing 60-second per-query
network cooldown. Deterministic panel tests exercise the real RBN client with
mock HTTP responses: reveal and placement recreation reuse the cache through
59,999 ms; a request is eligible at 60,000 ms; neither panel discovery nor time
passing without renders causes polling; returning after five minutes fetches
once without a catch-up burst.

`mise run format` and `mise run check` passed: 405 tests in 30 files, lint,
typechecks, official builds, and all package validations. The installed-kernel
check (`mise run verify-host n1rwj-rbn`) passed against Next 26.9.0 build 170.
This builds a local candidate; it does not install or publish it.

Host source and existing host test inspection confirm hidden-tab and hidden/paused
app suppression of repeat renders. The SDK has no device battery or lifecycle
API. See the [source evidence and exceptions](RBN-SVG-MIGRATION.md#why-the-refresh-model-works):
a selected panel can receive an initial render while the app is hidden, and
started renders/requests are not canceled when hidden. Native screen-lock and
background behavior were not runtime-tested, and the host's Flutter tests were
not run here. These RBN-only changes do not affect CWT and require no upstream
CWT synchronization.

## Compact RBN layout and README captures — 2026-09-21 (unreleased)

Installed the compact-layout local RBN **0.3.2** candidate through
**Features & Extensions → Install from file** in published **Ham2K Next 26.9.0
build 170**. The update dialog identified version 0.3.2 and the existing
`vailrerbn.com` network capability. This is not a published release artifact:
**261,712 bytes**, SHA-256
`a64f6ca88fbe83bdd3f5c452832cf8bc603354e41bcad06d4cf848fa0f3d8416`.

Native macOS checks and screenshots used the existing empty W8CAR/TEST
operation, temporarily observing WG1V with a 60-minute window and FN42FK origin:

- Desktop rendering showed the map beside the receiver table, a two-line
  status/filter summary, one footer, and no in-panel view or band dropdowns.
- The host tune dialog exposed **View** and **Band**. Saving **Map**, then
  **Receivers**, changed the narrow placement to a full-height reception map
  and paginated receiver cards respectively.
- Live Vail reports populated 14 receivers and FT4 rows. The details button
  retained its warning indicator for an unlocated receiver.
- Saved four native screenshots for the README: desktop, narrow map, narrow
  receiver list, and tune settings. See the [capture record](images/README.md)
  for dimensions and timestamps. No static previews substitute for these images.
- Restored the original overrides, report window, and view in both layout
  placements. The operation remained at zero QSOs; no contacts or spots were
  submitted. The updated RBN candidate remains installed.

`mise run check` passed **403 tests across 30 files**, lint, TypeScript checks,
official builds, and package validation. Deterministic tests cover tune-form
choices, configuration persistence, map space, safe bounds, scaled text, and
paginated details. Native coverage is macOS only; physical phone and Linux
checks remain outstanding. RBN-only changes require no CWT upstream sync.

## RBN control preferences — 2026-09-21 (unreleased)

Installed the local RBN candidate through **Features & Extensions → Install
from file** in published **Ham2K Next 26.9.0 build 170**. The native
**Check for Updates…** dialog reported that this was the newest available
version; no host update was available. The installed-extension list confirmed
RBN **0.3.2**, enabled. This is a working-tree candidate, not a published
0.3.2 release artifact: **262,210 bytes**, SHA-256
`cd6a7a9cf55c05b5b0f9a4a6b8be132ce2b2868a26746b872474ae469c117499`.

Native macOS checks used the existing empty `W8CAR/TEST` operation:

- Selected **Map** in the panel, opened its settings, changed **Default band**
  from **All bands** to **15m**, and saved. The panel retained **Map** and
  displayed **15m**, although the saved default view remained **Map and
  receivers**. This reproduces the reported settings-save sequence.
- With no recent W8CAR reports, the panel's band dropdown opened and offered
  **All bands** plus all eleven bands from **160m** through **6m**. Selecting
  **20m** directly changed the filter and retained Map.
- Temporarily watched public **WG1V** reports with a **60-minute** window and
  explicit **FN42FK** origin, the registered grid returned by Vail. The
  operation retained its `/TEST` identity. Selecting **40m** directly displayed
  **14 receivers**, one band, and an estimated **6,008 km** maximum distance.
  **Map + list** showed FT4 receiver rows; selecting **10m** removed receivers
  from both surfaces and displayed **No 10m reports in this time window**.
- Selected Map again, changed the saved default band to 40m, and saved. At
  **23:53:53 UTC**, the panel retained Map and displayed the populated 40m map.
- An automatic refresh advanced **Checked 23:53:53 → 23:55:00 UTC** while
  preserving Map and 40m, with the same 14 receivers.

Restored the test panel's original W8CAR / EN81OK overrides, 15-minute window,
All bands, and Map + list view. The updated RBN candidate remains installed.
The operation stayed at **zero QSOs** with a blank draft; no spots or contacts
were submitted. No host source changes were needed.

`mise run check` passed **402 tests across 30 files**, lint, TypeScript checks,
official builds, and package validation. `mise run verify-host n1rwj-rbn`
also passed against the running build 170 kernel. A separate static preview
made a successful live HTTP request for W8CAR; native interaction evidence
above comes from the installed app, not that preview.

This verification covers macOS; physical phone interaction remains untested.
Changes are confined to RBN, so no CWT upstream synchronization is required.

## Vail ReRBN HTTP migration — 2026-09-21 (unreleased)

The RBN panel now requests CW, RTTY, FT8, and FT4 reports through the
[Vail ReRBN HTTP API](https://vailrerbn.com/docs/endpoints). Each visible query
fetches one bounded snapshot per minute; exact callsign filtering, portable
suffixes, expiry, failed-refresh caching, response limits, and shared rate-limit
backoff are covered by deterministic tests. Receiver coordinates use Vail's
HamDB grids and are explicitly described as approximate lookup locations.
The `n1rwj-rbn` extension and `my-signal` panel identities are unchanged.

`mise run check` passed **392 tests across 30 files**, lint, TypeScript checks,
official builds, and package validation. This working-tree build retains the
**0.3.2** version label; it is not a published release artifact. The local RBN
archive is **262,131 bytes**, with SHA-256
`5fd4bc44f751f73692bb47749e7d8561e27de4e6e4cf2b3ccd04654420317800`.

At 23:25 UTC, the built ES2020 bundle ran through the installed **Ham2K Next
26.9.0 build 170** JavaScript kernel with a synthetic 1280×800 panel environment:

| Observed call | Visible mode | Scene reports | HTTP request | Complete render |
| --- | --- | --- | --- | --- |
| WG1V | FT4 | 14 receivers, 1 band | 200, 230 ms, 2,785 bytes | 384 ms |
| VE3KI | FT8 | 14 receivers, 2 bands, 19 receiver/band/mode rows | 200, 189 ms, 3,534 bytes | 342 ms |

Each render made one request to `/api/v1/spots` with `call`, Unix-second
`since`, and `limit=500`. Both stayed below the five-second host budget.
The memory-only `/TEST` operations used explicit origin grids returned by
Vail (FN42FK and EM77UR); these lookup grids do not verify transmitter
locations. No native operation, QSO, or spot was created.

Local evidence is `dist/rbn-vail-ft4.svg` and `dist/rbn-vail-ft8.svg`, with
matching scene and provenance JSON files. Kernel execution establishes bundle
compatibility and live HTTP parsing, not native UI rendering or interaction.
The changed package has not been installed in the native app for this check.
This change is confined to RBN and its preview tooling; CWT behavior is
unchanged, so no CWT upstream synchronization is required.

## Published 0.3.1 native screenshot refresh — 2026-09-21

Downloaded all four `.h2kext` bundles and their checksum files directly from
[the published v0.3.1 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.3.1).
All checksums matched. Installed these exact downloaded archives through
**Settings → Features & Extensions → Install from file** in published
**Ham2K Next 26.9.0 build 170**. The installed-extension list confirmed
**0.3.1** for CWT, MST, SST, and RBN.

| Published bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.3.1.h2kext` | `d71b9a66fdd8636238fe52654aa35caee23f1c691838b75453f513373ea03558` |
| `n1rwj-mst-0.3.1.h2kext` | `fdf67b8493a6213368d81eaf4a518b419a4f980a4deec6a4d119b6c181626f78` |
| `n1rwj-sst-0.3.1.h2kext` | `bcf57b0bdb0aadc4f317269a172ea555fcc806a177dd94778f92e7a3b84608d4` |
| `n1rwj-rbn-0.3.1.h2kext` | `2e237b6aded0574ccffd10fd7ba1c52caf62a8f7ee67b680c1ad2967d875cf42` |

Reopened each existing contest test operation and captured its session setup,
exchange controls, saved contacts, and score. Contacts and contest settings
were not changed. The refreshed images are listed in the
[screenshot record](images/README.md).

For RBN, the public POTA feed at 19:21 UTC listed **W8CAR** at **US-9496,
Resthaven State Wildlife Area**, locator **EN81OK**. An empty native
`W8CAR/TEST` operation with the **Testing** tag watched this public callsign
using explicit callsign and map-origin overrides. The desktop panel displayed
live reports, distinct land/water colors, boundary geometry, geographic and
receiver labels, the diamond station marker, and a receiver table. The capture
showed **27 receivers**, **one band**, and **7,977 km** maximum distance.
No QSOs or spots were created.

This establishes native installation and rendering of the published packages
and supersedes the earlier pending desktop visual check below. It is a focused
screenshot verification, not a repeat of every contest behavior or RBN control
test. After unlocking the Mac, compact map and receiver-card captures were
completed in a 449×768 window with the same published bundle and overrides.
The native view selector switched between **Map** and **List**; both captures
showed 30 receivers on one band and 7,977 km maximum distance. The desktop
window size was restored afterward. Physical phone, Linux, CPU, and battery
checks remain outstanding.

## Release 0.3.1 — 2026-09-21

[v0.3.1 is published on GitHub](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.3.1)
from signed commit
[`c1327670`](https://github.com/rwjblue/ham2k-n1rwj-extensions/commit/c132767012a4a9f0b94e392ace32f772fe60c59e).
[Main CI passed](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35636851999)
and the [release upload job succeeded](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35636926897/job/106456515162).
All four bundles and four checksum files are available. A local
`mise run release:catalog v0.3.1 --dry-run` downloaded and validated all eight
assets without submitting anything. The published RBN archive is **261,909
bytes**, with SHA-256
`2e237b6aded0574ccffd10fd7ba1c52caf62a8f7ee67b680c1ad2967d875cf42`.

The [catalog job failed](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35636926897/job/106456635007)
at `2026-09-21T18:13:17.854Z`: its first `n1rwj-cwt` upload received HTTP
**403** and a Cloudflare challenge. No submission was accepted, and subsequent
extensions were not attempted. GitHub downloads work; catalog acceptance is
not established. See [publishing and recovery](PUBLISHING.md) before retrying.

The 0.3.1 RBN map adds bundled state/province boundaries at regional scales,
sparse country labels, distinct land/water colors in both themes, a diamond
station marker, and quieter reception paths and distance rings. Receiver labels
take priority over geographic captions. Collision checks reserve the attribution
footer and empty-report message, and label density changes gradually with size.

`mise run check` passed **385 tests across 30 files**, lint, TypeScript checks,
official builds and package validation. New checks cover crowded North American
and European layouts, compact sizes, enlarged text, resizing near 420 pixels,
theme contrast, and 500-receiver SVG layer budgets through 4096×4096. This work
affects RBN and its geography-generation tooling; it does not change CWT behavior.

The public POTA feed at 17:48 UTC listed **N5ILQ**, **US-10658, Lake Carl
Blackwell Wildlife Management Area**, grid **EM16JC**. Static previews at
18:01–18:02 UTC observed that public call with a memory-only `N5ILQ/TEST`
operation and a 30-minute window. They showed 26 receivers on one band, with
a maximum reported distance of 3,076 km. No native operation, QSO or spot was
created. The built ES2020 bundle ran through the installed published Next 170
kernel; it was not installed in the native app for this check.

Local evidence is `dist/rbn-map-improved-desktop.jpg` (1280×800 panel),
`dist/rbn-map-improved-compact.jpg` and `dist/rbn-map-improved-dark.jpg`
(424×644 panels). Each screenshot includes an additional static-preview footer.
Matching SVG, scene JSON and provenance JSON files are beside the screenshots.
These ignored files are local evidence, not repository assets. The desktop scene
used 120 layers and 115,991 bytes of formatted JSON; compact scenes used 28 layers
and 82,212 bytes. These static checks do not establish native rendering, control,
CPU or battery behavior. Native visual acceptance remains outstanding because
computer use reported that the Mac was locked and could not unlock it.

The preview-stage archive carried version **0.3.0**, but was **not the
published 0.3.0 artifact**. It was 261,912 bytes with SHA-256
`074c3c8385b880eacd0a29919a8ec7d935ee6c5df92453562a909a9d1f3e332b`.
Release preparation subsequently synchronized every workspace to **0.3.1**.
The release checks above passed after that version change; the preview evidence
predates it. Native visual acceptance of the refinement remains pending.

## Release 0.3.0 — 2026-09-21

[v0.3.0 is published on GitHub](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.3.0)
from signed commit
[`5c039254`](https://github.com/rwjblue/ham2k-n1rwj-extensions/commit/5c039254e0d427caebd328a6375b539d5d197110).
All four extension bundles and their four SHA-256 files were uploaded, and
the downloaded release assets matched their checksums.

- [Main CI passed](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35631933388):
  **372 tests across 28 files**, lint, TypeScript checks, official builds and
  package validation.
- The local release dry run passed the same checks plus synchronized-version
  and asset/checksum validation. The
  [release upload job succeeded](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35631976696/job/106440097548).
- The published RBN archive is **124,085 bytes**, with SHA-256
  `4df0bd93f911c8e76b1d49fe02f39dc0a982807fa5296b233c006a2ea4995a04`.
- Native RBN acceptance used published **Ham2K Next 26.9.0 build 170** and
  the candidate archive labeled **0.2.0** identified below. Version
  synchronization subsequently produced the released 0.3.0 archives; those archives were not
  separately reinstalled for native acceptance. The screenshots below record
  the tested 0.2.0 package. Physical phone and Linux testing remain outstanding.

The [catalog job failed](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35631976696/job/106440223935)
on the first `n1rwj-cwt` upload: HTTP **403**, a Cloudflare challenge, at
`2026-09-21T17:26:41.297Z` (Ray ID `a3eac6bb4a526b25`). No upload was accepted
by that run and later extensions were not attempted. The earlier v0.2.1
attempt encountered the same failure. GitHub downloads are available, but
these attempts do not establish catalog submission, review, or channel
acceptance. See [publishing and recovery](PUBLISHING.md) before retrying.

## RBN SVG migration — 2026-09-21

The current RBN implementation returns native `svgScene` content. The HTML
renderer and its shared hidden basemap machinery have been removed. The
extension preserves its `n1rwj-rbn` / `my-signal` identities and saved config.
It builds one selected-band map, native text, native dropdowns, and a paginated
receiver table/cards. Per-placement choices survive ticks and reset when
operation/config changes; saved defaults survive runtime restarts.

The updated [published panel contract](https://catalog.ham2k.net/docs/hooks)
and SDK 0.5.0 support this design. The host source inspected for this work was
`cad0bc2cc78ba5f2a8a7e8f34423fa48bfc8a071`; SVG scenes first landed in
`e4c149e9cf6083b0369c67b39f4988b263508443` on September 19. Existing contest
and award program UI used native Markdown/forms/scoring rows. The
Radio, Solar and Weather dashboard examples use `svgScene`, which is the
relevant comparison for this map. The scene API is still experimental.

The native checks used the unmodified published **Next 26.9.0 build
170**, installed by the user. Its binary includes `SvgSceneView`, scene
validation, placement identity, render environment and event handling. The
extension renders live RBN data and native controls in that app. Its kernel
SHA-256 is
`b001f0c0ede236f2dfb5a24788aaaebd49709bb193ff487b90337b115790f743`.

The earlier **build 169** updater initially reported that it was up to date.
That native binary contains HTML renderer names but no scene renderer symbols.
The migrated package visibly showed **RBN · App update needed** in an empty
`K8BTU/TEST` operation, verifying the missing-environment/placement compatibility
path before any RBN request. Evidence is `dist/rbn-svg-next169-compatibility.png`.
That temporary placement was removed and the original QSOs / Info / Spots / Map
layout restored. Build 170 was subsequently installed for the checks below.
A successful kernel run alone does not certify native scene support; static
previews deliberately supply an environment and placement identity.

The prior host experiment was preserved locally as commit **ef546297**
on **codex/tmp-html-panel-refresh**. Primary `halo` was restored to `main` at
`cad0bc2c`, matching `origin/main`, with its pre-existing untracked `mise.lock`
left alone. The old experimental worktree was detached at the same main commit
and clean. No host push or PR was made; the Dev app was stopped. Subsequent
native checks used the published Next application only.

The static preview task executes the actual built ES2020 extension using the
installed Next kernel, then exports a scene JSON plus an SVG approximation.
The SVG explicitly says it is a static preview with inactive controls. It
cannot verify Flutter text measurement, native menus, touch, or semantics.
Before native build 170 testing, at 16:33 UTC, live public POTA spots listed
W9MET at US-6298, Crooked Lake Wildlife Area, EL97er. A memory-only
`W9MET/TEST` observation returned 22 receivers in 735 ms, including RBN's
schema-version retry.
The preview candidate at 16:37 UTC showed 24 receivers. The 1366×900
scene rendered in 442 ms (118 layers, 72,022 bytes of formatted scene JSON),
the 390×844 map in 301 ms, and the dark 390×844 list in 337 ms. These are
Node/kernel timings including live network access, not native frame or CPU
measurements. Static browser screenshots are `dist/rbn-svg-desktop.png`,
`dist/rbn-svg-phone-map.png`, and `dist/rbn-svg-phone-list.png`; each carries
a visible static-preview label. Their scene JSON and provenance are beside them.
Paths under `dist/` in this record identify ignored local evidence, not files
shipped in the repository. The published Next 170 screenshots linked below
are stored in `docs/images/` and can be viewed from a fresh checkout.

`mise run check` passed **372 tests across 28 files**, Biome, all TypeScript
checks, official builds, and official package validation. The installed-kernel
verification passed registration and shared-dependency checks against build 170.
The historical **0.2.0**, **124,081-byte** native-test archive installed in that
app has SHA-256
`0a4531f93d82ae3991fa4097101dbb944b60b5375f2652c07626b92c02d7e106`.
The earlier build-169 compatibility candidate was 124,067 bytes with SHA-256
`ab26cd7ac49d738b7f0e2c6a2ae0fba2a2626e8ba3edcf9676ccb084d23a6bc0`;
its 370-test result predates the final layout regressions.

Release preparation subsequently synchronized all workspace versions to
**0.3.0**. The release results are recorded above; the native evidence below
is for the 0.2.0 archive identified here.

### Published Next 170 native acceptance

The public POTA feed at 17:05 UTC listed W9MET at **US-6298, Crooked Lake
Wildlife Area, EL97ER**. A clearly labeled `W9MET/TEST` operation watched
that public callsign through the explicit panel override. The operation
remained empty with **zero QSOs**; no spots, POTA posts or transmissions
were made. Native checks established:

- Live reception map and receiver table rendered in a **1437×768** desktop
  window. The final native-test package showed 26 receivers on two bands,
  including descending SNR readings of 26, 26, 25, 19 and 18 dB after 17:13 UTC.
- The native **SNR** sort menu and direction button worked. Earlier live
  readings sorted as 25, 24, 24, 21 and 21 dB descending, then 2, 3, 4, 4
  and 4 dB ascending. Next page showed reports **6–10 of 23**.
- The **30m** filter updated both the map and list to three receivers.
- An automatic refresh advanced **Checked 17:09:30 → 17:10:30 UTC** while
  preserving ascending SNR and page 2. This exercises the scene event and
  tick paths in the published app, without any HTML host patch.
- Native compact testing used a **448×770** macOS window. Map/List switching,
  SNR sorting and paging worked; the list displayed **3–4 of 28** on its
  next page. Report details wrapped into readable text and showed **1/2**
  pages rather than clipping the longer explanation.
- Native testing found that an approximately 477-pixel-wide combined pane
  could allocate a map while leaving no report row. The final change reserves
  enough height for a complete receiver card, controls, gaps, and pagination.
  When both views cannot fit, it shows receiver cards with a **Map**
  hint. The final package was retested in the native narrow pane and displayed
  two cards instead of empty list space.

The following are **screenshots of published Next 170**, separate from the
static preview artifacts and earlier custom Dev screenshots:

- [Desktop map and table](images/rbn/rbn-next170-desktop.jpg) — 1437×768.
- [Compact native map](images/rbn/rbn-next170-phone-map.jpg) — 448×770.
- [Compact native receiver cards](images/rbn/rbn-next170-phone-list.jpg) — 448×770.

The compact screenshots exercise the phone-oriented layout inside the macOS
app; they do not represent physical phone hardware. Both temporary global
layout changes were then removed and saved. The compact layout was restored
to QSOs / Spots / Map and the desktop layout to QSOs / Info / Spots / Map.
The original desktop divider at 957 and window dimensions of 1437×768 were
restored. The TEST operation was left with zero QSOs and a blank draft.

The design avoids a WebView, contains no animation, and generates only the
visible map and list page. This removes the HTML/Linux WebView dependency;
it is not a measured claim about native CPU or battery savings. Tests bound
scene layers, per-layer strings, total artwork, native controls and menu
sizes, including 500 receivers and phone dimensions. Physical phone and
Linux runtime testing remain outstanding. RBN/tooling changes are exempt
from CWT upstream synchronization; no CWT behavior changed.

See [migration and maintainer notes](RBN-SVG-MIGRATION.md) for reproduction,
implementation choices, and additional device acceptance steps.

## Earlier RBN HTML prototype — 2026-09-21

The independent `n1rwj-rbn` panel includes bundled Natural Earth vector
geography, station-centered reception paths, band filters, and sortable
receiver reports. The list becomes cards at phone widths. There are no
map-tile requests. Changes to packaging only add optional per-extension
assets and preserve the existing root notices. These are RBN and general
monorepo tooling changes, exempt from the CWT upstream synchronization rule;
no CWT behavior changed.

- `mise run check` passed **359 deterministic tests across 28 files**, lint,
  TypeScript checks, official builds, and official `.h2kext` validation,
  including the snapshot-age stability change.
- `mise run verify-host n1rwj-rbn`: the bundle registers its panel and
  satisfies shared-library constraints in the installed Ham2K Next
  26.9.0 build 169 JavaScript kernel.
- `mise run rbn:preview --call K8BTU --grid EM99DQ --minutes 60`:
  at 14:27:53 UTC, the actual bundle returned 34 receiver rows in 732 ms
  using that installed kernel under Node VM. Metadata, the HTTP 400
  version handshake, and the successful retry were exercised live.
  POTA's public activator feed listed K8BTU at US-5641, Jesse Owens
  State Park, EM99dq. The preview operation is `K8BTU/TEST`, titled
  `RBN TEST — observing K8BTU`; the panel header also says TEST observation.
- The final live preview at 14:48:08 UTC observed KG2GL at POTA US-0751,
  Paterson Great Falls National Historical Park, FN20vw. It returned 26
  receiver rows in 560 ms. This uses the final bundle, whose `.h2kext`
  SHA-256 is `b8975894b6df23df3e67be7a034b99f4d3a0f7302c554d70fe6e2727617d02d7`.
- Browser testing of actual extension live-data HTML output at 1366×900,
  390×844, and 320×740:
  inspected map/list layout, confirmed no horizontal overflow, changed
  band and view controls, and verified both SNR sort directions using
  the visual row positions. Screenshot artifacts are
  `dist/rbn-desktop.png`, `dist/rbn-phone-map.png`, and
  `dist/rbn-phone-list.png`. These are browser screenshots of a frozen
  live-data snapshot, not screenshots from the native Ham2K app.
- A synthetic actual-bundle benchmark with 500 globally distributed
  receivers across 11 CW bands rendered in 244–270 ms, with two shared
  basemap definitions and about 1.56 MB of HTML. Compared with rendering
  separate geography for every band, this cut render time from 1.7–2.3
  seconds and HTML size from about 4.95 MB. This was measured on this Mac,
  not on physical phone hardware.

After the Mac was unlocked, `n1rwj-rbn` installed successfully through the
native Ham2K Next 26.9.0 build 169 installer. A separate operation was
created with the clearly labeled station callsign `K8BTU/TEST`, watching
K8BTU's public reports from EM99DQ. No contacts were logged, and no spotting
or POTA posting occurred. The native panel remained blank; the diagnostic
screenshot `dist/rbn-native-initial-load-blocked.png` records that failure,
not a successful native rendering.

The initial investigation attributed the blank panel to the host cancelling
the initial `about:blank` navigation. The source supports that mechanism, but
an independent minimal native reproduction and callback trace are still
needed to establish it in the installed Next binary. A separate source-level
defect passes HTML only as `initialData`, without updating the mounted native
document when an extension returns changed content. The exploratory host
patch is isolated in `~/src/github/ham2k/halo-html-panel-refresh`, with a
local artifact at `dist/ham2k-html-panel-refresh.patch`; it includes additional
state-preservation behavior and is not a ready-to-merge recommendation.

The final host patch passed 17 focused widget/state tests and scoped Dart
analysis. An earlier revision also passed all 3,568 app tests selected by
the host's changed-test gate; this is not its full merge gate. A native
WKWebView harness exercised the actual state-preservation scripts in an
isolated content world, with both production JavaScript permission flags
set to false. Sort and scroll survived replacement, explicit changed defaults
took precedence, and an embedded extension script remained unexecuted.
Native app testing then exposed the plugin's unterminated print-function
prelude: prepending an IIFE accidentally invoked print. Both fixed host
scripts now start with a semicolon, with an executable regression covering
that exact prelude shape for capture and restore.
The separate Dev build combines the patched public Dart host sources with
the installed Next JavaScript kernel, so it is a local hybrid test build,
not the published Next application.

The Dev app's generated shared-library metadata also matches that exact
Next kernel. The app artifact sets `HALO_DEV_DATA` through `LSEnvironment`;
the host ignores a Dart define for this particular flag. Its open database
was verified under `/private/tmp/ham2k-rbn-test-data/`, with sync disabled.
An initial launch without that environment created a separate normal Dev
container and imported existing cloud logs. No contacts or layouts were
edited there; Next's operator, database, and preferences stayed unchanged.
The isolated test operation is `KG2GL/TEST`, titled
`RBN TEST - observing KG2GL`, with zero contacts.

Native verification in that final hybrid Dev app confirmed initial map/list
rendering and subsequent live-data updates. **Map + list**, **Map**, and
**List** controls worked; SNR sorting was verified in both directions,
including descending rows of 31, 27, 26, and 25 dB. The app was checked at
a 1327×768 desktop window and a 446×834 compact window, the minimum width
available for this macOS app. The compact layout shows the receiver cards
and phone map treatment. Browser checks at 390×844 and 320×740 provide
additional coverage below the native Mac minimum; no physical phone was
used.

Native screenshots are `dist/rbn-native-desktop.png`,
`dist/rbn-native-phone-map.png`, and `dist/rbn-native-phone-list.png`.
They show `KG2GL/TEST` and the panel's **TEST observation** label. The
desktop capture shows Map + list with descending SNR, data checked at
15:18:00 UTC, 23 receivers, one band, and a farthest receiver of 5,522 km.
These captures are separate from the browser snapshot images listed above.
No contacts were logged and no spots or POTA reports were posted during
the Dev verification. The original published Next test remained blank;
the successful checks apply to the local patched hybrid Dev app, not an
exact-source control for the published Next binary.

Native refresh persistence was then verified with **List** and descending
**SNR** selected. After scrolling to W5ZN, KD7EFG, TI7W, and AA4PA, an
automatic update advanced report ages from 8 to 9 minutes and from less
than 1 to 1 minute while preserving the exact scroll position. Returning
to the top showed **Data checked 15:17:00 UTC**, advanced from 15:15:51,
with List and the descending SNR selection still active and leading rows
of 30 and 29 dB. No print alerts appeared. This establishes view/sort/scroll
retention in the complete native app; the separate harness additionally
covers changed defaults and removed-option fallback.

### Follow-up HTML investigation

Current source references were fetched and inspected without changing either
host checkout: host `cad0bc2cc78ba5f2a8a7e8f34423fa48bfc8a071` and standalone
extensions `ad875f3b02af417624546a9fdaab52ea01ccc5cd`. The earlier Dev build
used September 1 host sources; the HTML implementation remains unchanged in
the September 21 source. Current contests/programs render through native
scoring rows, Markdown, and forms. Current Radio/Solar/Weather dashboards
return `svgScene`; their refresh behavior does not exercise the HTML WebView.
The official `k2hrc-radio` sample does return HTML but is not bundled in Next.

The source audit traced the missing HTML update path through the host,
vendored plugin, and Flutter platform-view lifecycle. First-load navigation
cancellation remains a separate, narrower hypothesis for the blank screen.
The previous patch's sort/scroll retention is an enhancement, not an existing
HTML contract requirement. Its initial-load error handling and navigation
allowance also need further review before adoption.

A network-free counter extension (HTML fragment, full HTML document, and
Markdown control) and the unchanged official HTML sample were built and
packed. Both registered and returned changing content through the exact
installed Next JavaScript kernel. Minimal native checks could not yet run
because computer use reported the Mac locked. The local, ignored report and
reproduction package are in `dist/html-panel-investigation/`; the report
explicitly distinguishes source evidence, prior Dev observations, and
pending native checks. No host commits, pushes, PRs, or external reports
were made during that investigation. The later user-authorized local backup
commit is recorded in the SVG migration section above.

That investigation also reproduced an independent RBN bug: the host can omit
`args.operation` on Home/Logs, but RBN dereferences it. Rendering with an absent
operation fails both with and without explicit watch/grid overrides; an empty
operation object or a TEST operation produces visible HTML. The exact-kernel
reproduction is recorded locally. This is an extension issue requiring a
defensive empty-context path; it does not explain the original operation-view
blank. Production extension source was not changed during the investigation.
The SVG migration subsequently fixed the absent-operation bug and added a regression test.

## Monorepo release 0.2.0

Verified September 20–21, 2026, using Power Logger 26.9.0 build 169 at
`/Applications/Ham2K Mac Logger (Next).app`. This is a permanent repository;
only the personal CWT extension retains the upstream transition arrangement.

`mise run check` passed lint, strict TypeScript checks (including executable
tasks), **264 tests across 19 files**, all three builds, and official packaging
validation. Tests cover shared N1MM parsing/downloads, bounded contest history,
CWT regressions, MST/SST schedules, exchanges, scoring and exports, generated
bundles, extension scaffolding, and release version/asset validation.
[Main CI passed](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/35555147399)
for the monorepo implementation. The installed-kernel check registered all
22 hooks across CWT, MST, and SST and accepted their declared shared libraries.
It uses the kernel identified below under Node and is separate from native UI
testing.

All three `0.2.0` bundles were installed in the native app. CWT updated from
`0.1.2` while retaining its settings, cached data, and existing operation.
The following native checks used dedicated operations with station
`N1RWJ/TEST` and the native **Testing** label; they were synthetic contacts,
not on-air QSOs:

- **CWT:** reopening the existing three-contact test operation retained its
  `3 × 3` score. A fresh `K0ACP` draft suggested `ARTHUR / 3806`, with both
  fields identified as current-operation history, despite the conflicting
  file name and a separate MST contact for the same callsign. The draft was
  wiped without saving.
- **MST:** automatic N1MM discovery downloaded 7,772 calls, file date
  `2026-09-14`, with six nonfatal parser warnings. The selected session was
  `2026-09-21 1300z`, with sent name `ROB` and LP power. Saving `K0ACP` at
  `13:05z` on 20m CW retained sent serial `1` and received exchange
  `42 ARTHUR`; the operation displayed `1 × 1`. After reopening it with the
  final build, a fresh `K0AD` draft showed sent serial `2`, an empty received
  serial, and the suggested name `AL`. That draft was wiped.
- **SST:** automatic discovery downloaded 15,643 calls, file date
  `2026-09-15`, with one nonfatal warning. The selected session was
  `2026-09-25 2000z`, with sent exchange `ROB RI` and LP power. Saving
  `K1USN / WATSON / MA` at `20:05z` on 20m CW retained those values and
  displayed `1 × 1`.
- **SST corrections and clearing:** after deliberately clearing the location,
  changing `K1USN` to `K1USN/P` left that field blank. Changing the name to
  `WATT` and then the call to `K1USN/M` retained the correction and blank
  location. After wiping, a fresh `K1USN` draft again suggested `WATSON / MA`.
  Replacing the call with `ZZ0ZZZ` without editing the exchange cleared the
  name and suggested `DX` after lookup completed. All these drafts were
  wiped. This exercises the native touched-control and clearing contracts,
  not a controlled delayed-network race.
- The final MST/SST builds replace custom internal alert keys with readable
  labels. A fresh SST draft visibly displayed **Outside selected session**;
  built-in alerts continue to use the host's localization.
- **Exports:** native ADIF and Cabrillo exports were written locally and
  inspected. MST ADIF used `ICWC-MST`, `STX=1`, `SRX=42`, and complete
  exchanges `1 ROB` / `42 ARTHUR`; its Cabrillo QSO used `ROB 1` /
  `ARTHUR 42`. SST ADIF used `K1USN-SST` and `ROB RI` / `WATSON MA`;
  Cabrillo used `CONTEST: K1USNSST` and the same name/location exchanges.
  Both Cabrillo files used `CATEGORY-POWER: LOW` and omitted RST fields.
  No contest submission was uploaded. Test exports stay in ignored `dist/`.

The native checks establish installation/update, live data discovery, saved
exchange controls, representative scores, serial progression, input protection,
and native exports. Cross-band multiplier rules, session boundaries, history
edits/deletions, and failed-refresh recovery are covered by deterministic tests;
they were not all repeated in native MST/SST operations. OS-offline use and a
controlled slow-lookup race remain unverified in the native app. Earlier CWT
failed-refresh/restart observations below remain historical evidence.

Upstream-relevant N1MM metadata fixes were also pushed to the source branch of
[Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1), with its
115 tests, typecheck, build, and official packaging checks passing. Monorepo
organization, personal release tooling, and the new MST/SST extensions do not
change upstream CWT behavior and do not need matching changes in that PR.

## Personal backport 0.1.2

The backport from [Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1)
passed `mise run check`: **190 tests across 13 files**, Biome, TypeScript,
build, and official packaging validation. Its focused history regression
failed against the previous code and passes with the fix. It verifies both
full and resumed scoring during a pending initial log read, including waiting
for refreshed membership before requesting targeted callsign history.
Additional coverage checks English/Spanish settings and provenance, preserves
the personal cache identity, and leaves unrelated input suggestions intact.

`mise run verify-host` also accepted 0.1.2 against the installed Power Logger
26.9.0 build 169 kernel, registering all eight hooks. This runs the installed
JavaScript kernel under Node; **0.1.2 has not been tested in the native UI**.
The native observations below describe 0.1.0 and 0.1.1.

## Earlier verification

Verified September 19, 2026. `mise run check` runs Biome, TypeScript,
deterministic Vitest tests, the published builder, and official `h2kext-pack`
validation. Local `0.1.1` validation passed **182 tests across 11 files**,
lint, typechecking, build/pack validation, and the installed-kernel check.
Tests cover parsing/corruption, precedence/suffixes, offline replay,
failed replacements, history edits/deletes, native suggestion contracts,
saved exchanges, scoring, and ADIF/Cabrillo. Bundle tests evaluate the generated
IIFE with pinned shared libraries and a simulated bridge, not Flutter/native UI.
CI passed for commit `3913d235` in
[run 35452432500](https://github.com/rwjblue/ham2k-cwops-cwt-ext/actions/runs/35452432500).

The live default-source path was exercised separately: category discovery,
entry GET, dynamic form POST, and parsing succeeded with 7,155 calls. Its
SHA-256 matches the observed file in [CALL-HISTORY.md](CALL-HISTORY.md). Tests
do not depend on this live service.

## Installed app

Earlier native verification used `/Applications/Ham2K Mac Logger (Next).app`,
whose identity at that time was **Power Logger 26.9.0, build 169**. The
installed-kernel compatibility check accepts its shared dependencies and
registers all eight extension hooks after the manifest's LiquidJS requirement
was corrected to `^10.28.0`. The verifier selects the running app, or the
latest installed build when none is running; an explicit `.app` path can
select another installation.

Installed kernel SHA-256:
`98dc8c6577786465c7811f4a87796c9d399aad97f3e0ce64efa235aaf22c4255`.

Verified `n1rwj-cwt-0.1.1.h2kext` SHA-256:
`b54b19ba1ccb8eddca31d9b3ac405b8ec9e0aa1ad8b518755c3382b298e7e9be`.

The following were confirmed in the native UI:

- The built-in **CWops CWT** extension is off and custom **N1RWJ CWT 0.1.1**
  is on. The initial logging/export/cache checks below used `0.1.0`; the
  `0.1.1` update adds history operation-identity and source-URL validation
  fixes, and its current-operation precedence was checked separately below.
- Initial **CWT Prefill** settings reported 7,155 downloaded calls, file date
  `2026-09-17`, download time `2026-09-19T15:33:12.600Z`, and one nonfatal
  parser warning. The resolved source was
  [CWOPS_3992-AAA.txt](https://n1mmwp.hamdocs.com/mmfile/get/file/CWOPS_3992-AAA.txt).
- A dedicated operation, **CWT extension validation (TEST)**, used station
  `N1RWJ/TEST` and the native **Testing** label. Its CWT session was
  `2026-09-23 1300z`, with sent exchange `ROB CWA` and LP power.
- Entering `K0ACP` prefilled `ART` / `3806`, `AA0AI` prefilled `STEVE` / `IA`,
  and `AA4NO` prefilled `BILL` / `CWA`. All three contacts were saved and their
  exchange values were confirmed in the native log rows. The visible CWT
  score was `3 × 3 = 9`.
- Entering `N4DL` prefilled `GARY` and left **Nr** blank, even though the host
  separately knew the station's `FL` state. This unknown-number contact was
  not saved.
- A fresh `K0AD` draft prefilled `AL` / `138`. After **Nr** was intentionally
  cleared with the keyboard and the call changed to `K0AD/P`, the completed
  lookup left **Nr** blank. The name was then edited to `ALAN` and the call
  changed to `K0AD/M`; after lookup, `ALAN` and the blank **Nr** remained,
  although the provenance note still offered the source exchange `Al 138`.
  This verified native protection of operator edits and clearing during
  those callsign transitions. It did not impose a controlled slow-network
  race. The draft was wiped without saving.
- The native export UI wrote three local files into `dist/`. The CWT ADIF
  and Cabrillo outputs were read and checked. ADIF contained
  `CONTEST_ID=CWOPS-CWT`, sent exchange `ROB CWA`, and received exchanges
  `ART 3806`, `STEVE IA`, and `BILL CWA`. Cabrillo contained all three QSO
  lines with those sent/received exchanges and `CATEGORY-POWER: LOW`.
  The checked files were
  `2026-09-19 N1RWJ-TEST for CWT-2026-09-23-1300 Testing.adi` and
  `2026-09-19 N1RWJ-TEST for CWT-2026-09-23-1300 Testing.log`.
  No external upload was performed.
- An unsupported local path, `/tmp/cwt-validation-missing-source.txt`, was
  used to trigger a failed native refresh. After quitting and relaunching the
  app, **CWT Prefill** still reported 7,155 records and the original download
  timestamp, `2026-09-19T15:33:12.600Z`. This confirms dataset retention
  across that failed refresh and restart. In the test operation after restart,
  a fresh unsaved `K0AD` draft prefilled `AL` / `138`, identified as
  `selected-file` data. The operating system was not taken offline.
- After that cached `K0AD` prefill, the callsign was cleared and replaced with
  `N4DL` without touching either exchange field. After lookup, the name became
  `GARY` and **Nr** was blank while the separate state remained `FL`. The old
  `138` was removed; accessibility inspection showed the clearing space.
- With `0.1.1` installed, the existing test operation was reopened. Its saved
  `K0ACP` contact had been corrected to `ARTHUR 3806`. A fresh `K0ACP` draft
  prefilled `ARTHUR` / `3806`, with both fields attributed to
  `current-operation`, while the source file still supplied `ART`. The saved
  row remained `ARTHUR 3806`. This confirms current-operation history taking
  precedence over a conflicting file name. The earlier `0.1.0` exports
  recorded `ART 3806` before that correction.
- The source setting was restored to blank automatic discovery before the
  `0.1.1` update. Refreshing the default category in `0.1.1` then succeeded:
  settings showed 7,155 calls, file date `2026-09-17`, download time
  `2026-09-19T15:54:42.936Z`, the same CWOPS_3992 source, and one nonfatal
  parser warning. This confirms normal discovery and refresh were restored
  after the deliberate failed-source test.

These observations establish native installation, source refresh, member,
nonmember, CWA, and unknown-number suggestions, saved exchange display,
representative scoring, native ADIF/Cabrillo exports, and cached suggestions
after a failed refresh and restart. They also verify current-operation history
precedence in `0.1.1`. OS-offline operation has not been verified.

SDK 0.5.0/types are the API reference. Native behavior for these earlier CWT
checks was inspected in a local checkout of the private Ham2K host repository
at commit `c726266a4ae72117396ce48255611374136fd374`, which predates some archive
behavior. SDK declarations alone do not certify a native host build as
compatible.

## Decisions and remaining limits

- Native touched-control tracking protects corrections and deliberate blanks.
  The callsign-transition checks above confirmed this in the native UI.
  Existing `qso.refs` values are not assumed to be operator input: they can be
  earlier guesses. The inspected host ignores empty suggestions. An ASCII
  space clears an **untouched** old suggestion and is trimmed out on save.
  The `K0AD` → `N4DL` transition above confirmed this ASCII-space convention
  for an **untouched** number suggestion in the native UI.
- Log one callsign at a time. The inspected host shares exchange refs across
  comma-separated call-list batches; each call would receive the same exchange.
  The extension cannot distinguish shared typed data from a previous prefill
  at that point, so batch entry is not supported for CWT exchanges.
- Older `getHistoryForCall` implementations return at most five recent
  QSOs per exact/base call, so unrelated contacts can crowd out older CWT evidence.
  With SDK 0.5.7, the adapter requests the contest's `refType` before the host's
  default five-contact cap. Supporting hosts return matching contest history;
  older hosts ignore options, so local contest checks remain necessary.
  Unlimited cross-operation history is unavailable through this API. History
  rows lack operation IDs, so scoring snapshots or a cached initial log read
  establish current-operation ownership. Fresh data prevents reuse of stale
  corrections and deleted contacts. Whole-log reads are shared/cached, not
  performed on every keystroke; the QSO being edited is excluded. When a
  matching current-operation contact is omitted by the targeted history cap,
  a full-log revalidation is shared/cached per call, returned-history signature,
  and scoring generation. This preserves older fields in the current operation
  without repeatedly reading its log. Native inspection found that lookup and
  control payloads omit the operation UUID while scoring payloads include it;
  `0.1.1` recovers that identity when exactly one indexed scoring operation
  matches the creation timestamp and station callsign. Missing or ambiguous
  identity does not promote contacts to the current-operation tier. This
  recovery and precedence were verified in the native `K0ACP` check above;
  older cross-operation precedence is covered by tests, not a separate native
  acceptance exercise.
- Native Data Files writes successful snapshots to disk and replays them on
  restart. `host.kvSet` is **in-memory only**, a runtime backup here. Parsing
  failures occur before the disk cache is written. Physical corruption or
  deletion of that cache requires another download. No large
  dataset is copied into global settings.
- Refresh rejects HTML, unsupported directives, invalid records/exchanges,
  empty data, and files over 5 MB. Extra nonessential columns can warn without
  rejecting the live file. A syntactically valid incomplete file cannot always
  be distinguished from an intentionally smaller file.
- Discovery selects the first CWOPS entry in N1MM's latest-first category.
  Changed markup/forms or an entry outside the listed page fail visibly and
  retain previous data; select an explicit HTTPS entry or direct text URL.
  Local import is unsupported: the inspected native loader fetches HTTP
  resources, and SDK 0.5.0 provides no local import capability here. File/download
  dates cannot guarantee that an operator's exchange remains unchanged. A new
  source takes effect after a successful refresh; the previous cached dataset
  remains active until then.
- Upstream scoring/scheduling behavior is retained, including no special
  cancellation dates or independent selected-hour filter. See
  [PROVENANCE.md](PROVENANCE.md).

Older cross-operation precedence, a controlled delayed-lookup race, and a
session with the operating system offline were not separately exercised in
the native UI. Deterministic tests cover these contracts; the native
failed-refresh/restart and cached-lookup checks above provide additional
evidence for cache recovery.

## 2026-09-23: RBN spots and contest filter collaboration

The new native RBN source uses `spotCallFilter:v1` providers from CWT, MST,
and SST. Deterministic tests load all four built IIFEs with separate SDK
copies and simulate the documented kernel dispatch. They verify default CWT
selection, no-file behavior, portable matching, explicit selection across
restarts, provider removal, all-calls opt-out, and MST/SST membership without
exchanging contest fields. Receiver filtering precedes deduplication; mode,
WARC bands, cached-directory precedence, invalid preferences, expiration,
request coalescing, bounded paging, and shared rate-limit backoff are covered.

An isolated checkout of these commits passes `mise run check`: 438 tests,
format/lint, both TypeScript checks, four official builds and package validation.
Isolation keeps simultaneous release-tooling edits out of this result.
Upstream CWT passes 116 tests and repository typechecks; all 95 upstream
extensions build, pack, and load successfully.

The installed Ham2K Next 26.9.0 build 170 JavaScript kernel also accepts all
four bundles and their hook registrations (`mise run verify-host`).

### Native macOS acceptance

On September 23, 2026, at approximately 15:56–16:05 UTC, installed all four
local candidates in **Ham2K Next 26.9.0 build 170** and exercised the existing
empty **W8CAR/TEST** operation. The candidates contain the changes through
`2d69a2f1` and still declare 0.3.4; they are not the published v0.3.4 assets.

| Candidate bundle | SHA-256 |
| --- | --- |
| `n1rwj-cwt-0.3.4.h2kext` | `c5b2525ab327ef2723fc0fae83be7b6ac2aa29c5a1d45d38f921cb8e006c3de8` |
| `n1rwj-mst-0.3.4.h2kext` | `7a93701108e32053f3449fcb7e31bbd4867f70abcd6c1163dcbfd2018ca39307` |
| `n1rwj-rbn-0.3.4.h2kext` | `9813be1ca915a949244be51f8bc6502f68f2f608bcd87eab6183b457811ba09e` |
| `n1rwj-sst-0.3.4.h2kext` | `17143da933e4b75a0cf4659b68726244ee765288b8420042fc44bc703c7dd978` |

- **RBN** settings defaulted to **CWT call-history file**, with **CW** mode
  and blank skimmer/grid restrictions. The selector discovered CWT, MST,
  and SST independently, plus **All calls**.
- With the native POTA source temporarily disabled, RBN supplied 31 spots
  under CWT filtering, with five visible on the native automatic 40m/CW
  view. **All calls** supplied 227 spots, with 56 visible on 40m. These are
  successive live snapshots, not a fixed-fixture count comparison.
- Selecting exact skimmer **KM3T** narrowed the source to 62 spots. Adding
  receiver region **JO** yielded zero spots; changing that region to **FN**
  restored reports (67 spots in the later snapshot). Both restrictions
  therefore applied together and changed the native results on refresh.
- Selecting **MST call-history file** produced 31 spots (six visible on
  40m); **SST call-history file** produced 38 (ten visible). No contest
  operation switch was required to use either provider.
- The operation panel retained the **My Signal** name. Temporarily watching
  public **F8DGY** reports with synthetic test origin **FN42** rendered a
  map and receiver table with 60 receivers on two bands at 15:59:50 UTC.
  The origin was only a rendering fixture, not F8DGY's actual location.
- Restored CWT filtering, CW mode, blank receiver restrictions, the original
  enabled POTA source, and both blank My Signal overrides. After a clean
  quit/relaunch, settings persisted and RBN again supplied 31 spots. The
  app remained responsive and the test operation remained at zero QSOs.

No contacts or self-spots were submitted. Radio tuning was not tested;
the radio connection reported failure. Native checks covered CW and loaded
history providers; missing-provider/file behavior, other modes, and network
failure/backoff remain deterministic-test coverage. No phone UI acceptance
was performed. Earlier README screenshots retain previous panel names.

The CWT integration observation is mirrored in the upstream PR source
branch's `SPOTS.md`; RBN/MST/SST-specific observations and personal candidate
packaging are exempt from upstream CWT synchronization.

## 2026-09-23: Temporary spot-filter boundary

Extracted pure history matching from the existing protocol adapter, retaining
normalization, portable-call matching, ambiguity rejection, and missing-file
handling. No runtime contract, selection default, or contest score changed.
The shared README and bridge call sites now identify the compatibility code
to retire when the host can express history relevance and filter it natively.
The plan preserves explicit preferences and distinguishes file membership
from QSO scoring eligibility; no future API is implemented speculatively.

`mise run format` and `mise run check` passed: **461 tests across 38 files**,
lint, strict typechecks, builds, and official packaging for all four extensions.
The CWT-relevant matcher, test, comments, and documentation were mirrored on
the upstream PR source branch; its **117 CWT tests**, repository typechecks,
and CWT build/pack passed.
RBN/MST/SST-specific adapter comments are exempt from CWT synchronization.
This behavior-preserving extraction was not reinstalled for another native
test; the native observations above describe the preceding candidate hashes.

## 2026-09-23: Receiver continents and distance limits

RBN now retains directory continents in its backward-compatible schema-1
cache and filters receivers by selected continents and/or great-circle miles
from an explicit origin grid. Legacy caches load with unknown continents
until refreshed. All receiver filters intersect before deduplication; grid
locations prefer the directory, falling back to the report grid. Unknown
continent/location is excluded only when the corresponding filter is enabled.
Contest matching and scoring contracts are unchanged.

`mise run format` and `mise run check` passed **467 tests across 39 files**,
lint, strict typechecks, builds, and packaging. Tests cover cache upgrades,
invalid preferences, persistence, concurrent edits, missing origins, unknown
receivers, filter combinations, directory precedence, distance boundaries,
and the date line. The parser also accepted a live 350-row RBN directory.
`mise run verify-host n1rwj-rbn` passed against Next 26.9.0 build 170.

Installed the local RBN 0.3.4 candidate (not a published release), SHA-256
`5dca83a6e0f03cc4f6c928f2d6b7593cb0610347fb207f2b1a2dc4704f94b749`,
in that native macOS build at approximately 16:54–16:59 UTC. The continent
multi-select rendered all seven choices. Saving a radius without an origin
displayed the validation message. North America, synthetic test origin FN42,
and 250 miles saved and survived a clean restart. Directory refresh succeeded.
Clearing the distance, then origin, then continent selection restored the
unrestricted receiver defaults; the original CWT filter was restored too.
The existing W8CAR/TEST operation remained at zero QSOs.

Live Vail fetches repeatedly hit the existing two-second timeout, so this
native session verifies controls, persistence, validation, and directory refresh,
not live filtered counts. Deterministic source/bundle tests verify the filtering.
These changes affect only RBN receiver selection and documentation, exempt
from upstream CWT synchronization.

## 2026-09-23: Separate My Signal and Spots settings

RBN settings now has explicit **My Signal — Who hears me** and
**Spots — Who I might hear** sections. The first points to the operation
panel's tune settings; the second contains all existing Spots preferences.
The page states that Spots filters never affect My Signal. No filtering
behavior changed. A regression test applies restrictive history, mode,
skimmer, continent, region, and radius preferences and confirms identical
My Signal scenes and queries, including unlocated receivers and a recreated
panel instance.

`mise run format` and `mise run check` passed **468 tests across 39 files**,
lint, strict typechecks, builds, and official packaging. Installed the local
RBN 0.3.4 candidate, SHA-256
`55525e3607538dd67e4b766d959d6d2d060188407d9baea2821972c1a261e521`,
in native macOS Next 26.9.0 build 170. Both section headings and explanatory
copy rendered correctly, and existing preferences remained intact. This UI
check does not extend the live-feed verification above. RBN-only code,
tests, and documentation are exempt from upstream CWT synchronization.

## CQ WW RTTY preview — September 26, 2026

The temporary `n1rwj-cqww` 0.5.0 package passes `mise run check` (620 tests,
strict source/test/tooling typechecks, lint, official ES2020 build and package
validation). The official `ham2k-cqww` source passes its 30 tests, typecheck,
and official packaging with upstream SDK 0.8.1. The personal copy retains
this repository's SDK 0.6.0 and existing host-library compatibility ranges.

`mise run verify-host n1rwj-cqww` passes against the running Ham2K Mac Logger
(Next) 26.9.0 build 174, kernel SHA-256
`ee7338084608394a7a9409f4feda32a5438ec642ca8876db249f684d614dee63`.
All five declared hooks register under the personal extension key and the
shared-library requirements match. This evaluates the installed JavaScript
kernel under Node VM; it does not install the extension into the native app,
change an operation, or establish on-air/UI verification.

Source and bundle tests cover RTTY point rules, band filtering, single-band
entries, UTC-day duplicate continuity, Canadian areas/aliases, Alaska/Hawaii,
CQ/WAE countries, maritime-mobile multiplier exclusion, explicit exchange
edits/clearing, RTTY mode variants, ADIF fields, and exact Cabrillo QSO columns.
CW/SSB regression tests remain in both copies. Before operating, verify native
setup, field focus/editing, QSO saving, and export in a disposable operation;
verify radio-reported frequency/mode separately with the intended radio.

## Release 0.5.0 publication — 2026-09-26

Published [v0.5.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.5.0)
from signed commit `f0bcef322306c7b7d37422e25f17145ffbf05ef6` at 20:50 UTC.
The final `mise run check` passed **627 tests across 52 files**, lint, strict
source/test/tooling typechecks, builds, and official packaging for six extensions.
The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36270914995)
succeeded and uploaded all six bundles and six checksums.

`mise run release:catalog v0.5.0 --dry-run` downloaded and verified every
published archive/checksum, validated every release-note section, selected
CQ WW/CWT/MST/SST, and skipped unchanged PSK Reporter/RBN. The actual catalog
job logged those same two skips and four successful `stable` publications,
each returning **approved**, at 20:51 UTC. CQ WW's submitted name includes
“temporary”; the release notes link Ham2K/extensions PR #2 and require removal
when an official CQ WW release includes the changes. Automated publication
verification does not extend the native UI or on-air verification above.

Publication tooling and personal release records are exempt from upstream
CWT/CQ WW runtime synchronization.

## RBN My Signal background requests — 2026-09-26

My Signal starts one shared request per callsign/window and returns cached
reports while HTTP is pending. A pending scene adds `tick:1`; after completion
the next render shows the result and removes that trigger, restoring the
descriptor's `tick:60`. Manual refresh also returns without awaiting HTTP,
preserves panel controls, and reuses an existing request. Offline checks,
server rate-limit backoff, and the per-query network cooldown still apply.

The extension supplies no HTTP timeout override. The inspected host has
separate 15-second header and 30-second body limits. The SDK has no timer/sleep
primitive, so this implementation returns the cache immediately instead of
racing a render wait against the fetch. Genuine host timeout diagnostics are
retained, and longer successful requests survive cache restoration.

Duration uses real host clock samples and is displayed as an upper bound
through the render that observes completion. Completion and unobserved server
retry-delay markers survive restart; developer clock jumps or speed changes
cannot distort the duration or start a retry early. A separate panel's rate
limit does not stop one-second ticks for a request already in flight.

Two direct HTTP requests at 21:50 UTC for N1RWJ, a 15-minute window, and
`limit=500` returned HTTP 200 in 0.217 and 0.137 seconds, including connection
setup and downloading the body. These requests used curl outside the host
bridge and did not reproduce the reported timeout.

Deterministic tests cover delayed success/failure, deduplication across renders
and manual refresh, persisted long requests, request duration, retry timing,
and dynamic-trigger removal. A packaged-bundle test uses a VM without timers
and a deferred host fetch to verify rendering returns before HTTP completes.
`mise run format` and `mise run check` passed **652 tests across 53 files**,
lint, strict typechecks, builds, and official packaging. These checks do not
constitute a native Ham2K UI/lifecycle test. RBN-only code, tests, and
documentation do not affect upstream CWT or CQ WW behavior.

## PSK Reporter background history — 2026-09-26

PSK Reporter now returns from manual reload without awaiting HTTP, matching
its existing automatic history behavior. Pending requests and forced requests
queued behind another callsign add `tick:1`; completion removes that trigger.
The regular `tick:5` remains because it services MQTT heartbeats and the
30-second subscription leases. Repeated force clicks share one pending request.

History fetches retain their XML Accept header but no longer supply the
seven-second timeout override. The host owns header/body timeouts. Cached and
live reports remain visible while history loads, and MQTT delivery continues
independently. Global serialization, durable five-minute automatic cooldown,
failure backoff, and offline/visibility/generation checks remain in place.

Details show request duration, with real host clock samples producing an upper
bound through the next observing render. History timing does not replace the
MQTT/lease clock. Host timeout diagnostics are bounded and preserved; pending
requests suppress the prior history warning until the new attempt completes.

Source and timerless packaged-bundle tests cover deferred automatic/manual
fetches, result/failure display, deduplication, live delivery during history
loading, timeout omission, and removal of the extra render trigger. These are
not native Ham2K UI/lifecycle tests. PSK-only runtime changes and supporting
verification are exempt from upstream CWT/CQ WW synchronization.

`mise run format` and `mise run check` passed **662 tests across 53 files**,
lint, strict source/test/tooling typechecks, builds, and official packaging.

## Reception map attribution overlay — 2026-09-26

RBN and PSK Reporter maps now draw geography through the attribution area to
the rounded outer frame. The previous projection clip and ocean-colored
footer strip cut off Florida and Mexico above that frame. Attribution remains
a text overlay; projection fitting still reserves its space so zoom and
station positions remain unchanged.

A deterministic short-panel regression covers receiver/transmitter maps and
normal/large text scales, checking that land reaches the bottom edge and no
opaque ocean strip covers it. Before/after static SVG previews reproduce the
reported cutoff at N1RWJ's location and confirm continuous coastlines in light
and dark themes. This is static rendering verification, not a native Ham2K
UI test.

`mise run format` and `mise run check` passed **663 tests across 53 files**,
lint, strict typechecks, builds, and official packaging. The shared reception
package has only RBN and PSK Reporter consumers; this change does not affect
CWT or CQ WW and is exempt from their upstream synchronization requirements.

## Reception map projection and fitting — 2026-09-26

The default **Fit reporting receivers/stations** view now uses north-up
Natural Earth 1 instead of the station-centered azimuthal projection. Its
longitude seam follows the smallest arc containing the station and reports,
including clusters crossing the date line. Padding is capped by map height,
and the fitted extent has 10% extra space. The optional **From my station ·
distance rings** view retains the equidistant projection and is now the only
view that draws circular distance rings. Distance/bearing data is unchanged.
Equally ranked country labels prioritize proximity to report endpoints.

A synthetic New England–western US–Brazil fixture reproduces the reported
wide/short view. At 800 × 258 logical pixels, the receiver vertical span grew
from approximately 114 to 145 pixels (27%) while keeping all endpoints in
view. Static light/dark previews confirm recognizable continents, a Brazil
caption, and the attribution overlay. Additional phone previews cover Europe
and a cluster straddling the date line. These are static previews with
approximate fixture positions, not live reports or a native Polo UI test.

New deterministic tests cover north-up ordering, date-line equivalence,
stable longitude seams under reordering and duplicates, finite poles/global
outliers, short-panel fitting, accurate azimuthal radial distances, and
country-label relevance. Existing geometry budgets, clipping, accessibility
scales, label collisions, and packaged RBN/PSK tests also pass.

`mise run format` and `mise run check` passed **671 tests across 54 files**,
lint, strict typechecks, builds, and official packaging. Only RBN and PSK
Reporter consume this shared map; CWT and CQ WW upstream synchronization
does not apply.

## Release 0.5.1 publication — 2026-09-26

Published [v0.5.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.5.1)
from signed commit `88363a3cff77113963f3fb35ca8b57047ece5f1f` at 23:32 UTC.
GitHub verifies all four release commits' signatures. The final local
`mise run release v0.5.1 --dry-run` passed **671 tests across 54 files**,
lint, strict typechecks, official builds, packaging, and checksum validation.
The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36279721009)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36279749519)
succeeded. GitHub contains all six bundles and six checksum files, and its
release tag resolves to the tested signed commit. The published body matches
`docs/releases/v0.5.1.md`.

`mise run release:catalog v0.5.1 --dry-run` downloaded and verified all
published assets and selected only PSK Reporter and RBN. The catalog job
confirmed both uploads to `stable` as **approved** at 23:32 UTC; all four
unchanged contest extensions were skipped. The changed reception workspace
has only RBN and PSK Reporter consumers. Synchronized version bumps introduce
no contest behavior changes and require no CWT/CQ WW upstream changes.

Published artifact verification does not extend the native Polo UI/lifecycle
verification above. Publication records and versioning are personal repository
packaging, exempt from upstream runtime synchronization.

## Release 0.6.1 publication — 2026-09-27

Published [v0.6.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.6.1)
from signed commit `7d51767f60692339bc19160c5d76260dda87cc14` at 06:04 UTC.
The release dry run passed **708 tests across 58 files**, lint, strict
typechecks, official ES2020 builds, packaging, and checksum validation.
The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36299023676)
succeeded. GitHub contains seven bundles and seven checksum files; the tag
resolves to the tested signed commit and the body matches
`docs/releases/v0.6.1.md` exactly.

`mise run release:catalog v0.6.1 --dry-run` downloaded and validated every
published asset. Only CQ WW was selected; its catalog upload returned
**approved** on `stable` at 06:05 UTC. All six unchanged extensions were skipped.

The CQ WW fix and matching regression coverage are pushed to
[Ham2K/extensions PR #2](https://github.com/ham2k/extensions/pull/2). That workspace
passes 40 tests, typechecking, build, and official packaging. Tests cover bare
spot candidates, known QTH and zone hints, operator corrections and clearing,
band/mode eligibility, independent previews, and checkpoint replay. The
installed build 175 JavaScript kernel under Node VM reports new country,
zone, and known-state multipliers without changing the accumulated score.
Native UI and on-air verification remain pending.

Personal versioning and publication records are exempt from upstream runtime
synchronization. No CWT behavior changed and its PR branch was not edited.


## Reception timers — 2026-09-27

Upgraded the shared development toolchain to `@ham2k/extension-sdk` 0.8.1 and
`@ham2k/extension-tools` 0.7.0. RBN and PSK Reporter declare API 3; contest
manifests retain API 1. No shared-library compatibility ranges changed.

PSK Reporter now uses host timeouts for MQTT acknowledgment deadlines,
heartbeats, reconnect backoff, topic visibility expiry, cache checkpoints and
queued HTTP history. RBN uses timeouts for visible My Signal queries and shared
HTTP 429 backoff. Renders still supply visibility and real epoch samples;
relative deadlines remain independent of the sandbox's virtual `Date`.
Timers do not renew their own visibility. PSK topics expire after 30 seconds;
RBN placements expire after 75 seconds and `onHide` pauses both feeds.

Deterministic tests cover cancellation, missing render ticks, frozen/shifted
virtual clocks, delayed storage and network responses, persisted cooldowns,
multiple placements, force requests, cache-write coalescing and failures.
A render awaiting cache restoration cannot reopen reception after `onHide`;
only a fresh render can resume it.
Pending relative HTTP cooldowns survive reload conservatively; serialized
writes prevent an older expiry from clearing a newer reservation. Bundle
fixtures exercise the published SDK's timer bridge without ambient timers,
including autonomous refresh, heartbeat, lease expiry and hide cancellation.

`mise run format` and `mise run check` passed **793 tests across 64 files**,
lint, strict typechecks, all seven ES2020 builds and official packages.
The installed Ham2K Mac Logger (Next) 26.9.0 build 175 JavaScript kernel passed
activation timer bindings, wake messages, one-shot execution, cancellation,
visibility callbacks and bundle compatibility probes. This is a Node VM check
of the installed kernel with simulated native dispatch, not a native timer,
UI, background/foreground or sleep/resume test. Those app checks remain pending.

The SDK's narrowed hook categories required a type-only adapter for the
existing private spot-filter bridge. The exact adapter was mirrored to the
verified source branch `codex/cwt-call-history` for
[Ham2K/extensions PR #1](https://github.com/Ham2K/extensions/pull/1) in a separate
local workspace. Its 123 CWT tests, typecheck, build and package checks passed.
Upstream `main` and the CQ WW branch were not changed. Reception runtime work
only affects RBN and PSK Reporter and is exempt from CWT/CQ WW synchronization;
root dependency changes are shared changes for the next release's notes.

These commits are local. No version bump, push, catalog update or release was
performed. Existing investigation drafts remain outside the timer commits.

## Release 0.7.0 preparation — 2026-09-27

Reviewed the changes since v0.6.1, including reception info layout, MQTT and
HTTP scheduling, persistence, visibility cancellation, and SDK compatibility.
No release-blocking issue was identified. All workspaces and manifests now
use 0.7.0; the authored release notes select all seven catalog entries because
the root SDK and extension-tools updates are universal shared changes.

`mise run release:notes v0.7.0`, `mise run format`, and
`mise run release v0.7.0 --dry-run` passed, including **793 tests across 64 files**,
lint, strict typechecks, seven ES2020 builds, official packaging, and checksums.
`mise run verify-host` passed for every extension against the installed kernel,
including simulated timer wakes. Native UI and app lifecycle testing remain
outside this verification scope.

The type-only spot-filter adapter matches pushed CWT PR #1 source commit
`5c261d65bd27e556cf9ebc9a417dea5d646d890d` on `codex/cwt-call-history`.
Reception runtime changes affect only RBN and PSK Reporter. Personal versioning,
release notes, and publication records are exempt from upstream synchronization;
no CQ WW behavior changed. The two existing investigation drafts are excluded
from the release commit.

## Release 0.7.0 publication — 2026-09-27

Published [v0.7.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.0)
from signed commit `919f9c02b02cbd6e5afb5bd2358dc04b9522445f` at 13:36 UTC.
GitHub verifies the signature; the release tag resolves to this tested commit.
The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36322949241)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36322961213)
succeeded. GitHub contains all seven bundles and seven checksum files, and
the published body matches `docs/releases/v0.7.0.md` exactly.

`mise run release:catalog v0.7.0 --dry-run` downloaded and validated every
published asset and selected all seven extensions for the shared toolchain
update. The catalog job returned **approved** on `stable` for CQ WW, CWT,
MST, PSK Reporter, RBN, SST, and WRT at 13:36 UTC.

The preparation checks above remain the runtime verification scope; publication
does not establish native timer, UI, or sleep/resume behavior. These publication
records are personal repository documentation, exempt from upstream behavior
synchronization. Existing investigation drafts remain uncommitted.

## Release 0.7.1 preparation — 2026-09-27

Prepared synchronized version 0.7.1 for RBN's CW speed filters, remembered and
locally suggested receiver continents, and explicit defaults/reset controls.
Reviewed the diff from v0.7.0: runtime changes affect only RBN; the root lockfile
and all other package/manifest changes are synchronized version updates.
`docs/releases/v0.7.1.md` selects RBN alone for catalog publication.

- `mise run release:notes v0.7.1` validated all seven extension sections.
- `mise run format` completed, followed by `mise run release v0.7.1 --dry-run`.
- The release dry run passed lint, strict typechecks, all 806 tests across
  66 files, ES2020 builds, official packaging, and validation of all seven
  bundle/checksum pairs.

Unit and bundle checks do not establish native settings UI or device-location
permission behavior. RBN-only behavior and personal release packaging are
exempt from upstream CWT/CQ WW synchronization. The two existing investigation
drafts remain outside the release commit.

## Release 0.7.1 publication — 2026-09-28

Published [v0.7.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.1)
from signed commit `3bb7900cdca95543c49075e61bb8ae68d84ec7f2` at 01:04 UTC
(September 27 in US Eastern time). GitHub verifies the signature, and the
release tag resolves to this tested commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36364537715)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36364551631)
succeeded. GitHub contains all seven bundles and seven checksum files, and
the published body matches `docs/releases/v0.7.1.md` exactly.

`mise run release:catalog v0.7.1 --dry-run` downloaded and validated every
published asset and selected RBN alone. The catalog job returned **approved**
for RBN 0.7.1 on `stable` at 01:05 UTC; the six unchanged extensions were
skipped as intended.

The preparation checks above remain the runtime verification scope. These
publication records are personal repository documentation, exempt from
upstream CWT/CQ WW synchronization. Existing investigation drafts remain
uncommitted.

## CQ WW summary synchronization — 2026-09-28

Rebased [CQ WW PR #2](https://github.com/ham2k/extensions/pull/2) onto the
upstream contest-summary changes, resolving conflicts in the scoring hook,
operation title, and English/Spanish translations. The personal extension
uses identical runtime source and translations, with the standard contest
title/total and an arithmetic line that distinguishes zones, countries, and
RTTY state/province multipliers. No separate daily score is shown. Regression
coverage includes localized multiplier counts and restored checkpoints with
legacy day counters; RTTY scoring and export semantics remain compatible.

The personal `mise run format` and `mise run check` passed: **818 tests across
66 files**, strict typechecks, lint, builds, and packaging. Upstream CQ WW's
**45 tests** and official build/packaging passed. These are automated checks;
no native UI or on-air test was performed. Version 0.7.1 remains the current
personal development version; this maintenance run did not publish a release
or submit anything to the catalog.

Only CQ WW behavior is affected, so these changes are synchronized to PR #2
and are exempt from the CWT PR synchronization requirement.

## CQ WW activity suggestions — 2026-09-29

Rebased [CQ WW PR #2](https://github.com/ham2k/extensions/pull/2) onto the
upstream date-ranked activity suggestions. RTTY, SSB, and CW are offered in
calendar order of relevance; new setup defaults to the nearest upcoming mode.
Existing CQ WW operations are excluded from suggestions so a new selection
cannot replace their configured exchange. The personal preview retains its
temporary identity and uses the same runtime source, translations, and guide.
Upstream scheduling and activity tests were adapted to Vitest locally.

Validation ran in an isolated personal worktree to exclude unrelated ongoing
settings-report work. `mise run format` and `mise run check` passed with
**828 tests across 67 files**, strict typechecks, builds, and packaging. An
inherited test-only lint warning was removed and lint plus the affected hook
tests passed again. Upstream CQ WW passed **55 tests** and official packaging.
No native UI or on-air test was performed; no release or catalog publication
was requested by this maintenance run. Only CQ WW code changed, exempt from
CWT PR synchronization.
