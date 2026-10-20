#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Preview the Zombie graveyard with synthetic contacts, rebirths and compact layouts"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <path>" default="dist/zombie-scene-preview.html" help="Browser preview, scene JSON, and static scene SVG"
//[USAGE] flag "--fixtures <path>" help="Optional extra fixture JSON for native renderer verification"

import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// The sandbox SDK's JSON imports require the same bundling boundary used by
// other scene previews before Node can execute its actual panel hook.
const temporary = await mkdtemp(join(process.cwd(), 'node_modules/.zombie-preview-'))
try {
  const bundle = join(temporary, 'runtime.mjs')
  await build({
    entryPoints: ['scripts/zombie-preview.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  })
  const runtime = (await import(pathToFileURL(bundle).href)) as {
    previewZombie(output: string, fixtureFile?: string): Promise<void>
  }
  await runtime.previewZombie(
    process.env.usage_output ?? 'dist/zombie-scene-preview.html',
    process.env.usage_fixtures,
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
