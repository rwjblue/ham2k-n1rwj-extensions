import { describe, expect, it } from 'vitest'
import { ANNOUNCED_2026_BONUS_CALLS, isAnnouncedBonusStation } from '../src/bonus.ts'

describe('2026 announced Zombie bonus stations', () => {
  it('matches all 16 calls in NA5N’s original QRP-L email, including the line break', () => {
    expect(ANNOUNCED_2026_BONUS_CALLS).toEqual(
      `K4BAI AB9CA NB6M W2EB NA5N WB9HFK WA5BDU N7CQR
       K7TQ N0MII W1PID WD7Y AD4TJ N4VE NB7O N3XTR`.split(/\s+/),
    )
    expect(new Set(ANNOUNCED_2026_BONUS_CALLS).size).toBe(16)
  })

  it('recognizes normalized calls and unambiguous portable forms only in 2026', () => {
    for (const call of [' na5n ', 'NA5N/QRP', 'K7TQ/P', 'VE3/NB6M']) {
      expect(isAnnouncedBonusStation(call, '2026')).toBe(true)
      for (const year of ['', '2025', '2027'])
        expect(isAnnouncedBonusStation(call, year)).toBe(false)
    }
  })

  it('does not treat unknown, partial, concatenated or ambiguous calls as announced', () => {
    for (const call of ['', 'NA5', 'K1ABC', 'N7CQRK7TQ', 'NA5N/K4BAI', 'NA5N,NB6M'])
      expect(isAnnouncedBonusStation(call, '2026')).toBe(false)
  })
})
