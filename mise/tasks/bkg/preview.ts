#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Preview the BKG panel on Home and inside operations using synthetic data"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <path>" default="dist/bkg-scene-preview.html" help="HTML preview destination (.html); SVG and JSON companions are written beside it"

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const output = process.env.usage_output ?? 'dist/bkg-scene-preview.html'
if (!output.endsWith('.html')) throw new Error('Preview output must end with .html')
const temporary = await mkdtemp(join(process.cwd(), 'node_modules/.bkg-preview-'))
try {
  const bundle = join(temporary, 'runtime.mjs')
  await build({
    entryPoints: ['scripts/bkg-preview.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  })
  const runtime = (await import(pathToFileURL(bundle).href)) as {
    previewBkg(output: string): Promise<void>
  }
  await runtime.previewBkg(output)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
