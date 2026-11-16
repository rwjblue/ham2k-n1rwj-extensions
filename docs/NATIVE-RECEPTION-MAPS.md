# Native reception maps

RBN My Signal and PSK Reporter use the native `map` scene control in
[HaLo extension API 25](https://github.com/ham2k/halo/blob/83f5a1a77639098363d59bd3d159d26666fc418b/docs/extensions/scenes.md#map).
The extensions supply the coordinates, styles, and great-circle paths for the
selected reports. HaLo supplies the offline basemap and handles projection,
pan, zoom, and drawing. The API 25 floor applies to the entire extension.
Older hosts can install the last compatible release through the catalog.

The existing map projection preference still selects a fitted north-up view
or an azimuthal equidistant view with distance rings. The map includes located
stations from every page of the filtered list. Callsigns, SNR, and reports
without usable locations remain in the list.

The panel fits early reports and preserves the operator's camera through
routine report updates. Late reports may arrive beyond the visible area.
HaLo shows a reset control after a pan or zoom. Reset fits the latest
reports. Panels keep their own settings and camera state.

RBN's offline HTML report, Markdown, observation CSV, evidence JSON, and
contact-context CSV export saved evidence without network access. HaLo's
[export hook](https://github.com/ham2k/halo/blob/83f5a1a77639098363d59bd3d159d26666fc418b/docs/extensions/import-export.md#export)
accepts extension-produced file content. A future host API could render a
map specification offscreen and return an image data URI. The extension
could embed that image in offline HTML using the existing text contract.
The map would use the frozen evidence and the export's privacy settings,
independently of an open panel.
The CSV and JSON retain the observations needed to plot the data separately.

## Development and acceptance

- Run `mise run check` for lint, type checks, deterministic tests, and
  official packaging. `mise run reception:preview --maps --output dist/reception-preview`
  exports synthetic scene JSON and schematic SVG layout previews. The native
  map area is a placeholder in the static preview.
- Run `mise run rbn:export-samples` to regenerate the offline export examples.
  `mise run verify-host` checks the JavaScript kernel bridge on macOS.
- Before release, install the two packages in a HaLo build with API 25 or
  newer. In an empty test operation, check fitted and station-centered views,
  band and window changes, pan and zoom during updates, reset, both PSK
  directions, and desktop and phone layouts. Check that a saved SVG export
  preference from an earlier RBN version still allows its other selected
  files, and use the app's save or share action to open the HTML offline.

The [SVG migration record](RBN-SVG-MIGRATION.md) describes the earlier bundled
renderer and its verification.
