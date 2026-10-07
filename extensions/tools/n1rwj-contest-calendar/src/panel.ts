// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  FormDefinition,
  FormElement,
  JSONValue,
  PanelContent,
  PanelHook,
  PanelRenderArgs,
  PanelSceneControl,
} from '@ham2k/extension-sdk'
import type { CalendarEvent, CalendarSnapshot } from './model.ts'
import type { CalendarPanelState } from './panel-state.ts'
import {
  calendarStatus,
  calendarTimeRange,
  escapeMarkdown,
  filteredEvents,
  initialPanelState,
  isCalendarMode,
  readPanelState,
  reconcilePage,
  safeExternalUrl,
  selectedEvent,
} from './panel-state.ts'
import { cacheLabel, calendarPageSize, createCalendarScene } from './scene.ts'

export interface CalendarPanelAdapters {
  readCalendar(): CalendarSnapshot
  stateHost: {
    get(key: string): Promise<JSONValue | null>
    set(key: string, value: JSONValue): Promise<void>
  }
  now(): number
  showForm(form: FormDefinition): Promise<unknown>
}

interface PanelSession {
  state: CalendarPanelState
  snapshot: CalendarSnapshot | null
  warning: string | null
  revision: number
  epoch: number
  renderVersion: number
  controls: Map<string, PanelSceneControl>
  seen: Set<number>
}

function detailsText(event: CalendarEvent, state: CalendarPanelState, now: number): string {
  return [
    `${calendarStatus(event, now)} · ${escapeMarkdown(event.modes.join(' / ') || 'Mode unspecified')}`,
    escapeMarkdown(calendarTimeRange(event, state.timeZone)),
    event.verified
      ? 'Marked verified by ContestClock. Confirm the current schedule and rules with the sponsor.'
      : 'Not marked verified by ContestClock. Confirm the schedule and rules with the sponsor.',
  ].join('\n\n')
}

function eventElements(
  event: CalendarEvent,
  state: CalendarPanelState,
  now: number,
): FormElement[] {
  const elements: FormElement[] = [{ type: 'markdown', text: detailsText(event, state, now) }]
  const rules = safeExternalUrl(event.rulesUrl)
  const source = safeExternalUrl(event.sourceUrl)
  if (rules)
    elements.push({ type: 'link', label: 'Sponsor rules', url: rules, icon: 'open-in-new' })
  if (source)
    elements.push({
      type: 'link',
      label: 'ContestClock calendar',
      url: source,
      icon: 'calendar-clock',
    })
  return elements
}

export function calendarDetailsForm(
  event: CalendarEvent,
  state: CalendarPanelState,
  now: number,
): FormDefinition {
  return { title: event.name, elements: [...eventElements(event, state, now), ...sourceCredit()] }
}

function sourceCredit(): FormElement[] {
  return [
    {
      type: 'markdown',
      text: 'ContestClock calendar data by Joe Leone (W4GGJ), licensed under CC BY 4.0. Schedules are normalized and filtered for this pane.',
    },
    {
      type: 'link',
      label: 'CC BY 4.0 data license',
      url: 'https://creativecommons.org/licenses/by/4.0/',
      icon: 'open-in-new',
    },
  ]
}

function browseEvents(
  snapshot: CalendarSnapshot,
  state: CalendarPanelState,
  now: number,
): CalendarEvent[] {
  return filteredEvents(snapshot.events, { ...state, mode: 'all', favoritesOnly: false }, now, {
    preview: false,
  })
}

function browseForm(
  snapshot: CalendarSnapshot,
  state: CalendarPanelState,
  now: number,
  warning: string | null,
): FormDefinition {
  const events = browseEvents(snapshot, state, now)
  const elements: FormElement[] = [
    {
      type: 'markdown',
      text: `${escapeMarkdown(cacheLabel(snapshot))}\n\nDownload or update Contest Calendar in Settings → Data Files.${snapshot.error ? `\n\n${escapeMarkdown(snapshot.error)}` : ''}${warning ? `\n\n${escapeMarkdown(warning)}` : ''}`,
    },
    {
      type: 'field',
      fieldType: 'select',
      key: 'mode',
      label: 'Mode filter',
      value: state.mode,
      options: [
        { label: 'All modes', value: 'all' },
        { label: 'CW', value: 'CW' },
        { label: 'Phone', value: 'SSB' },
        { label: 'Digital', value: 'DIGITAL' },
      ],
    },
    {
      type: 'field',
      fieldType: 'select',
      key: 'timeZone',
      label: 'Display time zone',
      value: state.timeZone,
      options: [
        { label: 'UTC', value: 'utc' },
        { label: 'Local', value: 'local' },
      ],
    },
    {
      type: 'field',
      fieldType: 'checkbox',
      key: 'favoritesOnly',
      label: 'Saved contests only',
      value: state.favoritesOnly,
    },
  ]
  if (!events.length)
    elements.push({
      type: 'markdown',
      text:
        snapshot.fetchedAt === null
          ? 'No calendar data file is available yet.'
          : 'No active or upcoming contests are available in this data file.',
    })
  for (const [index, event] of events.entries()) {
    elements.push(
      { type: 'header', title: event.name },
      {
        type: 'field',
        fieldType: 'checkbox',
        key: `saved-${index}`,
        label: 'Saved contest',
        value: state.favorites.includes(event.id),
      },
      ...eventElements(event, state, now),
    )
  }
  elements.push(...sourceCredit())
  return {
    title: 'Contest Calendar',
    subtitle:
      'Browse all upcoming contests, choose saved contests, and apply filters to the pane. Local times use this device’s time zone.',
    elements,
  }
}

