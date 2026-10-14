import { renderTemplate, templateContext } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { receivedGroup, resolveSent, sentGroup, validGroup } from '../src/exchange.ts'
import { KEYER_EXCHANGE_TEMPLATE, KEYER_GROUP_TEMPLATE } from '../src/keyer.ts'
import { operationGroups, position, type Qson, REF_TYPE } from '../src/model.ts'
import { parseTxList } from '../src/tx-list.ts'

const groups = ['0A9ZO', 'XYZAB', 'O01QT']
function operation(extra: Qson = {}): Qson {
  return { refs: [{ type: REF_TYPE, txGroups: [...groups], alphabet: 'alphanumeric', ...extra }] }
}
function qso(extra: Qson = {}, our: Qson = {}): Qson {
  return {
    their: { call: 'K1TEST' },
    our: { sent: '599', ...our },
    refs: [{ type: REF_TYPE, ...extra }],
  }
}
function key(template: string, op: Qson, contact: Qson): string {
  return renderTemplate(template, templateContext({ operation: op, qso: contact, nowMillis: 1 }))
}
const organizerList = `Dear K1TEST,
Please find below and attached a Tx List of
[3] registered code groups that you requested for transmitting in the RandomGram event.
Call: K1TEST
Team: ---
Event: RG#999 on Sat Jan 2nd @ 22:00 UTC (24-hrs)
File: TXList_K1TEST_202601011200.txt

TX List for K1TEST:

0A9ZO
XYZAB
O01QT
-end-

Please use these groups for the indicated event.`

describe('issued TX list import', () => {
  it('reads marked organizer text without treating instruction words as groups', () => {
    expect(parseTxList(organizerList)).toEqual({
      groups,
      call: 'K1TEST',
      event: 'RG#999',
      declaredCount: 3,
    })
  })

  it.each(['\n', '\r\n', '\r'])(
    'accepts %j newlines and lowercase text without changing digits',
    (newline) => {
      expect(parseTxList(organizerList.toLowerCase().replace(/\n/g, newline)).groups).toEqual(
        groups,
      )
    },
  )

  it('accepts the bare groups as whitespace-separated strings', () => {
    expect(parseTxList(' 0a9zo\txyzab\nO01QT ')).toEqual({ groups })
  })

  it.each([
    ['', 'No code groups'],
    ['0A9ZO, XYZAB', 'Invalid code group'],
    ['0A9ZO\n0a9zo', 'duplicate'],
    ['0A9Z', 'five letters or digits'],
    ['0A9ZO instructions XYZAB', 'Invalid code group'],
    [organizerList.replace('-end-', ''), 'incomplete'],
    [organizerList.replace('[3]', '[4]'), 'declares 4'],
    [organizerList.replace('[3]', '[0]'), 'invalid declared'],
    [organizerList.replace('Call: K1TEST', 'Call: K2TEST'), 'callsign'],
    [organizerList.replace('TX List for K1TEST:', 'TX List for K1TEST'), 'heading'],
    [`${organizerList}\nTX List for K2TEST:\nABCDE\n-end-`, 'one issued'],
    [organizerList.replace('XYZAB', 'XYZ@B'), 'Invalid code group'],
  ])('rejects malformed input with no partial usable list', (source, reason) => {
    const result = parseTxList(source)
    expect(result.groups).toEqual([])
    expect(result.error).toContain(reason)
  })
})

