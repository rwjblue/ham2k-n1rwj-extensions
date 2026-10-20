import { describe, expect, it } from 'vitest'
import {
  effectiveSent,
  exchangeText,
  normalizeSpc,
  normalizeZombieName,
  received,
  receivedRst,
  sent,
  validExchange,
  validRst,
  validSpc,
  validZombieNumber,
} from '../src/exchange.ts'
import { type Qson, refOf } from '../src/model.ts'

const operation: Qson = {
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      ourSpc: 'ri',
      ourZombieNumber: '001027',
      ourZombieName: 'Count  von Boo',
    },
  ],
}

describe('Zombie exchange', () => {
  it('keeps lifetime identifiers as text and spooky names as full names', () => {
    const exchange = sent(operation)
    expect(exchange).toEqual({ spc: 'RI', zombieNumber: '001027', zombieName: 'Count von Boo' })
    expect(exchangeText(exchange, '569')).toBe('569 RI 001027 Count von Boo')
    expect(normalizeSpc('  New Zealand ')).toBe('NEW ZEALAND')
    expect(normalizeZombieName("  Jack  O'Lantern ")).toBe("Jack O'Lantern")
    expect(validSpc('ST. PIERRE & MIQUELON')).toBe(true)
    expect(validZombieNumber('0201')).toBe(true)
    expect(validZombieNumber('0')).toBe(false)
    expect(validZombieNumber('1.5')).toBe(false)
    expect(validZombieNumber('999999999999999999999')).toBe(false)
  })

  it('reads only the event exchange, including explicit clearing', () => {
    expect(
      received({ their: { call: 'K1ABC', name: 'John', state: 'MA', zombieNumber: '12' } }),
    ).toEqual({ spc: '', zombieNumber: '', zombieName: '' })
    expect(
      received({
        their: { name: 'John', guess: { name: 'Jane' } },
        refs: [{ type: 'zombie', theirSpc: 'ONT', theirZombieNumber: '0284', theirZombieName: '' }],
      }),
    ).toEqual({ spc: 'ONT', zombieNumber: '0284', zombieName: '' })
  })

  it('sends the current bonus exchange without replacing the regular number', () => {
    const bonus: Qson = { refs: [{ ...refOf(operation), bonusStation: true }] }
    expect(sent(bonus).zombieNumber).toBe('4321')
    expect(sent(operation).zombieNumber).toBe('001027')
  })

  it('preserves saved sent snapshots and deliberate blanks after setup changes', () => {
    const qso: Qson = {
      our: { zombie: { spc: 'TX', zombieNumber: '0037', zombieName: 'Old Ghoul', ref: '2026' } },
    }
    expect(effectiveSent(operation, qso)).toEqual({
      spc: 'TX',
      zombieNumber: '0037',
      zombieName: 'Old Ghoul',
    })
    expect(
      effectiveSent(operation, { our: { zombie: { zombieNumber: '', zombieName: '' } } }),
    ).toEqual({ spc: 'RI', zombieNumber: '', zombieName: '' })
    expect(
      effectiveSent(operation, {
        our: { zombie: { zombieNumber: '' } },
        refs: [{ type: 'zombie', ourSpc: 'CA', ourZombieNumber: '77', ourZombieName: 'Old Name' }],
      }),
    ).toEqual({ spc: 'CA', zombieNumber: '', zombieName: 'Old Name' })
  })

  it('uses native received RST, accepting honest reports and CW cut nines', () => {
    expect(receivedRst({ their: { sent: ' 5nn ' } })).toBe('5NN')
    for (const rst of ['339', '569', '599', '5NN', '599C']) expect(validRst(rst)).toBe(true)
    for (const rst of ['', '59', '699', '509', '599 599']) expect(validRst(rst)).toBe(false)
    expect(validExchange({ spc: 'DX', zombieNumber: '201', zombieName: 'Elvira' })).toBe(true)
    expect(validExchange({ spc: 'DX', zombieNumber: '', zombieName: 'Elvira' })).toBe(false)
  })
})
