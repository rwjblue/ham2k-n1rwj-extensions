# BKG catalog images

The catalog gallery is separate from extension bundles and versions. The first
image supplies the lead catalog thumbnail; the second shows the panel with
synthetic data and is explicitly captioned as a static preview.

- `1-bkg-logo.jpg` is the unmodified club artwork downloaded from
  [BKG.club](https://www.bkg.club/logo.jpg) on October 30, 2026. Branding and
  artwork belong to the Brass Knuckle Gang. No replacement logo was generated.
- `2-operation-preview.png` is a 2× rasterization of the operation-member SVG
  from `mise run bkg:preview`, using the current panel source and synthetic
  callsigns. It does not establish native UI or on-air acceptance.
- `screenshots.json` holds the official publisher's captions and ordering
  follows the numbered image filenames.

To update the gallery without uploading an extension version, use the official
publisher with the current local bundle and this explicit screenshot folder:

```sh
mise exec -- npx --no-install h2kext-publish dist/n1rwj-bkg-0.18.0.h2kext --screenshots extensions/activities/n1rwj-bkg/screenshots --screenshots-only
```

`H2K_CATALOG_TOKEN` comes from the existing local Mise environment. The publisher
validates the images, generates proportional search thumbnails, and submits the
whole gallery for catalog review. An unchanged set sends nothing. Ordinary
bundle publication leaves the gallery intact when no screenshot folder is
specified. New images become public only after catalog approval.

See `node_modules/@ham2k/extension-tools/README.md` under **Screenshots** for the
current requirements. These files are deliberately outside `assets/` so they do
not increase the installable bundle size.

## Published gallery

The catalog approved gallery `01M65HQRR0D15DRQCZAXFY72GW` on
October 30, 2026 at 00:40:23 US Eastern (04:40:23 UTC). Both images and their
proportional thumbnails are live in the public BKG listing. The existing stable
extension version remains 0.17.0; no bundle or release notes were uploaded.

The official screenshot preflight, full image decoding, `mise run format` and
`mise run check` passed: 1,948 tests in 150 files, strict types, lint, ES2020
builds and official packaging. Gallery-only files change no runtime behavior
and require no CWT upstream synchronization.
