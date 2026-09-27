import type { PanelTypography } from '@ham2k/extension-sdk'
import type { UiModel, UiReport } from './types.ts'

export type DetailsTab = 'status' | 'about'
export type InfoRole = 'body' | 'label' | 'heading'
interface Cell {
  text: string
  x: number
  width: number
  role: InfoRole
}
interface Row {
  cells: Cell[]
  height: number
  /** Keep each fact's label and value adjacent in native semantic order. */
  factGroup?: number
}
interface Block {
  title: string
  warning?: boolean
  groups: Row[][]
}
export interface InfoCard {
  title: string[]
  warning?: boolean
  y: number
  height: number
  rows: Array<Row & { y: number }>
}

const lineHeight = (role: PanelTypography) => Math.ceil(role.scaledFontSize * role.lineHeight + 4)

/** Native scene text is single-line. Reserve conservative glyph widths, and
 * split unbroken diagnostics too so the host cannot silently ellipsize them. */
export function wrapInfoText(text: string, width: number, role: PanelTypography): string[] {
  const measure = (value: string): number =>
    Array.from(value).reduce((total, character) => {
      const factor = /[MWmw@%]/.test(character)
        ? 1
        : /[ilI.,:;!|' ]/.test(character)
          ? 0.36
          : /[A-Z0-9]/.test(character)
            ? 0.74
            : character.charCodeAt(0) > 255
              ? 1.05
              : 0.6
      return total + role.scaledFontSize * factor + Math.max(0, role.letterSpacing)
    }, 0)
  const result: string[] = []
  let current = ''
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue
    if (current && measure(`${current} ${word}`) <= width) {
      current += ` ${word}`
      continue
    }
    if (current) result.push(current)
    current = ''
    for (const character of Array.from(word)) {
      if (current && measure(current + character) > width) {
        result.push(current)
        current = ''
      }
      current += character
    }
  }
  if (current) result.push(current)
  return result
}

