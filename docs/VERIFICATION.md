# Verification and compatibility

## Release 0.18.0 publication — 2026-10-30

Published [v0.18.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.18.0)
from signed main commit `646b660c8c9b48d852f6bccadc1e1cbe60f06bb3` at
**00:05:48 US Eastern (04:05:48 UTC)**. GitHub verifies the release-preparation
commit and Zombie implementation commit
`5f7911f1efc74711913c84b67d34a3e38317ffef`. The tag points to the exact tested
release commit, and its body matches the authored notes file.

- Local `mise run release v0.18.0 --dry-run` and the
  [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/41000890727)
  pass: **1,948 tests in 150 files**, strict types, lint, thirteen official
  ES2020 builds and thirteen packages/checksums.
- Both jobs of the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/41000969587)
  passed. GitHub archives **thirteen bundles and thirteen checksum files**.
- `mise run release:catalog v0.18.0 --dry-run` downloaded and validated all
  archives/checksums and selected MST, NS, SST, WRT and Zombie, skipping the
  eight unchanged catalog entries. Log:
  `/tmp/ham2k-catalog-v0.18.0-dry-run.log`.
- All five submitted extensions are **approved** and current at **0.18.0**
  on `stable`, released between **04:07:01.883 and 04:07:09.987 UTC**. Their
  public bundle bytes, sizes, SHA-256 hashes and scoped notes match the GitHub
  assets and authored sections.
- Zombie's public bundle is **102,377 bytes**, SHA-256
  `e4351b17166c08fad82b7c28c326ec2cccd298373b1c8077b2e25acf2ac95c3b`.
  API-1 and API-13 discovery offer Zombie 0.18.0, and the host's update endpoint
  offers it to an installed 0.17.0 with API 1. API-13 discovery offers all five
  submitted extensions. Verification metadata:
  `/tmp/ham2k-v0.18.0-verified.json`.

The Zombie update adds announced bonus markers and native `4321` prefills.
It preserves copied-number scoring, corrections, clearing and 2026 scope.
NS and its shared MST/SST/WRT changes were already on main. None of these
changes affects CWT behavior; synchronized version-only packaging is also
exempt from upstream CWT synchronization. The pre-existing video brief was
left uncommitted. Native UI and on-air acceptance remain distinct from these
source/bundle/publication checks.

## Zombie Shuffle 2026 bonus announcement — 2026-10-29

Verified NA5N's original QRP-L message, “Zombie Shuffle Friday Oct. 30,”
through Fastmail. It names 16 bonus calls; `N7CQR` and `K7TQ` are separated
by a line break in the original. Message-ID:
`20261030014009.50176.qmail@modulo.zianet.com` (received October 29 US Eastern).
The [official 2026 rules](https://www.zianet.com/qrp/ZOMBIE/pg.html) confirm
the date, local hours and `4321` bonus exchange, but do not list the calls.

Added the announced calls to the offline event overview and operation-scoped
lookup/spot notes for 2026, including unambiguous portable forms. Announced
assignments appear separately from copied exchanges and history suggestions.
The number field prefills `4321` for announced bonus calls ahead of older
personal-number history. A number already present on the draft, including a
deliberate blank, wins; repeated refreshes retain the applied suggestion.
The host's native touched-field handling also preserves typed corrections
and clearing. Names and locations still use their existing sources. The roster
does not award points or establish current activity. The existing scorer uses
the exchange actually logged, including bonus exchanges from stations absent
from this announcement.

- `mise run format` and `mise run check` pass: **1,948 tests in 150 files**,
  strict source/test/task typechecks, lint, thirteen official ES2020 builds
  and thirteen official packages/checksums.
- Twelve new deterministic tests cover the exact roster, normalization,
  portable and ambiguous calls, event-year scope, corrections/clearing,
  optional-history failures, offline guidance and copied-number scoring,
  plus all 16 bonus prefills, older-history precedence, stable repeated
  refreshes and withholding suggestions outside the announced event/calls.
  The existing compiled-bundle test also exercises bonus lookup notes,
  the offline list and native number-prefill descriptors without network access.
- Inspected the published SDK activity contract and host
  `logging_controls_exchange.dart`: `applySuggestedValues` skips touched
  fields, `restore` marks saved values touched, and callsign changes withdraw
  only untouched suggestions. Native UI interaction remains untested here.
- `mise run release:notes v0.18.0 n1rwj-zombie` validates all thirteen audience
  sections and previews the updated Zombie notes in the existing authored file.

These are unpublished changes at the synchronized **0.17.0** development
version, with notes prepared for **v0.18.0**. Source and Node VM bundle checks
are distinct from native Ham2K UI and on-air acceptance. Only Zombie source,
tests and guidance changed; shared code and CWT behavior are unchanged, so
upstream CWT synchronization is exempt.

## NCCC Sprint CW implementation — 2026-10-29

Added the independent `n1rwj-ns` extension at the repository's synchronized
development version, **0.17.0**. This local build has not been published or
submitted to the catalog. Draft next-release notes are in
[v0.18.0.md](releases/v0.18.0.md), with shared-consumer notes for MST, SST and WRT.

- `mise run format` and `mise run check` pass: **1,936 tests in 149 files**,
  strict source/test/task typechecks, lint, thirteen official ES2020 builds
  and thirteen official packages/checksums. NS adds 56 deterministic tests.
- NS source and bundle checks cover three-part exchanges, native serial
  descriptors, editing/clearing, scoped local history, UTC/DST and cutoff
  boundaries, per-band duplicates/multipliers, all current North American
  DXCCs, the sponsor's South American additions, Canadian aliases,
  state/country abbreviation collisions, native cached N1MM prefills,
  CQ/S&P/Unknown controls, advisory QSY checks, checkpoint resumption and exports.
- The actual `SPRINTNS.txt` download (last edit 2026-08-20, 76,012 bytes,
  4,723 contact records) is accepted by the official compiled bundle under
  Node VM. An existing record supplies name/QTH while offline; a missing
  callsign remains blank, and received serials are never suggested. The
  native host's download/freshness UI itself is not exercised by that probe.
- `mise run verify-host n1rwj-ns` accepts all seven hooks against the installed
  **Ham2K Mac Logger (Next) 26.9.0, build 184** kernel. Kernel SHA-256:
  `7cdaf082cae88298ae61786d01f4d3ee7ab33a10890c9c6cebd8016e3f83e3cf`.
  Shared-library compatibility and activation pass under Node VM. This is
  distinct from a native app installation, UI/serial-allocation test or on-air
  acceptance; those remain pending.
- `mise run release:notes v0.18.0` validates and previews all thirteen audience
  sections. No third-party dependency versions changed; the lockfile only
  registers the new workspace. Existing published release records are retained.

QSO start time approximates the sponsor's response/callsign cutoff. QSY is
advisory, never changing points, multipliers, duplicates or permission to save.
Recorded CQ anchors require a completed contact elsewhere before return;
frequency-only proximity checks acknowledge that separate nearby CQs may be
valid. Missing data and older checkpoints remain explicitly uncertain.
An operation-scoped guide cache shares cold reads, rejects stale responses,
and recovers native payloads missing UUID only from a unique creation identity.
Operators must disable external spotting assistance. NS registers a native
API-11 data-file hook for prefills, with no spot source or history spot filter. CWT
source and the shared CWT history adapter remain unchanged; NS and this shared
MST/SST/WRT work are exempt from CWT upstream synchronization.

## Release 0.17.0 publication — 2026-10-29

Published [v0.17.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.17.0)
from signed main commit `ad433250bb949e6a2b1053f2fef74079f1a26078` at
**19:15:39 US Eastern (23:15:39 UTC)**. GitHub verifies all eight implementation,
release preparation and review-correction commits. The tag resolves to the
exact tested commit and the release body matches the authored notes.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40971780574)
  and both jobs of the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40971902010)
  passed. All **twelve bundles and twelve checksum files** are archived.
- Every extension is **approved** and current at **0.17.0** on `stable`, released
  between **23:16:44.648 and 23:16:59.175 UTC**. Public bundle bytes, SHA-256,
  sizes and scoped notes match the GitHub archives and authored sections.
- `mise run release:catalog v0.17.0 --dry-run` downloaded and validated all
  archives/checksums and selected all twelve extensions because shared SDK,
  tools and build dependencies changed. Log:
  `/tmp/ham2k-catalog-v0.17.0-dry-run.log`.
- Public discovery and update offers were checked at API **1, 5, 9, 10, 11,
  12 and 13**. New compatible offers numbered **2, 5, 6, 6, 9, 11 and 12**,
  respectively. CWT/MST/SST require API 11; SKCC/RBN require API 12; BKG
  requires API 13 and declares read-only radio access. Older hosts retain
  compatible prior catalog versions. Update tests used approved installed
  versions compatible with each simulated host, rather than unpublished
  synchronized archive versions. Evidence:
  `/tmp/ham2k-v0.17.0-public-verification.json`.
- Final checks passed **1,880 tests in 142 files**, strict typechecking, lint,
  twelve ES2020 builds and official packages. The dependency audit reports no
  vulnerabilities for the released repository dependency tree. Logs:
  `/tmp/ham2k-v0.17.0-visibility-check.log` and
  `/tmp/ham2k-v0.17.0-release-workflow.log`.
- Installed Next build 184 JavaScript-kernel verification passes under Node VM
  for all twelve bundles; this tests registration, libraries and simulated
  timer delivery. It does **not** establish native API 13 support in build 184.
  Native device UI, scrolling gestures, upgrades and on-air acceptance remain
  separate. Synthetic BKG previews were inspected; native zoom was removed
  after review found that whole-scene zoom breaks the card geometry.

Independent fresh-context release-readiness and API-opportunity audits found
and verified fixes for hidden/coalesced radio state, overlapping derived-cache
refreshes, and same-count log edits. BKG and SKCC now refresh immediately on
reveal and explicit log changes; a one-minute real-clock cache lifetime recovers
event reasons overwritten by the host without per-keystroke log reads. No
required API migrations remain. Supported scene aliases and potential BIGFOOT
workflow changes remain optional future work.

CWT behavior, tests and documentation are synchronized to the source branch of
[Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1), with signed
commit `7320f5119b3591b7c7b7393c923210a15eafb043`. A clean dependency install,
**96 CWT tests**, focused strict typecheck and official build/pack passed there;
the PR description reflects API 11 and SDK/tools 1.13.0. Other extensions and
personal release tooling/packaging are exempt from CWT synchronization.

## Release 0.16.0 publication — 2026-10-29

Published [v0.16.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.16.0)
from signed main commit `3bac28646dbef95d5e079a1be5f8109a6f996927` at
**18:32:31 US Eastern (22:32:31 UTC)**. GitHub verifies both the Zombie
implementation and release-preparation commit signatures. The tag resolves
to the tested commit and the body exactly matches the authored release notes.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40966433977)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40966649612)
  passed. GitHub contains all **24 bundle/checksum assets**.
- `mise run release:catalog v0.16.0 --dry-run` downloaded and validated every
  archive and checksum, selecting only BKG and Zombie and skipping the ten
  unchanged entries. Log: `/tmp/ham2k-catalog-v0.16.0-dry-run.log`.
- The catalog reports **approved** on `stable` for BKG and Zombie, released
  at **22:33:30.084 and 22:33:31.742 UTC**, respectively. Both are current at
  0.16.0. Scoped notes match the authored per-extension extraction exactly.
- Downloaded public catalog bundles match their GitHub assets byte for byte,
  including the GitHub-reported digest and size:
  - BKG: **33,261 bytes**, SHA-256
    `e10db2101364cb2322820aabff0c30833c10dda48a11074ff51e729d0a394aef`.
  - Zombie: **98,773 bytes**, SHA-256
    `9db7990b15e454c9cb1cf7f22dd3f58ba73dacfe7fc5880d6bb7e06272377d2f`.
- API-1, API-9 and API-13 public discovery offers Zombie 0.16.0. API-9 and
  API-13 also offer BKG 0.16.0; API-1 omits BKG. A read-only request to the
  app's update-check endpoint with an installed Zombie 0.15.1 and API 1
  offers 0.16.0. Zombie's approved manifest has eight hooks and no data file.
  Evidence: `/tmp/ham2k-v0.16.0-public-verification.json`.

The preparation record below defines automated coverage and native acceptance
limits. BKG, Zombie-only changes and personal publishing are exempt from CWT
upstream synchronization. No broader host API migration is included.

## Release 0.16.0 preparation — 2026-10-29

Prepared the Zombie removal on top of the signed BKG implementation on main,
`790e73b83d83dfa097018bfaad92cf9dd05dc6e3`. All twelve extension archives and
shared workspaces use 0.16.0. The authored release notes select only BKG and
Zombie for catalog submission; the other ten sections explicitly declare no
extension-specific changes. Root dependencies and shared runtime code are
unchanged.

`mise run release:notes v0.16.0` validates the complete document and extracted
catalog notes. `mise run release v0.16.0 --dry-run` passes **1,932 tests in
143 files**, lint, strict runtime/test/task types, twelve ES2020 builds,
official packaging, synchronized versions and all 24 bundle/checksum assets.
Log: `/tmp/ham2k-release-v0.16.0-check.log`.

The Zombie installed-kernel check below and the BKG implementation check use
Next build 184. They are JavaScript contract checks, not native device upgrade,
UI or on-air acceptance. This release contains BKG, Zombie-only behavior and
personal packaging changes, exempt from CWT upstream synchronization. The
broader host API migration is deferred to separate changes.

## Zombie call-history removal — 2026-10-29

The public N1MM Zombie file page returns 404 and the filtered call-history
listing has no Zombie result. Remove the registered data file, downloader,
parser, snapshot cache, source setting and N1MM network grants. The Activities
dialog retains its offline event guide. Old downloaded snapshots and source
settings are ignored; no replacement roster is bundled.

- `mise run format` and `mise run check` pass: **1,884 tests across 140 files**,
  lint, strict runtime/test/task typechecks, eleven ES2020 builds and official
  packaging.
- The bundle regression rejects every activation host call, asserts that no
  `dataFile` hook or network grant exists, and exercises logged-contact hints
  while leaving unknown Zombie names and numbers unsuggested.
- Contact-history tests retain current-operation/same-event/older-event
  precedence, stale bonus filtering, leading zeros, portable identity matching,
  explicit corrections and clearing, and bounded log access. The read-only
  settings test verifies that old source values never trigger reads or writes.
