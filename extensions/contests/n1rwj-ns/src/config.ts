import {
  type DownloadedContestConfig,
  POWER_CLASSES,
} from '../../../../packages/mini-contest/src/model.ts'
import {
  guessedQth,
  historyQth,
  ineligibleReason,
  nsMultiplier,
  QTH_PATTERN,
  validQth,
} from './exchange.ts'

export const config: DownloadedContestConfig = {
  type: 'ns',
  name: 'NCCC Sprint CW',
  shortName: 'NS',
  adifId: 'NCCC-SPRINT',
  cabrilloId: 'NCCC-SPRINT',
  aliases: ['NS', 'NCCC', 'NCCC SPRINT', 'NCCC SPRINT CW', 'NS LADDER', 'SPRINTNS'],
  rulesUrl: 'https://ncccsprint.com/rules.html',
  slots: [{ day: 5, hour: 2, minute: 30 }],
  durationMinutes: 30,
  mode: 'CW',
  bands: ['160m', '80m', '40m', '20m', '15m'],
  powerClasses: POWER_CLASSES.filter(({ value }) => value !== 'HP'),
  multiplier: nsMultiplier,
  ineligibleReason,
  exchange: 'serial-name-location',
  historyUrl: 'https://supercheckhistory.com/downloads/N1MM/NAQP-CW.txt',
  // NS uses a shared name and QTH dataset. The cache can also hold Sprint files
  // whose headers list the events that use them.
  historyAliases: [
    'SPRINTNS',
    'SPRINTLADD',
    'SPRINTCW',
    'SPRINTRTTY',
    'NSRTTYDUPE',
    'NS',
    'NSLADDER',
    'NSRTTY',
    'NAQP',
    'NAQP-CW',
    'NAQPCW',
    'NAQPRTTY',
    'NAQPSSB',
  ],
  historyLocation: historyQth,
  locationInput: {
    label: 'State / province / country / DX',
    placeholder: 'RI, ON, KP4 or DX',
    pattern: QTH_PATTERN,
    maxLength: 10,
    guess: guessedQth,
    valid: validQth,
  },
  guidance:
    'Friday 0230–0300 UTC (Thursday evening in North America), 100 W maximum. Send a sequential QSO number, name and state/province/country; non-North American stations may send DX. Work each station once per band. Score QSOs × the sum of band multipliers. Observe the Sprint 1 kHz QSY rule; Skimmer and packet assistance are prohibited. Each session is separate. Check sponsor announcements for weekly rule variations and report your score on 3830 Scores.',
}
