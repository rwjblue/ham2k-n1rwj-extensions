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

1. Download `n1rwj-bigfoot-0.13.1.h2kext` from the
   [v0.13.1 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.13.1).
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

## Forest scene

Version 0.12.0 upgrades the optional **BIGFOOT Hunt** panel
to an illustrated forest with a friendly Bigfoot, glowing fireflies,
seven letter tiles, and a separate Skunk Ape card. Add it once with
**Edit Layout → Add a
Panel → BIGFOOT Hunt**; an existing Hunt panel keeps its saved placement.
The built-in Info display works independently of this optional panel.
Leave the scene visible while hunting to see celebrations as contacts count.

**Catalog previews (v0.12.1):** the Extensions listing introduces the animated
forest and CW/Mixed hunt with friendlier copy; **Add a Panel** shows a static
forest illustration. Tap its thumbnail to enlarge it. The picker shows fixed
artwork; your operation's logged progress appears in the added panel.

CW is the default focus, with Mixed progress alongside it. Gold tiles show
letters earned in the selected mode. A small gold dot marks a letter earned
in Mixed but still needed in that mode. The two O tiles remain independent,
and only a qualifying second W7O fills O₂. The Skunk Ape never replaces a
letter.

A newly earned letter makes Bigfoot hop and wave for four seconds. New
letters sparkle, the Skunk Ape celebrates its own bonus, and completing
BIGFOOT lights up stars. Opening the panel, switching modes, editing
an existing contact, or logging a repeat does not replay an award. **Wave
hello** gives Bigfoot a greeting without changing the log or earning credit;
very short panels hide that button to preserve readable progress.

Panel settings offer **Hunt mode**, **Forest scene / Detailed checklist**,
and **Animate the forest and celebrations**. System reduced-motion settings
also keep the scene still. The detailed checklist retains contact dates,
bands, modes, and both O contacts' evidence. Older hosts without scene
environment support show that checklist automatically.

## Finding stations

Version 0.13.0 integrates cached spots into the existing **BIGFOOT Hunt**
forest. Your saved Hunt panel keeps its placement; there is no separate spots
pane. Enable a logger spot source to supply reports. This version requires
**extension API 7** and requests **radio-write permission** for click-to-tune.

Teal antenna markers identify freshly spotted letters. Bright markers mean
the report would advance your selected hunt mode; muted markers mean that
station is already satisfied on the reported band, mode, and UTC date. Gold
letter fills and the lower gold Mixed-only dot still represent logged credit.
W7O marks only the next missing O; a single report never fills both slots.
The existing Skunk Ape card shows W4S reports too.

Bigfoot's journal shows a current station lead, its frequency, band, and mode.
When CAT control is connected and ready, select a marked letter or the
journal's **Tune** button to request tuning of the logging radio. **Enter the callsign in the logger manually**;
the SDK cannot populate that field from this panel. Tuning uses a supported
matching radio mode when available, otherwise the status asks you to set the
mode manually. A disconnected or unavailable radio leaves the callsign and
frequency visible for manual operation. The panel reports request acceptance,
which is separate from confirming the hardware's final frequency.

Starting with **0.13.1**, the forest checks CAT availability before showing
Tune. It shows **Connecting…** while the radio connects and **Manual tuning**
when no usable CAT connection is available, including stale readings or a
radio that is transmitting. Callsign and frequency stay visible, and marked
letters select a station without tuning in these states. Availability refreshes
every five seconds while a fresh lead is visible; the host pauses these checks
when the panel or app is hidden. Radio state is checked again on an actual
tuning click, so a connection loss cannot rely on the earlier UI snapshot.

On narrow panels, use **Next spot** in the journal to browse stations, then
**Tune**; very short panels show one compact lead. Earned-letter celebrations
take priority briefly. Radio changes occur only after a click, and expired
reports cannot silently redirect a tuning click to another station.