- `mise run verify-host n1rwj-zombie` passes against the installed
  **Ham2K Mac Logger (Next) 26.9.0, build 184** kernel, SHA-256
  `7cdaf082cae88298ae61786d01f4d3ee7ab33a10890c9c6cebd8016e3f83e3cf`.
  It activates all eight remaining hooks, with no data-file hook.

Installed-kernel verification runs under Node VM; native UI, device upgrade
and on-air acceptance remain separate. Shared runtime modules and CWT behavior
are unchanged, so this Zombie-only removal is exempt from upstream CWT
synchronization.

## BKG Companion first cut — 2026-10-29

Implemented `n1rwj-bkg` at the current synchronized development version,
0.15.2. It has four hooks: daily native Data File, additive membership lookup,
contextual panel, and one API-9 Worked the Gang program. There are no settings,
identity controls, accounts, recruit submissions or OG hunt programs. Native
chasing supports nonmember hunters and counts only 2m CW; the panel calls out
recent 2m CW member spots as joining opportunities.

- `mise run format` and `mise run check` passed: **1,946 tests in 143 files**,
  strict runtime/test/task types, lint, all ES2020 bundles and official packages.
  BKG contributes **48 tests**, including raw-cache cold replay, refresh failure,
  source typo handling, portable identity, call clearing, callsign rename/reuse,
  nonmember claims, 2m CW eligibility, operation corrections and scene bounds/accessibility fallback.
- A read-only request to the live website v2 JSON successfully parsed and indexed
  **1,016 members**; source generation was `2026-10-29T14:29:04.041Z`.
  No administrator API, production mutation or private member data was used.
- `mise run verify-host n1rwj-bkg` passed against the installed Ham2K Mac Logger
  Next 26.9.0 build **184** JavaScript kernel, registering all four hooks with
  no compatibility problems. The new manifest uses the established LiquidJS
  `^10.28.0` host floor; no existing manifest compatibility range changed.
- `mise tasks validate` passed for all 41 tasks; the preview task's help and
  normal invocation were checked. `mise run bkg:preview` generates six synthetic
  Home/operation/nonmember/narrow/compact/unavailable states. Browser screenshots
  were visually reviewed after fixing preview-only cross-document SVG clipping.

The API-9 host has no reference-data invalidation hook for cached chase
candidates/lifetime claims. The roster, lookup, panel and uncached evaluations
refresh immediately; rebuilding existing chase results requires reloading the
extension and toggling EXP CHASE off/on on a complete-log device. This is
documented in the operator guide. No native UI, on-air or actual app chase-ranking
acceptance is claimed. The kernel check runs under Node VM.

The user's subsequent band/mode clarification restricts chase claims and panel
operation totals to 2m CW while preserving all-band/mode membership labels.
Chase schema version 2 invalidates the earlier any-band/mode bookkeeping so the
host can rebuild it on a complete-log device after extension reload. Regression
cases reject HF CW and 2m SSB, FM and FT8, including for spot-candidate evaluation.

Installable bundle: `dist/n1rwj-bkg-0.15.2.h2kext` and matching SHA-256 file.
This is a local, unreleased first cut; no tag, GitHub release or catalog
submission was created. Existing `docs/ZOMBIE-VIDEO-BRIEF.md` was left untouched.
Only BKG implementation, development tooling and personal provenance changed;
no CWT runtime/shared behavior requires upstream synchronization.

## Release 0.15.2 publication — 2026-10-26

Published [v0.15.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.15.2)
from signed main commit `e45bdecc817892a894cbd7ebfce8d3e029f1fb02` on
**October 26 at 22:03:46 US Eastern (October 27 at 02:03:46 UTC)**. GitHub
verifies both implementation and release-preparation signatures. The tag
resolves to the tested commit and the body exactly matches the authored notes.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40436116226)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40436228850)
  passed. GitHub contains all **22 bundle/checksum assets**.
- `mise run release:catalog v0.15.2 --dry-run` downloaded and validated every
  archive/checksum, selected only SKCC and skipped the ten unchanged entries.
  Log: `/tmp/ham2k-catalog-v0.15.2-dry-run-20261026.log`.
- The catalog returned **approved** on `stable`. Its public endpoint confirms
  SKCC 0.15.2 is current, released at **October 26, 22:04:47.308 US Eastern
  (October 27, 02:04:47.308 UTC)**. Scoped catalog notes match the authored
  release section. No retry or duplicate submission was made.
- The downloaded public catalog bundle matches GitHub exactly: **80,630 bytes**,
  SHA-256 `0fc55486630a0d3832b01fce25c60dfb3eaa2cb8e1ea886ea63a5bb6779315b4`.
  Catalog metadata and the GitHub asset digest agree. API-9 discovery offers
  0.15.2, while API-8 omits SKCC. Evidence:
  `/tmp/ham2k-skcc-v0.15.2-public-verification.json`.

The preparation record below defines lookup runtime coverage and its native
UI boundary. Only SKCC behavior changed; publication and personal packaging
are exempt from CWT upstream synchronization.

## SKCC additive lookup and v0.15.2 preparation — 2026-10-26

The host's compact logging UI deliberately shows a lookup's singular `note`
instead of `name`. SKCC supplied that field for membership, which hid a QRZ
name even though the name remained in the merged station data. The host's
[UI regression test](https://github.com/ham2k/halo/blob/main/packages/halo_widgets/test/logging_controls_lookup_test.dart)
explicitly covers this behavior. CWT uses the additive `notes` list; Call Notes
uses singular `note` intentionally for its compact replacement text.

SKCC now contributes membership through `notes` only, and stops emitting a
compact `note` or `emoji`. Its roster-name fallback runs at priority -2, after
callbooks and native Call History (-1), so a previous full name wins offline.
The host handles merging; SKCC does not fetch or copy QRZ data. Roster SPC
remains a labeled hint, and the separate SKCC exchange controls still suggest
name, SPC and member number for confirmation on air.

- `mise run release v0.15.2 --dry-run` passed **1,898 tests across 140 files**,
  lint, source/test/task typechecks, eleven official ES2020 builds/packages and
  all 22 bundle/checksum paths. Unit and bundle regressions cover the absence
  of compact overrides alongside richer QRZ identity and existing call notes.
- The running **26.9.0 build 184** kernel and its actual core lookup
  orchestrator passed five scenarios with synthetic source replies: QRZ
  identity/location/photo preserved; membership notes accumulated; Call History
  name before roster fallback; offline roster name fallback; and existing call
  note/emoji preserved. Kernel SHA-256:
  `7cdaf082cae88298ae61786d01f4d3ee7ab33a10890c9c6cebd8016e3f83e3cf`.
  Evidence: `/tmp/ham2k-skcc-additive-installed-check.json`.
- This evaluates installed JavaScript under Node VM with fixture callbook and
  history replies. It does not exercise the native UI, contact QRZ, or modify
  installed app data. Existing native UI and on-air verification limits remain.
- Release notes select only SKCC for catalog submission. Synchronized versions
  do not update dependencies. SKCC and personal packaging are exempt from CWT
  upstream synchronization; no CWT or shared runtime behavior changed.

## Release 0.15.1 publication — 2026-10-24

Published [v0.15.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.15.1)
from signed main commit `5c4dec996ef7fc57ddac73b34ac0795e40bb4879` at
**11:54:19 UTC (07:54:19 US Eastern)**. GitHub verifies all three settings and
release-preparation commit signatures. The tag resolves to that tested commit,
and the release body exactly matches `docs/releases/v0.15.1.md`.

- Local `mise run release v0.15.1 --dry-run` passed **1,897 tests across 140
  files**, lint, source/test/task typechecks, eleven official builds and
  packaging. Bundle checks cover manifest placement and disabled sidebar entries.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40091702568)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40091757087)
  passed. All **22 bundle/checksum assets** are available.
- `mise run release:catalog v0.15.1 --dry-run` downloaded and validated every
  archive/checksum, selected RBN, SKCC and Zombie, and skipped the other eight.
  Log: `/tmp/ham2k-catalog-v0.15.1-dry-run-20261024.log`.
- All three catalog submissions returned **approved** on `stable`. Public
  extension endpoints confirm 0.15.1 is current, with release times below.
  Their downloaded bytes match GitHub exactly, their SHA-256 hashes match the
  catalog and GitHub asset digests, and their scoped notes match the authored
  release sections. Evidence: `/tmp/ham2k-v0.15.1-public-verification.json`.

| Extension | Released at (UTC) | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| RBN | 11:55:25.798 | 320,747 | `c6ff7a873ccd62ce6b5db2b2f9ed97ee6b89794ed40a652fd55fc7b78896c61b` |
| SKCC | 11:55:27.838 | 80,594 | `92da028df94c25f54a401877d22500048639fa4e498590dd5e3151110a4fc997` |
| Zombie | 11:55:30.025 | 105,408 | `d7d902187fe4fa124c857f6b50e1cce2100417f7bb6e37119f15d48552a84fea` |

API-1 catalog discovery offers Zombie 0.15.1 and the older compatible RBN
0.6.0. API-5 and API-8 offer RBN and Zombie 0.15.1; API-9 also offers SKCC
0.15.1. SKCC is absent from the API-1, API-5 and API-8 responses.

Only SKCC, RBN and Zombie register global settings panels. They now declare
the matching manifest section and disable separate sidebar entries; repository
guidance captures the same rule. Current host source supports their sections,
but older hosts without those sections can still render standalone preferences
categories. This verifies source, bundles and distribution, not native UI or
on-air behavior. No shared dependency or CWT behavior changed; these settings
and publication updates are exempt from CWT upstream synchronization.

## Release 0.15.0 publication — 2026-10-24

Published [v0.15.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.15.0)
from signed main commit `d5493bd32148ea8cb7ed3bcd42b7220050f5e38d` at
**04:37:41 UTC (00:37:41 US Eastern)**. GitHub verifies all six implementation,
test and release-preparation commit signatures. The release tag resolves to
the tested commit and the body exactly matches `docs/releases/v0.15.0.md`.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40063008708)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40063090823)
  passed. GitHub contains all **22 bundle/checksum assets** for eleven extensions.
- `mise run release:catalog v0.15.0 --dry-run` downloaded and validated every
  archive/checksum, selected exactly SKCC, and skipped the ten unchanged entries.
  Log: `/tmp/ham2k-catalog-v0.15.0-dry-run-20261024.log`.
- The catalog upload returned **pending review** on `stable` at **04:38:41 UTC**.
  The release-notes request also succeeded. No retry or duplicate submission was
  made. The public extension endpoint returned 404 during verification, so this
  record does not claim public catalog availability or approval.
- Independently downloaded SKCC archive: **80,561 bytes**, SHA-256
  `babbebe2b8626343f77917841b99f93d79b01479badf5c7d93ef0dd6ffb412ae`.
  The checksum file and GitHub asset digest match. Evidence:
  `/tmp/ham2k-skcc-v0.15.0-verification-20261024.json`.
- Pending catalog review prevents verification of a public catalog bundle and
  API-9 discovery. Once approved, compare those exact bytes and scoped notes;
  older hosts should not be offered the API-9 extension.

The preparation and installed-kernel checks below define runtime verification;
publication does not establish native UI, cross-device or on-air acceptance.
SKCC and publication records are exempt from CWT upstream synchronization.

## SKCC Companion and v0.15.0 preparation — 2026-10-24

Prepared API-9 SKCC Companion and synchronized release 0.15.0. The release
notes select only SKCC for catalog submission; the existing ten extensions
have no runtime changes. Lockfile changes add the workspace and synchronized
versions without updating dependencies.

- `mise run release:notes v0.15.0`, `mise run format`, and
  `mise run release v0.15.0 --dry-run` passed: **1,897 tests across 140 files**,
  strict source/test/task typechecks, lint, eleven official ES2020 builds and
  packages, and all 22 bundle/checksum paths.
- The original five-second limit timed out in existing RBN, PSK Reporter and
  reception-layout tests; RBN reproduced with a single worker. Capping workers
  at four and allowing fifteen seconds passed every unchanged assertion.
- Both live official roster layouts parsed **31,513** records. The downloaded
  skimmer source supplies explicit active/inactive/silent-key status. Historical
  `/EX` and `/SK` suffixes override inconsistent active flags for spot filtering.
  Official event, roster and download links were checked; a dead awards-index
  link was replaced with verified individual award-rule pages.
- New tests cover delayed native roster replay, failed-refresh preservation,
  aliases, operator corrections/clearing, event windows and segmented scoring,
  ADIF evidence round trips, historical eligibility, specialty award selection,
  import ownership/persistence, scoped exports, SKS assistance suppression and
  operation-cache reuse during callsign typing.
- `mise run verify-host n1rwj-skcc` passed against running **26.9.0 build 183**,
  kernel SHA-256 `4308fbcd588f2d5b7e4a23eb01b9d2979a2409cfe294e89bfe150808940dd2c3`.
  All 23 SKCC hooks register, including eleven native chasing programs; shared
  library versions satisfy the manifest. This evaluates the installed kernel
  under Node VM and does not install or manipulate native app data.
- An additional installed-kernel check used its actual `core/adif` exporter:
  delayed roster replay, settings writes, saved exchanges, Centurion claims,
  panel rendering and ADIF delegation passed. Dedicated and whole-log exports
  preserved SKCC number, own name, qualification and Morse-key evidence, even
  when saved snapshots had no activity refs. The durable bundle harness labels
  its ADIF delegate stub separately from this actual-serializer verification.

Native UI, real cross-device chasing rebuilds and on-air acceptance remain
unverified. Native claims freeze an available roster and require explicit
reload plus whole-log EXP CHASE rebuild after roster changes. Imported
complete-history summaries are dated snapshots rather than live claim ledgers.
Theme review, award approval and sponsor submission remain operator actions.
SKCC, test-runner configuration and personal packaging are exempt from the
CWT upstream synchronization requirement; CWT behavior is unchanged.

## Release 0.14.3 publication — 2026-10-22

Published [v0.14.3](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.3)
from signed main commit `97e9baa1bbb416734ddb99c30dcebdaeac959182` at
**17:44:38 UTC (13:44:38 US Eastern)**. GitHub verifies both implementation and
release preparation signatures; the release tag resolves to that tested commit,
and its body exactly matches the authored `docs/releases/v0.14.3.md`.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39825186184)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39825351978)
  passed. GitHub contains all **20 bundle/checksum assets** for ten extensions.
- Downloaded assets passed `mise run release:catalog v0.14.3 --dry-run`,
  including synchronized versions and every checksum. The publication plan
  selected exactly CWT, MST, SST and Zombie Shuffle; the six unchanged entries
  were skipped. Dry-run log: `/tmp/ham2k-catalog-v0.14.3-dry-run-20261022.log`.
