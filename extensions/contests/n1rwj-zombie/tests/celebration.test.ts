import { describe, expect, it } from 'vitest'
import { createZombieCelebrations } from '../src/celebration.ts'
import { buildZombieExperience } from '../src/experience.ts'
import type { Qson } from '../src/model.ts'

const START = Date.UTC(2026, 9, 30, 19)
const operation: Qson = {
  uuid: 'operation',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      utcOffset: '-04:00',
      ourSpc: 'RI',
      ourZombieNumber: '002',
      ourZombieName: 'OLD NICK',
    },
  ],
}
function contact(uuid: string, minutes = 0, overrides: Qson = {}): Qson {
  return {
    uuid,
    startAtMillis: START + minutes * 60_000,
    band: '40m',
    mode: 'CW',
    their: { call: 'K1ABC', sent: '599' },
    refs: [{ type: 'zombie', theirSpc: 'MA', theirZombieNumber: '002', theirZombieName: 'IGOR' }],
    ...overrides,
  }
}
type Update = Parameters<ReturnType<typeof createZombieCelebrations>['update']>[0]
function input(rows: Qson[] = [], overrides: Partial<Update> = {}): Update {
  return {
    key: 'placement-a:operation-a',
    now: 10_000,
    reducedMotion: false,
    experience: buildZombieExperience(operation, rows, START + 180 * 60_000),
    recordIds: rows.map((row) => String(row.uuid)),
    reason: 'qsoLogged',
    ...overrides,
  }
}

