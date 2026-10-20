import assert from 'node:assert/strict'
import type {
  BoardSpot,
  HookContext,
  PanelContent,
  PanelRenderArgs,
  PanelScene,
} from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { bigfootPreviewEnvironment } from '../../../../scripts/bigfoot-preview.ts'
import { createBigfootPanel } from '../src/panel.ts'
import type { Qson } from '../src/rules.ts'

const now = Date.UTC(2026, 9, 20, 12)
const operation = { uuid: 'hunt', refs: [{ type: 'bigfoot', ref: '2026' }] }
function args(overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    panelKey: 'hunt',
    instanceId: 'forest',
    operation,
    qsoCount: 0,
    config: {},
    reason: 'initial',
    clock: { nowMillis: now, realNowMillis: now },
    environment: bigfootPreviewEnvironment(),
    ...overrides,
  }
}
function report(call = 'W7I', at = now - 60000, freq = 7050): BoardSpot {
  return {
    their: { call },
    band: '40m',
    mode: 'CW',
    freq,
    spot: { timeInMillis: at, source: 'RBN' },
  }
}
function document(content: PanelContent): PanelScene {
  if (content.kind !== 'svgScene' && content.kind !== 'scene') assert.fail('Expected forest')
  return content.scene
}
function words(content: PanelContent): string {
  return content.kind === 'markdown'
    ? content.content
    : document(content)
        .layers.flatMap((l) => l.text?.literal ?? [])
        .join(' ')
}
function event(action: string, overrides: Partial<PanelRenderArgs> = {}) {
  return {
    ...args(overrides),
    event: { action, controlId: action, phase: 'activate' as const, sequence: 1 },
  }
}

test('fresh station leads share the forest, deduplicate calls and tune only on an explicit action', async () => {
  const calls: string[] = []
  const panel = createBigfootPanel(async (row) => {
    calls.push(row.call)
    return { tuned: true, message: 'Tune requested' }
  })
  const ctx: HookContext = {
    online: true,
    getQsos: async () => [],
    getSpots: async (options) => {
      assert.deepEqual(options, { filter: 'user', maxAgeMinutes: 15, annotate: false })
      return [report('W7I', now - 120000, 7040), report(), report('W7B')]
    },
  }
  const initial = await panel.render(args(), ctx)
  assert.match(words(initial), /W7[BI]/)
  assert.deepEqual(initial.triggers, ['tick:60'])
  assert.deepEqual(calls, [])
  assert.equal(document(initial).controls?.filter((c) => c.event === 'spot:W7I').length, 1)
  assert.ok(panel.onEvent)
  await panel.onEvent(event('spot:W7I'), ctx)
  assert.deepEqual(calls, ['W7I'])
  const selected = await panel.render(args({ reason: 'event' }), ctx)
  assert.match(words(selected), /W7I/)
  assert.match(words(selected), /7050\.0/)
  assert.match(words(selected), /Tune requested/)
  await panel.onEvent(event('next-spot'), ctx)
  assert.deepEqual(calls, ['W7I'])
})

test('spot and minute refreshes reuse the log while animation ticks reuse the held board', async () => {
  let logReads = 0
  let boardReads = 0
  const panel = createBigfootPanel()
  const ctx: HookContext = {
    online: false,
    getQsos: async () => {
      logReads++
      return []
    },
    getSpots: async () => {
      boardReads++
      return [report()]
    },
  }
  await panel.render(args(), ctx)
  await panel.render(args({ reason: 'spots' }), ctx)
  await panel.render(
    args({ reason: 'tick', clock: { nowMillis: now + 1000, realNowMillis: now + 1000 } }),
    ctx,
  )
  assert.equal(logReads, 1)
  assert.equal(boardReads, 2)
  await panel.render(
    args({ reason: 'tick', clock: { nowMillis: now + 60000, realNowMillis: now + 60000 } }),
    ctx,
  )
  assert.equal(logReads, 1)
  assert.equal(boardReads, 3)
})

test('expired reports and events from a previous operation cannot tune', async () => {
  const calls: string[] = []
  const panel = createBigfootPanel(async (row) => {
    calls.push(row.call)
    return { tuned: true, message: 'requested' }
  })
  const ctx = { online: true, getQsos: async () => [], getSpots: async () => [report()] }
  await panel.render(args(), ctx)
  assert.ok(panel.onEvent)
  await panel.onEvent(
    event('tune-spot', { clock: { nowMillis: now + 15 * 60000, realNowMillis: now + 15 * 60000 } }),
    ctx,
  )
  assert.deepEqual(calls, [])
  await panel.render(args({ operation: { ...operation, uuid: 'other' } }), ctx)
  const onEvent = panel.onEvent
  await assert.rejects(() => onEvent(event('tune-spot'), ctx), /Open the BIGFOOT forest/)
  assert.deepEqual(calls, [])
})

