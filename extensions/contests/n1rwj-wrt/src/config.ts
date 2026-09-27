import { type ContestConfig, POWER_CLASSES } from '../../../../packages/mini-contest/src/model.ts'
import { guessedQth, QTH_PATTERN, validQth } from './exchange.ts'

export const config: ContestConfig = {
  type: 'wrt',
  name: 'Weekly RTTY Test',
  shortName: 'WRT',
  // WRT is the sponsor's Cabrillo name; ADIF permits unlisted contest IDs.
  adifId: 'WRT',
  cabrilloId: 'WRT',
  aliases: ['WRT', 'WEEKLY RTTY TEST'],
  rulesUrl: 'https://radiosport.world/wrt.html',
  slots: [{ day: 5, hour: 1, minute: 45 }],
  durationMinutes: 30,
  mode: 'RTTY',
  bands: ['80m', '40m', '20m', '15m', '10m'],
  powerClasses: POWER_CLASSES.filter(({ value }) => value !== 'HP'),
  multiplier: 'callsign',
  exchange: 'name-location',
  locationInput: {
    label: 'State / province / country prefix',
    placeholder: 'RI, ON or DL',
    pattern: QTH_PATTERN,
    maxLength: 10,
    guess: guessedQth,
    valid: validQth,
  },
  guidance:
    'Friday 0145–0215 UTC. Select RTTY as the logging mode. Send your name and state/province for W/VE, or country prefix for DX. Copy the actual exchange; do not substitute DX for a prefix. Each station counts once per band, with each callsign a multiplier once per session. Report QSOs × unique callsigns on 3830 Scores.',
}
