/** Calendar instants are Unix milliseconds; local rolling events have no UTC instant. */
export interface CalendarEvent {
  id: string
  name: string
  modes: string[]
  start: number | null
  end: number | null
  rulesUrl: string | null
  sourceUrl: string
  verified: boolean
  localTime: string | null
}

export interface CalendarSnapshot {
  events: CalendarEvent[]
  fetchedAt: number | null
  stale: boolean
  error: string | null
}
