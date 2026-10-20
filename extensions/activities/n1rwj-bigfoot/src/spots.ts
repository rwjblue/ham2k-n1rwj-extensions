import type { BoardSpot } from '@ham2k/extension-sdk'
import { bandForExactFrequencyInMHz } from '@ham2k/lib-operation-data'
import type { BigfootEvent, Contact, EventMode, ProgressMode } from './rules.ts'
import { normalizeMode } from './rules.ts'
import { targetForCall, targetStatus } from './targets.ts'

export interface BigfootSpotRow {
  call: string
  label: string
  band: string
  mode: EventMode
  /** The SDK's spot frequency is in kHz. */
  frequency: number
  /** When the source reported this spot, independently of the candidate QSO time. */
  at: number
  needed: boolean
  status: string
  source?: string
}

export interface BuildSpotRowsArgs {
  spots: readonly BoardSpot[]
  contacts: readonly Contact[]
  event: BigfootEvent
  focus: ProgressMode
  now: number
  maxAgeMinutes: number
  /** A panel lead follows the newest report, even after a station changes mode. */
  onePerCall?: boolean
}

type KnownSpot = Omit<BigfootSpotRow, 'needed' | 'status'>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareSpots(a: KnownSpot, b: KnownSpot): number {
  return (
    b.at - a.at ||
    compareText(a.call, b.call) ||
    compareText(a.band, b.band) ||
    compareText(a.mode, b.mode) ||
    a.frequency - b.frequency ||
    compareText(a.source ?? '', b.source ?? '')
  )
}

function modeGroup(mode: EventMode) {
  return mode === 'CW' ? 'CW' : mode === 'SSB' ? 'PHONE' : 'DIGITAL'
}

/** Project held spots only; the caller owns fetching and the log snapshot. */
export function buildSpotRows({
  spots,
  contacts,
  event,
  focus,
  now,
  maxAgeMinutes,
  onePerCall = false,
}: BuildSpotRowsArgs): BigfootSpotRow[] {
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 0) return []
  const maxAge = maxAgeMinutes * 60_000
  if (!Number.isFinite(maxAge)) return []
  const known = new Map<string, KnownSpot>()
  for (const spot of spots) {
    const at = spot?.spot?.timeInMillis
    const frequency = spot?.freq
    const band = text(spot?.band).toLowerCase()
    const mode = normalizeMode(spot?.mode)
    if (
      typeof at !== 'number' ||
      !Number.isFinite(at) ||
      at > now ||
      now - at > maxAge ||
      typeof frequency !== 'number' ||
      !Number.isFinite(frequency) ||
      frequency <= 0 ||
      !event.bands.includes(band) ||
      // The published exact helper accepts kHz despite its name. Avoid the
      // unit guessing in bandForFrequency, and never trust a mismatched band.
      bandForExactFrequencyInMHz(frequency) !== band ||
      !mode
    )
      continue
    const source = text(spot.spot.label) || text(spot.spot.source)
    for (const part of text(spot?.their?.call).split(',')) {
      const target = targetForCall(part)
      if (!target) continue
      const row: KnownSpot = {
        call: target.call,
        label: target.label,
        band,
        mode,
        frequency,
        at,
        ...(source ? { source } : {}),
      }
      // Several receivers can report the same station on the same frequency.
      // Keep the newest, with a stable source choice when timestamps tie.
      const key = onePerCall ? row.call : `${row.call}|${band}|${mode}|${frequency}`
      const previous = known.get(key)
      if (!previous || compareSpots(row, previous) < 0) known.set(key, row)
    }
  }

  const history =
    focus === 'MIXED' ? contacts : contacts.filter((contact) => contact.modeGroup === focus)
  const label = { MIXED: 'Mixed', CW: 'CW', PHONE: 'Phone', DIGITAL: 'Digital' }[focus]
  const rows: BigfootSpotRow[] = []
  for (const row of [...known.values()].sort(compareSpots)) {
    if (focus !== 'MIXED' && modeGroup(row.mode) !== focus) continue
    const assessment = targetStatus(event, history, {
      their: { call: row.call },
      band: row.band,
      mode: row.mode,
      // A contact made now earns today's credit, even if the report crossed
      // UTC midnight. Spot age remains based on the original report above.
      startAtMillis: now,
    })
    if (!assessment) continue
    // Digital is one family, so FT8 + RTTY can fill its two O contacts.
    // Phone uses the SSB message, whose repeat guidance correctly excludes
    // another actual mode from the ways to fill the second Phone O.
    const need =
      focus === 'CW'
        ? assessment.cw
        : focus === 'PHONE'
          ? (assessment.mode ?? assessment.mixed)
          : assessment.mixed
    rows.push({
      ...row,
      needed: assessment.eligibility === 'eligible' && need.wouldAdvance,
      status:
        assessment.eligibility === 'eligible'
          ? need.message.replace(/^(?:Mixed|SSB):/, `${label}:`)
          : assessment.messages[0],
    })
  }
  return rows
}
