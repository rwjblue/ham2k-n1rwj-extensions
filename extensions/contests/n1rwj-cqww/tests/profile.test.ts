// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The Cabrillo header's NAME, EMAIL and CLUB, read from the operator profile
// at export. Its own file because the profile is a host call, stubbed once
// per loaded extension.
//
// The trap is the host that cannot answer: that must cost these three lines,
// never the log the operator is trying to submit.

import assert from 'node:assert/strict'
import type { JSONValue } from '@ham2k/extension-sdk'
import { afterEach, beforeEach, test, vi } from 'vitest'

import { loadExtension } from './support.ts'

// The extension logs its own recovery; silenced so a passing run does not
// print stack traces that read as failures.
beforeEach(() => {
  vi.spyOn(host, 'getSettings').mockImplementation(
    async () => settings() as Record<string, JSONValue>,
  )
})
afterEach(() => vi.restoreAllMocks())

let settings: () => unknown = () => ({})

const contest = await loadExtension(() => import('../src/index.ts'))
const { host } = await import('@ham2k/extension-sdk')

async function header(ref: Record<string, unknown> = {}): Promise<string[]> {
  const operation = {
    uuid: 'op-1',
    stationCall: 'N0DEV',
    refs: [{ type: 'cqww', mode: 'CW', ...ref }],
  }
  const qsos = [
    {
      uuid: 'q1',
      their: { call: 'DL1ABC' },
      band: '20m',
      mode: 'CW',
      freq: 14025,
      startAtMillis: Date.UTC(2026, 10, 28, 12),
      refs: [],
    },
  ]
  const result = (await contest.runHook('export', 'generateExport', {
    operation,
    qsos,
    exportType: 'cqww-cabrillo',
  })) as { content: string }
  return result.content.split('\n').filter((line) => /^(NAME|EMAIL|CLUB):/.test(line))
}

test("the profile's name, email and club reach the header", async () => {
  settings = () => ({
    operatorName: 'Sam  Doe',
    operatorEmail: 'sam@example.com',
    operatorClub: 'Potomac Valley Radio Club',
  })
  assert.deepEqual(await header(), [
    'CLUB: Potomac Valley Radio Club',
    'NAME: Sam Doe',
    'EMAIL: sam@example.com',
  ])
})

test("a club typed at setup wins over the profile's", async () => {
  settings = () => ({ operatorName: 'Sam Doe', operatorClub: 'Potomac Valley Radio Club' })
  assert.deepEqual(await header({ club: 'Yankee Clipper Contest Club' }), [
    'CLUB: Yankee Clipper Contest Club',
    'NAME: Sam Doe',
  ])
})

test('an empty profile writes none of the three', async () => {
  settings = () => ({ operatorName: '', operatorEmail: '' })
  assert.deepEqual(await header(), [])
})

test('a host that cannot answer still exports the log', async () => {
  settings = () => {
    throw new Error('host disposed')
  }
  assert.deepEqual(await header({ club: 'Yankee Clipper Contest Club' }), [
    'CLUB: Yankee Clipper Contest Club',
  ])
})
