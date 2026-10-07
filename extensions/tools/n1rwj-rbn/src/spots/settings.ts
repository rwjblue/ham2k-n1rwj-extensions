import type { FormActionElement, FormDefinition } from '@ham2k/extension-sdk'
import { type Continent, continents } from '../data/continents.ts'
import { additionalExportChoices, additionalExportFormats } from '../export/preferences.ts'
import { allCalls, type Provider } from './filters.ts'
import type { HealthNotice } from './health.ts'
import { allowSpotMerging, radiusIssue, speedIssue, spotModes, tokens } from './preferences.ts'

interface Selection {
  raw: Record<string, unknown>
  key: string
  providers: Provider[]
  unavailable: string
  discoveryFailed: boolean
}

function reset(method: string, label: string): FormActionElement {
  return { type: 'action', key: method, method, label, icon: 'restore' }
}

export function settingsDefinition(
  selected: Selection,
  defaultContinents: Continent[],
  status: string,
  health: HealthNotice | null = null,
): FormDefinition {
  const historyLabel = 'All calls'
  const continentLabel =
    defaultContinents.map((code) => continents[code]).join(', ') || 'All continents'
  const choices = [
    { label: 'All calls', value: allCalls },
    ...selected.providers.map((provider) => ({
      label: provider.label + (provider.available ? '' : ' (file unavailable)'),
      value: provider.key,
    })),
  ]
  const suffixed = tokens(
    typeof selected.raw.spotSkimmers === 'string' ? selected.raw.spotSkimmers : '',
  ).filter((call) => /-\d+$/.test(call))
  if (!choices.some((entry) => entry.value === selected.key))
    choices.push({ label: `Unavailable: ${selected.key}`, value: selected.key })
  return {
    elements: [
      ...(health
        ? [{ type: 'markdown' as const, text: `> **${health.title}**\n>\n> ${health.message}` }]
        : []),
      {
        type: 'header',
        style: 'section',
        title: 'My Signal — Who hears me',
      },
      {
        type: 'markdown',
        text: 'The My Signal map and receiver reports show who hears your station. Configure them with the tune button beside the My Signal panel title in your operation. The Spots filters below never affect My Signal.',
      },
      {
        type: 'header',
        style: 'section',
        title: 'Exports',
      },
      {
        type: 'field',
        fieldType: 'multiselect',
        key: 'additionalExportFormats',
        label: 'Additional export files',
        description:
          'The HTML reception report includes maps, timelines, and contact context. By default it is the only RBN export. Select any companion files you need, then reopen the operation’s Exports view to refresh the list. These choices apply across operations.',
        value: additionalExportFormats(selected.raw),
        options: additionalExportChoices,
        defaultValue: [],
      },
      {
        type: 'header',
        style: 'section',
        title: 'Spots — Who I might hear',
      },
      reset('resetAllSpotSettings', 'Reset all spot settings'),
      {
        type: 'markdown',
        text: `Reset defaults: allow merging; ${historyLabel}; All modes; no CW speed limits; all skimmers and grid regions; ${continentLabel}; no distance limit or origin grid. Receiver-continent defaults use the local suggestion, then your last selection. All settings below apply only to RBN Spots, across operations.`,
      },
      {
        type: 'field',
        fieldType: 'checkbox',
        key: 'spotAllowMerging',
        label: 'Allow merging of RBN spots',
        description:
          'On by default: nearby spots can merge and no RBN activity control is added. Turn off to keep stations separately selectable, for example during CWT; this adds RBN references and an RBN logging control. Changes apply on the next Spots refresh.',
        value: allowSpotMerging(selected.raw),
      },
      {
        type: 'field',
        fieldType: 'select',
        key: 'spotCallFilter',
        label: 'Call-history filter',
        description: `Default: ${historyLabel}.`,
        options: choices,
        value: selected.key,
      },
      reset('resetSpotCallFilter', `Reset call-history filter — ${historyLabel}`),
      {
        type: 'field',
        fieldType: 'select',
        key: 'spotMode',
        label: 'Spot mode',
        description: 'Default: All. Choose All to filter modes on the Spots page.',
        value: selected.raw.spotMode ?? 'all',
        options: spotModes.map((value) => ({ label: value === 'all' ? 'All' : value, value })),
      },
      reset('resetSpotMode', 'Reset mode — All'),
      { type: 'header', title: 'CW speed range' },
      {
        type: 'markdown',
        text: 'Default: no speed limit. Leave either end blank for an open-ended range. Limits include the entered speeds and apply only to CW, including in All mode. CW reports without a known positive speed are excluded while a limit is set.',
      },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotMinWpm',
        label: 'Minimum CW speed (WPM)',
        placeholder: 'No minimum',
        value: selected.raw.spotMinWpm ?? '',
      },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotMaxWpm',
        label: 'Maximum CW speed (WPM)',
        placeholder: 'No maximum',
        value: selected.raw.spotMaxWpm ?? '',
      },
      reset('resetSpotSpeed', 'Reset CW speed range — No limits'),
      { type: 'header', title: 'Receivers' },
      {
        type: 'markdown',
        text: 'Nearby receivers can help you find stations to try; reception at your station is not guaranteed. Every enabled receiver filter must match.',
      },
      {
        type: 'field',
        fieldType: 'text',
        key: 'spotSkimmers',
        label: 'Only these skimmers',
        description:
          'Default: blank, allowing all skimmers. Separate reported IDs with spaces or commas, e.g. KM3T. Vail currently omits numeric node suffixes; a bare ID includes that receiver family.',
        value: selected.raw.spotSkimmers ?? '',
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
        value: selected.raw.spotGrids ?? '',
        uppercase: true,
      },
      reset('resetSpotGrids', 'Reset grid regions — All'),
      {
        type: 'field',
        fieldType: 'multiselect',
        key: 'spotContinents',
        label: 'Receiver continents',
        description: `Reset default: ${continentLabel}. Initially suggests your local continent using nearby receivers when device location is available; otherwise remembers your last selection. No selection explicitly allows all continents. Uses the skimmer location, not the spotted station.`,
        value: selected.raw.spotContinents ?? [],
        options: Object.entries(continents).map(([value, label]) => ({ value, label })),
      },
      reset('resetSpotContinents', `Reset continents — ${continentLabel}`),
      reset('clearSpotContinents', 'Clear continent filter — All continents'),
      { type: 'header', title: 'Receiver distance' },
      {
        type: 'field',
        fieldType: 'text',
        key: 'spotRadiusGrid',
        label: 'Distance origin grid',
        description:
          'Default: blank. Your grid for distance filtering, shared across operations. Update it when you move. Reset distance clears both the origin and the limit.',
        placeholder: 'e.g. FN42FK',
        value: selected.raw.spotRadiusGrid ?? '',
        uppercase: true,
      },
      {
        type: 'field',
        fieldType: 'number',
        key: 'spotRadiusMiles',
        label: 'Maximum receiver distance (miles)',
        description: 'Default: blank, with no distance limit. Set the origin grid first.',
        value: selected.raw.spotRadiusMiles ?? '',
      },
      reset('resetSpotDistance', 'Reset distance — No limit or origin'),
      {
        type: 'markdown',
        text: 'Distance is approximate, measured between grid centers. Refresh the RBN receiver directory in Data Files to load continents and updated grids. Bare receiver IDs use directory metadata only when their nodes agree. Conflicting node grids are excluded from grid-region and distance filters. Receivers with no known continent are excluded when continents are selected; receivers with no known grid are excluded when a grid region or distance limit is set.',
      },
      {
        type: 'markdown',
        text:
          selected.unavailable ||
          radiusIssue(selected.raw) ||
          speedIssue(selected.raw) ||
          status ||
          'Reports cover the last ten minutes on 160–10m, including WARC bands. Choose All calls to compare with an unfiltered RBN website view. Busy receivers or bands may exceed the bounded snapshot. Changes apply on the next Spots refresh.',
      },
    ],
  }
}
