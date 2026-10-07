import type { PanelEnvironment, PanelScene } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, CalendarSnapshot } from '../src/model.ts'
import { initialPanelState } from '../src/panel-state.ts'
import { calendarSceneGeometry, createCalendarScene } from '../src/scene.ts'

const now = Date.UTC(2026, 9, 7, 12)
function environment(
  width: number,
  height: number,
  scale = 1,
  safeInsets = { left: 0, right: 0, top: 0, bottom: 0 },
): PanelEnvironment {
  const type = {
    fontFamily: 'Roboto',
    fontFamilyFallback: [],
    fontSize: 16,
    scaledFontSize: 16 * scale,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  return {
    version: 1,
    width,
    height,
    safeInsets,
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
      label: { ...type, fontSize: 12, scaledFontSize: 12 * scale },
      title: { ...type, fontSize: 20, scaledFontSize: 20 * scale },
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
const events: CalendarEvent[] = Array.from({ length: 7 }, (_, index) => ({
  id: `contest-${index}`,
  name: `Contest ${index}`,
  modes: ['CW'],
  start: now + index * 3_600_000,
  end: now + (index + 1) * 3_600_000,
  rulesUrl: 'https://example.org/rules',
  sourceUrl: 'https://contestclock.com/',
  verified: index % 2 === 0,
  localTime: null,
}))
const snapshot: CalendarSnapshot = { events, fetchedAt: now, stale: false, error: null }
function scene(env: PanelEnvironment, data: CalendarSnapshot = snapshot): PanelScene {
  return createCalendarScene({ snapshot: data, state: initialPanelState(), environment: env, now })
}

describe('calendar pane at every screen width', () => {
  it('shows contest rows and Browse on a phone-sized pane', () => {
    const content = scene(environment(360, 540))
    const rows = content.controls?.filter((control) => control.id.startsWith('select-')) ?? []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(3)
    expect(content.controls?.some((control) => control.event === 'browse')).toBe(true)
    expect(content.controls?.some((control) => control.event === 'refresh')).toBe(false)
    expect(JSON.stringify(content)).toContain('ContestClock')
    expect(JSON.stringify(content)).toContain('Next 14 UTC days')
    expect(JSON.stringify(content)).toContain('calendar generated')
  })

  it('keeps the calendar accessible when a pane is too short for a row', () => {
    const content = scene(environment(240, 220))
    expect(content.layout).toBeDefined()
    expect(content.controls?.map((control) => control.event)).toContain('browse')
    expect(content.controls?.map((control) => control.event)).not.toContain('refresh')
    expect(content.controls?.find((control) => control.id === 'status')?.label).toContain(
      'ContestClock',
    )
  })

  it('offers one Browse action rather than overflowing a very short pane', () => {
    const content = scene(environment(320, 120, 1.6, { left: 16, right: 16, top: 20, bottom: 20 }))
    expect(content.controls).toHaveLength(1)
    expect(content.controls?.[0].event).toBe('browse')
    expect(content.layout).toBeDefined()
  })

  it('bases the compact layout on usable width after safe insets', () => {
    const content = scene(environment(320, 700, 1, { left: 28, right: 28, top: 0, bottom: 0 }))
    expect(content.layout).toBeDefined()
    expect(content.controls?.some((control) => control.event === 'browse')).toBe(true)
  })

  it.each([
    [320, 430, 1],
    [320, 430, 1.6],
    [360, 540, 1.6],
    [500, 700, 1],
    [720, 900, 1.6],
  ])(
    'keeps all scene rectangles within a %d × %d pane at %d text scale',
    (width, height, scale) => {
      const env = environment(width, height, scale, { left: 12, right: 12, top: 24, bottom: 24 })
      const content = scene(env)
      for (const rect of [
        ...content.layers,
        ...(content.controls ?? []).filter((control) => control.x !== undefined),
      ]) {
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
        expect((rect.x ?? 0) + (rect.width ?? 0)).toBeLessThanOrEqual(width)
        expect((rect.y ?? 0) + (rect.height ?? 0)).toBeLessThanOrEqual(height)
      }
      const geometry = calendarSceneGeometry(env)
      for (const row of content.layers.filter((layer) => layer.id.startsWith('row-'))) {
        expect(row.y + row.height).toBeLessThan(geometry.footerTop)
        const index = row.id.slice(4)
        for (const label of content.layers.filter(
          (layer) => layer.id.startsWith('event-') && layer.id.endsWith(`-${index}`),
        )) {
          expect(label.y).toBeGreaterThanOrEqual(row.y)
          expect(label.y + label.height).toBeLessThanOrEqual(row.y + row.height)
        }
      }
    },
  )

  it('budgets row capacity from scaled typography rather than pane height alone', () => {
    const normal = calendarSceneGeometry(environment(400, 620))
    const scaled = calendarSceneGeometry(environment(400, 620, 1.6))
    expect(scaled.rowHeight).toBeGreaterThan(normal.rowHeight)
    expect(scaled.capacity).toBeLessThan(normal.capacity)
  })

  it('renders unverified flags as visible text and preserves local rolling schedules', () => {
    const content = scene(environment(500, 700), {
      ...snapshot,
      events: [{ ...events[0], start: null, end: null, localTime: '18:00–19:00', verified: false }],
    })
    const text = content.layers.flatMap((layer) => layer.text?.literal ?? []).join(' ')
    expect(text).toContain('Local schedule')
    expect(text).toContain('unverified')
    expect(text).toContain('18:00–19:00')
  })

  it('keeps stale file data visible and attributes the provider', () => {
    const content = scene(environment(500, 700), {
      ...snapshot,
      stale: true,
      error: 'Calendar file unavailable',
    })
    const text = content.layers.flatMap((layer) => layer.text?.literal ?? []).join(' ')
    expect(text).toContain('ContestClock')
    expect(text).toContain('saved calendar')
    expect(content.controls?.some((control) => control.event?.startsWith('select:'))).toBe(true)
    expect(content.controls?.some((control) => control.event === 'browse')).toBe(true)
    expect(content.controls?.some((control) => control.event === 'refresh')).toBe(false)
  })

  it('points to Data Files when the managed file has not been downloaded', () => {
    const content = scene(environment(500, 700), {
      events: [],
      fetchedAt: null,
      stale: true,
      error: 'Calendar unavailable',
    })
    expect(JSON.stringify(content)).toContain('Settings → Data Files')
    expect(content.controls?.find((control) => control.id === 'details')?.disabled).toBe(true)
    expect(content.controls?.find((control) => control.id === 'browse')?.disabled).toBe(false)
  })

  it('stays under SDK scene limits even for a large calendar and hostile record text', () => {
    const data = {
      ...snapshot,
      events: Array.from({ length: 500 }, (_, index) => ({
        ...events[0],
        id: String(index),
        name: `<svg onload="fetch('bad')"> ${'Long title '.repeat(100)}`,
      })),
    }
    const content = scene(environment(1200, 1600), data)
    expect(content.layers.length).toBeLessThanOrEqual(128)
    expect(content.controls?.length).toBeLessThanOrEqual(64)
    expect(JSON.stringify(content).length).toBeLessThan(1_048_576)
    expect(
      content.layers.filter((layer) => layer.svg).some((layer) => layer.svg?.includes('onload')),
    ).toBe(false)
    expect(content.controls?.some((control) => control.event?.includes('operation'))).toBe(false)
  })
})
