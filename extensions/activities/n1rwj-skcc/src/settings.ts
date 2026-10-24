// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type DynamicSettingsPanel, type FormElement, host } from '@ham2k/extension-sdk'
import { analyzeAdif, reportMarkdown } from './applications.ts'
import type { AuditStore } from './audit-store.ts'
import { HOME, KEY, memberNumber, type RosterGetter, text } from './model.ts'
import { DEFAULTS, KEY_OPTIONS, type PreferencesStore, validMonth } from './preferences.ts'

export function createSettings(
  preferences: PreferencesStore,
  getRoster: RosterGetter,
  audit: AuditStore,
  deps: Pick<typeof host, 'showForm'> = host,
) {
  const hook = {
    kind: 'dynamic',
    async getPanels() {
      return [
        {
          key: KEY,
          title: 'SKCC Companion',
          icon: 'key',
          section: 'activities',
          dataFilesSection: true,
        },
      ]
    },
    async getDefinition() {
      await preferences.load()
      const p = preferences.get(),
        roster = getRoster()
      const fields: FormElement[] = [
        {
          type: 'markdown',
          text: 'Recognize members, log the exchange, find friendly CW contacts and follow your SKCC goals. Suggestions remain editable. Only recorded exchanges and approved keying qualify for award reports.',
        },
        { type: 'header', title: 'Your usual exchange' },
        {
          type: 'field',
          fieldType: 'text',
          key: 'myNumber',
          label: 'Your awarded SKCC number / suffix',
          value: p.myNumber,
          uppercase: true,
          placeholder: '12345T',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'myName',
          label: 'Your on-air name',
          value: p.myName,
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'mySpc',
          label: 'Your usual state / province / country',
          value: p.mySpc,
          uppercase: true,
          description: 'Change the operation exchange when portable or remote.',
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'myKey',
          label: 'Your usual key',
          value: p.myKey,
          options: KEY_OPTIONS,
        },
        { type: 'header', title: 'Companion panel' },
        {
          type: 'field',
          fieldType: 'number',
          key: 'maxWpm',
          label: 'Maximum reported CW speed (0 = all)',
          value: p.maxWpm,
          description: 'Applies to the SKCC companion list. RBN has its own source filters.',
        },
        {
          type: 'field',
          fieldType: 'number',
          key: 'spotAgeMinutes',
          label: 'Maximum spot age in minutes',
          value: p.spotAgeMinutes,
        },
        {
          type: 'field',
          fieldType: 'number',
          key: 'personalTarget',
          label: 'Personal distinct-member target this operation',
          value: p.personalTarget,
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'month',
          label: 'Award report month (blank = current UTC month)',
          value: p.month,
          placeholder: '2026-10',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'bragBonusNumber',
          label: 'Published bonus member for the selected Brag month',
          value: p.bragBonusNumber,
          description:
            'Verify the number on the official Monthly Brag page. Adding a bonus pins an automatic month to the current UTC month. Changing months clears the bonus.',
        },
        { type: 'header', title: 'History and award applications' },
        {
          type: 'action',
          key: 'analyze',
          label: 'Analyze a complete SKCC ADIF log',
          method: 'analyzeHistory',
          icon: 'file-document-outline',
        },
        {
          type: 'action',
          key: 'clear',
          label: 'Clear the imported history snapshot',
          method: 'clearHistory',
        },
        {
          type: 'markdown',
          text: 'The panel distinguishes this operation from a dated imported-history snapshot. Importing here analyzes a copy; it does not insert contacts into the logger. Use the SKCC audit and application exports while this analysis is loaded. Native Chasing checklists use Ham2K’s own log.',
        },
        { type: 'header', title: 'Offline membership data' },
        {
          type: 'markdown',
          text: roster
            ? `${roster.members.length.toLocaleString()} roster entries. Last downloaded ${new Date(roster.downloadedAt).toISOString()}. Refresh or remove **SKCC member roster** in the host’s Data Files controls.`
            : 'Download **SKCC member roster** in the host’s Data Files controls. Names, member lookup and award evaluation then work offline.',
        },
        { type: 'header', title: 'Experimental native chasing' },
        {
          type: 'markdown',
          text: 'Native award checklists require a host with EXP CHASE enabled. After refreshing the membership roster, reload the extension below, then turn EXP CHASE off and back on on a device holding the complete log. That asks the host to recalculate historical eligibility. A reload alone does not rebuild an unchanged program version. The companion reports always use the currently loaded roster.',
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'rebuildChecklists',
          label: 'Reload the native chasing roster (either toggle direction)',
          value: p.rebuildChecklists,
          restartOnChange: true,
        },
        { type: 'header', title: 'About SKCC Companion' },
        {
          type: 'markdown',
          text: 'Personal N1RWJ extension, not an official SKCC product. SKCCLogger and SKCC Skimmer remain useful companions. Award thresholds mean ready for review, not sponsor approval. SKS is unassisted: close native spots, chasing, RBN and sked assistance when operating it.',
        },
        { type: 'link', label: 'SKCC home and award rules', url: HOME },
        {
          type: 'link',
          label: 'Monthly Brag and bonus member',
          url: `${HOME}operating_activities/monthly_brag/`,
        },
        { type: 'link', label: 'SKCC Sked Page', url: 'https://sked.skccgroup.com/' },
        { type: 'link', label: 'Manual-key policy', url: `${HOME}keypolicy.php` },
      ]
      return { title: 'SKCC Companion', elements: fields }
    },
    async validateField({ fieldKey, value }) {
      if (['myNumber', 'bragBonusNumber'].includes(fieldKey) && text(value) && !memberNumber(value))
        return 'Enter a member number, optionally followed by C, T or S.'
      if (fieldKey === 'month' && !validMonth(text(value)))
        return 'Use YYYY-MM, or leave blank for the current UTC month.'
      const bounds: Record<string, [number, number]> = {
        maxWpm: [0, 80],
        spotAgeMinutes: [1, 60],
        personalTarget: [1, 1000],
      }
      const range = bounds[fieldKey]
      if (
        range &&
        (!Number.isInteger(Number(value)) || Number(value) < range[0] || Number(value) > range[1])
      )
        return `Enter a whole number from ${range[0]} through ${range[1]}.`
      return null
    },
    async onChangeField({ fieldKey, value }) {
      if (!Object.keys(DEFAULTS).includes(fieldKey)) throw new Error('Unknown SKCC setting')
      await preferences.load()
      if (fieldKey === 'bragBonusNumber' && text(value) && !preferences.get().month)
        await preferences.set('month', new Date().toISOString().slice(0, 7))
      await preferences.set(fieldKey, value)
      if (fieldKey === 'month') await preferences.set('bragBonusNumber', '')
    },
    async analyzeHistory() {
      await preferences.load()
      const p = preferences.get()
      if (!getRoster()) return 'Download the SKCC member roster before analyzing history.'
      if (!memberNumber(p.myNumber))
        return 'Set your SKCC number first so the report belongs to the correct operator.'
      const form = await deps.showForm({
        title: 'Analyze SKCC history',
        elements: [
          {
            type: 'markdown',
            text: 'Paste an ADIF export containing your complete SKCC history. The file stays on this device. Existing contacts and native chasing claims are not modified.',
          },
          {
            type: 'field',
            fieldType: 'text',
            key: 'source',
            label: 'Source label',
            value: 'Complete SKCC ADIF export',
          },
          {
            type: 'field',
            fieldType: 'multiline',
            key: 'adif',
            label: 'ADIF text',
            placeholder: '<CALL:5>... <SKCC:5>... <EOR>',
          },
          {
            type: 'field',
            fieldType: 'checkbox',
            key: 'complete',
            label: 'This export contains my complete SKCC history',
            value: false,
          },
          {
            type: 'field',
            fieldType: 'checkbox',
            key: 'attest',
            label:
              'For SKCC-tagged CW records without keying evidence: I confirm both names/numbers were exchanged and both stations used approved keying',
            value: false,
          },
        ],
      })
      if (!form) return 'Analysis cancelled.'
      const adif = typeof form.adif === 'string' ? form.adif : ''
      if (adif.length > 5_000_000) return 'Use an ADIF export no larger than 5 MB.'
      if (!form.complete)
        return 'A complete-history snapshot needs the explicit complete-history selection. No saved snapshot changed.'
      try {
        const report = analyzeAdif(adif, getRoster(), {
          myNumber: p.myNumber,
          month: p.month || undefined,
          bragBonusNumber: p.bragBonusNumber || undefined,
          scope: 'complete-history',
          attestImportedEligibility: form.attest === true,
        })
        let message = 'Analysis shown; the previous history snapshot is unchanged.'
        if (report.rows.some((row) => row.eligible) && !report.import?.errors.length) {
          await audit.save(report, p.myNumber, text(form.source))
          message =
            'Imported-history snapshot saved. Review the audit before preparing an award application.'
        }
        await deps.showForm({
          title: 'SKCC history audit',
          elements: [{ type: 'markdown', text: reportMarkdown(report) }],
        })
        return message
      } catch (error) {
        return `History could not be analyzed: ${error instanceof Error ? error.message : 'invalid file'}. The previous snapshot is retained.`
      }
    },
    async clearHistory() {
      const answer = await deps.showForm({
        title: 'Clear SKCC import snapshot',
        elements: [
          {
            type: 'field',
            fieldType: 'checkbox',
            key: 'clear',
            label: 'Remove the imported snapshot from this device; keep every logged contact',
            value: false,
          },
        ],
      })
      if (!answer?.clear) return 'Snapshot retained.'
      await audit.clear()
      return 'Imported snapshot cleared. Logged contacts and native chasing claims are unchanged.'
    },
  } satisfies DynamicSettingsPanel & Record<string, unknown>
  return hook
}
