// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// CQ WW's export hook, and the half of its ADIF export that is the
// contest's own: the ADIF file is written by the core `adif` exporter, and
// this hook only DELEGATES to it. The traps are in what it hands over. A
// delegation that reaches every export hook instead of `adif` alone re-enters
// this very hook and never returns; one that does not name this contest as the
// main handler gets every program's fields, so a park activated alongside puts
// its MY_SIG on the contest log; and a private-data flag not forwarded
// silently strips (or leaks) what the operator chose.
//
// The core exporter is stood in for by the kernel's local-invoke seam, which
// records the delegation and answers with a file.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, test, vi } from 'vitest'
import manifest from '../manifest.json' with { type: 'json' }
import { loadExtension } from './support.ts'

const contest = await loadExtension(() => import('../src/index.ts'))

interface Delegation {
  category: string
  method: string
  args: Record<string, unknown>
  key: string | null | undefined
}

let delegated: Delegation[] = []
beforeEach(() => {
  delegated = []
  // Stand in for the core exporter at the SDK's kernel boundary.
  vi.stubGlobal('__polo', {
    invokeLocal: async (
      category: string,
      method: string,
      args: Record<string, unknown>,
      _online: unknown,
      key?: string | null,
    ) => {
      delegated.push({ category, method, args, key })
      return [{ ok: true, value: { content: '<CALL:4>W0AW <EOR>' } }]
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

/// Enough on the contest's ref for any event of the family to export, and a
/// POTA activation beside it to give a leaking file something to leak.
const OPERATION = {
  uuid: 'op-1',
  stationCall: 'N0DEV',
  grid: 'EN91',
  refs: [
    {
      type: 'cqww',
      mode: 'CW',
      exchange: '59 001',
      ourExchange: '59 001',
      ourClass: '1D',
      ourSection: 'ENY',
    },
    { type: 'potaActivation', ref: 'US-0001' },
  ],
}

const QSOS = [0, 1, 2].map((i) => ({
  uuid: `q${i}`,
  our: { call: 'N0DEV' },
  their: { call: `W${i}AW`, state: 'OH', name: 'Alice' },
  band: '20m',
  mode: 'CW',
  freq: 14035,
  startAtMillis: Date.UTC(2026, 2, 28, 12, i),
  refs: [
    {
      type: 'cqww',
      exchange: `59 00${i}`,
      theirZone: '5',
      theirExchange: 'MA',
      theirSerial: `${i}`,
      name: 'BOB',
      location: 'OH',
    },
  ],
}))

async function exportAdif(extra: Record<string, unknown> = {}) {
  return (await contest.runHook('export', 'generateExport', {
    operation: OPERATION,
    qsos: QSOS,
    exportType: 'cqww-adif',
    ...extra,
  })) as { filename: string; content: string }
}

test("the ADIF export delegates once, to the core exporter alone, as this contest's log", async () => {
  const result = await exportAdif()

  assert.equal(delegated.length, 1)
  const call = delegated[0]
  assert.equal(call.category, 'export')
  assert.equal(call.method, 'generateExport')
  // Keyed to `adif`: an unkeyed fan-out reaches this contest's own
  // generateExport too, which delegates again, forever.
  assert.equal(call.key, 'adif')
  assert.equal(call.args.exportType, 'adif')
  // Without it the core asks every program's adifFields hook for the file.
  assert.equal(call.args.mainHandler, manifest.key)
  // Nothing listed: a park activated alongside the contest must not put
  // its MY_SIG on the contest's log.
  assert.equal(call.args.includeFieldsFrom, undefined)

  assert.equal(result.content, '<CALL:4>W0AW <EOR>')
  assert.match(result.filename, /\.adi$/)
})

test('the private-data choice reaches the core exporter either way', async () => {
  await exportAdif({ includePrivateData: false })
  await exportAdif({ includePrivateData: true })
  assert.deepEqual(
    delegated.map((d) => d.args.includePrivateData),
    [false, true],
  )
})

test('an exportType it never offered is declined, not delegated', async () => {
  // `adif` is what the core exporter itself answers for; treating it as
  // "anything that is not our Cabrillo" is the branch that delegates back into
  // the core and round again.
  const result = (await contest.runHook('export', 'generateExport', {
    operation: OPERATION,
    qsos: QSOS,
    exportType: 'adif',
  })) as { content: string }
  assert.equal(result.content, '')
  assert.equal(delegated.length, 0)
})

test('the Cabrillo file comes out of the export hook', async () => {
  // Deliberately generic: enough to prove the hook reaches the Cabrillo
  // writer and hands back a file, never enough to pin a layout.
  const result = (await contest.runHook('export', 'generateExport', {
    operation: OPERATION,
    qsos: QSOS,
    exportType: 'cqww-cabrillo',
  })) as { content: string }
  assert.equal(result.content.split('\n')[0].trim(), 'START-OF-LOG: 3.0')
  assert.equal(delegated.length, 0, 'a Cabrillo file is written here, not delegated')
})

test('the RTTY Cabrillo carries a QTH on both sides, DX for a station that sends none', async () => {
  const operation = {
    uuid: 'op-1',
    stationCall: 'N0DEV',
    refs: [{ type: 'cqww', mode: 'RTTY', zone: '4', qth: 'MN' }],
  }
  const qsos = [
    {
      uuid: 'r1',
      their: { call: 'W1AW' },
      band: '20m',
      mode: 'RTTY',
      freq: 14080,
      startAtMillis: Date.UTC(2026, 8, 26, 12, 0),
      refs: [{ type: 'cqww', theirZone: '5', theirQth: 'CT' }],
    },
    {
      uuid: 'r2',
      their: { call: 'DL1ABC' },
      band: '20m',
      mode: 'RTTY',
      freq: 14085,
      startAtMillis: Date.UTC(2026, 8, 26, 12, 1),
      refs: [{ type: 'cqww', theirZone: '14' }],
    },
  ]
  const result = (await contest.runHook('export', 'generateExport', {
    operation,
    qsos,
    exportType: 'cqww-cabrillo',
  })) as { content: string }
  assert.ok(result.content.split('\n').some((line) => line.trim() === 'LOCATION: MN'))
  const lines = result.content
    .split('\n')
    .filter((line) => line.startsWith('QSO:'))
    .map((line) => line.split(/\s+/).slice(5).join(' '))
  assert.deepEqual(lines, ['N0DEV 599 04 MN W1AW 599 05 CT', 'N0DEV 599 04 MN DL1ABC 599 14 DX'])

  // Missing sent setup must be corrected before submission, never guessed as DX.
  const unset = { ...operation, refs: [{ type: 'cqww', mode: 'RTTY', zone: '4' }] }
  await assert.rejects(
    contest.runHook('export', 'generateExport', {
      operation: unset,
      qsos,
      exportType: 'cqww-cabrillo',
    }),
    /Configure a valid CQ zone/,
  )
})

test('the Cabrillo header carries the declared entry and our LOCATION', async () => {
  const header = async (operation: Record<string, unknown>) => {
    const result = (await contest.runHook('export', 'generateExport', {
      operation,
      qsos: QSOS,
      exportType: 'cqww-cabrillo',
    })) as { content: string }
    return result.content.split('\n').filter((line) => /^(LOCATION|CATEGORY-)/.test(line))
  }

  const declared = {
    uuid: 'op-1',
    stationCall: 'N0DEV',
    refs: [
      {
        type: 'cqww',
        mode: 'CW',
        qth: 'MN',
        operator: 'SINGLE-OP',
        band: 'ALL',
        power: 'HIGH',
        overlay: 'CLASSIC',
      },
    ],
  }
  assert.deepEqual(await header(declared), [
    'LOCATION: MN',
    'CATEGORY-OPERATOR: SINGLE-OP',
    'CATEGORY-ASSISTED: NON-ASSISTED',
    'CATEGORY-BAND: ALL',
    'CATEGORY-POWER: HIGH',
    'CATEGORY-MODE: CW',
    'CATEGORY-OVERLAY: CLASSIC',
  ])

  // The operators listed at setup, and the club, reach the header too.
  const multi = {
    uuid: 'op-4',
    stationCall: 'N0DEV',
    local: { operatorCall: 'N0DEV' },
    refs: [
      { type: 'cqww', mode: 'CW', operators: 'k1abc, w2def', club: 'Yankee Clipper Contest Club' },
    ],
  }
  const content = (
    (await contest.runHook('export', 'generateExport', {
      operation: multi,
      qsos: QSOS,
      exportType: 'cqww-cabrillo',
    })) as { content: string }
  ).content
  assert.ok(content.includes('\nOPERATORS: K1ABC W2DEF\n'))
  assert.ok(content.includes('\nCLUB: Yankee Clipper Contest Club\n'))
  // With none listed, the app's operator call stands in.
  const solo = { ...multi, refs: [{ type: 'cqww', mode: 'CW' }] }
  assert.ok(
    (
      (await contest.runHook('export', 'generateExport', {
        operation: solo,
        qsos: QSOS,
        exportType: 'cqww-cabrillo',
      })) as { content: string }
    ).content.includes('\nOPERATORS: N0DEV\n'),
  )

  // A DX station's location is DX; a US one with none set is left out
  // rather than claimed as DX.
  assert.deepEqual(
    await header({ uuid: 'op-2', stationCall: 'DL1ABC', refs: [{ type: 'cqww', mode: 'CW' }] }),
    ['LOCATION: DX', 'CATEGORY-MODE: CW'],
  )
  assert.deepEqual(
    await header({ uuid: 'op-3', stationCall: 'N0DEV', refs: [{ type: 'cqww', mode: 'CW' }] }),
    ['CATEGORY-MODE: CW'],
  )
  // Hawaii is in the US: its ARRL section, as typed, never DX.
  assert.deepEqual(
    await header({
      uuid: 'op-5',
      stationCall: 'KH6ABC',
      refs: [{ type: 'cqww', mode: 'CW', qth: 'pac' }],
    }),
    ['LOCATION: PAC', 'CATEGORY-MODE: CW'],
  )
  assert.deepEqual(
    await header({ uuid: 'op-6', stationCall: 'KH6ABC', refs: [{ type: 'cqww', mode: 'CW' }] }),
    ['CATEGORY-MODE: CW'],
  )
})
