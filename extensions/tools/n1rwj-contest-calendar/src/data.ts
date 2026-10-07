import type { DataFileDefinition } from '@ham2k/extension-sdk'
import type { CalendarEvent, CalendarSnapshot } from './model.ts'
import {
  calendarApiUrl,
  calendarPreviewDays,
  calendarRefreshDays,
  maxCalendarBodyLength,
  parseCalendarDownload,
  record,
} from './source.ts'

interface SavedCalendar {
  schema: 1
  body: string
}

/** Native data files own download scheduling, disk persistence, and failure notices. */
export function createCalendarData(key: string, now: () => number) {
  let current: { events: CalendarEvent[]; from: number; through: number } | null = null
  let error: string | null = null

  function readSaved(raw: unknown) {
    const saved = record(raw)
    if (
      saved?.schema !== 1 ||
      typeof saved.body !== 'string' ||
      saved.body.length > maxCalendarBodyLength
    )
      throw new Error('Invalid calendar file. Previous data retained.')
    return parseCalendarDownload(saved.body)
  }

  const dataFile: DataFileDefinition = {
    key: `${key}_calendar`,
    name: 'Contest Calendar',
    description:
      'Thirty days of contest schedules from ContestClock. Eligible for automatic refresh after seven days.',
    category: key,
    url: calendarApiUrl,
    fetchType: 'raw',
    maxAgeInDays: calendarRefreshDays,
    async rawToJSONData({ body, url }): Promise<SavedCalendar> {
      try {
        if (url !== calendarApiUrl) throw new Error('Unexpected calendar source.')
        // Validate before returning; the host persists and loads successful results.
        parseCalendarDownload(body)
        return { schema: 1, body }
      } catch (cause) {
        error = 'Calendar update was invalid. Previous data retained.'
        throw cause
      }
    },
    onLoadRawData(raw: unknown) {
      try {
        const loaded = readSaved(raw)
        if (!current || loaded.from >= current.from) current = loaded
        error = null
      } catch {
        error = 'Calendar file could not be loaded. Previous data retained.'
      }
    },
    async onRemoveRawData() {
      current = null
      error = null
    },
  }

  return {
    dataFile,
    readCalendar(): CalendarSnapshot {
      const day = 24 * 60 * 60_000
      const realNow = now()
      const neededThrough = Math.floor(realNow / day) * day + calendarPreviewDays * day - 1
      const incomplete = current !== null && current.through < neededThrough
      return {
        events: current?.events.map((event) => ({ ...event, modes: [...event.modes] })) ?? [],
        // The server supplies this generation time, including its short HTTP cache age.
        fetchedAt: current?.from ?? null,
        stale:
          current === null ||
          realNow - current.from >= calendarRefreshDays * day ||
          incomplete ||
          error !== null,
        error:
          error ??
          (incomplete
            ? 'Calendar no longer covers the full preview. Update it in Settings → Data Files.'
            : null),
      }
    },
  }
}
