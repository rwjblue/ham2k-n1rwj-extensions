// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type DynamicSettingsPanel, type FormElement, host } from '@ham2k/extension-sdk'
import { skccAboutDefinition } from './about.ts'
import { analyzeAdif, reportMarkdown } from './applications.ts'
import type { AuditStore } from './audit-store.ts'
import { KEY, memberNumber, type RosterGetter, text } from './model.ts'
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
          sidebar: false,
          dataFilesSection: true,
        },
      ]
    },
    async getDefinition() {
      await preferences.load()
      const p = preferences.get(),
        roster = getRoster()
      const fields: FormElement[] = [
        { type: 'header', style: 'section', key: 'skcc-exchange', title: 'Your usual exchange' },
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
        { type: 'header', style: 'section', key: 'skcc-companion', title: 'Companion panel' },
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
        {
          type: 'header',
          style: 'section',
          key: 'skcc-history',
          title: 'History and award applications',
          collapsed: true,
        },
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
          type: 'header',
          style: 'section',
          key: 'skcc-offline',
          title: 'Offline membership data',
          collapsed: true,
        },
        {
          type: 'markdown',
          text: roster
            ? `${roster.members.length.toLocaleString()} roster entries. Last downloaded ${new Date(roster.downloadedAt).toISOString()}. Manage **SKCC member roster** in Data Files.`
            : 'Download **SKCC member roster** in Data Files.',
        },
        {
          type: 'header',
          style: 'section',
          key: 'skcc-chasing',
          title: 'Experimental native chasing',
          collapsed: true,
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'rebuildChecklists',
          label: 'Reload the native chasing roster (either toggle direction)',
          description: 'Requires EXP CHASE. See About SKCC Companion for the rebuild steps.',
          value: p.rebuildChecklists,
          restartOnChange: true,
        },
        {
          type: 'sectionEnd',
        },
        {
          type: 'action',
          style: 'row',
          key: 'about',
          label: 'About SKCC Companion',
          method: 'showAbout',
          icon: 'information-outline',
        },
      ]
      return { title: 'SKCC Companion', elements: fields }
    },
    async showAbout() {
      await deps.showForm(skccAboutDefinition())
      return null
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
