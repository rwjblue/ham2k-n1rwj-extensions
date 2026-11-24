// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import type { HookContext } from '@ham2k/extension-sdk'
import { test } from 'vitest'

import { decodeBoundaries } from '../src/geometry.ts'
import { createResolver } from '../src/resolve.ts'

type Ring = [longitude: number, latitude: number][]
type Feature = { name?: string; polygons: Ring[][] }

const context = {} as HookContext
const bounds = {
  RI: [-7_200_000, 4_100_000, -7_100_000, 4_200_000],
  MA: [-7_200_000, 4_200_000, -7_100_000, 4_300_000],
}

function fixture() {
  const rows = new Map<string, unknown>([
    ['index', { version: '1', bounds }],
    ['state:RI', { version: '1', geometry: encode(feature('RI', rectangle(-72, 41, -71, 42))) }],
    ['state:MA', { version: '1', geometry: encode(feature('MA', rectangle(-72, 42, -71, 43))) }],
    [
      'county:RI',
      {
        version: '1',
        geometry: encode(
          feature('Providence', rectangle(-72, 41, -71.5, 42), [
            rectangle(-71.8, 41.4, -71.7, 41.6),
          ]),
          feature('Bristol', rectangle(-71.5, 41, -71.2, 42)),
          feature(undefined, rectangle(-71.2, 41, -71, 42)),
        ),
      },
    ],
    [
      'county:MA',
      { version: '1', geometry: encode(feature('Worcester', rectangle(-72, 42, -71, 43))) },
    ],
  ])
  const requested: string[] = []
  const resolve = createResolver(async (key) => {
    requested.push(key)
    return rows.get(key)
  })
  return {
    rows,
    requested,
    lookup: (latitude: number, longitude: number, accuracyMeters = 20) =>
      resolve({ latitude, longitude, accuracyMeters }, context),
  }
}

test("a confident fix reads one state's geometry and keeps it through refinements", async () => {
  const { lookup, requested } = fixture()
  assert.deepEqual(await lookup(41.5, -71.9), { state: 'RI', county: 'Providence' })
  assert.deepEqual(await lookup(41.5, -71.9, 5), { state: 'RI', county: 'Providence' })
  assert.deepEqual(requested, ['index', 'state:RI', 'county:RI', 'index'])
})

test('a county border preserves the state and offers both counties', async () => {
  const { lookup } = fixture()
  assert.deepEqual(await lookup(41.5, -71.5005, 100), {
    state: 'RI',
    candidates: [
      { state: 'RI', county: 'Providence' },
      { state: 'RI', county: 'Bristol' },
    ],
  })
  assert.deepEqual(await lookup(41.5, -71.5005, 5), { state: 'RI', county: 'Providence' })
})

test('a state border offers paired states and counties without autofill', async () => {
  const { lookup } = fixture()
  assert.deepEqual(await lookup(42, -71.9), {
    candidates: [
      { state: 'RI', county: 'Providence' },
      { state: 'MA', county: 'Worcester' },
    ],
  })
})

test('a hole or unnamed county cannot autofill', async () => {
  const { lookup } = fixture()
  assert.deepEqual(await lookup(41.5, -71.75), { state: 'RI' })
  assert.deepEqual(await lookup(41.5, -71.8), {
    state: 'RI',
    candidates: [{ state: 'RI', county: 'Providence' }],
  })
  assert.deepEqual(await lookup(41.5, -71.1), { state: 'RI' })
})

