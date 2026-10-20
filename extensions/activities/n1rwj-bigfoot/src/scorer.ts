import type { ContestScorer, JSONValue, QsoScoreVerdict, ScoreTally } from '@ham2k/extension-sdk'
import { contestScorer, tally } from '@ham2k/extension-sdk'
import { eventFromOperation } from './activity.ts'
import type { BigfootEvent, Contact, EventMode } from './rules.ts'
import { buildProgress, eventForYear, qualifyingContacts } from './rules.ts'
import { targetStatus } from './targets.ts'

// Only eligible, distinct event contacts cross the checkpoint bridge. Reports
// and the rest of each QSO belong to the log, not the scoring cache.
type PackedContact = [uuid: string, band: string, mode: EventMode, at: number]

export type BigfootScoresheet = {
  contactsByCall: Record<string, PackedContact[]>
}

function eventForScoring(
  operation: Record<string, JSONValue>,
  ref: Record<string, JSONValue> | undefined,
): BigfootEvent | undefined {
  return ref ? eventForYear(ref.ref) : eventFromOperation(operation)
}

function utcDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

function contactsFromScoresheet(scoresheet: BigfootScoresheet): Contact[] {
  return Object.entries(scoresheet.contactsByCall).flatMap(([call, contacts]) =>
    contacts.map(([uuid, band, mode, at]) => ({
      uuid,
      call,
      band,
      mode,
      modeGroup: mode === 'CW' ? 'CW' : mode === 'SSB' ? 'PHONE' : 'DIGITAL',
      at,
      utcDate: utcDate(at),
      sentReport: '',
      receivedReport: '',
    })),
  )
}

function noticeFor(priors: PackedContact[], contact: Contact): string | undefined {
  if (priors.length === 0) return undefined
  // Match the SDK activity scorer's precedence when several axes changed.
  const sameDay = priors.filter((prior) => utcDate(prior[3]) === contact.utcDate)
  if (sameDay.length === 0) return 'newDay'
  const sameBand = sameDay.filter((prior) => prior[1] === contact.band)
  if (sameBand.length === 0) return 'newBand'
  return sameBand.some((prior) => prior[2] === contact.mode) ? 'duplicate' : 'newMode'
}

export const BigfootScorer: ContestScorer<BigfootScoresheet> = {
  startScoresheet() {
    return { contactsByCall: {} }
  },

  scoreQso({ scoresheet, qso, operation, ref }) {
    const event = eventForScoring(operation, ref)
    const contact = event ? qualifyingContacts([qso], event)[0] : undefined
    // A different station, unsupported mode or out-of-event QSO is outside
    // this activity's authority over the host's ordinary dupe judgement.
    if (!contact) return { scoresheet, score: { value: 0 } }

    const priors = scoresheet.contactsByCall[contact.call] ?? []
    const notice = noticeFor(priors, contact)
    if (notice === 'duplicate' || priors.some((prior) => prior[0] === contact.uuid)) {
      return {
        scoresheet,
        score: { value: 0, dupe: true, alerts: ['duplicate'] },
      }
    }

    // Only this station's history is needed to decide whether it fills a slot.
    // The host renders newMult on native spot rows; a new context alone is not
    // enough once this station's mixed and same-mode slots are complete.
    const status = targetStatus(
      event,
      contactsFromScoresheet({ contactsByCall: { [contact.call]: priors } }),
      qso,
    )
    const needed =
      status?.mixed.wouldAdvance || status?.cw.wouldAdvance || status?.mode?.wouldAdvance
    const notices = [...(notice ? [notice] : []), ...(needed ? ['newMult'] : [])]
    const packed: PackedContact = [contact.uuid, contact.band, contact.mode, contact.at]
    if (scoresheet.contactsByCall[contact.call]) priors.push(packed)
    else scoresheet.contactsByCall[contact.call] = [packed]

    const score: QsoScoreVerdict = { value: 1, dupe: false }
    if (notices.length) score.notices = notices
    return { scoresheet, score }
  },

  summarizeScore({ scoresheet, operation, ref, scope }): Record<string, ScoreTally> {
    if (scope === 'day' || !eventForScoring(operation, ref)) return {}
    const progress = buildProgress(contactsFromScoresheet(scoresheet))
    const mixed = progress.MIXED
    const checklist = mixed.slots
      .map((slot, index) => {
        const name = slot.call === 'W7O' ? `W7O (${index === 4 ? 'first' : 'second'})` : slot.call
        return `- ${slot.contact ? '✓' : '☐'} **${slot.letter}** — ${name}`
      })
      .join('\n')
    const modes = `CW ${progress.CW.worked}/7 · Phone ${progress.PHONE.worked}/7 · Digital ${progress.DIGITAL.worked}/7`
    const bonus = `Skunk Ape bonus (W4S): ${mixed.bonus ? 'worked' : 'needed'}`
    return {
      bigfoot: tally('bigfoot', 'operation', mixed.worked, {
        icon: 'paw',
        label: `BIGFOOT Hunt: ${mixed.worked}/7 letters`,
        summary: `${mixed.worked}/7`,
        longSummary: `${checklist}\n\n${modes}\n\n${bonus}`,
      }),
    }
  },
}

export const bigfootScoringHook = contestScorer(BigfootScorer, {
  scope: { refTypes: ['bigfoot'] },
})
