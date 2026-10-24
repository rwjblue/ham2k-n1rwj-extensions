// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { host, type JSONValue } from '@ham2k/extension-sdk'
import { AWARD_IDS, type AwardId, type AwardReport } from './awards.ts'
import { KEY, memberNumber, object, text } from './model.ts'

/** A labelled import snapshot, never a second live ledger or a substitute for native claims. */
export interface AuditSnapshot {
  schema: 1
  at: number
  member: string
  rosterRevision: string
  month: string
  records: number
  eligible: number
  source: string
  awards: Record<
    AwardId,
    {
      total: number
      target: number
      unit: string
      label: string
      refs: string[]
      numbers: string[]
    }
  >
}
const STORAGE_KEY = 'auditSnapshot'
const LIMIT = 4_000_000
export function snapshotFor(
  report: AwardReport,
  member: string,
  source: string,
  at = Date.now(),
): AuditSnapshot {
  if (report.scope !== 'complete-history')
    throw new Error('Only an explicitly complete-history report may replace the import snapshot.')
  const number = memberNumber(member)
  if (!number) throw new Error('Set your SKCC number before importing a complete-history snapshot.')
  const holders = new Map(report.rows.map((row) => [row.id, row.holder]))
  if (
    report.rows.some((row) => row.eligible && row.holder !== number) ||
    AWARD_IDS.some((id) =>
      report.awards[id].credits.some((credit) => holders.get(credit.qsoId) !== number),
    )
  )
    throw new Error(
      'The imported report contains award credit for another SKCC member. Analyze the selected operator’s history before saving.',
    )
  const snapshot: AuditSnapshot = {
    schema: 1,
    at,
    member: number,
    rosterRevision: report.rosterRevision,
    month: report.month,
    records: report.import?.records ?? report.rows.length,
    eligible: report.rows.filter((row) => row.eligible && row.holder === number).length,
    source: source.slice(0, 120),
    awards: Object.fromEntries(
      AWARD_IDS.map((id) => {
        const award = report.awards[id]
        return [
          id,
          {
            total: award.total,
            target: award.target,
            unit: award.unit,
            label: award.label,
            refs: [...new Set(award.credits.map((credit) => credit.ref))],
            numbers: [...new Set(award.credits.map((credit) => credit.number))],
          },
        ]
      }),
    ) as AuditSnapshot['awards'],
  }
  if (JSON.stringify(snapshot).length > LIMIT)
    throw new Error(
      'This history is too large for a saved panel snapshot; use the full audit and native chasing imports.',
    )
  const checked = readSnapshot(snapshot)
  if (!checked) throw new Error('Invalid SKCC audit report. Previous snapshot retained.')
  return checked
}
export function readSnapshot(value: unknown): AuditSnapshot | undefined {
  const input = object(value)
  const count = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  if (
    input.schema !== 1 ||
    !count(input.at) ||
    input.at > 8640000000000000 ||
    !memberNumber(input.member) ||
    memberNumber(input.member) !== input.member ||
    typeof input.month !== 'string' ||
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.month) ||
    !count(input.records) ||
    !count(input.eligible) ||
    input.eligible > input.records ||
    typeof input.rosterRevision !== 'string' ||
    input.rosterRevision.length > 128 ||
    typeof input.source !== 'string' ||
    input.source.length > 120
  )
    return undefined
  const awards = object(input.awards)
  const checkedAwards = {} as AuditSnapshot['awards']
  for (const id of AWARD_IDS) {
    const entry = object(awards[id])
    if (
      typeof entry.total !== 'number' ||
      !Number.isFinite(entry.total) ||
      entry.total < 0 ||
      typeof entry.target !== 'number' ||
      !Number.isFinite(entry.target) ||
      entry.target < 0 ||
      typeof entry.label !== 'string' ||
      entry.label.length > 120 ||
      typeof entry.unit !== 'string' ||
      entry.unit.length > 40 ||
      !Array.isArray(entry.refs) ||
      !Array.isArray(entry.numbers)
    )
      return undefined
    if (
      !entry.refs.every((ref) => typeof ref === 'string' && ref.length <= 120) ||
      !entry.numbers.every(
        (number) => typeof number === 'string' && memberNumber(number) === number,
      )
    )
      return undefined
    checkedAwards[id] = {
      total: entry.total,
      target: entry.target,
      label: entry.label,
      unit: entry.unit,
      refs: [...entry.refs] as string[],
      numbers: [...entry.numbers] as string[],
    }
  }
  const checked: AuditSnapshot = {
    schema: 1,
    at: input.at,
    member: input.member as string,
    rosterRevision: input.rosterRevision,
    month: input.month,
    records: input.records,
    eligible: input.eligible,
    source: input.source,
    awards: checkedAwards,
  }
  return JSON.stringify(checked).length > LIMIT ? undefined : checked
}
export function createAuditStore(deps: Pick<typeof host, 'getSettings' | 'setSettings'> = host) {
  let snapshot: AuditSnapshot | undefined
  let full: AwardReport | undefined
  let loadPromise: Promise<void> | undefined
  let generation = 0
  let mutations = Promise.resolve()
  function mutate(operation: () => Promise<void>): Promise<void> {
    const result = mutations.then(operation)
    mutations = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
  return {
    get: () => snapshot,
    report: () => full,
    async load() {
      // A completed save or clear is newer than any initial persisted state.
      if (generation > 0) return
      const before = generation
      loadPromise ??= deps
        .getSettings()
        .then((settings) => {
          if (generation === before)
            snapshot = readSnapshot(
              object(object(settings.extensions)[`extension_${KEY}`])[STORAGE_KEY],
            )
        })
        .catch(() => {
          loadPromise = undefined
        })
      await loadPromise
    },
    save(report: AwardReport, member: string, source: string): Promise<void> {
      return mutate(async () => {
        const next = snapshotFor(report, member, text(source) || 'ADIF import')
        await deps.setSettings({ [STORAGE_KEY]: next as unknown as JSONValue })
        generation++
        full = report
        snapshot = next
      })
    },
    clear(): Promise<void> {
      return mutate(async () => {
        await deps.setSettings({ [STORAGE_KEY]: null })
        generation++
        snapshot = undefined
        full = undefined
      })
    },
  }
}
export type AuditStore = ReturnType<typeof createAuditStore>
