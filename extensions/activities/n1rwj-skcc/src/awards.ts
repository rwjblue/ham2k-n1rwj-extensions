// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0

import { eventId, sessionFor, sprintAt } from './events.ts'
import { getExchange, isQualified, ownExchange, reportFor } from './exchange.ts'
import type { Member, Qson, Roster } from './model.ts'
import { memberNumber, object, text, utcDate } from './model.ts'
import { lookupMember } from './roster.ts'

export const AWARD_IDS = [
  'C',
  'T',
  'S',
  'WAS',
  'WAS-C',
  'WAS-T',
  'WAS-S',
  'DXC',
  'DXQ',
  'PFX',
  'QRP1',
  'QRP2',
  'RC',
  'MARATHON',
  'TKA',
  'BRAG',
  'K3Y',
  'CSKM',
  'WAC',
] as const
export type AwardId = (typeof AWARD_IDS)[number]
export interface AwardOptions {
  myNumber?: string
  month?: string
  bragBonusNumber?: string
  scope?: 'selected' | 'complete-history'
  band?: string
  /** Explicit operator attestation, only applied to ADIF records with SKCC exchanges. */
  attestImportedEligibility?: boolean
}
export interface AwardCredit {
  qsoId: string
  ref: string
  number: string
  call: string
  at: number
  band: string
  points: number
  name: string
  spc: string
  key?: string
}
export interface QsoEvaluation {
  id: string
  call: string
  number: string
  holder: string
  at: number
  band: string
  eligible: boolean
  issues: string[]
  awards: Partial<Record<AwardId, AwardCredit>>
  reasons: Partial<Record<AwardId, string[]>>
}
export interface AwardSummary {
  label: string
  total: number
  target: number
  unit: string
  ready: boolean
  bonusPoints?: number
  credits: AwardCredit[]
  excluded: { qsoId: string; reasons: string[] }[]
}
export interface AwardReport {
  scope: 'selected' | 'complete-history'
  month: string
  rosterRevision: string
  rows: QsoEvaluation[]
  awards: Record<AwardId, AwardSummary>
  limitations: string[]
  import?: { records: number; skipped: number; errors: string[] }
}

const STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  ),
)
const PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '))
const CONTINENTS = new Set(['AF', 'AS', 'EU', 'NA', 'OC', 'SA'])
const QRP_POINTS: Record<string, number> = {
  '160m': 4,
  '80m': 3,
  '10m': 3,
  '60m': 2,
  '40m': 2,
  '30m': 2,
  '20m': 1,
  '17m': 1,
  '15m': 1,
  '12m': 1,
  '6m': 0.5,
  '2m': 0.5,
}
const DEFINITIONS: Record<AwardId, [string, number, string]> = {
  C: ['Centurion', 100, 'members'],
  T: ['Tribune', 50, 'members'],
  S: ['Senator', 200, 'members'],
  WAS: ['SKCC WAS', 50, 'states'],
  'WAS-C': ['SKCC WAS-C', 50, 'states'],
  'WAS-T': ['SKCC WAS-T', 50, 'states'],
  'WAS-S': ['SKCC WAS-S', 50, 'states'],
  DXC: ['SKCC DXC', 10, 'entities'],
  DXQ: ['SKCC DXQ', 10, 'member/entity pairs'],
  PFX: ['SKCC PFX', 500001, 'points'],
  QRP1: ['SKCC 1×QRP', 300, 'points'],
  QRP2: ['SKCC 2×QRP', 150, 'points'],
  RC: ['Rag Chew', 300, 'minutes'],
  MARATHON: ['Marathon candidates', 100, 'members'],
  TKA: ['Triple Key', 300, 'assigned members'],
  BRAG: ['Monthly Brag', 0, 'members'],
  K3Y: ['K3Y Grand Sweep', 19, 'areas'],
  CSKM: ['Canadian Straight Key Month', 6, 'provinces/territories'],
  WAC: ['SKCC WAC', 6, 'continents'],
}

