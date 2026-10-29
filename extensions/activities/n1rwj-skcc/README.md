# SKCC Companion

SKCC Companion combines manual-key operating activities with member discovery
and award progress. It is a personal N1RWJ extension, not an official SKCC
product or a substitute for the club’s award managers.

## Start operating

1. Install `n1rwj-skcc` in a Ham2K host supporting **extension API 12**.
2. Download **SKCC member roster** through native Data Files. Open
   **Activities → SKCC Companion** and set your usual number, name, location
   and key. The manifest and panel both place these settings under Activities;
   no separate sidebar entry or Common Preferences fields are requested.
   Older hosts without Activities can still show a standalone preferences
   category; update Ham2K for the grouped placement.
3. Add **SKCC contacts and hunting**, or a specific SKCC event edition, to an
   operation. It can coexist with POTA or another activity. Review the SKCC
   setup, especially your transmitted location when operating away from home.
4. Copy the actual name, state/province/country and SKCC number/suffix. Roster
   suggestions remain editable, and explicit clearing stays cleared. Record
   approved keying or mark the received exchange qualifying only when known.
5. Add **SKCC Companion** through Edit Layout → Add a Panel. It shows current
   operation goals, member opportunities, imported-history totals and the next
   three sessions. Saving a contact or reopening the operation refreshes its
   log snapshot; typing a call does not rescan the log.

Detailed controls record the actual operator call, key, power, speed and event
region. QSO Party adds grid; Triple Key requires the explicit on-air key
declaration. Duration awards use the logger’s start/end times. Station location
facts such as DXCC and continent must describe the contact’s operating location.
Neither roster QTH nor today’s membership suffix proves historical eligibility.

## Names and offline data

SKCC membership appears as additional notes in **Info** and in the companion
panel. It does not replace the compact logging name line or another source's
call note. Ham2K merges QRZ and other lookup sources normally. SKCC runs after
callbooks and Call History, offering a name only when those sources and the
explicit exchange have supplied none.
Roster SPC stays a labeled hint rather than replacing the station's location.
The activity's separate exchange fields still suggest the roster name, SPC
and member number for confirmation on air.

