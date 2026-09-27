import type { Qson } from '../../../../packages/mini-contest/src/model.ts'

export const ctx = { online: false }
export const operation: Qson = {
  uuid: 'wrt-operation',
  stationCall: 'N1RWJ',
  refs: [{ type: 'wrt', ref: '2026-10-02-0145', ourName: 'ROB', ourLocation: 'RI', power: 'LP' }],
}
export function contact(call = 'K1ABC', band = '20m', qth = 'MA', mode = 'RTTY'): Qson {
  return {
    uuid: `${call}-${band}-${mode}`,
    their: { call },
    band,
    mode,
    freq: 14085,
    startAtMillis: Date.parse('2026-10-02T01:50:00Z'),
    refs: [{ type: 'wrt', name: 'BOB', location: qth }],
  }
}
