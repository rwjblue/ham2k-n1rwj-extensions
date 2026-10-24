import { describe, expect, it } from 'vitest'
import {
  getExchange,
  isQualified,
  numberToken,
  ownExchange,
  snapshotBeforeSave,
} from '../src/exchange.ts'

describe('recorded SKCC exchanges', () => {
  it('preserves an operator correction and clearing ahead of saved hints', () => {
    expect(
      getExchange({
        their: { skcc: { number: '123C', name: 'OLD', spc: 'MA' } },
        refs: [{ type: 'skcc', number: '', name: 'NEW' }],
      }),
    ).toMatchObject({ number: '', name: 'NEW', spc: 'MA' })
    expect(numberToken('00123s')).toBe('123S')
    expect(numberToken('none')).toBe('NONE')
    expect(numberToken('not-a-number')).toBe('NOT-A-NUMBER')
  })
  it('distinguishes unknown qualification from explicit confirmation and refusal', () => {
    expect(isQualified(undefined)).toBeUndefined()
    expect(isQualified('')).toBeUndefined()
    expect(isQualified('yes')).toBe(true)
    expect(isQualified('no')).toBe(false)
  })
  it('uses imported own evidence and retains later explicit edits', () => {
    const qso = {
      refs: [{ type: 'skcc', ref: '123', our: { number: '42T', key: 'BUG', qualified: true } }],
      our: { skcc: { key: '', qualified: false } },
    }
    expect(
      ownExchange(qso, { refs: [{ type: 'skcc', ref: 'wes:2026-10', ourNumber: '99' }] }),
    ).toMatchObject({ number: '42T', key: '', qualified: false, event: 'wes:2026-10' })
  })
  it('projects only extension-owned snapshots, without replacing other activity references', () => {
    const patch = snapshotBeforeSave(
      {
        refs: [
          { type: 'pota', ref: 'US-0001' },
          { type: 'skcc', number: '', name: '' },
        ],
        their: { call: 'N1ABC' },
      },
      { refs: [{ type: 'skcc', ref: 'general', ourNumber: '42', ourKey: 'SK' }] },
    )
    expect(patch).toMatchObject({
      their: { exchange: '', skcc: { number: '', name: '', event: 'general' } },
      our: { skcc: { number: '42', key: 'SK' } },
    })
    expect(patch).not.toHaveProperty('refs')
    expect(patch).not.toHaveProperty('their.call')
  })
})