describe('Zombie celebration attribution', () => {
  it('silently establishes an initial baseline, including a populated bonus log', () => {
    const controller = createZombieCelebrations()
    const rows = [
      contact('ordinary'),
      contact('bonus', 120, {
        refs: [
          { type: 'zombie', theirSpc: 'MA', theirZombieNumber: '4321', theirZombieName: 'IGOR' },
        ],
      }),
    ]
    expect(controller.update(input(rows, { reason: 'initial' }))).toEqual({
      kind: null,
      label: '',
      phase: 0,
      nextTick: false,
    })
    expect(controller.update(input(rows, { now: 20_000 })).kind).toBeNull()
  })

  it('celebrates a newly logged qualifying UUID with a finite four-second sequence', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    expect(controller.update(input([contact('new')]))).toEqual({
      kind: 'contact',
      label: 'Another soul on the air!',
      phase: 1,
      nextTick: true,
    })
    for (const [elapsed, phase] of [
      [999, 1],
      [1000, 0],
      [2000, 1],
      [3000, 0],
    ] as const)
      expect(controller.frame({ ...input(), now: 10_000 + elapsed })).toMatchObject({
        phase,
        nextTick: true,
        kind: 'contact',
      })
    expect(controller.frame({ ...input(), now: 14_000 })).toEqual({
      kind: null,
      label: '',
      phase: 0,
      nextTick: false,
    })
    expect(controller.frame({ ...input(), now: 20_000 }).kind).toBeNull()
  })

  it('ignores new invalid and duplicate contacts without restarting an active award', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    const first = contact('first')
    controller.update(input([first]))
    const rows = [
      first,
      contact('dupe', 60),
      contact('invalid', 120, { mode: 'SSB' }),
      contact('incomplete', 140, {
        refs: [{ type: 'zombie', theirSpc: 'CT', theirZombieNumber: '2', theirZombieName: '' }],
      }),
    ]
    expect(controller.update(input(rows, { now: 11_000 }))).toMatchObject({
      kind: 'contact',
      phase: 0,
    })
    expect(controller.frame({ ...input(), now: 14_000 }).kind).toBeNull()
  })

  it('does not replay an existing row after an exchange edit, deletion, restoration or correction', () => {
    const controller = createZombieCelebrations()
    const invalid = contact('existing', 0, { mode: 'SSB' })
    controller.update(input([invalid]))
    expect(controller.update(input([contact('existing')])).kind).toBeNull()
    expect(
      controller.update(input([contact('existing', 0, { deleted: true })], { now: 11_000 })).kind,
    ).toBeNull()
    expect(controller.update(input([contact('existing')], { now: 12_000 })).kind).toBeNull()
    expect(controller.update(input([], { now: 13_000 })).kind).toBeNull()
    expect(controller.update(input([contact('existing')], { now: 14_000 })).kind).toBeNull()
  })

  it('stops active feedback when its credit is removed and never replays its restored UUID', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    expect(controller.update(input([contact('new')])).kind).toBe('contact')
    expect(controller.update(input([], { now: 10_100 }))).toMatchObject({
      kind: null,
      nextTick: false,
    })
    expect(controller.update(input([contact('new')], { now: 10_200 })).kind).toBeNull()
  })

  it('distinguishes qualifying rebirth and bonus contacts and gives simultaneous bonus credit priority', () => {
    const controller = createZombieCelebrations()
    const first = contact('first')
    controller.update(input([first]))
    const rebirth = contact('rebirth', 120)
    expect(controller.update(input([first, rebirth]))).toMatchObject({
      kind: 'rebirth',
      label: 'BACK FROM THE DEAD!',
    })
    const bonus = contact('bonus', 121, {
      their: { call: 'K2ABC', sent: '599' },
      refs: [
        { type: 'zombie', theirSpc: 'CT', theirZombieNumber: '004321', theirZombieName: 'BONUS' },
      ],
    })
    const newer = contact('ordinary', 122, { their: { call: 'K3ABC', sent: '599' } })
    expect(
      controller.update(
        input([first, rebirth, bonus, newer], { reason: 'coalesced', now: 15_000 }),
      ),
    ).toMatchObject({ kind: 'bonus', label: 'A bonus soul on the air!' })
  })

  it('requires the credited UUID to be present among the actual records supplied with the update', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    expect(controller.update(input([contact('synthetic')], { recordIds: [] })).kind).toBeNull()
  })

  it.each([
    'initial',
    'visible',
    'config',
    'runtime',
    'environment',
    'retry',
    'clock',
    'event',
    'tick',
  ])('consumes %s refreshes silently so the next logging refresh cannot replay them', (reason) => {
    const controller = createZombieCelebrations()
    controller.update(input())
    const rows = [contact('new')]
    expect(controller.update(input(rows, { reason })).kind).toBeNull()
    expect(controller.update(input(rows, { reason: 'operation' })).kind).toBeNull()
  })

  it('isolates exact operation and placement keys and baselines newly encountered keys quietly', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    expect(controller.update(input([contact('new')])).kind).toBe('contact')
    expect(controller.frame({ ...input(), key: 'placement-a:operation-b' }).kind).toBeNull()
    expect(controller.frame({ ...input(), key: 'placement-b:operation-a' }).kind).toBeNull()
    expect(
      controller.update(input([contact('new')], { key: 'placement-a:operation-b' })).kind,
    ).toBeNull()
    expect(
      controller.update(input([contact('new')], { key: 'placement-b:operation-a' })).kind,
    ).toBeNull()
    expect(controller.frame(input()).kind).toBe('contact')
  })

  it('honors reduced motion permanently for the current award and expires its static label', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    expect(controller.update(input([contact('new')], { reducedMotion: true }))).toMatchObject({
      kind: 'contact',
      phase: 0,
      nextTick: false,
    })
    expect(controller.frame({ ...input(), now: 11_000, reducedMotion: false })).toMatchObject({
      kind: 'contact',
      phase: 0,
      nextTick: false,
    })
    expect(controller.frame({ ...input(), now: 14_000 }).kind).toBeNull()
    controller.update(input([contact('new'), contact('second', 120)], { now: 20_000 }))
    expect(controller.frame({ ...input(), now: 20_100, reducedMotion: true })).toMatchObject({
      phase: 0,
      nextTick: false,
    })
    expect(controller.frame({ ...input(), now: 21_000, reducedMotion: false })).toMatchObject({
      phase: 0,
      nextTick: false,
    })
  })

  it('keeps an explicit greeting through its authoritative event render and lets new credit replace it', () => {
    const controller = createZombieCelebrations()
    expect(controller.greet(input()).kind).toBeNull()
    controller.update(input())
    expect(controller.greet(input())).toMatchObject({
      kind: 'greeting',
      label: 'CQ BOO! Your zombie waves hello.',
    })
    expect(controller.update(input([], { reason: 'event', now: 10_100 })).kind).toBe('greeting')
    expect(controller.update(input([contact('new')], { now: 11_000 })).kind).toBe('contact')
  })

  it('clears feedback after a clock reversal and quietly baselines evicted state', () => {
    const controller = createZombieCelebrations()
    controller.update(input())
    controller.update(input([contact('new')]))
    expect(controller.frame({ ...input(), now: 9_000 }).kind).toBeNull()
    expect(controller.frame({ ...input(), now: 11_000 }).kind).toBeNull()
    for (let index = 0; index < 12; index++) controller.update(input([], { key: `other:${index}` }))
    expect(controller.update(input([contact('new'), contact('rebirth', 120)])).kind).toBeNull()
  })
})
