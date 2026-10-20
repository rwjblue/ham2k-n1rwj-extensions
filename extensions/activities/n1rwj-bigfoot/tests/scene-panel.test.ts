import assert from 'node:assert/strict'
import type { HookContext, PanelContent, PanelRenderArgs, PanelScene } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { bigfootPreviewEnvironment } from '../../../../scripts/bigfoot-preview.ts'
import { createBigfootPanel } from '../src/panel.ts'
import type { Qson } from '../src/rules.ts'

const operation: Qson = {
  uuid: 'forest-hunt',
  refs: [{ type: 'bigfoot', ref: '2026' }],
}

function qso(uuid: string, call = 'W7B', mode = 'CW', band = '20m'): Qson {
  return {
    uuid,
    their: { call, sent: '599' },
    our: { sent: '599' },
    mode,
    band,
    startAtMillis: Date.UTC(2026, 9, 20, 1),
  }
}

function args(overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    instanceId: 'forest-placement',
    panelKey: 'hunt',
    operation,
    qsoCount: 0,
    config: {},
    reason: 'initial',
    environment: bigfootPreviewEnvironment(),
    clock: { nowMillis: 10000, realNowMillis: 10000 },
    ...overrides,
  }
}

function at(now: number, overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return args({ clock: { nowMillis: now, realNowMillis: now }, ...overrides })
}

function scene(result: PanelContent): PanelScene {
  if (result.kind !== 'svgScene' && result.kind !== 'scene')
    assert.fail(`Expected a native forest scene, got ${result.kind}`)
  return result.scene
}

function text(document: PanelScene): string {
  return document.layers
    .flatMap((layer) => (layer.text?.literal ? [layer.text.literal] : []))
    .join(' ')
}

function markdown(result: PanelContent): string {
  assert.equal(result.kind, 'markdown')
  return result.content
}

test('modern hosts receive a native forest while legacy hosts and checklist preference retain Markdown', async () => {
  const panel = createBigfootPanel()
  const ctx = { online: false, getQsos: async () => [qso('b')] }
  const forest = await panel.render(args(), ctx)
  assert.equal(forest.kind, 'svgScene')
  assert.equal(forest.title, 'BIGFOOT Hunt · CW 1/7')
  const document = scene(forest)
  assert.ok(document.layers.some((layer) => layer.id === 'bigfoot' && layer.svg))
  assert.ok(document.layers.some((layer) => layer.id === 'forest' && layer.svg))
  assert.match(text(document), /CW\s+1 \/ 7/)
  assert.equal(document.values.hop, 0)
  assert.deepEqual(forest.triggers, [])
  assert.deepEqual(
    document.controls?.map(({ id, kind, label, event }) => ({ id, kind, label, event })),
    [{ id: 'wave', kind: 'button', label: 'Wave to Bigfoot', event: 'wave' }],
  )

  const legacy = await panel.render(args({ environment: undefined }), ctx)
  assert.match(markdown(legacy), /\*\*CW 1\/7\*\*/)
  assert.deepEqual(legacy.triggers, [])
  const detailed = await panel.render(args({ config: { view: 'checklist' } }), ctx)
  assert.match(markdown(detailed), /\| Target \| CW \| Mixed \|/)
  assert.deepEqual(detailed.triggers, [])
})

