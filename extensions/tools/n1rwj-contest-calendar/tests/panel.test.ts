import type {
  FormDefinition,
  JSONValue,
  PanelEnvironment,
  PanelRenderArgs,
} from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, CalendarSnapshot } from '../src/model.ts'
import { calendarDetailsForm, createCalendarPanel } from '../src/panel.ts'
import {
  calendarStatus,
  calendarTimeRange,
  filteredEvents,
  formatCalendarTime,
  initialPanelState,
  readPanelState,
  withinCalendarPreview,
} from '../src/panel-state.ts'

const now = Date.UTC(2026, 9, 7, 12)
function event(id: string, fields: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    name: `Contest ${id}`,
    start: now + 60_000,
    end: now + 3_600_000,
    modes: ['CW'],
    rulesUrl: 'https://example.org/rules',
    sourceUrl: 'https://contestclock.com/',
    verified: true,
    localTime: null,
    ...fields,
  }
}
function environment(): PanelEnvironment {
  const type = {
    fontFamily: 'Roboto',
    fontFamilyFallback: [],
    fontSize: 14,
    scaledFontSize: 14,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  return {
    version: 1,
    width: 500,
    height: 700,
    safeInsets: { left: 0, right: 0, top: 0, bottom: 0 },
    brightness: 'light',
    colors: {
      surface: '#FBFCFE',
      surfaceContainer: '#EEEEEE',
      onSurface: '#191C1E',
      onSurfaceVariant: '#40484C',
      accent: '#006783',
      primary: '#006783',
      onPrimary: '#FFFFFF',
      secondary: '#005FAF',
      outline: '#70787D',
      outlineVariant: '#DCE6E8',
      error: '#B00020',
      onError: '#FFFFFF',
    },
    typography: {
      body: type,
      label: type,
      title: { ...type, fontSize: 20, scaledFontSize: 20 },
      display: type,
      mono: type,
    },
    locale: 'en',
    textDirection: 'ltr',
    devicePixelRatio: 1,
    reducedMotion: false,
    highContrast: false,
  }
}
function args(fields: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    panelKey: 'calendar',
    instanceId: 'home-calendar',
    operation: {},
    qsoCount: 0,
    config: {},
    reason: 'visible',
    environment: environment(),
    clock: { nowMillis: now, realNowMillis: now },
    ...fields,
  }
}
function setup(events: CalendarEvent[] = [event('cw'), event('phone', { modes: ['SSB'] })]) {
  const snapshot: CalendarSnapshot = { events, fetchedAt: now, stale: false, error: null }
  const saved = new Map<string, JSONValue>()
  const readCalendar = vi.fn(() => snapshot)
  const get = vi.fn(async (key: string) => saved.get(key) ?? null)
  const set = vi.fn(async (key: string, value: JSONValue) => {
    saved.set(key, value)
  })
  const showForm = vi.fn(async (_form: FormDefinition): Promise<unknown> => null)
  const panel = createCalendarPanel({
    readCalendar,
    stateHost: { get, set },
    now: () => now,
    showForm,
  })
  return { panel, readCalendar, get, set, saved, showForm, snapshot }
}
const sequences = new WeakMap<ReturnType<typeof createCalendarPanel>, number>()
async function action(
  panel: ReturnType<typeof createCalendarPanel>,
  name: string,
  fields: { text?: string; value?: number; environment?: PanelEnvironment } = {},
) {
  const sequence = (sequences.get(panel) ?? 0) + 1
  sequences.set(panel, sequence)
  const { environment: env, ...eventFields } = fields
  if (!panel.onEvent) throw new Error('Calendar panel has no event handler')
  const renderArgs = args(env ? { environment: env } : {})
  const content = await panel.render(renderArgs, { online: true })
  if (content.kind !== 'scene') throw new Error('Calendar panel has no scene')
  const control = content.scene.controls?.find((item) => item.event?.endsWith(`:${name}`))
  if (!control?.event) throw new Error(`Calendar has no rendered ${name} action`)
  return panel.onEvent(
    {
      ...renderArgs,
      event: {
        controlId: control.id,
        action: control.event,
        phase: ['mode', 'timeZone', 'favoritesOnly'].includes(name) ? 'commit' : 'activate',
        sequence,
        ...eventFields,
      },
    },
    { online: true },
  )
}

