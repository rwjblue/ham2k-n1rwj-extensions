import type { CalendarEvent } from './model.ts'

export const calendarSourceUrl = 'https://contestclock.com/'
export const calendarApiUrl = 'https://contestclock.com/api/contests'
export const calendarPreviewDays = 14
export const calendarDownloadDays = 30
export const calendarRefreshDays = 7
export const maxCalendarBodyLength = 2_000_000
const maxOccurrences = 2_000

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, limit: number): string | null {
  if (typeof value !== 'string' || hasControlCharacters(value)) return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= limit ? trimmed : null
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

/** No browser URL global is available in the extension's ES2020 sandbox. */
export function safeRulesUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_048) return null
  const match = /^https?:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][^\s<>"'\\]*)?$/iu.exec(value)
  if (!match || hasControlCharacters(value)) return null
  if (
    match[1].length > 253 ||
    match[1].split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(label)) ||
    (match[2] !== undefined && (Number(match[2]) === 0 || Number(match[2]) > 65_535))
  )
    return null
  return value
}

function instant(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  )
    return null
  const parsed = Date.parse(value)
  return Number.isSafeInteger(parsed) &&
    new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19)
    ? parsed
    : null
}

function wallClock(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(value))
    return null
  return instant(`${value}Z`) === null ? null : value
}

function normalizeOccurrence(value: unknown): CalendarEvent | null {
  const row = record(value)
  if (!row) return null
  const name = text(row.name, 240)
  const identity = text(row.uid, 512) ?? text(row.contest_id, 160)
  if (!name || !identity || !Array.isArray(row.modes) || row.modes.length > 16) return null
  const modes: string[] = []
  for (const value of row.modes) {
    const mode = text(value, 32)
    if (!mode || !/^[a-z0-9][a-z0-9 /+-]*$/iu.test(mode)) return null
    if (!modes.includes(mode)) modes.push(mode)
  }

  let start: number | null = null
  let end: number | null = null
  let localTime: string | null = null
  let session: string
  if (row.local_rolling === true) {
    // A local rolling event sweeps across the world. Assigning UTC would invent a time.
    if (row.start !== null || row.end !== null) return null
    const localStart = wallClock(row.start_wall)
    const localEnd = wallClock(row.end_wall)
    if (!localStart || !localEnd || localEnd <= localStart) return null
    session = `${localStart}/${localEnd}`
    localTime = `${localStart.replace('T', ' ')} – ${localEnd.replace('T', ' ')} local`
  } else {
    start = instant(row.start)
    end = instant(row.end)
    if (start === null || end === null || end <= start) return null
    session = `${start}/${end}`
  }

  return {
    // Including both boundaries also preserves sessions if a provider reuses its UID.
    id: `${identity}:${session}`,
    name,
    modes,
    start,
    end,
    rulesUrl: safeRulesUrl(row.rules_url),
    sourceUrl: calendarSourceUrl,
    verified: row.verified === true,
    localTime,
  }
}

/** Normalize the documented /api/contests envelope without copying contest rules. */
export function parseCalendarSource(body: string): CalendarEvent[] {
  if (body.length > maxCalendarBodyLength) throw new Error('Calendar response is too large')
  let payload: Record<string, unknown> | null
  try {
    payload = record(JSON.parse(body))
  } catch {
    throw new Error('Invalid calendar response')
  }
  if (
    !payload ||
    !Array.isArray(payload.occurrences) ||
    payload.occurrences.length > maxOccurrences ||
    !Number.isSafeInteger(payload.count) ||
    payload.count !== payload.occurrences.length
  )
    throw new Error('Invalid calendar response')

  const events = new Map<string, CalendarEvent>()
  for (const row of payload.occurrences) {
    const event = normalizeOccurrence(row)
    if (event) events.set(event.id, event)
  }
  if (payload.occurrences.length > 0 && events.size === 0)
    throw new Error('Calendar response has no valid events')
  return [...events.values()].sort(
    (a, b) =>
      (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  )
}

/** The static endpoint uses the server's clock and supplies 30 days of coverage. */
export function parseCalendarDownload(body: string) {
  const events = parseCalendarSource(body)
  const query = record(record(JSON.parse(body))?.query)
  const from = instant(query?.from)
  const through = instant(query?.to)
  if (
    query?.kind !== 'default' ||
    !Array.isArray(query.filters) ||
    query.filters.length !== 0 ||
    from === null ||
    through === null ||
    from < 0 ||
    through - from !== calendarDownloadDays * 24 * 60 * 60_000
  )
    throw new Error('Invalid calendar coverage. Previous data retained.')
  return { events, from, through }
}
