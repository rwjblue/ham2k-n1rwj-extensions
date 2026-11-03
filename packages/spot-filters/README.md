# Legacy RBN station filter protocol

Older RBN bundles use this private protocol for the **Station filter** on
Regular builds that support cross-extension calls to `spotCallFilter:v1`.
CWT, MST, SST, SKCC Companion, and BIGFOOT Hunt keep their providers for
those installations. Current RBN bundles omit the selector and ignore saved
station selections. HaLo's newer runtime limits cross-extension calls to
[documented data hooks](https://github.com/ham2k/halo/commit/8556fedde08b11917a17f25a833fb2e30f2af855).

## Contract for older consumers

Providers register `spotCallFilter:v1` under their extension key. Older RBN
bundles discover providers with `hooks.invokeAll(category, 'describe', {}, online)`
and match against the selected provider with
`hooks.invokeOne(category, key, 'matchCalls', { version: 1, calls }, online)`.
The shared package is bundled into each extension that uses it.

`describe` returns a label, availability and a default-selection hint.
`matchCalls` accepts up to 2,000 normalized full callsigns and returns the
matching subset, preserving portable calls. Responses carry callsigns without
exchange or log data. The older consumer validates the response and splits
larger batches. An unavailable provider with an active selection yields no
spots. The consumer defaults to **All calls** and saves explicit selections
by provider key across operations.

The history adapter accepts a cached records getter and callsign lookup
function. CWT, MST, and SST use the same matching code with their own exchange
semantics. Providers use cached data and avoid calls back to spot sources.
File membership is evidence for a display preference. An absent callsign
cannot invalidate a QSO or establish that someone is a nonmember.

## Native migration

The [maintainer's direction](https://gist.github.com/rwjblue/3a7304de0c56f8fcdf7374da5951417f)
is for sources to supply spots, for contests and activities to assess
relevance in the active operation, and for the logger to highlight or hide
spots according to the operator's preference. RBN applies its receiver, mode,
and speed filters before passing reports to HaLo. An operation-scoped native
filter that distinguishes history relevance from scoring eligibility is still
needed for the former roster-based view.

Reuse the pure `matchHistoryCalls` function in `src/history.ts` and each
activity's cache once a documented operation-scoped relevance path exists.
Keep exchange precedence, score and dupe decisions independent of matches.
Use a native preference for highlighting or hiding and consider how to map an
old global provider choice into an operation preference before retiring the
providers. Verify operation changes, already-worked spots, missing histories,
explicit opt-outs, and scores. Retain the providers until older RBN consumers
on supported hosts have a migration path.
