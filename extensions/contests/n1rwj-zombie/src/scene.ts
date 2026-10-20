import type { PanelEnvironment, PanelScene, PanelSceneLayer } from '@ham2k/extension-sdk'
import type { ZombieCelebrationFrame } from './celebration.ts'
import type { ZombieExperience, ZombieRebirth } from './experience.ts'
import {
  bonusHatArtwork,
  graveyardArtwork,
  lanternArtwork,
  sparkleArtwork,
  zombieBodyArtwork,
  zombieLeftArmArtwork,
  zombieRightArmArtwork,
} from './scene-art.ts'
import { eventCountdownLabel } from './schedule.ts'

const CREAM = '#F6EAD3'
const MUTED = '#C6B8D8'
const GOLD = '#F2C46D'
const GREEN = '#B9D98D'

function svg(w: number, h: number, content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${content}</svg>`
}
function card(w: number, h: number, fill: string, stroke = '#605075', radius = 12) {
  return svg(
    w,
    h,
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
  )
}
export function fitSceneText(value: string, width: number, size: number): string {
  const clean = [...value]
    .map((character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
    )
    .join('')
    .trim()
  const max = Math.max(3, Math.floor(width / (size * 0.64)))
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}
export function rebirthLabel(row: ZombieRebirth): string {
  return row.status === 'READY'
    ? 'ELIGIBLE NOW'
    : `Rises in ${Math.ceil(row.remainingMillis / 60_000)} min`
}

export function zombieScene(input: {
  experience: ZombieExperience
  frame: ZombieCelebrationFrame
  now: number
  environment?: PanelEnvironment
  motion: boolean
}): PanelScene {
  const { experience: model, frame, environment } = input
  const dimension = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback
  const width = dimension(environment?.width, 560, 280, 1200)
  const height = dimension(environment?.height, 660, 300, 1100)
  const compact = height < 500
  const pad = width < 400 ? 14 : 20
  const inner = width - pad * 2
  const reduced = !input.motion || environment?.reducedMotion === true
  const font = environment?.typography.body.fontFamily ?? 'Roboto'
  const layers: PanelSceneLayer[] = []
  const controls: NonNullable<PanelScene['controls']> = []
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
    weight = 500,
  ) {
    layers.push({
      id,
      x,
      y,
      width: w,
      height: size * 1.5,
      text: {
        literal: fitSceneText(literal, w, size),
        size,
        color,
        fontFamily: font,
        fontWeight: weight,
        lineHeight: 1.15,
      },
    })
  }
  const moving = {
    translateY: {
      value: 'shuffle',
      input: [0, 1] as [number, number],
      output: [0, -12] as [number, number],
    },
    transitionMs: reduced ? 0 : 650,
  }
  // The host panel surface is square. Fill every corner, just as BIGFOOT does,
  // while keeping the smaller cards rounded inside this opaque backdrop.
  art(
    'background',
    0,
    0,
    width,
    height,
    svg(width, height, `<rect width="${width}" height="${height}" fill="#211A35"/>`),
  )
  text('eyebrow', 'MIDNIGHT RADIO CLUB · OCT 30, 2026', pad, 12, inner, 9, MUTED, 700)
  text('title', 'ZOMBIE SHUFFLE', pad, 27, inner, compact || width < 400 ? 23 : 29, CREAM, 800)
  text(
    'identity',
    `${model.own.zombieName || 'Your spooky name'}  ·  #${model.own.zombieNumber || '—'}`,
    pad,
    compact ? 57 : 65,
    inner,
    compact ? 11 : 13,
    GREEN,
    600,
  )
  text(
    'event-countdown',
    eventCountdownLabel(model.session, input.now),
    pad,
    compact ? 75 : 86,
    inner,
    compact ? 10 : 11,
    GOLD,
    600,
  )
  const statsY = compact ? 96 : 113
  const statsH = compact ? 29 : 39
  const statW = (inner - 14) / 3
  for (const [index, [title, value]] of [
    ['SOULS / QSOs', String(model.scoresheet.qsos)],
    ['BONUS QSOs', String(model.scoresheet.bonusQsos)],
    ['SCORE', String(model.totalScore)],
  ].entries()) {
    const x = pad + index * (statW + 7)
    art(`stat-${index}`, x, statsY, statW, statsH, card(statW, statsH, '#342744', '#675272', 8))
    text(
      `stat-label-${index}`,
      title ?? '',
      x + 7,
      statsY + 3,
      statW - 14,
      compact ? 7 : 8,
      MUTED,
      700,
    )
    text(
      `stat-value-${index}`,
      value ?? '',
      x + 7,
      statsY + (compact ? 12 : 17),
      statW - 14,
      compact ? 11 : 15,
      index === 2 ? GOLD : CREAM,
      700,
    )
  }
  const bandY = statsY + statsH + 9
  const bandH = compact ? 27 : 43
  const bandW = (inner - 18) / 4
  for (const [index, band] of model.bands.entries()) {
    const x = pad + index * (bandW + 6)
    art(
      `band-${index}`,
      x,
      bandY,
      bandW,
      bandH,
      card(bandW, bandH, band.qsos ? '#43513D' : '#30273E', band.qsos ? '#8FA575' : '#605075', 8),
    )
    text(
      `band-label-${index}`,
      band.band,
      x + 6,
      bandY + 3,
      bandW - 12,
      compact ? 8 : 10,
      band.qsos ? GREEN : MUTED,
      700,
    )
    if (!compact)
      text(`band-score-${index}`, `${band.score} pts`, x + 6, bandY + 20, bandW - 12, 10)
  }
  const watchH = compact ? 112 : 170
  const watchY = height - pad - watchH
  const heroY = bandY + bandH + 9
  const heroH = watchY - heroY - 9
  if (heroH >= 65) {
    art('graveyard', 2, heroY, width - 4, heroH, graveyardArtwork)
    const bodyH = Math.min(228, heroH - 3, width * 0.48)
    const scale = bodyH / 228
    const bodyX = pad + Math.max(0, inner * 0.23 - 100 * scale)
    const bodyY = heroY + heroH - bodyH
    art(
      'left-arm',
      bodyX + 28 * scale,
      bodyY + 110 * scale,
      60 * scale,
      112 * scale,
      zombieLeftArmArtwork,
      {
        ...moving,
        rotation: { value: 'shuffle', input: [0, 1], output: [-8, 20] },
        pivot: [0.5, 12 / 112],
      },
    )
    art(
      'right-arm',
      bodyX + 112 * scale,
      bodyY + 110 * scale,
      60 * scale,
      112 * scale,
      zombieRightArmArtwork,
      {
        ...moving,
        rotation: { value: 'shuffle', input: [0, 1], output: [4, -40] },
        pivot: [0.5, 12 / 112],
      },
    )
    art('zombie', bodyX, bodyY, 200 * scale, bodyH, zombieBodyArtwork, moving)
    if (frame.kind === 'bonus' && bodyH >= 120)
      art(
        'bonus-hat',
        bodyX + 50 * scale,
        bodyY - 16 * scale,
        100 * scale,
        76 * scale,
        bonusHatArtwork,
        moving,
      )
    const journalX = width * 0.53
    const journalW = width - journalX - pad
    const plateH = Math.min(heroH - 8, compact ? 80 : 132)
    const plateY = heroY + (heroH - plateH) / 2
    art(
      'journal',
      journalX - 8,
      plateY,
      journalW + 8,
      plateH,
      card(journalW + 8, plateH, '#2B203B', '#8F7896', 12),
    )
    const stateText = {
      active: 'THE SHUFFLE IS ON',
      upcoming: 'WAITING FOR NIGHTFALL',
      ended: 'THE SHUFFLE HAS ENDED',
      unconfigured: 'SET EVENT UTC OFFSET',
    }[model.sessionState]
    text(
      'scene-status',
      frame.kind ? 'A LITTLE AFTERLIFE' : stateText,
      journalX,
      plateY + 9,
      journalW - 6,
      8,
      GOLD,
      700,
    )
    const message = frame.kind
      ? frame.label
      : model.scoresheet.qsos
        ? 'Good company. Questionable pulse.'
        : 'CQ BOO! Who is out there?'
    // Deliberately split into short native text lines, never SVG text.
    const words = message.split(' ')
    const lines = ['']
    const size = compact ? 10 : width < 400 ? 12 : 15
    const max = Math.max(8, Math.floor((journalW - 8) / (size * 0.64)))
    for (const word of words) {
      const last = lines.length - 1
      if (lines[last] && lines[last].length + word.length + 1 > max) lines.push(word)
      else lines[last] += `${lines[last] ? ' ' : ''}${word}`
    }
    lines.slice(0, compact ? 2 : 3).forEach((line, index) => {
      text(
        `message-${index}`,
        line,
        journalX,
        plateY + 25 + index * size * 1.3,
        journalW - 8,
        size,
        CREAM,
        700,
      )
    })
    if (!compact && plateH >= 125) {
      const buttonY = plateY + plateH - 34
      art(
        'boo-button',
        journalX,
        buttonY,
        journalW - 8,
        26,
        card(journalW - 8, 26, '#BFD99C', '#D6EABB', 12),
      )
      text('boo-label', 'CQ BOO!', journalX + 9, buttonY + 5, journalW - 26, 11, '#283529', 700)
      controls.push({
        id: 'greet',
        kind: 'button',
        label: 'Wave to your Zombie',
        event: 'greet',
        x: journalX,
        y: buttonY,
        width: journalW - 8,
        height: 26,
      })
    }
    const lanternW = Math.min(35, heroH / 3)
    art('bonus-lantern', pad + 4, heroY + 5, lanternW, (lanternW * 88) / 64, lanternArtwork, {
      opacity: { value: 'participation', input: [0, 1], output: [0.35, 1] },
    })
    if (heroH > 160)
      text(
        'lantern-label',
        model.scoresheet.qsos ? '+666' : '666',
        pad + 3,
        heroY + 57,
        44,
        10,
        GOLD,
        700,
      )
    if (frame.kind === 'bonus' || frame.kind === 'rebirth') {
      for (let index = 0; index < 4; index++)
        art(
          `sparkle-${index}`,
          pad + 45 + index * 27,
          heroY + 15 + (index % 2) * 18,
          16,
          16,
          sparkleArtwork,
          moving,
        )
    }
  }
  art('watch-card', pad, watchY, inner, watchH, card(inner, watchH, '#E9DFC8', '#F6EAD3', 13))
  text('watch-heading', 'REBIRTH WATCH', pad + 12, watchY + 9, inner - 24, 11, '#51395D', 800)
  const rows = model.rebirths.slice(0, compact ? 2 : 3)
  if (!rows.length) {
    const empty =
      model.sessionState === 'ended'
        ? 'Until the next confirmed shuffle…'
        : model.sessionState === 'upcoming'
          ? 'The graveyard is quiet. Event has not started.'
          : model.sessionState === 'unconfigured'
            ? 'Configure your event-day UTC offset.'
            : 'Log a qualifying QSO to start a two-hour watch.'
    text('watch-empty', empty, pad + 12, watchY + 33, inner - 24, compact ? 10 : 12, '#584461')
  }
  rows.forEach((row, index) => {
    const y = watchY + 30 + index * (compact ? 26 : 35)
    const labelW = inner * 0.58 - 18
    text(
      `watch-name-${index}`,
      width < 400 || compact ? `${row.call} · ${row.band}` : `${row.zombieName} · ${row.call}`,
      pad + 12,
      y,
      labelW,
      compact ? 10 : 11,
      '#372942',
      700,
    )
    if (!compact)
      text(
        `watch-band-${index}`,
        width < 400
          ? `#${row.zombieNumber} · ${row.zombieName}`
          : `${row.band} · #${row.zombieNumber}`,
        pad + 12,
        y + 14,
        labelW,
        9,
        '#705971',
      )
    const rightX = pad + inner * 0.58
    text(
      `watch-ready-${index}`,
      width < 400
        ? row.status === 'READY'
          ? 'READY'
          : `${Math.ceil(row.remainingMillis / 60_000)} min`
        : rebirthLabel(row),
      rightX,
      y + 2,
      inner * 0.42 - 10,
      compact ? 9 : 10,
      row.status === 'READY' ? '#315C35' : '#705971',
      700,
    )
  })
  text(
    'watch-note',
    compact
      ? 'Eligible ≠ on air · timers per band'
      : `${model.rebirths.length > rows.length ? `+${model.rebirths.length - rows.length} more in the detailed watch · ` : ''}Eligibility is not an on-air report.`,
    pad + 12,
    watchY + watchH - 20,
    inner - 24,
    compact ? 8 : 9,
    '#705971',
  )
  return {
    version: 1,
    width,
    height,
    values: { shuffle: reduced ? 0 : frame.phase, participation: model.scoresheet.qsos ? 1 : 0 },
    layers,
    controls,
  }
}