- The catalog job returned **approved** for all four on `stable`. Public records
  show **0.14.3** as current, with release times from **17:45:45.175 through
  17:45:50.572 UTC**. Publish log:
  `/tmp/ham2k-catalog-v0.14.3-publish-20261022.log`.
- Independent public verification at **17:46:19 UTC** confirmed identical catalog
  and GitHub bundle bytes, sizes, SHA-256 hashes, asset digests and authored scoped
  notes. API-1, API-5, API-7 and API-11 discovery returns each updated contest once
  at 0.14.3. CWT/MST/SST metadata retains `dataFile` and excludes `settingsPanel`.
  RBN remains at 0.14.2; API-1 discovery retains compatible RBN 0.6.0. Evidence:
  `/tmp/ham2k-catalog-v0.14.3-public-verification-20261022.json`.
- Matching CWT changes and its updated PR description are pushed to
  [PR #1](https://github.com/ham2k/extensions/pull/1). Its head is signed source
  commit `766f8e8883206dcb8868ad71e159af91599a7220`, verified by GitHub. The
  upstream working copy is clean; target `main` remains untouched.

The preparation and source/bundle checks below remain the runtime verification
scope; publication does not establish native UI acceptance. Publication records
and synchronized versioning are personal packaging, exempt from upstream CWT
runtime synchronization.

## Release 0.14.3 preparation — 2026-10-22

Prepared synchronized version 0.14.3 and `docs/releases/v0.14.3.md` for automatic
CWT, MST and SST call-history sources and removal of their source settings.
Independent release review confirmed catalog publication selects exactly CWT,
MST, SST and Zombie Shuffle. Zombie consumes the shared downloader's revised
failure guidance; the other six extensions have no runtime changes. Root
package/lockfile changes contain only synchronized version fields, with no
dependency updates.

- `mise run release:notes v0.14.3` validated all ten sections and their scoped
  previews. The same authored document is the GitHub release body.
- `mise run format` and `mise run release v0.14.3 --dry-run` passed lint,
  strict typechecks, **1,751 tests across 123 files**, all **ten official ES2020
  builds/packages**, and all **20 bundle/checksum paths**. Log:
  `/tmp/ham2k-release-v0.14.3-dry-run-20261022.log`.
- Matching CWT behavior, translations, guide and downloader errors are pushed
  to [PR #1](https://github.com/ham2k/extensions/pull/1) in signed source commit
  `766f8e88`; GitHub verifies the signature and the PR head matches it.
  Its 135 CWT tests, root/workspace typechecks, official package and focused
  bundle harness pass. The unrelated full-harness limitation is recorded below.

Native UI acceptance remains unverified. Personal versioning and release
documentation are exempt from upstream runtime synchronization.

## Automatic call-history sources — 2026-10-22

Removed the CWT Prefill, MST call history and SST call history settings panels,
including their manifest declarations, source fields and settings readers.
Their native data-file hooks always use N1MM's call-history category and
discover the latest contest-specific entry. Legacy source overrides are ignored;
existing data-file identities, manual refresh, offline replay and last-good
cache retention remain intact. Updated active guides, CWT translations and
download errors so they no longer direct operators to the removed controls.

The preceding placement change added `section: 'activities'`; it did not
remove these panels. Verified current public host revision
[`35dd33ef`](https://github.com/ham2k/halo/tree/35dd33ef5ada5f53d4ef93f0db5e99674cfeb19e)
against live `origin/main`: the settings registry still has no Activities group.
Unrecognized sections fall back to a standalone navigation entry and an
Application Preferences category. Removing the settings hooks removes both
appearances and their extra Data Files shortcuts. The separate native data-file
entries remain available under Accounts, Services & Data Sources / Data Files.

- `mise run format` and `mise run check` passed: **1,751 tests across 123 files**,
  lint, strict typechecks, all **ten official ES2020 builds/packages**. Log:
  `/tmp/ham2k-remove-history-settings-check-20261022.log`.
- Deterministic source and bundle regressions cover absent settings hooks,
  ignored legacy URLs, native cache replay, failed refresh retention and removal.
- Mirrored CWT behavior, translations, downloader error messages, guide and
  regression coverage to the verified source checkout for
  [PR #1](https://github.com/ham2k/extensions/pull/1), based on
  `rwjblue/extensions:codex/cwt-call-history` at `f07c76fb`; target `main` was
  untouched. MST/SST-only code and general repository guidance are exempt from
  CWT synchronization. The shared downloader's error messages affect CWT, MST,
  SST and Zombie Shuffle; the CWT equivalent is synchronized upstream.
- Upstream CWT passed **135 tests**, root and workspace typechecking, official
  build/packaging and the focused build/pack/load harness. The unfiltered
  upstream bundle harness also passed CWT but failed on seven existing local
  artifact-only extension directories without manifests. Those unrelated
  directories were left intact. Focused bundle log:
  `/tmp/ham2k-cwt-settings-bundle-filtered.log`.

These are local automated checks, not a native Ham2K UI test. No version bump,
push, release or catalog submission was performed.

## Release 0.14.2 publication — 2026-10-22

Published [v0.14.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.2)
from signed main commit `eb3c0cc3eb7d0257a91e64fb782c74666e997a79` at
**13:18:33 UTC (09:18:33 US Eastern)**. GitHub verifies its signature; the
release tag resolves to that tested commit, and the published body exactly
matches the authored `docs/releases/v0.14.2.md`.

- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39785519014)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39785690707)
  passed. GitHub contains all **20 bundle/checksum assets** for ten extensions.
- Downloaded assets passed `mise run release:catalog v0.14.2 --dry-run`,
  including every synchronized version and checksum. The publication plan
  selected exactly CWT, MST, RBN, SST and Zombie Shuffle; five unchanged
  extensions were skipped, and the retired CQ WW preview remained excluded.
  Dry-run log: `/tmp/ham2k-catalog-v0.14.2-dry-run-20261022.log`.
- The catalog job returned **approved** for all five changed extensions on
  `stable`. Public catalog records show version **0.14.2** as current, with
  release times from **13:19:54.640 through 13:20:02.514 UTC**. Publish log:
  `/tmp/ham2k-catalog-v0.14.2-publish-20261022.log`.
- Public catalog bundle bytes, sizes and SHA-256 hashes match the GitHub
  archives for all five entries, and scoped notes exactly match the authored
  sections. API-1 discovery offers all four contests at 0.14.2 while retaining
  compatible RBN 0.6.0; API-5, API-7 and API-11 discovery offer all five at
  0.14.2. Actual installation and native UI were not tested.
- The matching CWT change is pushed to
  [PR #1](https://github.com/ham2k/extensions/pull/1). GitHub verifies its
  signature, and the PR head matches the source branch. No CI checks are
  registered for that branch; the local 134-test, typecheck, build and package
  results remain its validation scope.

The Activities host dependency and native UI verification limits remain as
recorded below. Personal versioning and publication records are exempt from
CWT synchronization; the extension behavior itself is synchronized upstream.

## Release 0.14.2 preparation — 2026-10-22

Prepared synchronized version 0.14.2 and the authored
`docs/releases/v0.14.2.md` after reviewing all changes since v0.14.1. Catalog
publication selects CWT, MST, SST, RBN and Zombie Shuffle. The other five
extensions retain synchronized GitHub archives without catalog resubmission;
the retired CQ WW preview remains excluded. No dependency versions changed.

- `mise run release:notes v0.14.2` validated all ten sections. An independent
  review of the catalog selection confirmed exactly the five intended entries.
- `mise run format` and `mise run release v0.14.2 --dry-run` passed lint,
  strict typechecks, **1,748 tests across 123 files**, all **ten official ES2020
  builds/packages**, and all **20 bundle/checksum paths**. Log:
  `/tmp/ham2k-release-v0.14.2-dry-run-20261022.log`.
- The matching CWT change is pushed to
  [PR #1](https://github.com/ham2k/extensions/pull/1); GitHub verifies its signature
  and the PR head matches the source branch. Upstream CWT's 134 tests,
  typechecking, build and packaging passed. Its target `main` was untouched.

The Activities host dependency and native UI verification limits remain as
recorded below. Versioning and release documentation are personal packaging,
exempt from CWT synchronization.

## Settings placement audit — 2026-10-22

Zombie Shuffle now contributes one **Zombie Shuffle** settings dialog under
`activities`, combining call-history options and the offline About content.
The editable panel key, source field, persistent settings group, last-good
history cache and native data-file identity remain unchanged. The separate
read-only About descriptor is removed. The same dialog remains reachable
from Data Files.

Audited all ten installable extensions against the installed SDK settings
contract and current public host source. CWT, MST and SST now also place their
single settings entries under `activities`; RBN uses `spotting`. Bigfoot, WRT,
RandomGram, Contest Calendar and PSK Reporter register no `settingsPanel` hooks.
Updated active navigation guides and added repository guidance for one grouped
entry per extension, preserving settings storage and appropriate Data Files
shortcuts.

The [SDK's section mechanism](https://github.com/ham2k/halo/blob/main/docs/extensions/settings.md)
opens a panel as a dialog inside a recognized host settings group. The public
[host registry](https://github.com/ham2k/halo/blob/main/app/lib/services/halo_services.dart)
has Spotting but does not yet register Activities. `activities` follows
Sebastián's explicit requested placement; the SDK's standalone navigation
fallback remains available on hosts without that group. The public docs do
not yet contain the forthcoming approved-section allowlist.

- `mise run format` and `mise run check` passed: **1,748 tests across 123 files**,
  lint, strict typechecks, and all **ten official ES2020 builds/packages**.
  Full check log: `/tmp/ham2k-settings-check-20261022.log`.
- Regression assertions cover single grouped descriptors in source and bundles,
  the combined Zombie dialog with existing offline history/source settings,
  and preserved source validation and clearing.
- Mirrored the CWT change and guide to the verified source checkout for
  [PR #1](https://github.com/ham2k/extensions/pull/1), based on
  `rwjblue/extensions:codex/cwt-call-history` at `e5af61d3`. Upstream CWT passed
  **134 tests**, typechecking, official build and packaging; `main` was untouched.
  MST/SST, Zombie and RBN changes affect only their own extensions; repository
  guidance is general monorepo documentation, exempt from CWT synchronization.

These are local source/bundle checks, not native Ham2K UI acceptance. No push,
version bump, release or catalog submission was performed.

## CQ WW preview retirement — 2026-10-21

Removed the temporary `n1rwj-cqww` workspace, including its runtime, translations,
tests, manifest, package, guide, and bundled license, after the user requested
retirement following [PR #2's closure](https://github.com/ham2k/extensions/pull/2#issuecomment-6318621185).
Updated the lockfile, repository inventory, agent instructions, publishing guide,
notices, and provenance. Historical release notes and verification records remain.

- Rebased onto main at `88abf8ee`, preserving the newer Zombie work and
  0.14.1 release records and versions.
- `mise run format` passed with no fixes.
- `mise run check` passed: **1,746 tests across 123 files**, lint, strict
  typechecks, and ES2020 builds plus official packaging for all ten remaining
  extensions. Full log: `/tmp/cqww-removal-rebased-check-20261021.log`.
- `mise run extension:list` reports ten extensions and excludes `n1rwj-cqww`.
  Build, packaging, and release/catalog selection discover those workspaces;
  no hard-coded publication list needed changing.
- The lockfile diff only removes the CQ WW workspace and its npm link.
  CWT and shared runtime/dependencies are unaffected, so no CWT synchronization
  is required. This is source/bundle validation, not native UI or on-air testing.

No release, catalog withdrawal/submission, or installed-provider change was
performed. The closed-PR maintenance automation remains paused.

## Release 0.14.1 publication — 2026-10-20

Published [v0.14.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.1)
from signed main commit `d30fda660d8aab5293b4a5b120fa9d77db032f2d` at
**17:53:52 UTC (13:53 US Eastern)**. GitHub verifies the signature, the tag
resolves to that tested commit, and the published body exactly matches the
authored `docs/releases/v0.14.1.md`.

- `mise run release v0.14.1 --dry-run` passed lint, strict runtime/test/task
  typechecks, **1,842 tests across 133 files**, and all **11 official ES2020
  builds/packages** with synchronized versions and valid checksums.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39469911220)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39470043824)
  passed. GitHub contains all **22 bundle/checksum assets**, plus the original
  PNG illustration. Downloaded assets passed
  `mise run release:catalog v0.14.1 --dry-run`.
- The catalog submitted **Zombie only** and skipped ten unchanged extensions.
  Zombie is approved/current at **0.14.1** on stable, released at
  **17:55:01.079 UTC**, and appears once in API-1 and API-7 discovery.
  Its **105,329-byte** catalog bundle matches GitHub exactly, SHA-256
  `087a241f4445ec656a8f7a41ee48f11359a6386b89a2a7770ae30c8c86b985d0`.
  Scoped notes match the authored Zombie section exactly.
- The public catalog page shows the event overview, official homepage and
  extension repository links, and loads the illustration at **320 × 320**.
  The **22,059-byte** PNG matches its generated offline module and GitHub,
  SHA-256 `4ff2447e0ac0831d234fd9f756f3a91f207760172dcf588b1386c0ea87682ab4`.
- The actual host **FormRenderer** passed a disposable Flutter widget test:
  its Markdown creates an offline MemoryImage, the native codec decodes the
  320 × 320 PNG, and the official link row sends the expected URL to the host
  callback without exceptions. Visual inspection confirmed the corrected
  colors. Test-font rendering is separate from installed-app acceptance.
  Chrome for Testing **153.0.8010.12** plus ImageMagick **7.1.2-30** regenerated
  byte-identical PNG/module output using a fresh temporary profile.
- `mise run verify-host n1rwj-zombie` accepted all **nine hooks** in the running
  **Ham2K Mac Logger (Next) 26.9.0 build 181** JavaScript kernel, SHA-256
  `f2d0d92c395558e9d98488b8ae1d6dbfccee52bc3a12b58c903c30e98e65f506`.
  This uses Node VM and simulated timer delivery, separate from native UI.
- The browser scene preview was regenerated and inspected at narrow and minimum
  sizes. Deterministic tests cover countdown start/end boundaries, offsets and
  flexible hours, cached ticks, opaque corner coverage, picker artwork,
  settings routing, late location lookups, portable calls, and history priority.
  Native suggested-value behavior was checked against host source to preserve
  edits and clearing; no new network or per-keystroke log reads were introduced.

Zombie-only runtime, artwork and guide changes do not alter CWT, CQ WW or
shared runtime behavior. Personal synchronized versioning is exempt from
upstream synchronization. Installed-app layout/entry, native scheduling and
on-air acceptance remain unverified.

## Release 0.14.0 publication — 2026-10-20

Published [v0.14.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.0)
from signed main commit `4ab275e93e5fd0e8520348595142b77d514b845f` at
**17:22:34 UTC (13:22 US Eastern)**. GitHub verifies the signature, and the
tag resolves to the tested release commit. Its body exactly matches the
authored `docs/releases/v0.14.0.md`.

- `mise run format` and `mise run release v0.14.0 --dry-run` passed lint,
  strict runtime/test/task typechecks, **1,813 tests across 130 files**, and
  all **11 official ES2020 builds/packages**, with synchronized versions and
  valid checksums. The rebased stack preserves the CQ WW reconciliation and
  all earlier BIGFOOT changes on main.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39465246487)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39465526319)
  passed. GitHub contains all **22 bundle/checksum assets**. Downloaded assets
  passed `mise run release:catalog v0.14.0 --dry-run`.
- The catalog submitted **CQ WW and Zombie only**; nine unchanged extensions
  were explicitly skipped. Both are approved/current at **0.14.0** on stable
  and appear exactly once in API-1 and API-7 discovery. Release times are
  **17:23:35.614 UTC** for CQ WW and **17:23:37.005 UTC** for Zombie.
- CQ WW's **58,870-byte** catalog bundle is byte-identical to the GitHub
  asset, SHA-256
  `c337766fb71b479394a8048a93068dad4d0bc4d4e9db6953648cb5bb0683bf8c`.
  Zombie's **77,024-byte** bundle likewise matches, SHA-256
  `de8728531901d2fe59e87069c6214555e2148cb8b01b5ff765b0157a568c9a00`.
  Catalog metadata hashes/sizes and both scoped note bodies match the archives
  and authored release sections exactly.
- `mise run verify-host` accepted all declared hooks across all 11 extensions
  in the running **Ham2K Mac Logger (Next) 26.9.0 build 181** JavaScript kernel,
  SHA-256 `f2d0d92c395558e9d98488b8ae1d6dbfccee52bc3a12b58c903c30e98e65f506`.
  This uses Node VM and simulated timer delivery, separate from native UI.

All nine CQ WW runtime/translation files were checked against the official
PR #2 source head and match. Zombie presentation and personal release packaging
do not alter CWT or shared runtime behavior. Native scene scheduling,
installed-app UI and on-air acceptance remain unverified; the panel's segment
override limitation and later spot/tuning increment remain documented.

## Zombie midnight radio club (development) — 2026-10-20

Initially implemented in the separate `zombie-graveyard` Jujutsu workspace,
based on main's synchronized 0.13.1 version. These development checks preceded
release preparation and catalog publication.

The optional `graveyard` panel combines original vector artwork, a friendly
headphone-wearing Zombie, per-band rebirth watch, four score groups, and a
Book of the Undead. Newly logged qualifying contacts receive four seconds
of visual feedback, with distinct rebirth/bonus messages. A greeting changes
only visual state. Quiet initial/visible/configuration renders and retained
record identities prevent edits, duplicates and restorations from replaying
awards. Reduced motion keeps poses static; message expiry still works.

Presentation credit comes from `scoreLog`, including native segment handling
when supplied. Queue entries use the latest qualifying contact at or before
the display clock, keep 10m and 15m separate, and exclude openings at/after
event end. Minute ticks refresh cached metadata without a log read or scoring
fold. Native Info receives an authoritative score breakdown and separately
labeled current exchange/history notes, with explicit clearing preserved.
Cached identity notes contain no current readiness or activity claims.

- `mise run format` and `mise run check` passed lint, strict runtime/test/task
  typechecks, **1,787 tests across 128 files**, and all **11 official ES2020
  builds and packages**. Versions, dependencies and shared-library ranges
  remain unchanged from main.
- Deterministic tests cover exact rebirth boundaries, future-dated contacts,
  invalid/incomplete/deleted records, leading zeros, clock-only refresh,
  midnight, edits/restoration, instance isolation, static identity escaping,
  failed-read cache invalidation, unsupported editions, and scene bounds.
- `mise run zombie:preview` generates **18 synthetic states**, JSON and a
  static SVG. Browser checks exercised every state, pose playback, narrow and
  tiny panels, and reduced motion. Narrow scenes prioritize callsign, actual
  band and countdown. Browser SVG/text are approximate, not native acceptance.
- `mise run verify-host n1rwj-zombie` accepted all **nine hooks** in the
  installed **Ham2K Mac Logger (Next) 26.9.0 build 180** JavaScript kernel,
  SHA-256 `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.
  This uses Node VM, with simulated timer delivery.

The panel API does not supply the host's canonical start/break override
timeline. Such logs show explicit guidance instead of a guessed score/watch;
native scoring, Info and exports retain canonical segment behavior. Fresh
spot lanterns and radio tuning are a later increment. This panel performs no
radio or network calls. Installed-logger UI, native animation scheduling and
on-air acceptance remain unverified.

Only Zombie and its preview/documentation changed. CWT/CQ WW behavior and
shared runtime code are unchanged, so upstream synchronization is not needed.

## CQ WW upstream reconciliation — 2026-10-20

Reconciled [CQ WW PR #2](https://github.com/ham2k/extensions/pull/2) with
upstream's official RTTY support and entry configuration. The personal preview
now shares dated activity suggestions, undeclared operator/band/power/overlay
controls, operator/profile Cabrillo headers, and CW/SSB WAE-country and
maritime-mobile scoring fixes. Existing preview category fields remain readable;
new answers and deliberate clearing take precedence without rewriting logs.

Confirmed RTTY exchanges, tentative spot multipliers, Canadian call-area
normalization, explicit corrections/clearing, RTTY sideband recognition,
single-band scoring and padded `RY` exports remain covered. Missing received
exchanges do not claim points or consume duplicates. A call-area hint is not
silently saved as a received QTH. The expanded entry header does not implement
per-contact transmitter numbers or overlay time accounting.

- Personal `mise run format` and `mise run check` passed **1,734 tests across
  124 files**, lint, strict typechecks, and all **11 ES2020 builds/packages**.
- Upstream full `npm run typecheck` and `npm test` passed **1,597 tests**,
  including **95 CQ WW tests** and **106 build/pack/load checks**.
- Runtime source and translations match across both providers. Tests cover
  legacy settings, new-setting precedence, profile fallback, dated suggestions,
  country scoring, and existing RTTY exchange/export/spot behavior.
- Initial personal checks exposed the upstream console logging assumption
  and missing profile/log seams in the test harness. These were adapted to
  the public SDK host interface; the final full checks passed.

Only CQ WW behavior changes; CWT and shared runtime/dependencies are unaffected.
Personal identity, synchronized version **0.13.1**, temporary catalog label,
PR link and provider-switching/official-release retirement guidance remain.
No release or catalog submission was performed by this maintenance run.
Validation is source and bundle coverage, not installed-app UI or on-air testing.

## Release 0.13.1 publication — 2026-10-20

Published [v0.13.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.13.1)
from signed main commit `038642cd57b71709c0f9a5c860a2c6483a2b35f9` at
**15:56:16 UTC** (11:56 US Eastern). GitHub verifies the signature as valid;
the release tag resolves to the tested commit. The published body exactly
matches the authored `docs/releases/v0.13.1.md`.

- Local format and release dry-run checks passed **1,708 tests across 122
  files**, lint, three strict TypeScript projects, all **11 official ES2020
  builds/packages**, and synchronized versions/checksums. The preparation
  record below covers **76 native component checks across 25 fixtures** plus
  the geometry audit and installed JavaScript-kernel verification.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39452802210)
  passed. Both upload and catalog jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39452967590)
  passed. GitHub has all **11 archives and 11 checksum files**; downloaded
  assets passed `mise run release:catalog v0.13.1 --dry-run`.
- BIGFOOT alone was submitted and returned **approved** on `stable`.
  The other ten extensions were skipped under the reviewed notes because
  their behavior and shared dependencies are unchanged. Their synchronized
  0.13.1 bundles remain archived on GitHub.

- Public readback confirms BIGFOOT **0.13.1 approved/current** on `stable`,
  released at **15:57:30.786 UTC**. API-7 discovery lists 0.13.1 and API-1
  discovery retains 0.12.1. Its **72,630-byte** catalog archive matches the
  GitHub bytes, sidecar, asset digest, and size; SHA-256
  `b8a8078ab8decce47fe3efdfad0bccba77ab95639ac5c560814f6fa176e6af17`.
  All 22 GitHub assets were independently downloaded and checked against
  digests/sizes and all eleven sidecars. Catalog notes match the authored
  extraction. The other ten extensions remain approved at **0.13.0**, with
  unchanged hashes/notes and no 0.13.1 catalog submission.

Only BIGFOOT UI/runtime and personal release packaging change. SDK/tools,
shared runtime, API level, and radio permission are unchanged, so CWT/CQ WW
upstream synchronization is exempt. Cached native component and simulated
radio tests do not establish installed-app or on-air acceptance; no running
logger, operation log, host dependency, or radio was modified.

## BIGFOOT CAT availability (v0.13.1 preparation) — 2026-10-20

The existing forest reads the selected CAT radio before offering Tune. A
connected, fresh, usable radio shows Tune; connection in progress shows
Connecting…; disconnected, unavailable, stale, transmitting, and untunable
states show Manual tuning. Callsign/frequency remain visible, and letter or
bonus controls use selection-only events when CAT is unavailable. The journal
status is static text without a hidden tuning hit target.

Read-only availability checks run at most once per five real seconds while
the native forest has a fresh station lead, including while using the app's
time-travel clock. They reuse held log/board snapshots. Native visibility gates
pause renders while the pane/app is hidden and refresh on return. No dedicated
radio-change trigger exists, so spot updates alone cannot replace this polling.
Generation guards discard late radio responses; per-placement/operation state
prevents cross-panel leakage. A cached manual state rejects old tuning events.
Ready clicks retain the adapter's fresh radio read, pinned identity, readiness
checks, and supported-mode selection. The event's authoritative render rereads
availability after a tuning attempt.

- `mise run format` and `mise run release v0.13.1 --dry-run` passed **1,708
  tests across 122 files**, lint, three strict TypeScript projects, and all
  **11 official ES2020 builds/packages** with matching synchronized versions.
- Coverage includes **53 radio adapter/availability cases**, **15 direct scene
  cases**, real-clock polling without repeated log/spot reads, manual selection
  without commands, late availability reads, and actual bundled SDK behavior
  when a connection drops between displaying Tune and clicking it.
- One first full-suite run, concurrent with native QA, timed out at five seconds
  in the unchanged RBN bundle test. All three RBN bundle cases passed in the
  targeted rerun, and the subsequent full release check passed unchanged.
- `mise run verify-host n1rwj-bigfoot` accepted all eight hooks in installed
  **Ham2K Mac Logger (Next) 26.9.0 build 180**'s JavaScript kernel under Node VM.
- The cached Flutter **3.44.9** native host harness passed **76 parser, widget,
  and movement checks across 25 fixtures**, with normal/reduced motion. A
  further **59 geometry/status assertions** verify in-bounds 44×44 controls,
  static unavailable status, and no tuning events in manual/connecting states.
  Native narrow/tiny ready/manual/connecting captures are readable without
  clipping or overlap. Host dependency lock/config hashes are unchanged.

Only BIGFOOT runtime/UI and personal release packaging change. SDK/tools,
shared runtime workspaces, manifest API 7, and radio-write permission remain
unchanged. This is exempt from CWT/CQ WW upstream synchronization. The authored
`docs/releases/v0.13.1.md` selects BIGFOOT alone for catalog submission; other
extensions advance only in the synchronized GitHub archive. No installed-app
or real-radio operation was performed, so on-air acceptance remains unverified.

## Release 0.13.0 publication — 2026-10-20

Published [v0.13.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.13.0)
from signed main commit `a81b0015608811fbae171f0f74dca072b89014b2` at
**15:17:04 UTC** (11:17 US Eastern). GitHub verifies the signature as valid;
the release tag resolves to the tested commit. The release body exactly
matches the authored `docs/releases/v0.13.0.md`.

- Local format and release dry-run checks passed **1,682 tests across 122
  files**, lint, three strict TypeScript projects, all **11 official ES2020
  builds/packages**, and synchronized versions/checksums. The preparation
  record below details **64 native component checks across 21 fixtures** and
  installed build-180 JavaScript-kernel verification.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39446865405)
  passed; both upload and catalog jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39446976763)
  passed. GitHub has all **11 archives and 11 checksum files**. Downloaded
  assets passed `mise run release:catalog v0.13.0 --dry-run`; independently
  downloaded bytes match their sidecars, GitHub digests, and sizes.
- All eleven catalog submissions returned **approved** on `stable` at about
  **15:18 UTC**. Root SDK/tools dependency updates select every consumer;
  release-note extraction includes each extension's own section and the
  universal shared section.

- Public readback confirms all eleven **0.13.0** versions are current and
  approved on `stable`, released between **15:18:10.957 and 15:18:30.452 UTC**.
  Every catalog archive matches its GitHub archive byte for byte, and every
  scoped release note matches the authored extension/shared extraction.
  API-7 discovery lists BIGFOOT **0.13.0**; API-1 discovery retains compatible
  **0.12.1** instead. BIGFOOT's new archive is **71,999 bytes**, SHA-256
  `4d382a0d5a24c121ce40220b4cdfa813ad450ed0cf7437bb2a03544b96403424`.

BIGFOOT's radio requests require API 7 and radio-write permission. Callsign
entry remains manual. Component/kernel tests and simulated radio responses
are separate from installed-app and on-air radio acceptance, which remain
unverified. The running logger, operation log, radio, host source, and host
dependencies were untouched. CWT/CQ WW SDK coverage is synchronized to their
verified official PR source branches; BIGFOOT UI and personal packaging are
exempt from that synchronization.

## BIGFOOT integrated spots (v0.13.0 preparation) — 2026-10-20

Cached station leads are integrated into the existing Hunt forest, preserving
its saved panel key. Teal letter/bonus beacons and Bigfoot's journal show the
newest valid report per callsign; the selected hunt mode and native Spots
filters apply by default over 15 minutes. Settings offer all cached reports
and 5/30-minute windows. No separate spots panel is registered. Gold earned
letters and Mixed-only dots are unchanged; only the next missing O is marked.

The journal and sufficiently large letter tiles request radio tuning on an
explicit click. The adapter reads the selected radio, pins its identity, converts
kHz to Hz, and requests only supported suitable modes. Otherwise it requests
frequency alone with manual-mode guidance. Missing/disconnected/stale radios,
transmission in progress, identity changes, and refused commands have explicit
feedback. SDK request acceptance does not establish final hardware tuning.
The SDK cannot populate the logger draft, so callsign entry remains manual.
BIGFOOT now declares **API 7** and **requiresRadioWrite**; other API levels and
all shared-library compatibility ranges are preserved.

Exact-roster matching splits merged calls and excludes malformed, mismatched
frequency/band, stale, future, and unsupported reports. Latest-per-call choice
precedes hunt-mode filtering, so a mode change cannot resurrect an old frequency.
Needed status uses this operation's contacts and the app's current UTC date,
including both O rules. Spot age uses the display clock; animation uses real time.
Spot/minute refreshes reuse the successful log snapshot, animation ticks reuse
the held board, and log/operation changes invalidate cached contacts before
asynchronous reads. Generation guards discard late responses. Expiry cannot
silently redirect a displayed Tune action to another station; same-target
refreshes during tuning preserve the result. No logger write, network fetch,
PTT, or keying is added.

- `mise run format` and `mise run release v0.13.0 --dry-run` passed **1,682
  tests across 122 files**, lint, three strict TypeScript projects, and all
  **11 official ES2020 builds/packages** with synchronized versions/checksums.
  Coverage includes UTC midnight, mode families, exact O credit, malformed data,
  host options, ageing, corrections/deletions, placement isolation, races,
  explicit radio actions, readiness/refusal paths, radio identity, supported
  modes, unit conversion, geometry, and reduced motion.
- The complete bundled sandbox renders integrated spots and exercises the
  actual SDK readRadio/setRadio bridge with simulated responses. There are
  **37 injected radio-adapter cases** and **10 direct scene cases**.
- `mise run verify-host n1rwj-bigfoot` accepted all eight hooks in installed
  **Ham2K Mac Logger (Next) 26.9.0 build 180**, kernel SHA-256
  `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.
  This evaluates the installed JavaScript kernel under a Node VM; it does not
  drive the installed app or a radio.
- `mise run bigfoot:preview` produces **21 synthetic states**, including
  desktop/narrow/tiny spots, unavailable radio, W7O, and W4S. The preview task
  bundles the updated SDK's sandbox JSON imports for Node. Browser previews
  at **560×660** and **280×300** show readable leads and 44px tune targets.

- An external harness using cached **Flutter 3.44.9** and the actual host
  `PanelContent.fromJson` / `PanelSceneView` passed **64 parser, widget, and
  movement checks across all 21 fixtures**, with normal and reduced motion.
  Native desktop/narrow/tiny, disconnected, repeated-O, and W4S screenshots
  show readable calls/frequencies, 44px controls, and no overflow or clipping.
  The tiny outcome line deliberately ellipsizes; its accessible label retains
  the full message. Host dependency lock/config hashes are unchanged.

The root SDK moves **0.12.0 → 0.12.13** and tools **0.8.0 → 0.13.0**. These
universal dependency changes select all eleven extensions for catalog release.
The SDK's incomplete-call scoring behavior has matching CWT/CQ WW regressions.
SDK pins, tests, and relevant docs are pushed to verified upstream PR source
branches: [CWT PR #1](https://github.com/ham2k/extensions/pull/1),
`codex/cwt-call-history` at `e5af61d3dc887f6d2cd7ae76a81e7967791a160f`, and
[CQ WW PR #2](https://github.com/ham2k/extensions/pull/2), `codex/cqww-rtty`
at `a3cae6b266f3a7b7647599459515e6a1ffc0c6a1`. GitHub verifies both signatures.
CWT passes **133 extension tests**, typecheck/build/package and **100 bundle
checks**; CQ WW passes **69 extension tests**, typecheck/build/package and
**101 bundle checks**. Other upstream consumers retain their locked SDKs.
BIGFOOT-only UI and personal release packaging are exempt from synchronization.

The running logger, operation log, and radio were not modified. Installed-app
and on-air acceptance remain unverified.

## Release 0.12.1 publication — 2026-10-20

Published [v0.12.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.12.1)
from signed main commit `923c9f71ebe9c4ed69f90b0cfaf789a4ec202600` at
14:13:05 UTC (10:13 US Eastern on October 20). GitHub verifies its signature;
the tag resolves to that tested commit. The release body matches the authored
`docs/releases/v0.12.1.md` exactly.

- Local `mise run format` and `mise run release v0.12.1 --dry-run` passed
  lint, strict typechecks, **1,604 tests across 118 files**, all **11 official
  ES2020 builds and packages**, and synchronized versions/checksums.
  `mise run verify-host n1rwj-bigfoot` accepted all eight declared hooks in
  the installed build-180 kernel. Native picker component checks are recorded
  below and remain separate from installed-logger UI and on-air acceptance.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39436993370)
  passed. The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39437234680)
  passed all checks, then failed during GitHub asset upload with **HTTP 404**.
  CQ WW and Calendar bundle/checksum pairs and a BIGFOOT checksum had uploaded;
  the BIGFOOT archive had not. The dependent catalog job was skipped.
- Recovery preserved both complete CI pairs byte for byte. The orphaned
  BIGFOOT checksum was removed, and the nine missing pairs were uploaded from
  the tested, unchanged release checkout. GitHub now has **11 bundles, 11
  checksums, and the native preview image**. Downloaded assets passed
  `mise run release:catalog v0.12.1 --dry-run`; the actual local catalog task
  then submitted BIGFOOT alone and returned **approved**. No complete
  published archive or matching checksum was overwritten.
- Public catalog readback confirms BIGFOOT **0.12.1 approved** on `stable`
  at **14:17:34.217 UTC**. API-1 and API-5 queries both list it. Description
  and ordered keywords match the manifest; scoped notes exactly match the
  BIGFOOT-only extraction. The **66,031-byte** catalog and GitHub archives
  are identical, with SHA-256
  `292bc3d537a5337e91634870b1d7e30a03f639b7b021b0f92c8f7fd905da6540`
  matching catalog metadata and the published checksum.
- The public native panel-picker PNG matches the local capture:
  **69,214 bytes**, SHA-256
  `46d662a5bf582c72002ff0ac8ccd957878a258f9c49c0b338af267cebbccb19d`.

Only BIGFOOT presentation and preview tooling changed. The synchronized
version bump does not alter shared runtime behavior or dependencies and is
exempt from CWT/CQ WW upstream synchronization. The installed app, operation
log, host dependencies, and tracked host source were untouched.

## BIGFOOT catalog presentation (v0.12.1 preparation) — 2026-10-20

The extension now advertises the animated forest in the plain-text
Extensions catalog description with 🌲🐾/🦨 emoji, CW/Mixed letter tracking,
and search keywords for the event and forest. The name, key, paw icon,
forest-green accent, and API-1 compatibility remain unchanged. Catalog rows
render plain text with emoji fallback; they do not support manifest images
or Markdown descriptions.

The **Add a Panel** descriptor also has a friendly description and a static
**640×640** SVG illustration: Bigfoot waving in the forest, seven uniform
letter tiles, the Skunk Ape, sparkles, and footprints. Path-drawn lettering
works in the host's font-free SVG renderer. The art is decorative and contains
no logged-progress claims, timers, external images, or network resources.
The existing `hunt` panel key and live progress behavior are preserved.

- `mise run format` and `mise run check` passed: **1,604 tests across 118
  files**, strict runtime/test/task typechecks, lint, and all **11 official
  ES2020 builds and packages**. Descriptor tests cover offline SVG delivery;
  the bundled sandbox returns the preview without reading the operation log.
- `mise run verify-host n1rwj-bigfoot` accepted all eight declared hooks in
  the installed **Ham2K Mac Logger (Next) 26.9.0 build 180** JavaScript kernel.
- A temporary harness used the actual host `LayoutSheet` and `flutter_svg`
  renderer. The **40×40** thumbnail opens the **320×320** preview without
  adding the panel. Native rendering produced no decode errors or Flutter
  exceptions; gradients, vector letters, and both characters rendered correctly.
  The bundled emoji font contains 🌲, 🐾, and 🦨. Emoji fallback was checked
  against host source; Flutter test captures have a documented color-font
  limitation, so they establish SVG rendering rather than emoji appearance.
- `mise run bigfoot:preview` also exports the standalone illustration as
  `dist/bigfoot-scene-preview-panel.svg`. The actual native preview capture is
  `dist/bigfoot-panel-preview-native.png`; these local evidence files are ignored.

These checks preceded v0.12.1 publication. The approved v0.12.0 bundle
and catalog notes were not modified. The installed logger, operation log,
host dependencies, and tracked host source were untouched. Only BIGFOOT
presentation and preview tooling changed, exempt from CWT/CQ WW upstream
synchronization; dependencies and shared runtime behavior are unchanged.

## Release 0.12.0 publication — 2026-10-20

Published [v0.12.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.12.0)
from signed main commit `3e63b7205656150161205c65846112b9b92c7aaa` at
13:54:47 UTC (09:54 US Eastern on October 20). GitHub verifies the release
commit signature; the tag resolves to that tested commit. Its release body
matches the authored `docs/releases/v0.12.0.md` exactly.

- `mise run format` and `mise run release v0.12.0 --dry-run` passed lint,
  strict typechecks, **1,604 tests across 118 files**, all **11 official
  ES2020 builds and packages**, and synchronized versions/checksums.
  `mise run verify-host n1rwj-bigfoot` accepted all eight declared hooks in
  the installed build-180 JavaScript kernel. The separate **46 native scene
  component checks** remain documented below.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39434301709)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39434533441)
  passed. GitHub contains **11 bundles, 11 checksums, and the animation demo**.
  Downloaded assets passed `mise run release:catalog v0.12.0 --dry-run`,
  which selects BIGFOOT alone and skips the ten unchanged extensions.
- BIGFOOT is **approved** and current at 0.12.0 on `stable`, with release
  time **13:55:56.702 UTC**. Public catalog API-1 and API-5 queries both list
  it. Its **65,103-byte** catalog bundle is byte-identical to the GitHub
  archive, with SHA-256
  `196e58a862d02b31cd1f5f5af7f4a23fe21a8edc1887010ede15bea7c7744e9f`
  matching catalog metadata and the published checksum. Catalog notes exactly
  match the BIGFOOT-only extraction from the authored release document.
- The public **560×660** native demo GIF is byte-identical to the verified
  local capture: **2,638,110 bytes**, SHA-256
  `711b30e6e29dbc7bec485b60dc0839afdb015caafd69661d2794e036d1cfb3ab`.
  It loops a synthetic scene-component demonstration; the actual panel
  celebrates each newly earned credit once.

The release includes the Info display and forest scene without changing
event rules, exports, dependencies, or shared runtime code. Synchronized
personal versioning does not require CWT/CQ WW upstream synchronization.
The new extension was not installed in the running logger during this work;
native component checks and kernel execution are separate from
installed-logger UI and on-air acceptance.

## BIGFOOT forest scene (v0.12.0 preparation) — 2026-10-20

The existing `hunt` panel now returns an original vector forest scene when
the host supplies a panel environment, preserving its saved panel key. CW
remains the default focus, with Mixed counts, explicit O₁/O₂ tiles, a gold-dot
legend for Mixed-only letters, and a separate W4S card. Panel settings retain
the detailed Markdown checklist and add a motion switch. Hosts without an
environment retain the original checklist automatically.

New qualifying letters trigger a four-second, two-hop celebration with arm
waving and letter sparkles; completion adds stars and W4S animates its own
bonus. A manual greeting changes only visual state. Quiet initial renders,
raw-record identity plus rules-based credit comparisons, and per-instance /
per-operation state prevent awards for repeats, edits, deletion/restoration,
mode changes, or reopening. Animation ticks use cached contacts and stop
after four seconds. System reduced motion or the motion preference disables
transitions, native opacity pulses, and animation ticks; earned feedback
remains static until another render.

The scene uses the API-1-compatible `svgScene` contract with native text,
SVG artwork, numeric bindings, transitions, pulses, and a drawn button. It
does not use API-5 strings, native controls, or layout fields. The manifest
compatibility range is unchanged. Artwork contains no external images,
fonts, DOM, scripts, or network access.

- `mise run format` and `mise run check` passed: **1,604 tests across 118
  files**, lint, strict runtime/test/task typechecks, and all **11 official
  ES2020 builds and packages**. New controller and panel integration tests
  cover earned feedback, a CW/Mixed split second O, finite ticks with no log
  reads, manual greetings without credit, reduced motion, and isolation.
  The bundled sandbox test also exercises the scene, greeting, and expiry.
- `mise run verify-host n1rwj-bigfoot` accepted all eight hooks in the
  installed **Ham2K Mac Logger (Next) 26.9.0, build 180** JavaScript kernel.
- `mise run bigfoot:preview` generates **15 synthetic scene states** as an
  interactive HTML state browser plus companion JSON. Browser checks cover
  state selection and show no page errors. Browser SVG text and pose playback
  are an approximation, not native rendering acceptance.
- A temporary harness in the separate host checkout passed **45 native
  parser/widget checks plus one movement test**, using the actual
  `PanelContent.fromJson` and `SvgSceneView` with real bundled fonts. All 15
  fixtures fit, including **280×300**, **320×620**, and **480×380** layouts;
  no text clipping, broken SVGs, bounds failures, or Flutter exceptions were
  observed. The movement test checks a stable scene key across target poses,
  real movement, and rest after four seconds, with zero host actions.
- The host supplies `environment.version: 1` and `instanceId` to panel render
  calls independently of manifest API, so this scene path works for API-1
  extensions on a scene-capable host. The native test confirms component
  rendering and transitions, not end-to-end logger scheduling.

Ignored local evidence includes `dist/bigfoot-scene-preview.html`, its JSON,
and `dist/bigfoot-scene-demo.gif`: a **560×660**, **46-frame**, **10 fps**
capture of the actual Flutter renderer. The GIF loops a synthetic letter
celebration for demonstration; the live panel only animates a newly earned
credit once. Native PNG captures include idle, narrow, compact, completion,
and tiny states. The running app, its operation log, host dependencies, and
tracked host source were untouched.

These checks preceded v0.12.0 publication and did not install the development
bundle in the running logger. The scene and preview tooling affect only
BIGFOOT, so CWT/CQ WW upstream synchronization is not required.

## BIGFOOT Info display (v0.12.0 preparation) — 2026-10-20

Enriched the built-in Info pane's two existing views without changing the
panel layout or extension API. Target notes now include 🌲🐾 event identity,
🔤 letter or 🦨 bonus details, a calendar row, and separate ⭕/🔁/📻 second-O
guidance. Compact station markers remain unchanged, and cached lookup notes
contain no current needed/worked claims or extra log/network reads.

The idle-call Info score summary puts 📻 CW and 🧩 Mixed progress first,
shows ✅ worked/🔎 needed independently for every letter and both O slots,
keeps the 🦨 bonus separate, and celebrates each completion only when earned.
The native numeric tally still counts Mixed letters and labels that scope
explicitly. Phone/Digital totals and the all-CW second-O rule remain visible.

- `mise run format` and `mise run check` passed: **1,579 tests across 116
  files**, strict typechecks, lint, and all **11 official ES2020 builds and
  packages**. Regression cases cover a CW/Mixed split O pair, same-context
  repeats, Mixed-only completion, CW completion without the bonus, and bonus
  deletion without false letter or completion credit.
- `mise run verify-host n1rwj-bigfoot` accepted the eight declared hooks in
  the installed **Ham2K Mac Logger (Next) 26.9.0, build 180** kernel.
- Host-source review confirms that operation score details use Markdown with
  emoji font fallback. Callsign Notes use spaced rows of inline Markdown
  with emoji fallback. The two views replace each other in Info; an empty
  operation has no cached score summary until its first contact is scored.

These are source, unit, bundle, and installed-kernel checks; the new development
bundle was not installed into the running logger and native visual verification
remains pending. The changes are not in published v0.11.1. Only BIGFOOT display
code changed, exempt from CWT/CQ WW upstream synchronization.

## Release 0.11.1 publication — 2026-10-19

Published [v0.11.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.11.1)
from signed main commit `d650e096bf17e7db1b5ab47031de7caae9424f27` at
02:04:42 UTC on October 20 (22:04 US Eastern on October 19). GitHub verifies
the feature and release-preparation signatures; the tag resolves to the
tested release commit.

- `mise run format` and `mise run release v0.11.1 --dry-run` passed lint,
  strict typechecks, **1,575 tests across 115 files**, all **11 official
  ES2020 builds and packages**, and synchronized versions/checksums.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39356849375)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39356948313)
  passed. GitHub contains all 11 archives and 11 checksum files. Its release
  body matches `docs/releases/v0.11.1.md` exactly.
