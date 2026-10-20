#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Preview the BIGFOOT forest with synthetic hunt and celebration states"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <path>" default="dist/bigfoot-scene-preview.html" help="Browser preview, scene JSON, and static panel SVG"
//[USAGE] flag "--fixtures <path>" help="Optional extra scene JSON for native renderer verification"

import { previewBigfoot } from '../../../scripts/bigfoot-preview.ts'

await previewBigfoot(
  process.env.usage_output ?? 'dist/bigfoot-scene-preview.html',
  process.env.usage_fixtures,
)
