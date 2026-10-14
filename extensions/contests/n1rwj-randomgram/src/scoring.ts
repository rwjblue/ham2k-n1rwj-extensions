// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  ContestScorer,
  HookContext,
  QsoScoreVerdict,
  ScoreTally,
  ScoringHook,
} from '@ham2k/extension-sdk'
import { contestScorer, tally } from '@ham2k/extension-sdk'
import { receivedGroup, sentGroup, validGroup } from './exchange.ts'
import { BANDS, object, type Qson, REF_TYPE, refOf, text } from './model.ts'

export type RandomGramScoresheet = {
  sent: Record<string, true>
  retired: Record<string, true>
  received: Record<string, true>
  contacts: number
  listening: number
  invalidReceived: number
  repeatedReceived: number
  reusedSent: number
}

export function createScorer(): ContestScorer<RandomGramScoresheet> {
  return {
    startScoresheet() {
      return {
        sent: {},
        retired: {},
        received: {},
        contacts: 0,
        listening: 0,
        invalidReceived: 0,
        repeatedReceived: 0,
        reusedSent: 0,
      }
    },
    scoreQso({ scoresheet, qso, operation }) {
      const result = (score: QsoScoreVerdict) => ({ scoresheet, score })
      const event = refOf(operation)
      const contact = refOf(qso)
      if (
        qso.deleted ||
        !event ||
        !contact ||
        (text(contact.ref) && text(contact.ref) !== text(event.ref))
      )
        return result({ value: 0 })
      const listening = contact.listeningOnly === true
      const skipped = contact.skipped === true
      if (qso.band === 'event' && !listening && !skipped) return result({ value: 0 })
      const alphabet = event.alphabet === 'letters' ? 'letters' : 'alphanumeric'
      const ours = sentGroup(operation, qso)
      if (skipped) {
        if (validGroup(ours, alphabet)) scoresheet.retired[ours] = true
        return result({ value: 0, dupe: false })
      }
      if (!listening && !text(object(qso.their).call)) return result({ value: 0 })
      // Every new group is allowed from the same call/band. Explicitly ruling
      // dupe:false overrides core's call+band duplicate warning, even for an
      // incomplete received exchange.
      const score: QsoScoreVerdict = { value: 0, dupe: false, alerts: [], notices: [] }
      const alerts = score.alerts as string[]
      const notices = score.notices as string[]
      if (!listening) {
        if (validGroup(ours, alphabet)) {
          if (scoresheet.retired[ours]) {
            alerts.push('Sent group already used')
            scoresheet.reusedSent++
          }
          scoresheet.retired[ours] = true
        } else alerts.push('No valid sent group selected')
        if (text(qso.mode).toUpperCase() !== 'CW') {
          alerts.push('invalidMode')
          return result(score)
        }
        if (!BANDS.includes(text(qso.band))) {
          alerts.push('invalidBand')
          return result(score)
        }
        scoresheet.contacts++
        if (validGroup(ours, alphabet)) scoresheet.sent[ours] = true
      } else scoresheet.listening++
      const theirs = receivedGroup(qso)
      if (!theirs) {
        alerts.push('missingExchange')
        scoresheet.invalidReceived++
      } else if (!validGroup(theirs, alphabet)) {
        alerts.push('invalidExchange')
        scoresheet.invalidReceived++
      } else if (scoresheet.received[theirs]) {
        notices.push('Received group already recorded')
        scoresheet.repeatedReceived++
      } else scoresheet.received[theirs] = true
      return result(score)
    },
    summarizeScore({ scoresheet, scope }): Record<string, ScoreTally> {
      if (scope === 'day') return {}
      const tx = Object.keys(scoresheet.sent).length
      const rx = Object.keys(scoresheet.received).length
      const details = [
        `**TX:** ${tx} unique groups in ${scoresheet.contacts} contacts`,
        `**RX:** ${rx} unique groups, including ${scoresheet.listening} listening-only entries`,
        'The organizer cross-checks received groups and determines the final score.',
      ]
      if (scoresheet.repeatedReceived)
        details.push(
          `${scoresheet.repeatedReceived} repeated received groups omitted from submission.`,
        )
      if (scoresheet.invalidReceived)
        details.push(`${scoresheet.invalidReceived} entries need a valid received group.`)
      if (scoresheet.reusedSent)
        details.push(`${scoresheet.reusedSent} contacts reuse an already used sent group.`)
      return {
        [REF_TYPE]: tally(REF_TYPE, 'operation', rx, {
          label: 'RandomGram groups',
          icon: 'shuffle-variant',
          summary: `${tx} TX / ${rx} RX`,
          longSummary: details.join('\n\n'),
          txGroups: tx,
          rxGroups: rx,
          organizerAdjudicated: false,
        }),
      }
    },
  }
}

/** The SDK harness skips generic event rows; retain RandomGram's durable notes. */
function scoringEntry(qso: Qson): Qson {
  const ref = refOf(qso)
  return qso.band === 'event' && (ref?.listeningOnly === true || ref?.skipped === true)
    ? { ...qso, band: 'randomgram-note' }
    : qso
}

function scoringContext(ctx: HookContext): HookContext {
  return ctx.getQsos
    ? { ...ctx, getQsos: async (uuid) => ((await ctx.getQsos?.(uuid)) ?? []).map(scoringEntry) }
    : ctx
}

export function createScoring(): ScoringHook & { scope: { refTypes: string[] } } {
  const scorer = contestScorer(createScorer(), { scope: { refTypes: [REF_TYPE] } })
  return {
    scope: { refTypes: [REF_TYPE] },
    async scoreQsos(args, ctx) {
      return scorer.scoreQsos({ ...args, qsos: args.qsos.map(scoringEntry) }, scoringContext(ctx))
    },
    async scoreQso(args, ctx) {
      return (
        scorer.scoreQso?.(
          {
            ...args,
            qso: scoringEntry(args.qso),
            qsos: args.qsos?.map(scoringEntry),
          },
          scoringContext(ctx),
        ) ?? { alerts: [], notices: [] }
      )
    },
    async scoreCandidates(args, ctx) {
      return (
        scorer.scoreCandidates?.(
          {
            ...args,
            candidates: args.candidates.map((candidate) => ({
              ...candidate,
              qso: scoringEntry(candidate.qso),
            })),
            qsos: args.qsos?.map(scoringEntry),
          },
          scoringContext(ctx),
        ) ?? {}
      )
    },
  }
}

export const scoring = createScoring()