- `mise run release:catalog v0.11.1 --dry-run` downloaded and validated all
  published assets and selected BIGFOOT and RBN alone. The other nine
  extensions were skipped because their behavior is unchanged.
- BIGFOOT and RBN are **approved** and current at 0.11.1 on `stable`, with
  catalog release times of 02:05:48.723 and 02:05:51.039 UTC, respectively.
  BIGFOOT 0.11.1 is discoverable by API-1 and API-5 hosts; RBN 0.11.1 is
  discoverable by API-5 hosts. API-1 listings retain the older compatible RBN.
- Downloaded catalog bundles equal the GitHub assets byte for byte, and their
  hashes match catalog metadata and GitHub checksum files. BIGFOOT is
  53,414 bytes, SHA-256
  `131776033917f702d8a7cd12b4499795ac0d8ace73afb6d9042eea4a2e8161d1`;
  RBN is 319,702 bytes, SHA-256
  `3707e23524c6395f4038f83e9c916fcbb0f1be1e20825141fd291f19679bbfc8`.
  Catalog notes match the corresponding authored sections exactly.

BIGFOOT 0.11.1's eight declared hooks also activated in the installed build
180 JavaScript kernel. These checks do not establish native UI or on-air
acceptance. BIGFOOT/RBN-only behavior and personal release records do not
require CWT or CQ WW upstream synchronization.

