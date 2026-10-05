#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Generate deterministic activation reports through the production RBN exporter"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <path>" default="docs/examples/rbn-exports" help="Directory for complete and partial synthetic reports"

import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

// The SDK and map assets use bundler JSON imports, just like the shipped extension.
// Bundle the sample runner instead of changing their runtime imports for Node.
const runner = resolve('dist/rbn-export-samples.cjs')
await mkdir(resolve('dist'), { recursive: true })
await build({
  stdin: {
    contents: `import { generateRbnExportSamples } from './extensions/tools/n1rwj-rbn/tests/export/samples.ts'; generateRbnExportSamples(process.cwd(), process.env.usage_output ?? 'docs/examples/rbn-exports').catch(error => { console.error(error); process.exitCode = 1 });`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: runner,
})
const result = spawnSync(process.execPath, [runner], { stdio: 'inherit', env: process.env })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
