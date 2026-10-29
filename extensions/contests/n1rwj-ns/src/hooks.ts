import type { ActivityHook, PanelHook, ScoringHook } from '@ham2k/extension-sdk'
import { contestScorer } from '@ham2k/extension-sdk'
import { createActivity } from '../../../../packages/mini-contest/src/activity.ts'
import { createExports } from '../../../../packages/mini-contest/src/exports.ts'
import type { HistoryFile } from '../../../../packages/mini-contest/src/history.ts'
import { refOf } from '../../../../packages/mini-contest/src/model.ts'
import manifest from '../manifest.json'
import { config } from './config.ts'
import { createGuideStore } from './guide.ts'
import { createNsScorer, operatingMode, qsyAdvice, qsyContact } from './qsy.ts'

export function createNsHooks(file: () => HistoryFile | undefined = () => undefined) {
  const base = createActivity(config, manifest, file)
  const exports = createExports(config, manifest)
  const guide = createGuideStore()
  const scorer = contestScorer(createNsScorer(), { scope: { refTypes: ['ns'] } })
  const scoring: ScoringHook = {
    ...scorer,
    async scoreQsos(args, ctx) {
      base.history.update(args)
      const result = await scorer.scoreQsos(args, ctx)
      guide.accept(args.operation, result.scoresheet)
      return result
    },
  }
  const activity: ActivityHook = {
    ...base.activity,
    async loggingControls(args, ctx) {
      const controls = await base.activity.loggingControls(args, ctx)
      if (!refOf(args.operation, 'ns')) return controls
      const state = await guide.current(args.operation, ctx)
      const advice = qsyAdvice(state, qsyContact(args.qso ?? {}, state.mode))
      const role = refOf(args.qso ?? {}, 'ns')?.role
      if (role !== undefined && advice.kind !== 'editing')
        guide.rememberMode(args.operation, operatingMode(role))
      return [
        ...controls,
        {
          key: `${manifest.key}/role`,
          label: advice.kind === 'required' ? 'Operating mode · QSY reminder' : 'Operating mode',
          shortLabel: advice.kind === 'required' ? 'QSY' : 'Mode',
          icon: manifest.icon,
          color: manifest.accentColor,
          order: 5,
          skipFocus: true,
          input: {
            kind: 'options',
            refType: 'ns',
            field: 'role',
            options: [
              { code: 'CQ', name: 'CQ / I solicited' },
              { code: 'SP', name: 'S&P / I answered' },
              { code: 'UNKNOWN', name: 'Unknown' },
            ],
            allowFreeform: false,
            matchOn: ['code', 'name'],
            suggestedValue: state.mode,
            maxLength: 7,
          },
        },
      ]
    },
  }
  const panel: PanelHook = {
    async getPanels() {
      return [
        {
          key: 'ns-guide',
          title: 'NS Sprint guide',
          icon: manifest.icon,
          description: 'CQ/S&P role, QSY distance and advisory Sprint reminders.',
          on: ['operation', 'qso', 'qsoLogged'],
        },
      ]
    },
    async render({ operation, qso }, ctx) {
      if (!refOf(operation, 'ns'))
        return {
          kind: 'markdown',
          title: 'NS Sprint guide',
          content: 'Add NCCC Sprint CW to this operation to use the Sprint guide.',
        }
      const state = await guide.current(operation, ctx)
      const candidate = qsyContact(qso ?? {}, state.mode)
      const advice = qsyAdvice(state, candidate)
      const mode = { CQ: 'CQ / I solicited', SP: 'S&P / I answered', UNKNOWN: 'Unknown' }[
        candidate.role
      ]
      return {
        kind: 'markdown',
        title: 'NS Sprint guide',
        content: [
          `**Mode: ${mode}**`,
          `**${advice.message}**`,
          state.complete ? '' : 'Some role/frequency history is unavailable. Verify QSY manually.',
          'Reminders are advisory. They never remove points or prevent saving. Change Operating mode to describe who solicited this contact.',
          '**Skimmer / packet assistance is prohibited.** Disable RBN and other external spotting assistance for NS.',
          `[Official NS rules](${config.rulesUrl})`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      }
    },
  }
  return { activity, refHandler: base.refHandler, ...exports, scoring, panel }
}