test('a logged letter schedules only finite celebration ticks and ticks never reread the log', async () => {
  const panel = createBigfootPanel()
  let qsos: Qson[] = []
  let reads = 0
  const ctx: HookContext = {
    online: false,
    async getQsos(uuid) {
      assert.equal(uuid, operation.uuid)
      reads += 1
      return qsos
    },
  }
  const baseline = await panel.render(args(), ctx)
  assert.equal(scene(baseline).values.hop, 0)
  assert.deepEqual(baseline.triggers, [])
  qsos = [qso('b')]
  const found = await panel.render(at(11000, { reason: 'qsoLogged', qsoCount: 1 }), ctx)
  assert.match(text(scene(found)), /CW B found!/)
  assert.equal(scene(found).values.hop, 1)
  assert.deepEqual(found.triggers, ['tick:1'])
  assert.equal(reads, 2)

  // A host must not be consulted on these animation-only renders.
  const ticks: HookContext = {
    online: false,
    async getQsos() {
      assert.fail('Animation tick attempted to reread the operation')
    },
  }
  for (const now of [12000, 13000, 14000]) {
    const moving = await panel.render(at(now, { reason: 'tick', qsoCount: 1 }), ticks)
    assert.equal(moving.title, 'BIGFOOT Hunt · CW 1/7')
    assert.deepEqual(moving.triggers, ['tick:1'])
  }
  const landed = await panel.render(at(15000, { reason: 'tick', qsoCount: 1 }), ticks)
  assert.equal(scene(landed).values.hop, 0)
  assert.deepEqual(landed.triggers, [])
  assert.doesNotMatch(text(scene(landed)), /CW B found!/)
  assert.equal(reads, 2)
})

test('same-count corrections and deleting the final contact update the scene without awarding a letter', async () => {
  const panel = createBigfootPanel()
  let qsos = [qso('existing', 'W1AW')]
  const ctx = { online: false, getQsos: async () => qsos }
  assert.equal((await panel.render(args({ qsoCount: 1 }), ctx)).title, 'BIGFOOT Hunt · CW 0/7')
  qsos = [qso('existing')]
  const corrected = await panel.render(at(11000, { reason: 'operation', qsoCount: 1 }), ctx)
  assert.equal(corrected.title, 'BIGFOOT Hunt · CW 1/7')
  assert.equal(scene(corrected).values.hop, 0)
  assert.deepEqual(corrected.triggers, [])
  qsos = []
  const deleted = await panel.render(at(12000, { reason: 'qsoLogged' }), ctx)
  assert.equal(deleted.title, 'BIGFOOT Hunt · CW 0/7')
  assert.deepEqual(deleted.triggers, [])
  qsos = [qso('existing')]
  const restored = await panel.render(at(13000, { reason: 'qsoLogged', qsoCount: 1 }), ctx)
  assert.equal(restored.title, 'BIGFOOT Hunt · CW 1/7')
  assert.equal(scene(restored).values.hop, 0)
  assert.deepEqual(restored.triggers, [])
})

test('the forest keeps CW primary when an SSB second O advances only mixed progress', async () => {
  const panel = createBigfootPanel()
  let qsos = [qso('cw-o', 'W7O')]
  const ctx = { online: false, getQsos: async () => qsos }
  await panel.render(args({ qsoCount: 1 }), ctx)
  qsos = [...qsos, qso('phone-o', 'W7O', 'SSB')]
  const found = await panel.render(at(11000, { reason: 'qsoLogged', qsoCount: 2 }), ctx)
  const document = scene(found)
  assert.equal(found.title, 'BIGFOOT Hunt · CW 1/7')
  assert.match(text(document), /CW\s+1 \/ 7/)
  assert.match(text(document), /Mixed\s+2 \/ 7/)
  assert.match(text(document), /Mixed O₂ found!/)
  assert.ok(document.layers.some((layer) => layer.id === 'mixed-dot-5'))
  assert.deepEqual(found.triggers, ['tick:1'])
})

test('manual waving survives the native authoritative event render without changing contacts or progress', async () => {
  const panel = createBigfootPanel()
  const qsos = [qso('o1', 'W7O')]
  const saved = JSON.stringify(qsos)
  let reads = 0
  const ctx = {
    online: false,
    async getQsos() {
      reads += 1
      return qsos
    },
  }
  await panel.render(args({ qsoCount: 1 }), ctx)
  assert.ok(panel.onEvent)
  const response = await panel.onEvent(
    {
      ...at(11000, { qsoCount: 1 }),
      event: { action: 'wave', controlId: 'wave', phase: 'activate', sequence: 1 },
    },
    ctx,
  )
  assert.deepEqual(response, { values: { hop: 1, wave: 1 } })
  assert.equal(reads, 1)
  const greeting = await panel.render(at(11001, { reason: 'event', qsoCount: 1 }), ctx)
  assert.match(text(scene(greeting)), /Bigfoot says hello!/)
  assert.match(text(scene(greeting)), /CW\s+1 \/ 7/)
  assert.deepEqual(greeting.triggers, ['tick:1'])
  const settled = await panel.render(at(15000, { reason: 'tick', qsoCount: 1 }), ctx)
  assert.equal(scene(settled).values.hop, 0)
  assert.deepEqual(settled.triggers, [])
  assert.equal(reads, 2)
  assert.equal(JSON.stringify(qsos), saved)
})

