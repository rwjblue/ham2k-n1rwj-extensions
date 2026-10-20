# BIGFOOT Hunt

BIGFOOT Hunt tracks the Radio Club of Tacoma's National Sasquatch Day special
event in Ham2K. The independently installable extension has key
`n1rwj-bigfoot` and activity type `bigfoot`. Work the event stations to spell
**B I G F O O T**, with **W4S** as the separate Skunk Ape bonus. Mixed, CW,
Phone, and Digital progress are tracked independently, so an SSB contact can
help your mixed-mode completion while you continue the CW hunt.

## Event and setup

The organizer runs the event annually, but this extension includes only the
confirmed **2026** edition: **October 13 at 00:00 UTC through October 21 at
23:59 UTC**, including the final minute. The ending time is **Wednesday,
October 21 at 7:59 p.m. EDT**. Future dates, station rosters, and rules require
an updated event profile; they are not inferred from the calendar.

Check the [organizer's announcement and rules](https://w7dk.org/?view=article&id=319:3rd-annual-national-sasquatch-day-special-event&catid=185)
for current event details.

1. Download `n1rwj-bigfoot-0.11.0.h2kext` from the
   [v0.11.0 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.11.0).
   Install it using **Settings → Features & Extensions → Install from file**,
   then enable **BIGFOOT Hunt**. Building from source with
   `mise run pack n1rwj-bigfoot` is also supported.
2. Create a dedicated BIGFOOT operation and add **BIGFOOT Hunt 2026**.
   Keep its event contacts together so the activity can track and export them.
3. Log the callsign, UTC date/time, band, actual mode, and sent/received reports
   for each contact. Confirm the callsign and exchange by ear or from the
   decoded transmission before saving.
4. Read the native activity score summary for progress. For a fuller view,
   choose **Edit Layout → Add a Panel → BIGFOOT Hunt**. Enable layout
   customization in app settings if layout editing is unavailable; on narrow
   screens, **Edit Layout** is under **Tools**.

## Letters and the second O

| Slot | Station |
| --- | --- |
| B | W7B |
| I | W7I |
| G | W7G |
| F | W7F |
| First O | W7O |
| Second O | W7O, with a qualifying difference |
| T | W7T |
| Skunk Ape bonus | W4S |

The two W7O contacts must differ in **band, mode, or UTC date**. For example,
W7O on 20m CW and 40m CW fills both O slots in the CW and Mixed views. W7O on
20m CW and 20m SSB fills both in the Mixed view, while each same-mode view
still needs another qualifying W7O contact. Another W7O contact on the same
band and mode counts when it is on a different UTC date.

Mode comparisons use the actual logged mode after normalization. USB and LSB
are both SSB, so switching sideband alone does not qualify as a second mode.
Distinct digital modes remain distinct for the W7O rule, even though the
Digital progress view groups them together. Refer to the organizer's rules
for certificate categories and the same-mode challenge.

Progress includes only eligible event-station contacts within the 2026
window. Deleted contacts and repeated W7O contacts without a qualifying
difference do not add letters. The bonus is displayed separately and does
not replace a missing letter. The panel refreshes from the operation log
when contacts are logged, edited, or deleted.

## Finding stations

Keep the [organizer's spotting page](https://w7dk.org/?view=article&id=309&catid=178)
and [Reverse Beacon Network](https://www.reversebeacon.net/) available while
operating. Spots can guide your hunt; confirm the callsign on air before
logging. This extension tracks your contacts and provides those links; it
does not retrieve a live station schedule or tune your radio.

## Export and certificate

Use **BIGFOOT ADIF** for eligible event contacts or **BIGFOOT worksheet (CSV)**
to review UTC dates/times, callsigns, bands, modes, and reports. Exports include
eligible contacts, including additional contacts that do not add a letter.
They exclude other stations and contacts outside the event window. Review
the selected contacts and reports before submitting your certificate request.

The worksheet helps prepare the
[organizer's request form](https://w7dk.org/images/rct_special_events/BIGFOOT_QSO_SHEET.pdf);
it does not replace the form. The organizer offers a certificate for even one
event contact. Send the completed request and **$5**, to arrive by **November
30**, following the organizer's instructions. The extension does not upload
logs, submit certificate requests, or process payments.

## Development and verification

```sh
mise run build n1rwj-bigfoot
mise run pack n1rwj-bigfoot
mise run test -- extensions/activities/n1rwj-bigfoot/tests
mise run verify-host n1rwj-bigfoot
mise run check
```

Deterministic tests exercise event boundaries, callsign and mode handling,
letter selection, the second-O rule, scoring, panels, and exports. Bundle
tests and evaluation against an installed Ham2K JavaScript kernel check
compatibility with that execution environment. These are separate from
installing the bundle and checking the native activity, panel, export
controls, and on-air logging in Ham2K; automated checks alone do not establish
native UI or on-air verification.

BIGFOOT Hunt is a standalone special-event activity. It does not change CWT
or CQ WW behavior and does not require synchronization with either temporary
upstream contest branch. See the repository [license](../../../LICENSE) and
[notices](../../../NOTICE.md).
