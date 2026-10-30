// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0

import type { BoardSpot, PanelHook } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import { markdown } from './lookup.ts'
import {
  DAY,
  findMember,
  normalizeCall,
  object,
  type Qson,
  type RosterGetter,
  text,
  workedMembers,
} from './model.ts'
import { bkgScene } from './scene.ts'

export interface PanelView {
  call: string
  number?: number
  name: string
  status: string
  message: string
  rosterCount?: number
  recruits: number
  sponsor: string
  operation: boolean
  worked?: number
  current: string
  currentDetail: string
  spots: { call: string; detail: string; joining: boolean }[]
  spotsStatus: string
  freshness: string
  radioReady?: boolean
  warning?: string
}
async function profileCall(): Promise<string> {
  try {
    return text((await host.getSettings()).operatorCall)
  } catch {
    return ''
  }
}
export function spotRows(
  spots: BoardSpot[],
  getRoster: RosterGetter,
  now: number,
): PanelView['spots'] {
  const rows: PanelView['spots'] = [],
    seen = new Set<number>()
  const joining = (spot: BoardSpot) => normalizeCall(spot.mode) === 'CW' && spot.band === '2m'
  for (const spot of [...spots].sort(
    (a, b) => Number(joining(b)) - Number(joining(a)) || b.spot.timeInMillis - a.spot.timeInMillis,
  )) {
    const at = spot.spot.timeInMillis
    if (!Number.isFinite(at) || now - at > 15 * 60_000 || at > now + 60_000) continue
    const member = findMember(getRoster(), spot.their.call)
    if (!member || seen.has(member.number)) continue
    seen.add(member.number)
    rows.push({
      call: member.call,
      detail: `BKG #${member.number} · ${text(spot.band)} ${text(spot.mode)} · ${Math.max(0, Math.floor((now - at) / 60_000))}m ago`,
      joining: joining(spot),
    })
    if (rows.length === 3) break
  }
  return rows
}
export function panelMarkdown(view: PanelView): string {
  return [
    '# 🤜 BRASS KNUCKLE GANG',
    '**2m CW OR BUST!!**',
    `## ${markdown(view.call || 'BKG HQ')}${view.number ? ` · BKG #${view.number}` : ''}`,
    view.name ? markdown(view.name) : '',
    `**${markdown(view.status)}** — ${markdown(view.message)}`,
    view.rosterCount === undefined
      ? 'Roster unavailable; membership is unknown.'
      : `**${view.rosterCount} members** · **${view.recruits} direct recruits**${view.sponsor ? ` · Sponsor: ${markdown(view.sponsor)}` : ''}`,
    view.operation
      ? `**This operation:** ${view.worked === undefined ? 'log unavailable' : `${view.worked} distinct BKG members worked on 2m CW`}.`
      : 'Open an operation to see its BKG contacts.',
    view.current ? `**${markdown(view.current)}** · ${markdown(view.currentDetail)}` : '',
    '### BRASS ON THE AIR',
    ...view.spots.map(
      (spot) =>
        `- **${markdown(spot.call)}** · ${markdown(spot.detail)}${spot.joining ? ' · 2m CW joining opportunity' : ''}`,
    ),
    view.spotsStatus,
    '**Hunt the whole gang:** select Worked the Gang in the native Chasing view. Only 2m CW contacts count; everyone can hunt. Lifetime progress is shown there.',
    view.freshness,
    view.warning ?? '',
    '[BKG.club](https://www.bkg.club/)',
  ]
    .filter(Boolean)
    .join('\n\n')
}
type LogSnapshot = {
  generation: number
  qsos?: Qson[]
  count: number
  readAt: number
  worked?: Set<number>
  rosterRevision?: string
}
type SpotSnapshot = { spots: BoardSpot[]; at: number; failed: boolean }