/** Semantic cards with bounded, block-aware pagination, independent of host IO. */
export function layoutReceptionDetails(
  model: UiModel,
  rows: readonly UiReport[],
  band: string,
  summary: string,
  tab: DetailsTab,
  width: number,
  height: number,
  label: PanelTypography,
  body: PanelTypography,
): InfoCard[][] {
  const padding = 12
  const inner = width - padding * 2
  const labelLine = lineHeight(label)
  const bodyLine = lineHeight(body)
  const paragraph = (value: string): Row[] =>
    wrapInfoText(value, inner, body).map((text) => ({
      cells: [{ text, x: 0, width: inner, role: 'body' }],
      height: bodyLine,
    }))
  const newest = rows.reduce<UiReport | undefined>(
    (latest, row) => (!latest || (row.timeMs ?? 0) > (latest.timeMs ?? 0) ? row : latest),
    undefined,
  )
  const facts = [
    ...(model.details?.facts ?? []),
    {
      label: band === 'all' ? 'Latest report · all bands' : `Latest report · ${band}`,
      value: newest?.age ?? 'None in this view',
    },
    ...(model.generatedAt ? [{ label: 'Report ages as of', value: model.generatedAt }] : []),
  ]
  const columns = inner >= 320 * (body.scaledFontSize / body.fontSize) ? 2 : 1
  const cellWidth = (inner - (columns - 1) * 20) / columns
  const factGroups: Row[][] = []
  for (let index = 0; index < facts.length; index += columns) {
    const cells = facts.slice(index, index + columns)
    const headings = cells.map((fact) => wrapInfoText(fact.label, cellWidth, label))
    const values = cells.map((fact) => wrapInfoText(fact.value, cellWidth, body))
    const group: Row[] = []
    for (const [content, role, height] of [
      [headings, 'label', labelLine],
      [values, 'body', bodyLine],
    ] as const) {
      for (let line = 0; line < Math.max(...content.map((lines) => lines.length)); line++) {
        group.push({
          height,
          factGroup: index,
          cells: content.flatMap((lines, column) =>
            lines[line] === undefined
              ? []
              : [{ text: lines[line], x: column * (cellWidth + 20), width: cellWidth, role }],
          ),
        })
      }
    }
    factGroups.push(group)
  }
  const warnings = [...new Set(model.warnings ?? [])].filter(Boolean)
  const activity: Block[] = model.details?.activity?.length
    ? [{ title: 'Refresh', groups: model.details.activity.map(paragraph) }]
    : []
  const prioritizeActivity =
    warnings.length > 0 || model.statusKind === 'error' || model.statusKind === 'cached'
  const blocks: Block[] =
    tab === 'status'
      ? [
          ...(warnings.length
            ? [{ title: 'Needs attention', warning: true, groups: warnings.map(paragraph) }]
            : []),
          ...(prioritizeActivity ? activity : []),
          {
            title: model.statusKind === 'error' ? 'Connection' : 'Current reception',
            groups: [
              paragraph(model.details?.status ?? model.status ?? 'Reception reports'),
              ...(model.details?.purpose ? [paragraph(model.details.purpose)] : []),
              paragraph(`${band === 'all' ? 'All bands' : band} · ${summary}`),
              ...factGroups,
            ],
          },
          ...(!prioritizeActivity ? activity : []),
          ...(!model.details && model.note
            ? [{ title: 'Details', groups: [paragraph(model.note)] }]
            : []),
        ]
      : [
          ...(
            model.details?.sections ??
            (model.presentation?.details ?? []).map((value) => ({
              title: 'About these reports',
              paragraphs: [value],
            }))
          ).map((section) => ({
            title: section.title,
            groups: section.paragraphs.filter(Boolean).map(paragraph),
          })),
          ...(model.locationLabel
            ? [{ title: 'Map origin', groups: [paragraph(model.locationLabel)] }]
            : []),
          {
            title: 'Map credits',
            groups: [
              paragraph(
                'Geography: Natural Earth. Station locations are approximate. No map tiles are downloaded.',
              ),
            ],
          },
        ]

  const pages: InfoCard[][] = [[]]
  let y = 0
  let layers = 0
  const newPage = () => {
    pages.push([])
    y = 0
    layers = 0
  }
  for (const block of blocks) {
    if (!block.groups.some((group) => group.length)) continue
    const groups = block.groups.filter((group) => group.length).map((group) => [...group])
    let continued = false
    while (groups.length) {
      let title = wrapInfoText(`${block.title}${continued ? ' (continued)' : ''}`, inner, label)
      // Compact continuation headings must not invalidate earlier readable pages.
      if (continued && padding * 2 + title.length * labelLine + 8 + groups[0][0].height > height)
        title = ['Continued']
      const overhead = padding * 2 + title.length * labelLine + 8
      const totalHeight =
        overhead +
        groups.reduce((sum, group) => sum + group.reduce((h, row) => h + row.height, 0), 0) +
        (groups.length - 1) * 8
      const totalLayers =
        1 + title.length + groups.flat().reduce((sum, row) => sum + row.cells.length, 0)
      // Keep complete cards together when they fit on a fresh page.
      if (
        y &&
        totalHeight <= height &&
        totalLayers <= 104 &&
        (y + totalHeight > height || layers + totalLayers > 104)
      )
        newPage()
      if (
        y &&
        (height - y < overhead + groups[0][0].height ||
          layers + title.length + 1 + groups[0][0].cells.length > 104)
      )
        newPage()
      if (height < overhead + groups[0][0].height) return []
      const card: InfoCard = { title, warning: block.warning, y, height: overhead, rows: [] }
      let cardLayers = 1 + title.length
      while (groups.length) {
        const group = groups[0]
        const gap = card.rows.length ? 8 : 0
        const groupHeight = group.reduce((sum, row) => sum + row.height, 0)
        const groupLayers = group.reduce((sum, row) => sum + row.cells.length, 0)
        // Prefer a whole paragraph/fact row on the next page over splitting it.
        if (
          card.rows.length &&
          groupHeight + overhead <= height &&
          groupLayers + 1 + title.length <= 104 &&
          (y + card.height + gap + groupHeight > height || layers + cardLayers + groupLayers > 104)
        )
          break
        let taken = 0
        for (const row of group) {
          const spacing = taken === 0 ? gap : 0
          if (
            y + card.height + spacing + row.height > height ||
            layers + cardLayers + row.cells.length > 104
          )
            break
          card.rows.push({ ...row, y: card.height - padding + spacing })
          card.height += spacing + row.height
          cardLayers += row.cells.length
          taken++
        }
        if (taken === group.length) groups.shift()
        else {
          groups[0] = group.slice(taken)
          break
        }
      }
      pages[pages.length - 1].push(card)
      layers += cardLayers
      y += card.height + 12
      continued = true
      if (groups.length) newPage()
    }
  }
  return pages
}
