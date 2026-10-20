import type { BigfootRadioAvailability } from './spot-radio.ts'
import type { BigfootSpotRow } from './spots.ts'

export type HuntSpotView = {
  status: 'ready' | 'empty' | 'unsupported' | 'unavailable'
  rows: BigfootSpotRow[]
  selected?: BigfootSpotRow
  tuneStatus?: string
  listening?: boolean
  radio?: BigfootRadioAvailability
}