The existing **Hunt mode** setting also filters spots. Defaults are **CW**,
the last **15 minutes**, and **Follow Spots filters**. Settings offer 5/30-minute
windows and **All cached spots**, which bypasses native board filters only
for this forest. It cannot restore reports excluded by the source, and it
does not fetch new reports or change the native Spots page. The detailed
checklist includes a compact station list for manual tuning.

The newest valid report per callsign is shown. Frequencies are in kHz and
must match the reported band. Needed status uses this operation's contacts
and the current UTC date, including both O contacts' exact rules. Native
worked flags do not hide a useful second O. Reports age out while visible;
spot and log changes refresh the view without reading the log every tick.
No matching reports means the cache has no fresh lead, not that a station is
off air. Missing host support or temporary spot failures preserve progress.

Station annotations and the BIGFOOT-only RBN filter are available starting
with v0.11.1. Install or update both **BIGFOOT Hunt** and **N1RWJ RBN** to
use the filter.

In a **BIGFOOT Hunt 2026** operation during the event, letter stations receive
a paw marker and W4S receives a skunk marker. Station details identify the
letter or bonus; W7O's note explains the two-contact rule. These annotations
use the exact published callsigns and do not change exchanges or station
identity information.

Native Spots highlights a target when that band, mode, and UTC date would
advance Mixed, CW, or the spot's actual-mode progress. A second W7O on the
same band, actual mode, and UTC date remains a duplicate; another eligible
band or UTC date can fill the second O on CW. A worked Mixed target can still
be highlighted when needed for a same-mode completion. The host calls this
highlight **New Mult**. The BIGFOOT panel shows the detailed CW, Mixed, and
same-mode progress, including the first and second O evidence. Needed
highlights recalculate through native scoring when the spot context or log
changes, including edits and deletion of the last contact.

The compact marker identifies the station; it does not change to show needed
status because the native Spots panel caches these markers. Use the highlight
or BIGFOOT panel for progress.

Version 0.12.0 also enriches the built-in **Info** pane with emoji. While
entering an event callsign, its Notes show 🌲🐾 event identity, 🔤 letter or
🦨 bonus details, and W7O's ⭕/🔁 two-contact rule. With the call field idle,
the scored hunt summary shows 📻 CW and 🧩 Mixed counts, ✅ worked/🔎 needed
status for every letter and both O contacts, a separate 🦨 bonus row, and
🎉 completion banners. CW and Mixed completion remain independent. No extra
panel is needed. A new empty operation has no scored Info summary until its
first contact; entering a target still shows its event notes immediately.

Keep the [organizer's spotting page](https://w7dk.org/?view=article&id=309&catid=178)
and [Reverse Beacon Network](https://www.reversebeacon.net/) available while
operating. Spots can guide your hunt; confirm the callsign on air before
logging. This extension tracks your contacts, provides those links, and can
display the logger’s cached reports in the forest and request radio tuning
when you select a lead. It does not retrieve a live station schedule.

With **N1RWJ RBN** enabled, choose **Settings → RBN → Station filter → BIGFOOT
2026** to see only spots for the BIGFOOT 2026 station roster: W7B, W7I, W7G,
W7F, W7O, W7T, and W4S. **All calls** remains RBN's default. Choose **CW**
under **Spot mode** for a CW hunt, or keep **All** for RBN's supported modes.
RBN does not supply SSB reports; use the organizer's spotting page for those.

The BIGFOOT 2026 station roster is bundled, so the filter needs no history
download. Its availability means the roster is installed, not that its stations
are currently active. It includes worked and unworked targets. Your selection
persists across operations and remains available outside the event dates; it
does not automatically follow the active operation or select itself. Disable
the filter when you want other calls, because short event calls can be reused.

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
mise run bigfoot:preview
mise run check
```

`bigfoot:preview` writes a synthetic, interactive state browser to
`dist/bigfoot-scene-preview.html`, with companion scene JSON and the static
picker illustration at `dist/bigfoot-scene-preview-panel.svg`. It exercises
the actual panel hook with synthetic contacts, including narrow layouts,
both O rules, completion, greeting, and reduced motion. Its SVG text and
pose playback approximate the native view; it never accesses your logger
or radio.

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
