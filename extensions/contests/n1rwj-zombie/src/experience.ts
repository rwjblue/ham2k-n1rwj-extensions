// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { OperationSegmentPayload } from '@ham2k/extension-sdk'
import { operationForQso } from '@ham2k/extension-sdk'
import { normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'
import { effectiveSent, received } from './exchange.ts'
import {
  BANDS,
  BONUS_NUMBER,
  type Exchange,
  object,
  type Qson,
  SCORING_BANDS,
  text,
} from './model.ts'
import { operationSession, type Session } from './schedule.ts'
import {
  bandScore,
  chronological,
  REBIRTH_MILLIS,
  scoreLog,
  scoreTotal,
  type ZombieScoresheet,
} from './scorer.ts'

export interface ZombieEligibleContact extends Exchange {
  uuid: string
  call: string
  band: string
  time: number
  rebirth: boolean
  bonus: boolean
}

export interface ZombieVisit extends Exchange {
  call: string
  lastAt: number
  qsos: number
  bonusQsos: number
  bands: string[]
}

export interface ZombieRebirth extends Exchange {
  call: string
  band: string
  lastAt: number
  nextAt: number
  remainingMillis: number
  status: 'READY' | 'RESTING'
}

export interface ZombieBandScore {
  band: string
  qsos: number
  bonusQsos: number
  numberSum: number
  score: number
}

export interface ZombieExperience {
  own: Exchange
  session?: Session
  sessionState: 'unconfigured' | 'upcoming' | 'active' | 'ended'
  scoresheet: ZombieScoresheet
  totalScore: number
  bands: ZombieBandScore[]
  eligibleContacts: ZombieEligibleContact[]
  visitors: ZombieVisit[]
  rebirths: ZombieRebirth[]
}

const keyOf = (call: string, band: string): string => `${call}|${band}`
const alphabetically = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0

function stateFor(session: Session | undefined, now: number): ZombieExperience['sessionState'] {
  return !session
    ? 'unconfigured'
    : now < session.startMillis
      ? 'upcoming'
      : now >= session.endMillis
        ? 'ended'
        : 'active'
}

/** A clock tick changes the display, never the canonical log decisions. A
 * caller loads a new experience when the operation, log or timeline changes.
 * Once midnight removes a queue, a backward clock jump needs a fresh model. */
export function refreshZombieExperience(model: ZombieExperience, now: number): ZombieExperience {
  const session = model.session
  return {
    ...model,
    sessionState: stateFor(session, now),
    rebirths:
      session && now < session.endMillis
        ? model.rebirths
            .filter((entry) => entry.nextAt < session.endMillis)
            .map((entry) => ({
              ...entry,
              remainingMillis: Math.max(0, entry.nextAt - now),
              status: now >= entry.nextAt ? 'READY' : 'RESTING',
            }))
        : [],
  }
}

/** A presentation model of the canonical scorer's decisions, never a second
 * eligibility implementation. Contacts are chronological, visitor cards put
 * the latest arrival first, and rebirths put the earliest opening first.
 * Only native rows with UUIDs can be identified for cards and celebrations. */
export function buildZombieExperience(
  operation: Qson,
  qsos: Qson[],
  now: number,
  segments?: OperationSegmentPayload[],
): ZombieExperience {
  const { scoresheet, qsoScores } = scoreLog(operation, qsos, segments)
  const currentOperation = operationForQso(operation, { startAtMillis: now }, segments)
  const session = operationSession(currentOperation)
  const sessionState = stateFor(session, now)
  const eligibleContacts: ZombieEligibleContact[] = []
  const visits = new Map<string, ZombieVisit>()
  const lastOnBand = new Map<string, ZombieEligibleContact>()

  for (const qso of chronological(qsos)) {
    const uuid = text(qso.uuid)
    const verdict = qsoScores[uuid]
    // Successful scoring explicitly judges the dupe axis and has no alerts.
    // Do not infer eligibility from points; a future valid zero-point contact
    // would still be a visit, while an incomplete contact is not one.
    if (!uuid || !verdict || verdict.dupe !== false || verdict.alerts?.length) continue
    const call = normalizeCall(text(object(qso.their).call))
    const band = text(qso.band)
    const key = keyOf(call, band)
    const exchange = received(qso)
    const contact: ZombieEligibleContact = {
      uuid,
      call,
      band,
      time: qso.startAtMillis as number,
      ...exchange,
      rebirth: lastOnBand.has(key),
      bonus: Number(exchange.zombieNumber) === Number(BONUS_NUMBER),
    }
    eligibleContacts.push(contact)
    lastOnBand.set(key, contact)
    const prior = visits.get(call)
    visits.set(call, {
      call,
      ...exchange,
      lastAt: contact.time,
      qsos: (prior?.qsos ?? 0) + 1,
      bonusQsos: (prior?.bonusQsos ?? 0) + Number(contact.bonus),
      bands: BANDS.filter((candidate) => candidate === band || prior?.bands.includes(candidate)),
    })
  }

  const rebirths: ZombieRebirth[] = []
  if (session && now < session.endMillis) {
    for (const contact of lastOnBand.values()) {
      const nextAt = contact.time + REBIRTH_MILLIS
      // At midnight itself the scorer rejects the next contact, so there is
      // no rebirth to advertise at or beyond the event's exclusive end.
      if (nextAt >= session.endMillis) continue
      rebirths.push({
        call: contact.call,
        band: contact.band,
        spc: contact.spc,
        zombieNumber: contact.zombieNumber,
        zombieName: contact.zombieName,
        lastAt: contact.time,
        nextAt,
        remainingMillis: Math.max(0, nextAt - now),
        status: now >= nextAt ? 'READY' : 'RESTING',
      })
    }
  }
  rebirths.sort(
    (left, right) =>
      left.nextAt - right.nextAt ||
      alphabetically(left.call, right.call) ||
      BANDS.indexOf(left.band) - BANDS.indexOf(right.band),
  )

  return {
    own: effectiveSent(currentOperation, {}),
    session,
    sessionState,
    scoresheet,
    totalScore: scoreTotal(scoresheet),
    bands: SCORING_BANDS.map((band) => {
      const tally = scoresheet.bands[band] ?? { qsos: 0, bonusQsos: 0, numberSum: 0 }
      return { band, ...tally, score: bandScore(tally) }
    }),
    eligibleContacts,
    visitors: [...visits.values()].sort(
      (left, right) => right.lastAt - left.lastAt || alphabetically(left.call, right.call),
    ),
    rebirths,
  }
}
