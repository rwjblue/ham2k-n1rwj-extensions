# Publishing N1RWJ extensions

GitHub releases remain the archive of installable `.h2kext` files and their
SHA-256 checksums. After those assets upload successfully, the **Release**
workflow submits changed extensions using the exact same bundles to the
[Ham2K extension catalog](https://catalog.ham2k.net/docs). The catalog reviews
each submission before operators can install it from the catalog.

## Retired CQ WW preview

The temporary `n1rwj-cqww` workspace was removed on October 21, 2026 after
[upstream PR #2 closed without merging](https://github.com/ham2k/extensions/pull/2#issuecomment-6318621185).
Build, packaging, release notes, and catalog submission tasks discover current
workspaces, so future releases exclude this extension. Ten extensions remained
after removal.
Repository removal does not withdraw previously published catalog entries or
GitHub release assets, or change installed providers. The release records below
remain historical; no new release or catalog submission accompanies removal.

## Current release status

[v0.15.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.15.1)
was published from signed main commit `5c4dec996ef7fc57ddac73b34ac0795e40bb4879`
on October 24, 2026 at **07:54:19 US Eastern (11:54:19 UTC)**. All **eleven
bundles and eleven checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40091702568)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40091757087)
passed. Downloaded assets passed `mise run release:catalog v0.15.1 --dry-run`,
and the published body exactly matches `docs/releases/v0.15.1.md`.

**RBN, SKCC Companion and Zombie Shuffle are approved and current at 0.15.1
on `stable`**, released between **11:55:25.798 and 11:55:30.025 UTC**. Their
public bundle bytes, sizes, SHA-256 hashes and scoped notes match GitHub.
The other eight catalog entries were skipped because their behavior and
dependencies are unchanged.

All three settings panels now declare their existing host section in the
manifest as well as panel code, with the separate sidebar entry disabled.
RBN uses Spotting; SKCC and Zombie use Activities. Older hosts without the
requested section can still render a standalone preferences category.
API-1 hosts discover Zombie, API-5 hosts also discover RBN, and API-9 hosts
discover all three. SKCC is absent from API-8 and older catalog responses.
See [release notes](releases/v0.15.1.md) and the
[verification record](VERIFICATION.md#release-0151-publication--2026-10-24).

### Previous releases

[v0.15.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.15.0)
was published from signed main commit `d5493bd32148ea8cb7ed3bcd42b7220050f5e38d`
on October 24, 2026 at **00:37:41 US Eastern (04:37:41 UTC)**. All **eleven
bundles and eleven checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40063008708)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/40063090823)
passed. Downloaded assets passed `mise run release:catalog v0.15.0 --dry-run`,
and the published body exactly matches `docs/releases/v0.15.0.md`.

**SKCC Companion 0.15.0 was submitted to `stable` at 04:38:41 UTC and was
pending catalog review during verification.** Submission success is not public availability: the
public extension API still returned 404 during verification. The
[catalog page](https://catalog.ham2k.net/extensions/n1rwj-skcc?channel=stable)
was not yet public at that point; the GitHub bundle could be installed
on an API-9-capable host. The other ten catalog entries were skipped because
their behavior and dependencies are unchanged.

SKCC adds offline membership, exchanges and event profiles, member spots,
award audits, application worksheets and experimental native chasing.
Its GitHub bundle is **80,561 bytes**, SHA-256
`babbebe2b8626343f77917841b99f93d79b01479badf5c7d93ef0dd6ffb412ae`.
Native UI, cross-device rescan and on-air acceptance remain unverified. See
[release notes](releases/v0.15.0.md) and the
[verification record](VERIFICATION.md#release-0150-publication--2026-10-24).

[v0.14.3](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.3)
was published from signed main commit `97e9baa1bbb416734ddb99c30dcebdaeac959182`
on October 22, 2026 at **13:44:38 US Eastern (17:44:38 UTC)**. All **ten bundles
and ten checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39825186184)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39825351978)
passed. Downloaded assets passed `mise run release:catalog v0.14.3 --dry-run`,
and the published body exactly matches `docs/releases/v0.14.3.md`.

CWT, MST, SST and Zombie Shuffle are **approved** and current at **0.14.3**
on `stable`, released between **17:45:45.175 and 17:45:50.572 UTC**. Their
public bundle bytes, sizes, SHA-256 hashes and scoped notes match the GitHub
archives and authored sections. API-1, API-5, API-7 and API-11 hosts discover
all four updates. The other six catalog entries were skipped; RBN remains at
0.14.2 (API-1 hosts retain compatible RBN 0.6.0).

