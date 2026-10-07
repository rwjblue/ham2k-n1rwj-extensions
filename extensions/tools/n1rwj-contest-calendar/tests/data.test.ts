import { describe, expect, it } from 'vitest'
import { createCalendarData } from '../src/data.ts'
import { calendarApiUrl } from '../src/source.ts'
import { NOW, occurrence, payload } from './fixtures.ts'

const day = 24 * 60 * 60_000
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing calendar data hook')
  return value
}

async function download(data: ReturnType<typeof createCalendarData>, body = payload()) {
  return required(data.dataFile.rawToJSONData)({ body, url: calendarApiUrl, options: {} })
}

describe('managed calendar data file', () => {
  it('declares one static thirty-day source and a seven-day automatic age threshold', () => {
    const data = createCalendarData('n1rwj-contest-calendar', () => NOW)
    expect(data.dataFile).toMatchObject({
      key: 'n1rwj-contest-calendar_calendar',
      category: 'n1rwj-contest-calendar',
      fetchType: 'raw',
      url: calendarApiUrl,
      maxAgeInDays: 7,
    })
    expect(data.readCalendar()).toEqual({ events: [], fetchedAt: null, stale: true, error: null })
  })

  it('converts transactionally and replays the native disk snapshot after restart', async () => {
    const data = createCalendarData('calendar', () => NOW)
    const saved = await download(data)
    expect(data.readCalendar().events).toHaveLength(0)
    required(data.dataFile.onLoadRawData)(saved)
    expect(data.readCalendar()).toMatchObject({ fetchedAt: NOW, stale: false, error: null })
    const restarted = createCalendarData('calendar', () => NOW + 6 * day)
    required(restarted.dataFile.onLoadRawData)(JSON.parse(JSON.stringify(saved)))
    expect(restarted.readCalendar().events).toEqual(data.readCalendar().events)
    expect(restarted.readCalendar().stale).toBe(false)
  })

  it('marks weekly age without issuing network requests or dropping the prior data', async () => {
    let now = NOW
    const data = createCalendarData('calendar', () => now)
    required(data.dataFile.onLoadRawData)(await download(data))
    now += 7 * day - 1
    expect(data.readCalendar().stale).toBe(false)
    now++
    expect(data.readCalendar()).toMatchObject({ stale: true, error: null })
    expect(data.readCalendar().events).toHaveLength(1)
  })

  it('reports inadequate future coverage from query boundaries rather than event end times', async () => {
    let now = NOW
    const data = createCalendarData('calendar', () => now)
    required(data.dataFile.onLoadRawData)(
      await download(data, payload([occurrence({ end: '2026-12-31T23:59:59Z' })])),
    )
    now += 7 * day
    expect(data.readCalendar().error).toBeNull()
    now += 10 * day
    expect(data.readCalendar().error).toContain('no longer covers the full preview')
    expect(data.readCalendar().events).toHaveLength(1)
  })

  it('keeps good data after a failed conversion or invalid disk replay, then recovers', async () => {
    const data = createCalendarData('calendar', () => NOW)
    const saved = await download(data)
    required(data.dataFile.onLoadRawData)(saved)
    const previous = data.readCalendar().events
    await expect(download(data, '<html>Unavailable</html>')).rejects.toThrow()
    expect(data.readCalendar().events).toEqual(previous)
    expect(data.readCalendar().error).toContain('update was invalid')
    for (const invalid of [
      null,
      {},
      { schema: 2, body: saved.body },
      { schema: 1, body: payload([], { filters: ['CW'] }) },
    ]) {
      required(data.dataFile.onLoadRawData)(invalid)
      expect(data.readCalendar().events).toEqual(previous)
      expect(data.readCalendar().error).toContain('could not be loaded')
    }
    required(data.dataFile.onLoadRawData)(saved)
    expect(data.readCalendar().error).toBeNull()
    await data.dataFile.onRemoveRawData?.()
    expect(data.readCalendar()).toEqual({ events: [], fetchedAt: null, stale: true, error: null })
  })

  it('rejects an unexpected source and preserves ongoing and boundary-spanning contests', async () => {
    const data = createCalendarData('calendar', () => NOW)
    await expect(
      required(data.dataFile.rawToJSONData)({
        body: payload(),
        url: 'https://example.org/',
        options: {},
      }),
    ).rejects.toThrow('source')
    required(data.dataFile.onLoadRawData)(
      await download(
        data,
        payload([
          occurrence({ start: '2026-09-16T00:00:00Z', end: '2026-10-15T00:00:00Z' }),
          occurrence({ uid: 'long', start: '2026-11-06T12:00:00Z', end: '2026-11-07T00:00:00Z' }),
        ]),
      ),
    )
    expect(data.readCalendar().events).toHaveLength(2)
    expect(data.readCalendar().error).toBeNull()
  })

  it('does not regress to an older replay and isolates consumers from stored arrays', async () => {
    const data = createCalendarData('calendar', () => NOW)
    const old = await download(data)
    const newer = await download(
      data,
      payload([], {
        from: new Date(NOW + day).toISOString(),
        to: new Date(NOW + 31 * day).toISOString(),
      }),
    )
    required(data.dataFile.onLoadRawData)(old)
    data.readCalendar().events[0].modes.push('SSB')
    expect(data.readCalendar().events[0].modes).toEqual(['CW'])
    required(data.dataFile.onLoadRawData)(newer)
    required(data.dataFile.onLoadRawData)(old)
    expect(data.readCalendar()).toMatchObject({ events: [], fetchedAt: NOW + day })
  })
})
