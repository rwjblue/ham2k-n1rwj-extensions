// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { JSONValue } from '@ham2k/extension-sdk'
import type { CalendarEvent } from './model.ts'
import { calendarPreviewDays } from './source.ts'

export type CalendarMode = 'all' | 'CW' | 'SSB' | 'DIGITAL'
export type CalendarTimeZone = 'utc' | 'local'
export interface CalendarPanelState {
  mode: CalendarMode
  timeZone: CalendarTimeZone
  selectedId: string | null
  favorites: string[]
  favoritesOnly: boolean
  page: number
}

export function initialPanelState(): CalendarPanelState {
  return {
    mode: 'all',
    timeZone: 'utc',
    selectedId: null,
    favorites: [],
    favoritesOnly: false,
    page: 0,
  }
}

export function readPanelState(value: JSONValue | null): CalendarPanelState {
  const state = initialPanelState()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return state
  if (isCalendarMode(value.mode)) state.mode = value.mode
  if (value.timeZone === 'utc' || value.timeZone === 'local') state.timeZone = value.timeZone
  if (typeof value.selectedId === 'string') state.selectedId = value.selectedId
  if (Array.isArray(value.favorites)) {
    state.favorites = [
      ...new Set(value.favorites.filter((id): id is string => typeof id === 'string')),
    ].slice(0, 256)
  }
  state.favoritesOnly = value.favoritesOnly === true
  if (typeof value.page === 'number' && Number.isInteger(value.page) && value.page >= 0)
    state.page = value.page
  return state
}

export function isCalendarMode(value: unknown): value is CalendarMode {
  return value === 'all' || value === 'CW' || value === 'SSB' || value === 'DIGITAL'
}

function matchesMode(event: CalendarEvent, mode: CalendarMode): boolean {
  if (mode === 'all') return true
  return event.modes.some((value) => {
    const normalized = value.toUpperCase()
    if (mode === 'DIGITAL') return /DIGI|RTTY|FT[48]|PSK/.test(normalized)
    if (mode === 'SSB') return normalized === 'SSB' || normalized === 'PHONE'
    return normalized === 'CW'
  })
}

export function calendarStatus(
  event: CalendarEvent,
  now: number,
): 'Live now' | 'Upcoming' | 'Local schedule' | 'Time unavailable' | 'Ended' {
  if (event.end !== null && event.end <= now) return 'Ended'
  if (event.start !== null && event.end !== null && event.start <= now) return 'Live now'
  if (event.start !== null && event.start > now) return 'Upcoming'
  return event.localTime ? 'Local schedule' : 'Time unavailable'
}

export function filteredEvents(
  events: CalendarEvent[],
  state: CalendarPanelState,
  now: number,
  options: { preview?: boolean } = {},
): CalendarEvent[] {
  return events
    .filter(
      (event) =>
        calendarStatus(event, now) !== 'Ended' &&
        withinCalendarPreview(event, now, options.preview !== false) &&
        matchesMode(event, state.mode) &&
        (!state.favoritesOnly || state.favorites.includes(event.id)),
    )
    .sort((a, b) => {
      const active =
        Number(calendarStatus(b, now) === 'Live now') -
        Number(calendarStatus(a, now) === 'Live now')
      return active || (a.start ?? Infinity) - (b.start ?? Infinity) || a.name.localeCompare(b.name)
    })
}

/** Local rolling schedules keep their wall dates; converting them to UTC would invent instants. */
export function withinCalendarPreview(event: CalendarEvent, now: number, preview = true): boolean {
  const day = 24 * 60 * 60_000
  const first = Math.floor(now / day) * day
  const through = first + calendarPreviewDays * day
  if (event.start !== null) return !preview || event.start < through
  const wallDates = event.localTime?.match(/\d{4}-\d{2}-\d{2}/g)
  if (!wallDates?.length) return true
  // Local wall dates can straddle the UTC window. Keep a conservative one-day
  // margin without assigning these rolling schedules an invented UTC instant.
  const firstDay = new Date(first - day).toISOString().slice(0, 10)
  const lastDay = new Date(through).toISOString().slice(0, 10)
  const startDay = wallDates[0]
  const endDay = wallDates[1] ?? startDay
  return endDay >= firstDay && (!preview || startDay <= lastDay)
}

export function selectedEvent(
  events: CalendarEvent[],
  state: CalendarPanelState,
): CalendarEvent | null {
  return events.find((event) => event.id === state.selectedId) ?? events[0] ?? null
}

/** Selection follows the visible page, so Details and Save cannot target an off-screen row. */
export function reconcilePage(
  events: CalendarEvent[],
  state: CalendarPanelState,
  size: number,
): CalendarPanelState {
  const page = Math.min(state.page, Math.max(0, Math.ceil(events.length / size) - 1))
  const visible = events.slice(page * size, (page + 1) * size)
  return { ...state, page, selectedId: selectedEvent(visible, state)?.id ?? null }
}

export function formatCalendarTime(millis: number, timeZone: CalendarTimeZone): string {
  const date = new Date(millis)
  const local = timeZone === 'local'
  const year = local ? date.getFullYear() : date.getUTCFullYear()
  const month = (local ? date.getMonth() : date.getUTCMonth()) + 1
  const day = local ? date.getDate() : date.getUTCDate()
  const hour = local ? date.getHours() : date.getUTCHours()
  const minute = local ? date.getMinutes() : date.getUTCMinutes()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} ${local ? 'local' : 'UTC'}`
}

export function calendarTimeRange(event: CalendarEvent, timeZone: CalendarTimeZone): string {
  if (event.start === null)
    return event.localTime ? `${event.localTime} · local schedule` : 'Start time unavailable'
  const start = formatCalendarTime(event.start, timeZone)
  return event.end === null
    ? `${start} · end unavailable`
    : `${start} – ${formatCalendarTime(event.end, timeZone)}`
}

export function safeExternalUrl(value: string | null): string | null {
  return value && /^https?:\/\/[^\s<>"\\]+$/i.test(value) ? value : null
}

export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/g, '\\$&')
}