CWT Prefill, MST call history and SST call history source settings pages are
removed. Those extensions always discover the latest N1MM file automatically,
ignoring earlier source overrides. Native data-file refresh and offline caches
remain available. Zombie shares the updated downloader failure guidance.
The matching CWT change is pushed to
[upstream PR #1](https://github.com/ham2k/extensions/pull/1) as verified signed
commit `766f8e88`. Other extension changes and personal release packaging are
exempt from CWT synchronization. Native UI acceptance remains unverified. See
the [release notes](releases/v0.14.3.md) and
[verification record](VERIFICATION.md#release-0143-publication--2026-10-22).

[v0.14.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.2)
was published from signed main commit `eb3c0cc3eb7d0257a91e64fb782c74666e997a79`
on October 22, 2026 at **09:18:33 US Eastern (13:18:33 UTC)**. All **ten bundles
and ten checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39785519014)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39785690707)
passed. Downloaded assets passed `mise run release:catalog v0.14.2 --dry-run`,
and the published body exactly matches `docs/releases/v0.14.2.md`.

CWT, MST, RBN, SST and Zombie Shuffle are **approved** and current at **0.14.2**
on `stable`, released between **13:19:54.640 and 13:20:02.514 UTC**. The other
five extensions were skipped because their behavior and dependencies are
unchanged. Public bundle bytes and scoped notes match the GitHub archives and
authored sections. API-1 hosts discover the four contests; API-5 and newer
hosts discover all five. The retired CQ WW preview is excluded.

Zombie combines call-history options and About in one dialog. Contest settings
target Activities and RBN targets Spotting, preserving saved settings and
Data Files access. Hosts without Activities retain standalone navigation until
the host provides that section. The CWT change is pushed to
[upstream PR #1](https://github.com/ham2k/extensions/pull/1); other extension
changes and personal release packaging are exempt from CWT synchronization.
Native UI acceptance remains unverified. See the
[release notes](releases/v0.14.2.md) and
[verification record](VERIFICATION.md#release-0142-publication--2026-10-22).

[v0.14.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.1)
was published from signed main commit `d30fda660d8aab5293b4a5b120fa9d77db032f2d`
on October 20, 2026 at **13:53 US Eastern (17:53:52 UTC)**. All **11 bundles,
11 checksum files and the original Zombie illustration** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39469911220)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39470043824)
passed. Downloaded assets passed `mise run release:catalog v0.14.1 --dry-run`,
and the published body exactly matches `docs/releases/v0.14.1.md`.

Zombie is **approved** and current at **0.14.1** on `stable`, released at
**17:55:01.079 UTC**. API-1 and API-7 hosts discover it; its catalog bundle
and scoped notes match GitHub. The other ten extensions were skipped because
their behavior and dependencies are unchanged.

This patch fills the panel corners, adds an event countdown and SPC lookup
defaults, and supplies illustrated panel selection and an offline About guide.
The public catalog page displays the illustration, event overview and official
links. Native FormRenderer image/link tests passed; installed-app UI and on-air
acceptance remain unverified. See the [release notes](releases/v0.14.1.md) and
[verification record](VERIFICATION.md#release-0141-publication--2026-10-20).

[v0.14.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.0)
was published from signed main commit `4ab275e93e5fd0e8520348595142b77d514b845f`
on October 20, 2026 at **13:22 US Eastern (17:22:34 UTC)**. All **11 bundles
and 11 checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39465246487)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39465526319)
passed. Downloaded assets passed `mise run release:catalog v0.14.0 --dry-run`,
and the published body exactly matches `docs/releases/v0.14.0.md`.

CQ WW and Zombie are **approved** and current at **0.14.0** on `stable`, with
release times **17:23:35.614** and **17:23:37.005 UTC**, respectively. Both
are discoverable on API-1 and API-7 hosts; their catalog bundles and scoped
notes match GitHub. The other nine extensions were skipped because their
behavior and dependencies are unchanged.

Zombie adds the midnight radio club scene, per-band rebirth watch, visitor
book and richer Info. CQ WW includes the already-synchronized upstream entry
and scoring reconciliation. Native UI and on-air acceptance remain unverified.
See the [release notes](releases/v0.14.0.md) and
[verification record](VERIFICATION.md#release-0140-publication--2026-10-20).

[v0.13.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.13.1)
was published from signed main commit `038642cd57b71709c0f9a5c860a2c6483a2b35f9`
on October 20, 2026 at 11:56 US Eastern time (15:56:16 UTC). All **11 bundles
and 11 checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39452802210)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39452967590)
passed. Downloaded assets passed `mise run release:catalog v0.13.1 --dry-run`,
and the published body exactly matches `docs/releases/v0.13.1.md`.

