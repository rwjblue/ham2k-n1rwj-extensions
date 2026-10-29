// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { PanelEnvironment, PanelScene, PanelSceneLayer } from '@ham2k/extension-sdk'
import type { PanelView } from './panel.ts'

// BKG.club theme tokens, with original vector artwork and native text.
const INK = '#0B0906',
  SLAB = '#16120C',
  RULE = '#3A2F1B',
  PAPER = '#EFE6CF',
  MUTED = '#B3A88D',
  BRASS = '#D4AF37',
  GOLD = '#FFD700',
  LIME = '#39FF14'
function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`
}
export const fistArtwork = svg(
  100,
  100,
  '<g fill="#D4AF37" stroke="#0B0906" stroke-width="4" stroke-linejoin="round"><path d="M24 84V60L14 49q-7-10 3-14l15 9V24q0-13 11-11 7 1 7 11V13q0-12 11-9 6 1 6 10v9q0-13 11-10 7 2 7 12v12q0-11 10-8 6 2 5 12l-3 26-17 17z"/><path d="M32 44l17 12m1-32v22m17-23v23m18-9v14M41 67h36" fill="none"/></g>',
)

export function bkgScene(view: PanelView, environment: PanelEnvironment): PanelScene {
  const width = Math.max(160, environment.width),
    height = Math.max(environment.height, 505 + view.spots.length * 48 + (view.current ? 72 : 0))
  const layers: PanelSceneLayer[] = []
  const p = Math.min(20, width * 0.045),
    left = Math.max(p, (width - 620) / 2),
    cw = width - left * 2
  function art(id: string, x: number, y: number, w: number, h: number, source: string) {
    layers.push({ id, x, y, width: w, height: h, svg: source })
  }
  function box(id: string, x: number, y: number, w: number, h: number, stroke = RULE, fill = SLAB) {
    art(
      id,
      x,
      y,
      w,
      h,
      svg(
        w,
        h,
        `<rect x="1" y="1" width="${Math.max(0, w - 2)}" height="${Math.max(0, h - 2)}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
      ),
    )
  }
  function label(
    id: string,
    value: string,
    x: number,
    y: number,
    w: number,
    size: number,
    color = PAPER,
    weight = 500,
  ) {
    const maxChars = Math.max(4, Math.floor(w / (size * 0.59)))
    const literal = value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value
    layers.push({
      id,
      x,
      y,
      width: w,
      height: size * 1.4,
      text: { literal, size, color, fontWeight: weight, fontFamily: 'monospace' },
    })
  }
  art(
    'background',
    0,
    0,
    width,
    height,
    svg(
      width,
      height,
      `<rect width="100%" height="100%" fill="${INK}"/><path d="${Array.from({ length: Math.ceil((width + height) / 12) }, (_, index) => `M${index * 12 - height} ${height}l${height} -${height}`).join(' ')}" stroke="#D4AF37" stroke-opacity=".035"/>`,
    ),
  )
  art(
    'club-stripe',
    0,
    0,
    width,
    5,
    svg(width, 5, `<rect width="100%" height="5" fill="${BRASS}"/>`),
  )
  const heroSize = Math.min(26, (cw - 42) / 12)
  label('brand', 'BRASS KNUCKLE GANG', left, 16, cw - 42, heroSize, GOLD, 900)
  label('tagline', '2m CW OR BUST!!', left, 19 + heroSize * 1.4, cw - 50, 11, LIME, 700)
  art('fist', width - left - 42, 17, 42, 42, fistArtwork)
  const tagline = layers.find((layer) => layer.id === 'tagline')
  if (tagline) tagline.when = { value: 'joiningBand', is: 0 }
  let y = 90
  const cardHeight = 116
  box('identity-card', left, y, cw, cardHeight, BRASS)
  label(
    'identity-status',
    view.status,
    left + 12,
    y + 9,
    cw - 24,
    10,
    view.number ? LIME : BRASS,
    700,
  )
  label('identity-call', view.call || 'BKG HQ', left + 12, y + 27, cw - 24, 28, PAPER, 900)
  if (view.number)
    label(
      'identity-number',
      `BKG #${String(view.number).padStart(3, '0')}`,
      left + 12,
      y + 65,
      cw - 24,
      14,
      GOLD,
      700,
    )
  else
    label(
      'identity-invite',
      view.rosterCount === undefined
        ? 'Download the roster in Data Files.'
        : 'Work a BKG member on 2m CW to join.',
      left + 12,
      y + 68,
      cw - 24,
      10,
      MUTED,
    )
  if (view.name) label('identity-name', view.name, left + 12, y + 89, cw - 24, 11, MUTED)
  y += cardHeight + 12
  const footerHeight = 62,
    footerY = height - p - footerHeight
  {
    const half = (cw - 10) / 2
    box('roster-stat', left, y, half, 55)
    box('progress-stat', left + half + 10, y, half, 55)
    label(
      'roster-total',
      view.rosterCount === undefined ? '—' : String(view.rosterCount),
      left + 10,
      y + 5,
      half - 20,
      22,
      BRASS,
      900,
    )
    label('roster-label', 'GANG MEMBERS', left + 10, y + 35, half - 20, 9, MUTED)
    label(
      'progress-total',
      String(view.operation ? (view.worked ?? '—') : view.recruits),
      left + half + 20,
      y + 5,
      half - 20,
      22,
      GOLD,
      900,
    )
    label(
      'progress-label',
      view.operation ? '2m CW THIS OP' : 'YOUR RECRUITS',
      left + half + 20,
      y + 35,
      half - 20,
      9,
      MUTED,
    )
    y += 67
  }
  if (view.current) {
    box('contact-card', left, y, cw, 60, '#8B0000')
    label('contact-label', 'ON THE OTHER END', left + 10, y + 7, cw - 20, 9, MUTED)
    label('contact-call', view.current, left + 10, y + 22, cw - 20, 15, GOLD, 800)
    label('contact-detail', view.currentDetail, left + 10, y + 43, cw - 20, 9, PAPER)
    y += 72
  }
  label('spots-title', 'BRASS ON THE AIR', left, y, cw, 12, BRASS, 800)
  y += 25
  if (!view.spots.length) label('spots-empty', view.spotsStatus, left, y, cw, 10, MUTED)
  else
    for (const [index, row] of view.spots.entries()) {
      label(
        `spot-${index}-call`,
        `${row.call}${row.joining ? ' · 2m CW!' : ''}`,
        left,
        y,
        cw,
        14,
        row.joining ? LIME : GOLD,
        700,
      )
      label(`spot-${index}-detail`, row.detail, left, y + 21, cw, 10, MUTED)
      y += 48
    }
  box('footer', left, footerY, cw, footerHeight, RULE, '#211007')
  label('hunt-label', 'HUNT THE WHOLE GANG', left + 10, footerY + 6, cw - 20, 11, GOLD, 800)
  label(
    'hunt-help',
    'Chasing → Worked the Gang · 2m CW only',
    left + 10,
    footerY + 24,
    cw - 20,
    9,
    PAPER,
  )
  label(
    'freshness',
    view.warning || view.freshness,
    left + 10,
    footerY + 43,
    cw - 20,
    8,
    view.warning ? '#FFB4AB' : MUTED,
  )
  // A tall native document retains every card even in a short pane. The
  // radio strip stays above scrolling content and uses host-fed live values.
  for (const layer of layers) {
    if (layer.id === 'background') {
      layer.height += 44
      layer.stretch = true
    } else layer.y += 44
  }
  layers.push(
    {
      id: 'radio-strip',
      x: 0,
      y: 0,
      width,
      height: 42,
      fixed: true,
      svg: svg(width, 42, `<rect width="100%" height="42" fill="${SLAB}"/>`),
    },
    {
      id: 'radio-frequency',
      x: left,
      y: 8,
      width: cw - 60,
      height: 24,
      fixed: true,
      when: { value: 'radio.connected', is: 1 },
      text: {
        value: 'radio.frequencyHz',
        scale: 1e-6,
        decimals: 3,
        suffix: ' MHz',
        size: 14,
        color: PAPER,
      },
    },
    {
      id: 'radio-mode',
      x: width - left - 55,
      y: 8,
      width: 55,
      height: 24,
      fixed: true,
      when: { value: 'radio.connected', is: 1 },
      text: { value: 'radio.mode', size: 12, color: BRASS },
    },
    {
      id: 'radio-offline',
      x: left,
      y: 8,
      width: cw,
      height: 24,
      fixed: true,
      when: { value: 'radio.connected', is: 1, not: true },
      text: { literal: '2m CW · connect a radio for dial status', size: 10, color: MUTED },
    },
    {
      id: 'radio-ready',
      x: left,
      y: 19 + heroSize * 1.4 + 44,
      width: cw - 50,
      height: 16,
      when: { value: 'joiningBand', is: 1 },
      text: { literal: 'DIAL ON 2m CW · confirm the exchange on air', size: 9, color: LIME },
    },
  )
  return {
    version: 1,
    width,
    height: height + 44,
    scroll: { axis: 'y', value: 'scrollY' },
    radio: {},
    values: { scrollY: 0, joiningBand: view.radioReady ? 1 : 0 },
    layers,
  }
}
