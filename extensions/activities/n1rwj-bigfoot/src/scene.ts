import type { PanelEnvironment, PanelScene, PanelSceneLayer } from '@ham2k/extension-sdk'
import type { CelebrationFrame } from './celebration.ts'
import { buildProgress, type Contact, type ProgressMode } from './rules.ts'
import {
  bigfootBodyArtwork,
  bigfootLeftArmArtwork,
  bigfootRightArmArtwork,
  footprintArtwork,
  forestArtwork,
  skunkArtwork,
  sparkleArtwork,
} from './scene-art.ts'

const LABELS: Record<ProgressMode, string> = {
  CW: 'CW',
  MIXED: 'Mixed',
  PHONE: 'Phone',
  DIGITAL: 'Digital',
}
const INK = '#15362D'
const CREAM = '#F3E7C6'
const GOLD = '#E8BC68'
const MUTED = '#ABC2AE'

function clamp(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value as number)) : fallback
}

function svg(width: number, height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

function card(width: number, height: number, fill: string, stroke = fill, radius = 12): string {
  return svg(
    width,
    height,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
  )
}

function forest(width: number, height: number): string {
  const scale = Math.max(width / 720, height / 440)
  const artwork = forestArtwork.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return svg(
    width,
    height,
    `<g transform="translate(${(width - 720 * scale) / 2} ${height - 440 * scale}) scale(${scale})">${artwork}</g>`,
  )
}

export type HuntSceneInput = {
  contacts: Contact[]
  focus: ProgressMode
  frame: CelebrationFrame
  environment?: PanelEnvironment
  motion: boolean
}

/** A native vector document. The host owns every animation frame. */
export function huntScene({
  contacts,
  focus,
  frame,
  environment,
  motion,
}: HuntSceneInput): PanelScene {
  const width = clamp(environment?.width, 560, 280, 1200)
  const height = clamp(environment?.height, 660, 300, 1100)
  const compact = height < 490
  const padding = width < 400 ? 14 : 22
  const progress = buildProgress(contacts)
  const selected = progress[focus]
  const mixed = progress.MIXED
  const reduced = !motion || environment?.reducedMotion === true
  const layers: PanelSceneLayer[] = []
  const font = environment?.typography.body.fontFamily ?? 'Roboto'

  function art(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    artwork: string,
    extra: Partial<PanelSceneLayer> = {},
  ) {
    layers.push({ id, x, y, width: w, height: h, svg: artwork, ...extra })
  }
  function text(
    id: string,
    literal: string,
    x: number,
    y: number,
    w: number,
    size: number,
    color = CREAM,
    weight = 400,
    align: 'start' | 'center' | 'end' = 'start',
  ) {
    layers.push({
      id,
      x,
      y,
      width: w,
      height: size * 1.55,
      text: { literal, size, color, fontWeight: weight, fontFamily: font, align, lineHeight: 1.15 },
    })
  }
  const bind = (value: string, start: number, end: number) => ({
    value,
    input: [0, 1] as [number, number],
    output: [start, end] as [number, number],
  })
  art('base', 0, 0, width, height, card(width, height, '#102E27', '#375746', 18))

  const titleSize = compact ? 25 : width < 400 ? 29 : 36
  text(
    'eyebrow',
    'FIELD NOTES · OCT 13–21, 2026',
    padding,
    compact ? 10 : 16,
    width - padding * 2 - 70,
    10,
    MUTED,
    600,
  )
  text(
    'mode',
    `${LABELS[focus]} trail`,
    width - padding - 90,
    compact ? 10 : 16,
    90,
    11,
    GOLD,
    700,
    'end',
  )
  text(
    'title',
    'BIGFOOT HUNT',
    padding,
    compact ? 28 : 36,
    width - padding * 2,
    titleSize,
    CREAM,
    800,
  )

  const tileY = compact ? 65 : 91
  const gap = width < 400 ? 5 : 9
  const tileWidth = (width - padding * 2 - gap * 6) / 7
  const tileHeight = compact ? 35 : clamp(tileWidth, 48, 42, 64)
  const tileSize = Math.min(32, tileWidth * 0.62)
  selected.slots.forEach((slot, index) => {
    const x = padding + index * (tileWidth + gap)
    const earned = !!slot.contact
    const letter = slot.call === 'W7O' ? `O${index === 4 ? '₁' : '₂'}` : slot.letter
    art(
      `tile-${index}`,
      x,
      tileY,
      tileWidth,
      tileHeight,
      card(tileWidth, tileHeight, earned ? '#EFDAA4' : '#1B3C30', earned ? GOLD : '#4E6C50', 8),
    )
    text(
      `letter-${index}`,
      letter,
      x,
      tileY + (tileHeight - tileSize * 1.2) / 2,
      tileWidth,
      tileSize,
      earned ? INK : '#90A58D',
      800,
      'center',
    )
    text(
      `call-${index}`,
      slot.call,
      x - 2,
      tileY + tileHeight + 5,
      tileWidth + 4,
      Math.min(11, tileWidth / 3.6),
      earned ? CREAM : MUTED,
      500,
      'center',
    )
    if (!earned && mixed.slots[index]?.contact) {
      art(
        `mixed-dot-${index}`,
        x + tileWidth - 10,
        tileY + tileHeight - 10,
        6,
        6,
        svg(6, 6, '<circle cx="3" cy="3" r="3" fill="#E8BC68"/>'),
      )
    }
    if (frame.letters.includes(letter)) {
      art(`letter-sparkle-${index}`, x + tileWidth - 10, tileY - 5, 16, 16, sparkleArtwork, {
        translateY: bind('hop', 0, -5),
        rotation: bind('hop', -12, 12),
        transitionMs: reduced ? 0 : 720,
      })
    }
  })

  const scoreY = tileY + tileHeight + (compact ? 21 : 28)
  const scoreHeight = compact ? 25 : 30
  const scoreWidth = (width - padding * 2 - 10) / 2
  art(
    'primary-score',
    padding,
    scoreY,
    scoreWidth,
    scoreHeight,
    card(scoreWidth, scoreHeight, '#294D3A', '#4F7052', 9),
  )
  art(
    'mixed-score',
    padding + scoreWidth + 10,
    scoreY,
    scoreWidth,
    scoreHeight,
    card(scoreWidth, scoreHeight, '#19382E', '#375746', 9),
  )
  text(
    'primary-score-text',
    `${LABELS[focus]}  ${selected.worked} / 7`,
    padding + 10,
    scoreY + 4,
    scoreWidth - 20,
    compact ? 12 : 14,
    CREAM,
    700,
  )
  text(
    'mixed-score-text',
    focus === 'MIXED' ? `CW  ${progress.CW.worked} / 7` : `Mixed  ${mixed.worked} / 7`,
    padding + scoreWidth + 20,
    scoreY + 4,
    scoreWidth - 20,
    compact ? 12 : 14,
    GOLD,
    600,
  )

  const mixedOnly = selected.slots.some(
    (slot, index) => !slot.contact && mixed.slots[index]?.contact,
  )
  if (mixedOnly) {
    text(
      'mixed-legend',
      `Gold dots: found in Mixed, still needed on ${LABELS[focus]}.`,
      padding,
      scoreY + scoreHeight + 4,
      width - padding * 2,
      9,
      MUTED,
    )
  }
  const heroTop = scoreY + scoreHeight + (mixedOnly ? 27 : 12)
  const footerHeight = compact ? 63 : 88
  const footerY = height - padding - footerHeight
  const heroHeight = Math.max(40, footerY - heroTop - 8)
  const tiny = heroHeight < 95
  art('forest', 2, heroTop, width - 4, heroHeight + 20, forest(width - 4, heroHeight + 20))

  const bodyHeight = Math.max(50, Math.min(250, heroHeight * 0.94, width * 0.57))
  const scale = bodyHeight / 220
  const bodyX = width * 0.3 - 100 * scale
  const bodyY = footerY - 13 - bodyHeight
  art(
    'shadow',
    bodyX + 18 * scale,
    bodyY + 205 * scale,
    165 * scale,
    16 * scale,
    svg(165, 16, '<ellipse cx="82" cy="8" rx="81" ry="7" fill="#10281C" fill-opacity=".5"/>'),
  )
  const moving = {
    translateY: bind('hop', 0, -Math.min(24, bodyHeight * 0.1)),
    transitionMs: reduced ? 0 : 720,
  }
  art(
    'left-arm',
    bodyX + 10 * scale,
    bodyY + 64 * scale,
    60 * scale,
    110 * scale,
    bigfootLeftArmArtwork,
    { ...moving, rotation: bind('wave', -6, 22), pivot: [0.5, 14 / 110] },
  )
  art(
    'right-arm',
    bodyX + 130 * scale,
    bodyY + 64 * scale,
    60 * scale,
    110 * scale,
    bigfootRightArmArtwork,
    { ...moving, rotation: bind('wave', 4, -62), pivot: [0.5, 14 / 110] },
  )
  art('bigfoot', bodyX, bodyY, 200 * scale, bodyHeight, bigfootBodyArtwork, moving)

  for (let i = 0; i < 4; i++) {
    art(`footprint-${i}`, padding + i * 23, footerY - 18 - (i % 2) * 5, 10, 14, footprintArtwork)
  }
  for (let i = 0; i < 5; i++) {
    art(
      `firefly-${i}`,
      width * (0.1 + i * 0.19),
      heroTop + heroHeight * (0.18 + (i % 3) * 0.2),
      5,
      5,
      svg(5, 5, '<circle cx="2.5" cy="2.5" r="2" fill="#F5D889"/>'),
      reduced ? {} : { pulse: { periodMs: 1900 + i * 370, minOpacity: 0.25 } },
    )
  }

  const journalX = width * 0.59
  const journalWidth = width - journalX - padding
  const headingSize = tiny ? 12 : compact ? 15 : Math.min(24, width / 22)
  const missing = selected.slots.find((slot) => !slot.contact)
  const headline = frame.kind
    ? frame.label
    : selected.complete
      ? `${LABELS[focus]} BIGFOOT complete!`
      : `${selected.worked} found. ${7 - selected.worked} to go.`
  const words = headline.split(' ')
  const lines: string[] = ['']
  const chars = Math.max(8, Math.floor(journalWidth / (headingSize * 0.55)))
  for (const word of words) {
    const last = lines.length - 1
    if (lines[last] && lines[last].length + word.length + 1 > chars) lines.push(word)
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`
  }
  const messageY = heroTop + (tiny ? 3 : Math.max(8, (heroHeight - 130) / 2))
  const headlineY = messageY + (tiny ? 0 : 17)
  const captionY = headlineY + 4 + Math.min(lines.length, 3) * headingSize * 1.25
  const buttonY = Math.min(footerY - 43, captionY + (compact ? 4 : 27))
  const buttonWidth = Math.min(126, journalWidth)
  const plateY = tiny ? heroTop : messageY - 12
  const plateBottom = tiny ? footerY - 8 : buttonY + 39
  art(
    'journal-card',
    journalX - 10,
    plateY,
    journalWidth + 20,
    Math.max(32, plateBottom - plateY),
    card(journalWidth + 20, Math.max(32, plateBottom - plateY), '#15382F', '#496149', 13),
  )
  if (!tiny)
    text(
      'journal-eyebrow',
      frame.kind ? 'A LITTLE CELEBRATION' : 'ON THE TRAIL',
      journalX,
      messageY,
      journalWidth,
      compact ? 8 : 10,
      GOLD,
      700,
    )
  lines.slice(0, 3).forEach((line, index) => {
    text(
      `message-${index}`,
      line,
      journalX,
      headlineY + index * headingSize * 1.25,
      journalWidth,
      headingSize,
      CREAM,
      700,
    )
  })
  if (!compact && !tiny)
    text(
      'next-target',
      selected.complete ? 'Seven letters found.' : `Next: ${missing?.call ?? 'W7B'}`,
      journalX,
      captionY,
      journalWidth,
      11,
      MUTED,
    )
  if (!tiny) {
    art(
      'wave-button',
      journalX,
      buttonY,
      buttonWidth,
      29,
      card(buttonWidth, 29, '#E9C87F', '#F1DA9F', 14),
    )
    text('wave-label', 'Wave hello', journalX, buttonY + 5, buttonWidth, 12, INK, 700, 'center')
  }

  art(
    'bonus-card',
    padding,
    footerY,
    width - padding * 2,
    footerHeight,
    card(width - padding * 2, footerHeight, '#E8DAB7', '#F5E9CA', 13),
  )
  text(
    'bonus-heading',
    'SKUNK APE BONUS',
    padding + 13,
    footerY + 10,
    width - padding * 2 - 85,
    10,
    '#6A6240',
    700,
  )
  const bonusText = selected.bonus
    ? `W4S · found on ${LABELS[focus]}`
    : mixed.bonus
      ? 'W4S · Mixed bonus found'
      : 'W4S is still in the brush'
  text(
    'bonus-status',
    bonusText,
    padding + 13,
    footerY + 27,
    width - padding * 2 - 85,
    compact ? 12 : 14,
    INK,
    600,
  )
  if (!compact)
    text(
      'o-rule',
      focus === 'CW' || focus === 'PHONE'
        ? 'Second O: another band or UTC date.'
        : 'Second O: new band, mode, or UTC date.',
      padding + 13,
      footerY + 58,
      width - padding * 2 - 26,
      11,
      '#626447',
    )
  art('skunk', width - padding - 72, footerY + 4, 65, 60, skunkArtwork, {
    opacity: bind('bonus', 0.3, 1),
    translateY: bind('skunk-hop', 0, -8),
    transitionMs: reduced ? 0 : 720,
  })

  if (frame.kind === 'complete') {
    for (let i = 0; i < 8; i++)
      art(
        `celebration-star-${i}`,
        padding + (i * (width - padding * 2)) / 8,
        heroTop + 8 + (i % 3) * 19,
        15,
        15,
        sparkleArtwork,
        { translateY: bind('hop', 0, -14), transitionMs: reduced ? 0 : 720 },
      )
  }
  return {
    version: 1,
    width,
    height,
    values: {
      hop: reduced ? 0 : frame.phase,
      wave: reduced ? 0 : frame.phase,
      bonus: selected.bonus || mixed.bonus ? 1 : 0,
      'skunk-hop': !reduced && frame.kind === 'bonus' ? frame.phase : 0,
    },
    layers,
    controls: tiny
      ? []
      : [
          {
            id: 'wave',
            kind: 'button',
            label: 'Wave to Bigfoot',
            event: 'wave',
            x: journalX,
            y: buttonY,
            width: buttonWidth,
            height: 29,
          },
        ],
  }
}
