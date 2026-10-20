import assert from 'node:assert/strict'
import { test } from 'vitest'
import { type CelebrationUpdate, createCelebrations } from '../src/celebration.ts'
import { type Contact, EVENT_2026, qualifyingContacts } from '../src/rules.ts'

const during = Date.UTC(2026, 9, 19, 23, 30)

function contact(uuid: string, call: string, band = '20m', mode = 'CW', at = during): Contact {
  const result = qualifyingContacts(
    [{ uuid, their: { call }, band, mode, startAtMillis: at }],
    EVENT_2026,
  )[0]
  assert.ok(result)
  return result
}

function input(
  contacts: Contact[] = [],
  overrides: Partial<CelebrationUpdate> = {},
): CelebrationUpdate {
  return {
    instanceId: 'panel-a',
    operationId: 'hunt-a',
    focus: 'CW',
    contacts,
    recordIds: contacts.map((entry) => entry.uuid),
    reason: 'operation',
    now: 10000,
    reducedMotion: false,
    ...overrides,
  }
}

test('silently establishes a baseline even when opening a completed hunt', () => {
  const celebrations = createCelebrations()
  const complete = [
    contact('b', 'W7B'),
    contact('i', 'W7I'),
    contact('g', 'W7G'),
    contact('f', 'W7F'),
    contact('o1', 'W7O'),
    contact('o2', 'W7O', '40m'),
    contact('t', 'W7T'),
    contact('s', 'W4S'),
  ]
  assert.equal(celebrations.update(input(complete, { reason: 'initial' })).kind, null)
  assert.equal(celebrations.update(input(complete)).kind, null)
  assert.equal(celebrations.frame(input(complete)).nextTick, false)
})

test('a new qualifying letter runs a finite up/down/up/down sequence without log inputs', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const found = celebrations.update(input([contact('b', 'W7B')], { reason: 'qsoLogged' }))
  assert.deepEqual(found, {
    kind: 'letter',
    label: 'CW B found!',
    letters: ['B'],
    mode: 'CW',
    phase: 1,
    hopping: true,
    nextTick: true,
  })
  for (const [elapsed, phase] of [
    [999, 1],
    [1000, 0],
    [2000, 1],
    [3000, 0],
  ] as const) {
    const frame = celebrations.frame({ ...input(), now: 10000 + elapsed })
    assert.equal(frame.phase, phase)
    assert.equal(frame.nextTick, true)
  }
  const settled = celebrations.frame({ ...input(), now: 14000 })
  assert.equal(settled.kind, null)
  assert.equal(settled.phase, 0)
  assert.equal(settled.nextTick, false)
  assert.equal(celebrations.frame({ ...input(), now: 20000 }).kind, null)
})

test('a duplicate does not restart an in-progress celebration', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const first = contact('b', 'W7B')
  celebrations.update(input([first]))
  const duplicate = celebrations.update(input([first, contact('again', 'W7B')], { now: 11000 }))
  assert.equal(duplicate.phase, 0)
  assert.equal(duplicate.label, 'CW B found!')
  assert.equal(celebrations.frame({ ...input(), now: 14000 }).kind, null)
})

test('first and second O celebrate independently and a repeated context never supplies the second', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const first = contact('o1', 'W7O')
  assert.deepEqual(celebrations.update(input([first])).letters, ['O₁'])
  const duplicate = contact('dupe', 'W7O')
  assert.equal(celebrations.update(input([first, duplicate], { now: 15000 })).kind, null)
  const second = contact('o2', 'W7O', '40m')
  const found = celebrations.update(input([first, duplicate, second], { now: 20000 }))
  assert.deepEqual(found.letters, ['O₂'])
  assert.equal(found.mode, 'CW')
})

test('a backdated new O can enable the second slot even when that slot selects the older UUID', () => {
  const celebrations = createCelebrations()
  const old = contact('old', 'W7O', '20m', 'CW', during + 1000)
  celebrations.update(input([old]))
  const earlier = contact('new', 'W7O', '40m', 'CW', during)
  assert.deepEqual(celebrations.update(input([old, earlier])).letters, ['O₂'])
})