## Release 0.11.1 preparation — 2026-10-19

Added exact-roster paw/skunk annotations for the selected 2026 event and
native scoring highlights for contacts that advance Mixed, CW, or the
candidate's actual-mode progress. The second W7O requires a different band,
canonical actual mode, or UTC date; completing Mixed on SSB does not hide
the independent CW opportunities. W4S remains a separate bonus.

RBN now calls its optional list selector **Station filter**. Choosing
**BIGFOOT 2026** limits RBN Spots to the seven published calls, including
worked targets. All calls remains the default, selection is explicit and
persists across operations, and removing a selected provider fails closed.
The bundled roster requires no history download and implies no live schedule.

- `mise run format` and `mise run check` passed: **1,575 tests across 115
  files**, lint, strict runtime/test/task typechecks, and all **11 official
  ES2020 builds and packages**.
- Source and bundle tests cover target markers, event guards, explicit
  callsign corrections/clearing, second-O eligibility, independent same-mode
  credit, held checkpoints, unrelated calls, edits, last-contact deletion,
  provider registration, exact roster filtering, selection persistence, and
  unavailable-provider behavior.
- `mise run verify-host n1rwj-bigfoot` accepted all eight declared hooks in
  the installed **Ham2K Mac Logger (Next) 26.9.0, build 180** kernel, SHA-256
  `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.

Host-source review confirms that native Spots caches station markers and
the logging UI caches lookup notes within a compose session. Progress is
therefore supplied through native scoring (`newMult`, displayed as **New
Mult**) and the BIGFOOT panel. Lookup annotations contain stable target
identity and the second-O rule, with no added log or network reads. The host
skips batch scoring for an empty log but invalidates its prior checkpoint;
live/spot scoring then reads the current empty log correctly.

Installed-kernel checks run under Node VM; native UI and on-air use remain
unverified. Version 0.11.1 is synchronized across all workspaces, and
`docs/releases/v0.11.1.md` selects BIGFOOT and RBN alone for catalog submission.
The preparation checks do not publish a release or catalog update.
Only BIGFOOT and RBN behavior changed, so CWT/CQ WW upstream synchronization
is exempt. No shared contest or private filter-protocol behavior changed.

## Release 0.11.0 publication — 2026-10-19

Published [v0.11.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.11.0)
from signed main commit `0ad5eb3f20388db8586c5bb5b8d0470316456dc3` at
01:26:56 UTC on October 20 (21:26 US Eastern on October 19). GitHub verified
the commit signature, and the release tag resolves to that tested commit.

- `mise run format` and `mise run release v0.11.0 --dry-run` passed lint,
  strict typechecks, **1,536 tests across 112 files**, and all **11 official
  ES2020 builds and packages**, with synchronized workspace versions.
- The [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39353375558)
  and both jobs in the
  [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39353479450)
  passed. All 11 archives and 11 SHA-256 files are available.
- `mise run release:catalog v0.11.0 --dry-run` downloaded the published
  assets and validated every checksum and version. The GitHub release body
  matches `docs/releases/v0.11.0.md` exactly.
- The catalog reports **approved** on `stable` for BIGFOOT at 01:27:56.619 UTC
  and Zombie at 01:27:57.884 UTC. Both are current at 0.11.0 and discoverable
  in API-1 and API-5 listings. The other nine extensions were explicitly
  skipped because there were no extension-specific or shared changes.
- Downloaded catalog bundles match the corresponding GitHub assets byte for
  byte, and inline catalog notes match the authored extracted sections exactly.
  BIGFOOT is 51,307 bytes, SHA-256
  `a3cfb0eee3f5cc3e3e01f5962d972a84ad4ae1032a4718eac0757c42bcf114f6`;
  Zombie is 59,907 bytes, SHA-256
  `1d007b1f9427aa487ed360ec3c501ddd07f34ae5b3b4888c39ff39501f6eefec`.

The installed build 180 JavaScript kernel accepted all 11 extensions during
integration verification. Native UI, multiword Zombie entry, export save/share
behavior and on-air acceptance remain unverified. The new independent
extensions and synchronized packaging do not change CWT or CQ WW behavior,
so no upstream behavior synchronization was required.

## BIGFOOT and Zombie main integration — 2026-10-19

Integrated BIGFOOT Hunt and Zombie Shuffle with the current main branch,
preserving RandomGram, Contest Calendar, and the existing extensions. Both new
extensions now use the synchronized development version 0.10.0.

- `mise run format` and `mise run check` passed: **1,536 tests across 112
  files**, lint, strict runtime/test/task typechecks, and all **11 ES2020
  builds and official packages**.
- `mise run verify-host` activated all declared hooks across all 11 extensions
  in the running **Ham2K Mac Logger (Next) 26.9.0, build 180** JavaScript kernel,
  with no compatibility problems. Kernel SHA-256:
  `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.

