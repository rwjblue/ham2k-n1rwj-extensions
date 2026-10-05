# RBN activation exports

Enable N1RWJ RBN, use **My Signal** during your activation, then open the
operation's **Exports** view. The extension offers:

| Export | Purpose |
| --- | --- |
| HTML reception report | Offline maps, receiver timelines, collection history, and nearby reception evidence at contact time. |
| Markdown summary | Readable receiver statistics and UTC quarter-hour timelines. |
| Observation CSV | One row per distinct provider observation, with measurements, timestamps, and location provenance. |
| Collected-evidence JSON | Original provider rows, normalized observations, retrieval attempts, warnings, and normalized contact context. |
| SVG map | A portable text-based image of recorded receiver sites. |
| Contact-context CSV | One row per contact, including matched receiver evidence or an explicit unmatched reason. |

The HTML report is selected by default. ZIP and PNG need binary support in
the host's extension export workflow, tracked in
[HALO-757](https://cabo.ham2k.com/halo/c/757); SVG works through the existing text
contract. The extension supplies content to Ham2K's normal save/share workflow.
It does not create an ADIF contact or modify the log.

## What the report means

Each timeline cell contains the median reported SNR and number of distinct
observations for one receiver, band, and mode in a fixed fifteen-minute UTC
window. Repeated downloads of the same provider ID count once. Low SNR and
unknown SNR remain in the evidence; display filters never filter recording.
The report keeps bands and modes separate. SNR is most useful when compared
at the same receiver, where antennas and noise are more consistent.

A blank cell means no retained observation. It cannot establish that nobody
heard you or that the band was closed. Maps connect estimated transmitter and
receiver locations; the lines do not trace the ionospheric path or outline a
coverage area. Current cached RBN directory grids take precedence over Vail's
registered-address grids. The JSON retains the original provider grid and
identifies the source of the displayed location. Directory locations are
current metadata, not proof of where a receiver was during an old activation.

Contact context uses the contact's logged grid or coordinate pair, matching
station callsign, band, and mode. For each receiver it selects the newest
observation preceding the contact by at most ten minutes, then picks the
nearest receiver within 250 km of the contact. Guessed country/prefix
positions and lookup fallbacks do not establish a contact location. Contact
grids remain grid centers with their precision stated, including when two
centers coincide. A nearby skimmer's SNR is not the contact station's SNR.
The report shows report age, separation, and when the observation was first
retrieved, including evidence collected retrospectively after the QSO.

This provides a useful join with contacts already in Ham2K. The JSON includes
contact UUIDs, UTC times, band/mode and report IDs for subsequent analysis.
Importing and correlating a separate ADIF file is future work.

## Collection and limits

**Save reception evidence** is enabled in My Signal's tune settings by default.
It records exact-call raw rows and failures from actual visible-panel requests.
It does not fetch additional data per render or per keystroke. Hide/suspend
stops polling; a started request keeps the operation identity captured before
the fetch, even if you switch operations while it finishes. Turning recording
off stops new recording for that placement without deleting saved evidence.
Home panels without an operation UUID do not create activation archives.

At export time, the extension requests available Vail history for a fixed
interval. By default this covers dated contacts with a five-minute margin,
extended by the saved visible-panel collection interval. All selected formats
use the interval fixed when their options were offered. This is an approximate
activation interval, not an inferred CQ/PTT log. Undated operations need saved
reception evidence before an export can be offered. Moving operation segments
omit the single transmitter-origin map and distance summaries.

Retrieval preserves successful pages if a later request fails. It stops after
eight pages of 500 source rows, 4,000 observations, or twelve seconds, whichever
comes first. Each page allows at most four seconds and one million response
characters. Exact-call filtering includes portable suffixes; partial provider
search matches can consume the page budget. An invalid response, changing
pagination, or a limit leaves the export explicitly partial. A successful
exhausted query means all accepted records in that service response were
retrieved, not that the provider retained every spot or transmission.
The service's historical availability can limit recovery from older activations.

Same-interval requests share one retrieval. Successful retrievals are reused
for five minutes and partial retrievals for one minute, so companion formats
do not repeatedly query the service. History requests use the existing shared
HTTP rate-limit backoff. Offline exports include saved evidence and state that
no history request was sent.

Persistent settings retain four recent operation/callsign archives, each with
up to 4,000 observations, 512 retrieval attempts, and a two-million-character
JSON budget. The saved envelope also has a twelve-million-character bound.
Eviction, omitted records, and storage failures are reported explicitly.
This is a bounded collection, not an unlimited forensic recorder. Export the
JSON before an archive reaches its limits or another operation evicts it.
Raw HTTP bodies are not retained; accepted provider rows are. Saved archives
are local extension settings and do not automatically sync with the operation
to another device. Live retrieval timestamps are sampled host clock readings
and can be lower bounds on actual completion.

By default exported transmitter origins are rounded to six-character grid
centers, including origins within the retrieval journal. Precise operator
coordinates and private location labels are withheld. Contact context follows
the SDK's private/lookup data filtering; coordinates withheld by that policy
can leave a contact unmatched. Provider rows are external reception evidence,
not a copy of the complete private log.

## Generated examples and verification

Run `mise run rbn:export-samples` to regenerate
[complete](examples/rbn-exports/complete/reception.html) and
[partial](examples/rbn-exports/partial/reception.html) examples using the
production retriever and exporter. Their observations and contacts are
synthetic and are labeled as such in every format. The complete fixture has
39 observations at eight receivers; the partial fixture has fourteen
observations and a failed history request. Every output folder includes all
six formats.

Deterministic tests cover collection bounds, restart persistence, concurrent
updates, exact calls, failed pages, UTC bins, location precision, QSO joins,
escaping, privacy, and the SDK export workflow. Packaged sandbox tests cover
hook registration and existing panel behavior. Desktop and phone-width HTML
previews have been visually inspected. Native Ham2K save/share, restart,
background, and large-archive performance still need device acceptance.

These runtime changes are confined to RBN. Synchronized version changes are
personal packaging; no CWT or CQ WW behavior changes require an upstream
backport.