BIGFOOT **0.13.1** is **approved** and current on `stable`, released at
15:57:30.786 UTC. Public bundle bytes and scoped notes match GitHub. API-7
hosts discover 0.13.1; API-1 hosts retain compatible 0.12.1. The other ten
extensions remain at 0.13.0 because their behavior and dependencies are
unchanged. Tune
now appears only when CAT control is ready; connecting/manual states preserve
the callsign and frequency with selection-only letter controls. The forest
refreshes availability every five seconds while a fresh station lead is visible.
API 7 and radio-write permission requirements are unchanged. See the
[release notes](releases/v0.13.1.md) and
[verification record](VERIFICATION.md#release-0131-publication--2026-10-20).

[v0.13.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.13.0)
was published from signed main commit `a81b0015608811fbae171f0f74dca072b89014b2`
on October 20, 2026 at 11:17 US Eastern time (15:17:04 UTC). All **11 bundles
and 11 checksum files** are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39446865405)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39446976763)
passed. Downloaded assets passed `mise run release:catalog v0.13.0 --dry-run`,
and the release body matches `docs/releases/v0.13.0.md` exactly.

All eleven extensions are **approved** and current on `stable`, released
between 15:18:10.957 and 15:18:30.452 UTC. Public catalog bundles and scoped
notes match the GitHub archives and authored release document. API-7 hosts
see BIGFOOT 0.13.0; API-1 hosts retain compatible 0.12.1.
The root SDK/tools updates select every extension. BIGFOOT integrates fresh
station leads and teal letter beacons into its existing forest, with explicit
radio-tuning requests and manual callsign entry. It now requires **API 7** and
**radio-write permission**; other extensions retain their API requirements.
The shared SDK behavior is synchronized to the official CWT/CQ WW PR source
branches. See the [release notes](releases/v0.13.0.md) and
[verification record](VERIFICATION.md#release-0130-publication--2026-10-20).

[v0.12.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.12.1)
was published from signed main commit `923c9f71ebe9c4ed69f90b0cfaf789a4ec202600`
on October 20, 2026 at 10:13 US Eastern time (14:13:05 UTC). All 11 bundles,
11 checksum files, and the native panel-picker preview are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39436993370)
passed. The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39437234680)
also passed its checks, but GitHub returned HTTP 404 partway through asset
upload, so its catalog job was skipped.

Publication was recovered without replacing either complete CI bundle/checksum
pair. Only the orphaned BIGFOOT checksum was removed; the nine missing pairs
were uploaded from the tested release checkout. Downloaded assets passed
`mise run release:catalog v0.12.1 --dry-run`, and the same task without
`--dry-run` submitted BIGFOOT successfully. The release body matches
`docs/releases/v0.12.1.md` exactly.

BIGFOOT Hunt is **approved** and current at 0.12.1 on `stable`, released at
14:17:34.217 UTC. It is discoverable on API-1 and API-5 hosts. Its description,
keywords, bundle, and scoped notes match the authored sources and GitHub
archive. The other ten extensions were skipped because their behavior is
unchanged. This patch adds friendlier catalog discovery and the offline
panel-picker illustration. See the [release notes](releases/v0.12.1.md) and
[verification record](VERIFICATION.md#release-0121-publication--2026-10-20).

[v0.12.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.12.0)
was published from signed main commit `3e63b7205656150161205c65846112b9b92c7aaa`
on October 20, 2026 at 09:54 US Eastern time (13:54:47 UTC). All 11 bundles,
11 checksum files, and the native animation demo are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39434301709)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39434533441)
passed. Downloaded assets passed `mise run release:catalog v0.12.0 --dry-run`,
and the release body matches `docs/releases/v0.12.0.md` exactly.