describe('calendar panel lifecycle and actions', () => {
  it('offers an opt-in pane without reading data or platform restrictions', async () => {
    const { panel, readCalendar, get } = setup()
    const descriptors = await panel.getPanels({}, { online: true })
    expect(descriptors).toHaveLength(1)
    expect(descriptors[0]).toMatchObject({ key: 'calendar', on: ['tick:60'] })
    expect(descriptors[0]).not.toHaveProperty('environment')
    expect(descriptors[0]).not.toHaveProperty('views')
    expect(readCalendar).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('reads the current file on reveal and uses the host display clock', async () => {
    const { panel, readCalendar } = setup([event('cw', { start: now - 60_000, end: now + 60_000 })])
    const current = await panel.render(args(), { online: true })
    expect(current.kind).toBe('scene')
    expect(JSON.stringify(current)).toContain('Live now')
    const future = await panel.render(
      args({ clock: { nowMillis: now + 120_000, realNowMillis: now } }),
      { online: true },
    )
    expect(JSON.stringify(future)).not.toContain('Contest cw')
    expect(readCalendar).toHaveBeenCalledTimes(2)
  })

  it('persists mode changes per placement and updates the next render', async () => {
    const { panel, saved } = setup()
    await panel.render(args(), { online: true })
    await action(panel, 'mode', { text: 'SSB' })
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({ mode: 'SSB' })
    const content = JSON.stringify(await panel.render(args(), { online: true }))
    expect(content).toContain('Contest phone')
    expect(content).not.toContain('Contest cw')
    const other = JSON.stringify(
      await panel.render(args({ instanceId: 'operation-calendar' }), { online: true }),
    )
    expect(other).toContain('Contest cw')
  })

  it('keeps selections and saved contests across a new runtime', async () => {
    const first = setup()
    await first.panel.render(args(), { online: true })
    await action(first.panel, 'select:phone')
    await action(first.panel, 'favorite')
    await action(first.panel, 'favoritesOnly', { value: 1 })
    const next = createCalendarPanel({
      readCalendar: first.readCalendar,
      stateHost: { get: first.get, set: first.set },
      now: () => now,
      showForm: first.showForm,
    })
    const content = JSON.stringify(await next.render(args(), { online: true }))
    expect(content).toContain('★ Contest phone')
    expect(content).not.toContain('Contest cw')
  })

  it('uses only synchronous file reads and never exposes a Refresh action', async () => {
    const { panel, readCalendar, showForm, set } = setup()
    const scene = await panel.render(args(), { online: true })
    if (scene.kind !== 'scene') throw new Error('No calendar scene')
    expect(scene.scene.controls?.some((control) => control.event?.endsWith(':refresh'))).toBe(false)
    await action(panel, 'mode', { text: 'CW' })
    await action(panel, 'favorite')
    await action(panel, 'browse')
    const form = showForm.mock.calls[0][0]
    expect(
      form.elements.some((element) => element.type === 'field' && element.key === 'refresh'),
    ).toBe(false)
    expect(JSON.stringify(form)).toContain('Settings → Data Files')
    expect(readCalendar.mock.calls.every((call) => call.length === 0)).toBe(true)
    const reads = readCalendar.mock.calls.length
    const writes = set.mock.calls.length
    await panel.onEvent?.(
      {
        ...args(),
        event: { controlId: 'refresh', action: 'refresh', phase: 'activate', sequence: 50 },
      },
      { online: true },
    )
    expect(readCalendar).toHaveBeenCalledTimes(reads)
    expect(set).toHaveBeenCalledTimes(writes)
  })

  it('makes Details and Save target the visible row after paging', async () => {
    const { panel, saved, showForm } = setup(
      Array.from({ length: 5 }, (_, index) => event(String(index))),
    )
    const env = { ...environment(), width: 360, height: 480 }
    const first = await panel.render(args({ environment: env }), { online: true })
    expect(first.kind).toBe('scene')
    const pageSize =
      first.kind === 'scene'
        ? (first.scene.controls?.filter((control) => control.id.startsWith('select-')).length ?? 0)
        : 0
    await action(panel, 'next', { environment: env })
    await action(panel, 'favorite', { environment: env })
    await action(panel, 'details', { environment: env })
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({
      selectedId: String(pageSize),
      favorites: [String(pageSize)],
    })
    expect(showForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: `Contest ${pageSize}` }),
    )
  })

  it('reconciles a saved page after data changes remove its rows', async () => {
    const { panel, saved, snapshot } = setup(
      Array.from({ length: 7 }, (_, index) => event(String(index))),
    )
    await panel.render(args(), { online: true })
    await action(panel, 'next')
    snapshot.events = [event('only')]
    const rendered = await panel.render(args(), { online: true })
    expect(JSON.stringify(rendered)).toContain('Contest only')
    await action(panel, 'favorite')
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({
      selectedId: 'only',
      page: 0,
      favorites: ['only'],
    })
  })

  it('lets compact pane users save contests through Browse without downloading', async () => {
    const { panel, showForm, saved, readCalendar } = setup([event('one')])
    const env = { ...environment(), width: 240, height: 140 }
    await panel.render(args({ environment: env }), { online: true })
    showForm.mockResolvedValueOnce({ 'saved-0': true, favoritesOnly: true })
    await action(panel, 'browse', { environment: env })
    const form = showForm.mock.calls[0][0]
    expect(form.elements).toContainEqual(
      expect.objectContaining({ key: 'saved-0', fieldType: 'checkbox' }),
    )
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({
      favorites: ['one'],
      favoritesOnly: true,
    })
    expect(
      form.elements.some((element) => element.type === 'field' && element.key === 'refresh'),
    ).toBe(false)
    expect(readCalendar).toHaveBeenCalledTimes(2)
  })

  it('keeps the complete downloaded month available in Browse beyond the pane preview', async () => {
    const events = monthEvents()
    const { panel, showForm, saved } = setup(events)
    await action(panel, 'browse')
    const form = showForm.mock.calls[0][0]
    expect(form.elements.filter((element) => element.type === 'header')).toHaveLength(30)
    expect(form.elements).toContainEqual(expect.objectContaining({ title: 'Contest day-29' }))
    showForm.mockResolvedValueOnce({ 'saved-29': true })
    await action(panel, 'browse')
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({ favorites: ['day-29'] })
    const content = JSON.stringify(await panel.render(args(), { online: true }))
    expect(content).not.toContain('Contest day-29')
  })

  it('explains native Data Files management when the file is missing', async () => {
    const { panel, snapshot, showForm } = setup([])
    snapshot.fetchedAt = null
    await action(panel, 'browse')
    expect(JSON.stringify(showForm.mock.calls[0][0])).toContain(
      'Download or update Contest Calendar in Settings → Data Files.',
    )
    const fallback = await panel.render(args({ environment: undefined }), { online: true })
    expect(JSON.stringify(fallback)).toContain('Settings → Data Files')
  })

  it('ignores an inappropriate phase or replayed sequence instead of toggling a saved contest twice', async () => {
    const { panel, saved, set } = setup([event('one')])
    const rendered = await panel.render(args(), { online: true })
    if (rendered.kind !== 'scene') throw new Error('No calendar scene')
    const favoriteAction = rendered.scene.controls?.find(
      (control) => control.id === 'favorite',
    )?.event
    if (!favoriteAction) throw new Error('No favorite control')
    const toggle = {
      ...args(),
      event: {
        controlId: 'favorite',
        action: favoriteAction,
        phase: 'activate' as const,
        sequence: 1,
      },
    }
    await panel.onEvent?.(toggle, { online: true })
    await panel.onEvent?.(toggle, { online: true })
    await panel.onEvent?.(
      { ...toggle, event: { ...toggle.event, phase: 'commit', sequence: 2 } },
      { online: true },
    )
    expect(saved.get('calendar.panel.home-calendar')).toMatchObject({ favorites: ['one'] })
    expect(set).toHaveBeenCalledTimes(1)
  })

  it.each(['initial', 'retry', 'visible'])(
    'accepts the host sequence restarting after a %s render',
    async (reason) => {
      const { panel, saved } = setup([event('one')])
      const first = await panel.render(args(), { online: true })
      if (first.kind !== 'scene') throw new Error('No calendar scene')
      const firstAction = first.scene.controls?.find((control) => control.id === 'favorite')?.event
      if (!firstAction) throw new Error('No favorite control')
      const toggle = {
        ...args(),
        event: {
          controlId: 'favorite',
          action: firstAction,
          phase: 'activate' as const,
          sequence: 1,
        },
      }
      await panel.onEvent?.(toggle, { online: true })
      const second = await panel.render(args({ reason }), { online: true })
      if (second.kind !== 'scene') throw new Error('No calendar scene')
      const secondAction = second.scene.controls?.find(
        (control) => control.id === 'favorite',
      )?.event
      if (!secondAction) throw new Error('No favorite control')
      await panel.onEvent?.(
        { ...toggle, event: { ...toggle.event, action: secondAction } },
        { online: true },
      )
      expect(saved.get('calendar.panel.home-calendar')).toMatchObject({ favorites: [] })
    },
  )

  it('rejects stale render actions and action/control mismatches', async () => {
    const { panel, set } = setup([event('one')])
    const first = await panel.render(args(), { online: true })
    if (first.kind !== 'scene') throw new Error('No calendar scene')
    const stale = first.scene.controls?.find((control) => control.id === 'favorite')?.event
    if (!stale) throw new Error('No favorite control')
    const second = await panel.render(args(), { online: true })
    if (second.kind !== 'scene') throw new Error('No calendar scene')
    const current = second.scene.controls?.find((control) => control.id === 'favorite')?.event
    if (!current) throw new Error('No favorite control')
    await panel.onEvent?.(
      {
        ...args(),
        event: { controlId: 'favorite', action: stale, phase: 'activate', sequence: 12 },
      },
      { online: true },
    )
    await panel.onEvent?.(
      {
        ...args(),
        event: { controlId: 'details', action: current, phase: 'activate', sequence: 13 },
      },
      { online: true },
    )
    expect(set).not.toHaveBeenCalled()
  })

  it('opens selected details through a native form with approved external links', async () => {
    const { panel, showForm } = setup([event('cw', { verified: false })])
    await panel.render(args(), { online: true })
    await action(panel, 'details')
    expect(showForm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Contest cw' }))
    const form = showForm.mock.calls[0][0]
    expect(form.elements.filter((item) => item.type === 'link')).toHaveLength(3)
    expect(JSON.stringify(form)).toContain('Not marked verified')
    expect(JSON.stringify(form)).not.toContain('operation')
  })

  it('continues for the session and visibly reports failed preference writes', async () => {
    const { panel, set } = setup()
    await panel.render(args(), { online: true })
    set.mockRejectedValueOnce(new Error('storage unavailable'))
    await action(panel, 'mode', { text: 'CW' })
    const scene = JSON.stringify(await panel.render(args(), { online: true }))
    expect(scene).toContain('Preferences not saved')
  })

  it('provides readable Markdown when a host supplies no scene environment', async () => {
    const { panel } = setup([
      event('local', { start: null, end: null, localTime: '09:00–17:00', verified: false }),
    ])
    const content = await panel.render(args({ environment: undefined }), { online: true })
    expect(content.kind).toBe('markdown')
    expect(JSON.stringify(content)).toContain('local schedule')
    expect(JSON.stringify(content)).toContain('Sponsor rules')
  })
})

const day = 24 * 60 * 60_000
function monthEvents(): CalendarEvent[] {
  const firstDay = Math.floor(now / day) * day
  return Array.from({ length: 30 }, (_, index) =>
    event(`day-${index}`, {
      start: firstDay + index * day + 18 * 3_600_000,
      end: firstDay + index * day + 19 * 3_600_000,
    }),
  )
}

describe('calendar precedence and uncertain schedules', () => {
  it('previews 14 complete UTC calendar dates from the same downloaded month a week later', () => {
    const events = monthEvents()
    const state = initialPanelState()
    expect(filteredEvents(events, state, now).map((item) => item.id)).toEqual(
      Array.from({ length: 14 }, (_, index) => `day-${index}`),
    )
    expect(filteredEvents(events, state, now + 7 * day).map((item) => item.id)).toEqual(
      Array.from({ length: 14 }, (_, index) => `day-${index + 7}`),
    )
    expect(filteredEvents(events, state, now, { preview: false })).toHaveLength(30)
  })

  it('uses UTC date boundaries and includes ongoing contests which started earlier', () => {
    const firstDay = Math.floor(now / day) * day
    const through = firstDay + 14 * day
    const events = [
      event('ongoing', { start: firstDay - day, end: firstDay + day }),
      event('last-minute', { start: through - 60_000, end: through }),
      event('outside', { start: through, end: through + 60_000 }),
    ]
    expect(filteredEvents(events, initialPanelState(), now).map((item) => item.id)).toEqual([
      'ongoing',
      'last-minute',
    ])
    expect(withinCalendarPreview(events[1], firstDay + 60_000)).toBe(true)
    expect(withinCalendarPreview(events[1], firstDay + day - 60_000)).toBe(true)
    expect(withinCalendarPreview(events[2], firstDay + day - 60_000)).toBe(false)
  })

  it('compares local rolling wall dates without inventing UTC instants', () => {
    const local = (id: string, localTime: string) =>
      event(id, { start: null, end: null, localTime })
    const events = [
      local('spanning', '2026-10-06 18:00:00 – 2026-10-08 19:00:00 local'),
      local('last-day', '2026-10-20 18:00:00 – 2026-10-20 19:00:00 local'),
      local('boundary-after', '2026-10-21 00:00:00 – 2026-10-21 01:00:00 local'),
      local('boundary-before', '2026-10-06 18:00:00 – 2026-10-06 19:00:00 local'),
      local('outside', '2026-10-22 00:00:00 – 2026-10-22 01:00:00 local'),
      local('past', '2026-10-05 18:00:00 – 2026-10-05 19:00:00 local'),
      local('undated', '18:00–19:00'),
    ]
    expect(filteredEvents(events, initialPanelState(), now).map((item) => item.id)).toEqual([
      'boundary-after',
      'boundary-before',
      'last-day',
      'spanning',
      'undated',
    ])
    // Browse drops the preview's upper bound, but still expires past local dates.
    expect(
      filteredEvents(events, initialPanelState(), now, { preview: false }).map((item) => item.id),
    ).toEqual(['boundary-after', 'boundary-before', 'last-day', 'outside', 'spanning', 'undated'])
    expect(events.every((item) => item.start === null && item.end === null)).toBe(true)
    expect(calendarStatus(events[0], now)).toBe('Local schedule')
  })

  it('shows active contests first, removes ended events and preserves untimed local schedules', () => {
    const events = [
      event('later'),
      event('ended', { start: now - 120_000, end: now }),
      event('live', { start: now - 60_000 }),
      event('local', { start: null, end: null, localTime: '18:00–19:00' }),
    ]
    expect(filteredEvents(events, initialPanelState(), now).map((item) => item.id)).toEqual([
      'live',
      'later',
      'local',
    ])
    expect(calendarStatus(events[3], now)).toBe('Local schedule')
    expect(calendarTimeRange(events[3], 'utc')).toContain('local schedule')
    expect(calendarTimeRange(events[3], 'utc')).not.toContain('UTC')
  })

  it('never guesses an active status from a start without an end', () => {
    expect(calendarStatus(event('missing-end', { start: now - 60_000, end: null }), now)).toBe(
      'Time unavailable',
    )
    expect(calendarTimeRange(event('missing-end', { end: null }), 'utc')).toContain(
      'end unavailable',
    )
  })

  it('treats RTTY as digital and preserves unknown mode events in the unfiltered calendar', () => {
    const state = { ...initialPanelState(), mode: 'DIGITAL' as const }
    const events = [
      event('rtty', { modes: ['RTTY'] }),
      event('unknown', { modes: [] }),
      event('cw'),
    ]
    expect(filteredEvents(events, state, now).map((item) => item.id)).toEqual(['rtty'])
    expect(filteredEvents(events, initialPanelState(), now)).toHaveLength(3)
  })

  it('rejects malformed persisted preferences without discarding valid values', () => {
    expect(
      readPanelState({ mode: 'fake', timeZone: 'utc', favorites: ['one', 1, 'one'], page: -1 }),
    ).toMatchObject({ mode: 'all', timeZone: 'utc', favorites: ['one'], page: 0 })
    expect(readPanelState(['CW'])).toEqual(initialPanelState())
  })

  it('formats UTC deterministically and local time through supported Date getters', () => {
    expect(formatCalendarTime(now, 'utc')).toBe('2026-10-07 12:00 UTC')
    const date = new Date(now)
    expect(formatCalendarTime(now, 'local')).toContain(
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} local`,
    )
  })

  it('never exposes executable schemes from a malformed source record', () => {
    const form = calendarDetailsForm(
      event('bad', { rulesUrl: 'javascript:alert(1)', sourceUrl: 'com.ham2k:///operation' }),
      initialPanelState(),
      now,
    )
    expect(form.elements.filter((element) => element.type === 'link')).toEqual([
      expect.objectContaining({
        label: 'CC BY 4.0 data license',
        url: 'https://creativecommons.org/licenses/by/4.0/',
      }),
    ])
  })
})
