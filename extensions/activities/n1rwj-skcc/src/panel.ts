// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { BoardSpot, PanelHook } from '@ham2k/extension-sdk'
import type { AuditSnapshot, AuditStore } from './audit-store.ts'
import { type AwardReport, analyzeAwards, makeProspect } from './awards.ts'
import { eventOn, upcomingSessions } from './events.ts'
import { getExchange } from './exchange.ts'
import {
  type Member,
  memberNumber,
  object,
  type Qson,
  type Roster,
  type RosterGetter,
  text,
} from './model.ts'
import type { Preferences, PreferencesStore } from './preferences.ts'
import { lookupMember } from './roster.ts'

function md(value: unknown): string {
  return String(value ?? '')
    .replace(/[\\`*_{}[\]()#+.!|<>]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
}
export interface Opportunity {
  spot: BoardSpot
  member: Member
  reasons: string[]
  needed: boolean
  wpm?: number
}

/** A roster match is a listening opportunity, never evidence of manual keying. */
export function opportunities(
  board: BoardSpot[],
  roster: Roster | undefined,
  p: Preferences,
  now: number,
  report?: AwardReport,
  snapshot?: AuditSnapshot,
): Opportunity[] {
  const mine = lookupMember(roster, '', p.myNumber)
  const history = snapshot?.member === memberNumber(p.myNumber) ? snapshot : undefined
  const byCallBand = new Map<string, Opportunity>()
  for (const spot of board) {
    const call = text(spot.their?.call).toUpperCase(),
      time = spot.spot?.timeInMillis
    if (
      text(spot.mode).toUpperCase() !== 'CW' ||
      !Number.isFinite(time) ||
      time > now + 60_000 ||
      now - time > p.spotAgeMinutes * 60_000 ||
      typeof spot.freq !== 'number' ||
      !Number.isFinite(spot.freq) ||
      spot.freq <= 0
    )
      continue
    const member = lookupMember(roster, call)
    if (
      member?.status !== 'A' ||
      member.number === mine?.number ||
      /\/(?:EX|SK)(?:\/|$)/.test(call)
    )
      continue
    const speed = spot.spot.sourceInfo?.wpm
    const wpm = typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : undefined
    if (p.maxWpm && (wpm === undefined || wpm > p.maxWpm)) continue
    let reasons = makeProspect(member, mine, report, undefined, now)
    if (history) {
      reasons = makeProspect(member, mine, undefined, undefined, now)
        .filter((reason) => {
          const award = reason.startsWith('Centurion:')
            ? 'C'
            : reason.startsWith('Tribune:')
              ? 'T'
              : reason.startsWith('Senator:')
                ? 'S'
                : undefined
          return !award || !history.awards[award].numbers.includes(member.number)
        })
        .map((reason) => reason.replace(': potential', ': absent from dated import'))
    }
    const item: Opportunity = {
      spot,
      member,
      reasons,
      needed: reasons.some((reason) => /^(Centurion|Tribune|Senator):/.test(reason)),
      ...(wpm === undefined ? {} : { wpm }),
    }
    const key = `${call}:${spot.band}`
    const previous = byCallBand.get(key)
    if (!previous || previous.spot.spot.timeInMillis < time) byCallBand.set(key, item)
  }
  return [...byCallBand.values()]
    .sort(
      (a, b) =>
        Number(b.needed) - Number(a.needed) || b.spot.spot.timeInMillis - a.spot.spot.timeInMillis,
    )
    .slice(0, 12)
}

interface OperationCache {
  key: string
  qsos?: Qson[]
  report?: AwardReport
  generation: number
  readAt: number
}
export function createPanel(
  getRoster: RosterGetter,
  preferences: PreferencesStore,
  audit: AuditStore,
): PanelHook {
  const cache = new Map<string, OperationCache>()
  return {
    async getPanels() {
      return [
        {
          key: 'companion',
          title: 'SKCC Companion',
          icon: 'key',
          on: ['operation', 'qso', 'qsoLogged', 'spots', 'tick:60'],
        },
      ]
    },
    async render(args, ctx) {
      await Promise.all([preferences.load(), audit.load()])
      const p = preferences.get(),
        roster = getRoster(),
        now = args.clock?.nowMillis ?? Date.now(),
        realNow = args.clock?.realNowMillis ?? Date.now()
      const month = p.month || new Date(now).toISOString().slice(0, 7)
      const event = eventOn(args.operation),
        operationId = text(args.operation.uuid)
      const lines: string[] = []
      if (!roster)
        return {
          kind: 'markdown',
          content:
            'Download **SKCC member roster** in Data Files, then configure your usual exchange under Activities → SKCC Companion. Names and membership lookups work offline after download.',
        }
      lines.push(
        `${roster.members.length.toLocaleString()} roster entries · downloaded ${md(new Date(roster.downloadedAt).toISOString().slice(0, 10))}.`,
      )
      const snapshot = audit.get()
      const history = snapshot?.member === memberNumber(p.myNumber) ? snapshot : undefined
      const key = JSON.stringify([
        args.qsoCount,
        roster.revision,
        p.myNumber,
        month,
        p.bragBonusNumber,
      ])
      const state = cache.get(operationId) ?? { key: '', generation: 0, readAt: -Infinity }
      cache.set(operationId, state)
      const oldest = cache.keys().next().value
      if (cache.size > 4 && oldest !== undefined) cache.delete(oldest)
      // Typing and spot updates reuse the operation snapshot. Reopening or saving
      // a contact refreshes it, including same-count edits.
      if (
        operationId &&
        ctx.getQsos &&
        (state.key !== key ||
          args.reason === 'operation' ||
          ['qsoLogged', 'visible'].includes(args.reason) ||
          realNow < state.readAt ||
          realNow - state.readAt >= 60_000)
      ) {
        // Hidden/merged host events can lose the saved-contact reason.
        // Revalidate at most once a minute during ordinary typing updates.
        const generation = ++state.generation
        state.readAt = realNow
        state.key = key
        state.qsos = undefined
        state.report = undefined
        try {
          const qsos = await ctx.getQsos(operationId)
          if (generation !== state.generation) return { kind: 'markdown', content: '' }
          if (qsos) {
            state.qsos = qsos
            state.report = analyzeAwards(qsos, roster, {
              myNumber: p.myNumber,
              month,
              bragBonusNumber: p.bragBonusNumber,
              scope: 'selected',
            })
          } else state.key = ''
        } catch {
          state.key = ''
        }
      }
      const report = state.report
      if (report) {
        const unique = new Set(report.rows.filter((row) => row.eligible).map((row) => row.number))
          .size
        lines.push(
          '',
          `**This operation:** ${unique} distinct qualifying members / ${p.personalTarget} personal target. ${report.rows.filter((row) => !row.eligible).length} contacts need evidence or are outside SKCC eligibility.`,
        )
        lines.push(
          `Monthly Brag subset (${month}): ${report.awards.BRAG.total} members + ${report.awards.BRAG.bonusPoints ?? 0} announced bonus points. A complete month requires a complete-history audit.`,
        )
        if (event?.contest)
          lines.push(
            `**${md(event.label)}:** use the native activity score or event score export for scoring that follows operation segments and reviewed edition rules.`,
          )
      } else
        lines.push('', 'Operation totals unavailable. Open an operation to analyze its contacts.')
      if (history) {
        lines.push(
          '',
          `**Imported history:** ${md(history.source)} · ${new Date(history.at).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${history.eligible} qualifying contacts. This dated snapshot does not update as you log.`,
        )
        lines.push(
          (['C', 'T', 'S', 'WAS', 'DXC', 'TKA'] as const)
            .map((id) => {
              const a = history.awards[id]
              return `${a.label}: ${a.total}/${a.target}`
            })
            .join(' · '),
        )
        if (history.rosterRevision !== roster.revision)
          lines.push(
            'The roster changed since that import. Reanalyze history to refresh eligibility.',
          )
      } else
        lines.push(
          '',
          'Use **Analyze a complete SKCC ADIF log** in settings for a dated lifetime snapshot. Native EXP CHASE checklists use the host’s own log.',
        )
      if (event?.assisted === false) {
        lines.push(
          '',
          '**SKS is unassisted.** SKCC opportunities are hidden. Close the host’s spots, chasing, RBN and sked assistance too; this extension cannot disable them.',
        )
      } else {
        const call = text(object(args.qso?.their).call)
        const received = getExchange(args.qso ?? {})
        const member = lookupMember(roster, call, received.number)
        if (member)
          lines.push(
            '',
            `**${md(call)} · ${md(member.name)} · ${member.number}${member.suffix} · ${md(member.spc)}**`,
            ...makeProspect(
              member,
              lookupMember(roster, '', p.myNumber),
              report,
              undefined,
              now,
            ).map((reason) => `- ${md(reason)}`),
          )
        let board: BoardSpot[] | undefined
        if (ctx.getSpots) {
          try {
            board = await ctx.getSpots({
              filter: 'all',
              maxAgeMinutes: p.spotAgeMinutes,
              mode: 'CW',
              annotate: false,
            })
          } catch {
            /* Offline progress remains usable. */
          }
        }
        const rows = opportunities(board ?? [], roster, p, now, report, history)
        lines.push(
          '',
          '**Members heard on CW** — reported transmissions, not confirmed qualifying exchanges. Select calls through the native spots board; enable the SKCC members filter in RBN.',
        )
        if (rows.length) {
          lines.push(
            '',
            '| Call / member | kHz | WPM | Age | Potential |',
            '| --- | ---: | ---: | ---: | --- |',
          )
          for (const row of rows)
            lines.push(
              `| ${md(row.spot.their.call)} · ${md(row.member.name)} #${row.member.number}${row.member.suffix} | ${((row.spot.freq ?? 0) / 1000).toFixed(1)} | ${row.wpm ?? '?'} | ${Math.max(0, Math.floor((now - row.spot.spot.timeInMillis) / 60000))}m | ${md(row.reasons.filter((reason) => /^(Centurion|Tribune|Senator):/.test(reason)).join('; ') || 'Member contact')} |`,
            )
        } else
          lines.push(
            board
              ? 'No matching recent spots. Unknown speeds are hidden when a speed ceiling is set.'
              : 'Live spots are unavailable. Enable a spots source such as RBN; offline progress remains available.',
          )
        lines.push('', '[Arrange a contact on the SKCC Sked Page](https://sked.skccgroup.com/).')
      }
      lines.push('', '**Next SKCC sessions (UTC)**')
      for (const session of upcomingSessions(now, 3))
        lines.push(
          `- ${md(session.label)}: ${new Date(session.start).toISOString().slice(0, 16).replace('T', ' ')}${session.start <= now ? ' (in progress)' : ''}`,
        )
      lines.push(
        '',
        'Thresholds are calculated progress, not sponsor approval. Confirm names, numbers and approved key use on air. Export a full audit for exclusion reasons and application worksheets.',
      )
      return { kind: 'markdown', content: lines.join('\n') }
    },
  }
}