The extension automatically uses the official
[SKCC skimmer roster](https://www.skccgroup.com/skimmer-data.txt). It contains
names, member numbers, current and former calls, status, locations and the
dates needed to evaluate historical awards. Native Data Files provide daily
refresh eligibility and the durable offline cache. Failed or suspiciously
truncated replacements retain the last good roster. There is no source setting.

SKCC also publishes a [rich member file](https://skccgroup.com/membership_data/skccdata.txt)
and an [N1MM call-history download](https://skccgroup.com/member_services/files_and_downloads/N1MM/n1mm.php).
The parser understands both rich roster layouts, but the extension downloads
the skimmer file because it includes explicit membership status. Member numbers
are canonical identities; reused or ambiguous calls need the received number.
The directory is fetched as reference data, not bundled into a release.

## Spots and finding contacts

Install/enable RBN and choose its **SKCC members** station filter. The companion
panel can also show members from any enabled CW spot source, newest per call and
band, prioritizing possible C/T/S needs. Its optional WPM limit excludes unknown
speeds. A detection means the station was heard; it does not prove approved key
use, availability, participation in an event, or eligibility for your award.

The native spots board supplies call selection and radio integration. The
companion list is read-only. Potential needs use either selected-operation
contacts or an explicitly dated imported-history snapshot. It can explain how
your status might help another operator without claiming to know their log.

The [SKCC Sked Page](https://sked.skccgroup.com/) is linked for arranging
contacts. Its undocumented status endpoint is not polled or republished.
**SKS is unassisted:** the companion hides opportunities for an SKS operation,
but cannot disable the host’s spots/chasing or another extension. Close those
sources and sked assistance yourself.

## Activities and scoring

| Activity | Support |
| --- | --- |
| Everyday SKCC | Exchange, personal unique-member target, award opportunities |
| WES | Second-Saturday 36-hour session; standard base estimate and reviewed theme score |
| SKS | Fourth-Wednesday 0000–0200 UTC; unassisted policy and reviewed designated bonus station |
| SKSE | First Thursday with seasonal UTC start and explicit ≤12 WPM extended-edge eligibility |
| SKSA | Second Friday 2200–2400 UTC; received `/BD` birthday evidence |
| Slow Speed Saunter | First UTC day of the month; contact count, not a contest score |
| QSO Party | June session, received four-character grids and explicit photo/soapbox bonus |
| K3Y | January activity; separate event calls and personal operator identities, local area checklist |
| Canadian Straight Key Month | September activity; received `/CSKM` name evidence and province/territory checklist |

Recurrences are planning aids; confirm the current edition’s official rules.
WES/SKS/SKSE/SKSA scores remain estimates until the edition is reviewed in
operation setup. Select standard rules, a manually calculated additive theme
bonus, or an independently reviewed final score for a special formula. The
extension does not infer changing monthly themes. Native scoring and exported
worksheets explain duplicates and contacts needing evidence. Submission remains
on the sponsor’s site.

## Award audit and application worksheets

The audit evaluates **Centurion, Tribune, Senator, WAS and C/T/S variants,
DXC, DXQ, PFX, 1×QRP, 2×QRP, Rag Chew, Marathon candidates, Triple Key,
Monthly Brag, K3Y, CSKM and WAC**. It checks historical membership/status dates,
deduplicates by member identity, uses received locations, selects PFX points,
and assigns Triple Key members to disjoint key groups.

Use **Analyze a complete SKCC ADIF log** in settings to paste an ADIF export
(up to 5 MB). Confirm explicitly that it contains complete history. An optional
attestation applies only to SKCC-tagged CW records lacking keying evidence; it
never changes an explicit negative or cleared value. Without that attestation,
ordinary ADIF `SKCC` membership data alone does not earn manual-key award credit.

Analysis reads a copy and does not insert contacts into the logger. A bounded,
dated summary persists on this device. It is not a live cross-device ledger and
does not grow when new contacts are logged. Reanalyze after logging more contacts
or refreshing the roster. Full worksheets are available while the analysis is
loaded; after an extension reload, reanalyze the file to restore its detailed
rows. No application is sent automatically.

Exports provide an ADIF round trip, exchange worksheet, event score report,
per-program CSV review sheets, and an audit explaining selected/excluded
contacts. Export choices explicitly distinguish **this operation only** from
the **loaded complete-history analysis**. Standard `SKCC` and Morse-key fields
coexist with `APP_N1RWJ_SKCC_*` evidence and clear markers. Application worksheets
are review aids, not sponsor-approved templates.

Known boundaries:

- Thresholds mean ready to review, never that an award has been approved.
- Brag excludes sprint overlaps conservatively, including WARC. Verify older
  schedules and the announced bonus member. Its bonus number is tied to the
  report month and cleared when that month changes.
- Marathon candidates require sponsor confirmation and manual review of
  location/band rules. K3Y/CSKM checklists do not claim official confirmation.
- DX reports conservatively exclude domestic and maritime/air-mobile cases;
  territorial exceptions need manager review. WAC selects one origin continent.
- Unsupported or missing facts remain reasons for exclusion rather than guesses.

## Experimental native Chasing

On hosts with **EXP CHASE** enabled, native lifetime checklists cover C/T/S,
WAS variants, DXC/DXQ and both QRP programs. The host owns their persistent,
cross-log claims. They use factual saved contacts, not hypothetical spot credit.
Native ADIF imports also require recorded evidence and do not assume that a
selected file is your complete history.

Native claims freeze one available roster for consistent evaluation. After a
roster update, toggle **Reload the native chasing roster** in SKCC settings,
then turn **EXP CHASE off and on** on a device with the complete log. This asks
the host to rebuild history; an extension reload alone does not rebuild an
unchanged program version. Missing roster data fails explicitly rather than
replacing existing claims with an empty result. Companion audits use the current
roster independently.

## Sources and verification

Official rules: [Centurion](https://www.skccgroup.com/operating_awards/centurion/),
[Tribune](https://www.skccgroup.com/operating_awards/tribune/),
[Senator](https://www.skccgroup.com/operating_awards/senator/),
[key policy](https://www.skccgroup.com/keypolicy.php),
[Monthly Brag](https://www.skccgroup.com/operating_activities/monthly_brag/),
[WES](https://www.skccgroup.com/operating_activities/weekend_sprintathon/),
[SKS](https://www.skccgroup.com/operating_activities/weekday_sprint/),
[SKSE](https://www.skccgroup.com/operating_activities/skse/),
[SKSA](https://www.skccgroup.com/operating_activities/sksa/),
[QSO Party](https://www.skccgroup.com/operating_activities/QSO_Party/).

Deterministic tests cover roster refresh/failure, aliases, corrections and
clearing, event boundaries, evidence round trips, award eligibility, duplicate
selection, native claims and history/report scope. Live roster parsing has also
been checked. See the repository [verification record](../../../../docs/VERIFICATION.md)
for release checks. Installed native UI, cross-device rescan and on-air use are
separate acceptance tests and have not been established by unit tests.

Settings sections remember which groups you fold. The member roster is persisted
and replayed by native Data Files; no full roster is written to extension KV.