test('CW progress takes priority over a simultaneous mixed-mode O gain', () => {
  const celebrations = createCelebrations()
  const phone = contact('phone', 'W7O', '20m', 'USB')
  celebrations.update(input([phone]))
  const firstCw = contact('cw1', 'W7O')
  const cw = celebrations.update(input([phone, firstCw]))
  assert.equal(cw.mode, 'CW')
  assert.deepEqual(cw.letters, ['O₁'])
  const secondCw = contact('cw2', 'W7O', '20m', 'CW', Date.UTC(2026, 9, 20, 0, 1))
  assert.deepEqual(celebrations.update(input([phone, firstCw, secondCw], { now: 15000 })).letters, [
    'O₂',
  ])
})

test('mixed progress remains a secondary celebration while hunting CW', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const found = celebrations.update(input([contact('b', 'W7B', '20m', 'SSB')]))
  assert.equal(found.mode, 'MIXED')
  assert.equal(found.label, 'Mixed B found!')
})

test('editing an existing row, even alongside a new unrelated record, earns no animation', () => {
  const celebrations = createCelebrations()
  celebrations.update(input([], { recordIds: ['existing'] }))
  const edited = contact('existing', 'W7B')
  assert.equal(
    celebrations.update(input([edited], { recordIds: ['existing', 'unrelated-new'] })).kind,
    null,
  )
  assert.equal(celebrations.update(input([edited], { now: 20000 })).kind, null)
  // A credit established by an edit is remembered too, so replacing its
  // record does not later advertise it as a newly found letter.
  assert.equal(
    celebrations.update(input([contact('replacement', 'W7B')], { now: 25000 })).kind,
    null,
  )
})

test('deleting, restoring, and re-earning a previously seen credit never replay it', () => {
  const celebrations = createCelebrations()
  const first = contact('o1', 'W7O')
  const second = contact('o2', 'W7O', '40m')
  celebrations.update(input([first, second]))
  assert.equal(celebrations.update(input([], { now: 15000 })).kind, null)
  assert.equal(celebrations.update(input([first], { now: 20000 })).kind, null)
  assert.equal(
    celebrations.update(input([first, contact('new-o', 'W7O', '40m')], { now: 25000 })).kind,
    null,
  )
})

test('removing an earned contact stops its active celebration immediately', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  assert.equal(celebrations.update(input([contact('b', 'W7B')])).hopping, true)
  const deleted = celebrations.update(input([], { now: 10500 }))
  assert.equal(deleted.kind, null)
  assert.equal(deleted.nextTick, false)
  const restored = celebrations.update(input([contact('b', 'W7B')], { now: 11000 }))
  assert.equal(restored.kind, null)
})

test('a raw new record UUID is required to attribute a gain to a newly logged contact', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  assert.equal(
    celebrations.update(input([contact('synthetic', 'W7B')], { recordIds: [] })).kind,
    null,
  )
})

test('opening, revealing, resizing, and changing focus consume credits silently without replay', () => {
  for (const reason of [
    'initial',
    'visible',
    'config',
    'runtime',
    'environment',
    'retry',
    'clock',
    'event',
    'tick',
  ]) {
    const celebrations = createCelebrations()
    celebrations.update(input())
    const first = contact('b', 'W7B')
    assert.equal(celebrations.update(input([first], { reason })).kind, null, reason)
    assert.equal(celebrations.update(input([first], { reason: 'operation' })).kind, null, reason)
  }
  const celebrations = createCelebrations()
  celebrations.update(input())
  const phone = contact('b', 'W7B', '20m', 'SSB')
  assert.equal(celebrations.update(input([phone], { focus: 'PHONE' })).kind, null)
  assert.equal(celebrations.update(input([phone], { focus: 'CW' })).kind, null)
  // All mode credits were recorded even while another mode had focus.
  assert.equal(celebrations.update(input([phone], { focus: 'MIXED' })).kind, null)
})