Installed-kernel verification runs under Node VM; native UI and on-air use
remain unverified. This integration does not publish a release or catalog
update. The historical implementation results below describe the earlier
0.8.1 base; the combined checks above pass on the integrated main branch.

## Zombie Shuffle implementation (unreleased) — 2026-10-19

Added `n1rwj-zombie`, an independent contest extension for the confirmed
October 30, 2026 event. Native RST fields accompany SPC, a fixed numeric-text
Zombie number, and a full spooky name. Sent exchanges are captured in
`our.zombie`, using the supported one-level `our` patch, and remain unchanged
when setup is edited later. The activity registers under its extension key
for scoped search; it does not depend on newer host support for ref patches.

The scorer uses two elapsed hours per callsign and actual band, including
separate 10m/15m duplicate history. Score groups combine 10m/15m, as in both
official 2026 spreadsheets. Eligible repeat bonus contacts count again, and
the fixed 666 points begin with the first eligible QSO. These interpretations
and the absence of a confirmed 2026 submission deadline are documented in the
[operator guide](../extensions/contests/n1rwj-zombie/README.md).

Initial implementation validation on the 0.8.1 base passed:

- `mise run format` and `mise run check`: **1,313 tests across 101 files**,
  lint, strict runtime/test/task typechecks, nine ES2020 builds, and official
  packaging. Zombie contributes **66 tests across eight files**.
- Deterministic coverage includes the exact two-hour boundary, chronological
  ordering, held checkpoints, live drafts/spots, edited-contact exclusion,
  event hours and UTC offsets, activity segments, empty/incomplete logs,
  sent snapshots, explicit clearing, multiword values, ADIF, and summaries.
- A live refresh through the shared N1MM downloader and Zombie parser used
  three HTTP requests and loaded the 1,533-byte `ZOMBIE_004.txt`, file date
  **2025-10-18**, with **66 calls and zero parser warnings**. Only the four
  obsolete `3333` suggestions were omitted (AB9CA, N0MII, N2TNN, VE3MGY);
  WB2JNA's `002` remained intact.
- Live discovery exposed that N1MM's unfiltered first page omitted the old
  annual file. The Zombie-only default now searches `ZOMBIE` before pagination,
  sorted newest first. Saved category URLs receive the same search, while
  selected entry/text URLs remain unchanged. Regression tests cover this case.