function numeric(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  return Number.isFinite(n) ? n : undefined
}
function dateMet(date: string, milestone: string | undefined): boolean {
  return Boolean(milestone && /^\d{4}-\d{2}-\d{2}$/.test(milestone) && date >= milestone)
}
function keyQualified(exchange: Qson): boolean {
  const key = text(exchange.key).toUpperCase()
  if (key && !['SK', 'BUG', 'SS', 'WAIVER'].includes(key)) return false
  return (
    isQualified(exchange.qualified) === true ||
    (isQualified(exchange.qualified) !== false && Boolean(key))
  )
}
function licensedCall(call: string, member: Member | undefined): string | undefined {
  if (!member) return undefined
  const aliases = [member.call, ...member.oldCalls].map((value) => value.toUpperCase())
  const upper = call.toUpperCase()
  return (
    aliases.find((value) => value === upper) ??
    aliases.find((value) => upper.split('/').includes(value))
  )
}
function specialCall(call: string): boolean {
  return /^(?:K3Y(?:\/|$)|K9SKC$|KS\dKCC$)/.test(call)
}
/** Pure per-contact eligibility. A roster match never supplies an exchanged name, number or QTH. */
export function evaluateQso(
  qso: Qson,
  roster: Roster | undefined,
  options: AwardOptions = {},
): QsoEvaluation {
  const received = getExchange(qso),
    own = ownExchange(qso)
  const their = object(qso.their),
    our = object(qso.our)
  const at = numeric(qso.startAtMillis) ?? NaN
  const call = text(their.call).toUpperCase(),
    ownCall = text(our.call).toUpperCase()
  const number = memberNumber(received.number ?? received.ref) ?? ''
  const mine = memberNumber(own.number) ?? ''
  const identityCall = text(received.operatorCall).toUpperCase() || call
  const member = lookupMember(roster, identityCall, number)
  const myMember = lookupMember(roster, ownCall, mine)
  const band = text(qso.band).toLowerCase()
  const date = Number.isFinite(at) && Math.abs(at) <= 8640000000000000 ? utcDate(at) : ''
  const id = text(qso.uuid) || `${at}:${ownCall}:${call}:${band}`
  const result: QsoEvaluation = {
    id,
    call,
    number,
    holder: mine,
    at: date ? at : 0,
    band,
    eligible: false,
    issues: [],
    awards: {},
    reasons: {},
  }
  const name = text(received.name),
    spc = text(received.spc).toUpperCase()
  const eventRef = text('event' in received ? received.event : own.event)
  const event = eventId(eventRef)
  const eventSession = sessionFor(eventRef)
  const claim = (award: AwardId, ref: string, points = 1, extra: Partial<AwardCredit> = {}) => {
    result.awards[award] = {
      qsoId: id,
      ref,
      number,
      call: identityCall,
      name,
      spc,
      at,
      band,
      points,
      ...extra,
    }
  }
  const reject = (award: AwardId, reason: string) => {
    result.reasons[award] = [...(result.reasons[award] ?? []), reason]
  }
  // These open special events allow nonmembers and other key types. Their local
  // checklists remain separate from membership-award eligibility and confirmation.
  const validEventQso =
    date &&
    band &&
    band !== 'event' &&
    qso.deleted !== true &&
    qso.deleted !== 1 &&
    text(qso.mode).toUpperCase() === 'CW' &&
    call &&
    ownCall &&
    name &&
    number &&
    (!options.myNumber || memberNumber(options.myNumber) === mine) &&
    (!options.band || band === options.band.toLowerCase()) &&
    (!eventRef.includes(':') || (eventSession && at >= eventSession.start && at < eventSession.end))
  if (
    validEventQso &&
    date.slice(5, 7) === '01' &&
    Number(date.slice(8, 10)) >= 2 &&
    event === 'k3y'
  ) {
    const area =
      call.match(/^K3Y\/(\d|KH6|KL7|KP4)$/)?.[1] ??
      text(received.region ?? received.k3yArea).toUpperCase()
    if (/^\d$/.test(area) || ['KH6', 'KL7', 'KP4', ...CONTINENTS].includes(area))
      claim('K3Y', `${date.slice(0, 4)}:${area}`)
    else reject('K3Y', 'Needs the received K3Y area (DX stations use their own calls)')
  } else reject('K3Y', 'Needs a recorded K3Y exchange in January, starting January 2')
  if (
    validEventQso &&
    date.slice(5, 7) === '09' &&
    event === 'cskm' &&
    /\/\s*CSKM\b/i.test(name) &&
    PROVINCES.has(spc)
  )
    claim('CSKM', `${date.slice(0, 4)}:${spc}`)
  else
    reject(
      'CSKM',
      'Needs a received /CSKM name in September and Canadian province/territory; selecting the activity alone is insufficient',
    )
  const issues = result.issues
  if (qso.deleted === true || qso.deleted === 1 || band === 'event')
    issues.push('Deleted contact or event marker')
  if (!date) issues.push('Missing or invalid QSO date')
  if (!band) issues.push('Missing band')
  if (text(qso.mode).toUpperCase() !== 'CW') issues.push('Contact is not recorded as CW')
  if (!number || !mine) issues.push('Both exchanged SKCC numbers are required')
  if (!text(received.name) || !text(own.name)) issues.push('Both exchanged names are required')
  if (!call || !ownCall) issues.push('Both station calls are required')
  if (!member || !myMember) issues.push('Member identity cannot be resolved from the roster')
  if (number && number === mine) issues.push('A contact with your own membership cannot count')
  if (options.myNumber && memberNumber(options.myNumber) !== mine)
    issues.push('Contact belongs to another SKCC member')
  if (!keyQualified(own) || !keyQualified(received))
    issues.push('Approved keying by both stations has not been recorded')
  if (!dateMet(date, member?.joinDate) || !dateMet(date, myMember?.joinDate))
    issues.push('Both membership dates must be known and on or before the QSO')
  if (options.band && band !== options.band.toLowerCase()) issues.push('Outside the selected band')
  result.eligible = issues.length === 0
  if (!result.eligible) {
    for (const award of AWARD_IDS)
      if (award !== 'K3Y' && award !== 'CSKM') result.reasons[award] = [...issues]
    return result
  }
  const operatorKnown =
    !specialCall(call) || Boolean(text(received.operatorCall) && licensedCall(identityCall, member))
  if (operatorKnown || date < '2009-12-01') claim('C', number)
  else reject('C', 'Special-event QSO needs the actual operator call exchanged on air')
  if (
    (operatorKnown || date < '2008-10-01') &&
    date >= '2007-03-01' &&
    dateMet(date, myMember?.centurionDate) &&
    dateMet(date, member?.centurionDate)
  )
    claim('T', number)
  else
    reject(
      'T',
      'Needs an operator call and both approved Centurion dates on or before the QSO (since 2007-03-01)',
    )
  if (
    operatorKnown &&
    date >= '2013-08-01' &&
    dateMet(date, myMember?.tx8Date) &&
    dateMet(date, member?.tribuneDate)
  )
    claim('S', number)
  else
    reject(
      'S',
      'Needs an operator call, your approved Tx8 date and their Tribune date on or before the QSO (since 2013-08-01)',
    )
  if (STATES.has(spc)) {
    claim('WAS', spc)
    for (const [award, milestone, since] of [
      ['WAS-C', member?.centurionDate, '2011-06-12'],
      ['WAS-T', member?.tribuneDate, '2016-02-01'],
      ['WAS-S', member?.senatorDate, '2016-02-01'],
    ] as const) {
      if (date >= since && dateMet(date, milestone)) claim(award, spc)
      else
        reject(award, `Needs their approved status at the QSO and a contact on or after ${since}`)
    }
  } else
    for (const award of ['WAS', 'WAS-C', 'WAS-T', 'WAS-S'] as const)
      reject(award, 'No received US state; roster QTH is not used')
  const entity = (value: unknown) => {
    const number = typeof value === 'number' ? value : Number(text(value))
    return Number.isSafeInteger(number) && number > 0 ? String(number) : ''
  }
  const ownDx = entity('dxcc' in own ? own.dxcc : our.dxcc),
    theirDx = entity('dxcc' in received ? received.dxcc : their.dxcc)
  if (
    ownDx &&
    theirDx &&
    ownDx !== theirDx &&
    !/\/(MM|AM)(\/|$)/.test(call) &&
    !/\/(MM|AM)(\/|$)/.test(ownCall)
  ) {
    if (date >= '2009-12-19') claim('DXC', theirDx)
    else reject('DXC', 'DXC starts 2009-12-19')
    if (date >= '2009-06-14') claim('DXQ', `${theirDx}:${number}`)
    else reject('DXQ', 'DXQ starts 2009-06-14')
  } else
    for (const award of ['DXC', 'DXQ'] as const)
      reject(
        award,
        'Needs recorded, different operating DXCC entities; maritime/air mobile needs manual review',
      )
  const baseCall = licensedCall(call, member)
  const prefix = baseCall?.match(/^([A-Z0-9]*\d)[A-Z]+$/)?.[1]
  if (date >= '2013-01-01' && prefix && !specialCall(call))
    claim('PFX', prefix, Number(number), { call: baseCall })
  else
    reject(
      'PFX',
      'Needs a licensed roster call prefix, no special-event call, on or after 2013-01-01',
    )
  const ownPower = numeric(own.power ?? our.power),
    theirPower = numeric(received.power ?? their.power)
  const points = QRP_POINTS[band]
  if (
    ownPower !== undefined &&
    ownPower > 0 &&
    ownPower <= 5 &&
    points &&
    (band !== '60m' || date >= '2013-09-01')
  ) {
    claim('QRP1', `${number}:${band}`, points)
    if (theirPower !== undefined && theirPower > 0 && theirPower <= 5)
      claim('QRP2', `${number}:${band}`, points)
    else
      reject(
        'QRP2',
        'Their exchanged power must also be recorded as greater than 0 and at most 5 W',
      )
  } else
    for (const award of ['QRP1', 'QRP2'] as const)
      reject(
        award,
        'Needs your recorded power (0 < W ≤ 5) and a published points band; 60m starts 2013-09-01',
      )
  const minutes = ((numeric(qso.endAtMillis) ?? at) - at) / 60000
  const participants = numeric(received.participants) ?? 2
  if (
    minutes >= (participants > 2 ? 40 : 30) &&
    reportFor(qso, 'their') &&
    reportFor(qso, 'our') &&
    spc &&
    text(own.spc)
  )
    claim('RC', id, Math.floor(minutes))
  else
    reject(
      'RC',
      'Needs 30 minutes (40 for a group), start/end times and both RST/location exchanges',
    )
  if (
    minutes >= 60 &&
    date >= '2008-01-01' &&
    !specialCall(call) &&
    !specialCall(ownCall) &&
    participants === 2
  )
    claim('MARATHON', number)
  else
    reject(
      'MARATHON',
      'Needs an hour-long personal-call QSO since 2008-01-01; club confirmation is separate',
    )
  const key = text(own.key).toUpperCase()
  if (date >= '2018-11-10' && ['SK', 'BUG', 'SS'].includes(key) && own.keyDeclared === true)
    claim('TKA', number, 1, { key })
  else
    reject(
      'TKA',
      'Needs your SK/BUG/SS key type and confirmation it was declared on air, since 2018-11-10',
    )
  const sprint =
    event && ['wes', 'sks', 'skse', 'sksa'].includes(event)
      ? event
      : Number(date.slice(0, 4)) >= 2026
        ? sprintAt(at)[0]
        : undefined
  if (date.slice(0, 7) !== options.month) reject('BRAG', 'Outside the selected UTC month')
  else if (sprint)
    reject(
      'BRAG',
      `During ${sprint.toUpperCase()}; sprint-overlap contacts require review and are excluded conservatively`,
    )
  else if (Number(date.slice(0, 4)) < 2026 && !event)
    reject('BRAG', 'Historical sprint schedule unknown; record the activity for review')
  else claim('BRAG', number)
  const ownContinent = text(own.continent ?? our.continent).toUpperCase(),
    continent = text(received.continent ?? their.continent).toUpperCase()
  if (date >= '2011-10-09' && CONTINENTS.has(ownContinent) && CONTINENTS.has(continent))
    claim('WAC', `${ownContinent}:${continent}`)
  else
    reject(
      'WAC',
      'Needs both recorded operating continents since 2011-10-09; all application QSOs must share your continent',
    )
  return result
}

