import assert from 'node:assert/strict'
import type { CallInfoLookup, HookContext } from '@ham2k/extension-sdk'
import { afterEach, beforeEach, test, vi } from 'vitest'
import { BigfootLookup } from '../src/annotations.ts'
import { EVENT_2026, type Qson } from '../src/rules.ts'

const during = Date.UTC(2026, 9, 19, 23, 30)
const operation: Qson = {
  uuid: 'hunt',
  stationCall: 'N1RWJ',
  createdAtMillis: Date.UTC(2026, 9, 19, 23),
  refs: [{ type: 'bigfoot', ref: '2026' }],
}
const offline = { online: false }

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(during)
})
afterEach(() => {
  vi.restoreAllMocks()
})

function qso(at = during): Qson {
  return { their: { call: 'W7O' }, band: '20m', mode: 'CW', startAtMillis: at }
}

async function look(
  candidate: Qson = qso(),
  op = operation,
  ctx: HookContext = offline,
  call = 'W7O',
) {
  return BigfootLookup.lookupCall({ operation: op, qso: candidate, callInfo: { call } }, ctx)
}

function notes(results: CallInfoLookup[]): string {
  return results.flatMap((result) => result.notes ?? []).join('\n')
}

test('annotates exact event targets offline without reading the log or changing station facts', async () => {
  const ctx = {
    online: false,
    async getQsos() {
      throw new Error('Static station identity must never read the log')
    },
  }
  for (const [call, letter] of [
    ['W7B', 'B'],
    ['W7I', 'I'],
    ['W7G', 'G'],
    ['W7F', 'F'],
    ['W7O', 'O (two contacts)'],
    ['W7T', 'T'],
  ]) {
    const result = (await look({}, operation, ctx, call))[0] as CallInfoLookup & {
      note?: string
      emoji?: string
    }
    assert.deepEqual(Object.keys(result).sort(), [
      'call',
      'emoji',
      'note',
      'notes',
      'scope',
      'source',
    ])
    assert.equal(result.call, call)
    assert.equal(result.scope, 'operation')
    assert.equal(result.emoji, '🐾')
    assert.equal(result.note, `🐾 BIGFOOT 2026: ${letter}`)
    assert.ok(result.notes?.includes('🌲🐾 **BIGFOOT Hunt 2026** 🐾🌲'))
    assert.ok(
      result.notes?.some((note) =>
        note.includes(`**${call === 'W7O' ? 'O + O' : letter} — ${call}**`),
      ),
    )
    assert.ok(result.notes?.every((note) => !/needed|worked|complete/i.test(String(note))))
  }
  const bonus = (await look({}, operation, ctx, 'W4S'))[0] as CallInfoLookup & {
    note?: string
    emoji?: string
  }
  assert.equal(bonus.note, '🦨 BIGFOOT 2026: Skunk Ape bonus')
  assert.equal(bonus.emoji, '🦨')
  assert.ok(bonus.notes?.some((note) => note.startsWith('🦨 **Skunk Ape — W4S**')))
  assert.match(notes(await look()), /second W7O.*different band, mode, or UTC date/)
  assert.match(notes(await look()), /All-CW hunt:.*use another band or UTC date/)
  for (const call of ['W3S', 'W7A', 'W7B/P', 'W7OO'])
    assert.deepEqual(await look({}, operation, ctx, call), [])
})

test('limits reused short calls to the selected edition and the contact UTC event window', async () => {
  assert.deepEqual(await look(qso(), { uuid: 'plain' }), [])
  assert.deepEqual(
    await look(qso(), {
      ...operation,
      refs: [{ type: 'bigfoot', ref: '2027' }],
    }),
    [],
  )
  assert.deepEqual(await look(qso(EVENT_2026.startAtMillis - 1)), [])
  assert.deepEqual(await look(qso(EVENT_2026.endAtMillis)), [])
  assert.deepEqual(await look({ their: { call: 'W7O' }, startAtMillis: null }), [])
  assert.deepEqual(await look({ their: { call: 'W7O' }, startAt: '2026-10-19 23:30' }), [])
  vi.mocked(Date.now).mockReturnValue(EVENT_2026.endAtMillis)
  assert.deepEqual(await look({}), [])
  // An explicitly dated saved QSO is described by its own event date.
  assert.equal((await look(qso())).length, 1)
  assert.equal((await look({ their: { call: 'W7O' }, startAt: '2026-10-19T23:30:00Z' })).length, 1)
})

test('never reuses an old lookup call after the operator clears or corrects it', async () => {
  for (const call of ['', ' ', null, 'W3S'])
    assert.deepEqual(await look({ ...qso(), their: { call } }), [])
  assert.equal((await look({}, operation, offline, ' w7b '))[0]?.call, 'W7B')
  const { uuid: _uuid, ...hostOperation } = operation
  assert.equal((await look({}, hostOperation, offline, 'W7B'))[0]?.call, 'W7B')
})
