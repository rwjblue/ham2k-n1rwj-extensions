# Reception info-pane mockups

Open [the interactive gallery](./index.html) to inspect Status and About at every page and size. The gallery is self-contained and makes no network requests. Individual SVGs show each scenario's first Status page, plus the phone About pages.

Regenerate with `mise run reception:preview`. Fixtures have a fixed 2026-09-27 18:30 UTC clock and synthetic reports and service states. The task bundles and invokes the actual PSK/RBN panel adapters and shared scene renderer; it does not call host or network methods.

**Rendered scene mockups; native Flutter not verified.** The portable SVG approximation does not exercise native fonts, text measurement, controls, focus, or event handling. Runtime tests and an actual Ham2K acceptance check remain separate evidence.
