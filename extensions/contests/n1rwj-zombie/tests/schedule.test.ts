import { describe, expect, it } from 'vitest'
import { operationSession, sessionFor, sessionLabel, validUtcOffset } from '../src/schedule.ts'

describe('confirmed 2026 local operating hours', () => {
  it('uses an explicit event-day offset and a half-open 15:00–midnight window', () => {
    const session = sessionFor('2026', '-04:00')
    if (!session) throw new Error('Expected the confirmed event session')
    expect(session.startMillis).toBe(Date.UTC(2026, 9, 30, 19))
    expect(session.endMillis).toBe(Date.UTC(2026, 9, 31, 4))
    expect(sessionLabel(session)).toContain('15:00–24:00 (UTC-04:00)')
    expect(sessionFor('2026', '+05:30')?.startMillis).toBe(Date.UTC(2026, 9, 30, 9, 30))
    expect(sessionFor('2026', '+14:00')?.startMillis).toBe(Date.UTC(2026, 9, 30, 1))
  })

  it('does not infer an offset or an unconfirmed year', () => {
    for (const offset of ['', '-4:00', 'Z', '-04', '+15:00', '+14:01', '+05:60']) {
      expect(validUtcOffset(offset)).toBe(false)
      expect(sessionFor('2026', offset)).toBeUndefined()
    }
    expect(sessionFor('2025', '-04:00')).toBeUndefined()
    expect(sessionFor('2027', '-04:00')).toBeUndefined()
    expect(sessionFor(undefined, '-04:00')).toBeUndefined()
    expect(operationSession({ refs: [{ type: 'zombie', ref: '2026' }] })).toBeUndefined()
  })

  it('interprets HI/AK/DX flexible hours as the full local event date', () => {
    const session = operationSession({
      refs: [{ type: 'zombie', ref: '2026', utcOffset: '-10:00', flexibleHours: true }],
    })
    if (!session) throw new Error('Expected the flexible event session')
    expect(session.startMillis).toBe(Date.UTC(2026, 9, 30, 10))
    expect(session.endMillis).toBe(Date.UTC(2026, 9, 31, 10))
    expect(sessionLabel(session)).toContain('00:00–24:00')
  })
})