/** Home/Logs omit operation at runtime. Never read a log while typing. */
export function createPanel(
  getRoster: RosterGetter,
  getError: () => string | undefined = () => undefined,
  readCall: () => Promise<string> = profileCall,
): PanelHook {
  const snapshots = new Map<string, LogSnapshot>()
  const boards = new Map<string, SpotSnapshot>()
  let radioReady = false
  let profile = '',
    profileAt = -Infinity
  return {
    async getPanels() {
      return [
        {
          key: 'gang',
          title: 'BKG',
          icon: 'fa-hand-fist',
          description:
            '🤜 Member cards, operation progress and recent member spots. Works on Home and inside any operation; no setup required.',
          on: ['operation', 'qso', 'qsoLogged', 'spots', 'radio', 'tick:60'],
        },
      ]
    },
    async render(args, ctx) {
      const roster = getRoster(),
        now = args.clock?.realNowMillis ?? Date.now()
      if (args.reason === 'operation' || now < profileAt || now - profileAt > 60_000) {
        profile = await readCall()
        profileAt = now
      }
      const operation = object(args.operation)
      const call = normalizeCall(
        text(operation.operatorCall) || profile || text(operation.stationCall),
      )
      const member = findMember(roster, call)
      const sponsor = member?.sponsor ? roster?.byNumber.get(member.sponsor) : undefined
      const operationId = text(operation.uuid)
      let worked: Set<number> | undefined
      if (operationId && ctx.getQsos) {
        const state: LogSnapshot = snapshots.get(operationId) ?? {
          generation: 0,
          count: -1,
          readAt: -Infinity,
        }
        snapshots.delete(operationId)
        snapshots.set(operationId, state)
        while (snapshots.size > 8) {
          const oldest = snapshots.keys().next().value
          if (oldest !== undefined) snapshots.delete(oldest)
        }
        if (
          state.count < 0 ||
          state.count !== args.qsoCount ||
          args.reason === 'operation' ||
          ['qsoLogged', 'visible'].includes(args.reason) ||
          now < state.readAt ||
          now - state.readAt >= 60_000 ||
          (args.reason === 'tick' && !state.qsos)
        ) {
          // The host can replace a saved-contact reason with typing/radio.
          // Recover within a minute without fetching a log per keystroke.
          const generation = ++state.generation
          state.readAt = now
          state.worked = undefined
          state.rosterRevision = undefined
          state.count = args.qsoCount
          try {
            const qsos = await ctx.getQsos(operationId)
            if (generation !== state.generation) return { kind: 'markdown', content: '' }
            state.qsos = qsos ?? undefined
            state.worked = undefined
            state.rosterRevision = undefined
            state.count = args.qsoCount
          } catch {
            if (generation !== state.generation) return { kind: 'markdown', content: '' }
            state.qsos = undefined
            state.worked = undefined
            state.rosterRevision = undefined
          }
        }
        if (state.qsos && roster) {
          if (!state.worked || state.rosterRevision !== roster.revision) {
            state.worked = workedMembers(state.qsos, roster)
            state.rosterRevision = roster.revision
          }
          worked = state.worked
        }
      }
      let spots: BoardSpot[] = []
      let spotsStatus = ctx.getSpots
        ? 'No recent BKG member spots in your current spot filters.'
        : 'Member spots need a host with spot-board access.'
      if (ctx.getSpots && roster) {
        let board = boards.get(operationId)
        if (
          !board ||
          args.reason === 'spots' ||
          args.reason === 'operation' ||
          now < board.at ||
          now - board.at >= 60_000
        ) {
          try {
            board = {
              spots: await ctx.getSpots({
                maxAgeMinutes: 15,
                annotate: false,
                ...(operationId ? { operationUuid: operationId } : {}),
              }),
              at: now,
              failed: false,
            }
          } catch {
            board = { spots: [], at: now, failed: true }
          }
          boards.delete(operationId)
          boards.set(operationId, board)
          while (boards.size > 8) {
            const oldest = boards.keys().next().value
            if (oldest !== undefined) boards.delete(oldest)
          }
        }
        spots = board.spots
        if (board.failed) spotsStatus = 'Spots are temporarily unavailable.'
      }
      const rows = spotRows(spots, getRoster, args.clock?.nowMillis ?? now)
      if (!roster) spotsStatus = 'Download the roster to identify BKG member spots.'
      const callField = object(args.qso?.callField)
      const currentCall = normalizeCall(
        'call' in callField ? callField.call : object(args.qso?.their).call,
      )
      const current = findMember(roster, currentCall)
      const age = roster ? Math.max(0, Math.floor((now - roster.downloadedAt) / 3_600_000)) : 0
      const view: PanelView = {
        call,
        radioReady,
        number: member?.number,
        name: member?.name ?? '',
        status: !roster
          ? 'ROSTER UNAVAILABLE'
          : !call
            ? 'EVERYONE CAN HUNT'
            : member
              ? 'ON THE ROSTER'
              : 'COME POUND BRASS',
        message: !roster
          ? 'Membership is unknown. Download the BKG roster in Data Files.'
          : !call
            ? 'Your active profile supplies your callsign automatically.'
            : member
              ? 'Spread the fun. Work the whole gang!'
              : 'Not found in this roster. Work a BKG member on 2m CW to join.',
        rosterCount: roster?.members.length,
        recruits: member
          ? (roster?.members.filter((entry) => entry.sponsor === member.number).length ?? 0)
          : 0,
        sponsor: sponsor ? `${sponsor.call} · BKG #${sponsor.number}` : '',
        operation: Boolean(operationId),
        worked: worked?.size,
        current: currentCall,
        currentDetail: !roster
          ? 'Membership unknown'
          : current
            ? `BKG #${current.number} · ${current.name}${worked?.has(current.number) ? ' · worked on 2m CW this operation' : ''}`
            : 'Not found in downloaded roster',
        spots: rows,
        spotsStatus: rows.length ? '' : spotsStatus,
        freshness: roster
          ? `Roster downloaded ${age < 1 ? 'less than 1h' : `${age}h`} ago${now - roster.downloadedAt >= DAY ? ' · refresh due; cached data retained' : ' · refreshes daily'}. Source: ${new Date(roster.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
          : 'Data Files → BKG member roster',
        warning: getError()
          ? 'Roster refresh failed. Previous valid data retained; retry in Data Files.'
          : undefined,
      }
      const title = member ? `BKG · #${member.number}` : 'BKG'
      const environment = args.environment
      const accessibleText =
        environment &&
        (environment.highContrast ||
          environment.typography.body.scaledFontSize >
            environment.typography.body.fontSize * 1.25 ||
          environment.width < 240 ||
          environment.height < 270)
      if (environment?.version === 1 && !accessibleText) {
        // Hidden and coalesced radio triggers arrive with a different reason.
        // Read the current local state on every scene render; never poll.
        try {
          const radio = await host.readRadio()
          radioReady = Boolean(
            radio &&
              radio.status === 'connected' &&
              !radio.stale &&
              radio.frequencyHz !== null &&
              radio.frequencyHz >= 144_000_000 &&
              radio.frequencyHz < 148_000_000 &&
              ['CW', 'CW-R', 'CWR'].includes(radio.mode ?? ''),
          )
        } catch {
          radioReady = false
        }

        view.radioReady = radioReady
      }
      return environment?.version === 1 && !accessibleText
        ? {
            kind: 'scene',
            scene: bkgScene(view, environment),
            title,
          }
        : { kind: 'markdown', content: panelMarkdown(view), title }
    },
  }
}