test('operation switches are silent and state is isolated by exact operation and placement IDs', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const b = contact('b', 'W7B')
  assert.equal(celebrations.update(input([b])).kind, 'letter')
  assert.equal(celebrations.frame({ ...input(), instanceId: 'another-panel' }).kind, null)
  assert.equal(celebrations.update(input([], { operationId: 'hunt-b' })).kind, null)
  assert.equal(celebrations.frame(input()).kind, null)
  assert.equal(celebrations.update(input([b, contact('i', 'W7I')])).kind, null)
  const g = celebrations.update(input([b, contact('i', 'W7I'), contact('g', 'W7G')]))
  assert.deepEqual(g.letters, ['G'])
  assert.equal(celebrations.update(input([], { instanceId: 'panel-b' })).kind, null)
  assert.deepEqual(celebrations.update(input([b], { instanceId: 'panel-b' })).letters, ['B'])
})

test('the final letter and Skunk Ape bonus have distinct celebration kinds', () => {
  const celebrations = createCelebrations()
  const almost = [
    contact('b', 'W7B'),
    contact('i', 'W7I'),
    contact('g', 'W7G'),
    contact('f', 'W7F'),
    contact('o1', 'W7O'),
    contact('o2', 'W7O', '40m'),
  ]
  celebrations.update(input(almost))
  const complete = [...almost, contact('t', 'W7T')]
  const found = celebrations.update(input(complete))
  assert.equal(found.kind, 'complete')
  assert.equal(found.label, 'CW BIGFOOT complete!')
  assert.deepEqual(found.letters, ['T'])
  const bonus = celebrations.update(input([...complete, contact('s', 'W4S')], { now: 15000 }))
  assert.equal(bonus.kind, 'bonus')
  assert.equal(bonus.label, 'CW Skunk Ape bonus found!')
  assert.deepEqual(bonus.letters, [])
})

test('reduced motion keeps earned feedback and never schedules animation ticks', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  const reduced = celebrations.update(input([contact('b', 'W7B')], { reducedMotion: true }))
  assert.equal(reduced.kind, 'letter')
  assert.equal(reduced.label, 'CW B found!')
  assert.equal(reduced.phase, 0)
  assert.equal(reduced.hopping, false)
  assert.equal(reduced.nextTick, false)
  // Turning reduced motion off does not replay an award already delivered.
  assert.equal(celebrations.frame({ ...input(), now: 11000 }).nextTick, false)
  assert.equal(celebrations.update(input([contact('b', 'W7B')], { now: 15000 })).kind, null)
})

test('an explicit greeting does not consume awards and a new letter can preempt it', () => {
  const celebrations = createCelebrations()
  assert.equal(celebrations.greet(input()).kind, null)
  celebrations.update(input())
  const hello = celebrations.greet(input())
  assert.equal(hello.kind, 'greeting')
  assert.equal(hello.label, 'Bigfoot says hello!')
  assert.equal(hello.mode, null)
  assert.deepEqual(hello.letters, [])
  // The native host always requests an authoritative 'event' render after
  // an onEvent result, which must not immediately cancel the greeting.
  assert.equal(celebrations.update(input([], { reason: 'event', now: 10500 })).kind, 'greeting')
  const found = celebrations.update(input([contact('b', 'W7B')], { now: 11000 }))
  assert.equal(found.kind, 'letter')
  assert.equal(found.phase, 1)
  const still = celebrations.greet({ ...input(), now: 12000, reducedMotion: true })
  assert.equal(still.kind, 'greeting')
  assert.equal(still.nextTick, false)
})

test('bounded placement history baselines evicted hunts silently', () => {
  const celebrations = createCelebrations()
  celebrations.update(input())
  celebrations.update(input([contact('b', 'W7B')]))
  for (let index = 1; index <= 12; index += 1) {
    celebrations.update(input([], { instanceId: `panel-${index}` }))
  }
  assert.equal(celebrations.frame(input()).kind, null)
  assert.equal(celebrations.update(input([contact('b', 'W7B'), contact('i', 'W7I')])).kind, null)
})