describe('list position and literal exchanges', () => {
  it.each([1, '1', '001', ' 2 ', 9007199254740991])(
    'accepts a positive safe whole item %j',
    (value) => {
      expect(position(value)).toBe(Number(String(value).trim()))
    },
  )
  it.each([undefined, null, '', ' ', '0', 0, -1, '1.5', 1.5, '1e2', '1x', 9007199254740992])(
    'rejects invalid item %j',
    (value) => {
      expect(position(value)).toBeUndefined()
    },
  )

  it('selects the exact issued group, retaining zero and O as distinct characters', () => {
    expect(resolveSent(operation(), qso({ ourSerial: '001' }))).toEqual({
      state: 'ready',
      group: '0A9ZO',
      position: 1,
      source: 'list',
    })
    expect(sentGroup(operation(), qso({ ourSerial: 3 }))).toBe('O01QT')
  })

  it('does not consume a group or mutate input when read repeatedly', () => {
    const op = operation()
    const contact = qso({ ourSerial: 1 })
    const before = JSON.stringify({ op, contact })
    expect(sentGroup(op, contact)).toBe(sentGroup(op, contact))
    expect(JSON.stringify({ op, contact })).toBe(before)
    expect(operationGroups(op)).toEqual(groups)
  })

  it('uses an explicit correction before the recorded snapshot', () => {
    expect(
      resolveSent(operation(), qso({ ourSerial: 1, ourGroup: 'ABCDE' }, { exchange: 'VWXYZ' })),
    ).toMatchObject({
      group: 'ABCDE',
      source: 'override',
    })
  })

  it('retains a recorded exchange after changing or removing the issued list', () => {
    const saved = { ...qso({ ourSerial: 1 }, { exchange: '0A9ZO' }), uuid: 'saved-contact' }
    expect(resolveSent(operation({ txGroups: ['ABCDE'] }), saved)).toMatchObject({
      group: '0A9ZO',
      source: 'saved',
    })
    expect(sentGroup({ refs: [] }, saved)).toBe('0A9ZO')
    expect(sentGroup(operation({ alphabet: 'letters' }), saved)).toBe('0A9ZO')
  })

  it('uses a literal snapshot even when the bridge does not include its UUID', () => {
    expect(resolveSent(operation(), qso({ ourSerial: 2 }, { exchange: '0A9ZO' }))).toMatchObject({
      group: '0A9ZO',
      source: 'saved',
    })
  })

  it('a blank correction restores automatic selection; an invalid nonblank correction blocks it', () => {
    expect(sentGroup(operation(), qso({ ourSerial: 1, ourGroup: '  ' }))).toBe('0A9ZO')
    expect(resolveSent(operation(), qso({ ourSerial: 1, ourGroup: 'AB@DE' })).state).toBe('invalid')
  })

  it('distinguishes missing configuration, allocation, invalid position, and exhaustion', () => {
    expect(resolveSent({ refs: [] }, qso()).state).toBe('unconfigured')
    expect(resolveSent(operation(), qso()).state).toBe('pending')
    expect(resolveSent(operation(), qso({ ourSerial: 0 })).state).toBe('invalid')
    expect(resolveSent(operation(), qso({ ourSerial: 4 }))).toMatchObject({
      state: 'exhausted',
      group: '',
      position: 4,
    })
  })

  it('validates the selected event alphabet without replacing digits', () => {
    expect(validGroup('0A9ZO')).toBe(true)
    expect(validGroup('0A9ZO', 'letters')).toBe(false)
    expect(validGroup('XYZAB', 'letters')).toBe(true)
    expect(validGroup('xyzab')).toBe(false)
    expect(sentGroup(operation({ alphabet: 'letters' }), qso({ ourSerial: 1 }))).toBe('')
    expect(sentGroup(operation({ alphabet: 'letters' }), qso({ ourSerial: 2 }))).toBe('XYZAB')
  })

  it('preserves received text and explicit clearing over a saved fallback', () => {
    const received = { ...qso({ theirGroup: '0O1ZA' }), their: { exchange: 'ABCDE' } }
    expect(receivedGroup(received)).toBe('0O1ZA')
    expect(receivedGroup({ ...received, refs: [{ type: REF_TYPE, theirGroup: '' }] })).toBe('')
    expect(receivedGroup({ ...received, refs: [{ type: REF_TYPE }] })).toBe('ABCDE')
    expect(receivedGroup(qso({ theirGroup: 'AB?DE' }))).toBe('AB?DE')
  })
})

