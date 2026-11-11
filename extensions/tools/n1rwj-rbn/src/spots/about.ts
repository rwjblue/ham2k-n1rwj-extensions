import type { FormDefinition } from '@ham2k/extension-sdk'

export function rbnAboutDefinition(): FormDefinition {
  return {
    title: 'About RBN',
    elements: [
      { type: 'divider', title: 'Live updates' },
      {
        type: 'markdown',
        text: 'Spots and My Signal read live skimmer spots from your selected DX cluster node. RBN uses the same skimmer setup as Cluster Spots, including resetting saved spot filters for your login on supported nodes. Vail ReRBN supplies the initial Spots snapshot, fallback when the feed is unavailable, and My Signal history.',
      },
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
        text: 'All RBN Spots settings apply across operations. Changes apply on the next Spots refresh. Reports cover the last ten minutes on 160–10m, including WARC bands. Use the Spots page filters to narrow the display by band, mode, age, or source. Busy receivers or bands may exceed the bounded snapshot.',
      },
      {
        type: 'markdown',
        text: 'Resetting Spots allows merging and restores all modes, CW speeds, skimmers, and grid regions. It clears the distance limit and origin grid. Receiver-continent defaults use the local suggestion, then your last nonempty selection. Resetting Spots preserves export-file preferences and My Signal settings.',
      },
      { type: 'divider', title: 'CW speed range' },
      {
        type: 'markdown',
        text: 'Leave either end blank for an open-ended range. Limits include the entered speeds and apply only to CW, including in All mode. Live cluster spots without a measured speed can still appear. Vail reports need a known speed to pass an active range.',
      },
      { type: 'divider', title: 'Receivers and distance' },
      {
        type: 'markdown',
        text: 'The dB value is the signal-to-noise ratio measured at the skimmer. RX shows the approximate distance from your origin grid to that receiver in HaLo’s distance units. With an origin grid, Spots prefers the closest qualifying receiver in the last ten minutes. The newest report wins when distances tie or none are known.',
      },
      {
        type: 'markdown',
        text: 'Nearby receivers can help you find stations to try; reception at your station is not guaranteed. Every enabled receiver filter must match. Distance is approximate, measured between grid centers. Refresh the RBN receiver directory in Data Files to load continents and updated grids.',
      },
      {
        type: 'markdown',
        text: 'Bare receiver IDs use directory metadata only when their nodes agree. Conflicting node grids are excluded from grid-region and distance filters. Receivers with no known continent are excluded when continents are selected; receivers with no known grid are excluded when a grid region or distance limit is set.',
      },
      { type: 'link', label: 'Reverse Beacon Network', url: 'https://www.reversebeacon.net/' },
      { type: 'link', label: 'Vail ReRBN', url: 'https://vailrerbn.com/' },
    ],
  }
}
