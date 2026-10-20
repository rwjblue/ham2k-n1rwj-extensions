import { EVENT_REF, type Qson, refOf, text } from './model.ts'

const HOUR = 3_600_000
const LOCAL_DATE = '2026-10-30'

export interface Session {
  key: string
  startMillis: number
  endMillis: number
  utcOffset: string
  flexibleHours: boolean
}

export function utcOffsetMinutes(value: string): number | undefined {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return undefined
  return (match[1] === '-' ? -1 : 1) * (hours * 60 + minutes)
}

export function validUtcOffset(value: string): boolean {
  return utcOffsetMinutes(value) !== undefined
}

// The sponsor confirms only the 2026 date. Do not derive future dates from
// "nearest Halloween": the sponsor also avoids the CW Sweepstakes weekend.
export function sessionFor(
  ref: string | undefined,
  utcOffset: string,
  flexibleHours = false,
): Session | undefined {
  const offset = utcOffsetMinutes(utcOffset)
  if (ref !== EVENT_REF || offset === undefined) return undefined
  const midnight = Date.parse(`${LOCAL_DATE}T00:00:00Z`) - offset * 60_000
  return {
    key: EVENT_REF,
    startMillis: midnight + (flexibleHours ? 0 : 15 * HOUR),
    endMillis: midnight + 24 * HOUR,
    utcOffset,
    flexibleHours,
  }
}

export function operationSession(operation: Qson): Session | undefined {
  const ref = refOf(operation)
  return sessionFor(text(ref?.ref), text(ref?.utcOffset), ref?.flexibleHours === true)
}

export function sessionLabel(session: Session): string {
  return `Zombie Shuffle ${LOCAL_DATE}, ${session.flexibleHours ? '00:00' : '15:00'}–24:00 (UTC${session.utcOffset})`
}
