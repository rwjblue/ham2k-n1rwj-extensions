import { expect, test } from 'vitest'
import {
  clusterAnnouncementPattern,
  isPromptFor,
  nodeProgramFromPrompt,
  spotTime,
} from '../../src/vendor/cluster-spots.mjs'

test('the vendored announcement matcher exposes the raw RBN fields', () => {
  const line = 'DX de W2NAF-#: 3532.5 N3BTM CW 37 dB 21 WPM CQ0011Z'
  expect(clusterAnnouncementPattern.exec(line)?.slice(1, 6)).toEqual([
    'W2NAF-#',
    '3532.5',
    'N3BTM',
    'CW 37 dB 21 WPM CQ',
    '0011',
  ])
  expect(spotTime('2359', Date.UTC(2026, 10, 12, 0, 0, 30))).toBe(Date.UTC(2026, 10, 11, 23, 59))
})

test.each([
  ['N1RWJ de K3LR 12-Nov 0011Z arc6>', 'AR-Cluster'],
  ['N1RWJ de W3LPL 12-Nov 0011Z dxspider >', 'DXSpider'],
  ['N1RWJ de VE7CC-1 12-Nov 0011Z CCC >', 'CC Cluster'],
])('the vendored helpers recognize the login and dialect in %s', (prompt, dialect) => {
  expect(isPromptFor(prompt, 'N1RWJ')).toBe(true)
  expect(isPromptFor(prompt, 'W1AW')).toBe(false)
  expect(nodeProgramFromPrompt(prompt)).toBe(dialect)
})
