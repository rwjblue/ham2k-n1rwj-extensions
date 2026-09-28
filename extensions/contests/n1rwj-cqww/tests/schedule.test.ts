// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// The trap here is "last FULL weekend": when a month ends on a Saturday, that
// Saturday's Sunday is in the next month, so the contest runs the weekend
// before — getting it wrong moves the whole event a week late, and no other
// check in the extension would notice.

import { strict as assert } from 'node:assert'
import { describe, it } from 'vitest'

import {
  daysUntilContest,
  endOfContest,
  isContestOn,
  nearestMode,
  nextRunningYear,
  relevanceFor,
  startOfContest,
} from '../src/schedule.ts'

const DAY = 24 * 60 * 60 * 1000

describe('startOfContest', () => {
  it('runs each mode on the last full weekend of its month, from 0000 UTC Saturday', () => {
    assert.equal(startOfContest(2026, 'RTTY'), Date.UTC(2026, 8, 26))
    assert.equal(startOfContest(2026, 'CW'), Date.UTC(2026, 10, 28))
  })

  it("skips a Saturday on the month's last day", () => {
    // 2026: October 31 is a Saturday, so SSB is the 24th, not the 31st.
    assert.equal(startOfContest(2026, 'SSB'), Date.UTC(2026, 9, 24))
    // 2024: November 30 is a Saturday, so CW was the 23rd.
    assert.equal(startOfContest(2024, 'CW'), Date.UTC(2024, 10, 23))
  })

  it('runs for 48 hours, ending as Monday begins', () => {
    assert.equal(endOfContest(2026, 'SSB') - startOfContest(2026, 'SSB'), 2 * DAY)
    assert.equal(isContestOn(endOfContest(2026, 'SSB') - 1, 'SSB'), true)
    assert.equal(isContestOn(endOfContest(2026, 'SSB'), 'SSB'), false)
  })
})

describe('nextRunningYear', () => {
  it("keeps a finished running for three days, then offers next year's", () => {
    assert.equal(nextRunningYear(endOfContest(2026, 'CW') + 2 * DAY, 'CW'), 2026)
    assert.equal(nextRunningYear(endOfContest(2026, 'CW') + 4 * DAY, 'CW'), 2027)
  })
})

describe('relevance', () => {
  it('peaks while on the air and decays with distance', () => {
    const during = startOfContest(2026, 'SSB') + 60 * 60 * 1000
    assert.equal(relevanceFor(during, 'SSB'), 1)
    // During SSB, CW a month out outranks RTTY eleven months out.
    assert.ok(relevanceFor(during, 'CW') > relevanceFor(during, 'RTTY'))
    assert.ok(daysUntilContest(during, 'RTTY') > 300)
  })

  it('ranks a just-finished running below every upcoming one, even a year out', () => {
    // The day after SSB: SSB is in its grace days, CW a month out, RTTY eleven
    // months out. A finished weekend leading the list would offer the operator
    // the contest they just worked instead of the next one.
    const dayAfter = endOfContest(2026, 'SSB') + DAY
    assert.ok(relevanceFor(dayAfter, 'SSB') < relevanceFor(dayAfter, 'RTTY'))
    assert.ok(relevanceFor(dayAfter, 'RTTY') < relevanceFor(dayAfter, 'CW'))
    // The furthest an upcoming running can be: just past the grace days, with
    // next year's weekend almost a year out.
    const farthest = endOfContest(2025, 'SSB') + 4 * DAY
    assert.ok(daysUntilContest(farthest, 'SSB') > 350)
    assert.ok(relevanceFor(dayAfter, 'SSB') < relevanceFor(farthest, 'SSB'))
  })

  it('defaults the setup to the running nearest on the calendar', () => {
    assert.equal(nearestMode(Date.UTC(2026, 8, 1)), 'RTTY')
    // The day after RTTY, the default is the SSB weekend coming up.
    assert.equal(nearestMode(endOfContest(2026, 'RTTY') + DAY), 'SSB')
    assert.equal(nearestMode(Date.UTC(2026, 9, 15)), 'SSB')
    assert.equal(nearestMode(Date.UTC(2026, 10, 10)), 'CW')
    // After CW, the list reads "what is coming": next September's RTTY.
    assert.equal(nearestMode(Date.UTC(2027, 0, 15)), 'RTTY')
  })
})
