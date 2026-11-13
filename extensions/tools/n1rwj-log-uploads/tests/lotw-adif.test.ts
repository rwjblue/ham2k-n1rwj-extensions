import { expect, test } from 'vitest'
import { readTransferAdif } from '../src/lotw/adif.ts'

test('reads field lengths, normalized names, optional types and empty values', () => {
  expect(readTransferAdif(' \n<call:4:S>W1AW\n<BAND:3>20m<MY_STATE:0><eOr> \n')).toEqual({
    CALL: 'W1AW',
    BAND: '20m',
    MY_STATE: '',
  })
})

test('consumes tag-looking and Unicode field values by length', () => {
  expect(readTransferAdif('<COMMENT:10><EOR>café!<CALL:4>W1AW<EOR>')).toEqual({
    COMMENT: '<EOR>café!',
    CALL: 'W1AW',
  })
})

test.each([
  '',
  ' \n',
  '<EOR>',
  'header<CALL:4>W1AW<EOR>',
  '<EOH><CALL:4>W1AW<EOR>',
  '<CALL:4>W1AW',
  '<CALL:4>W1AW trailing<EOR>',
  '<CALL:4>W1AW<EOR>trailing',
  '<CALL:4>W1AW<EOR><CALL:4>W1AW<EOR>',
  '<CALL:4>W1AW<call:4>W1AW<EOR>',
  '<CALL:-1>W1AW<EOR>',
  '<CALL:4.0>W1AW<EOR>',
  '<CALL:>W1AW<EOR>',
  '<CALL:9007199254740992>W1AW<EOR>',
  '<CALL:5>W1AW',
  '<CALL:4',
  '<CALL:4:STRING>W1AW<EOR>',
  '<_CALL:4>W1AW<EOR>',
])('refuses malformed or ambiguous prepared input: %s', (input) => {
  expect(() => readTransferAdif(input)).toThrow('Could not read the prepared LoTW contact.')
})

test('bounds the prepared record and field count', () => {
  const field = (value: string) => `<COMMENT:${value.length}>${value}<EOR>`
  expect(() => readTransferAdif(field('x'.repeat(64 * 1024)))).toThrow()
  const fields = Array.from({ length: 256 }, (_, index) => `<F${index}:1>x`).join('')
  expect(Object.keys(readTransferAdif(`${fields}<EOR>`))).toHaveLength(256)
  expect(() => readTransferAdif(`${fields}<OVER:1>x<EOR>`)).toThrow()
})

test('does not include malformed input in its diagnostic', () => {
  expect(() => readTransferAdif('<CALL:4>W1AWsecret-credential')).toThrow(
    /^Could not read the prepared LoTW contact\.$/,
  )
})
