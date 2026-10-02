# N1RWJ RBN

See where the [Reverse Beacon Network](https://www.reversebeacon.net/) has
heard your CW, RTTY, FT8, and FT4 signals, with a reception map and sortable
receiver reports provided by [Vail ReRBN](https://vailrerbn.com/).
Requires Ham2K extension API 3 and native SVG panels.
The panel automatically follows your operation's station callsign and location.
It is read-only: it does not transmit, spot a station, post to POTA, or create
contacts.

Part of the [N1RWJ extension family](../../../README.md).

## Find stations in Spots

Opening **Settings → RBN** checks the
[Vail ReRBN health endpoint](https://vailrerbn.com/docs/endpoints#health).
A warning at the top explains a failed check, service or database problem,
or offline state. Settings remain editable while the check fails. The request
allows two seconds, shares RBN rate-limit backoff, and reuses its result for
one minute while you edit settings; reopen after that minute to retry.
Spots refreshes do not run health checks. A healthy API and database do not
guarantee live reports or a match for your filters.

Enable **N1RWJ RBN** and select **RBN** in the native Spots source filter.
Open **Settings → RBN → Spots — Who I might hear** to choose:

- **Allow merging of RBN spots:** on by default. Nearby stations can merge in
  the native Spots panel, and the extension contributes no RBN activity control.
  Turn it off when hunting individual stations, for example during CWT, to keep
  spots separately selectable and enable the RBN logging control. The choice
  survives restarts and applies on the next Spots refresh, including cached reports.
- **Call-history filter:** **All calls** is the default, with no history filter.
  Choose CWT, MST, or SST explicitly when you want that call-history filter.
  A selected missing extension or file
  produces no spots, with an explanation in RBN settings. An explicit choice
  survives restarts; filters do not switch automatically with the operation.
- **Spot mode:** All (default), CW, RTTY, FT8, or FT4. Choose **All** to
  receive all four supported modes and use the native Spots page's mode filter.
  The host currently groups RTTY, FT8, and FT4 under **Digital**; choose RTTY
  here when you want only RTTY reports. Previously saved mode choices are preserved.
- **CW speed range:** optional minimum and maximum WPM, including the entered
  speeds. Both default to blank (no limit); either end can be left open.
  Limits apply only to CW, even in **All** mode. CW reports without a known
  positive speed are excluded while a limit is set; digital reports are unaffected.
  Speed filtering reuses cached reports and runs before duplicate reports are
  collapsed. Vail ReRBN supplies `wpm` but documents no speed-range query parameter.
- **Only these skimmers:** IDs as reported by Vail, for example `KM3T`.
  Live comparison found that Vail omits numeric node suffixes: `KM3T-2`
  and `KM3T-3` requests return no reports, while `KM3T` includes the receiver
  family. Individual nodes cannot be isolated without their original IDs.
  Existing suffixed selections are preserved and show an explanatory notice;
  they are never silently widened to include other nodes.
- **Receiver grid regions:** Maidenhead prefixes, for example `FN, EM`, `JO`,
  or `FN42`. These select the receiving skimmers, not the spotted stations.
- **Receiver continents:** select one or more continents; an explicit empty
  selection allows all. On first use, device location suggests a continent when
  known receivers within 250 km all agree, otherwise the last nonempty selection
  is restored. This is an approximate local suggestion, not a boundary lookup;
  verify it near coasts and continental borders. Saved selections, including
  **all continents**, survive restarts and are never overwritten automatically.
  Uses the receiver's continent from the RBN directory. Refresh that data
  file after upgrading to populate this field in older caches. Unknown
  continents are excluded only while this filter is enabled.
- **Distance origin grid:** your 4, 6, or 8 character grid, such as `FN42FK`.
  This explicit origin is shared across operations; update it when you move.
- **Maximum receiver distance (miles):** a positive distance, such as `250`.
  Leave blank for no limit. Set the origin first; clear the limit before
  clearing its origin. Distances use the great-circle path between grid centers.

**Reset all spot settings**, at the top of that section, restores **All calls**,
allow merging, All modes, no CW speed limits, all skimmers and grid regions, the local/last
receiver-continent selection, and no distance limit or origin. The defaults are
listed beside the reset control. Resets remain available even when call-history
extensions have not loaded. Previously saved call-history choices are preserved
until you change or reset them.

Each filter also has a reset button naming its default. **Reset CW speed range**
clears both bounds; **Reset distance** clears both origin and limit, including
inconsistent saved values. **Clear continent filter — All continents** explicitly
allows every receiver continent, while **Reset continents** restores the local
suggestion or last nonempty selection. Resets update the settings form and take
effect on the next Spots refresh. They preserve My Signal settings, reception
caches, receiver data, and every other extension's settings.

Separate skimmers or regions with spaces or commas. Blank means unrestricted.
The initial continent suggestion may request location permission. It uses a
single device-location fix per runtime while the preference is unset, without
holding the settings screen or spot hook open. Spots wait for that attempt to
finish; after it completes, refresh Spots to apply the result. Denied or unavailable
location falls back to the last selection, or all continents if none is known.
No device coordinates are sent to a network service or saved in settings.
If the receiver directory loads later, the next settings view or Spots refresh
can use the same fix to suggest a continent, provided no explicit choice was made.
All these settings apply only to Spots, across operations. They never filter
the **My Signal** map or its receiver reports. The **My Signal — Who hears me**
section points to that panel's separate tune settings in your operation.
Every enabled filter must match; multiple entries within a filter are alternatives.
Receiver selection happens
before reports are collapsed to the newest station/band/mode observation.
Regions use the cached RBN directory grid first, then the report grid; unknown
locations are excluded when a region or distance limit is selected. Locations are approximate,
and reception by a nearby skimmer does not guarantee reception at your station.
These receiver filters remain RBN responsibilities when native contest-relevance
filtering replaces the temporary call-history bridge. The logger's native
continent filter applies to the spotted station, independently of these controls.

Reports cover ten minutes on 160, 80, 40, 30, 20, 17, 15, 12, and 10 meters.
Selections of up to 32 skimmers fetch reports separately for each receiver,
across all supported bands. Grid, continent, and distance filters also use
these receiver queries when the cached directory identifies up to 32 query IDs.
Geographic queries include the original directory IDs and their bare numeric
suffix families. Bare IDs use directory metadata only when every family node
agrees on that field, including any bare directory entry. Conflicting grids
are excluded from region/radius filtering rather than replaced by a registered
callsign grid. Continent disagreement remains unknown. Missing directory grids
retain the existing approximate report-grid fallback.
This selects your receivers before the response limit, so unrelated skimmers
cannot crowd out their reports. Each receiver query is capped at two pages of
1,000 reports; busy receivers can still exceed this snapshot, particularly
with digital modes.

Larger selections use the worldwide snapshot, capped at two pages of 1,000
reports per band before local filtering. Geographic selections without a
continent filter also retain this snapshot for receivers absent from the
directory whose report grids may match. In **All** mode, each query's report
limit is shared across modes. Requests are coalesced
and cached for at least a minute. Both Spots and My Signal honor shared API
rate-limit backoff. Offline or failed refreshes use only unexpired cached
reports, reapplying current filters. Changing receiver selections or loading
new directory entries chooses a fresh query on the next online Spots refresh.

A failed request keeps successful reports from other receivers or bands,
including a first page when the second page fails. RBN settings explains when
the refresh is incomplete. Unexpired cached reports fill gaps for failed
queries; a successful query replaces its previous reports, including an empty
result. Requests allow four seconds per page and retry on a later Spots refresh,
after at least a minute or the service's longer rate-limit delay. Restarting the
app clears the in-memory Spots cache and cannot resolve an unavailable service.

When comparing with the RBN website, choose **All calls** to remove the
CWT/MST/SST call-history restriction and compare the same ten-minute window,
band, and mode. A six-hour website view includes older reports; repeated
reports for the same station, band, and mode collapse to one spot here.

When **Allow merging of RBN spots** is off, the workaround for
[HALO-741](https://cabo.ham2k.com/halo/c/741) attaches an `rbn` reference
containing the full callsign, including portable suffixes. Different stations
on the same frequency stay separately selectable. HaLo copies this reference
when you select a spot for logging.

This also adds one collapsed **RBN** chip to the logging panel's secondary
controls and supplies the radar icon for new and saved RBN references. It does
not add operation setup or activity suggestions. Turning merging back on hides
the chip and omits RBN references from incoming spots; existing contacts retain
their references. Existing badges may use the generic icon while the control is
hidden. A mounted native panel may need reopening to reload its activity icons.
Unit and bundle checks cover these descriptors; native UI verification is pending.

There is no ADIF program-field or export handler for RBN. Export behavior
is unchanged: a custom template that explicitly displays all contact
references can still show the callsign, and QSON retains the references.

CWT, MST, and SST provide membership from their cached call-history files via
[the shared filter contract](../../../packages/spot-filters/README.md).
They do not fetch reception reports or expose exchange data. File membership
does not prove participation in the current contest. Band, age, mode, and
source controls in the native Spots panel further narrow these results.

## Install and open the panel

1. Use a Ham2K version supporting extension API 3 and native SVG panels. If the panel shows
   **App update needed**, update Ham2K before using it.
2. Download `n1rwj-rbn-<version>.h2kext` from the
   [latest GitHub release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/latest).
3. In Ham2K, open **Settings → Features & Extensions → Install from file**
   and select the downloaded package.
4. Open an operation, choose **Edit Layout → Add a Panel → My Signal**,
   and save the layout. On narrow layouts, **Edit Layout** is under **Tools**.
   If editing is unavailable, enable **Enable Layout Customization** in settings.
5. Leave **Watch callsign** and **Map origin grid** blank to follow the operation.
   Reports load automatically when the panel is visible.

No build tools, map accounts, or custom Ham2K build are required.

The info button beside refresh opens **Status** for the watched callsign,
window, latest report on the selected band, and last successful service check.
Warnings include refresh/retry guidance; **About** explains the observations,
sources, map origin, and refresh behavior. Closing info returns to the report
page you were viewing. See the
[design review and rendered mockups](../../../docs/RECEPTION-INFO-DESIGN.md).

## In Ham2K

Installing the extension makes **My Signal** available in the operation's
**Edit Layout → Add a Panel** menu. Choose its **+** button, place it in your
layout, and save.

![RBN · My signal in Ham2K's Add a Panel menu](../../../docs/images/rbn/rbn-add-panel.jpg)

The panel then appears alongside your other operation panels. This desktop
example shows the reception map and receiver table together:

![RBN map and receiver table in Ham2K](../../../docs/images/rbn/rbn-desktop.jpg)

Narrow layouts can show the map or receiver cards separately:

| Map view | Receiver list |
| --- | --- |
| ![RBN map in a compact Ham2K window](../../../docs/images/rbn/rbn-compact-map.jpg) | ![RBN receiver cards in a compact Ham2K window](../../../docs/images/rbn/rbn-compact-list.jpg) |

These native macOS screenshots show the compact layout in the local **0.3.2**
candidate, with live Vail ReRBN reports for WG1V observed from an empty TEST
operation. The candidate is not a published release artifact. The compact
examples use a narrow desktop window, not a phone. See the
[screenshot record](../../../docs/images/README.md) for capture versions and
the [verification record](../../../docs/VERIFICATION.md) for runtime coverage.
Physical phone and Linux runtime checks remain outstanding.

## Configuration is optional

The operation provides the defaults. Open the tune button beside the panel title
to change its settings; they are also available in **Edit Layout**.
**View** and the saved **Band** default live here. Tap **All bands** or the active
band in the panel summary to choose a band without opening settings.

![RBN view and band settings in Ham2K's tune dialog](../../../docs/images/rbn/rbn-settings.jpg)

| Setting | With the default settings | Optional change |
| --- | --- | --- |
| **Watch callsign** | Uses the operation's station callsign | Watch another exact callsign |
| **Map origin grid** | Uses the operation's latitude/longitude, otherwise its grid | Use a 4, 6, or 8 character Maidenhead locator |
| **Report window** | Last 15 minutes | Last 1, 3, 5, 10, 30, 45, or 60 minutes |
| **Band** | All bands | Select one band |
| **Minimum SNR (dB)** | Blank; no SNR filter | Show reports at or above a chosen SNR |
| **View** | Map and receivers | Map or receivers only |
| **Default sort / direction** | Newest reports first | Receiver, SNR, distance, frequency, or CW speed; either direction |
| **Map projection** | Fit reporting receivers | From my station · distance rings |

The callsign is the operation's **station** callsign, which can differ from the
operator's callsign. If the operation has multiple comma-separated station
callsigns, the panel uses the first. Portable suffixes match exactly: `K1ABC`
and `K1ABC/P` are different watched callsigns. The band selection does not
automatically follow the operation's active band.

**Minimum SNR (dB)** filters both the map and receiver list using the latest
report per receiver, band, and mode. A report exactly at the minimum qualifies;
reports with no SNR are hidden while the filter is enabled. Zero and negative
values are supported. Clear the field to show all reports again. The minimum
is saved per panel placement, appears in the panel status and Details, and
does not change RBN Spots, downloaded reports, or refresh timing.

With both overrides blank, switching operations follows the new station and
location. An explicit override stays with that panel placement until you clear
it, including when its layout is used for another operation. A callsign override
does **not** look up or change the map origin; set the corresponding grid when
watching a station elsewhere.

If the operation has no location, the receiver list still works. The map asks
for an operation location or grid override, and distance and bearing remain
unavailable. The extension never substitutes a callsign-prefix location guess.
If no valid callsign is available, it prompts for one without requesting reports.

View and band are saved per panel placement through the tune settings and survive
refreshes, operation changes, and restarts. Saving a different band keeps the
selected view. In-panel band and sort choices survive refreshes and unrelated
settings changes, and reset when switching operations or restarting the extension.
Saving a different Band or sort default applies to that control only. Choose the
Band in tune settings to keep it across restarts. Changing settings returns to
the first page.

## Map and receiver list

The map marks your station with a diamond and reporting receivers with circles.
Reception paths show where your signal was heard. Regional maps include
state/province boundaries and sparse country labels; light and dark colors keep
land and water distinct. Labels adapt to the available space, with receiver
callsigns taking priority over geographic captions.
Choose **Fit reporting receivers** in panel settings for a north-up map that
fits nearby and distant reports while keeping continent shapes recognizable, or
**From my station · distance rings** for a view centered on your station.
Distance rings appear only in the station-centered view. The fitted map uses
Natural Earth 1 and keeps reports near the date line together.
The map includes the selected band's located receivers across all list pages.
Receiver positions come from RBN node grids, with registered grids as a fallback, and may differ from the actual
skimmer location. Receivers without a valid grid remain in the list.

Use **View** in the panel's tune settings to choose **Map and receivers**, **Map**,
or **Receivers**, and **Band** to select a supported band or **All bands**, even
before reports arrive. The compact band summary above the map also opens a
native band menu; **All bands** restores the full view. Both the map and receiver
list follow this filter, and **Details** (ⓘ or !) shows timing for the selected
band along with map origin and provenance.
The list
contains the latest report from each receiver on each band and mode: mode,
frequency, SNR, CW speed
(for CW only), age, and—when
locations are available—estimated distance and bearing. The **Sort** menu offers **Heard**,
**Receiver**, **SNR**, **Distance**, **Frequency**, and **CW speed**. The adjacent
direction button reverses the order; missing measurements stay last. Previous
and next buttons move between pages, with the visible range and total count
shown below the reports.

Narrow panels show receiver cards; sufficiently wide panels put the map and
table side by side. Page size follows the available height and text size.
In a short pane, choose **Map** or **List** to give that view more room. The
information button opens **Report details** with timestamps, origin, source
attribution and warnings. Long details are paginated too.

## Refreshes and interpreting reports

While visible, the panel normally requests a scheduled render every 60 seconds
and automatically checks Vail ReRBN at most once per minute for each
callsign/report-window combination. The first render starts a due request and
returns cached reports immediately, or a checking status when there is no saved
result. Host timers start subsequent due requests while a placement remains
visible; they do not wait for the next display tick.
While that request is pending, the panel adds one-second render ticks. These
read the shared cache without starting another request. The first render after
completion shows the result and removes the fast tick, restoring the normal
60-second cadence.
Multiple panels watching the same query share results. Switching away does not
clear that cache: returning less than 60 seconds after the last request reuses
the reports. The cooldown starts at the request, not at the last tab visit.
Changing the callsign or report window can request a different snapshot immediately.

Use **↻** beside the Details button to check manually without waiting for the
next automatic refresh. It bypasses the local cooldown immediately. Concurrent
requests for the same query share one request, including repeated refresh taps.
The refresh action returns while the request continues, so panel controls remain
usable during the fetch. Refreshing preserves your view, band, sort, and page,
and the icon uses the existing status
row without taking space from the map. Offline state and server rate-limit
backoff still apply.

**Report details** puts refresh failures before the background explanation.
It distinguishes HTTP 429 rate limits, request timeouts, other HTTP errors,
invalid responses, and host-reported offline state. When the host rejects a
request without an HTTP response, its error message is shown (bounded to 300
characters); the extension does not assume that every failure is a connection
problem. Details show the last request attempt separately from the last
successful check, include the last completed request's duration, explain when
a local cooldown sends no new request, and give
whether manual refresh is available and the earliest automatic retry time.
Automatic checks require a visibility lease renewed by panel renders. Rate-limit backoff is shared with
other My Signal panels and RBN Spots; it is separate from the normal local
refresh cooldown. A timeout or missing host error detail cannot establish
whether the server throttled the request.

Request duration is an upper bound measured through the next render that
observes completion. The host supplies real-time samples during renders;
the sandbox's own clock can follow developer time travel. Normally the next
one-second tick supplies that sample, but hiding the panel can extend the bound.

My Signal supplies no request timeout override. The host owns the network
deadline; the inspected host allows 15 seconds for headers and then 30 seconds
for the body. HTTP runs independently of the five-second render/event deadline.
Rendering does not wait for HTTP. Per-render `triggers: ['tick:1']` uses the
host's wall-clock-aligned ticks;
it is not a one-shot timer or a request to fetch once a second. The SDK still
has no panel-refresh push API.

Each panel render renews a 75-second visibility lease, leaving room for the
normal 60-second display tick. Scheduled refreshes stop when the lease expires;
depending on the existing cooldown, up to two can follow the last render. The extension's `onHide` callback cancels
placement leases and polling; a fresh render resumes them. Timers never renew
their own visibility. Up to eight placements share one refresh timer, with
same-query requests coalesced. Eligibility is checked again after asynchronous
storage reads, so hidden, replaced or offline views cannot start delayed requests.
Already-started requests can finish and update their cache.

Relative timer delays do not use the sandbox's developer clock. Host real-time
samples still supply report ages and display timestamps. Native background,
foreground and sleep/resume behavior needs an API-3 host check; earlier render
visibility findings are recorded in the
[host verification and limits](../../../docs/RBN-SVG-MIGRATION.md#why-the-refresh-model-works).

The SDK does not expose device battery level, charging state, or Low Power Mode,
so the extension cannot automatically adapt the interval to those conditions.
A failed refresh retains cached reports within the selected
time window and marks the failure. Up to eight callsign/window snapshots (500
reports each) persist in the extension's settings for up to two hours. Restored
reports keep their original observation and check times and are marked cached
until a successful new request. Expired reports are removed on reading. Changing
a callsign or window never displays another query's reports.

The last request attempt is saved before fetching; the result is saved after
completion, including failed-attempt timing and the last successful snapshot.
The shared server rate-limit delay also persists across extension restarts.
A pending relative delay is conservatively reapplied after restart, so virtual
clock changes cannot bypass it; timer expiry clears the pending reservation.
Manual refresh bypasses only the local cooldown. Storage errors appear in
Report details and do not stop in-memory reception. These are persistent
`getSettings`/`setSettings` values, not the host's memory-only `kvGet`/`kvSet`.
Cached renders do not write storage. Scheduled requests save their attempt and
result, and rate-limit expiry clears the persisted delay.

After a long absence, the next visible render makes one request for the selected
time window, subject to server backoff. It does not replay missed polling
intervals. Rapid tab changes reuse results until a minute after the last attempt.
The native Spots report cache and polling cadence are unchanged.

A successful check with no reports
is different from a failed check. **Checked** and **Heard** show when data was
fetched and when your signal was last reported.

The simplified world geography is bundled in the package, so the map needs no
tile downloads or internet connection. New reception reports need internet
access. See [map attribution and licenses](../../../packages/reception/assets/MAP_ATTRIBUTION.md).

Reports come from the documented [Vail ReRBN HTTP API](https://vailrerbn.com/docs/endpoints)
at `https://vailrerbn.com/api/v1/spots`. Vail ReRBN receives both RBN streams:
CW/RTTY and FT8/FT4. Each check requests up to 500 recent reports within the
selected time window. The API searches partial callsigns; the panel keeps only
exact matches, including portable suffixes. If the API reports additional
matches beyond the returned rows, the panel warns that reports may be missing.
Band filtering and sorting reuse the fetched reports. If the service is
unavailable, the panel shows the failure and any unexpired cached reports.
Rate-limit responses pause requests across all panels until the retry delay
has passed.

Receiver positions and countries come from the public [RBN node directory](https://www.reversebeacon.net/nodes/),
matched by full receiver callsign, including skimmer suffixes, or by unanimous
directory metadata when Vail supplies a bare receiver-family ID. Ham2K downloads
and caches this as **RBN receiver directory** in **Settings → Data Files**.
The file becomes eligible for refresh after seven days, on the host's next
data-file sync (such as startup or reconnection); it is not a weekly timer.
Use Data Files settings to refresh sooner when a receiver is new or moves.
The saved directory loads offline, failed downloads or invalid data retain the
last good cache, and nodes absent from a later response are retained within a
10,000-node limit. Receiver IDs need not be callsigns: entries such as `UNKNOWN`
are retained and matched to reports by their exact ID, using the supplied grid.
Malformed receiver IDs are skipped. Directory updates apply to already-cached
reports on the next panel render. The panel's refresh button refreshes reports only.

Without a usable directory grid, positions fall back to `spotter_grid` supplied
by Vail ReRBN, which comes from the callsign's HamDB registered grid. It can
differ from the actual receiving location, especially for remote receivers. Map positions,
distances, and bearings are estimates. Missing or invalid grids leave receivers
in the list without a map point, distance, or bearing; the extension never
substitutes a callsign-prefix location.

SNR depends on each receiver's antenna and noise environment; comparisons at
the same receiver, band, and mode are most useful. Reception paths do not outline a
coverage boundary, and no recent reports do not establish a transmitter problem.
CW, RTTY, FT8, and FT4 reports are included without a mode filter. WSPR is not
provided by this source.
These My Signal reports are independent of the native RBN Spots source and
its call-history, mode, skimmer, continent, grid-region, and distance filters.

## Try it without transmitting

1. Choose a currently active CW station from the public
   [POTA spots](https://pota.app/) and note its reported grid or location.
   An active POTA spot does not guarantee a recent RBN report.
2. Create a separate, empty test operation with a station callsign such as
   `K1ABC/TEST` and a title such as **RBN TEST — observing K1ABC**.
3. Add the panel and set **Watch callsign** to the real public callsign, such
   as `K1ABC`. Set **Map origin grid** to that station's reported grid, or give
   the test operation that location. Keep the operation's `/TEST` marker; the
   panel displays a test notice identifying whose reports it is observing.
4. Inspect the map and list. Keep this observation operation empty, without
   logging fictitious contacts or using spot/CQ posting controls.

The examples are placeholders; choose a station active at the time of testing.
For building from source, static previews, native acceptance steps and the
earlier HTML investigation, see the
[development and migration notes](../../../docs/RBN-SVG-MIGRATION.md).


Restart/resume behavior is covered by deterministic tests and isolated SDK bundle
restarts using a simulated persistent host. Full app restart, offline resume and
background/foreground behavior still need a native Ham2K runtime check.