/** Maximum matching avoids allocating the same member to two Triple Key groups. */
function tripleKey(credits: AwardCredit[]): AwardCredit[] {
  const choices = new Map<string, Map<string, AwardCredit>>()
  for (const credit of credits) {
    const keys = choices.get(credit.number) ?? new Map<string, AwardCredit>()
    if (credit.key && !keys.has(credit.key)) keys.set(credit.key, credit)
    choices.set(credit.number, keys)
  }
  const slots = new Map<string, string>()
  const assign = (number: string, visited: Set<string>): boolean => {
    for (const key of choices.get(number)?.keys() ?? [])
      for (let index = 0; index < 100; index++) {
        const slot = `${key}:${index}`
        if (visited.has(slot)) continue
        visited.add(slot)
        const old = slots.get(slot)
        if (!old || assign(old, visited)) {
          slots.set(slot, number)
          return true
        }
      }
    return false
  }
  for (const number of choices.keys()) assign(number, new Set())
  return [...slots].flatMap(([slot, number]) => {
    const credit = choices.get(number)?.get(slot.split(':')[0])
    return credit ? [credit] : []
  })
}

export function analyzeAwards(
  qsos: Qson[],
  roster: Roster | undefined,
  options: AwardOptions = {},
): AwardReport {
  const month = options.month ?? new Date().toISOString().slice(0, 7)
  // Repeated imports of the same contact must not inflate duration-based awards.
  const seen = new Set<string>()
  const rows = qsos
    .map((qso) => evaluateQso(qso, roster, { ...options, month }))
    .filter((row) => {
      const fingerprint = `${row.holder}:${row.number}:${row.at}:${row.band}`
      if (seen.has(fingerprint)) return false
      seen.add(fingerprint)
      return true
    })
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const awards = {} as Record<AwardId, AwardSummary>
  for (const award of AWARD_IDS) {
    let all = rows.flatMap((row) => {
      const credit = row.awards[award]
      return credit ? [credit] : []
    })
    // Do not mix editions, continents, or different operators into one threshold.
    const holders = new Set(rows.filter((row) => row.awards[award]).map((row) => row.holder))
    if (holders.size > 1) all = []
    if (award === 'K3Y' || award === 'CSKM')
      all = all.filter((credit) => credit.ref.startsWith(`${month.slice(0, 4)}:`))
    if (award === 'WAC') {
      const groups = new Map<string, AwardCredit[]>()
      for (const credit of all) {
        const group = credit.ref.split(':')[0]
        groups.set(group, [...(groups.get(group) ?? []), credit])
      }
      all =
        [...groups.values()].sort(
          (a, b) => new Set(b.map((c) => c.ref)).size - new Set(a.map((c) => c.ref)).size,
        )[0] ?? []
    }
    const chosen = new Map<string, AwardCredit>()
    for (const credit of all)
      if (
        !chosen.has(credit.ref) ||
        (award === 'PFX' && (chosen.get(credit.ref)?.points ?? 0) < credit.points)
      )
        chosen.set(credit.ref, credit)
    const credits = award === 'TKA' ? tripleKey(all) : [...chosen.values()]
    const [label, target, unit] = DEFINITIONS[award]
    const total = credits.reduce((sum, credit) => sum + credit.points, 0)
    const credited = new Set(credits.map((credit) => credit.qsoId))
    awards[award] = {
      label,
      total,
      target,
      unit,
      ready: target > 0 && total >= target && award !== 'MARATHON',
      credits,
      excluded: rows
        .filter((row) => !credited.has(row.id))
        .map((row) => ({
          qsoId: row.id,
          reasons:
            holders.size > 1
              ? ['Multiple operators in report; select your membership number']
              : (row.reasons[award] ?? [
                  'Already represented, outside this edition/continent, or not selected in the best qualifying set',
                ]),
        })),
    }
  }
  const bonus = memberNumber(options.bragBonusNumber)
  awards.BRAG.bonusPoints =
    bonus && awards.BRAG.credits.some((credit) => credit.number === bonus) ? 25 : 0
  return {
    scope: options.scope ?? 'selected',
    month,
    rosterRevision: roster?.revision ?? '',
    rows,
    awards,
    limitations: [
      'Calculated progress is not sponsor approval. Complete-history scope describes the file supplied, not a verified complete or synchronized log.',
      'Marathon shows candidates only: both operators must confirm through SKCC; home/remote location and band-change rules need manual review.',
      'DX reports conservatively exclude domestic and maritime/air-mobile contacts; ambiguous territorial cases need award-manager review.',
      'Monthly Brag conservatively excludes sprint-overlap QSOs, including WARC; verify historical schedules and announced bonus stations.',
      'WAC selects the largest checklist from one operating continent; K3Y and CSKM show the selected year and are unconfirmed local checklists.',
      'PFX and Triple Key choose the best set from supplied contacts. Roster refreshes and added contacts require a new report.',
    ],
  }
}

