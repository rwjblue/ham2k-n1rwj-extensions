import { describe, expect, it } from 'vitest'
import { inSession, sessionFor, sprintAt, upcomingSessions } from '../src/events.ts'

describe('SKCC UTC event calendars', () => {
  it.each([
    ['wes:2026-10', '2026-10-10T12:00:00Z', '2026-10-12T00:00:00Z'],
    ['sks:2026-10', '2026-10-28T00:00:00Z', '2026-10-28T02:00:00Z'],
    ['sksa:2026-10', '2026-10-09T22:00:00Z', '2026-10-10T00:00:00Z'],
    ['skse:2026-10', '2026-10-01T19:00:00Z', '2026-10-01T21:00:00Z'],
    ['skse:2026-11', '2026-11-05T20:00:00Z', '2026-11-05T22:00:00Z'],
    ['sss:2026-10', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'],
    ['qso-party:2026', '2026-06-20T12:00:00Z', '2026-06-22T00:00:00Z'],
    ['k3y:2026', '2026-01-02T00:00:00Z', '2026-02-01T00:00:00Z'],
    ['cskm:2026', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'],
  ])('%s follows its published rule', (key, start, end) => {
    expect(sessionFor(key)).toMatchObject({ start: Date.parse(start), end: Date.parse(end) })
  })
  it('admits SKSE edge contacts only when the received speed supports the QRS rule', () => {
    const session = sessionFor('skse:2026-10')
    if (!session) throw new Error('Missing SKSE session')
    expect(inSession(session, session.start - 900000)).toBe(false)
    expect(inSession(session, session.start - 900000, 12)).toBe(true)
    expect(inSession(session, session.start - 900001, 12)).toBe(false)
    expect(inSession(session, session.end + 900000, 13)).toBe(false)
    expect(inSession(session, session.end + 900000, 12)).toBe(true)
    expect(inSession(session, session.end + 900001, 12)).toBe(false)
  })
  it('does not turn general activity or impossible month names into a session', () => {
    for (const key of ['general', 'wes:2026-00', 'wes:2026-13', 'sks:2026', 'k3y:26'])
      expect(sessionFor(key)).toBeUndefined()
  })
  it('does not count contacts after SKS ends as sprint contacts', () => {
    expect(sprintAt(Date.parse('2026-10-28T01:59:59Z'))).toContain('sks')
    expect(sprintAt(Date.parse('2026-10-28T02:00:00Z'))).not.toContain('sks')
    const sessions = upcomingSessions(Date.parse('2026-12-31T12:00:00Z'), 20)
    expect(sessions.some((session) => session.key === 'sss:2027-01')).toBe(true)
    expect(sessions.some((session) => session.key === 'k3y:2027')).toBe(true)
  })
})
