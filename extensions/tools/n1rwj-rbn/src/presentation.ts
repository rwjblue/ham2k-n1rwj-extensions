import type { UiModel } from '../../../../packages/reception/src/ui/types.ts'
export const rbnPresentation: NonNullable<UiModel['presentation']> = {
  source: 'RBN via Vail',
  stationLabel: 'Receiver',
  refreshLabel: 'Refresh receiver reports (bypasses local cooldown)',
  cwSpeed: true,
}

export const rbnDetailsSections: NonNullable<UiModel['details']>['sections'] = [
  {
    title: 'Reading the reports',
    paragraphs: [
      'CW, RTTY, FT8, and FT4 reports come from the Reverse Beacon Network via Vail ReRBN. Rows keep the latest report for one receiver, band, and mode; the map shows each located receiver once.',
      'Reports are observations, not contacts. An empty result does not prove your signal cannot be heard. SNR is measured at each receiver; antennas and noise levels differ.',
    ],
  },
  {
    title: 'Map and location',
    paragraphs: [
      'Paths show reported reception, not a coverage boundary. Locations and countries use the cached RBN receiver directory, falling back to HamDB registered grids from Vail ReRBN. Distances and bearings are estimates; unlocated receivers remain in the list.',
      'Changing the watched callsign does not move the map origin. Set a matching origin grid in panel settings when observing another station. Refresh the receiver directory in Data Files settings.',
    ],
  },
  {
    title: 'Refresh behavior',
    paragraphs: [
      'Automatic checks run at most once a minute while visible. Manual refresh bypasses the local cooldown; offline state and server limits still apply. HTTP 429 pauses are shared with other My Signal panels and RBN Spots.',
      'Pending requests keep cached reports, share repeated refreshes, and check for completion each second while visible. A duration marked “up to” includes time until the next panel render observed completion.',
      'Last successful check is snapshot retrieval time; latest report is when the signal was heard, relative to the shown age reference. A recent check can return older reports or no reports.',
    ],
  },
]
