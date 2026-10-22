# N1RWJ Zombie Shuffle

![Zombie Shuffle midnight radio club](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/download/v0.14.1/zombie-shuffle.png)

Log the 2026 Zombie Shuffle in Ham2K with its four-part exchange, two-hour
rebirth rule, call-history suggestions, score breakdown, ADIF, and a plain-text
submission summary. This extension is independently installable as
`n1rwj-zombie`, with activity/reference type `zombie`.

Download `n1rwj-zombie-0.14.1.h2kext` from the
[v0.14.1 release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.14.1)
and install it through Ham2K's extension settings. Building from source is also
supported:

```sh
mise run pack n1rwj-zombie
```

Create a dedicated operation, add **Zombie Shuffle 2026**, and configure your
sent exchange before logging.

## Midnight radio club

Version 0.14.0 adds an optional **Zombie Shuffle** panel:
a friendly graveyard, a headphone-wearing Zombie, and a warm radio shack.

Add **Edit Layout → Add a Panel → Zombie Shuffle** to a dedicated operation.
The scene shows your configured spooky name and number, qualifying QSO and
bonus counts, total score, and the four scoring groups. A lantern lights the
666-point Crummy Band bonus after the first qualifying contact. A new contact
gets a short shuffle; an eligible rebirth gets **BACK FROM THE DEAD!**, and
a copied `4321` bonus exchange gets sparkles and a party hat. **CQ BOO!**
waves hello without logging, transmitting, or awarding points.

The event timer counts down to the start, then local midnight, using the
event-day UTC offset and flexible-hours setting from setup. It refreshes once
per minute in the scene and detailed watch. The backdrop fills the host's
square panel surface, and the panel selector has an original illustrated preview.

Open **Settings → Activities → Zombie Shuffle** for call-history options and
an offline event overview and illustration, plus links to the official rules,
summary sheets and this guide. Hosts that predate the Activities settings
section show Zombie Shuffle as a standalone settings entry instead. The same
dialog is also available through Data Files.

The **Rebirth watch** shows when previously worked callsigns can count again
on each actual band. It updates once per minute while visible, with exact
eligible-at UTC times in the detailed watch. Only qualifying contacts start
or reset a timer. 10m and 15m keep independent timers even though their score
is combined. A contact whose next opening falls at or after local midnight
has no further rebirth in this event. **Eligible again does not mean on air.**

Panel settings offer **Graveyard scene**, **Detailed rebirth watch**, and
**Book of the Undead**, plus a motion switch. The book retains copied names,
leading-zero numbers, locations and band visits for qualifying contacts.
Narrow scenes prioritize callsign, band and countdown; very short panels hide
the mascot and greeting. System reduced motion keeps poses static. Older
hosts without the scene environment show the detailed watch automatically.
Opening or reopening a panel, changing its view, correcting a saved contact,
or restoring a previously seen record does not replay an award.

The native **Info** pane also gains a playful score breakdown and static
exchange identity notes. Current fields and history hints are labeled
separately; clearing a field suppresses its hint. Cached lookup notes never
claim a station is active or a rebirth is ready. Native scoring continues to
provide the current draft's duplicate and eligible-again messages.

For operations with start/break setup overrides, the panel shows guidance
instead of reconstructing a timeline the panel API does not supply. Native
scoring, Info and exports continue to use the canonical segment timeline.
Use a dedicated operation without such overrides for the scene and watch.

`mise run zombie:preview` writes `dist/zombie-scene-preview.html`, JSON
fixtures, and a static SVG. Its 18 synthetic states exercise celebrations,
rebirths, the book, small panels and reduced motion without accessing your
logger or radio. Browser text and animation are approximations of the native
renderer. Installed-app UI and on-air acceptance remain pending. Fresh-spot
lanterns and radio tuning are a later increment; this panel makes no radio
or network calls.

## Event rules

