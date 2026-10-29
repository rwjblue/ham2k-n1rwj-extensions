# Extension provenance and attribution

## BKG Companion

`extensions/activities/n1rwj-bkg/` is an original MPL-2.0 implementation using
the published Ham2K SDK. Membership data comes from the Brass Knuckle Gang's
[public v2 roster](https://www.bkg.club/data/v2/roster.json). Its number,
callsign, name, QTH and sponsor fields are used as published; legacy spelling
errors are not silently corrected. Photos and map locations are not consumed.

The scene follows [BKG.club](https://www.bkg.club/)'s published brass/black/lime
theme tokens and member-card vocabulary, with original vector artwork and
native text. No website scripts, fonts, photos or host internals are bundled.
Synthetic previews/tests do not redistribute the live member roster.

This independent extension, its preview task and its personal packaging change
no CWT behavior or shared runtime source, so upstream CWT synchronization is
not applicable.

## RandomGram

`extensions/contests/n1rwj-randomgram/` is an independent MPL-2.0 implementation
using the published Ham2K SDK 0.12.0 and official build tools 0.8.0. No host
or SDK internals are copied. The existing MIT notices cover bundled SDK code.
The [organizer overview](https://groups.io/g/RandomGram/topic/randomgram_overview/97601889)
and event-specific organizer instructions remain authoritative.

The importer follows the structure of an organizer-issued list supplied to
the operator: owner/event/count headers, a marked TX section, and literal
five-character groups. Tests use synthetic groups; the operator's issued
values and private email are not distributed. The extension does not
generate registered groups or calculate the organizer's adjudicated score.

The extension, its tests and personal packaging change no CWT or CQ WW
runtime source, shared behavior, translations or exports. This independent
contest is exempt from synchronization to their temporary upstream PRs.

## Contest Calendar

`extensions/tools/n1rwj-contest-calendar/` is an independent panel extension.
It reads the public [ContestClock JSON API](https://contestclock.com/data),
whose catalog by Joe Leone, W4GGJ, is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The
[catalog repository](https://github.com/w4ggj/contest-calendar) records sponsor
sources; sponsors' own rules remain authoritative.

The extension normalizes and filters downloaded records and formats times.
Separate sessions remain separate, and records without a universal UTC instant
are identified rather than assigned an invented time. The panel retains source
attribution and rules links, and its bundle includes
`assets/CONTEST_CALENDAR_ATTRIBUTION.md`. No WA7BNM calendar content is scraped,
downloaded, or redistributed. Coverage and source verification can vary.

Calendar work changes no CWT or CQ WW activity, scoring, exchanges, history,
translations, or export behavior. This independent tool and its personal
packaging are exempt from synchronization to those official contest PRs.

## Contest extension origins

**Primary upstream author: Sebastian Delmont, KI2D**, the main Ham2K developer.
The setup, scheduling, scoring, exchange controls, translations, ADIF fields,
and Cabrillo behavior in `extensions/contests/n1rwj-cwt/` derive from his
official Ham2K CWT extension. This monorepo adds personal exchange suggestions,
MST, SST, and WRT extensions, an RBN reception panel, shared code, and independent
packaging; it is not an official Ham2K release.

## Original installable archive

- File: `ham2k-cwt-0.2.1.h2kext`, supplied by the user.
- Extension key: `ham2k-cwt`; version: `0.2.1`; extension API: `1`.
- SHA-256: `c0b8606d6c37d1c30200fef45a3f7370e9c8ccb0e341ab4644ae5ac570166252`.
- Inspected on September 19, 2026. The ZIP contains `manifest.json` and a
  readable `index.js`; CWT source sections identify
  `extensions/contests/ham2k-cwt/src/`.

## Maintainable source and licensing

The private [Ham2K HaLo repository](https://github.com/ham2k/halo) supplied
maintainable TypeScript at commit
[`c726266a4ae72117396ce48255611374136fd374`](https://github.com/ham2k/halo/tree/c726266a4ae72117396ce48255611374136fd374/extensions/contests/cwt).
The CWT sources there use the older path `extensions/contests/cwt/` and
manifest version `0.0.1`; this revision is **not claimed to be the exact source
revision of the supplied 0.2.1 archive**. The scheduling, exchange, scoring,
and translation implementations match the corresponding readable archive
sections. The archive is the compatibility reference where they differ.

The [upstream README](https://github.com/ham2k/halo/blob/c726266a4ae72117396ce48255611374136fd374/README.md#license)
declares MPL-2.0. The CWT TypeScript files each carry
`Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>` and
`SPDX-License-Identifier: MPL-2.0`. These notices remain in the adapted files.
The full MPL-2.0 text in this project's `LICENSE` is the text distributed by
[Ham2K app-polo](https://github.com/ham2k/app-polo/blob/main/LICENSE).

Adapted source locations (all personal CWT paths are now under
`extensions/contests/n1rwj-cwt/`):

| Upstream | This project |
| --- | --- |
| `src/index.ts` | `extensions/contests/n1rwj-cwt/src/cwt/{activity,refs,exports,shared}.ts` |
| `src/exchange.ts` | `extensions/contests/n1rwj-cwt/src/cwt/exchange.ts` |
| `src/schedule.ts` | `extensions/contests/n1rwj-cwt/src/cwt/schedule.ts` |
| `src/scorer.ts` | `extensions/contests/n1rwj-cwt/src/cwt/scorer.ts` |
| `src/i18n.ts`, `src/i18n/*.json` | Corresponding files in `extensions/contests/n1rwj-cwt/src/cwt/` |
| `src/{exchange,schedule,scorer}.test.ts` | Corresponding Vitest tests in `extensions/contests/n1rwj-cwt/tests/cwt/` |

The archive's later integration changes are retained: registration and ADIF
delegation use the installed extension key; ADIF forwards segment, lookup,
settings, and export context options; Cabrillo comes from published
`@ham2k/lib-qson-cabrillo`. Internal SDK copies and repository-relative SDK
imports are replaced with published `@ham2k/extension-sdk` imports. The SDK is
version 0.5.0, MIT licensed, copyright Sebastian Delmont <sd@ham2k.com>; its
license notice is reproduced in `NOTICE.md`. Host-provided Ham2K shared
libraries are declared in the manifest and externalized by the official
builder.

## Compatibility boundaries retained

### Public extensions PR

[Ham2K/extensions PR #1](https://github.com/ham2k/extensions/pull/1) now carries
the exchange-prefill feature in the official extension's source layout.
Its feature behavior is the source of truth for ongoing personal backports.
Version 0.1.2 brings back its history-loading race fix, restriction of
suggestions to CWT exchange fields, and localized prefill/settings text.
Those contributions carry Robert Jackson's MIT notice, retained in `NOTICE.md`.
The personal extension retains the original adaptation's MPL-2.0 notices,
published SDK dependency, export identifiers, storage keys, and build tools.

The monorepo move preserves that CWT behavior and data identity. Generic N1MM
CSV parsing, callsign handling, and downloads now live in `packages/n1mm/`.
`packages/contest-history/` provides the shared CWT/MST/SST/WRT operation-history
adapter; CWT-specific membership interpretation and exchange precedence
remain in the CWT workspace. Recognition of MST/SST file markers, source-date
variants, and numbered N1MM download slugs is synchronized with the upstream
CWT PR.

### MST and SST

`extensions/contests/n1rwj-mst/` and `extensions/contests/n1rwj-sst/` are new
extensions using `packages/mini-contest/` and the shared N1MM and
operation-history adapters. Their contest behavior follows the
[ICWC MST rules](https://internationalcwcouncil.org/mst-contest/)
and [K1USN SST rules](https://www.k1usn.com/sst_rules.html), with export layouts
checked against the sponsor-linked N1MM definitions for
[MST](https://n1mmwp.hamdocs.com/mmfiles/icwc-mst-udc/) and
[SST](https://n1mmwp.hamdocs.com/mmfiles/k1usnsst-udc/).
Their ADIF identifiers are `ICWC-MST` and `K1USN-SST`; the SST Cabrillo
identifier is `K1USNSST`, following that definition.

The [SST FAQ](https://www.k1usn.com/sst_faq.html) supplies the Canadian
multiplier table, including separate `LB` and `NF` entries, and explains that
`NL` is an alias for `NF`. Its table and the rules were checked on September
20, 2026. The SST UDC uses `IsMultPer=1`, meaning once per band under the
[N1MM UDC contract](https://n1mmwp.hamdocs.com/appendices/udc-editor/);
MST uses `IsMultPer=4`, meaning once per contest. Both sponsors permit QRP,
low-power, and high-power entries. Their published exchanges and N1MM
Cabrillo layouts contain no signal report.

CWT and the separate CQ WW preview are subject to their own temporary
upstream-PR synchronization requirements.
These new contests and the monorepo's personal tooling and release layout do
not modify the official CWT extension.

### Weekly RTTY Test

`extensions/contests/n1rwj-wrt/` follows the
[WRT sponsor rules](https://radiosport.world/wrt.html) and its linked
[N1MM WRT definition](https://radiosport.world/WRT.udc), revision 1.0.2 dated
January 4, 2024, checked September 26, 2026. The definition's `DupeType=2`
and `IsMultPer=4` mean per-band duplicate checking and contest-wide
multipliers under the [N1MM UDC contract](https://n1mmwp.hamdocs.com/appendices/udc-editor/).
Its Cabrillo name is `WRT`, with name/QTH columns and no signal report.
The exchange text is preserved rather than turned into SST state/DX multipliers.

ADIF uses the same `WRT` string; it is not listed in the
[ADIF 3.1.6 contest enumeration](https://www.adif.org/316/ADIF_316.htm#CONTEST_ID),
but `CONTEST_ID` is a string field. The RTTY Cabrillo mode adaptation follows
the existing CQ WW approach for the host's shared writer. No CQ WW source or
translations are changed or imported into WRT.

WRT extends `packages/mini-contest/`, used by MST and SST, while retaining
its original MPL-2.0 notices. The shared CWT operation-history adapter is
consumed unchanged. This work does not affect CWT behavior, and therefore
requires no update to its temporary upstream PR; CQ WW's PR is also unchanged.

### NCCC Sprint CW

`extensions/contests/n1rwj-ns/` follows the
[NS CW rules](https://ncccsprint.com/rules.html),
[NS Ladder guidance](https://ncccsprint.com/ladder.html), and the incorporated
[2026 NAQP multiplier definitions](https://ncjweb.com/NAQP-Rules.pdf), checked
October 29, 2026. The sponsor adds Trinidad & Tobago, Aruba and the former
Netherlands Antilles. Current DXCC entities are used: PJ2/PJ4 supplement
the North American successor entities. The published host DXCC library supplies
country identities and continent membership; the extension owns the contest
exceptions. Canadian NF/LB/NL share the current NL multiplier. Country/state
abbreviation collisions use station context without changing received text.

The [sponsor's N1MM guidance](https://ncccsprint.com/n1mmlogger.html) names
SPRINTNS as its logging module. This extension uses `NCCC-SPRINT` as its own
ADIF/Cabrillo identifier and the Sprint serial/name/QTH column convention;
it does not claim a mandated weekly log-submission format. Operators post
scores on 3830 and retain logs. QSY reminders use the explicitly recorded
CQ/S&P/Unknown role and frequencies. Frequency-only checks remain advisory;
no QSY check changes the score. Assistance restrictions are documented without
changing other extensions. Recorded QSO start time approximates the response cutoff.

Native API-11 file discovery uses the code-defined `SPRINTNS` stem. The
[SPRINTNS download](https://n1mmwp.hamdocs.com/mmfiles/sprintns-txt-3/) checked
October 29, 2026 has 4,723 contact rows, `Call,Name,State,UserText` columns and
shared NAQP/Sprint association comments (last edit August 20, 2026).
The extension accepts those associations deliberately, retains NS-specific
locations and omits serial hints. No roster is bundled; deterministic test
rows are synthetic. The source's shared headers explain why requiring only
an NS comment would incorrectly reject this compatible dataset.

Other loggers' official documentation provides Sprint workflow aids:
[N1MM](https://n1mmwp.hamdocs.com/manual-supported/contests-setup/setup-hf-contests/)
documents Run/S&P macros and configurable QSY steps;
[TR4W's reference](https://tr4w.net/TR4W_Reference_Manual_4.01.pdf) describes
automatic CQ mode after an S&P contact; and
[Win-Test](https://docs.win-test.com/wiki/Menu%3AOptions#Sprint_Exchange_Logic)
selects the Sprint exchange message from whether the received serial is blank.
These are documented message/workflow aids, not evidence of universal frequency
lockouts. NS retains an explicit Unknown role and advisory-only checks.

NS extends the serial/name and name/location forms in `packages/mini-contest/`
to support all three exchanged values, while keeping NS geographic rules in
the new extension. MST, SST and WRT consume these shared changes and retain
their existing formats. Original copyright and MPL-2.0 notices are preserved.
The shared CWT history adapter is consumed unchanged; neither CWT source nor
behavior is changed. NS and this non-CWT shared contest work are exempt from
the temporary CWT upstream-PR synchronization requirement.

### Zombie Shuffle

The midnight radio club artwork, native scene, rebirth watch, identity notes,
visitor book and synthetic preview are original work by Robert Jackson,
N1RWJ, under the repository's MPL-2.0 license. The vector art contains no
external images, fonts, scripts or network resources. Presentation derives
contact credit from the existing Zombie scorer.

`extensions/contests/n1rwj-zombie/` is a separate implementation of the
[2026 Zombie Shuffle rules](https://www.zianet.com/qrp/ZOMBIE/pg.html).
The sponsor's [XLS](https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.xls)
and [ODS](https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.ods) summary
sheets agree on four scoring groups (80m, 40m, 20m, combined 10m/15m),
`(QSOs + bonus contacts) × sum of received numbers` per group, and a fixed
666-point addition. The implementation counts eligible rebirth bonus contacts
again and applies the fixed addition only after the first eligible contact;
these decisions and the source wording's ambiguity are documented in its guide.

The event-specific exchange adapters use the shared callsign and contest-history
libraries. Earlier releases downloaded
[ZOMBIE_004.txt](https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/), dated
October 18, 2025, with 66 entries. That page now returns 404 and N1MM's
call-history search has no Zombie result. Version 0.16.0 removes the downloader,
file parser, snapshot cache and source setting; the old file is not bundled or
used as a fallback. Suggestions now come only from logged Zombie contacts.
Historical bonus filtering, operator corrections and explicit clearing remain
in place. No membership roster or annual publication promise is implied.

Zombie Shuffle is independent of the temporary CWT and CQ WW previews and
does not modify their runtime, translations, shared adapters, or exports.
It therefore requires no synchronization to either upstream PR. Repository
MPL-2.0 attribution and the published SDK/build tools' MIT notices accompany
the new bundle.

### RBN reception panel

`extensions/tools/n1rwj-rbn/` is an independent panel extension. Reception
reports originate from the [Reverse Beacon Network](https://www.reversebeacon.net/)
and are delivered by the [Vail ReRBN HTTP API](https://vailrerbn.com/docs/endpoints),
which receives the CW/RTTY and FT8/FT4 streams. Vail ReRBN supplies receiver
locations from HamDB registered callsign grids; these can differ from the actual
skimmer locations, so map paths, distances, and bearings are estimates.
Receivers without valid grids remain in the list. The bundled map uses
Natural Earth geometry and ISC-licensed projection libraries; the
[map attribution](https://github.com/rwjblue/ham2k-n1rwj-extensions/blob/main/packages/reception/assets/MAP_ATTRIBUTION.md)
records their sources and retained notices. RBN does not change CWT behavior
or participate in its temporary upstream synchronization.

### Shared reception code and PSK Reporter

`packages/reception/` extracts the original N1RWJ RBN map, scene renderer,
configuration, geography, and panel state. RBN and PSK Reporter
consume that source in independent bundles; each retains the map notices.
The PSK payload parser follows the [M0LTE MQTT feed documentation](https://www.mqtt.pskreporter.info/).
Its original MQTT subscriber follows the [MQTT 3.1.1 specification](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html).
The live build uses the published SDK 0.12.0 socket and timer contracts. The
socket contract was first verified in
[Ham2K/halo 17b15fdcafdd](https://github.com/ham2k/halo/commit/17b15fdcafdd).
No SDK implementation is vendored. Normal reception packaging uses API 5 and
published tools 0.8.0. The `scene` payload provides native Band, Sort, and info-tab
choices around the retained SVG cartography and text layers. The extension does not
submit reports or log QSOs.
These reception-only changes and packaging work do not affect CWT behavior
and are exempt from the upstream CWT synchronization requirement.

### Existing CWT operations and exchanges

- The activity/ref type remains `cwt`, preserving existing CWT operations and
  received exchanges. The extension key is personal (`n1rwj-cwt`). Disable
  the official CWT extension before enabling this one, because both register
  handlers for that same activity.
- Four one-hour UTC sessions are computed weekly: Wednesday 1300/1900 and
  Thursday 0300/0700. Occasional sponsor cancellations are not encoded.
- Scoring remains one point per callsign per band, multiplied by unique
  callsigns across the operation, on the six HF contest bands in CW. Like the
  supplied extension, the scorer does not itself exclude contacts outside
  the selected hour; host activity segments determine its active scope.
- `ourName` and `ourNumber` retain the sent exchange. The QSO CWT ref's
  `name` and `number` retain the received exchange, including intentional
  blanks. Their joined value is projected to `their.exchange` for the log.
- Generic location guesses prefill Number/QTH only after all known CWT
  exchange sources are exhausted. Data/history suggestions
  introduced by this adaptation must explicitly identify a valid exchange;
  missing membership records do not prove nonmembership.

### Retired CQ WW preview

The former `extensions/contests/n1rwj-cqww/` preview derived from Sebastian
Delmont's official MIT-licensed `ham2k-cqww` at upstream main commit
[`2cb349bf`](https://github.com/ham2k/extensions/commit/2cb349bf).
Its RTTY additions were contributed through
[Ham2K/extensions PR #2](https://github.com/ham2k/extensions/pull/2), which was
closed without merging on October 21, 2026 after official RTTY support shipped.
The personal preview was removed from this repository that day. Maintenance
of that PR is paused; any future contributions should be focused changes
against the official extension, as requested in the
[maintainer's closure comment](https://github.com/ham2k/extensions/pull/2#issuecomment-6318621185).

Historical bundles retain the upstream copyright and MIT license in
`assets/CQWW-LICENSE.md`. They used the official `cqww` activity/ref type and
export identifiers. Disable the preview before enabling the official provider.
Removing this independent preview changes no CWT behavior or shared runtime
and requires no synchronization to the CWT PR.
