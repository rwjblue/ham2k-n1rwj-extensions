# N1RWJ Weekly RTTY Test

WRT adds half-hour RTTY sessions, name/QTH exchange controls, scoring, and
exports to Ham2K. It is an independently installable extension with key
`n1rwj-wrt` and activity type `wrt`.

## Contest and setup

The [sponsor rules](https://radiosport.world/wrt.html) specify Friday
**0145–0215 UTC**, on **80, 40, 20, 15, and 10 meters**. The start stays fixed
in UTC through daylight-saving changes. Calendar suggestions follow the
regular weekly schedule; sponsor cancellations or exceptions are not tracked.

1. Download `n1rwj-wrt-0.6.0.h2kext` from
   [v0.6.0](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.6.0)
   and install it using **Settings → Features & Extensions → Install from file**.
   To build locally, run `mise run pack n1rwj-wrt` and use the bundle in `dist/`.
2. Create a separate operation for each session, add **WRT**, and choose the
   session's UTC date. Enter your exchange name, state/province or country
   prefix, and power class: QRP (up to 5 W) or low power (up to 100 W).
3. Select **RTTY** as the logging mode. Explicit rig variants RTTY-LSB,
   RTTY-USB and RTTY-R are recognized; generic DATA, DATA-USB and FT8 are not.
4. Log one callsign at a time, checking **Name** and **State / province /
   country prefix** against the exchange actually received. The radio/modem
   handles RTTY decoding and transmission.

## Exchange and suggestions

W/VE stations send their name and state/province; DX stations send their name
and country prefix. For example, `ROB RI`, `BOB ON`, or `HANS DL`. There is no
serial number, membership number, or required signal report in this exchange.
`ON` can be Ontario or a Belgian prefix; the extension retains the copied text.
It does not convert foreign prefixes to SST's literal `DX`.

The short sponsor rules do not explain Alaska/Hawaii treatment explicitly.
Enter the exchange actually sent. Both state and prefix forms are accepted,
but lookup-based QTH suggestions for those entities are left blank.

Suggestions use current-operation WRT contacts, then older WRT contacts, then
ordinary host name/location hints. Exact callsigns take precedence; a base
call can suggest a portable station's name but never its previous location.
US/Canadian location hints require a recognized subdivision; foreign hints
use the country prefix. Country-prefix validation checks syntax, not a
callsign-derived country whitelist.

Operator edits and intentional clearing take priority through Ham2K's native
exchange controls. Use **Wipe** between contacts to reset touched fields.
This extension has no downloadable WRT call-history dataset, associated spot filter,
or extension network request. Older history uses targeted WRT queries;
operation membership may require a bounded full-log refresh after scoring
resumes, rather than reading the log on every keystroke. Older hosts that
ignore contest history filtering can miss WRT contacts behind newer activity.

## Score and report

Each eligible QSO earns one point. A callsign can be worked once per band,
and counts as a multiplier only once across the session. For example, working
K1ABC on 20m and 40m plus DL1ABC on 20m gives **3 QSOs × 2 calls = 6**.

Scoring excludes deleted contacts, invalid calls, other modes/bands, duplicates,
and contacts outside the selected half-hour (inclusive start, exclusive end).
Missing or invalid received exchanges show alerts but retain provisional
points and callsign multipliers. Correct these before reporting. Imported
contacts without usable session/time information cannot be time-filtered.

ADIF preserves `STX_STRING` and `SRX_STRING`, uses `CONTEST_ID: WRT`, and
normalizes recognized RTTY mode aliases to `MODE: RTTY`. WRT is an unlisted
ADIF contest identifier, using the sponsor's name in ADIF's string field.
Cabrillo uses `CONTEST: WRT`, `CATEGORY-MODE: RTTY`, `RY` QSO mode, and
name/QTH columns without RST, following the
[sponsor-linked N1MM definition](https://radiosport.world/WRT.udc).
Deliberately cleared received columns export as `-`; no guess replaces them.

Cabrillo contains RTTY contacts only. ADIF retains the supplied activity's
contacts. Exports retain off-band and off-session contacts even when they
score zero, so review them before sharing. Report the summary to
[3830 Scores](https://www.3830scores.com/). Automatic score submission and
Hamscore streaming are not included.

## Verification and provenance

Deterministic tests cover schedule boundaries, mode/band eligibility,
duplicates, callsign multipliers, checkpoints, history, operator edits, exports,
and activation without Node/DOM/network globals. The official packer and
installed Ham2K JavaScript kernel also validate the bundle. These checks do
not constitute a native UI or on-air test; see
[verification](../../../docs/VERIFICATION.md).

WRT uses the shared MST/SST contest engine, whose adapted files retain
Sebastian Delmont's MPL-2.0 notices. See [provenance](../../../docs/PROVENANCE.md)
and [notices](../../../NOTICE.md). CWT and CQ WW behavior are unchanged.
