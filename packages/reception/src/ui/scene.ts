import type {
  PanelEnvironment,
  PanelScene,
  PanelSceneControl,
  PanelSceneLayer,
  PanelTypography,
} from '@ham2k/extension-sdk'
import { receptionWindowMinutes } from '../config.ts'
import { layoutReceptionMap } from '../map/index.ts'
import { receptionMapTheme } from '../map/theme.ts'
import { type DetailsTab, layoutReceptionDetails, wrapInfoText } from './details.ts'
import type { UiDirection, UiModel, UiReport, UiSort, UiView } from './types.ts'

export interface SceneSelection {
  view: UiView
  band: string
  sort: UiSort
  direction: UiDirection
  windowMinutes: number
  /** Zero based; clamped whenever the data or available space changes. */
  page: number
  details?: boolean
  detailsTab?: DetailsTab
}

export interface SceneResult {
  scene: PanelScene
  selection: SceneSelection
  bands: string[]
  pageCount: number
  pageSize: number
  totalRows: number
}

const allSorts: Array<{ key: UiSort; label: string }> = [
  { key: 'age', label: 'Heard' },
  { key: 'call', label: 'Receiver' },
  { key: 'snr', label: 'SNR' },
  { key: 'distance', label: 'Distance' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'wpm', label: 'CW speed' },
]

const finite = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const number = (value: number | undefined, digits = 0): string =>
  finite(value) ? value.toFixed(digits) : '—'

/** Missing readings stay last in either direction; ties never reorder randomly. */
export function sortedSceneReports(
  reports: readonly UiReport[],
  sort: UiSort,
  direction: UiDirection,
): UiReport[] {
  const value = (row: UiReport): string | number | undefined => {
    if (sort === 'call') return row.call.toUpperCase()
    if (sort === 'age') return row.timeMs
    if (sort === 'snr') return row.snrDb
    if (sort === 'distance') return row.distanceKm
    if (sort === 'frequency') return row.frequencyKhz
    return row.wpm
  }
  return [...reports].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    const missingA = av === undefined || (typeof av === 'number' && !finite(av))
    const missingB = bv === undefined || (typeof bv === 'number' && !finite(bv))
    if (missingA !== missingB) return missingA ? 1 : -1
    if (!missingA && !missingB) {
      const order = av < bv ? -1 : av > bv ? 1 : 0
      if (order) return direction === 'asc' ? order : -order
    }
    return a.call.localeCompare(b.call) || a.band.localeCompare(b.band)
  })
}

function fallbackRole(fontSize: number): PanelTypography {
  return {
    fontFamily: null,
    fontFamilyFallback: [],
    fontSize,
    scaledFontSize: fontSize,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  }
}

function color(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback
}

function size(value: number | undefined, fallback: number): number {
  return finite(value) ? Math.max(1, Math.min(8192, value)) : fallback
}

