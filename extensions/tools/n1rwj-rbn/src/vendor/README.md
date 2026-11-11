# Vendored Ham2K Cluster Spots helpers

`cluster-spots.mjs` is generated ES2020 JavaScript. Its header records the
upstream commit, source URLs, checksums, and MIT notice. Biome skips the
generated file. The ordinary extension build uses this local copy.

Make changes to the shared helpers upstream and regenerate the bundle. The
vendoring task selects the live announcement pattern, UTC timestamp helper,
two prompt helpers, and the `SEND_EVERYTHING` command table. RBN applies that
table on first connection for each login and node. `cluster-spots.d.mts` is
the local TypeScript declaration for these exports. [Upstream parser](https://github.com/ham2k/extensions/blob/main/extensions/spots/ham2k-cluster-spots/src/parse.ts) · [Upstream command table](https://github.com/ham2k/extensions/blob/main/extensions/spots/ham2k-cluster-spots/src/index.ts)

## Refresh

Run this before releasing RBN or when upstream changes the parser, command
table, or license.

```sh
mise run rbn:vendor-cluster-spots --check
```

The check reproduces the bundle byte for byte from its recorded commit, then
compares the parser, extracted command table, and license with upstream
`main`. It leaves the vendor files untouched and accepts unrelated changes
to the upstream extension entry point.

When an input changes, review the upstream diff and pass the full 40-character
SHA of the reviewed commit. The task replaces `cluster-spots.mjs` and records
the new provenance.

```sh
mise run rbn:vendor-cluster-spots <commit>
mise run rbn:vendor-cluster-spots --check
mise run check
```

Review the generated diff and check it in with any changes to the local
declarations, RBN adapters, or tests. The update and verification task needs
GitHub access.
