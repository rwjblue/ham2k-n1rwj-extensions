# Catalog screenshots

Catalog galleries belong to extensions, independently of bundle versions and
channels. Each extension's `screenshots/` directory is the complete ordered
gallery; `screenshots.json` contains captions. Numbered filenames determine
order, and the first image provides the search thumbnail. Keep these files
outside `assets/` so they do not enlarge installable bundles.

## Available galleries

| Extension | Images | Evidence |
| --- | ---: | --- |
| [BKG](../extensions/activities/n1rwj-bkg/screenshots/) | 2 | Existing approved club artwork and synthetic panel preview; preserved unchanged |
| [BIGFOOT](../extensions/activities/n1rwj-bigfoot/screenshots/) | 2 | Production scene previews with synthetic contacts and spots |
| [CWT](../extensions/contests/n1rwj-cwt/screenshots/) | 1 | Historical native setup dialog, cropped |
| [MST](../extensions/contests/n1rwj-mst/screenshots/) | 2 | Historical native logging and cropped setup dialog |
| [SST](../extensions/contests/n1rwj-sst/screenshots/) | 2 | Historical native logging and cropped setup dialog |
| [RBN](../extensions/tools/n1rwj-rbn/screenshots/) | 5 | Historical native map views plus current native preferences, controls and About |
| [SKCC Companion](../extensions/activities/n1rwj-skcc/screenshots/) | 4 | Current native grouped controls, exchange preferences, About and Activities placement |
| [Zombie Shuffle](../extensions/contests/n1rwj-zombie/screenshots/) | 4 | Current native demo panel, About and Activities placement; synthetic rebirth preview |
| [PSK Reporter](../extensions/tools/n1rwj-psk-reporter/screenshots/) | 2 | Production Status and About previews with synthetic reports |

The October 30, 2026 pass adds 22 images to eight galleries and preserves BKG's
two images. NS, WRT, RandomGram and Contest Calendar have no usable captures in
this pass; no gallery was submitted for them. Native capture stopped when the
Mac locked, before an existing RandomGram demo operation could be opened.

## Provenance and limits

The September contest and RBN images come from the existing documented
[native capture set](images/README.md). Contest captures use v0.3.1 in Ham2K
Next build 170 with synthetic TEST contacts; setup images are cropped to their
dialogs. The older CWT logging capture is excluded because its historical
exchange suggestion is no longer representative. RBN's historical map views
show the v0.3.2 compact-layout candidate observing public WG1V reports. These
versions are explicit in the catalog captions. Narrow macOS windows are not
physical-phone evidence.

Current native captures were taken October 30, 2026 in Ham2K Next build 186 with
the installed v0.18.3 extensions. RBN remains under **Spotting**; SKCC and Zombie
Shuffle remain under **Activities**. About content opens separately from the
controls. The Zombie panel observes an existing demo TEST operation. Capturing
these images did not add or edit contacts, change preference values, or send
radio commands. Opening/collapsing headers only changed the displayed view.
SKCC's existing example preference number is `12345T`. RBN's service check timed
out during capture; its settings caption records that state.

Native captures are cropped without altering their contents. Only the dialog
or preferences pane is retained, excluding unrelated logs, station controls,
and private origin settings. Per-gallery READMEs record source paths and crop
rectangles. The temporary full-window captures are not repository assets.

Synthetic previews were regenerated from the v0.18.3 production source using
`mise run bigfoot:preview`, `mise run zombie:preview`, and
`mise run reception:preview`. BIGFOOT uses the `spotted-desktop` and
`spotted-narrow` fixtures; Zombie uses `ready`. Their scene JSON is rendered
with `scenePreviewSvg` from `scripts/rbn-preview.ts`. PSK uses the generated
`psk-desktop.svg` and `psk-phone-about.svg`. All are rasterized at 2× and retain
the visible static-preview notice. Captions explicitly distinguish these from
native screenshots. They do not verify Flutter text measurement, interaction,
animation, physical-phone layout, or on-air operation.

This is personal catalog presentation, with no CWT runtime behavior, guide,
translation, or test changes. It is exempt from upstream CWT synchronization.
The source native CWT image already accompanies the upstream guide.

## Publishing

Use the official publisher with a current local bundle solely to identify the
extension key. For example:

```sh
mise exec -- npx --no-install h2kext-publish dist/n1rwj-skcc-0.18.3.h2kext --screenshots extensions/activities/n1rwj-skcc/screenshots --screenshots-only
```

`H2K_CATALOG_TOKEN` comes from the existing local Mise environment. This command
updates only gallery media and captions; it does not publish an extension
version or release notes. The explicit directory replaces the whole gallery.
An unchanged set sends nothing. Never pass an empty directory unless removing
the entire gallery is intentional.

The current official tools accept at most eight PNG, JPEG, or WebP images per
gallery, each at most 2 MiB and 3840 pixels on its longest side, with captions
at most 200 Unicode characters. They generate proportional WebP thumbnails
with a 480-pixel longest side. See the **Screenshots** section of
`node_modules/@ham2k/extension-tools/README.md` for the installed contract.

Decode and visually inspect every image, validate captions and limits, then
run the official screenshot preflight as part of submission. Verify the
catalog's approved/pending gallery response after submission: accepted uploads
can still await review while an existing approved set remains public.

## October 30 publication

The official screenshot-only publisher returned **live** for all eight new
galleries. The catalog API confirmed each set is approved with no pending
replacement, and its ordered image hashes and captions match the local files.
All 22 generated thumbnails have a 480-pixel longest side. BKG's complete
approved/pending response is unchanged from the preflight snapshot.

| Extension | Approved gallery | Approved at (UTC) |
| --- | --- | --- |
| [CWT](https://catalog.ham2k.net/extensions/n1rwj-cwt) | `01M66VQF2FQZBY68PWT00H624P` | 16:54:13 |
| [MST](https://catalog.ham2k.net/extensions/n1rwj-mst) | `01M66VRCPFB307X24A0G65XN60` | 16:54:43 |
| [SST](https://catalog.ham2k.net/extensions/n1rwj-sst) | `01M66VRFQMG96DCSF73WKB4VQ0` | 16:54:46 |
| [RBN](https://catalog.ham2k.net/extensions/n1rwj-rbn) | `01M66VRN9NR84E14YG96T09EAD` | 16:54:52 |
| [SKCC Companion](https://catalog.ham2k.net/extensions/n1rwj-skcc) | `01M66VRSK36BFTVJ9AN9TGDFP9` | 16:54:56 |
| [Zombie Shuffle](https://catalog.ham2k.net/extensions/n1rwj-zombie) | `01M66VRY7CB2HN9SC3GPSAHYQB` | 16:55:01 |
| [BIGFOOT](https://catalog.ham2k.net/extensions/n1rwj-bigfoot) | `01M66VS15JGS9XGBA7HV6JAHNC` | 16:55:04 |
| [PSK Reporter](https://catalog.ham2k.net/extensions/n1rwj-psk-reporter) | `01M66VS3NYYPNCZXAVB0ATFHJP` | 16:55:07 |

The public SKCC listing visibly displays all four thumbnails and captions,
alongside the existing stable v0.18.3 bundle and correction release notes.
No bundle, release notes, or channel submission was uploaded in this pass.

Validation passed: full decoding and visual review of every image, filename
ordering, caption lengths, byte/dimension limits, official publisher preflight,
`mise run format`, and `mise run check` (1,951 tests in 150 files, strict types,
lint, all 13 ES2020 builds, and official packages). These are media and bundle
checks; the native captures establish only the displayed views described above.