/** Pure, bounded scene generation. Only the selected map and visible page are built. */
export function renderReceptionScene(
  model: UiModel,
  environment?: PanelEnvironment,
  requested: Partial<SceneSelection> = {},
  options: { nativeControls?: boolean } = {},
): SceneResult {
  const native = options.nativeControls === true
  const source = model.presentation?.source ?? 'Reception'
  const stationLabel = model.presentation?.stationLabel ?? 'Station'
  const station = stationLabel.toLowerCase()
  const sorts = allSorts
    .filter((sort) => sort.key !== 'wpm' || model.presentation?.cwSpeed !== false)
    .map((sort) => (sort.key === 'call' ? { ...sort, label: stationLabel } : sort))
  const width = size(environment?.width, 640)
  const height = size(environment?.height, 640)
  const inset = (value: number | undefined): number => (finite(value) ? Math.max(0, value) : 0)
  const left = Math.min(width, inset(environment?.safeInsets.left)) + 12
  const top = Math.min(height, inset(environment?.safeInsets.top)) + 8
  const right = Math.max(left, width - inset(environment?.safeInsets.right) - 12)
  const bottom = Math.max(top, height - inset(environment?.safeInsets.bottom) - 8)
  const w = right - left
  const dark = environment?.brightness === 'dark' || model.theme?.brightness === 'dark'
  const raw = environment?.colors ?? model.theme
  const colors = {
    surface: color(raw?.surface, dark ? '#101923' : '#ffffff'),
    card: color(raw?.surfaceContainer, dark ? '#1d2b37' : '#f1f5f7'),
    text: color(raw?.onSurface, dark ? '#edf4f6' : '#172832'),
    muted: color(raw?.onSurfaceVariant, dark ? '#b4c5cd' : '#526876'),
    accent: color(raw?.accent, dark ? '#72ded0' : '#086f63'),
    border: color(raw?.outline, dark ? '#48606a' : '#cbd8df'),
    warning: color(environment?.colors.error, dark ? '#ffb4ab' : '#ba1a1a'),
  }
  const label = environment?.typography.label ?? fallbackRole(13)
  const body = environment?.typography.body ?? fallbackRole(15)
  const title = environment?.typography.title ?? fallbackRole(16)
  const line = (role: PanelTypography): number =>
    Math.ceil(role.scaledFontSize * role.lineHeight + 4)
  const labelLine = line(label)
  const bodyLine = line(body)
  const buttonHeight = Math.max(44, labelLine + 16)
  const textScale = Math.max(
    label.scaledFontSize / label.fontSize,
    body.scaledFontSize / body.fontSize,
    title.scaledFontSize / title.fontSize,
  )
  // Material dropdowns use titleMedium plus a floating label and density
  // padding. Label-small alone under-reserves them at large OS text sizes.
  const choiceHeight = Math.max(
    56,
    Math.ceil(Math.max(line(title), bodyLine) + 14 * textScale * 1.2 + 26 * textScale + 8),
  )
  const segmentHeight = Math.max(48, Math.ceil(Math.max(line(title), bodyLine) + 16 * textScale))
  // Material text buttons use labelLarge rather than the panel's labelSmall.
  // Reserve scaled bounds; the host still applies text scaling to the label.
  const nativeButtonFont = Math.max(body.scaledFontSize, 14 * textScale)
  const nativeButtonHeight = Math.max(48, bodyLine + 16)
  const nativeButtonWidth = (caption: string): number =>
    Math.max(64, Math.ceil(caption.length * nativeButtonFont * 0.55 + 24))
  const sortHeight = native ? choiceHeight : buttonHeight
  const layers: PanelSceneLayer[] = []
  const controls: PanelSceneControl[] = []
  const scene: PanelScene = { version: 1, width, height, values: {}, layers, controls }
  if (native) scene.strings = {}
  const selection: SceneSelection = {
    view: requested.view ?? model.defaultView ?? 'both',
    band: requested.band ?? model.defaultBand ?? 'all',
    sort: requested.sort ?? model.defaultSort ?? 'age',
    direction: requested.direction ?? model.defaultDirection ?? 'desc',
    windowMinutes: receptionWindowMinutes.includes(
      requested.windowMinutes ?? model.defaultWindowMinutes ?? 15,
    )
      ? (requested.windowMinutes ?? model.defaultWindowMinutes ?? 15)
      : 15,
    page: finite(requested.page) ? Math.max(0, Math.floor(requested.page)) : 0,
    details: requested.details === true,
    detailsTab: requested.detailsTab ?? 'status',
  }
  const availableBands = [
    ...new Set(['all', ...(model.bands ?? model.rows.map((row) => row.band)), selection.band]),
  ]
  // The host accepts at most 32 menu entries; retain the active filter and All.
  if (availableBands.length > 32) {
    availableBands.splice(32)
    if (!availableBands.includes(selection.band)) availableBands[31] = selection.band
  }
  const rows = sortedSceneReports(
    model.rows.filter((row) => selection.band === 'all' || row.band === selection.band),
    selection.sort,
    selection.direction,
  )
  const result: SceneResult = {
    scene,
    selection,
    bands: availableBands,
    pageCount: 1,
    pageSize: 1,
    totalRows: rows.length,
  }

  function art(id: string, x: number, y: number, sw: number, sh: number, markup: string): void {
    if (sw < 1 || sh < 1) return
    layers.push({
      id,
      x,
      y,
      width: sw,
      height: sh,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}">${markup}</svg>`,
    })
  }
  function text(
    id: string,
    literal: string,
    x: number,
    y: number,
    tw: number,
    role = label,
    ink = colors.text,
    align: 'start' | 'center' | 'end' = 'start',
    weight = role.fontWeight,
  ): void {
    if (tw < 1 || y + line(role) > bottom + 0.1) return
    layers.push({
      id,
      x,
      y,
      width: tw,
      height: line(role),
      text: {
        literal,
        size: role.fontSize,
        fontFamily: role.fontFamily ?? undefined,
        fontWeight: weight,
        lineHeight: role.lineHeight,
        letterSpacing: role.letterSpacing,
        color: ink,
        align,
      },
    })
  }
  function button(
    id: string,
    caption: string,
    x: number,
    y: number,
    bw: number,
    options: {
      event?: string
      menu?: PanelSceneControl['menu']
      label?: string
      selected?: boolean
    } = {},
  ): void {
    if (bw < 44 || y + buttonHeight > bottom) return
    art(
      `${id}-background`,
      x,
      y,
      bw,
      buttonHeight,
      `<rect x=".5" y=".5" width="${bw - 1}" height="${buttonHeight - 1}" rx="8" fill="${colors.card}" stroke="${options.selected ? colors.accent : colors.border}" stroke-width="${options.selected ? 2 : 1}"/>${options.selected ? `<path d="M12 ${buttonHeight - 5}H${bw - 12}" stroke="${colors.accent}" stroke-width="3"/>` : ''}`,
    )
    text(
      `${id}-label`,
      caption,
      x + 8,
      y + (buttonHeight - labelLine) / 2,
      bw - 16,
      label,
      colors.text,
      'center',
    )
    // Inactive pagination ends are labels, not focusable controls that do nothing.
    if (options.event || options.menu?.length)
      controls.push({
        id,
        label: options.label ?? caption,
        kind: 'button',
        x,
        y,
        width: bw,
        height: buttonHeight,
        ...(options.event ? { event: options.event } : {}),
        ...(options.menu ? { menu: options.menu } : {}),
      })
  }

  function choice(
    id: string,
    caption: string,
    value: string,
    choices: NonNullable<PanelSceneControl['options']>,
    x: number,
    y: number,
    width: number,
    segmented = false,
  ): void {
    // Reserve scaled space, but let the host apply its text scaler once.
    const segmentWidth = choices.reduce(
      (sum, option) => sum + option.label.length * label.scaledFontSize * 0.7 + 48,
      0,
    )
    const useSegments = segmented && width >= segmentWidth
    const height = useSegments ? segmentHeight : choiceHeight
    if (width < 44 || y + height > bottom) return
    scene.strings ??= {}
    scene.strings[id] = value
    controls.push({
      id,
      label: caption,
      kind: useSegments ? 'nativeSegmented' : 'nativeDropdown',
      value: id,
      event: `${id}:set`,
      options: choices,
      x,
      y,
      width,
      height,
    })
  }

  function nativeAction(
    id: string,
    caption: string,
    event: string,
    x: number,
    y: number,
    width: number,
  ): void {
    if (width < 64 || y + nativeButtonHeight > bottom) return
    controls.push({
      id,
      label: caption,
      kind: 'nativeButton',
      event,
      variant: 'text',
      x,
      y,
      width,
      height: nativeButtonHeight,
    })
  }

  art(
    'surface',
    0,
    0,
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${colors.surface}"/>`,
  )
  if (
    w < (model.presentation?.viewCycle ? 212 : 180) ||
    bottom - top < labelLine * 2 + buttonHeight + 20
  ) {
    text('small-panel', `Enlarge this panel to see ${source} reports.`, left, top, w)
    return result
  }

  let y = top
  const testObservation = /\bTEST\b/.test(model.title)
  const receivers = new Set(rows.map((row) => row.call)).size
  const bands = new Set(rows.map((row) => row.band)).size
  const farthest = Math.max(
    0,
    ...rows.flatMap((row) => (finite(row.distanceKm) ? [row.distanceKm] : [])),
  )
  const bandLabel = selection.band === 'all' ? 'All bands' : selection.band
  const summary = `${receivers} ${station}${receivers === 1 ? '' : 's'} · ${bands} band${bands === 1 ? '' : 's'}${farthest ? ` · ${Math.round(farthest).toLocaleString('en-US')} km max` : ''}`
  const cycleView = !native && model.presentation?.viewCycle === true && !selection.details
  const actions = [
    ...(model.presentation?.refreshLabel
      ? [{ id: 'refresh', caption: 'Refresh', event: 'refresh:reports' }]
      : []),
    { id: 'details', caption: selection.details ? 'Back' : 'Details', event: 'details:toggle' },
  ]
  const actionWidth =
    actions.reduce((sum, action) => sum + nativeButtonWidth(action.caption), 0) +
    (actions.length - 1) * 8
  const inlineActions = native && w >= actionWidth + 8 + Math.max(112, 8 * label.scaledFontSize)
  const headerTextWidth = native
    ? inlineActions
      ? w - actionWidth - 8
      : w
    : w - (cycleView ? 168 : 112)
  const identityLines = selection.details
    ? wrapInfoText(`${source} · ${model.watchCall || 'No callsign'}`, headerTextWidth, label)
    : []
  // The host tab already names the watched call. Keep status and the active
  // filter beside refresh/details instead of spending a row on a title.
  text(
    'status',
    selection.details
      ? 'Report info'
      : `${testObservation ? 'TEST · ' : ''}${model.status ?? `${stationLabel} reports`}`,
    left,
    y,
    headerTextWidth,
    label,
    colors.accent,
  )
  if (selection.details) {
    for (const [index, identity] of identityLines.entries())
      text(
        index === 0 ? 'summary' : `summary-${index}`,
        identity,
        left,
        y + (index + 1) * labelLine,
        headerTextWidth,
      )
  } else {
    const countSummary = `▾ ${bandLabel} · ${receivers} ${station}${receivers === 1 ? '' : 's'}`
    // Keep the count visible on small screens without adding another header row.
    const compactSummary = `▾ ${selection.band === 'all' ? 'All' : bandLabel} · ${receivers} ${station === 'receiver' ? 'RX' : station === 'transmitter' ? 'TX' : 'stns'}`
    text(
      'summary',
      (native || cycleView) && countSummary.length * label.scaledFontSize * 0.55 > headerTextWidth
        ? compactSummary
        : w >= 600 * (label.scaledFontSize / label.fontSize)
          ? `▾ ${bandLabel} · ${summary}`
          : countSummary,
      left,
      y + labelLine,
      headerTextWidth,
    )
    // A native menu over the existing header keeps the map's space unchanged.
    // Its 44px target includes the band label and remains separate from actions.
    if (!native)
      controls.push({
        id: 'band',
        label: `Filter reports by band; currently ${bandLabel}`,
        kind: 'button',
        x: left,
        y,
        width: Math.min(
          headerTextWidth,
          Math.max(44, (bandLabel.length + 2) * label.scaledFontSize * 0.72 + 8),
        ),
        height: Math.max(buttonHeight, labelLine * 2),
        menu: availableBands.map((band) => ({
          label: band === 'all' ? 'All bands' : band,
          event: `band:${band}`,
        })),
      })
  }
  if (cycleView) {
    const names = { both: 'Map and receivers', map: 'Map', list: 'Receivers' }
    const next = { both: 'map', map: 'list', list: 'both' } as const
    button('view', { both: '◫', map: '◎', list: '≡' }[selection.view], right - 160, y, 48, {
      event: 'view:cycle',
      label: `View: ${names[selection.view]}; switch to ${names[next[selection.view]]}`,
    })
  }
  if (native) {
    const metadataHeight = labelLine * Math.max(2, 1 + identityLines.length)
    let actionY = inlineActions ? y : y + metadataHeight + 6
    if (actionWidth <= w) {
      let actionX = right - actionWidth
      for (const action of actions) {
        const width = nativeButtonWidth(action.caption)
        nativeAction(action.id, action.caption, action.event, actionX, actionY, width)
        actionX += width + 8
      }
    } else {
      // Large text may require one full-width action per row. Keep the captions
      // visible instead of reverting to small drawn glyph targets.
      for (const action of actions) {
        nativeAction(action.id, action.caption, action.event, left, actionY, w)
        actionY += nativeButtonHeight + 8
      }
      actionY -= nativeButtonHeight + 8
    }
    y = inlineActions
      ? y + Math.max(metadataHeight, nativeButtonHeight) + 6
      : actionY + nativeButtonHeight + 6
  } else {
    if (model.presentation?.refreshLabel)
      button('refresh', '↻', right - 104, y, 48, {
        event: 'refresh:reports',
        label: model.presentation.refreshLabel,
      })
    button(
      'details',
      selection.details ? '×' : model.warnings?.length ? '!' : 'ⓘ',
      right - 48,
      y,
      48,
      {
        event: 'details:toggle',
        label: selection.details
          ? 'Close report info and return to reports'
          : `Report info${model.warnings?.length ? `, ${model.warnings.length} warnings` : ''}`,
      },
    )
    y += Math.max(labelLine * Math.max(2, 1 + identityLines.length), buttonHeight) + 6
  }

  if (native && !selection.details) {
    const viewOptions = [
      { value: 'map', label: 'Map' },
      { value: 'list', label: `${stationLabel}s` },
      { value: 'both', label: 'Both' },
    ]
    const viewWidth = viewOptions.reduce(
      (sum, option) => sum + option.label.length * label.scaledFontSize * 0.7 + 48,
      0,
    )
    const choiceFont = Math.max(body.scaledFontSize, 16 * textScale)
    const bandWidth = Math.max(152, Math.ceil(9 * choiceFont * 0.55 + 48))
    const windowWidth = Math.max(112, Math.ceil(6 * choiceFont * 0.55 + 48))
    const includeView = model.presentation?.viewCycle === true
    const oneRow = includeView && w >= bandWidth + windowWidth + viewWidth + 16
    const fieldsInRow = w >= bandWidth + windowWidth + 8
    const renderedBandWidth = oneRow ? bandWidth : fieldsInRow ? w - windowWidth - 8 : w
    choice(
      'band',
      'Band',
      selection.band,
      availableBands.map((band) => ({ value: band, label: band === 'all' ? 'All bands' : band })),
      left,
      y,
      renderedBandWidth,
    )
    if (!fieldsInRow) y += choiceHeight + 8
    choice(
      'window',
      'Window',
      String(selection.windowMinutes),
      receptionWindowMinutes.map((minutes) => ({
        value: String(minutes),
        label: `${minutes} min`,
      })),
      fieldsInRow ? left + renderedBandWidth + 8 : left,
      y,
      fieldsInRow ? windowWidth : w,
    )
    let toolbarHeight = choiceHeight
    if (includeView) {
      if (!oneRow) y += choiceHeight + 8
      choice(
        'view',
        'View',
        selection.view,
        viewOptions,
        oneRow ? left + bandWidth + windowWidth + 16 : left,
        y,
        oneRow ? w - bandWidth - windowWidth - 16 : w,
        true,
      )
      if (!oneRow && w >= viewWidth) toolbarHeight = segmentHeight
    }
    y += toolbarHeight + 8
  }

  if (selection.details) {
    // A readable measure on desktop; the same cards reflow to narrow panels.
    const infoWidth = Math.min(w, 840 * (body.scaledFontSize / body.fontSize))
    const infoX = left + (w - infoWidth) / 2
    const tab = selection.detailsTab ?? 'status'
    const tabWidth = (infoWidth - 8) / 2
    if (native) {
      choice(
        'detailsTab',
        'Report info',
        tab,
        [
          {
            value: 'status',
            label: `Status${model.warnings?.length ? ` (${model.warnings.length})` : ''}`,
          },
          { value: 'about', label: 'About' },
        ],
        infoX,
        y,
        infoWidth,
        true,
      )
    } else
      for (const [index, key] of (['status', 'about'] as const).entries()) {
        const caption =
          key === 'status'
            ? `Status${model.warnings?.length ? ` (${model.warnings.length})` : ''}`
            : 'About'
        button(`details-${key}`, caption, infoX + index * (tabWidth + 8), y, tabWidth, {
          event: `details:${key}`,
          selected: tab === key,
          label: `${caption}${tab === key ? ', selected' : ''}`,
        })
      }
    y +=
      (native
        ? (controls.find((control) => control.id === 'detailsTab')?.height ?? choiceHeight)
        : buttonHeight) + 12
    // Reserve navigation only when needed. This keeps ordinary status panes
    // compact without spending a permanent row on a disabled 1/1 pager.
    let pages = layoutReceptionDetails(
      model,
      rows,
      selection.band,
      summary,
      tab,
      infoWidth,
      bottom - y,
      label,
      body,
    )
    if (pages.length > 1)
      pages = layoutReceptionDetails(
        model,
        rows,
        selection.band,
        summary,
        tab,
        infoWidth,
        bottom - y - buttonHeight - 8,
        label,
        body,
      )
    if (!pages.length) {
      text('details-compact', 'Enlarge this panel to read report info.', infoX, y, infoWidth)
      return result
    }
    result.pageCount = pages.length
    result.pageSize = pages[0].reduce((count, card) => count + card.rows.length, 0)
    selection.page = Math.min(selection.page, pages.length - 1)
    for (const [index, card] of pages[selection.page].entries()) {
      const cy = y + card.y
      art(
        `info-${index}-background`,
        infoX,
        cy,
        infoWidth,
        card.height,
        `<rect x=".5" y=".5" width="${infoWidth - 1}" height="${card.height - 1}" rx="10" fill="${colors.card}"${card.warning ? ` stroke="${colors.warning}"` : ''}/>`,
      )
      for (const [lineIndex, caption] of card.title.entries())
        text(
          `info-${index}-heading-${lineIndex}`,
          caption,
          infoX + 12,
          cy + 12 + lineIndex * labelLine,
          infoWidth - 24,
          label,
          card.warning ? colors.warning : colors.accent,
          'start',
          600,
        )
      const factStarts = new Map<number, number>()
      const readingOrder = card.rows
        .flatMap((row, rowIndex) => {
          if (row.factGroup !== undefined && !factStarts.has(row.factGroup))
            factStarts.set(row.factGroup, row.y)
          return row.cells.map((cell, cellIndex) => ({
            ...cell,
            y: row.y,
            groupY: row.factGroup === undefined ? row.y : (factStarts.get(row.factGroup) ?? row.y),
            id: `info-${index}-${rowIndex}-${cellIndex}`,
          }))
        })
        .sort((a, b) => a.groupY - b.groupY || a.x - b.x || a.y - b.y)
      for (const cell of readingOrder)
        text(
          cell.id,
          cell.text,
          infoX + 12 + cell.x,
          cy + cell.y,
          cell.width,
          cell.role === 'label' ? label : body,
          cell.role === 'label' ? colors.muted : colors.text,
        )
    }
    if (pages.length > 1) {
      const pagerY = bottom - buttonHeight
      button('previous', '‹', infoX, pagerY, 48, {
        event: selection.page > 0 ? 'page:previous' : undefined,
        label: `Previous ${tab} page`,
      })
      button('next', '›', infoX + infoWidth - 48, pagerY, 48, {
        event: selection.page + 1 < pages.length ? 'page:next' : undefined,
        label: `Next ${tab} page`,
      })
      text(
        'page-count',
        `${tab === 'status' ? 'Status' : 'About'} · ${selection.page + 1} of ${pages.length}`,
        infoX + 56,
        pagerY + (buttonHeight - labelLine) / 2,
        infoWidth - 112,
        label,
        colors.muted,
        'center',
      )
    }
    return result
  }

  // View and band defaults are persisted by the host's panel tune form.
  const footerTop = Math.max(y, bottom - labelLine)
  const contentBottom = footerTop - 8
  const sideBySide = selection.view === 'both' && w >= 1080
  const listWidth = sideBySide ? Math.floor(w * 0.51) : w
  const listX = sideBySide ? right - listWidth : left
  let listY = y

  if (selection.view !== 'list') {
    const mapWidth = sideBySide ? w - listWidth - 16 : w
    const available = contentBottom - y
    // Leave room for the map/list gap, sort controls, one complete card, its
    // row gap, and pagination. Rounding the map down preserves that last row.
    const minimumList = sortHeight + buttonHeight + bodyLine + labelLine * 3 + 48
    const mapHeight =
      selection.view === 'both' && !sideBySide
        ? Math.floor(
            Math.min(Math.max(180, available * 0.42), Math.max(0, available - minimumList)),
          )
        : available
    if (mapHeight >= 180 && mapWidth >= 220 && model.mapOptions) {
      const calls = new Set(rows.map((row) => row.call))
      const receiverAges = new Map<string, number>()
      for (const row of rows) {
        if (finite(row.ageMinutes)) {
          receiverAges.set(
            row.call,
            Math.min(receiverAges.get(row.call) ?? Infinity, row.ageMinutes),
          )
        }
      }
      const textScale = label.scaledFontSize / label.fontSize
      const map = layoutReceptionMap({
        ...model.mapOptions,
        width: mapWidth,
        height: mapHeight,
        stations: model.mapOptions.stations
          .filter((receiver) => calls.has(receiver.key))
          .map((receiver) => {
            const ageMinutes = receiverAges.get(receiver.key)
            return ageMinutes === undefined ? receiver : { ...receiver, ageMinutes }
          }),
        labelScale: textScale,
        theme: receptionMapTheme(dark ? 'dark' : 'light', raw?.accent),
      })
      for (const [index, svg] of map.svgLayers.entries())
        layers.push({
          id: `reception-map-${index}`,
          x: left,
          y,
          width: map.width,
          height: map.height,
          svg,
        })
      for (const entry of map.labels) {
        layers.push({
          id: `map-${entry.key}`,
          x: left + entry.x,
          y: y + entry.y,
          width: entry.width,
          height: entry.height,
          text: {
            literal: entry.text,
            size: entry.size,
            fontFamily: label.fontFamily ?? undefined,
            fontWeight: entry.weight,
            lineHeight: label.lineHeight,
            color: entry.color,
            align: entry.align === 'left' ? 'start' : entry.align === 'right' ? 'end' : 'center',
          },
        })
      }
      if (!sideBySide) listY = y + map.height + 10
    } else if (selection.view === 'map') {
      text(
        'map-unavailable',
        mapHeight < 180 || mapWidth < 220
          ? 'Enlarge this panel to display the map.'
          : 'Set your operation location to show the map.',
        left,
        y,
        w,
        body,
      )
    } else if (!sideBySide) {
      text(
        'map-compact',
        native && model.presentation?.viewCycle
          ? 'Choose Map above for a larger map.'
          : 'Choose Map in panel settings for a larger map.',
        left,
        y,
        w,
        label,
        colors.muted,
      )
      listY += labelLine + 8
    }
  }

  if (selection.view !== 'map') {
    if (contentBottom - listY < sortHeight + labelLine + 8) {
      text('list-compact', 'Enlarge this panel to display reports.', listX, listY, listWidth)
      text(
        'source',
        `${source} · ${receivers} ${station}s · ${model.fetchedAt ?? model.status ?? 'No recent reports'}`,
        left,
        footerTop,
        w,
        label,
        colors.muted,
      )
      return result
    }
    const sortLabel = sorts.find((sort) => sort.key === selection.sort)?.label ?? 'Heard'
    if (native)
      choice(
        'sort',
        'Sort',
        selection.sort,
        sorts.map((sort) => ({ label: sort.label, value: sort.key })),
        listX,
        listY,
        listWidth - 56,
      )
    else
      button('sort', `Sort: ${sortLabel} ▾`, listX, listY, listWidth - 56, {
        label: `Sort ${station} reports`,
        menu: sorts.map((sort) => ({ label: sort.label, event: `sort:${sort.key}` })),
      })
    button(
      'direction',
      selection.direction === 'desc' ? '↓' : '↑',
      listX + listWidth - 48,
      listY + (native ? (sortHeight - buttonHeight) / 2 : 0),
      48,
      {
        event: 'direction:toggle',
        label: `Sort ${selection.direction === 'desc' ? 'descending' : 'ascending'}; activate to reverse`,
      },
    )
    listY += sortHeight + 8
    const table = listWidth >= Math.max(560, (560 * label.scaledFontSize) / label.fontSize)
    const rowHeight = table ? Math.max(44, labelLine * 2 + 8) : bodyLine + labelLine * 3 + 16
    const headingHeight = table ? labelLine + 6 : 0
    const capacity = Math.floor(
      (contentBottom - listY - headingHeight - buttonHeight - 8) / (rowHeight + 6),
    )
    result.pageSize = Math.max(1, Math.min(table ? (sideBySide ? 7 : 8) : 4, capacity))
    result.pageCount = Math.max(1, Math.ceil(rows.length / result.pageSize))
    selection.page = Math.min(selection.page, result.pageCount - 1)
    const page = rows.slice(
      selection.page * result.pageSize,
      (selection.page + 1) * result.pageSize,
    )
    const columns = [0, 0.25, 0.43, 0.53, 0.64, 0.84, 1]
    if (table && capacity > 0) {
      const labels = [stationLabel, 'Band / kHz', 'SNR', 'Mode', 'km / bearing', 'Heard']
      for (const [index, caption] of labels.entries()) {
        text(
          `column-${index}`,
          caption,
          listX + columns[index] * listWidth + 8,
          listY,
          (columns[index + 1] - columns[index]) * listWidth - 12,
          label,
          colors.muted,
        )
      }
      listY += headingHeight
    }
    const visible = capacity > 0 ? page : []
    for (const [index, row] of visible.entries()) {
      const ry = listY + index * (rowHeight + 6)
      art(
        `row-${index}-background`,
        listX,
        ry,
        listWidth,
        rowHeight,
        `<rect width="${listWidth}" height="${rowHeight}" rx="8" fill="${colors.card}"/>`,
      )
      const distance = finite(row.distanceKm)
        ? `${Math.round(row.distanceKm).toLocaleString('en-US')} km${finite(row.bearingDeg) ? ` · ${Math.round(row.bearingDeg)}°` : ''}`
        : 'Location unknown'
      if (table) {
        const fields = [
          row.call,
          row.band,
          `${number(row.snrDb)} dB`,
          row.mode,
          finite(row.distanceKm) ? `${Math.round(row.distanceKm).toLocaleString('en-US')} km` : '—',
          row.age,
        ]
        for (const [column, value] of fields.entries()) {
          text(
            `row-${index}-${column}`,
            value,
            listX + columns[column] * listWidth + 8,
            ry + 8,
            (columns[column + 1] - columns[column]) * listWidth - 12,
            label,
            column === 2 ? colors.accent : colors.text,
            'start',
            column === 0 ? 600 : label.fontWeight,
          )
        }
        text(
          `row-${index}-country`,
          row.country ?? 'Country unknown',
          listX + 8,
          ry + 8 + labelLine,
          listWidth * 0.25 - 16,
          label,
          colors.muted,
        )
        text(
          `row-${index}-frequency`,
          number(row.frequencyKhz, 1),
          listX + listWidth * 0.25 + 8,
          ry + 8 + labelLine,
          listWidth * 0.18 - 12,
          label,
          colors.muted,
        )
        text(
          `row-${index}-speed`,
          row.mode === 'CW' && finite(row.wpm) ? `${number(row.wpm)} wpm` : '',
          listX + listWidth * 0.53 + 8,
          ry + 8 + labelLine,
          listWidth * 0.11 - 12,
          label,
          colors.muted,
        )
        text(
          `row-${index}-bearing`,
          finite(row.bearingDeg) ? `${Math.round(row.bearingDeg)}°` : 'Location unknown',
          listX + listWidth * 0.64 + 8,
          ry + 8 + labelLine,
          listWidth * 0.2 - 12,
          label,
          colors.muted,
        )
      } else {
        text(
          `row-${index}-call`,
          row.call,
          listX + 10,
          ry + 8,
          listWidth - 110,
          body,
          colors.text,
          'start',
          600,
        )
        text(
          `row-${index}-snr`,
          `${number(row.snrDb)} dB`,
          listX + listWidth - 100,
          ry + 8,
          90,
          body,
          colors.accent,
          'end',
          600,
        )
        text(
          `row-${index}-country`,
          `${row.country ?? 'Country unknown'} · ${row.age}`,
          listX + 10,
          ry + 8 + bodyLine,
          listWidth - 20,
          label,
          colors.muted,
        )
        text(
          `row-${index}-frequency`,
          `${row.band} · ${row.mode} · ${number(row.frequencyKhz, 1)} kHz${row.mode === 'CW' && finite(row.wpm) ? ` · ${number(row.wpm)} wpm` : ''}`,
          listX + 10,
          ry + 8 + bodyLine + labelLine,
          listWidth - 20,
        )
        text(
          `row-${index}-distance`,
          distance,
          listX + 10,
          ry + 8 + bodyLine + labelLine * 2,
          listWidth - 20,
          label,
          colors.muted,
        )
      }
    }
    if (!rows.length)
      text(
        'empty-reports',
        selection.band === 'all'
          ? 'No reports in this time window.'
          : `No ${selection.band} reports in this time window.`,
        listX + 8,
        listY + 8,
        listWidth - 16,
        body,
      )
    else if (capacity < 1)
      text(
        'list-compact',
        `Enlarge this panel to display ${station} reports.`,
        listX,
        listY,
        listWidth,
      )
    const pagerY = contentBottom - buttonHeight
    if (capacity > 0 && rows.length) {
      button('previous', '‹', listX, pagerY, 48, {
        event: selection.page > 0 ? 'page:previous' : undefined,
        label: `Previous ${station} page`,
      })
      button('next', '›', listX + listWidth - 48, pagerY, 48, {
        event: selection.page + 1 < result.pageCount ? 'page:next' : undefined,
        label: `Next ${station} page`,
      })
      const first = selection.page * result.pageSize + 1
      const last = Math.min(rows.length, first + result.pageSize - 1)
      text(
        'page-count',
        `${first}–${last} of ${rows.length} · Page ${selection.page + 1}/${result.pageCount}`,
        listX + 56,
        pagerY + (buttonHeight - labelLine) / 2,
        listWidth - 112,
        label,
        colors.muted,
        'center',
      )
    }
  }

  text(
    'source',
    w >= 800 * (label.scaledFontSize / label.fontSize)
      ? `${source} · Checked ${model.fetchedAt ?? 'never'} · Heard ${model.lastReport ?? '—'} · Ages as of ${model.generatedAt ?? '—'}`
      : `${source} · ${model.generatedAt ?? model.fetchedAt ?? '—'}`,
    left,
    footerTop,
    w,
    label,
    colors.muted,
  )
  return result
}