describe('CW message uses the same literal exchange', () => {
  it.each([
    [{ ourSerial: 1 }, {}, {}],
    [{ ourSerial: '003' }, {}, {}],
    [{ ourSerial: 1, ourGroup: 'O00AZ' }, {}, {}],
    [{ ourSerial: 2, ourGroup: '  ' }, { exchange: '0A9ZO' }, {}],
    [{ ourSerial: 2, ourGroup: 'VWXYZ' }, { exchange: '0A9ZO' }, {}],
    [{ ourSerial: 1 }, { exchange: 'O01QT' }, { txGroups: ['ABCDE'] }],
    [{ ourSerial: 2 }, {}, { alphabet: 'letters' }],
    [{ ourSerial: 1 }, { exchange: '0A9ZO' }, { alphabet: 'letters' }],
    [{ ourSerial: 1 }, {}, { txGroups: ['ABCDE', 123] }],
  ] satisfies [Qson, Qson, Qson][])(
    'keys exactly what the resolver displays',
    (ref, our, opRef) => {
      const op = operation(opRef)
      const contact = qso(ref, our)
      const group = sentGroup(op, contact)
      expect(key(KEYER_GROUP_TEMPLATE, op, contact)).toBe(group)
      expect(key(KEYER_EXCHANGE_TEMPLATE, op, contact)).toBe(`5NN ${group}`)
    },
  )

  it.each([
    [{}, {}],
    [{ ourSerial: '' }, {}],
    [{ ourSerial: 0 }, {}],
    [{ ourSerial: -1 }, {}],
    [{ ourSerial: '1.5' }, {}],
    [{ ourSerial: '1x' }, {}],
    [{ ourSerial: '1e1' }, {}],
    [{ ourSerial: 4 }, {}],
    [{ ourSerial: 1, ourGroup: 'AB@DE' }, {}],
    [{ ourSerial: 1 }, { alphabet: 'letters' }],
    [{ ourSerial: 1 }, { txGroups: [] }],
    [{ ourSerial: 1 }, { txGroups: ['AB@DE'] }],
  ] satisfies [Qson, Qson][])('keys nothing, including no RST, when unavailable', (ref, opRef) => {
    const op = operation(opRef)
    const contact = qso(ref)
    expect(sentGroup(op, contact)).toBe('')
    expect(key(KEYER_EXCHANGE_TEMPLATE, op, contact)).toBe('')
  })

  it.each<[Qson, Qson, string]>([
    [operation(), qso({ ourSerial: 1, ourGroup: ['ABCDE'] }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1, ourGroup: ['A', 'B', 'C', 'D', 'E'] }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1, ourGroup: { group: 'ABCDE' } }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1, ourGroup: 12345 }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1 }, { exchange: ['ABCDE'] }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1 }, { exchange: { group: 'ABCDE' } }), '0A9ZO'],
    [operation(), qso({ ourSerial: 1 }, { exchange: 12345 }), '0A9ZO'],
    [operation({ txGroups: [['ABCDE']] }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: [['A', 'B', 'C', 'D', 'E']] }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: [{ group: 'ABCDE' }] }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: [12345] }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: [12345, 'XYZAB'] }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: [12345, 'XYZAB'] }), qso({ ourSerial: 2 }), 'XYZAB'],
    [operation({ txGroups: [['ABCDE'], 'XYZAB'] }), qso({ ourSerial: 2 }), 'XYZAB'],
    [operation({ txGroups: { '0': 'ABCDE' } }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: 'ABCDE' }), qso({ ourSerial: 1 }), ''],
    [operation({ txGroups: 12345 }), qso({ ourSerial: 1 }), ''],
    [operation(), qso({ ourSerial: ['1'] }), ''],
    [operation(), qso({ ourSerial: [1] }), ''],
    [operation(), qso({ ourSerial: { item: 1 } }), ''],
    [operation(), qso({ ourSerial: true }), ''],
    [operation(), qso({ ourSerial: 1, ourGroup: '12345' }), '12345'],
    [operation(), qso({ ourSerial: 1 }, { exchange: '12345' }), '12345'],
    [{ refs: { type: REF_TYPE, txGroups: groups } }, qso({ ourSerial: 1 }), ''],
    [operation(), { ...qso(), refs: { type: REF_TYPE, ourSerial: 1, ourGroup: 'ABCDE' } }, ''],
    [operation(), { ...qso(), refs: [{ type: [REF_TYPE], ourSerial: 1, ourGroup: 'ABCDE' }] }, ''],
    [{ refs: [{ type: [REF_TYPE], txGroups: groups }] }, qso({ ourSerial: 1 }), ''],
    [
      operation(),
      {
        ...qso(),
        refs: [
          { type: [REF_TYPE], ourGroup: 'ABCDE' },
          { type: REF_TYPE, ourSerial: 1 },
        ],
      },
      '0A9ZO',
    ],
  ])(
    'retains display/keyer parity for malformed JSON without converting containers into groups',
    (op, contact, expected) => {
      expect(sentGroup(op, contact)).toBe(expected)
      expect(key(KEYER_GROUP_TEMPLATE, op, contact)).toBe(expected)
      expect(key(KEYER_EXCHANGE_TEMPLATE, op, contact)).toBe(expected ? `5NN ${expected}` : '')
    },
  )
})