BIGFOOT Hunt is **approved** and current at 0.12.0 on `stable`, released at
13:55:56.702 UTC. It is discoverable on API-1 and API-5 hosts; its catalog
bundle and notes match the GitHub archive and authored BIGFOOT section.
The other ten extensions were skipped because their behavior is unchanged.
This release adds the animated forest panel and emoji-rich Info display.
Native scene component checks passed; installed-logger UI and on-air
acceptance remain unverified. See the [release notes](releases/v0.12.0.md)
and [verification record](VERIFICATION.md#release-0120-publication--2026-10-20).

[v0.11.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.11.1)
was published from signed main commit `d650e096bf17e7db1b5ab47031de7caae9424f27`
on October 19, 2026 at 22:04 US Eastern time (October 20 at 02:04:42 UTC).
All 11 bundles and 11 checksum files are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39356849375)
and both jobs in the
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39356948313)
passed. Downloaded assets passed `mise run release:catalog v0.11.1 --dry-run`,
and the release body matches `docs/releases/v0.11.1.md` exactly.

BIGFOOT Hunt and RBN are **approved** and current at 0.11.1 on `stable`,
released at 02:05:48.723 and 02:05:51.039 UTC, respectively. BIGFOOT is
discoverable on API-1 and API-5 hosts; current RBN requires API 5. Their
catalog bundles and notes match the GitHub archives and authored sections.
The other nine extensions were skipped because their behavior is unchanged.
This release adds BIGFOOT station annotations, needed-contact highlights
including the second W7O, and an optional BIGFOOT-only RBN station filter.
Native UI and on-air acceptance remain unverified. See the
[release notes](releases/v0.11.1.md) and
[verification record](VERIFICATION.md#release-0111-publication--2026-10-19).

[v0.11.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.11.0)
was published from signed main commit `0ad5eb3f20388db8586c5bb5b8d0470316456dc3`
on October 19, 2026 at 21:26 US Eastern time (October 20 at 01:26:56 UTC).
All 11 bundles and 11 checksum files are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39353375558)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/39353479450)
passed. Downloaded assets passed `mise run release:catalog v0.11.0 --dry-run`,
and the published body matches `docs/releases/v0.11.0.md` exactly.

BIGFOOT Hunt and Zombie Shuffle are **approved**, current and discoverable on
`stable` for API-1 and API-5 hosts. The catalog records release times of
01:27:56.619 and 01:27:57.884 UTC, respectively. Their catalog bundles and
notes match the GitHub archives and authored sections. The other nine extensions
were skipped because their behavior is unchanged. The release adds 2026 BIGFOOT
letter/bonus progress and event worksheets, plus Zombie exchanges, rebirth checks, call history,
scoring and submission summaries. Native UI and on-air acceptance remain
unverified. See the [release notes](releases/v0.11.0.md) and
[verification record](VERIFICATION.md#release-0110-publication--2026-10-19).

[v0.10.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.10.0)
was published from signed main commit `3c3d01c675294219220d801fe4b63bbc68fc151e`
on October 14, 2026 at 19:58 US Eastern time (23:58:38 UTC).
All nine bundles and nine checksum files are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/38657216936)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/38657304288)
passed. Downloaded assets passed `mise run release:catalog v0.10.0 --dry-run`,
and the published body matches `docs/releases/v0.10.0.md` exactly.

RandomGram returned **approved** on `stable` at 23:59:36 UTC and is current
and discoverable by API-5 hosts. Its catalog bundle and notes match the GitHub
archive and authored section. Contest Calendar,
CQ WW, CWT, MST, PSK Reporter, RBN, SST and WRT were skipped because their
behavior is unchanged. The release adds organizer-issued exchange lists,
a large exchange panel, listening entries, keyer templates and submission
exports. Synthetic native Mac acceptance passed; mobile and actual radio
sending remain unverified. See the [release notes](releases/v0.10.0.md) and
[verification record](VERIFICATION.md#release-0100-publication--2026-10-14).

[v0.9.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.9.0)
was published from signed main commit `fb4f131e932f50c6f03e7c313ebef806c5fd2acb`
on October 7, 2026 at 15:31 US Eastern time (19:31:58 UTC).
All eight bundles and eight checksum files are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37674744006)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37675196268)
passed. Downloaded assets passed `mise run release:catalog v0.9.0 --dry-run`,
and the published body matches `docs/releases/v0.9.0.md` exactly.

