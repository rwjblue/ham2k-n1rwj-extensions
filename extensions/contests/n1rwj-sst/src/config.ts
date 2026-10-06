import {
  BANDS,
  type DownloadedContestConfig,
  POWER_CLASSES,
} from '../../../../packages/mini-contest/src/model.ts'
import { setupLocationSuggestions } from './locations.ts'

export const config: DownloadedContestConfig = {
  type: 'sst',
  durationMinutes: 60,
  mode: 'CW',
  bands: BANDS,
  powerClasses: POWER_CLASSES,
  multiplier: 'sst-location',
  name: 'K1USN Slow Speed Test',
  shortName: 'SST',
  adifId: 'K1USN-SST',
  cabrilloId: 'K1USNSST',
  aliases: ['SST', 'K1USN', 'K1USN SST', 'SLOW SPEED TEST'],
  rulesUrl: 'https://www.k1usn.com/sst_rules.html',
  slots: [
    { day: 1, hour: 0 },
    { day: 5, hour: 20 },
  ],
  historyPrefix: 'k1usnsst-',
  historyAliases: ['K1USNSST', 'K1USN-SST', 'SST'],
  exchange: 'name-location',
  setupLocationSuggestions,
  guidance:
    'Send your name and state or Canadian province; all other locations, including Alaska and Hawaii, send DX. Maximum speed: 20 WPM. Multipliers are states, provinces and DXCC entities once per band. Each session is separate; report your score on 3830 Scores.',
}
