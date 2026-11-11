#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Refresh or verify the vendored Cluster Spots helpers for RBN"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] arg "[commit]" help="Full 40-character ham2k/extensions Git commit to vendor"
//[USAGE] flag "--check" help="Verify the bundle at its recorded commit and check for upstream changes"

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const upstreamDirectory = 'extensions/spots/ham2k-cluster-spots/src'
const parserPath = `${upstreamDirectory}/parse.ts`
const commandsPath = `${upstreamDirectory}/index.ts`
const licensePath = 'LICENSE.md'
const repository = 'ham2k/extensions'
const vendorDir = 'extensions/tools/n1rwj-rbn/src/vendor'
const output = join(vendorDir, 'cluster-spots.mjs')
const checking = process.env.usage_check === 'true'
const existing = checking ? await readFile(output) : undefined
const requested = process.env.usage_commit?.toLowerCase()
const recorded = existing?.toString('utf8').match(/^Upstream commit: ([a-f0-9]{40})$/m)?.[1]
if (checking && requested)
  throw new Error('--check uses the recorded commit. Omit the commit argument.')
const commit = checking ? recorded : requested
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
  if (checking) throw new Error(`Could not read the upstream commit recorded in ${output}.`)
  throw new Error('Pass a full 40-character ham2k/extensions Git commit.')
}

async function download(ref: string, path: string): Promise<Buffer> {
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/${ref}/${path}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Could not download ${path} at ${ref}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function feedCommands(source: Buffer) {
  // Extract the declaration only. Importing index.ts would activate Cluster Spots itself.
  const declaration = source
    .toString('utf8')
    .match(/^const SEND_EVERYTHING:\s*Record<NodeProgram,\s*string\[\]>\s*=\s*\{[\s\S]*?^\}/m)?.[0]
  if (!declaration)
    throw new Error(`Could not find the Cluster Spots command table in ${commandsPath}.`)
  return declaration
}

function checksum(input: Buffer | string) {
  return createHash('sha256').update(input).digest('hex')
}

const [source, entry, license] = await Promise.all([
  download(commit, parserPath),
  download(commit, commandsPath),
  download(commit, licensePath),
])
const commands = feedCommands(entry)
const banner = [
  'Generated from Ham2K Cluster Spots. DO NOT EDIT.',
  `Regenerate with: mise run rbn:vendor-cluster-spots ${commit}`,
  `Upstream commit: ${commit}`,
  `Parser: https://github.com/${repository}/blob/${commit}/${parserPath}`,
  `Parser SHA-256: ${checksum(source)}`,
  `Command table: https://github.com/${repository}/blob/${commit}/${commandsPath}`,
  `Command table SHA-256: ${checksum(commands)}`,
  '',
  license.toString('utf8').trimEnd(),
].join('\n')

const scratch = await mkdtemp(join(tmpdir(), 'rbn-cluster-spots-'))
try {
  // RBN needs the raw fields before Cluster Spots normalizes calls or guesses modes.
  await Promise.all([
    writeFile(join(scratch, 'parse.ts'), `${source.toString('utf8')}\nexport { DX_DE }\n`),
    writeFile(
      join(scratch, 'cluster-spots-entry.ts'),
      `${commands}
      export { SEND_EVERYTHING as clusterFeedCommands }
      export {
        DX_DE as clusterAnnouncementPattern,
        isPromptFor,
        nodeProgramFromPrompt,
        spotTime,
      } from './parse.ts'\n`,
    ),
  ])
  const result = await build({
    absWorkingDir: scratch,
    entryPoints: ['cluster-spots-entry.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    plugins: [
      {
        name: 'cluster-spots-shared-libraries',
        setup(build) {
          // Drop imports used only by upstream helpers that aren't in the export list.
          build.onResolve(
            { filter: /^@ham2k\/(extension-sdk|lib-callsigns|lib-operation-data)$/ },
            ({ path }) => ({ path, external: true, sideEffects: false }),
          )
        },
      },
    ],
    banner: { js: `/*!\n${banner.replaceAll('*/', '* /')}\n*/` },
  })
  const [bundle] = result.outputFiles
  if (!bundle) throw new Error('esbuild did not produce the Cluster Spots bundle.')

  if (existing) {
    if (!existing.equals(bundle.contents)) {
      throw new Error(`${output} differs from the generated bundle at ${commit}. Regenerate it.`)
    }
    const [upstreamSource, upstreamEntry, upstreamLicense] = await Promise.all([
      download('main', parserPath),
      download('main', commandsPath),
      download('main', licensePath),
    ])
    if (
      !source.equals(upstreamSource) ||
      commands !== feedCommands(upstreamEntry) ||
      !license.equals(upstreamLicense)
    ) {
      throw new Error(
        'Cluster Spots parser, command table, or license changed on upstream main. Review the diff and regenerate from a reviewed commit.',
      )
    }
    console.log(`Verified ${output} at ${commit}. Its inputs match upstream main.`)
  } else {
    await mkdir(vendorDir, { recursive: true })
    const staging = await mkdtemp(join(vendorDir, '.cluster-spots-'))
    try {
      const stagedBundle = join(staging, 'cluster-spots.mjs')
      await writeFile(stagedBundle, bundle.contents)
      await rename(stagedBundle, output)
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
    console.log(`Vendored ${output} from ${commit}`)
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
