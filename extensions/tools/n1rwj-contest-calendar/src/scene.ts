// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  PanelEnvironment,
  PanelScene,
  PanelSceneControl,
  PanelSceneLayer,
} from '@ham2k/extension-sdk'
import type { CalendarSnapshot } from './model.ts'
import type { CalendarPanelState } from './panel-state.ts'
import {
  calendarStatus,
  calendarTimeRange,
  filteredEvents,
  formatCalendarTime,
  selectedEvent,
} from './panel-state.ts'
import { calendarPreviewDays } from './source.ts'

export interface CalendarSceneArgs {
  snapshot: CalendarSnapshot
  state: CalendarPanelState
  environment: PanelEnvironment
  now: number
  warning?: string | null
  revision?: number
}

export function calendarSceneGeometry(env: PanelEnvironment) {
  const width = Math.min(8192, Math.max(1, env.width))
  const height = Math.min(8192, Math.max(1, env.height))
  const left = 12 + env.safeInsets.left
  const right = Math.max(left + 1, width - 12 - env.safeInsets.right)
  const top = 12 + env.safeInsets.top
  const bottom = height - 12 - env.safeInsets.bottom
  const textHeight = (role: 'label' | 'body' | 'title') =>
    Math.max(
      24,
      Math.ceil(env.typography[role].scaledFontSize * env.typography[role].lineHeight + 8),
    )
  const labelHeight = textHeight('label')
  const bodyHeight = textHeight('body')
  const filterHeight = Math.max(46, Math.ceil(env.typography.body.scaledFontSize * 1.5 + 14))
  const filterTop = top + textHeight('title') + 8
  const noticeTop = filterTop + filterHeight + 8
  const listTop = noticeTop + labelHeight + 8
  const buttonHeight = Math.max(40, Math.ceil(env.typography.label.scaledFontSize * 1.5 + 14))
  const chipHeight = Math.max(36, Math.ceil(env.typography.label.scaledFontSize * 1.5 + 10))
  const footerTop = bottom - buttonHeight - chipHeight - 4
  const cardHeight = 12 + 2 * labelHeight + bodyHeight + 8
  const rowHeight = cardHeight + 8
  const capacity = Math.min(3, Math.max(0, Math.floor((footerTop - listTop - 8) / rowHeight)))
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    usable: right - left,
    labelHeight,
    bodyHeight,
    filterHeight,
    filterTop,
    noticeTop,
    listTop,
    buttonHeight,
    chipHeight,
    footerTop,
    cardHeight,
    rowHeight,
    capacity,
  }
}

export function calendarPageSize(environment?: PanelEnvironment): number {
  return environment ? Math.max(1, calendarSceneGeometry(environment).capacity) : 3
}

export function cacheLabel(snapshot: CalendarSnapshot): string {
  if (snapshot.fetchedAt === null) return 'ContestClock · no downloaded calendar yet'
  return `ContestClock · ${snapshot.stale ? 'stale · ' : ''}calendar generated ${formatCalendarTime(snapshot.fetchedAt, 'utc')}`
}

