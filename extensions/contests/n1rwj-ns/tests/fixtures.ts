import type { Qson } from '../../../../packages/mini-contest/src/model.ts'

export const ctx = { online: false }
export const operation: Qson = {
  uuid: 'ns-operation',
  stationCall: 'N1RWJ',
  refs: [{ type: 'ns', ref: '2026-10-30-0230', ourName: 'ROB', ourLocation: 'RI', power: 'LP' }],
}
export function contact(call = 'K1ABC', band = '20m', qth = 'MA', serial = '42'): Qson {
  return {
    uuid: `${call}-${band}`,
    their: { call },
    band,
    mode: 'CW',
    freq: 14042,
    startAtMillis: Date.parse('2026-10-30T02:40:00Z'),
    refs: [{ type: 'ns', name: 'BOB', location: qth, theirSerial: serial, ourSerial: '7' }],
  }
}
