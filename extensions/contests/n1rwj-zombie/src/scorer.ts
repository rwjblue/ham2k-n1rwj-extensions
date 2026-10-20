// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  ContestScorer,
  HookContext,
  OperationSegmentPayload,
  QsoScoreVerdict,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { contestScorer, contestSummary, operationForQso } from '@ham2k/extension-sdk'
import { isCallsign, normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
import { effectiveSent, received, receivedRst, validExchange, validRst } from './exchange.ts'
import {
  BANDS,
  BONUS_NUMBER,
  object,
  type Qson,
  refOf,
  SCORING_BANDS,
  TYPE,
  text,
} from './model.ts'
import { sessionFor } from './schedule.ts'

export const REBIRTH_MILLIS = 2 * 60 * 60 * 1000
export const CRUMMY_BAND_BONUS = 666

export type BandTally = { qsos: number; bonusQsos: number; numberSum: number }
export type ZombieScoresheet = {
  worked: Record<string, number[]>
  bands: Record<string, BandTally>
  qsos: number
  bonusQsos: number
  numberSum: number
}

function emptyScoresheet(): ZombieScoresheet {
  return { worked: {}, bands: {}, qsos: 0, bonusQsos: 0, numberSum: 0 }
}

export function scoringBand(band: string): string {
  return band === '10m' || band === '15m' ? '10m/15m' : band
}

export function bandScore(tally: BandTally | undefined): number {
  return tally ? (tally.qsos + tally.bonusQsos) * tally.numberSum : 0
}

export function scoreTotal(sheet: ZombieScoresheet): number {
  // The blank official sheet displays 666. Keep an empty/invalid log at zero
  // so the UI cannot imply that an operator has earned a participation score.
  return sheet.qsos > 0
    ? SCORING_BANDS.reduce((sum, band) => sum + bandScore(sheet.bands[band]), 0) + CRUMMY_BAND_BONUS
    : 0
}

export function summaryText(sheet: ZombieScoresheet): string {
  return [
    ...SCORING_BANDS.map((band) => {
      const tally = sheet.bands[band] ?? { qsos: 0, bonusQsos: 0, numberSum: 0 }
      return `${band}: ${tally.qsos} QSOs, ${tally.bonusQsos} bonus QSOs, number sum ${tally.numberSum}, score ${bandScore(tally)}`
    }),
    `Total QSOs: ${sheet.qsos}`,
    `Bonus QSOs: ${sheet.bonusQsos}`,
    `Crummy Band bonus: ${sheet.qsos > 0 ? CRUMMY_BAND_BONUS : 0}`,
    `Total score: ${scoreTotal(sheet)}`,
    'Band score = (QSOs + bonus QSOs) × sum of received Zombie numbers.',
    'Bonus contacts are counted again after a qualifying two-hour rebirth.',
    'The 666-point bonus is applied only when at least one contact qualifies.',
  ].join('\n')
}

export const ZombieScorer: ContestScorer<ZombieScoresheet> = {
  startScoresheet() {
    return emptyScoresheet()
  },
  scoreQso({ scoresheet, qso, operation, ref }) {
    const result = (score: QsoScoreVerdict) => ({ scoresheet, score })
    if (qso.deleted || qso.band === 'event') return result({ value: 0 })
    const call = normalizeCall(text(object(qso.their).call))
    if (!isCallsign(call)) return result({ value: 0, alerts: ['Invalid callsign'] })
    if (text(qso.mode).trim().toUpperCase() !== 'CW')
      return result({ value: 0, alerts: ['invalidMode'] })
    const band = text(qso.band)
    if (!BANDS.includes(band)) return result({ value: 0, alerts: ['invalidBand'] })
    const selected = ref ?? refOf(operation)
    const session = sessionFor(
      text(selected?.ref),
      text(selected?.utcOffset),
      selected?.flexibleHours === true,
    )
    if (!session)
      return result({ value: 0, alerts: ['Configure the event and event-day UTC offset'] })
    const at = qso.startAtMillis
    if (typeof at !== 'number' || !Number.isFinite(at))
      return result({ value: 0, alerts: ['Missing or invalid QSO time'] })
    if (at < session.startMillis || at >= session.endMillis)
      return result({ value: 0, alerts: ['Outside selected event hours'] })

    const key = `${call}|${band}`
    const worked = scoresheet.worked[key] ?? []
    // A live backdated draft is judged against contacts before its own time.
    // Saving it triggers a fresh chronological fold, which can change whether
    // a later logged contact still qualifies. Keep all eligible timestamps so
    // a future contact never hides the applicable earlier rebirth interval.
    const previous = [...worked].reverse().find((time) => time <= at)
    const dupe = previous !== undefined && at - previous < REBIRTH_MILLIS
    const exchange = received(qso)
    if (!validExchange(exchange) || !validRst(receivedRst(qso)))
      return result({ value: 0, band, dupe, alerts: ['missingExchange'] })
    if (!validExchange(effectiveSent(operation, qso)))
      return result({ value: 0, band, dupe, alerts: ['Complete your Zombie exchange in setup'] })
    if (dupe && previous !== undefined) {
      const eligible = new Date(previous + REBIRTH_MILLIS)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')
      return result({
        value: 0,
        band,
        dupe: true,
        alerts: ['duplicate', `Eligible again at ${eligible} UTC`],
      })
    }

    const bucket = scoringBand(band)
    scoresheet.bands[bucket] ??= { qsos: 0, bonusQsos: 0, numberSum: 0 }
    const tally = scoresheet.bands[bucket]
    const number = Number(exchange.zombieNumber)
    // The summary sheet asks for bonus stations per band but does not clarify
    // rebirth repeats. We explicitly count each eligible bonus QSO; the same
    // rebirth rule applies to bonus and ordinary contacts.
    const bonus = number === Number(BONUS_NUMBER) ? 1 : 0
    tally.qsos++
    tally.bonusQsos += bonus
    tally.numberSum += number
    scoresheet.qsos++
    scoresheet.bonusQsos += bonus
    scoresheet.numberSum += number
    if (worked.length === 0) scoresheet.worked[key] = [at]
    else {
      worked.push(at)
      worked.sort((a, b) => a - b)
    }
    const notices =
      previous !== undefined
        ? ['Rebirth eligible']
        : BANDS.some((prior) => prior !== band && scoresheet.worked[`${call}|${prior}`]?.length)
          ? ['newBand']
          : []
    return result({ value: number, band, dupe: false, notices })
  },
  summarizeScore({ scoresheet, scope }, ctx) {
    return contestSummary(
      {
        key: TYPE,
        scope,
        icon: 'ghost',
        title: 'Zombie Shuffle 2026',
        total: scoreTotal(scoresheet),
        arithmetic: `${scoresheet.qsos} QSOs, ${scoresheet.bonusQsos} bonus QSOs; sum of band scores + ${scoresheet.qsos > 0 ? CRUMMY_BAND_BONUS : 0}`,
        detail: summaryText(scoresheet),
        extra: {
          qsos: scoresheet.qsos,
          bonusQsos: scoresheet.bonusQsos,
          numberSum: scoresheet.numberSum,
        },
      },
      ctx,
    )
  },
}

export function chronological(qsos: Qson[]): Qson[] {
  const at = (qso: Qson) =>
    typeof qso.startAtMillis === 'number' && Number.isFinite(qso.startAtMillis)
      ? qso.startAtMillis
      : Number.POSITIVE_INFINITY
  return [...qsos].sort((a, b) => {
    const aTime = at(a)
    const bTime = at(b)
    if (aTime !== bTime) return aTime < bTime ? -1 : 1
    const aId = text(a.uuid)
    const bId = text(b.uuid)
    return aId === bId ? 0 : aId < bId ? -1 : 1
  })
}

export function scoreLog(
  operation: Qson,
  qsos: Qson[],
  segments?: OperationSegmentPayload[],
): { scoresheet: ZombieScoresheet; qsoScores: Record<string, QsoScoreVerdict> } {
  let scoresheet = emptyScoresheet()
  const qsoScores: Record<string, QsoScoreVerdict> = {}
  for (const qso of chronological(qsos)) {
    const active = operationForQso(operation, qso, segments)
    if (!refOf(active)) continue
    const scored = ZombieScorer.scoreQso(
      { scoresheet, operation: active, qso, ref: refOf(active), isNewDay: false },
      { online: false },
    )
    scoresheet = scored.scoresheet
    if (typeof qso.uuid === 'string') qsoScores[qso.uuid] = scored.score
  }
  return { scoresheet, qsoScores }
}

function orderedContext(ctx: HookContext): HookContext {
  const getQsos = ctx.getQsos
  return getQsos
    ? { ...ctx, getQsos: async (uuid) => chronological((await getQsos(uuid)) ?? []) }
    : ctx
}

// Retain the SDK's held checkpoints, copy-on-write candidates, segment handling
// and native dupe authority. Only add a stable UUID tie-breaker to its time sort.
export function createScoringHook(): ScoringHook &
  Required<Pick<ScoringHook, 'scoreQso' | 'scoreCandidates'>> & { scope: { refTypes: string[] } } {
  const scope = { refTypes: [TYPE] }
  const hook = contestScorer(ZombieScorer, { scope })
  const { scoreQso, scoreCandidates } = hook
  if (!scoreQso || !scoreCandidates) throw new Error('The SDK is missing live contest scoring')
  return {
    scope,
    scoreQsos(args, ctx) {
      return hook.scoreQsos({ ...args, qsos: chronological(args.qsos) }, ctx)
    },
    scoreQso(args, ctx) {
      return scoreQso(
        { ...args, ...(args.qsos ? { qsos: chronological(args.qsos) } : {}) },
        orderedContext(ctx),
      )
    },
    scoreCandidates(args, ctx) {
      return scoreCandidates(
        { ...args, ...(args.qsos ? { qsos: chronological(args.qsos) } : {}) },
        orderedContext(ctx),
      )
    },
  }
}