test('a missing or new index invalidates cached geometry without mixing import versions', async () => {
  const { lookup, rows } = fixture()
  assert.deepEqual(await lookup(41.5, -71.9), { state: 'RI', county: 'Providence' })
  rows.set('index', { version: '2', bounds })
  assert.deepEqual(await lookup(41.5, -71.9), {})
  rows.set('state:RI', {
    version: '2',
    geometry: encode(feature('RI', rectangle(-72, 41, -71, 42))),
  })
  assert.deepEqual(await lookup(41.5, -71.9), { state: 'RI' })
  rows.set('county:RI', {
    version: '2',
    geometry: encode(feature('Kent', rectangle(-72, 41, -71, 42))),
  })
  assert.deepEqual(await lookup(41.5, -71.9), { state: 'RI', county: 'Kent' })
  rows.delete('index')
  assert.deepEqual(await lookup(41.5, -71.9), {})
})

test('invalid accuracy and locations outside the index do not load geometry', async () => {
  const { lookup, requested } = fixture()
  for (const accuracy of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(await lookup(41.5, -71.9, accuracy), {})
  }
  assert.deepEqual(await lookup(41.5, 181), {})
  assert.deepEqual(requested, [])
  assert.deepEqual(await lookup(43.65, -79.38), {})
  assert.deepEqual(requested, ['index'])
})

test('the HSB1 decoder preserves UTF-8 county names', () => {
  const result = decodeBoundaries(encode(feature('Doña Ana', rectangle(-107, 31, -106, 32))))
  assert.equal(result[0].name, 'Doña Ana')
})

test('the downloadable snapshot resolves real fixes and leaves unmatched county names blank', async () => {
  const snapshot = new URL(
    '../../../../data/us-operation-location/operation-location-us.ndjson',
    import.meta.url,
  )
  const text = await readFile(snapshot, 'utf8')
  const rows = new Map<string, unknown>()
  for (const line of text.trimEnd().split('\n')) {
    const row: { key: string } = JSON.parse(line)
    rows.set(row.key, row)
  }
  assert.equal(rows.size, 103)
  const resolve = createResolver(async (key) => rows.get(key))
  const fix = (latitude: number, longitude: number) =>
    resolve({ latitude, longitude, accuracyMeters: 20 }, context)
  assert.deepEqual(await fix(41.8241, -71.4132), { state: 'RI', county: 'Providence' })
  assert.deepEqual(await fix(41.7312, -71.54735), {
    state: 'RI',
    candidates: [
      { state: 'RI', county: 'Kent' },
      { state: 'RI', county: 'Providence' },
    ],
  })
  assert.deepEqual(await fix(41.7627, -72.6745), { state: 'CT' })
  assert.deepEqual(await fix(52.8677, 173.1912), { state: 'AK', county: 'Aleutians West' })
  assert.deepEqual(await fix(51.2695, -179.1115), { state: 'AK', county: 'Aleutians West' })
  assert.deepEqual(await fix(43.6534, -79.3839), {})
})

function rectangle(west: number, south: number, east: number, north: number): Ring {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ]
}

function feature(name: string | undefined, outer: Ring, holes: Ring[] = []): Feature {
  return { name, polygons: [[outer, ...holes]] }
}

function encode(...features: Feature[]): string {
  const bytes = [...Buffer.from('HSB1')]
  const writeUint = (value: number) => {
    while (value >= 128) {
      bytes.push((value & 127) | 128)
      value >>= 7
    }
    bytes.push(value)
  }
  const writeDelta = (value: number) => writeUint(value < 0 ? -2 * value - 1 : 2 * value)

  writeUint(features.length)
  for (const feature of features) {
    const name = Buffer.from(feature.name ?? '', 'utf8')
    writeUint(name.length)
    bytes.push(...name)
    writeUint(feature.polygons.length)
    for (const polygon of feature.polygons) {
      writeUint(polygon.length)
      for (const ring of polygon) {
        writeUint(ring.length)
        let previousX = 0
        let previousY = 0
        for (const [longitude, latitude] of ring) {
          const x = Math.round(longitude * 100_000)
          const y = Math.round(latitude * 100_000)
          writeDelta(x - previousX)
          writeDelta(y - previousY)
          previousX = x
          previousY = y
        }
      }
    }
  }
  return Buffer.from(bytes).toString('base64')
}