/** Prospect statements never become earned credit, and always identify the report's scope. */
export function makeProspect(
  member: Member,
  mine: Member | undefined,
  report?: AwardReport,
  band?: string,
  at = Date.now(),
): string[] {
  const reasons: string[] = []
  const date = utcDate(at)
  if (member.status !== 'A')
    return ['Roster lists this member as inactive or silent key; no activity inferred']
  if (!mine) return ['SKCC member; configure your membership to identify potential awards']
  if (mine.number === member.number) return []
  // The aggregate award retains one contact per member; another qualifying band
  // may be represented only in the audited rows, not in the chosen application.
  const lacks = (award: AwardId) =>
    band
      ? !report?.rows.some(
          (row) =>
            row.holder === mine.number &&
            row.number === member.number &&
            row.band === band.toLowerCase() &&
            row.awards[award],
        )
      : !report?.awards[award].credits.some((credit) => credit.number === member.number)
  const scope = report
    ? `not in ${report.scope === 'complete-history' ? 'imported history' : 'selected contacts'}`
    : 'potential'
  const onBand = band ? ` on ${band}` : ''
  if (lacks('C')) reasons.push(`Centurion${onBand}: ${scope}`)
  if (dateMet(date, mine.centurionDate) && dateMet(date, member.centurionDate) && lacks('T'))
    reasons.push(`Tribune${onBand}: ${scope}`)
  if (dateMet(date, mine.tx8Date) && dateMet(date, member.tribuneDate) && lacks('S'))
    reasons.push(`Senator${onBand}: ${scope}`)
  if (dateMet(date, mine.centurionDate))
    reasons.push('Your Centurion status may help their Tribune chase; their log is unknown')
  if (dateMet(date, mine.tribuneDate) && dateMet(date, member.tx8Date))
    reasons.push('Your Tribune status may help their Senator chase; their log is unknown')
  return reasons
}