test('system reduced motion and the motion preference keep earned feedback static with no ticking', async () => {
  for (const overrides of [
    { environment: bigfootPreviewEnvironment(560, 660, true) },
    { config: { motion: false } },
  ] satisfies Partial<PanelRenderArgs>[]) {
    const panel = createBigfootPanel()
    let qsos: Qson[] = []
    const ctx = { online: false, getQsos: async () => qsos }
    await panel.render(args(overrides), ctx)
    qsos = [qso('b')]
    const found = await panel.render(
      at(11000, { ...overrides, reason: 'qsoLogged', qsoCount: 1 }),
      ctx,
    )
    const document = scene(found)
    assert.match(text(document), /CW B found!/)
    assert.equal(document.values.hop, 0)
    assert.equal(document.values.wave, 0)
    assert.ok(document.layers.every((layer) => !layer.pulse))
    assert.ok(document.layers.every((layer) => !layer.transitionMs))
    assert.deepEqual(found.triggers, [])
  }
})

test('animation snapshots cannot leak between placements or operations', async () => {
  const panel = createBigfootPanel()
  const otherOperation: Qson = { ...operation, uuid: 'another-hunt' }
  const logs = new Map<string, Qson[]>([
    [String(operation.uuid), []],
    ['another-hunt', []],
  ])
  const reads: string[] = []
  const ctx: HookContext = {
    online: false,
    async getQsos(uuid) {
      reads.push(uuid)
      return logs.get(uuid) ?? null
    },
  }
  await panel.render(args(), ctx)
  await panel.render(args({ instanceId: 'second-placement' }), ctx)
  logs.set(String(operation.uuid), [qso('b')])
  await panel.render(at(11000, { reason: 'qsoLogged', qsoCount: 1 }), ctx)
  const second = await panel.render(
    at(11001, { instanceId: 'second-placement', reason: 'tick' }),
    ctx,
  )
  assert.equal(second.title, 'BIGFOOT Hunt · CW 0/7')
  assert.equal(scene(second).values.hop, 0)
  assert.deepEqual(second.triggers, [])
  assert.equal(reads.length, 3)

  const switched = await panel.render(
    at(12000, { operation: otherOperation, reason: 'operation' }),
    ctx,
  )
  assert.equal(switched.title, 'BIGFOOT Hunt · CW 0/7')
  assert.equal(scene(switched).values.hop, 0)
  assert.deepEqual(switched.triggers, [])
  logs.set(String(operation.uuid), [qso('b'), qso('i', 'W7I')])
  const returned = await panel.render(at(13000, { reason: 'operation', qsoCount: 2 }), ctx)
  assert.equal(returned.title, 'BIGFOOT Hunt · CW 2/7')
  assert.equal(scene(returned).values.hop, 0)
  assert.deepEqual(returned.triggers, [])
  assert.deepEqual(reads, [
    'forest-hunt',
    'forest-hunt',
    'forest-hunt',
    'another-hunt',
    'forest-hunt',
  ])
})

test('a failed modern log read replaces the forest with explicit guidance and clears tick requests', async () => {
  const panel = createBigfootPanel()
  const result = await panel.render(args(), {
    online: false,
    async getQsos() {
      throw new Error('Log temporarily unavailable')
    },
  })
  assert.match(markdown(result), /operation log is unavailable/)
  assert.deepEqual(result.triggers, [])
})
