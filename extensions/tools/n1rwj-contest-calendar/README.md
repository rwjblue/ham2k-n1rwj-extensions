# Contest Calendar

An optional Home panel showing active and upcoming contests from
[ContestClock](https://contestclock.com/), with UTC or device-local times,
mode filtering, saved contests, and links to sponsor rules. Ham2K manages its
calendar download as a Data File. It is available
on all screen sizes; installing the extension does not add it to any layout.

This extension is prepared for v0.9.0. Until that release is published, build
from this workspace to try it:

```sh
mise run install
mise run pack n1rwj-contest-calendar
```

Install `dist/n1rwj-contest-calendar-0.9.0.h2kext` using **Settings → Features &
Extensions → Install from file**. The app must support extension API 5 and native
panel scenes. On **Home**, choose **Edit Layout → Add a Panel → Contest
Calendar** and save. Enable **Layout Customization** in app settings if needed.
The same panel can also be added to other customizable layouts.

The panel shows a bounded set of contests with paging, selected details, and
Save/Unsave controls. Small panes and large text use **Browse calendar**, which
opens a native form with the complete calendar and sponsor links.
Choose **UTC** or **Local**, filter by mode, or show only saved contests. Saved
preferences belong to that panel placement and survive app restarts. A missing
scene environment uses a simple Markdown agenda.

## Calendar data and offline use

The extension registers **Contest Calendar** in **Settings → Data Files**.
Ham2K downloads the default thirty-day calendar from ContestClock and makes it
eligible for automatic refresh after **seven days**. The host checks eligible
files at startup, reconnection and extension runtime restarts; this is an age
threshold, not a weekly background timer. Use the Data Files screen to refresh
manually or remove the download.

The pane shows fourteen UTC calendar days from today, including ongoing
contests. **Browse calendar** shows the full downloaded calendar. Thirty days
of downloaded coverage leaves enough future data for a complete fourteen-day
preview throughout a normal weekly refresh cycle. The panel updates event
status each minute without downloading anything.

On native desktop/mobile hosts, Ham2K saves successful data files to disk and
replays them after restart, including offline. Failed downloads or invalid
updates retain the last usable data. The panel labels old data and warns when
its downloaded window no longer covers the full preview; native download
errors appear through Ham2K's Data Files UI. The web host does not persist raw
data files to disk. Placement preferences use persistent extension settings.
No operation log is read or changed.

Separate contest sessions remain separate. Local rolling events retain their
published local schedule rather than receiving an invented UTC time. Source
verification flags are shown, but do not guarantee accuracy. Coverage is
incomplete, and known provider metadata errors exist; confirm schedules with
the sponsor before operating. This extension does not display or reinterpret
contest exchanges, scoring, or permitted bands.

Calendar data is by Joe Leone, W4GGJ, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See the
[API documentation](https://contestclock.com/data) and
[bundled attribution](assets/CONTEST_CALENDAR_ATTRIBUTION.md). Sponsor rules
remain authoritative. No WA7BNM content is fetched or copied.

## Verification scope

Deterministic tests exercise parsing, sessions, managed-file conversion/replay,
weekly age and coverage, panel controls, responsive geometry, timezone rollover,
and the built ES2020 bundle through the published SDK bridge. These checks do
not establish native
app installation, layout, keyboard, screen-reader, or production-network
acceptance; see the [verification record](../../../docs/VERIFICATION.md).

UTC is the default. Local time uses the device's native JavaScript Date
implementation. The examined macOS/iOS QuickJS implementation uses offsets for
each instant; the examined Windows implementation uses the current DST state,
which can affect future times across a daylight-saving boundary. Use UTC when
that runtime limitation applies.

```sh
mise run test -- extensions/tools/n1rwj-contest-calendar/tests
mise run check
mise run verify-host n1rwj-contest-calendar
```

This independent calendar tool changes no official CWT or CQ WW runtime
behavior and is exempt from synchronization to those contest PRs. Version 0.9.0
is synchronized with the monorepo; its authored release notes include a Contest
Calendar section without rewriting historical release notes.
