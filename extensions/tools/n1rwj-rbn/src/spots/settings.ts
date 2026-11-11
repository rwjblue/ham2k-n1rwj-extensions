import type { FormActionElement, FormDefinition } from '@ham2k/extension-sdk'
import { type Continent, continents } from '../data/continents.ts'
import { additionalExportChoices, additionalExportFormats } from '../export/preferences.ts'
import type { HealthNotice } from './health.ts'
import { allowSpotMerging, radiusIssue, speedIssue, spotModes, tokens } from './preferences.ts'

function reset(method: string, label: string): FormActionElement {
  return { type: 'action', key: method, method, label, icon: 'restore' }
}

export function settingsDefinition(
  raw: Record<string, unknown>,
  defaultContinents: Continent[],
  status: string,
  health: HealthNotice | null = null,
): FormDefinition {
  const continentLabel =
    defaultContinents.map((code) => continents[code]).join(', ') || 'All continents'
  const suffixed = tokens(typeof raw.spotSkimmers === 'string' ? raw.spotSkimmers : '').filter(
    (call) => /-\d+$/.test(call),
  )
  const notice = radiusIssue(raw) || speedIssue(raw) || status
  return {
    elements: [
      ...(health
        ? [{ type: 'markdown' as const, text: `> **${health.title}**\n>\n> ${health.message}` }]
        : []),
      {
        type: 'header',
        style: 'section',
        key: 'rbn-exports',
        collapsed: true,
        title: 'Exports',
      },
      {
        type: 'field',
        fieldType: 'multiselect',
        key: 'additionalExportFormats',
        label: 'Additional export files',
        description:
          'Optional companion files for the HTML report. Reopen the operation’s Exports view after changing this selection.',
        value: additionalExportFormats(raw),
        options: additionalExportChoices,
        defaultValue: [],
      },
      {
        type: 'header',
        style: 'section',
        key: 'rbn-spots',
        title: 'Spots — Who I might hear',
      },
      reset('resetAllSpotSettings', 'Reset all spot settings'),
      {
        type: 'field',
        fieldType: 'checkbox',
        key: 'spotAllowMerging',
        label: 'Allow merging of RBN spots',
        description:
          'On by default: nearby spots can merge and no RBN activity control is added. Turn off to keep stations separately selectable, for example during CWT; this adds RBN references and an RBN logging control. Changes apply on the next Spots refresh.',
        value: allowSpotMerging(raw),
      },
      {
        type: 'field',
        fieldType: 'select',
        key: 'spotMode',
        label: 'Spot mode',
        description: 'Default: All. Choose All to filter modes on the Spots page.',
        value: raw.spotMode ?? 'all',
        options: spotModes.map((value) => ({ label: value === 'all' ? 'All' : value, value })),
      },
      reset('resetSpotMode', 'Reset mode — All'),
      { type: 'header', style: 'section', key: 'rbn-speed', title: 'CW speed range' },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotMinWpm',
        label: 'Minimum CW speed (WPM)',
        description: 'Blank means no minimum. Applies only to CW.',
        placeholder: 'No minimum',
        value: raw.spotMinWpm ?? '',
      },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotMaxWpm',
        label: 'Maximum CW speed (WPM)',
        description: 'Blank means no maximum. Applies only to CW.',
        placeholder: 'No maximum',
        value: raw.spotMaxWpm ?? '',
      },
      reset('resetSpotSpeed', 'Reset CW speed range — No limits'),
      { type: 'header', style: 'section', key: 'rbn-receivers', title: 'Receivers' },
      {
        type: 'field',
        fieldType: 'text',
        key: 'spotSkimmers',
        label: 'Only these skimmers',
        description:
          'Default: blank, allowing all skimmers. Separate reported IDs with spaces or commas, e.g. KM3T. Vail currently omits numeric node suffixes; a bare ID includes that receiver family.',
        value: raw.spotSkimmers ?? '',
        uppercase: true,
      },
      reset('resetSpotSkimmers', 'Reset skimmers — All'),
      ...(suffixed.length
        ? [
            {
              type: 'markdown' as const,
              text: `Vail currently reports bare receiver IDs, so ${suffixed.join(', ')} may return no spots. Enter the bare callsign (for example KM3T) to include that receiver family. Individual suffixed nodes cannot be isolated when the feed omits their IDs. Your saved selection has been preserved.`,
            },
          ]
        : []),
      {
        type: 'field',
        fieldType: 'text',
        key: 'spotGrids',
        label: 'Receiver grid regions',
        description:
          'Default: blank, allowing all regions. Separate Maidenhead prefixes with spaces or commas, e.g. FN, EM, JO, FN42.',
        value: raw.spotGrids ?? '',
        uppercase: true,
      },
      reset('resetSpotGrids', 'Reset grid regions — All'),
      {
        type: 'field',
        fieldType: 'multiselect',
        key: 'spotContinents',
        label: 'Receiver continents',
        description: `Reset default: ${continentLabel}. Initially suggests your local continent using nearby receivers when device location is available; otherwise remembers your last selection. No selection explicitly allows all continents. Uses the skimmer location, not the spotted station.`,
        value: raw.spotContinents ?? [],
        options: Object.entries(continents).map(([value, label]) => ({ value, label })),
      },
      reset('resetSpotContinents', `Reset continents — ${continentLabel}`),
      reset('clearSpotContinents', 'Clear continent filter — All continents'),
      { type: 'header', style: 'section', key: 'rbn-distance', title: 'Receiver distance' },
      {
        type: 'field',
        fieldType: 'text',
        key: 'spotRadiusGrid',
        label: 'Distance origin grid',
        description:
          'Default: blank. Your grid for showing approximate receiver distance in Spots and for the optional distance limit. Shared across operations. Update it when you move.',
        placeholder: 'e.g. FN42FK',
        value: raw.spotRadiusGrid ?? '',
        uppercase: true,
      },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotRadiusMiles',
        label: 'Maximum receiver distance (miles)',
        description: 'Default: blank, with no distance limit. Set the origin grid first.',
        value: raw.spotRadiusMiles ?? '',
      },
      reset('resetSpotDistance', 'Reset distance — No limit or origin'),
      { type: 'sectionEnd' },
      ...(notice ? [{ type: 'markdown' as const, text: notice }] : []),
      {
        type: 'action',
        style: 'row',
        key: 'about',
        label: 'About RBN',
        icon: 'information-outline',
        method: 'showAbout',
      },
    ],
  }
}
