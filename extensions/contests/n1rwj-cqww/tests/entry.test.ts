// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The entry declared at setup, as the Cabrillo `CATEGORY-` lines the CQ WW
// log robot reads. An unanswered question must write no line — a guessed one
// is a claim the operator never made — while what the rules make follow from
// an answer is written for it.

import assert from 'node:assert/strict'
import { test } from 'vitest'

import { cabrilloCategories } from '../src/entry.ts'

function lines(ref: Record<string, string>) {
  return Object.fromEntries(
    cabrilloCategories({ type: 'cqww', ...ref }).filter(([, value]) => value),
  )
}

test('nothing declared writes nothing but the mode', () => {
  assert.deepEqual(lines({ mode: 'CW' }), { 'CATEGORY-MODE': 'CW' })
})

test('a single operator declares whether they were assisted', () => {
  assert.deepEqual(lines({ mode: 'SSB', operator: 'SINGLE-OP', band: 'ALL', power: 'LOW' }), {
    'CATEGORY-OPERATOR': 'SINGLE-OP',
    'CATEGORY-ASSISTED': 'NON-ASSISTED',
    'CATEGORY-BAND': 'ALL',
    'CATEGORY-POWER': 'LOW',
    'CATEGORY-MODE': 'SSB',
  })
  assert.equal(
    lines({ mode: 'SSB', operator: 'SINGLE-OP-ASSISTED' })['CATEGORY-ASSISTED'],
    'ASSISTED',
  )
})

test('multi-operator classes split into operator and transmitter, all-band and assisted', () => {
  assert.deepEqual(lines({ mode: 'CW', operator: 'MULTI-TWO', band: '20M', power: 'HIGH' }), {
    'CATEGORY-OPERATOR': 'MULTI-OP',
    'CATEGORY-ASSISTED': 'ASSISTED',
    // "All-band operation only", whatever band was picked.
    'CATEGORY-BAND': 'ALL',
    'CATEGORY-POWER': 'HIGH',
    'CATEGORY-MODE': 'CW',
    'CATEGORY-TRANSMITTER': 'TWO',
  })
  assert.equal(lines({ mode: 'CW', operator: 'MULTI-ONE' })['CATEGORY-TRANSMITTER'], 'ONE')
  assert.equal(lines({ mode: 'CW', operator: 'MULTI-MULTI' })['CATEGORY-TRANSMITTER'], 'UNLIMITED')

  // Multi-Distributed is MULTI-OP with a DISTRIBUTED station (V.C.4).
  const distributed = lines({ mode: 'CW', operator: 'MULTI-DISTRIBUTED' })
  assert.equal(distributed['CATEGORY-OPERATOR'], 'MULTI-OP')
  assert.equal(distributed['CATEGORY-STATION'], 'DISTRIBUTED')
})

test('a checklog is just that', () => {
  assert.equal(lines({ mode: 'CW', operator: 'CHECKLOG' })['CATEGORY-OPERATOR'], 'CHECKLOG')
})

test('overlays go with single operators only, and Classic not with assistance', () => {
  assert.equal(
    lines({ mode: 'CW', operator: 'SINGLE-OP', overlay: 'CLASSIC' })['CATEGORY-OVERLAY'],
    'CLASSIC',
  )
  assert.equal(
    lines({ mode: 'CW', operator: 'SINGLE-OP-ASSISTED', overlay: 'ROOKIE' })['CATEGORY-OVERLAY'],
    'ROOKIE',
  )
  assert.equal(
    lines({ mode: 'CW', operator: 'SINGLE-OP-ASSISTED', overlay: 'CLASSIC' })['CATEGORY-OVERLAY'],
    undefined,
  )
  assert.equal(
    lines({ mode: 'CW', operator: 'MULTI-ONE', overlay: 'YOUTH' })['CATEGORY-OVERLAY'],
    undefined,
  )
})

test('RTTY has no 160m entry', () => {
  assert.equal(
    lines({ mode: 'RTTY', operator: 'SINGLE-OP', band: '160M' })['CATEGORY-BAND'],
    undefined,
  )
  assert.equal(lines({ mode: 'CW', operator: 'SINGLE-OP', band: '160M' })['CATEGORY-BAND'], '160M')
})

test("a value that is not one of the rules' is no claim", () => {
  assert.deepEqual(lines({ mode: 'CW', operator: 'SINGLE-OP-QRP', power: '1500' }), {
    'CATEGORY-MODE': 'CW',
  })
})

test('operators are listed as the sponsor asks, and the club on one line', async () => {
  const { declaredClub, declaredOperators } = await import('../src/entry.ts')
  assert.equal(
    declaredOperators({ operators: 'k1abc, w2def;  w3ghi @w3bgn' }),
    'K1ABC W2DEF W3GHI @W3BGN',
  )
  assert.equal(declaredOperators({}), '')
  assert.equal(
    declaredClub({ club: '  Yankee  Clipper\nContest Club ' }),
    'Yankee Clipper Contest Club',
  )
})

test('saved preview categories survive switching providers, with new answers taking precedence', () => {
  const legacy = {
    mode: 'RTTY',
    categoryOperator: 'SINGLE-OP',
    categoryAssisted: 'ASSISTED',
    categoryBand: '20',
    categoryPower: 'LOW',
  }
  assert.deepEqual(lines(legacy), {
    'CATEGORY-OPERATOR': 'SINGLE-OP',
    'CATEGORY-ASSISTED': 'ASSISTED',
    'CATEGORY-BAND': '20M',
    'CATEGORY-POWER': 'LOW',
    'CATEGORY-MODE': 'RTTY',
  })
  assert.deepEqual(lines({ ...legacy, operator: '', band: '', power: '' }), {
    'CATEGORY-MODE': 'RTTY',
  })
  assert.equal(lines({ ...legacy, operator: 'MULTI-TWO', band: '40M' })['CATEGORY-BAND'], 'ALL')
})
