#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Sample live CW from PoLo's DX cluster presets over direct Telnet"
//[MISE] depends=["build", "local-tasks-npm-install"]
//[USAGE] arg "<call>" help="Your callsign or test SSID. Cluster setup resets saved filters for that login."
//[USAGE] flag "--presets <preset>" var=#true delimiter="," help="PoLo preset to test. Repeat or use a comma-separated list. Omit for all." {
//[USAGE]   choices strict=#false "K3LR" "K1TTT" "W3LPL" "NC7J" "VE7CC-1"
//[USAGE] }
//[USAGE] flag "--call-overrides <calls>" help="Comma-separated PRESET=CALL overrides"
//[USAGE] flag "--seconds <seconds>" default="60" help="Live observation time in seconds per scenario (1–300)"
//[USAGE] flag "--scenario <scenario>" default="all" help="Test RBN alone, with Cluster Spots, or both" {
//[USAGE]   choices "all" "alone" "together"
//[USAGE] }
//[USAGE] flag "--output <file>" help="Write JSON results including command replies and sample lines"
//[USAGE] complete "call" type="none"
//[USAGE] complete "calls" type="none"
//[USAGE] complete "seconds" type="none"

import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { poloClusterPresets, samplePreset } from '../../../scripts/lib/rbn-cluster-harness.ts'
import {
  prepareClusterSpots,
  prepareRbnCluster,
} from '../../../scripts/lib/rbn-cluster-upstream.ts'

function callsign(value: string) {
  const call = value.trim().toUpperCase()
  if (!/^[A-Z0-9]+(?:[-/][A-Z0-9]+)*$/.test(call)) throw new Error(`Invalid callsign: ${value}`)
  return call
}

const defaultCall = callsign(process.env.usage_call ?? '')
const names = new Set<string>(poloClusterPresets.map(({ name }) => name))
const selection = process.env.usage_presets
  ?.toUpperCase()
  // Mise shell-quotes individual values when a comma-separated list includes spaces.
  .replace(/' *([A-Z0-9-]+) *'/g, '$1')
  .trim()
  .split(/\s+/)
if (selection?.some((name) => !names.has(name)))
  throw new Error(`Choose presets from ${[...names].join(', ')}.`)
const selected = poloClusterPresets.filter(({ name }) => !selection || selection.includes(name))
const overrides = new Map<string, string>()
for (const entry of process.env.usage_call_overrides?.split(',') ?? []) {
  const [name, call, ...extra] = entry.trim().toUpperCase().split('=')
  if (!names.has(name) || !call || extra.length)
    throw new Error(`Invalid preset callsign override: ${entry}`)
  overrides.set(name, callsign(call))
}

const seconds = Number(process.env.usage_seconds ?? 60)
if (!Number.isInteger(seconds) || seconds < 1 || seconds > 300) {
  throw new Error('Choose between 1 and 300 seconds per scenario.')
}
const scenario = process.env.usage_scenario ?? 'all'
if (!['all', 'alone', 'together'].includes(scenario))
  throw new Error('Choose all, alone, or together.')

const vendor = await readFile(
  new URL('../../../extensions/tools/n1rwj-rbn/src/vendor/cluster-spots.mjs', import.meta.url),
  'utf8',
)
const commit = vendor.match(/^Upstream commit: ([a-f0-9]{40})$/m)?.[1]
if (!commit) throw new Error('The vendor bundle is missing its upstream commit.')
const [rbn, upstream] = await Promise.all([
  prepareRbnCluster(),
  scenario === 'alone' ? undefined : prepareClusterSpots(commit),
])
console.log(
  `Sampling ${selected.length} preset(s) for ${seconds}s per scenario using direct Telnet.`,
)

const results = (
  await Promise.all(
    selected.map(async (preset) => {
      const call = overrides.get(preset.name) ?? defaultCall
      const samples = []
      for (const mode of scenario === 'all' ? ['alone', 'together'] : [scenario]) {
        const result = await samplePreset(
          preset,
          call,
          seconds,
          rbn,
          mode === 'together' ? upstream : undefined,
        )
        samples.push(result)
        console.log(
          `${preset.name} / ${result.mode} / ${result.passed ? 'PASS' : 'FAIL'} / CW lines ${result.wireCw}, RBN parsed ${result.rbnParsedCw}, RBN published ${result.rbnCw}, Cluster Spots published ${result.clusterSpotsCw ?? '—'}${result.error ? ` / ${result.error}` : ''}`,
        )
        if (scenario === 'all' && mode === 'alone') await delay(1000)
      }
      return samples
    }),
  )
).flat()

const output = process.env.usage_output
if (output) {
  await writeFile(output, `${JSON.stringify({ clusterSpotsCommit: commit, results }, null, 2)}\n`)
  console.log(`Wrote ${output}`)
}
if (results.some(({ passed }) => !passed)) process.exitCode = 1