The [official 2026 rules](https://www.zianet.com/qrp/ZOMBIE/pg.html) specify
October 30, **15:00 to midnight local time**, CW at **5 W or less**, on
80, 40, 20, 15, and 10 meters. Spotting and skeds are allowed. The organizer
allows flexible hours for Hawaii, Alaska, and DX stations. Only the confirmed
2026 edition is supported; subsequent event dates and bonus numbers need review.

Set the event's UTC offset explicitly, including daylight-saving time for
October 30. For US Eastern daylight time, use `-04:00`. Logged timestamps remain
UTC. The **Flexible hours** option uses the whole October 30 local calendar
date for HI, AK, or DX. This is the extension's interpretation of the organizer's
flexible-hours allowance.

You may work the same callsign on the same band again after **two elapsed
hours**. For example, a qualifying contact at 19:42 permits another at 21:42.
Different bands qualify independently, including 10m and 15m even though those
two bands share a scoring group. Deleted, ineligible, and incomplete contacts
do not consume a qualifying rebirth slot.

## Exchange and logging

The on-air exchange is **RST, state/province/country, Zombie number, Zombie
name**, such as `569 KS 002 OLD NICK`.

| Part | Stored meaning |
| --- | --- |
| RST | Ham2K's native sent and received reports |
| SPC | The copied state, province, or country text |
| Zombie number | The copied numeric string, preserving leading zeros |
| Zombie name | The full spooky name, including spaces |

Your assigned number lasts for life. Stations without one may send their
three-digit telephone area code. The number is fixed exchange text, never an
incrementing QSO serial. In 2026, designated bonus stations send `4321`.
The setup keeps your regular number separate from bonus-station status and
each saved contact retains its effective sent exchange.

Copy the exchange actually transmitted. SPC accepts full country names and
unusual locations rather than SST's two-letter/DX rules. Zombie names are
independent of ordinary callsign-directory first names. Corrections and
intentional clearing take precedence over suggestions. Use **Wipe** between
contacts and log one callsign at a time.

When Zombie history has no SPC, an untouched SPC field can default from the
host's callsign lookup: a known state/province for US or Canadian stations,
or a country for DX. A portable call does not borrow an unconfirmed home-QTH
state. An ordinary directory name never supplies a spooky name or Zombie number.

The inline controls use **Space** to advance focus. In SPC or Zombie name,
type **`_` for a space**: `NEW_ZEALAND` becomes `NEW ZEALAND`, and `OLD_NICK`
becomes `OLD NICK`. Pasting text containing actual spaces also preserves it.
These two fields reserve underscore as a word separator. The native transform
order was checked against host source; actual device entry remains acceptance
work.

## Call history

Refresh **Zombie Shuffle N1MM call history** through Ham2K's data-file settings.
The default source discovers the latest published Zombie file in the
[N1MM call-history collection](https://n1mmwp.hamdocs.com/mmfiles/categories/callhistory/).
A Zombie-specific search keeps older files discoverable when newer contests
fill the site's first page. Saved category URLs use that same filtered search;
explicit entry and text URLs are kept as selected.
A new file is not assumed to appear annually. The last successful download is
retained for offline use and after a failed replacement. Refreshing data, rather
than typing a callsign, performs network requests.

Suggestions use the current operation, then copied exchanges from other
operations in this event, then the downloaded file, and finally older Zombie
contacts. Each field is resolved independently. A base callsign may supply a
number or name for a portable call; a previous location requires an exact
callsign match.

The verified [ZOMBIE_004.txt](https://n1mmwp.hamdocs.com/mmfiles/zombie_004-txt/)
was updated October 18, 2025. It contains 66 callsign entries with names,
numbers, and locations. Four entries contain the 2025 bonus value `3333`.
Those stations retain their name and location suggestions, while their old
bonus number is omitted. It is never converted to the current `4321`.
The file's revision suffix and download date do not identify an event year.

Historical bonus filtering also applies to older Zombie contacts used as
suggestions, without changing saved exchanges or explicit operator input.
An unknown source edition is handled conservatively for known bonus values.
See the data-file status for the source date and parsing warnings.

## Scoring

The formulas were checked against both official 2026
[XLS](https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.xls) and
[ODS](https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.ods) summary sheets.
There are four groups: **80m, 40m, 20m, and combined 10m/15m**.

```text
Group score = (eligible QSOs + eligible bonus contacts) × received-number sum
Total = sum of group scores + 666
```

The QSO count includes bonus contacts. The received-number sum includes each
bonus contact's `4321`. SPC and names are required exchange fields but do not
earn multipliers. Leading zeros are preserved in exchanges and interpreted
numerically only when calculating points.

For example, three valid 40m contacts sending `111`, `222`, and `4321` earn
`(3 + 1) × (111 + 222 + 4321) = 18,616`, then the fixed **666** points produce
**19,282** with no other contacts.

Two implementation decisions are explicit:

- Each eligible rebirth contact with a bonus station adds another bonus count.
  The published wording does not clarify whether that tally is unique stations
  or eligible contacts; the extension counts eligible contacts consistently.
- An empty eligible log scores **zero**. The sponsor's blank spreadsheet shows
  its fixed 666 even before any entries; this extension applies it after the
  first qualifying contact.

Incomplete exchanges (including the received CW signal report), invalid calls,
deleted contacts, unsupported modes/bands,
duplicates, and contacts outside the configured event window earn no points.
Correct flagged entries before reporting a score. Setup and contact timestamps
must be usable to establish eligibility.

## Export and submission

Use the operation's exports for **Zombie Shuffle ADIF** or the **Zombie Shuffle
summary**. ADIF retains sent and received exchange text and native reports.
The summary supplies the four group calculations and final total for review
and copying into your submission.

The sponsor requests a summary, not a full log, at `na5n@zianet.com` with Zombie
in the subject. Submission is manual. The current rules page still prints a
November 15, 2025 deadline; no confirmed 2026 deadline is encoded here.

## Development and verification

```sh
mise run test -- extensions/contests/n1rwj-zombie/tests
mise run typecheck
mise run check
mise run verify-host n1rwj-zombie
mise run zombie:preview
```

To regenerate the offline About illustration and `dist/zombie-shuffle.png`,
run `mise run zombie:about-art` with ImageMagick 7 and `chrome-headless-shell`
available, or set `ZOMBIE_ART_CHROME` to its executable path. The generator
uses a fresh temporary browser profile and the original picker SVG.

Unit, bundle, and installed-kernel verification do not establish native UI or
on-air acceptance. See the repository's [verification record](../../../docs/VERIFICATION.md)
for checks actually completed. Native installation, transformed/pasted multiword entry,
the two-hour boundary while a spot remains visible, export save/share behavior,
and on-air use remain acceptance work.

The new extension consumes the existing generic N1MM and contest-history
libraries without changing CWT or CQ WW behavior. It is exempt from those
extensions' temporary upstream synchronization requirements. The project and
retained shared-source notices remain MPL-2.0; SDK/build-tool MIT notices remain
in the packaged attribution.
