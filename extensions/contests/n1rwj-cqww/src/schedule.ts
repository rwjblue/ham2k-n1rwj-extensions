// Copyright ©️ 2026 Sebastian Delmont <sd@ham2k.com>
// SPDX-License-Identifier: MIT
//
// When the three CQ WW weekends run, and how close each is.
//
// COMPUTED, not published in a data file: the rules state each date as a
// RULE — RTTY on "the last full weekend of September", SSB on "the last full
// weekend of October", CW on "the last full weekend of November", each from
// 0000 UTC Saturday to 2400 UTC Sunday — so it is right for every year,
// including ones nobody has updated a file for. Same approach as `wfd`, which
// computes its last full weekend of January the same way.

const DAY = 24 * 60 * 60 * 1000

/// The three runnings, each its own contest: separate weekends, separate logs,
/// separate submissions. In calendar order.
export type CQWWMode = 'RTTY' | 'SSB' | 'CW'
export const MODES: CQWWMode[] = ['RTTY', 'SSB', 'CW']

/// September for RTTY, October for SSB, November for CW (0-based).
const MONTH_FOR: Record<CQWWMode, number> = { RTTY: 8, SSB: 9, CW: 10 }

/// The Saturday starting the LAST full weekend of [month] — one whose Sunday
/// also falls in the same month. Skips a Saturday landing on the last day of
/// the month, which October and November both do often enough to matter.
function lastFullWeekendSaturday(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  for (let day = lastDay - 1; day >= 1; day -= 1) {
    const at = Date.UTC(year, month, day)
    if (new Date(at).getUTCDay() === 6) return at
  }
  // Unreachable — a month always contains a full weekend — but a typed return
  // beats a non-null assertion.
  return Date.UTC(year, month, 1)
}

/// The start of a running — 0000 UTC on its Saturday.
export function startOfContest(year: number, mode: CQWWMode): number {
  return lastFullWeekendSaturday(year, MONTH_FOR[mode])
}

/// The end — 48 hours later, as an EXCLUSIVE bound: "2400 UTC Sunday" is the
/// instant Monday begins.
export function endOfContest(year: number, mode: CQWWMode): number {
  return startOfContest(year, mode) + 2 * DAY
}

/// How long a finished running is still offered — long enough to log it
/// after the weekend, short enough that the search reads as "what is coming".
const GRACE_DAYS = 3

/// The YEAR whose running of [mode] is the next one — the single source for
/// "which running is this?". Rolls once the running is [GRACE_DAYS] past.
export function nextRunningYear(nowMillis: number, mode: CQWWMode): number {
  const year = new Date(nowMillis).getUTCFullYear()
  return endOfContest(year, mode) < nowMillis - GRACE_DAYS * DAY ? year + 1 : year
}

/// Days until the next running of [mode], negative while it is on.
export function daysUntilContest(nowMillis: number, mode: CQWWMode): number {
  return Math.ceil((startOfContest(nextRunningYear(nowMillis, mode), mode) - nowMillis) / DAY)
}

/// Whether [mode]'s running is on the air right now.
export function isContestOn(nowMillis: number, mode: CQWWMode): boolean {
  const year = new Date(nowMillis).getUTCFullYear()
  return nowMillis >= startOfContest(year, mode) && nowMillis < endOfContest(year, mode)
}

/// Relevance for [mode]'s next running. This only ORDERS the suggestion list,
/// and only against other suggestions with no location.
///
/// A running in its grace days ranks BELOW every upcoming one: the curve for
/// a running a year out bottoms at 1 / (1 + 366 / 60) ≈ 0.14, so a finished
/// weekend never leads the list or becomes the setup form's default while the
/// next one is weeks away. `days <= 0` alone is not "on now" — `daysUntil`
/// stays negative through the grace days — hence the `isOn` test first.
export function relevanceFor(nowMillis: number, mode: CQWWMode): number {
  if (isContestOn(nowMillis, mode)) return 1
  const days = daysUntilContest(nowMillis, mode)
  if (days <= 0) return 0.05
  return 1 / (1 + days / 60)
}

/// The running nearest on the calendar, for the setup form's default — the
/// day after RTTY that is SSB, in December next September's RTTY.
export function nearestMode(nowMillis: number): CQWWMode {
  return MODES.reduce((best, mode) =>
    relevanceFor(nowMillis, mode) > relevanceFor(nowMillis, best) ? mode : best,
  )
}
