// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { ExportHook, ExportOption } from '@ham2k/extension-sdk'
import { applicationCsv, applicationText, auditCsv, reportMarkdown } from './applications.ts'
import type { AuditStore } from './audit-store.ts'
import { AWARD_IDS, type AwardId, analyzeAwards } from './awards.ts'
import { memberNumber, type RosterGetter } from './model.ts'
import type { PreferencesStore } from './preferences.ts'

const TYPES = [
  { exportType: 'skcc-award-audit', label: 'SKCC award audit', format: 'csv' },
  { exportType: 'skcc-award-summary', label: 'SKCC award summary', format: 'txt' },
  { exportType: 'skcc-award-csv', label: 'SKCC application worksheet (CSV)', format: 'csv' },
  { exportType: 'skcc-award-text', label: 'SKCC application review and exclusions', format: 'txt' },
]
export function createAwardExports(
  getRoster: RosterGetter,
  preferences: PreferencesStore,
  audit: AuditStore,
): ExportHook {
  return {
    async getExportTypes() {
      return TYPES
    },
    async suggestExportOptions() {
      await preferences.load()
      const saved = audit.report(),
        snapshot = audit.get()
      const sources = [
        'operation',
        ...(saved && snapshot?.member === memberNumber(preferences.get().myNumber)
          ? ['import']
          : []),
      ]
      const options: ExportOption[] = []
      for (const source of sources) {
        const label =
          source === 'import' ? 'loaded complete-history analysis' : 'this operation only'
        options.push({
          exportType: 'skcc-award-audit',
          exportKey: source,
          format: 'csv',
          label: `SKCC full audit — ${label}`,
          selectedByDefault: false,
        })
        options.push({
          exportType: 'skcc-award-summary',
          exportKey: source,
          format: 'txt',
          label: `SKCC award summary — ${label}`,
          selectedByDefault: false,
        })
        for (const award of AWARD_IDS) {
          options.push({
            exportType: 'skcc-award-csv',
            exportKey: `${source}:${award}`,
            format: 'csv',
            label: `SKCC ${award} worksheet — ${label}`,
            selectedByDefault: false,
          })
          options.push({
            exportType: 'skcc-award-text',
            exportKey: `${source}:${award}`,
            format: 'txt',
            label: `SKCC ${award} review and exclusions — ${label}`,
            selectedByDefault: false,
          })
        }
      }
      return options
    },
    async generateExport(args) {
      const type = TYPES.find((type) => type.exportType === args.exportType)
      if (!type) throw new Error('Unsupported SKCC award export')
      await preferences.load()
      const p = preferences.get(),
        [source, selected] = (args.exportKey ?? 'operation').split(':')
      if (source !== 'operation' && source !== 'import')
        throw new Error('Unknown SKCC report source')
      const report =
        source === 'import'
          ? audit.report()
          : analyzeAwards(args.qsos, getRoster(), {
              scope: 'selected',
              myNumber: p.myNumber,
              month: p.month || undefined,
              bragBonusNumber: p.bragBonusNumber,
            })
      if (!report || (source === 'import' && audit.get()?.member !== memberNumber(p.myNumber)))
        throw new Error(
          'Reanalyze the complete ADIF history for this operator before exporting its application worksheets.',
        )
      const award = AWARD_IDS.includes(selected as AwardId) ? (selected as AwardId) : undefined
      if (['skcc-award-csv', 'skcc-award-text'].includes(type.exportType) && !award)
        throw new Error('Select an SKCC award for this worksheet')
      let content: string
      if (type.exportType === 'skcc-award-audit') content = auditCsv(report)
      else if (type.exportType === 'skcc-award-summary') content = reportMarkdown(report)
      else if (award)
        content =
          type.exportType === 'skcc-award-text'
            ? applicationText(report, award)
            : applicationCsv(report, award)
      else throw new Error('Select an SKCC award for this worksheet')
      return {
        filename: `SKCC-${source}-${award ?? (type.format === 'csv' ? 'audit' : 'summary')}.${type.format}`,
        mimeType: type.format === 'csv' ? 'text/csv' : 'text/plain',
        content,
      }
    },
  }
}