test('same-count corrections invalidate credit before failed spots reads and recover on a tick', async () => {
  const panel = createBigfootPanel()
  let qsos: Qson[] = []
  let fail = false
  const ctx: HookContext = {
    online: true,
    getQsos: async () => qsos,
    getSpots: async () => {
      if (fail) throw new Error('Temporary failure')
      return [report()]
    },
  }
  await panel.render(args(), ctx)
  qsos = [
    { uuid: 'corrected', their: { call: 'W7I' }, band: '40m', mode: 'CW', startAtMillis: now },
  ]
  fail = true
  const corrected = await panel.render(args({ reason: 'operation' }), ctx)
  assert.equal(corrected.title, 'BIGFOOT Hunt · CW 1/7')
  assert.equal(
    document(corrected).controls?.some((c) => c.event === 'tune-spot'),
    false,
  )
  fail = false
  const recovered = await panel.render(
    args({ reason: 'tick', clock: { nowMillis: now + 60000, realNowMillis: now + 60000 } }),
    ctx,
  )
  assert.equal(recovered.title, 'BIGFOOT Hunt · CW 1/7')
  assert.match(words(recovered), /W7I/)
})

test('missing and failed spots keep the forest and progress usable', async () => {
  for (const getSpots of [
    undefined,
    async () => {
      throw new Error('temporary')
    },
  ]) {
    const panel = createBigfootPanel()
    const result = await panel.render(args(), { online: false, getQsos: async () => [], getSpots })
    assert.equal(result.kind, 'svgScene')
    assert.ok(document(result).controls?.some((c) => c.event === 'wave'))
    assert.ok(!document(result).controls?.some((c) => c.event === 'tune-spot'))
  }
})

test('a late failed refresh cannot discard a newer board or log snapshot', async () => {
  const panel = createBigfootPanel()
  let rejectOld: (error: Error) => void = () => assert.fail('Not started')
  const old = panel.render(args(), {
    online: false,
    getQsos: async () => [],
    getSpots: () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject
      }),
  })
  // Let the old render reach its spots read after its asynchronous log read.
  await Promise.resolve()
  const ctx = { online: true, getQsos: async () => [], getSpots: async () => [report()] }
  await panel.render(args({ reason: 'spots' }), ctx)
  rejectOld(new Error('old read failed'))
  await old
  const current = await panel.render(args({ reason: 'tick' }), ctx)
  assert.match(words(current), /W7I/)
  assert.ok(document(current).controls?.some((c) => c.event === 'tune-spot'))
})

test('expiry never retargets an already displayed tune button to another station', async () => {
  const calls: string[] = []
  const panel = createBigfootPanel(async (row) => {
    calls.push(row.call)
    return { tuned: true, message: 'requested' }
  })
  const ctx = {
    online: true,
    getQsos: async () => [],
    getSpots: async () => [report('W7B', now - 14 * 60000)],
  }
  await panel.render(args(), ctx)
  // Newer station becomes available while the selected B lead remains visible.
  ctx.getSpots = async () => [report('W7B', now - 14 * 60000), report('W7I')]
  const held = await panel.render(args({ reason: 'spots' }), ctx)
  assert.match(words(held), /W7B/)
  assert.ok(panel.onEvent)
  await panel.onEvent(
    event('tune-spot', { clock: { nowMillis: now + 2 * 60000, realNowMillis: now + 2 * 60000 } }),
    ctx,
  )
  assert.deepEqual(calls, [])
})

test('a newer phone report does not resurrect an older CW frequency in a CW hunt', async () => {
  const panel = createBigfootPanel()
  const result = await panel.render(args(), {
    online: true,
    getQsos: async () => [],
    getSpots: async () => [
      report('W7I', now - 120000),
      { ...report('W7I'), mode: 'USB', band: '20m', freq: 14250 },
    ],
  })
  assert.equal(
    document(result).controls?.some((c) => c.event === 'tune-spot'),
    false,
  )
})

test('a normal spot refresh during tuning preserves the result for the same selected station', async () => {
  let complete: (value: { tuned: boolean; message: string }) => void = () =>
    assert.fail('Not started')
  const panel = createBigfootPanel(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const ctx = { online: true, getQsos: async () => [], getSpots: async () => [report()] }
  await panel.render(args(), ctx)
  assert.ok(panel.onEvent)
  const tuning = panel.onEvent(event('tune-spot'), ctx)
  await panel.render(args({ reason: 'spots' }), ctx)
  complete({ tuned: false, message: 'Radio is disconnected. Enter W7I manually.' })
  await tuning
  const result = await panel.render(args({ reason: 'event' }), ctx)
  assert.match(words(result), /Radio is disconnected/)
})