- `mise run verify-host n1rwj-zombie`: all seven declared hooks activated in
  the installed **Ham2K Mac Logger (Next) 26.9.0, build 180** kernel, SHA-256
  `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.

Host-source inspection confirms that Space advances native inline fields.
SPC and Zombie name therefore declare supported `_`-to-space transforms,
applied after the native Space formatter. Guidance explains typing
`NEW_ZEALAND` or `OLD_NICK`; pasting ordinary spaces is also supported by
that formatter. Tests follow the declared transform through save and ADIF.
This is source/contract verification, not an actual device keyboard test.

Native installation, transformed/pasted input, export save/share behavior,
spot refresh at the rebirth boundary, and on-air use remain acceptance work.
The local bundle is in `dist/` and is not published or submitted to the catalog.
The extension is now aligned with main's development version 0.10.0. No
dependencies or shared-library ranges changed; the root lockfile only adds
the new workspace.
Existing CWT/CQ WW runtime and shared adapters are unchanged, so this extension
and its documentation are exempt from their upstream synchronization rules.

## BIGFOOT Hunt implementation (unreleased) — 2026-10-19

Added the standalone `n1rwj-bigfoot` activity with the confirmed 2026 event
window, seven letter slots, a separate W4S bonus, independent CW/Phone/Digital/
Mixed progress, and actual-mode breakdowns for digital contacts. The second O
requires distinct contacts differing in band, normalized mode, or UTC date.
Progress is derived from the dedicated operation's log, including corrections
and deletions. Exports provide eligible event QSOs as ADIF and a CSV worksheet
with the selected Mixed/CW letter slots and the actual sent/received reports.

Initial implementation validation on the 0.8.1 base passed:

- `mise run test`: **1,247 tests across 93 files**, including six BIGFOOT test
  files covering pure rules, activity setup, scoring checkpoints/live/spot
  candidates, panels, exports and bundled ES2020 execution.
- `mise run typecheck`: strict runtime, test and task TypeScript checks.
- Scoped Biome checks for the new extension and changed documentation.
- `mise run pack`: all eight extensions built and passed official packaging.
- `mise run verify-host n1rwj-bigfoot`: all six declared hooks activated in
  the installed **Ham2K Mac Logger (Next) 26.9.0, build 180** JavaScript kernel.
  Its SHA-256 is
  `21eaa53e90efa10d8599da19b0140d2344211f5bafd6add9f55d04c4a53c507a`.

The scaffold initially required LiquidJS `^10.30.0`; this new extension uses
the repository's existing `^10.28.0` host contract, verified against build
180's 10.28.0. No existing extension's dependency ranges were changed.
Actual host-source inspection confirms that logging, edits and deletions
refresh operation data and trigger panel refreshes. The panel requests
`operation` and `qsoLogged`, with no per-keystroke full-log read or timer.

`mise run format` applied the source formatting, and `mise run check` was
attempted. Both remain blocked by **five pre-existing lint errors** in
`output/contest-calendar/desktop-proposals.html` (four ARIA-role errors and
one returning `forEach` callback). That unrelated prototype was preserved
byte-for-byte, SHA-256
`c8841e736d4d0e0e9f43b5b563b2e99aabc0d5cf93f1efcd13c99a465a64108e`.
The test, typecheck and packaging tasks were then run independently to
completion.

This is unit, bundle and installed-kernel verification. Native installation,
UI layout/save/share behavior and on-air use remain unverified. The extension
is now aligned with main's synchronized development version 0.10.0; the local
BIGFOOT bundle has not been released or submitted to the catalog. This
independent activity and its documentation are exempt from CWT and CQ WW
upstream synchronization.

## Release 0.10.0 publication — 2026-10-14

Published [v0.10.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.10.0)
from signed main commit `3c3d01c675294219220d801fe4b63bbc68fc151e` at
23:58:38 UTC (19:58 US Eastern). GitHub verified the commit signature, and
the release tag resolves to that same tested commit.

- Local `mise run format` and `mise run release v0.10.0 --dry-run` passed
  lint, strict typechecks, 1,415 tests across 98 files, nine official builds
  and nine package validations. The
  [check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/38657216936)
  passed for that commit.
- The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/38657304288)
  passed both GitHub upload and catalog jobs. All nine bundles and nine
  checksum files are archived. Downloaded GitHub assets passed
  `mise run release:catalog v0.10.0 --dry-run`; the published body matches
  `docs/releases/v0.10.0.md` exactly.
- The catalog returned **approved** for `n1rwj-randomgram` 0.10.0 on
  `stable` at 23:59:36 UTC. The eight existing extensions were skipped as
  specified by the reviewed no-change sections. No universal dependency or
  shared runtime changes accompany this release.
- The [public RandomGram entry](https://catalog.ham2k.net/extensions/n1rwj-randomgram?channel=stable)
  reports 0.10.0 as approved and current. The `stable` catalog query for API 5
  contains one matching entry. Its 55,957-byte archive is byte-for-byte equal
  to the GitHub bundle and published checksum, with SHA-256
  `cc8c7130ebc434d2eb146a8e8039df0535a03597d0e89d1b77ff185bc533d415`.
  Catalog notes match the authored RandomGram section exactly. Downloaded
  evidence is retained under ignored `dist/catalog-verification/`.

RandomGram runtime behavior is the same implementation tested in the native
Mac acceptance below; the release changes its version and packaging. Phone
layout, actual CW transmission and multi-device recovery remain unverified.
RandomGram and synchronized personal release packaging do not require changes
to the temporary CWT or CQ WW upstream PRs.

## RandomGram native acceptance retry — 2026-10-14

Installed and enabled the local RandomGram preview in **Ham2K Power Logger
(Next) 26.9.0 build 179** using Mac Control, then exercised a separate operation
named **N1RWJ RandomGram TEST — synthetic RG#999**. The operation contains
three synthetic contacts and three event markers; no on-air contacts or keyer
transmissions were made. The preview remains unreleased at synchronized version
0.9.0 in the `ham2k-n1rwj-extensions-randomgram` Jujutsu workspace.

The rebuilt package is `dist/n1rwj-randomgram-0.9.0.h2kext`, SHA-256
`e1487439c6b3f757b26ec99a12edf546a6a2b7c8fff590fbd4a8e96eee613789`.
`mise run format` and `mise run check` passed lint, strict runtime/test/task
typechecks, **1,415 tests across 98 files**, nine official ES2020 builds and
nine validated packages. RandomGram contributes **151 tests across five files**.
These automated checks are separate from the native acceptance below.

- A full synthetic organizer message supplied owner N1RWJ, event RG#999, a
  declared count of four and the groups `0A9ZO`, `XYZAB`, `O01QT`, `ABC0D`.
  Native setup derived the event number and accepted all four groups. The
  installed RandomGram Exchange panel showed the selected literal group, with
  a slashed zero distinguishable from O.
- Saved two same-band contacts with K2TEST using `0A9ZO`/`VWXYZ` and
  `XYZAB`/`LMNOP`. A repeated callsign was allowed. Reopening the first contact
  retained its literal sent snapshot. Clearing the second contact's RX group
  and saving removed that received exchange; reopening and restoring it
  preserved the original TX group.
- `RGSWL EFGHI` and `RGSWL VWXYZ` added listening notes without consuming a TX
  item or adding contacts. The tested entry flow was to type `RGSWL` in the
  callsign field, press a physical Space, enter the group and click the
  on-screen Save arrow. `RGSKIP` and `RGREPORT` ran without parameters through
  the same callsign field and Save arrow.
- `RGSKIP` retired selected item 3 (`O01QT`). Repeating it was rejected as
  already retired. The host did not advance the existing sequence, so item 4
  was selected manually before saving K3TEST with `ABC0D`/`QRSTU`. Selecting
  item 5 showed **TX list exhausted**.
- The report and native RandomGram text export both contained the participant
  and exactly four unique received groups: `VWXYZ`, `EFGHI`, `LMNOP`, `QRSTU`.
  The repeated listening group was omitted with a notice. Native ADIF contained
  exactly three contacts with the literal `STX_STRING`/`SRX_STRING` pairs above,
  no numeric `STX`/`SRX`, and no listening or retirement rows. The private native
  exports remain under ignored `dist/native-verification/`; they are not source
  fixtures or published artifacts.
- A separate **RandomGram preview** CW message set used the complete guarded
  Liquid template, flattened to one line for the native editor. The expanded
  message display showed `K5TEST 5NN 0A9ZO`, `K5TEST 5NN O01QT` and
  `K5TEST 5NN ABC0D` at the corresponding positions. RST used cut numbers while
  the code groups stayed literal; the entire message was empty beyond the
  list. No memory or function key was activated. The original **CWT** message
  set was restored and its original memories verified; the separate preview
  set remains available. Multiline clipboard paste was not tested.

The first native report attempt exposed a command timeout when its dialog
remained open longer than the host's 30-second invocation budget. `RGREPORT`
now opens the form without awaiting the operator's eventual dialog closure,
while observing and reporting genuine form errors. Regression tests cover an
unresolved form, normal cancellation and rejected presentation. After rebuilding
and reinstalling, the report remained open for **136 seconds** and closed with
Cancel without a command-failure notice.

The native host can leave a **No Exchange** or **Bad Exchange** warning visible
after valid RX entry or TX-item correction until callsign/focus changes refresh
scoring. The panel, keyer expansion and saved exchanges were correct throughout.
This is a host refresh gap; SDK 0.12.0 supplies no exchange-change scoring hook.
Manual advance after retirement, listening-note summary omissions and the lack
of a shared live-exchange getter remain the host limits recorded below.

This establishes the tested Mac workflow. Phone layout/keyboard/accessibility,
actual radio sending and multi-device allocation or recovery remain unverified.
RandomGram changes no CWT or CQ WW runtime, shared implementation or export
schema, so synchronization to their temporary upstream PRs does not apply.
The earlier development record below retains its original checks and failed
native-attempt scope.

## RandomGram development preview — 2026-10-14

Implemented `n1rwj-randomgram` in the separate Jujutsu workspace
`ham2k-n1rwj-extensions-randomgram`, based on main's v0.9.0 publication record.
The preview retains synchronized repository version 0.9.0; it has not been
released or submitted to the catalog. Historical v0.9.0 release notes remain
unchanged. The original working directory's unrelated changes are preserved.

The extension imports full organizer-issued messages or bare group lists,
validates metadata and the event alphabet, and preserves literal five-character
values including leading zeros. It provides TX-item selection, explicit
corrections, RX entry, immutable-list sent snapshots, a responsive exchange
pane, a guarded Liquid keyer template, listening-only entries, deliberate
retirement notes, ADIF strings and received-group submissions. Every new group
fixture is synthetic; private issued values are absent from source and assets.

`mise run format` and `mise run check` passed: lint, strict runtime/test/task
typechecks, **1,413 tests across 98 files**, nine official ES2020 builds and
nine official validated packages. RandomGram contributes **149 tests across
five files**, including activation of the actual built bundle under an ES2020
VM, hook registration, literal panel/save/keyer/ADIF agreement, durable exact
retirement, out-of-order selection, listening entries, unavailable-log failures
and command preview purity. These are deterministic adapter and bundle checks,
not native app or RF tests. The RandomGram package's SHA-256 is
`1a3f8c1c8b04297e9a9d5f06fb9469c21578ab77b55eca09e2dbfeb99cf2b091`.

`mise run verify-host n1rwj-randomgram` passed against the running
`/Applications/Ham2K Mac Logger (Next).app`, version 26.9.0 build 179. The
installed JavaScript kernel's SHA-256 is
`233da6f85e263a99e87401a42ed0148ebbd72bc3064f6633461292ac30ae05f1`.
Its shared-library versions satisfy the manifest, and all seven hooks activate
without kernel errors. This is the installed kernel evaluated under a Node VM,
with simulated bridge responses; it does not establish native UI acceptance.

Mac Control reached **Extensions & Features → Install from file** and selected
the local bundle. Installation/enablement could not be verified: following
the picker, the accessibility tree exposed only a `Dismiss` element and text
input never reached the search field. Coordinate control also returned
`noWindowsAvailable` during recovery. Rebinding and resetting the control
session did not restore text entry. No test contact or keyer transmission was
performed. Native phone layout, keyboard behavior, accessibility and actual
radio sending remain unverified.

Source inspection and implementation established these current host limits:

- A changed sequence start is only a hint after the host has allocated items.
  `RGSKIP` records the exact used item, but the operator must select the next
  unused item manually. Device-local retirement state is not a synchronized
  multi-device allocation authority.
- Export and scoring services remove event notes before invoking extensions.
  Text export retrieves listening entries once from the full log; `RGREPORT`
  supplies copyable submission text even for a listening-only operation.
  Native summaries can omit those entries.
- There is no shared live-exchange getter. The bundled Liquid memory duplicates
  selection logic, guarded and tested against the pure exchange resolver.
  Installing the extension does not modify personal keyer memories.
- Batch saves allocate later items after pre-save, so later contacts can lack
  literal TX snapshots. Initial support is one contact at a time. A dedicated
  always-visible mobile exchange slot still requires host support.

RandomGram changes no CWT or CQ WW behavior, shared implementation, translations
or export schema, and is exempt from synchronizing their temporary upstream PRs.

## Release 0.9.0 publication — 2026-10-07

Published [v0.9.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.9.0)
from signed main commit `fb4f131e932f50c6f03e7c313ebef806c5fd2acb` at 19:31:58
UTC (15:31 US Eastern time). GitHub verifies the signature, and the release
tag resolves to this tested main commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37674744006)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37675196268)
succeeded. All eight bundles and eight SHA-256 checksum files are present;
the published body matches `docs/releases/v0.9.0.md` exactly.

The release workflow passed **1,264 tests across 93 files**, lint, strict
runtime/test/task typechecks, eight ES2020 builds, official packaging and
all eight bundle/checksum pairs. The local
`mise run release:catalog v0.9.0 --dry-run` downloaded and validated every
published asset, selected Calendar, PSK Reporter and RBN, and skipped all five
contests.

The catalog approved Calendar at 19:32:59.576 UTC, PSK Reporter at 19:33:01.532
UTC and RBN at 19:33:03.230 UTC, all on `stable`. Public metadata and the API-5
catalog confirm all three are current at 0.9.0. Their catalog notes exactly
match the authored per-extension extraction. Independently downloaded catalog
bundles equal the corresponding GitHub archives byte for byte, with matching
catalog metadata, GitHub asset digests and checksum files:

- Calendar: **33,592 bytes**, SHA-256
  `cd71dbccdccc5f0b755d689c3a6e2a3660e5fc231c5f60db7d1907d6edd861e3`.
- PSK Reporter: **284,863 bytes**, SHA-256
  `b135e725de3c7d623c3e0baec24e316125e168787d32444b82028958a3435b18`.
- RBN: **318,603 bytes**, SHA-256
  `17d5a4edde75f07a5efddd0f7ba385ff1ae35d83d3327fc52ed02100b01655ca`.

There were no catalog retries. The preparation and earlier native pilot
records retain their verification scope; publication does not establish
native Calendar installation, UI, mobile, accessibility, production-network
or lifecycle acceptance. Compact reception menus still await installed-app
and mobile acceptance.

All extensions and shared packages are synchronized at 0.9.0. Calendar,
reception-only behavior and personal release metadata are exempt from CWT
and CQ WW upstream synchronization. The original working directory and its
mockups remain unchanged.

## Release 0.9.0 preparation — 2026-10-07

Prepared synchronized version 0.9.0 in the separate Jujutsu workspace
`~/src/github/rwjblue/ham2k-n1rwj-contest-calendar` for `main`.
The Calendar feature was rebased onto main commit
`6ba91f6a`, incorporating compact reception controls from `e9a43208` and the
HTML-only RBN export default. The original working directory remains separate.
This preparation does not publish a GitHub release or submit catalog entries.

The authored notes in `docs/releases/v0.9.0.md` include all eight extensions.
The real catalog notes selector chooses **Contest Calendar, PSK Reporter and
RBN** and skips all five contests. Existing dependencies, host API declarations
and shared-library ranges are unchanged; Calendar requires API 5. Historical
release notes remain unchanged.

`mise run release:notes v0.9.0`, `mise run format` and
`mise run release v0.9.0 --dry-run` passed, including **1,264 tests across 93
files**, lint, strict runtime/test/task typechecks, eight ES2020 builds,
official packaging and all eight bundle/checksum pairs. The local Calendar
archive is `dist/n1rwj-contest-calendar-0.9.0.h2kext`, SHA-256
`d9e3bd3fed9706ea94bc85f2a4d5657f1f079c92018d1fe13fa7276839b040d0`.

`mise run verify-host` passed for all eight extensions against the running
**Ham2K Next 26.9.0 build 177**, kernel SHA-256
`c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
The probe executes the installed JavaScript kernel under Node VM with simulated
timer wake delivery. Calendar native installation, UI, mobile, accessibility,
production networking and lifecycle acceptance remain unverified. Compact
reception menus have synthetic Flutter fixture verification; installed-app and
mobile acceptance remain pending. Earlier native pilot records retain their
original scope.

Calendar, reception-only behavior and personal release metadata are exempt
from CWT and CQ WW upstream synchronization. No contest runtime behavior changed.

## Contest Calendar development preview — 2026-10-07

Implemented `n1rwj-contest-calendar` in the separate Jujutsu workspace
`~/src/github/rwjblue/ham2k-n1rwj-contest-calendar`, based on committed `main`.
The original workspace and its unrelated reception changes remain separate.
The optional panel is available at every screen size and is never inserted
automatically. Home is the primary suggested placement; compact panes open a
scrolling native Browse form.

The extension uses ContestClock's attributed CC BY 4.0 catalog rather than
WA7BNM scraping. It preserves separate sessions and local rolling schedules,
registers the static thirty-day JSON endpoint as a native raw data file with
`maxAgeInDays: 7`, and uses persistent settings only for placement preferences.
Ham2K owns download scheduling, disk replay, ETags and download error notices.
The panel never fetches data; it recomputes a fourteen-day preview each minute
and Browse exposes the full download. Display status follows the app clock;
file age and coverage warnings use `PanelClock.realNowMillis`. It changes no
operation data.