Contest Calendar, PSK Reporter and RBN returned **approved** on `stable` between
19:32:59 and 19:33:03 UTC. All three are current at 0.9.0 and discoverable by
API-5 hosts; their catalog bundles and notes match the GitHub archives and
authored sections. CQ WW, CWT, MST, SST and WRT were skipped because their
behavior is unchanged. Native Calendar UI testing remains pending. See the
[release notes](releases/v0.9.0.md) and
[verification record](VERIFICATION.md#release-090-publication--2026-10-07).

[v0.8.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.8.1)
was published from signed commit `af27338c4f934a523bfc4e2014945b7841e3e2cf`
on October 7, 2026 at 09:10 US Eastern time (13:10:06 UTC).
All seven bundles and seven checksum files are available. The
[check workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37626350480)
and [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37626394161)
passed. Downloaded assets passed `mise run release:catalog v0.8.1 --dry-run`,
and the published body matches `docs/releases/v0.8.1.md` exactly.

SST returned **approved** on `stable` at 13:11 UTC and is the catalog's current
version. Its catalog bundle matches the GitHub archive and published checksum.
CQ WW, CWT, MST, PSK Reporter, RBN and WRT were skipped because their behavior
is unchanged. This release fixes SST history imports containing unsupported
location hints; native Ham2K acceptance remains unverified. See the
[release notes](releases/v0.8.1.md) and
[verification record](VERIFICATION.md#release-081-publication--2026-10-07).

[v0.8.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.8.0)
was published from signed commit `7416bfa326470cf933d7121ecee63009557dcfe5`
on October 6, 2026 at 18:26 US Eastern time (22:26:22 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37540583330)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.8.0 --dry-run`, and the published body matches
`docs/releases/v0.8.0.md` exactly.

CQ WW, CWT, MST, PSK Reporter, RBN, SST and WRT all returned **approved** on
`stable` at 22:27 UTC. Universal SDK/tools and development dependency updates
select every extension. The release includes native reception controls, the
temporary report-window choice, six RBN reception exports with optional evidence
collection, named SST location suggestions and dedicated contest export entries.
RBN and PSK Reporter require extension API 5; contest extensions retain API 1.
Native verification scope and remaining device checks are recorded in the
[release notes](releases/v0.8.0.md) and
[verification record](VERIFICATION.md#release-080-publication--2026-10-06).

[v0.7.6](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.6)
was published from signed commit `02f6a921b75bc4db149a233dc0facdd589886453`
on October 2, 2026 at 13:23 US Eastern time (17:23 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/37040336140)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.6 --dry-run`, and the published body matches
`docs/releases/v0.7.6.md` exactly.

RBN returned **approved** on `stable` at 17:23:54 UTC. CQ WW, CWT, MST,
PSK Reporter, SST, and WRT were skipped because their behavior is unchanged.
This release adds optional RBN spot separation and the compact My Signal
view-cycle control. Native UI acceptance remains outstanding. See the
[release notes](releases/v0.7.6.md) and
[verification record](VERIFICATION.md#release-076-publication--2026-10-02).

[v0.7.5](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.5)
was published from signed commit `bc7613c6f5885414802a55ad6d110fe31fb8e6e7`
on October 1, 2026 at 18:13 US Eastern time (22:13 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36933712586)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.5 --dry-run`, and the published body matches
`docs/releases/v0.7.5.md` exactly.

RBN and PSK Reporter returned **approved** on `stable` at 22:13 UTC.
CQ WW, CWT, MST, SST, and WRT were skipped because their behavior is unchanged.
This release adds the optional RBN minimum SNR filter and reception time-window
and band-menu improvements. Native acceptance for the new SNR option remains
outstanding. See the [release notes](releases/v0.7.5.md) and
[verification record](VERIFICATION.md#release-075-publication--2026-10-01).

[v0.7.4](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.4)
was published from signed commit `772dbd2f07bd44331c1de8efbe07dfc88ba3c3d9`
on September 30, 2026 at 15:31 US Eastern time (19:31 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36766290761)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.4 --dry-run`.

CWT, MST, SST, and RBN returned **approved** on `stable` at 19:32 UTC.
CQ WW, PSK Reporter, and WRT were skipped because their behavior is unchanged.
This release fixes RBN reference icons and N1MM call-history refresh timeouts.
Native RBN badge rendering and chip behavior remain unverified. See the
[release notes](releases/v0.7.4.md) and
[verification record](VERIFICATION.md#release-074-publication--2026-09-30).

[v0.7.3](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.3)
was published from signed commit `236b11a248221ec32d3a82e075f555aa079f52c4`
on September 30, 2026 at 14:24 US Eastern time (18:24 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36758360368)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.3 --dry-run`.

CWT, PSK Reporter, and RBN returned **approved** on `stable` at 18:25 UTC.
CQ WW, MST, SST, and WRT were skipped because their behavior is unchanged.
This release fixes RBN refresh recovery, receiver filtering, and station
selection; adds PSK Reporter listener IDs; and makes CWT history filtering
opt-in. See the [release notes](releases/v0.7.3.md) and
[verification record](VERIFICATION.md#release-073-publication--2026-09-30).

[v0.7.2](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.2)
was published from signed commit `e67b396ed0cb6b5bd4800bb218accf40510cd2a2`
on September 29, 2026 at 23:14 US Eastern time (September 30 at 03:14 UTC).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36663504231)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.2 --dry-run`.

All seven extensions returned **approved** on `stable` at 03:15 UTC.
The shared SDK update selects every extension for catalog publication. This
release fixes RBN startup directory refreshes with receiver IDs such as `UNKNOWN`
and includes standard contest summaries and CQ WW activity suggestions already
on main. See the [release notes](releases/v0.7.2.md) and
[verification record](VERIFICATION.md#release-072-publication--2026-09-29).

[v0.7.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.1)
was published from signed commit `3bb7900cdca95543c49075e61bb8ae68d84ec7f2`
on September 28, 2026 at 01:04 UTC (September 27 in US Eastern time).
All seven bundles and seven checksum files are available. The
[release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36364551631)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.1 --dry-run`.

RBN returned **approved** on `stable` at 01:05 UTC. All six other extensions
were skipped because their behavior is unchanged. This release adds CW speed
filters, remembered and locally suggested receiver continents, and explicit
spot-setting defaults/reset controls. See the [release notes](releases/v0.7.1.md)
and [verification record](VERIFICATION.md#release-071-publication--2026-09-28).

[v0.7.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.7.0)
was published from signed commit `919f9c02b02cbd6e5afb5bd2358dc04b9522445f`
on September 27, 2026 at 13:36 UTC. All seven bundles and seven checksum files
are available. The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36322961213)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.7.0 --dry-run`, and all seven catalog submissions
returned **approved** on `stable` at 13:36 UTC.

This release adds timer-driven reception scheduling and clearer report info.
PSK Reporter and RBN require extension API 3; contests retain API 1. The shared
SDK/tooling update selects all extensions for catalog publication. See the
[release notes](releases/v0.7.0.md) and
[verification record](VERIFICATION.md#release-070-publication--2026-09-27).

[v0.6.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.6.1)
was published from signed commit `7d51767f60692339bc19160c5d76260dda87cc14`
on September 27, 2026 at 06:04 UTC. All seven bundles and seven checksum files
are available. The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36299023676)
passed both upload and catalog jobs. Downloaded assets passed
`mise run release:catalog v0.6.1 --dry-run`.

CQ WW returned **approved** on `stable` at 06:05 UTC. All six other extensions
were skipped because their behavior is unchanged. This release fixes RTTY
spot multiplier notices and preserves scored points, exchange corrections,
and duplicate handling. The synchronized fix is pushed to
[Ham2K/extensions PR #2](https://github.com/ham2k/extensions/pull/2).
See the [release notes](releases/v0.6.1.md) and
[verification record](VERIFICATION.md#release-061-publication--2026-09-27).

[v0.6.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.6.0)
was published from signed commit `1edadb2f32aa5220df9173d1d1c1230e6d0b1b69`
on September 27, 2026 at 01:38 UTC (September 26 in US Eastern time).
All seven extension bundles and their seven checksum files are available.
The [release workflow](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36286148410)
passed both upload and catalog jobs. Downloaded GitHub assets passed
`mise run release:catalog v0.6.0 --dry-run`.

WRT, MST, SST, and RBN returned **approved** on `stable` at 01:39 UTC.
CQ WW, CWT, and PSK Reporter were skipped because their behavior is unchanged.
The release includes the new WRT extension, the MST/SST contest-engine update,
and RBN's default to all supported spot modes. See the
[release notes](releases/v0.6.0.md) and
[verification record](VERIFICATION.md#release-060-publication--2026-09-27).

[v0.5.1](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.5.1)
was published from signed commit `88363a3cff77113963f3fb35ca8b57047ece5f1f`
on September 26, 2026 at 23:32 UTC. All six extension bundles and their
six checksum files are available on GitHub. The
[GitHub upload job succeeded](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36279749519/job/108509200255),
and downloaded assets passed `mise run release:catalog v0.5.1 --dry-run`.

The [catalog job succeeded](https://github.com/rwjblue/ham2k-n1rwj-extensions/actions/runs/36279749519/job/108509270006):
PSK Reporter and RBN uploads to `stable` returned **approved** at 23:32 UTC
on September 26. CQ WW, CWT, MST, and SST were skipped because their behavior
is unchanged. See the [release notes](releases/v0.5.1.md) and
[published artifact verification](VERIFICATION.md#release-051-publication--2026-09-26).

The previous [v0.5.0 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.5.0)
published CQ WW, CWT, MST, and SST to the catalog. The CQ WW catalog name
explicitly says **temporary**, and its description and release notes link the
upstream PR and retirement condition. Its unchanged bundle is also archived
in v0.5.1 at the synchronized version.

Earlier v0.2.1, v0.3.0, and v0.3.1 runs failed with HTTP 403 from a Cloudflare
challenge. The v0.3.2 retry and v0.3.3/v0.3.4 publications succeeded; inspect each earlier
version's submission history before retrying it.

## Configure the token

The catalog account needs the approved `n1rwj-*` namespace grant and a token
from the [publisher dashboard](https://catalog.ham2k.net/publish).

Copy `.env.local.example` to `.env.local` if the local file does not already
exist. Uncomment its `H2K_CATALOG_TOKEN=` line and paste the token after `=`.
Mise loads this file automatically for tasks and activated shells. The file
is ignored by version control, and mise marks the token for output redaction.
Ordinary checks and GitHub uploads do not require this token.

Once the local token is filled in, install it as this repository's GitHub
Actions secret:

```sh
mise run release:catalog-secret
```

This uses the authenticated `gh` CLI and passes the token on standard input.
Alternatively, create a repository Actions secret named `H2K_CATALOG_TOKEN`
in GitHub's settings. CI exposes it only to the catalog submission step.
The local file and GitHub secret are independent: rerun the task after
rotating the local token. A missing secret fails the catalog job explicitly;
the already uploaded GitHub release assets remain available.

## Prepare and publish a release

All extensions and shared workspaces retain one synchronized version, including
extensions with no behavior changes. Choose an unused version; for example:

```sh
mise run release:prepare 0.3.5
mise run release:notes v0.3.5 --create
# Edit docs/releases/v0.3.5.md after reviewing changes since the previous release.
mise run release:notes v0.3.5
mise run format
mise run release v0.3.5 --dry-run
```

Commit the prepared files using the repository's signed Jujutsu workflow and
push them to `main`. Releases must come from tested, signed commits on `main`.
Create drafts with `--target main`, and verify that `main` still matches the
tested commit before publishing a GitHub release tagged `v0.3.5`.
Use `docs/releases/v0.3.5.md` as its body (`gh release create` accepts
`--notes-file docs/releases/v0.3.5.md`), so GitHub and the catalog share one
authored document.
The workflow checks out the release commit, runs `check`, and attaches the
exact current bundle/checksum pairs. Drafts do not trigger it. Keep GitHub
release immutability disabled because these assets are attached after
publication.

The separate `catalog` job then downloads the GitHub release assets to a
temporary directory. It checks synchronized versions and every checksum
before submitting any bundle, and limits publication to `n1rwj-*` keys.
Archives larger than 16 MiB are refused. It uses the pinned official
`h2kext-publish` from `@ham2k/extension-tools`, passing existing archives so
they are never rebuilt or repackaged for the catalog. Each catalog entry gets
only its extension's section and the shared changes from GitHub's release body.

The reviewed release notes also determine which extensions are submitted.
An extension whose entire section says `No extension-specific changes for <name>.`
is skipped when there is no nonempty **Shared changes** section. Version bumps
and **Repository notes** alone never trigger catalog submissions. Shared runtime
changes belong in every affected consumer's section; universal dependency
changes belong in **Shared changes** and select all extensions. Review the diff
when writing these notes: this is an authored publication plan, not automatic
source or archive comparison. GitHub still archives every synchronized bundle.
A release with no changed extensions succeeds without submitting anything.

### One release document, separate catalog audiences

`release:notes <tag> --create` creates `docs/releases/<tag>.md` from the
discovered extensions and refuses to overwrite an existing file. It scaffolds
headings and author prompts; it does not infer user-facing changes from commit
subjects or assume untouched extension directories mean unchanged behavior.
Review the release diff and replace every `[TODO: ...]` prompt. Run
`release:notes <tag>` to validate the whole document and preview every catalog
entry, or add an extension key to preview just that entry. `--file <path>`
supports a different source file. These previews need no release, network,
catalog token, or version bump.

Use these level-two headings (extension keys are stable, exact identifiers):

```markdown
# v0.3.5 — Better maps and dependency updates

A short overview for readers of the GitHub release.

## Shared changes

- Updated the root SDK dependency used by all extension builds.

## n1rwj-cwt

No extension-specific changes for CWT.

## n1rwj-mst

No extension-specific changes for ICWC MST.

## n1rwj-rbn

- Improved receiver map coverage.

## n1rwj-sst

No extension-specific changes for K1USN SST.

## Repository notes

Build verification and installation details for the GitHub release.
```

This is a format example, not a claim about the next release's contents.

- The title and introductory summary appear only on GitHub. Put any actual
  universal changes in **Shared changes**, even if the summary mentions them.
- Treat root dependency updates (including root development/build dependencies
  and transitive dependency updates in the root lockfile) as universal and put
  them in **Shared changes**. A synchronized version bump alone is not a
  dependency update. Omit the shared section when there are no universal changes.
- Describe extension changes under that extension's key. For shared workspace
  code, include the note under every affected consumer, following transitive
  usage; a contest-only shared library change need not appear for RBN. Use
  **Shared changes** only if every extension is affected.
- Every extension requires a nonempty section. Explicitly write
  `No extension-specific changes for <name>.` after reviewing its own changes
  and shared consumers. With no shared changes this skips its catalog submission;
  with shared changes it is followed by those updates and the extension is submitted.
  All versions still advance in GitHub releases.
- **Repository notes** is optional and stays on GitHub, for tooling,
  validation, installation details, and other repository context. Use `###`
  for subsections within any audience and inline Markdown links so each
  extracted section is self-contained. HTML author comments are omitted.

Catalog publication validates every extension's section before downloading
or submitting anything, even when selecting a single extension. Missing,
empty, unknown, or duplicate sections and unfinished scaffold prompts fail
explicitly. The publisher never falls back to broadcasting the whole document.
Older unstructured release bodies must be reorganized into this format before
retrying with this tooling; preview first, and retain their existing release
facts and archives. Historical release files are not automatically rewritten.

Normal releases use `stable`; GitHub prereleases and SemVer prerelease
versions use `unstable`. To preview an **existing** published GitHub release
from a checkout with the same version and extensions:

```sh
mise run release:catalog v0.3.5 --dry-run
```

This downloads and validates assets and prints the exact notes for each
changed catalog entry and lists skipped extensions, but needs no catalog token and submits nothing. Unlike
`release --dry-run`, it reads GitHub's published assets rather
than building the working tree. After resolving any catalog outage and
checking for earlier accepted submissions, omit `--dry-run` to submit locally.
The following are alternative commands; choose the one matching the intended
scope and channel:

```sh
mise run release:catalog v0.3.5
mise run release:catalog v0.3.5 n1rwj-mst
mise run release:catalog v0.3.5 --channel bleeding
```

The optional extension key limits submission to one extension and does not override
the unchanged-extension skip. All release
assets are still validated first. The channel override accepts `stable`,
`unstable`, or `bleeding`; prereleases cannot target `stable`.

### Catalog documentation discrepancy

As checked on September 21, 2026, the catalog's publishing page and parts of
its UI still call channels `prod`, `next`, and `dev`. The pinned official
tools use `stable`, `unstable`, and `bleeding`; inspected host source also
requests `stable`. This automation follows the official publisher contract.
The authenticated v0.2.1, v0.3.0, and v0.3.1 upload attempts were blocked by
Cloudflare before catalog validation. The successful v0.3.2 retry established
that the deployed catalog accepts `stable`; the other channels remain unverified.

## Review and recovery

An accepted upload is a submission, usually **pending review**, rather than
proof that the extension is installable. Check the publisher dashboard for
review results. Once a version is approved, its bytes are frozen: code or
packaging changes require a new version. Reuse the existing GitHub archive
when submitting that version to another channel.

The official publisher makes no automatic retries. Release notes use a
second request, so a notes failure can leave the bundle already submitted.
If publishing stops midway, earlier submissions remain. Inspect the
dashboard before retrying; fix notes there if that was the only failure,
and use the optional extension key to submit only the remaining extensions.

If the catalog job failed before any submissions, resolve the specific cause
(for example, a missing secret or an API challenge) and use GitHub
Actions' **Re-run failed jobs**. This preserves the successful GitHub upload
job. Do not rerun all jobs blindly: the GitHub uploader deliberately refuses
to overwrite existing release assets. If an archive was rejected, inspect
the reason and the version's review history before deciding whether it can
be resubmitted or needs a new version.

These are repository release tooling and personal packaging changes, exempt
from the temporary CWT behavior synchronization with the upstream extension.
