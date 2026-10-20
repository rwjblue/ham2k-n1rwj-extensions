#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Preview the BIGFOOT forest with synthetic hunt and celebration states"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <path>" default="dist/bigfoot-scene-preview.html" help="Browser preview, scene JSON, and static panel SVG"
//[USAGE] flag "--fixtures <path>" help="Optional extra scene JSON for native renderer verification"

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// The SDK's sandbox JSON imports need bundling before native Node can load
// this preview, just as they do for the extension's official runtime bundle.
const temporary = await mkdtemp(join(process.cwd(), 'node_modules/.bigfoot-preview-'))
try {
  const bundle = join(temporary, 'runtime.mjs')
  await build({
    entryPoints: ['scripts/bigfoot-preview.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  })
  const runtime = (await import(pathToFileURL(bundle).href)) as {
    previewBigfoot(output: string, fixtureFile?: string): Promise<void>
  }
  await runtime.previewBigfoot(
    process.env.usage_output ?? 'dist/bigfoot-scene-preview.html',
    process.env.usage_fixtures,
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