A live default API response on October 7 contained **78 occurrences** and
explicit thirty-day server-generated coverage; all 78 passed the production
normalizer. The static endpoint returned no ETag and answered a conditional
request with HTTP 200. This verifies that response shape,
not sponsor accuracy or complete calendar coverage. Bands, exchanges and
scoring are intentionally outside the panel's data model.

`mise run format` and `mise run check` passed: **1,239 tests across 93 files**,
lint, strict runtime/test/task typechecks, eight ES2020 builds and official
packaging. Calendar coverage includes parsing and split sessions, malformed
data, managed-file conversion/replay and coverage, independent placements,
native control phases,
stale render events, scene remounts, visible selection and responsive geometry.
The local installable bundle is
`dist/n1rwj-contest-calendar-0.8.0.h2kext`, SHA-256
`eb98120f76bcda86453de16e32bf2a88623eb5ede61bc16e6c2b8fadabb90f67`.

The installed-kernel compatibility probe passed against **Ham2K Next 26.9.0
build 177**, kernel SHA-256
`c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
This runs the JavaScript kernel under Node VM with simulated timer dispatch.
The published-SDK bundle test also exercises settings persistence, data-file
replay, and real versus app clocks without Node, DOM, Intl, URL or global
fetch in the extension context. Native installation, UI, mobile, accessibility,
production host-network calls and lifecycle acceptance remain unverified.
The host refresh age is checked at startup, reconnection and runtime restart,
not by a weekly timer. Native raw cache persistence is unavailable on web.
Local-time behavior across future DST boundaries retains the examined Windows
QuickJS limitation documented in the extension guide; UTC is the default.

This independent tool changes no CWT or CQ WW behavior and is exempt from
synchronization to those contest PRs. Version 0.8.0 stays synchronized with
the monorepo's development version. Historical release notes remain unchanged;
no release, catalog publication, push or native layout changes were performed.

## Release 0.8.1 publication — 2026-10-07

Published [v0.8.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.8.1)
from signed commit `af27338c4f934a523bfc4e2014945b7841e3e2cf` at 13:10:06 UTC
(09:10 US Eastern time). GitHub verifies the signature, and the release tag
resolves to this tested commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37626350480)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37626394161)
succeeded. All seven bundles and seven SHA-256 checksum files are present;
the published body matches `docs/releases/v0.8.1.md` exactly.

`mise run release:notes v0.8.1`, `mise run format` and
`mise run release v0.8.1 --dry-run` passed, including **1,180 tests across 87
files**, lint, strict runtime/test/task typechecks, seven ES2020 builds,
official packaging and all seven bundle/checksum pairs.
`mise run release:catalog v0.8.1 --dry-run` downloaded and validated every
published asset, selected SST only and skipped the other six extensions.

The catalog approved SST on `stable` at 13:11:09.923 UTC. Public catalog
metadata confirms 0.8.1 is the current stable version. The GitHub SST archive,
published checksum and catalog bundle match exactly: **58,135 bytes**, SHA-256
`d01bfb1f7fd4e131f37dd470c250710d77714a8c056e9e62ae4bd56823584b82`.
There were no catalog retries.

The source `K1USNSST-064.txt` (file date 2026-10-06) contains
`KE2ET,LARRY,CWA,` on line 5314 and `SM4X,LARS,SM,` on line 10108.
The fixed bundled sandbox accepts all **15,682 calls** and reports five
warnings: three duplicate calls and two unsupported locations. Fresh loading
and serialized offline replay preserve names and valid location hints; the
unsupported fields are omitted. SM4X can still receive the independent
callsign-country `DX` suggestion. Malformed refreshes retain the previous cache.
This is unit/bundle verification, not a native Ham2K runtime test.

All extensions and shared packages advance to 0.8.1, with unchanged dependencies
and host compatibility. SST-only behavior and personal release metadata are
exempt from CWT and CQ WW upstream synchronization. Unrelated reception and
calendar work remains outside the release in its original working copy.

## Release 0.8.0 publication — 2026-10-06

Published [v0.8.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.8.0)
from signed commit `7416bfa326470cf933d7121ecee63009557dcfe5` at 22:26:22 UTC
(18:26 US Eastern time). GitHub verifies the signature, and the release tag
resolves to this tested commit. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37540488208)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37540583330)
succeeded. All seven bundles and seven SHA-256 checksum files are present;
the published body matches `docs/releases/v0.8.0.md` exactly.

`mise run release:catalog v0.8.0 --dry-run` downloaded and validated every
published asset and selected all seven entries. Catalog submissions for CQ WW,
CWT, MST, PSK Reporter, RBN, SST and WRT each returned **approved** on `stable`
between 22:27:22 and 22:27:29 UTC. There were no skipped extensions or retries.
Universal root dependency changes select every extension; shared reception and
mini-contest behavior is described under each affected consumer.

The preparation and native pilot records below define verification scope.
Publication does not establish mobile, accessibility, native export save/share,
production network or lifecycle acceptance beyond those records. The release
retains API 5 for reception tools and API 1 for contests, with existing
shared-library ranges. CWT source is already synchronized to PR #1; CQ WW is
unchanged. These publication records and personal release metadata are exempt
from official contest synchronization. Previously preserved designs and unrelated
contest work remain outside the release in their original Jujutsu change.

## Release 0.8.0 preparation — 2026-10-06

Prepared synchronized version 0.8.0 for the completed SDK adoption, native
reception controls, RBN reception exports, named SST setup suggestions and
dedicated CWT/MST/SST/WRT export preferences. The authored release notes in
`docs/releases/v0.8.0.md` include every extension and select all seven catalog
entries because root SDK/tools and development dependency updates are universal.
RBN and PSK Reporter require API 5; contests retain API 1. Shared-library ranges
are unchanged. Preparation changes only versions and release documentation.

`mise run release:notes v0.8.0`, `mise run format` and
`mise run release v0.8.0 --dry-run` passed, including **1,174 tests across 87
files**, lint, strict runtime/test/task typechecks, seven ES2020 builds, official
packaging and all seven bundle/checksum pairs. `mise run verify-host` passed all
seven 0.8.0 bundles against installed **Ham2K Next 26.9.0 build 177**, kernel
SHA-256 `c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
The kernel probe simulates timer wakes under Node VM; native acceptance and
its remaining limits are recorded in the reception sections below.

Live CWT PR #1 source `codex/cwt-call-history` was verified at
`a63546d341ee66c08a3aef37c1614e0f0703072e`; the clean upstream checkout contains
synchronized export registration, tests and documentation. CQ WW PR #2 remains
on `codex/cqww-rtty` at `03208ac5aff80a114add8c97a2b492119deff5c5`, with no
CQ WW behavior changes in this release. Mini-contest-only, reception-only,
personal release metadata and tooling changes are exempt from official contest
synchronization. Previously preserved designs and unrelated contest work remain
outside this release in their original Jujutsu change.

## Compact native reception controls — 2026-10-07

RBN and PSK Reporter now use compact outlined native menu buttons for Band and
Window on narrow panels. RBN's direct View choice shares that row and opens
Map/Receivers/Both choices; its closed caption uses Map/List/Both. Compact buttons
show only their current values and down arrows, with no Band/Window/View label
row or wrapped prefixes.
Refresh and Details/Back have native outlines. Status text wraps beside those
actions instead of clipping, and all native buttons retain 48-pixel minimum
targets. Wide panels keep the native dropdown/segmented toolbar.

With the deterministic normal-text fixture, the RBN map starts at y=118 instead
of y=205 at 390/430 pixels wide; the 320-pixel default starts at y=130 because
status wraps. Removing the initial compact label row reclaims another 20 logical
pixels above the map, or 29/36 pixels with 1.6/2-times text. Map-only artwork grows
by the full amount; Both distributes the space between the map and report list.
At 320 pixels, selected 40m/160m values can wrap View onto a second
row without exceeding the old y=205 map budget. Larger text wraps naturally.
PSK retains its saved View with no temporary View menu.

All **1,192 tests across 87 files** passed, along with strict runtime/test/task
typechecks, seven ES2020 builds and official packaging. Lint passed across the
289 repository files outside unrelated `output/contest-calendar` mockups being
created concurrently. `mise run check` encountered lint errors in those mockups;
they were left untouched. Formatting was applied before their creation, and the
four changed TypeScript files were checked again afterward.

Six temporary widget fixtures rendered the generated scenes using Flutter
3.44.9 and the API-5 host source in the local `halo-patches/map-state-override`
checkout. They covered 320/390/430-pixel panes, 40m/160m values, 1.6/2-times text,
and explicit View menu selection. Native button captions did not ellipsize,
and Receivers emitted `view:list` with the original View control ID and activate
phase. The widget harness loaded bundled Roboto, Material/MDI icons and an Arial
Unicode fallback for the headless environment; it exported local PNG previews.
These are synthetic widget tests, not installed-app or iOS/Android acceptance.
Screen-reader traversal of value-only menu buttons, platform font
fallbacks, production feeds, saved settings and real lifecycle behavior remain
native acceptance work before publishing.

Reception-only runtime, tests and documentation do not affect CWT or CQ WW,
so no official contest PR synchronization is required. Dependency ranges,
API declarations and synchronized release version 0.8.1 remain unchanged.

## Native reception actions and report window — 2026-10-06

RBN and PSK Reporter now use native Refresh and Details/Back buttons and a
temporary per-placement Window dropdown. Window uses the existing
1/3/5/10/15/30/45/60-minute choices. Saved Report window changes replace its
temporary override; unrelated saved settings preserve it. Operation or station
callsign changes and extension restarts reset it. RBN query/collection context
and PSK cached/history filtering use the selected window. Window commits do not
request a forced refresh, change exact MQTT subscriptions or bypass cooldowns.

At normal text size, deterministic 320/390/430-pixel-wide fixtures keep Band
and Window on one row and actions in the existing header. The map loses four
logical pixels of height from the change to 48-pixel native action targets.
Large text wraps controls as needed; at 320 by 900 and twice-normal text the
remaining map is 296 by 238, and at 390 by 844 with 1.6-times text it is 366 by
416. These are renderer bounds, not measurements from mobile Flutter hosts.

`mise run format` and `mise run check` passed: **1,174 tests across 87 files**,
strict runtime/test/task typechecks, lint, seven ES2020 builds and official
packaging. Tests cover native commit/action phases, invalid and stale events,
independent placements, saved defaults, operation clearing, effective source
queries, collection context and existing pending/backoff/history behavior.
`mise run reception:preview` regenerated nine scenarios and 51 pages; native
controls remain schematic SVG approximations.

`mise run verify-host` passed all seven bundles against installed **Ham2K Next
26.9.0 build 177**, kernel SHA-256
`c572080a83d2f6773bfa32ec814063d40578a8698a64e7dae89d82b89c3d9102`.
This runs the JavaScript kernel under Node VM with simulated timer wakes,
rather than verifying native UI or background/resume scheduling.

SDK Pilot 0.1.2 imported the working-copy renderer and production placement/event
modules with synthetic reports and a 1.5-second synthetic refresh. Instrumented
macOS host arguments confirmed 320- and 390-pixel panes. Band/Window selections
and native Refresh/Details/Back captions remained readable without overlap.
RBN Window 1 to 60 minutes changed one receiver to 18; Band 20m reduced that to
six. Details/About/Back restored page two with Band 20m and Window 60. PSK Window
15/5/30 commits worked, and Window remained usable during asynchronous Refresh.
PSK retained its saved Both view with no direct temporary View control.
Dropdown keyboard selection after pointer focus worked. Native accessibility
snapshots exposed the action labels, but full keyboard traversal and screen
reader operation remain unverified. The pilot predates the small RBN-only
compact-map guidance correction, covered separately by regression tests.

Both temporary Home placements and SDK Pilot 0.1.2 were removed. The original
Operation List/Current Version Home layout and divider were restored, with no
pilot tabs, global preference changes or replacement of existing extensions.
No QSO, radio action, upload or email occurred. Large app text and dark-theme
checks for the earlier choices/prose are recorded below; they were not repeated
for these new action captions. Actual mobile hosts, large OS text, short panes,
full keyboard/screen-reader navigation, high contrast, reduced motion,
production source/configuration behavior and real lifecycle scheduling remain
separate acceptance work before publishing.

SDK 0.12.0, tools 0.8.0, API-5 reception manifests, shared-library ranges and
synchronized version **0.7.6** remain unchanged. No release or catalog
publication is part of these commits. Reception-only code and documentation
are exempt from CWT/CQ WW synchronization; neither contest implementation was
changed. Previously preserved uncommitted designs and contest work remain in
their original Jujutsu change.

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
selection keys are independent and stable across export-settings reloads, while
companion observations and receiver metadata share one dataset. Frozen dataset
tokens round-trip through the published SDK's option preparation. Empty host
titles fall back to a station reception title in every format. PNG/ZIP and
custom transport/email remain absent.

`mise run format` and `mise run check` passed: **1,150 tests across 87 files**,
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

The installed macOS app accepted a temporary API-5 official SDK sample with
native dropdown, segmented and switch controls. Values reached extension logic,
and a pending text edit committed before a following simulated action. After
unlocking the Mac, SDK Pilot 0.1.1 imported the shared reception renderer, state
and event adapter from `fa170453`, with synthetic reports and no source network
adapters. RBN Band selection reduced 18 receivers to six, View removed the map,
and Sort changed receiver ordering. PSK Band and Sort dropdown commits and
Status/About tabs worked; PSK had no temporary View control.

Narrow panes wrapped RBN's toolbar and switched View to a dropdown. Approximate
widths of 324 and 239 logical pixels were estimated from screenshots, rather
than instrumented host arguments. The map was deliberately omitted at the
narrowest width; its misleading location prompt was corrected with size/location
regression tests for both renderer paths. Narrow details wrapped prose without
overlap, and closing details restored receiver page two. The PSK fixture remained
readable with the app's largest font scale and
dark panel theme, with information pages repaginating. Dropdown keyboard choice
worked after pointer focus; full focus order and screen-reader behavior were not
tested. Flutter accessibility snapshots stopped updating after extension reload;
these observations rely on visible UI behavior. The pilot predates the small
map-guidance correction.

All three temporary Home placements and SDK Pilot were removed. The original
Operation List/Current Version Home layout was restored, with no global theme
or font change. No QSO, radio action, upload or email occurred. Remaining native
acceptance includes short panes, actual OS text scaling, full keyboard/screen
reader navigation, high contrast, reduced motion, production saved-config forms,
operation/lifecycle changes and native reception-export save/share. Synthetic
fixtures do not establish production network or background/resume behavior.

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
