# Binary extension export request

Filed as [HALO-757](https://cabo.ham2k.com/halo/c/757), an idea in Backlog,
on October 5, 2026. The reviewed title and description are preserved below.

**October 6 SDK recheck:** Installed `@ham2k/extension-sdk` 0.12.0 still
defines `ExportResult` as `{ filename: string, mimeType: string, content: string }`
in `dist/index.d.ts`. File Stash transport methods accept that string-based
file contract; they do not add a binary export envelope. The current RBN
implementation therefore provides separate HTML, Markdown, JSON, CSV, and SVG
files. The investigation quoted below describes the original filing's SDK
versions, rather than the current installed versions.

## Title

Allow extensions to export binary files through the standard Exports workflow

## Description

I'm exploring an activation reception report for the RBN extension. A readable
report could include a map showing where skimmers heard my signal during the
activation. A more detailed export could bundle the report, reception records,
and collection history into a ZIP. A PNG version of the map would also be
convenient to save or share.

The extension export API currently returns `content: string`, and the standard
save/share/download paths treat that content as text. An extension can export
SVG, HTML, JSON, or CSV, but cannot return a generated ZIP or PNG without its
binary bytes being treated as text. Choosing a binary MIME type or filename
doesn't change that behavior.

Could extension-generated exports support binary content through the same
Exports workflow? Existing text exporters should continue to work, and binary
content should reach desktop saving, Android document saving, mobile sharing,
and web downloading unchanged. The SDK should document the supported payload
representation, size limits, and errors. I don't have a preference for the
particular encoding or API shape.

**Investigation:** I checked installed SDK 0.9.0 and a local HaLo checkout
containing SDK 0.10.0. Both define `ExportResult.content` as a string. The
host's `app/lib/services/export_service.dart` uses `writeAsString` for native
saving and share-sheet temporary files, and passes strings to the Android and
web export paths. This is source inspection rather than a failed export tested
on a device.

HaLo already has native PNG generation and byte-based save/download support
for [Operation Postcards, HALO-708](https://cabo.ham2k.com/halo/c/708).
[HALO-682](https://cabo.ham2k.com/halo/c/682) also provides a precedent for binary
data crossing the extension bridge through WebSockets. The request here is
to expose binary content through extension exports.

PNG generation is a separate step. The RBN map can already be generated as SVG;
a host SVG-to-PNG renderer would be a useful follow-up. This request only asks
that an extension which has generated binary content can export that content
correctly.
