// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import { expect, it } from 'vitest'
import { receiverFamily } from '../../src/data/identity.ts'

it.each([
  ['KM3T-2', 'KM3T'],
  ['KM3T-3', 'KM3T'],
  ['KM3T-003', 'KM3T'],
  ['UNKNOWN-2', 'UNKNOWN'],
  ['K1ABC/P-12', 'K1ABC/P'],
  ['KM3T', 'KM3T'],
  ['UNKNOWN', 'UNKNOWN'],
  ['KM3T-CW', 'KM3T-CW'],
  ['KM3T-2A', 'KM3T-2A'],
  ['KM3T-A2', 'KM3T-A2'],
  ['KM3T-2/P', 'KM3T-2/P'],
  ['KM3T-', 'KM3T-'],
])('derives the receiver family for %s as %s', (call, family) => {
  expect(receiverFamily(call)).toBe(family)
})
