# BKG Companion

🤜 **Work the whole Brass Knuckle Gang.** Membership highlights, daily offline
roster, a BKG.club-inspired member panel, and one native **Worked the Gang**
chase program. Members and prospective members can participate. No extension
settings, account, identity picker, or operation activity is required.

## Install and use

1. Install `n1rwj-bkg-0.16.0.h2kext` from the
   [v0.16.0 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.16.0)
   on a host supporting extension API 13.
2. Ham2K downloads **BKG member roster** through its native Data Files manager.
   It becomes eligible for refresh after one day; native synchronization decides
   when to fetch. Manual refresh and offline cache removal remain in Data Files.
3. Member lookups add BKG number/name/QTH notes to Info on every band and mode.
   They preserve typed corrections and clearing, QRZ details, and exchanges.
4. Optionally add **BKG** through **Edit Layout → Add a Panel**, on Home/Logs
   or inside any operation. Identity comes from the operation's operator or active
   profile; the member number is resolved from the roster automatically.
5. Select **Worked the Gang** in native Chasing. Hosts that still gate the
   feature behind an experiment need **EXP CHASE** enabled first. The host owns
   lifetime progress and spot prioritization; there is no separate BKG chase mode.

## What counts

Only **2m CW** contacts earn worked credit. Membership labels remain available
on every band and mode. Mixed, per-band, per-mode and band/mode slots all use
that same 2m CW eligibility rule. One stable BKG number identifies each target.
A hunter's identity
uses their normalized station callsign, whether or not they are a member, so
joining does not reset progress. Self contacts, deleted contacts, and event
markers do not count. Historical contacts without recorded BKG identity are
matched against the downloaded current roster; this is a personal checklist,
not evidence of membership at the contact date or an official award.

New membership lookups retain a callsign-bound BKG number in the host's ordinary
lookup guess. This preserves identity across a later callsign change or reuse;
editing the QSO to a different callsign discards that hint. Ambiguous portable
calls are never guessed. The feed does not currently publish historical aliases.

## Panel

The brass/black/lime scene follows BKG.club's member-card styling, using original
vector artwork and native text. Older, very small, enlarged-text and high-contrast
views use accessible Markdown. There are no panel configuration fields.

- Outside an operation: your card, sponsor, direct recruits, roster freshness,
  recent spotted members and a route to the native lifetime chase view.
- Inside an operation: your card, distinct members worked **on 2m CW in this operation**,
  the current callsign's membership, and recent spotted members.
- A loaded roster without your callsign offers the 2m CW joining invitation.
  An unavailable roster reports membership as unknown.
- Member spots follow the host's current spot filters and expire after 15 minutes.
  2m CW reports appear first and are marked as joining opportunities. Reports
  indicate recent reception, not a promise that a member is still transmitting.

Full logs and spot boards are cached while typing. Log corrections/deletions
invalidate the operation snapshot; a roster refresh re-evaluates the existing
snapshot without rereading the log. The panel never scans other operations or
presents its operation count as lifetime progress.

## Source, caching and chase refresh

Source: [BKG.club public v2 JSON](https://www.bkg.club/data/v2/roster.json).
Only membership fields are consumed; maps and photos are not used. Successful
native downloads survive cold starts. Invalid, duplicate, older or severely
truncated snapshots retain the previous roster. A daily refresh failure does not
turn cached members into nonmembers.

The current API-9 host caches chase candidates and lifetime claims separately
from reference data, and exposes no reference-data invalidation hook. Lookups and
the panel use a newly downloaded roster immediately, as do subsequent uncached
claim evaluations. For existing chase results, **reload the extension, then
toggle EXP CHASE off/on on a device holding the complete log** to rebuild native
checklists and clear candidate caches. The extension does not modify host
settings, vary schema versions by device/roster, or simulate verified credits.

The chase schema is version 2 so the host rebuilds earlier any-band/mode claims
under the 2m CW rule after reloading the updated extension. As with other native
claim rebuilds, this requires a device holding the complete log.

Recruit submission, authentication and OG-specific hunting are outside this
first cut. Membership requires a voluntary 2m CW contact with an existing member
and the club's normal recruit review; the extension never enrolls anyone.

## Development and verification

- `mise run test extensions/activities/n1rwj-bkg/tests`
- `mise run bkg:preview` — synthetic Home/operation/narrow/offline scenes,
  static SVGs and scene JSON in `dist/`.
- `mise run verify-host n1rwj-bkg` — installed macOS JavaScript kernel check.
- `mise run check` — lint, strict types, tests, official builds and packages.

Automated bundle/kernel checks and browser-rendered scene previews are distinct
from native UI acceptance and actual chase ranking in the app. See the
[verification record](../../../../docs/VERIFICATION.md). No native UI or on-air
acceptance is claimed.

## Native panel controls

Ham2K extension API 13 is required. The BKG card scrolls vertically in short
panes; pinch or drag the right edge to adjust spot-list spacing. Font sizes
remain unchanged, and high-contrast or enlarged-text layouts retain native
Markdown. Spacing is temporary and independent for each panel placement.

The extension requests read-only radio access. A fixed strip follows the
logging radio’s frequency, mode and connection through native scene bindings;
radio events update the 2m CW guidance without polling or reading the full log.
Dial status is context only: it does not prove a qualifying contact or retune
the radio. Offline roster and hunting features remain usable without a radio.
