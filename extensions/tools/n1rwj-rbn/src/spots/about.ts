import type { FormDefinition } from '@ham2k/extension-sdk'

export function rbnAboutDefinition(): FormDefinition {
  return {
    title: 'About RBN',
    elements: [
      { type: 'divider', title: 'My Signal — Who hears me' },
      {
        type: 'markdown',
        text: 'The My Signal map and receiver reports show who hears your station. Configure them with the tune button beside the My Signal panel title in your operation. The Spots filters never affect My Signal.',
      },
      { type: 'divider', title: 'Exports' },
      {
        type: 'markdown',
        text: 'The HTML reception report includes maps, timelines, and contact context. By default it is the only RBN export. Select any additional export files in preferences, then reopen the operation’s Exports view to refresh the list. These choices apply across operations.',
      },
      { type: 'divider', title: 'Spots — Who I might hear' },
      {
        type: 'markdown',
        text: 'All Spots settings apply across operations. Changes apply on the next Spots refresh. Reports cover the last ten minutes on 160–10m, including WARC bands. Choose All calls to compare with an unfiltered RBN website view. Busy receivers or bands may exceed the bounded snapshot.',
      },
      {
        type: 'markdown',
        text: 'Reset defaults: allow merging; All calls; All modes; no CW speed limits; all skimmers and grid regions; no distance limit or origin grid. Receiver-continent defaults use the local suggestion, then your last nonempty selection. Resetting Spots preserves export-file preferences and My Signal settings.',
      },
      { type: 'divider', title: 'CW speed range' },
      {
        type: 'markdown',
        text: 'Leave either end blank for an open-ended range. Limits include the entered speeds and apply only to CW, including in All mode. CW reports without a known positive speed are excluded while a limit is set.',
      },
      { type: 'divider', title: 'Receivers and distance' },
      {
        type: 'markdown',
        text: 'Nearby receivers can help you find stations to try; reception at your station is not guaranteed. Every enabled receiver filter must match. Distance is approximate, measured between grid centers. Refresh the RBN receiver directory in Data Files to load continents and updated grids.',
      },
      {
        type: 'markdown',
        text: 'Bare receiver IDs use directory metadata only when their nodes agree. Conflicting node grids are excluded from grid-region and distance filters. Receivers with no known continent are excluded when continents are selected; receivers with no known grid are excluded when a grid region or distance limit is set.',
      },
      { type: 'link', label: 'Reverse Beacon Network', url: 'https://www.reversebeacon.net/' },
      { type: 'link', label: 'Reports provided by Vail ReRBN', url: 'https://vailrerbn.com/' },
    ],
  }
}
