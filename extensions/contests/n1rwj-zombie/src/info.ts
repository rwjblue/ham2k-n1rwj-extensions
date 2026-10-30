// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0
import type { ZombieExperience, ZombieRebirth } from './experience.ts'
import type { Exchange } from './model.ts'
import { BANDS, BONUS_NUMBER } from './model.ts'

/** Precomputed by the scorer/experience model; presentation never awards points. */
export interface ZombieInfoSummary {
  qsos: number
  bonusQsos: number
  totalScore: number
  bands: {
    band: string
    qsos: number
    bonusQsos: number
    numberSum: number
    score: number
  }[]
}

export interface ZombieCandidateInfoInput {
  call: string
  band?: string
  mode?: string
  exchange?: Partial<Exchange>
  /** Only the caller can know whether this text was copied or merely suggested. */
  identitySource?: 'copied' | 'history'
  sessionState: ZombieExperience['sessionState']
  /** True only after a reliable current-operation log assessment. */
  historyKnown?: boolean
  /** An absent queue row alone cannot establish this: its next slot may be after midnight. */
  firstVisit?: boolean
  rebirth?: Pick<ZombieRebirth, 'status' | 'nextAt' | 'remainingMillis'>
}

/** Names and contact history are data, including Markdown/HTML-looking text. */
function plain(value: string): string {
  return [...value]
    .map((character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
    )
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\\x60*_{}[\]()#+.!|~-]/g, '\\$&')
}

function strong(value: string): string {
  return `**${plain(value)}**`
}

/** The four native score groups, with no separate score calculation here. */
export function zombieInfoMarkdown(summary: ZombieInfoSummary): string {
  return [
    '🪦👻 **Zombie Shuffle 2026**',
    `🧮 **Score ${summary.totalScore}** · **${summary.qsos} eligible QSOs**`,
    summary.qsos
      ? 'The graveyard is stirring. Every eligible visit feeds the score.'
      : 'The graveyard is quiet. Your first eligible contact wakes the scoreboard.',
    '🕯️ **Band plots**',
    summary.bands
      .map(
        (band) =>
          `- ${strong(band.band)}: ${band.qsos} QSOs · ${band.bonusQsos} bonus QSOs · number sum ${band.numberSum} · **${band.score} points**`,
      )
      .join('\n'),
    `⚡ **4321 bonus QSOs: ${summary.bonusQsos}** · Eligible bonus rebirths count again.`,
    '🔢 **Band score:** (QSOs + bonus QSOs) × sum of received numbers.',
    `🎃 **Crummy Band bonus:** ${summary.qsos > 0 ? 666 : 0} points.`,
    '🔁 **Rebirth:** two elapsed hours per callsign and actual band. 10m and 15m share a score group, with separate rebirth intervals.',
  ].join('\n\n')
}

function identityFields(exchange: Partial<Exchange> | undefined): string[] {
  return [
    exchange?.zombieName ? strong(exchange.zombieName) : '',
    exchange?.zombieNumber ? `#${plain(exchange.zombieNumber)}` : '',
    exchange?.spc ? plain(exchange.spc) : '',
  ].filter(Boolean)
}

function identity(input: ZombieCandidateInfoInput): string {
  const fields = identityFields(input.exchange)
  if (!fields.length)
    return '🎃 **Spooky identity:** copy the SPC, Zombie number and spooky name on air.'
  const label =
    input.identitySource === 'copied'
      ? '🎃 **Copied exchange**'
      : input.identitySource === 'history'
        ? '📖 **History hint — confirm on air**'
        : '🎃 **Exchange to confirm**'
  return `${label} · ${fields.join(' · ')}`
}

export interface ZombieIdentityInfoInput {
  call: string
  copied?: Partial<Exchange>
  hints?: Partial<Exchange>
  announcedBonus?: boolean
}

/** Stable event identity only. Timed eligibility must never enter cached notes. */
export function zombieIdentityNotes(input: ZombieIdentityInfoInput): string[] {
  if (!input.call.trim()) return []
  const copied = identityFields(input.copied)
  const hints = identityFields(input.hints)
  return [
    `🪦👻 **Zombie Shuffle 2026** · ${strong(input.call)}`,
    ...(input.announcedBonus
      ? [
          `⚡ **Announced 2026 bonus station** · Expected number **${BONUS_NUMBER}**. NA5N’s October 29 QRP-L announcement; confirm the full exchange on air.`,
        ]
      : []),
    ...(copied.length ? [`🎃 **Current exchange** · ${copied.join(' · ')}`] : []),
    ...(hints.length ? [`📖 **History hints — confirm on air** · ${hints.join(' · ')}`] : []),
    ...(!copied.length && !hints.length
      ? ['🎃 Copy the SPC, Zombie number and spooky name on air. New visitors are welcome.']
      : []),
    '📻 **Exchange:** RST, state/province/country, Zombie number and spooky name. Ordinary directory names are separate.',
    '🔁 **Rebirth rule:** two elapsed hours per callsign and actual band. 10m and 15m share scoring, with separate rebirth intervals.',
    ...(hints.length
      ? [
          '📖 History is a suggestion, not a complete participant roster or proof of a current bonus assignment.',
        ]
      : []),
  ]
}

function utcTime(millis: number): string | undefined {
  if (!Number.isFinite(millis)) return undefined
  const date = new Date(millis)
  return Number.isFinite(date.getTime())
    ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
    : undefined
}

function waitText(millis: number): string {
  if (!Number.isFinite(millis) || millis <= 0) return 'awaiting a fresh status'
  if (millis < 60_000) return 'under 1 minute'
  const minutes = Math.ceil(millis / 60_000)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

function rebirthStatus(input: ZombieCandidateInfoInput): string {
  if (input.sessionState === 'unconfigured')
    return '🕰️ **Rebirth status unavailable:** configure the event and event-day UTC offset.'
  if (input.sessionState === 'upcoming')
    return '🕯️ **Event has not started:** wait for your configured operating window.'
  if (input.sessionState === 'ended')
    return '🌅 **Event window ended:** no further contacts qualify in this session.'
  if (input.mode && input.mode.trim().toUpperCase() !== 'CW')
    return '📻 **CW required**: Zombie Shuffle contacts must use CW.'
  if (!input.band || !BANDS.includes(input.band))
    return '📻 **Choose an event band**: 80m, 40m, 20m, 15m or 10m.'
  const band = strong(input.band)
  if (input.rebirth?.status === 'RESTING') {
    const at = utcTime(input.rebirth.nextAt)
    return `🪦 ${band}: **resting** · Rebirth in ${waitText(input.rebirth.remainingMillis)}${at ? ` · eligible at ${at}` : ''}.`
  }
  if (input.rebirth?.status === 'READY')
    return `🧟 ${band}: **rebirth ready** · The two-hour interval has elapsed. Back for another shuffle!`
  return input.historyKnown && input.firstVisit
    ? `👻 ${band}: **first visit** · No earlier qualifying contact on this band.`
    : `🔎 ${band}: **rebirth status unknown** · No current-band assessment is available.`
}

/** Contextual notes from an authoritative assessment, never a cached live lookup. */
export function zombieCandidateInfo(input: ZombieCandidateInfoInput): string[] {
  if (!input.call.trim()) return []
  const number = input.exchange?.zombieNumber
  return [
    `🪦👻 **Zombie Shuffle 2026** · ${strong(input.call)}`,
    identity(input),
    ...(input.identitySource === 'copied' &&
    number &&
    /^\d+$/.test(number) &&
    Number(number) === Number(BONUS_NUMBER)
      ? [`⚡ **Copied 2026 bonus exchange:** ${plain(number)}.`]
      : []),
    rebirthStatus(input),
    '📻 Rebirth readiness concerns this actual band; a complete exchange and all event rules still apply. Eligibility does not mean the station is on the air.',
    ...(input.identitySource === 'history'
      ? ['📖 History is a suggestion, not a complete participant roster.']
      : []),
  ]
}
