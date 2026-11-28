# U.S. Operation Location

This preview fills a new operation's state and county from its GPS fix. When
the fix overlaps a boundary, HaLo offers possible locations for you to
review. The downloaded data covers all 50 states and D.C. and works offline.
County names follow TrustedQSL. An area without a compatible county name,
such as a Connecticut planning region, leaves the county field blank.

## Install the preview

Use a HaLo build that implements the Extension API 31
`operationLocation.resolve` hook. From the repository root, build the preview
with its pinned Ham2K SDK and tools.

```sh
mise run pack n1rwj-operation-location-us
```

In HaLo, enable **Settings → Developer → Developer Mode**. Open **Settings →
Extensions & Features → Install from file…**, pick the
`dist/n1rwj-operation-location-us-*.h2kext` bundle, and enable the extension.
Then download **U.S. state and county boundaries** under **Settings → Data
Files** before going offline.

The preview builds only when selected by key. The standard release and
catalog workflows use the published extension list. The pinned API 31 SDK
predates this hook's type declarations, so the preview declares its signature
locally and uses the actual HaLo hook at runtime.

## Boundary data

The Data Files entry downloads the [U.S. snapshot](../../../data/us-operation-location/operation-location-us.ndjson)
from this repository's main branch. The source and license notices are in
[SOURCE-NOTICE.txt](../../../data/us-operation-location/SOURCE-NOTICE.txt).
The resolver and geometry reader originated in the HaLo operation-location
prototype and retain their MIT notices.

To test the draft branch before the data lands on main, change the data file
URL in [src/index.ts](src/index.ts) to the draft snapshot and rebuild.

```text
https://raw.githubusercontent.com/rwjblue/ham2k-n1rwj-extensions/refs/heads/rwjblue/offline-us-operation-location/data/us-operation-location/operation-location-us.ndjson
```

Keep the main URL in committed changes.

```sh
mise run operation-location:regenerate --check
mise run test extensions/tools/n1rwj-operation-location-us/tests
```