export function createCalendarScene({
  snapshot,
  state,
  environment: env,
  now,
  warning,
  revision = 0,
}: CalendarSceneArgs): PanelScene {
  const {
    width,
    height,
    left,
    right,
    usable,
    top,
    labelHeight,
    bodyHeight,
    filterTop,
    filterHeight,
    noticeTop,
    listTop,
    buttonHeight,
    chipHeight,
    footerTop,
    cardHeight,
    rowHeight,
    capacity,
  } = calendarSceneGeometry(env)
  const events = filteredEvents(snapshot.events, state, now)
  const count = Math.max(1, capacity)
  const lastPage = Math.max(0, Math.ceil(events.length / count) - 1)
  const page = Math.min(state.page, lastPage)
  const visible = events.slice(page * count, (page + 1) * count)
  const selected = selectedEvent(visible, state)
  const strings = { mode: state.mode, timeZone: state.timeZone }
  const values = { revision, favoritesOnly: Number(state.favoritesOnly) }
  const layers: PanelSceneLayer[] = []
  const controls: PanelSceneControl[] = []
  function text(
    id: string,
    literal: string,
    y: number,
    role: 'label' | 'body' | 'title' = 'body',
    color = env.colors.onSurface,
    available = usable,
    x = left,
  ) {
    const type = env.typography[role]
    const maxCharacters = Math.max(4, Math.floor(available / (type.scaledFontSize * 0.53)))
    const rendered =
      literal.length > maxCharacters
        ? `${literal.slice(0, Math.max(1, maxCharacters - 1))}…`
        : literal
    layers.push({
      id,
      x,
      y,
      width: Math.max(1, available),
      height: Math.max(Math.ceil(type.scaledFontSize * type.lineHeight + 8), 24),
      text: {
        literal: rendered,
        size: type.fontSize,
        color,
        fontFamily: type.fontFamily ?? undefined,
        fontWeight: type.fontWeight,
        lineHeight: type.lineHeight,
        letterSpacing: type.letterSpacing,
      },
    })
  }
  function button(
    id: string,
    label: string,
    event: string,
    x: number,
    y: number,
    buttonWidth: number,
    disabled = false,
  ) {
    controls.push({
      id,
      kind: 'nativeButton',
      label,
      event,
      variant: 'text',
      x,
      y,
      width: Math.max(1, buttonWidth),
      height: buttonHeight,
      disabled,
    })
  }

  // A very short pane still offers the complete calendar in a scrolling native form.
  if (capacity === 0 || usable < 280) {
    const availableHeight = height - top - env.safeInsets.bottom - 12
    controls.push({
      id: 'browse',
      kind: 'nativeButton',
      label: 'Browse calendar',
      event: 'browse',
      variant: 'outlined',
    })
    const children: { control: string }[] = []
    if (availableHeight >= buttonHeight + labelHeight * 2 + 16) {
      controls.push({
        id: 'status',
        kind: 'nativeText',
        label: `ContestClock · ${snapshot.fetchedAt === null ? 'download in Data Files' : snapshot.stale ? 'saved calendar · stale' : 'saved calendar'}`,
        style: 'label',
      })
      children.push({ control: 'status' })
    }
    children.push({ control: 'browse' })
    return {
      version: 1,
      width,
      height,
      values,
      strings,
      layers: [],
      controls,
      layout: {
        column: children,
        padding: [
          12 + env.safeInsets.left,
          top,
          12 + env.safeInsets.right,
          12 + env.safeInsets.bottom,
        ],
        spacing: 8,
        crossAxisAlignment: 'stretch',
      },
    }
  }

  text('heading', `Next ${calendarPreviewDays} UTC days`, top, 'title', env.colors.accent)
  const modeWidth = Math.min(142, Math.max(100, usable * 0.42))
  controls.push(
    {
      id: 'mode',
      kind: 'nativeDropdown',
      label: 'Mode filter',
      value: 'mode',
      event: 'mode',
      x: left,
      y: filterTop,
      width: modeWidth,
      height: filterHeight,
      options: [
        { label: 'All modes', value: 'all' },
        { label: 'CW', value: 'CW' },
        { label: 'Phone', value: 'SSB' },
        { label: 'Digital', value: 'DIGITAL' },
      ],
    },
    {
      id: 'timeZone',
      kind: 'nativeDropdown',
      label: 'Display time zone',
      value: 'timeZone',
      event: 'timeZone',
      x: left + modeWidth + 8,
      y: filterTop,
      width: Math.min(108, usable - modeWidth - 8),
      height: filterHeight,
      options: [
        { label: 'UTC', value: 'utc' },
        { label: 'Local', value: 'local' },
      ],
    },
  )
  const notice = warning ?? snapshot.error
  text(
    'notice',
    notice
      ? `ContestClock · ${snapshot.events.length ? 'saved calendar · ' : ''}${notice}`
      : cacheLabel(snapshot),
    noticeTop,
    'label',
    notice ? env.colors.error : env.colors.onSurfaceVariant,
  )
  let y = listTop

  if (!visible.length) {
    text(
      'empty',
      snapshot.fetchedAt === null
        ? 'Download in Settings → Data Files'
        : state.favoritesOnly
          ? 'No saved contests match this filter'
          : `No matching contests in the next ${calendarPreviewDays} UTC days`,
      y,
      'body',
    )
    y += bodyHeight + 8
  }
  for (const [index, event] of visible.entries()) {
    const selectedRow = selected?.id === event.id
    layers.push({
      id: `row-${index}`,
      x: left,
      y,
      width: usable,
      height: cardHeight,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${usable} ${cardHeight}"><rect x="0.5" y="0.5" width="${Math.max(1, usable - 1)}" height="${cardHeight - 1}" rx="8" fill="${selectedRow ? env.colors.surfaceContainer : env.colors.surface}" stroke="${selectedRow ? env.colors.accent : env.colors.outlineVariant}"/></svg>`,
    })
    const status = calendarStatus(event, now)
    text(
      `event-status-${index}`,
      `${status} · ${event.modes.join(' / ') || 'Mode unspecified'}${event.verified ? '' : ' · unverified'}`,
      y + 6,
      'label',
      status === 'Live now' ? env.colors.accent : env.colors.onSurfaceVariant,
      usable - 16,
      left + 8,
    )
    text(
      `event-name-${index}`,
      `${state.favorites.includes(event.id) ? '★ ' : ''}${event.name}`,
      y + 6 + labelHeight + 4,
      'body',
      env.colors.onSurface,
      usable - 16,
      left + 8,
    )
    const time =
      event.start === null
        ? (event.localTime ?? 'Time unavailable')
        : formatCalendarTime(event.start, state.timeZone)
    text(
      `event-time-${index}`,
      time,
      y + 6 + labelHeight + 4 + bodyHeight + 4,
      'label',
      env.colors.onSurfaceVariant,
      usable - 16,
      left + 8,
    )
    controls.push({
      id: `select-${index}`,
      kind: 'button',
      label: `Select ${event.name}. ${status}. ${time}`,
      event: `select:${event.id}`,
      x: left,
      y,
      width: usable,
      height: cardHeight,
    })
    y += rowHeight
  }

  const detailsRoom = footerTop - y
  if (selected && detailsRoom >= labelHeight + 8) {
    text('selected-heading', `Selected: ${selected.name}`, y + 4, 'label', env.colors.accent)
    if (detailsRoom >= labelHeight * 2 + 12)
      text(
        'selected-end',
        calendarTimeRange(selected, state.timeZone),
        y + labelHeight + 8,
        'label',
        env.colors.onSurfaceVariant,
      )
    if (detailsRoom >= labelHeight * 3 + 16)
      text(
        'selected-verification',
        selected.verified
          ? 'Marked verified by source · check sponsor rules'
          : 'Not verified by source · check sponsor rules',
        y + labelHeight * 2 + 12,
        'label',
        env.colors.onSurfaceVariant,
      )
  }
  const buttonWidth = Math.max(70, usable / 3)
  button('details', 'Details', 'details', left, footerTop, buttonWidth, !selected)
  button(
    'favorite',
    selected && state.favorites.includes(selected.id) ? 'Unsave' : 'Save',
    'favorite',
    left + buttonWidth,
    footerTop,
    buttonWidth,
    !selected,
  )
  button('browse', 'Browse', 'browse', left + buttonWidth * 2, footerTop, usable - buttonWidth * 2)
  controls.push({
    id: 'favoritesOnly',
    kind: 'nativeChip',
    label: 'Saved only',
    value: 'favoritesOnly',
    event: 'favoritesOnly',
    x: left,
    y: footerTop + buttonHeight + 4,
    width: Math.min(124, usable * 0.42),
    height: chipHeight,
  })
  if (events.length > count) {
    const pageLeft = left + Math.min(124, usable * 0.42) + 4
    const pagerWidth = Math.max(1, (right - pageLeft) / 2)
    button(
      'previous',
      'Back',
      'previous',
      pageLeft,
      footerTop + buttonHeight + 4,
      pagerWidth,
      page === 0,
    )
    button(
      'next',
      'Next',
      'next',
      pageLeft + pagerWidth,
      footerTop + buttonHeight + 4,
      pagerWidth,
      page >= lastPage,
    )
    controls[controls.length - 1].height = chipHeight
    controls[controls.length - 2].height = chipHeight
  } else {
    text(
      'attribution',
      'via ContestClock',
      footerTop + buttonHeight + 8,
      'label',
      env.colors.onSurfaceVariant,
      usable - Math.min(124, usable * 0.42) - 8,
      left + Math.min(124, usable * 0.42) + 8,
    )
  }
  return { version: 1, width, height, values, strings, layers, controls }
}
