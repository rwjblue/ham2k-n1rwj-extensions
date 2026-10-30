# N1RWJ NCCC Sprint CW for Ham2K

Log the **NCCC Sprint CW (NS)** and individual NS Ladder sessions with outgoing
serials, N1MM name/QTH prefills, CQ/S&P QSY reminders, per-band duplicate checks
and multipliers, and ADIF/Cabrillo exports. Requires extension API 11 or newer
for the host's native call-history downloader.

## The contest at a glance

| Detail | Standard NS CW session |
| --- | --- |
| Time | Friday 02:30–03:00 UTC; Thursday evening in North America |
| Mode and bands | CW on 160, 80, 40, 20 and 15 meters |
| Maximum power | 100 W; setup offers QRP and low power |
| Exchange | Sequential serial number + name + state, province or country |
| Duplicates | Each station counts once per band |
| Score | Eligible QSOs × sum of multipliers on each band |
| Reporting | Post your session score on [3830 Scores](https://www.3830scores.com/) |

The [sponsor rules](https://ncccsprint.com/rules.html) and
[Ladder guidance](https://ncccsprint.com/ladder.html) govern operating. The weekly
schedule stays fixed in UTC across daylight-saving changes. Sponsor announcements
can change an individual week's rules; this extension implements the standard CW
format. Each Ladder week is a separate operation; the extension scores one
session rather than accumulating a season's best weeks.

## Get started

1. Build `mise run pack n1rwj-ns` from the repository root. Install
   `dist/n1rwj-ns-0.18.0.h2kext` through Ham2K's **Install from file** option.
   This new extension has not yet been published to GitHub or the catalog.
2. Create a **new operation for each session**, add **NS** or **NCCC Sprint**,
   and choose the correct Friday UTC session. Set your name, sent QTH and power.
3. Refresh **NS N1MM call history** under **Accounts, Services & Data Sources**
   (Data Files on older hosts). Add the optional **NS Sprint guide** panel in
   Layout Setup for detailed QSY reminders.
4. Choose **Operating mode**: **CQ / I solicited**, **S&P / I answered**, or
   **Unknown**. It describes this contact; it does not key the radio or change
   the host's keyer mode. Then enter one callsign at a time. Send the displayed **Sent #**, your name and
   QTH; copy the other station's **Received #**, **Name** and **QTH**.
5. Review exchange alerts and the per-band QSO/multiplier summary, then report
   your result on 3830 Scores. Retain your log in case the organizers request it.

Ham2K allocates outgoing serials from 1 across all bands in the operation.
Saving commits a serial; wiping a draft does not consume one. Operator serial
corrections use the host's native counter. Editing, deleting or rescoring does
not renumber earlier contacts. Selecting another session in an existing
operation does not reset the counter.

Use one callsign per entry. Batch entry shares received exchange fields, and
the host allocates later sent serials after the exchange projection hook.

## Exchanges and suggestions

Your edits and deliberate clearing remain authoritative. Untouched names and
QTHs are suggested in this order: NS contacts in this operation, the cached
N1MM file, older NS contacts, and ordinary host lookups. Names may fall back to an unambiguous base call;
portable stations do not inherit a base call's old QTH. Received serials are
always copied for the current contact and are never suggested from history.

The host automatically discovers the latest
[SPRINTNS.txt](https://n1mmwp.hamdocs.com/mmfiles/sprintns-txt-3/) download in
N1MM's public call-history collection. This is a shared Sprint/NAQP dataset;
[SPRINTLADD.txt](https://n1mmwp.hamdocs.com/mmfiles/sprintladd-txt-3/) is another
published entry for that family. Source discovery stays in code, with no URL
override settings. The native data-file cache survives restarts and failed
refreshes; a refresh failure retains the last valid parsed data.

Name/QTH lookup uses that in-memory index and bounded local-history reads. It
does not download a file or read the full log on every keystroke. The static
dataset supplies no current activity or frequencies and is never registered
as a spotting filter. N1MM's State column preserves NS's AK/HI and country
exchanges; unsupported or numeric location hints are omitted while usable
names are retained. Always verify a suggestion against the actual exchange.

US stations send a state, including **AK**, **HI** and **DC**. Canadian stations
send a province/territory. Other North American locations use a country prefix
such as **KP4** or **XE**; non-North American stations may send **DX**. Known
country prefixes are also accepted. Enter the exchange actually received.

## Multipliers and scoring

NS uses all 50 US states plus DC, the thirteen Canadian provinces/territories,
and other North American DXCC entities, each once per band. Trinidad & Tobago,
Aruba and the current former-Netherlands-Antilles entities are also included.
NF, LB and NL are accepted exchanges sharing one Newfoundland and Labrador
multiplier. 9Z/9Y share Trinidad & Tobago's multiplier. Use DXCC country prefixes
such as KP4 and KP2 rather than ambiguous postal abbreviations for Caribbean
locations. Prefixes KL and KH6 share the AK and HI state multipliers.

Overlapping abbreviations use the station's entity when it matches the country
prefix: **HI** from a Dominican Republic station counts as that country, while
**HI** from a Hawaii station counts as Hawaii. Likewise, Belgium's **ON** does
not automatically become Ontario. An explicit host state correction takes
priority. Review ambiguous portable locations against the exchange copied.

DX earns QSO credit without a multiplier, and a missing QTH never gets a
callsign-derived multiplier. Maritime/aeronautical mobile contacts add no
multiplier. A contact must include a North American station, including NS's
additional entities; self contacts are excluded. Missing station geography is
not treated as proof of ineligibility.

Deleted contacts, non-CW modes, unsupported bands, same-band duplicates and
contacts starting outside the selected half hour earn no points. A contact
starting before 03:00 can finish after the cutoff; its recorded start is used
as a proxy for the sponsor's response/callsign timing rule. The logger cannot
verify that on-air sequence. Contacts without usable timestamps/session data
require manual review.

Missing or invalid received exchanges show alerts while retaining provisional
QSO points, as in the other weekly contest extensions. Only recognized QTHs
produce multipliers. Correct alerts before reporting; the displayed score does
not certify a complete, valid exchange.

## Sprint operating rules

Observe the sponsor's **1 kHz QSY rule** after soliciting and completing a
contact. The **Operating mode** field records who solicited each contact:

- **CQ / I solicited:** after logging, the mode label and guide remind you to
  move at least 1 kHz before another contact, whether calling or answering.
- **S&P / I answered:** you may stay and solicit one contact. Select CQ when
  doing so, or continue S&P if answering another station's CQ.
- **Unknown:** three contacts within a 1 kHz window produce an advisory when
  any role is unknown. Answering separate nearby CQs can be valid.

The most recent mode is suggested for the next draft. An explicit mode change
survives Wipe during the current operation; saved roles restore the default
after restart. Historical edits do not change a live unsaved selection.
The mode control is visible but skipped by the normal Tab/Space focus cycle.

Exactly 1 kHz satisfies the distance reminder. Tuning away and back alone
does not clear a vacated frequency: a completed contact elsewhere is needed.
The guide retains those reminders through score checkpoints and resumption.
Deleted contacts and role/frequency corrections are reflected when rescored.
Missing frequencies/history require manual review. Earlier-contact editing
does not pretend that the latest live sequence is that contact's history.

**All QSY checks are advisory.** They never remove points, change multipliers,
mark contacts as duplicates or prevent saving. The optional **NS Sprint guide**
panel shows the current role, distance/return reminders and any missing-history
notice. Frequency-only checks do not establish a rule violation. Automatic CQ
detection from paddles, the radio or the host's keyer is not available here.

**Skimmer and packet assistance are prohibited.** Disable RBN and other external
spotting assistance while operating NS. This extension registers no spotting
hooks and does not change another extension's settings.

## Exports and verification

The **NS ADIF** and **NS Cabrillo** export entries have independent host export
preferences and include the session in their filenames. Both use the identifier
`NCCC-SPRINT`. ADIF exports numeric STX/SRX and complete sent/received exchange
strings. Cabrillo uses callsign, serial, name and QTH for each station, without
signal reports. Cleared fields remain empty/dashes; exclusions in the score do
not remove contacts from the exported log, so review it before sharing.

The identifier is an extension export convention, not a claim that NS requires
a particular log-submission service. Normal participation reports a score on
3830 rather than submitting a weekly log.

Deterministic source tests cover exchange precedence, serial controls, session
boundaries, multipliers, duplicates, checkpoint resumption and exports. Bundle
tests exercise the official ES2020 build in a Node-free VM with declared host
libraries, plus cached native data-file and guide hooks. These checks do not
constitute a native Ham2K UI or on-air test.

The shared contest code retains Sebastian Delmont's copyright and MPL-2.0
notices. See [provenance](../../../docs/PROVENANCE.md) and
[notices](../../../NOTICE.md).
