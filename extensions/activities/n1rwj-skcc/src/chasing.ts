// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { ChasingHook, ImportedClaim, QsoClaim } from '@ham2k/extension-sdk'
import { qsosFromAdif } from './applications.ts'
import type { AwardCredit, AwardId, AwardOptions, AwardReport } from './awards.ts'
import { analyzeAwards, evaluateQso } from './awards.ts'
import type { Qson, Roster, RosterGetter } from './model.ts'
import { KEY, memberNumber, object, text } from './model.ts'
import { lookupMember } from './roster.ts'

const PROGRAMS: { award: AwardId; suffix: string; label: string; target: number }[] = [
  { award: 'C', suffix: 'c', label: 'SKCC Centurion', target: 100 },
  { award: 'T', suffix: 't', label: 'SKCC Tribune', target: 50 },
  { award: 'S', suffix: 's', label: 'SKCC Senator', target: 200 },
  { award: 'WAS', suffix: 'was', label: 'SKCC WAS', target: 50 },
  { award: 'WAS-C', suffix: 'was_c', label: 'SKCC WAS-C', target: 50 },
  { award: 'WAS-T', suffix: 'was_t', label: 'SKCC WAS-T', target: 50 },
  { award: 'WAS-S', suffix: 'was_s', label: 'SKCC WAS-S', target: 50 },
  { award: 'DXC', suffix: 'dxc', label: 'SKCC DXC', target: 10 },
  { award: 'DXQ', suffix: 'dxq', label: 'SKCC DXQ', target: 10 },
  { award: 'QRP1', suffix: 'qrp1', label: 'SKCC 1×QRP', target: 300 },
  { award: 'QRP2', suffix: 'qrp2', label: 'SKCC 2×QRP', target: 150 },
]
const POINTS: Record<string, number> = {
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
export interface ChasingOptions {
  version?: number
  getOptions?: () => AwardOptions
  onReport?: (report: AwardReport) => void | Promise<void>
}

function claims(credit: AwardCredit, holder: string, award: AwardId): QsoClaim[] {
  const base: QsoClaim = {
    holder,
    ref: credit.ref,
    band: null,
    mode: null,
    level: 'worked',
    label: ['C', 'T', 'S', 'DXQ', 'QRP1', 'QRP2'].includes(award)
      ? `${credit.call} #${credit.number}`
      : credit.ref,
  }
  return [base, { ...base, band: credit.band }]
}

/**
 * Reference data and options are frozen for this registration, matching the host's
 * cached verdict lifecycle. Refresh + restart + a whole-log EXP CHASE rescan is
 * required after roster changes; no per-device/hash version masquerades as a schema.
 * No candidate marker exists in API 9: roster-only spots cannot produce earned claims.
 */
export function createChasing(
  getRoster: RosterGetter,
  config: ChasingOptions = {},
): { key: string; hook: ChasingHook }[] {
  let roster: Roster | undefined
  let options: AwardOptions = {}
  const requireRoster = () => {
    if (!roster) {
      const current = getRoster()
      if (!current)
        throw new Error(
          'SKCC award roster unavailable. Refresh the roster, restart the extension and rebuild chasing on a device with the complete log.',
        )
      roster = {
        ...current,
        members: current.members.map((member) => ({ ...member, oldCalls: [...member.oldCalls] })),
      }
      // Native claims belong to each contact's recorded operator; a UI selection
      // must never withdraw another station's factual lifetime checklist.
      const { myNumber: _selection, ...configured } = config.getOptions?.() ?? {}
      options = configured
    }
    return roster
  }
  return PROGRAMS.map((program) => {
    const hook: ChasingHook = {
      program: {
        label: program.label,
        icon: 'key-variant',
        version: config.version ?? 1,
        editions: 'lifetime',
        refLabel: ['C', 'T', 'S'].includes(program.award) ? 'SKCC member' : program.label,
        imports: [
          {
            key: 'skcc-adif',
            label: 'SKCC ADIF with recorded eligibility (worked credit)',
            extensions: ['adi', 'adif'],
          },
        ],
      },
      claimsForQsos({ qsos }) {
        const reference = requireRoster()
        const results: Record<string, QsoClaim[]> = {}
        for (const qso of qsos) {
          const uuid = text(qso.uuid)
          if (!uuid) continue
          const evaluation = evaluateQso(qso, reference, options)
          const credit = evaluation.awards[program.award]
          results[uuid] = credit ? claims(credit, evaluation.holder, program.award) : []
        }
        return results
      },
      holdersFor({ station }) {
        const number = memberNumber(object(station.skcc).number)
        const member = lookupMember(requireRoster(), station.call, number)
        return member ? [member.number] : []
      },
      summarizeClaims({ slots }) {
        const mixed = slots.filter((slot) => slot.band === null && slot.mode === null)
        const isQrp = program.award === 'QRP1' || program.award === 'QRP2'
        const unique = new Map(mixed.map((slot) => [slot.ref, slot]))
        const total = isQrp
          ? [...unique.keys()].reduce(
              (sum, ref) => sum + (POINTS[ref.split(':').pop() ?? ''] ?? 0),
              0,
            )
          : unique.size
        return {
          progress: {
            key: 'progress',
            label: program.label,
            total,
            summary: `${total} ${isQrp ? 'points' : 'references'}; initial threshold ${program.target}. Calculated worked credit; club approval is separate.`,
            grid: program.award.startsWith('WAS'),
          },
        }
      },
      async importClaims({ file, station }) {
        const reference = requireRoster()
        const stationNumber =
          memberNumber(object(station.skcc).number) ?? lookupMember(reference, station.call)?.number
        // Picking a file is not permission to manufacture exchange/keying evidence.
        const importOptions: AwardOptions = {
          ...options,
          myNumber: stationNumber ?? options.myNumber,
          attestImportedEligibility: false,
          // The native file picker does not ask the operator to attest that a
          // file contains their complete history. It can only audit its records.
          scope: 'selected',
        }
        const imported = qsosFromAdif(file.text, reference, importOptions)
        const report = analyzeAwards(imported.qsos, reference, importOptions)
        report.import = {
          records: imported.records,
          skipped: imported.skipped,
          errors: imported.errors,
        }
        await config.onReport?.(report)
        if (imported.errors.length)
          throw new Error(`SKCC ADIF was not imported: ${imported.errors.join('; ')}`)
        const importedClaims: ImportedClaim[] = []
        for (const row of report.rows) {
          const credit = row.awards[program.award]
          if (!credit) continue
          for (const claim of claims(credit, row.holder, program.award))
            importedClaims.push({
              ...claim,
              at: row.at,
              match: { theirCall: row.call, startAtMillis: row.at, band: row.band, mode: 'CW' },
            })
        }
        return {
          claims: importedClaims,
          skipped:
            imported.skipped + report.rows.filter((row) => !row.awards[program.award]).length,
        }
      },
    }
    return { key: `${KEY}_${program.suffix}`, hook }
  })
}

/** QSON context for an explicit prospective assessment; never send this to claimsForQsos. */
export function prospectiveCall(call: string, band: string): Qson {
  return { their: { call }, band, mode: 'CW' }
}
