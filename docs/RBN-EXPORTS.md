# RBN activation exports

Enable N1RWJ RBN, use **My Signal** during your activation, then open the
operation's **Exports** view. The extension offers:

| Export | Purpose |
| --- | --- |
| HTML reception report | Offline maps, receiver timelines, collection history, and nearby reception evidence at contact time. |
| Markdown summary | Readable receiver statistics and UTC quarter-hour timelines. |
| Observation CSV | One row per distinct retained observation, with measurements, timestamps, and collection/location provenance. |
| Collected-evidence JSON | Archived provider rows when available, normalized observations, retrieval attempts, warnings, and normalized contact context. |
| SVG map | A portable text-based image of recorded receiver sites. |
| Contact-context CSV | One row per contact, including matched receiver evidence or an explicit unmatched reason. |

The HTML report is selected by default. Exports read local evidence and cache;
they do not start a history request or enable recording. ZIP and PNG need binary
support in the host's extension export workflow, tracked in
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
registered-address grids. The JSON retains the original provider grid when raw
rows were archived and identifies the source of the displayed location. Cache
snapshots retain only normalized coordinates; their original grids and provider
rows are unavailable. Directory locations are
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

**Save reception evidence** is off by default in My Signal's tune settings.
Enable it to record exact-call raw rows and failures from future visible-panel
requests. Display filters never filter this archive. Recording adds no fetch
per render or per keystroke. Hide/suspend stops polling; a started request keeps
the operation identity captured before the fetch, even if you switch operations
while it finishes. Turning recording off stops new recording for that placement
without deleting saved evidence. Home panels without an operation UUID do not
create activation archives.

Exports use that operation's saved exact-call archive and supplement gaps with
unexpired normalized reports from My Signal's rolling cache. Archived raw rows
take precedence when the same observation ID appears in both. The JSON marks
mixed data as `collectionSource: "archive-and-snapshot"`; each observation keeps
its own provenance. When no archive exists, the rolling cache can still provide
a report. A
cache snapshot has no original provider rows, original grids, or complete
retrieval journal. JSON identifies it as `collectionSource: "snapshot"`, each
observation has `retrievalKind: "snapshot"` and an empty `raw` object, and the
CSV includes corresponding provenance columns. Cache entries belong to the
station callsign rather than the operation; reports may have been fetched while
another operation for that exact call was active. Portable suffixes are never
broadened to a base callsign. Opening Exports neither renews the cache's polling
lease nor fetches missing history.

The export interval covers dated contacts with a five-minute margin, extended
by the available collection interval. This is an approximate activation interval,
not an inferred CQ/PTT log. Undated operations can export a saved archive or
rolling cache snapshot. Dated operations without observations offer a clearly
empty report with guidance for future collection. Moving operation segments
omit the single transmitter-origin map and distance summaries.

All companion formats read one dataset, including cached directory coordinates,
frozen when their options were offered, even if a visible panel or receiver
directory subsequently refreshes. The extension keeps at most
eight offered datasets; reopen Exports if options expire. A frozen dataset is
checked against operation and station identity before generation. Online and
offline exports both use only saved evidence and cache.

Opening Exports waits for already-completed panel responses queued for archive
storage, rather than for an unfinished network fetch. That recording queue is
bounded to eight responses. A full queue rejects additional recording and marks
the archive as partial with an explicit warning; finishing writes releases the
capacity. Slow local storage can delay an export even though no network request
is started.

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
production exporter after explicitly preloading synthetic archives. Historical
retrieval runs only while preparing these fixtures, not during runtime exports.
Their observations and contacts are
synthetic and are labeled as such in every format. The complete fixture has
39 observations at eight receivers; the partial fixture has fourteen
observations and a failed historical retrieval. Every output folder includes all
six formats. A complete fixture demonstrates rendering and provenance; it does
not claim that visible-panel recording produces complete activation evidence.

Deterministic tests cover collection bounds, restart persistence, concurrent
updates, exact calls, failed pages, UTC bins, location precision, QSO joins,
escaping, privacy, frozen datasets, cache provenance, no-network generation, and
the SDK export workflow. Packaged sandbox tests cover hook registration and panel
behavior. Browser previews can assess exported HTML separately from native
Ham2K panels. Native Ham2K save/share, restart, background, and large-archive
performance still need device acceptance.

These runtime changes are confined to RBN and do not change release versions.
No CWT or CQ WW behavior changes require an upstream backport.