export function calendarMarkdown(
  snapshot: CalendarSnapshot,
  state: CalendarPanelState,
  now: number,
): string {
  const lines = ['## Contest Calendar', escapeMarkdown(cacheLabel(snapshot))]
  if (!snapshot.events.length || snapshot.stale)
    lines.push('Download or update Contest Calendar in Settings → Data Files.')
  if (snapshot.error) lines.push(escapeMarkdown(snapshot.error))
  const events = filteredEvents(snapshot.events, state, now)
  if (!events.length)
    lines.push(
      snapshot.fetchedAt === null
        ? 'No calendar data file is available yet.'
        : 'No active or upcoming contests match the current filter.',
    )
  for (const event of events.slice(0, 3)) {
    lines.push(`### ${escapeMarkdown(event.name)}`, detailsText(event, state, now))
    for (const [label, value] of [
      ['Sponsor rules', event.rulesUrl],
      ['ContestClock calendar', event.sourceUrl],
    ] as const) {
      const url = safeExternalUrl(value)
      if (url) lines.push(`[${label}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`)
    }
  }
  return lines.join('\n\n')
}

export function createCalendarPanel(adapters: CalendarPanelAdapters): PanelHook {
  const sessions = new Map<string, Promise<PanelSession>>()
  const idFor = (args: PanelRenderArgs) => args.instanceId ?? args.panelKey
  const keyFor = (id: string) => `calendar.panel.${id}`
  function session(id: string): Promise<PanelSession> {
    const existing = sessions.get(id)
    if (existing) return existing
    const loading = (async () => {
      let state = initialPanelState()
      let warning: string | null = null
      try {
        state = readPanelState(await adapters.stateHost.get(keyFor(id)))
      } catch {
        warning = 'Saved preferences unavailable.'
      }
      return {
        state,
        snapshot: null,
        warning,
        revision: 0,
        epoch: 0,
        renderVersion: 0,
        controls: new Map<string, PanelSceneControl>(),
        seen: new Set<number>(),
      }
    })()
    const oldest = sessions.keys().next().value
    if (sessions.size >= 64 && oldest !== undefined) sessions.delete(oldest)
    sessions.set(id, loading)
    return loading
  }
  async function save(id: string, current: PanelSession): Promise<void> {
    try {
      const { mode, timeZone, selectedId, favorites, favoritesOnly, page } = current.state
      await adapters.stateHost.set(keyFor(id), {
        mode,
        timeZone,
        selectedId,
        favorites,
        favoritesOnly,
        page,
      })
      current.warning = null
    } catch {
      current.warning = 'Preferences not saved · this session only.'
    }
  }
  return {
    async getPanels() {
      return [
        {
          key: 'calendar',
          title: 'Contest Calendar',
          description:
            'Active and upcoming contests, with sponsor rules and UTC or local times. Add this pane to any layout.',
          icon: 'calendar-clock',
          on: ['tick:60'],
        },
      ]
    },
    async render(args): Promise<PanelContent> {
      const current = await session(idFor(args))
      const version = ++current.renderVersion
      const snapshot = adapters.readCalendar()
      const now = args.clock?.nowMillis ?? adapters.now()
      const state = reconcilePage(
        filteredEvents(snapshot.events, current.state, now),
        current.state,
        calendarPageSize(args.environment),
      )
      if (version === current.renderVersion) {
        current.snapshot = snapshot
        current.state = state
      }
      if (!args.environment) {
        if (version === current.renderVersion) {
          current.epoch++
          current.controls.clear()
          current.seen.clear()
        }
        return { kind: 'markdown', content: calendarMarkdown(snapshot, state, now) }
      }
      const scene = createCalendarScene({
        snapshot,
        state,
        environment: args.environment,
        now,
        warning: current.warning,
        revision: current.revision,
      })
      const epoch = current.epoch + 1
      for (const control of scene.controls ?? []) {
        if (control.event) control.event = `epoch:${epoch}:${control.event}`
        for (const item of control.menu ?? []) item.event = `epoch:${epoch}:${item.event}`
      }
      if (version === current.renderVersion) {
        current.epoch = epoch
        current.seen.clear()
        current.controls = new Map((scene.controls ?? []).map((control) => [control.id, control]))
      }
      return { kind: 'scene', scene }
    },
    async onEvent(args) {
      const id = idFor(args)
      const current = await session(id)
      const now = args.clock?.nowMillis ?? adapters.now()
      const { text, value, phase, sequence } = args.event
      const response = () => ({
        values: { revision: current.revision, favoritesOnly: Number(current.state.favoritesOnly) },
        strings: { mode: current.state.mode, timeZone: current.state.timeZone },
      })
      const control = current.controls.get(args.event.controlId)
      const prefix = `epoch:${current.epoch}:`
      if (
        !Number.isInteger(sequence) ||
        sequence < 0 ||
        current.seen.has(sequence) ||
        !control ||
        control.disabled ||
        control.opacity === 0 ||
        !args.event.action.startsWith(prefix) ||
        (args.event.action !== control.event &&
          !control.menu?.some((item) => item.event === args.event.action))
      )
        return response()
      const action = args.event.action.slice(prefix.length)
      const setting = action === 'mode' || action === 'timeZone' || action === 'favoritesOnly'
      if (phase !== (setting ? 'commit' : 'activate')) return response()
      if (
        control.kind === 'nativeDropdown' &&
        !control.options?.some((option) => option.value === text)
      )
        return response()
      if (action === 'favoritesOnly' && value !== 0 && value !== 1) return response()
      // Sequences are local to a native SceneView and may restart after remount.
      // Only duplicate events within this rendered epoch are rejected.
      current.seen.add(sequence)
      {
        const snapshot = current.snapshot ?? adapters.readCalendar()
        current.snapshot = snapshot
        const events = filteredEvents(snapshot.events, current.state, now)
        const size = calendarPageSize(args.environment)
        current.state = reconcilePage(events, current.state, size)
        const selected = selectedEvent(
          events.slice(current.state.page * size, (current.state.page + 1) * size),
          current.state,
        )
        let changed = false
        if (action === 'mode' && isCalendarMode(text)) {
          current.state = { ...current.state, mode: text, page: 0 }
          changed = true
        } else if (action === 'timeZone' && (text === 'utc' || text === 'local')) {
          current.state = { ...current.state, timeZone: text }
          changed = true
        } else if (action === 'favoritesOnly' && (value === 0 || value === 1)) {
          current.state = { ...current.state, favoritesOnly: value === 1, page: 0 }
          changed = true
        } else if (
          action.startsWith('select:') &&
          events.some((event) => event.id === action.slice(7))
        ) {
          current.state = { ...current.state, selectedId: action.slice(7) }
          changed = true
        } else if (action === 'favorite' && selected) {
          const favorites = current.state.favorites.includes(selected.id)
            ? current.state.favorites.filter((favorite) => favorite !== selected.id)
            : [...current.state.favorites, selected.id].slice(-256)
          current.state = { ...current.state, favorites }
          changed = true
        } else if (action === 'next' || action === 'previous') {
          const last = Math.max(0, Math.ceil(events.length / size) - 1)
          const page = Math.max(
            0,
            Math.min(current.state.page, last) + (action === 'next' ? 1 : -1),
          )
          current.state = { ...current.state, page: Math.min(page, last) }
          changed = true
        } else if (action === 'details' && selected) {
          await adapters.showForm(calendarDetailsForm(selected, current.state, now))
        } else if (action === 'browse') {
          const offered = browseEvents(snapshot, current.state, now)
          const result = await adapters.showForm(
            browseForm(snapshot, current.state, now, current.warning),
          )
          if (result && typeof result === 'object' && !Array.isArray(result)) {
            const fields = result as Record<string, unknown>
            const favorites = new Set(current.state.favorites)
            for (const [index, event] of offered.entries()) {
              if (fields[`saved-${index}`] === true) favorites.add(event.id)
              else if (fields[`saved-${index}`] === false) favorites.delete(event.id)
            }
            current.state = {
              ...current.state,
              favorites: [...favorites].slice(-256),
              mode: isCalendarMode(fields.mode) ? fields.mode : current.state.mode,
              timeZone:
                fields.timeZone === 'local' || fields.timeZone === 'utc'
                  ? fields.timeZone
                  : current.state.timeZone,
              favoritesOnly:
                typeof fields.favoritesOnly === 'boolean'
                  ? fields.favoritesOnly
                  : current.state.favoritesOnly,
              page: 0,
            }
            changed = true
          }
        }
        current.state = reconcilePage(
          filteredEvents(current.snapshot.events, current.state, now),
          current.state,
          size,
        )
        if (changed) await save(id, current)
      }
      current.revision += 1
      return response()
    },
  }
}
