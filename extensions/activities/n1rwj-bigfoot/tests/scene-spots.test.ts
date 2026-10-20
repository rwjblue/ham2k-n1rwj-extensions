import assert from 'node:assert/strict'
import type { PanelScene } from '@ham2k/extension-sdk'
import { test } from 'vitest'
import { bigfootPreviewEnvironment } from '../../../../scripts/bigfoot-preview.ts'
import type { CelebrationFrame } from '../src/celebration.ts'
import { EVENT_2026, type Qson, qualifyingContacts } from '../src/rules.ts'
import { huntScene } from '../src/scene.ts'
import type { HuntSpotView } from '../src/spot-view.ts'
import type { BigfootSpotRow } from '../src/spots.ts'

const quiet: CelebrationFrame = {
  kind: null,
  label: '',
  letters: [],
  mode: null,
  phase: 0,
  hopping: false,
  nextTick: false,
}

function qso(call: string, uuid = call, band = '20m', mode = 'CW'): Qson {
  return {
    uuid,
    their: { call },
    band,
    mode,
    startAtMillis: Date.UTC(2026, 9, 20, 1),
  }
}

function report(call = 'W7O', patch: Partial<BigfootSpotRow> = {}): BigfootSpotRow {
  return {
    call,
    label: `BIGFOOT 2026: ${call}`,
    band: '40m',
    mode: 'CW',
    frequency: 7050,
    at: Date.UTC(2026, 9, 20, 12),
    needed: true,
    status: 'CW: Second O needed; this contact would fill it.',
    ...patch,
  }
}

function view(rows = [report()], patch: Partial<HuntSpotView> = {}): HuntSpotView {
  return {
    status: 'ready',
    rows,
    selected: rows[0],
    radio: { status: 'ready', message: 'The logging radio is connected.' },
    ...patch,
  }
}

function render(
  spots?: HuntSpotView,
  qsos: Qson[] = [],
  width = 560,
  height = 660,
  frame = quiet,
  reducedMotion = false,
): PanelScene {
  return huntScene({
    contacts: qualifyingContacts(qsos, EVENT_2026),
    focus: 'CW',
    frame,
    environment: bigfootPreviewEnvironment(width, height, reducedMotion),
    motion: true,
    spots,
  })
}

function text(scene: PanelScene): string {
  return scene.layers.map((layer) => layer.text?.literal ?? '').join(' ')
}

test('integrated spot markers preserve earned tiles, Mixed dots and the same forest', () => {
  const qsos = [qso('W7B', 'mixed-b', '20m', 'SSB'), qso('W7I'), qso('W7O')]
  const baseline = render(undefined, qsos)
  const current = render(
    view([
      report('W7B'),
      report('W7I', { needed: false, status: 'CW: I worked.' }),
      report(),
      report('W4S'),
    ]),
    qsos,
  )
  for (const id of ['forest', 'bigfoot', 'tile-0', 'tile-1', 'mixed-dot-0', 'primary-score-text'])
    assert.deepEqual(
      current.layers.find((layer) => layer.id === id),
      baseline.layers.find((layer) => layer.id === id),
    )
  assert.match(current.layers.find((layer) => layer.id === 'spot-beacon-0')?.svg ?? '', /#7CD9CF/)
  assert.match(current.layers.find((layer) => layer.id === 'spot-beacon-1')?.svg ?? '', /#ABC2AE/)
  assert.ok(current.layers.some((layer) => layer.id === 'bonus-spot-beacon'))
  assert.match(text(current), /CW\s+2 \/ 7/)
  assert.match(text(current), /Mixed\s+3 \/ 7/)
  assert.deepEqual(current.values, baseline.values)
})

test('one W7O report marks only the next missing O and stops marking after both are earned', () => {
  const first = render(view())
  assert.ok(first.layers.some((layer) => layer.id === 'spot-beacon-4'))
  assert.ok(!first.layers.some((layer) => layer.id === 'spot-beacon-5'))
  const second = render(view(), [qso('W7O')])
  assert.ok(!second.layers.some((layer) => layer.id === 'spot-beacon-4'))
  assert.ok(second.layers.some((layer) => layer.id === 'spot-beacon-5'))
  assert.equal(second.controls?.filter((control) => control.id === 'spot-W7O').length, 1)
  assert.match(text(second), /Second O needed/)

  const complete = render(
    view([report('W7O', { needed: false, status: 'CW: Both O contacts worked.' })]),
    [qso('W7O'), qso('W7O', 'second-o', '40m')],
  )
  assert.ok(!complete.layers.some((layer) => /^spot-beacon-[45]$/.test(layer.id)))
  assert.ok(!complete.controls?.some((control) => control.id === 'spot-W7O'))
  assert.match(text(complete), /KNOWN SPOT/)
  assert.match(text(complete), /No new CW credit/)
})

test('fresh same-context O reports stay neutral while the second O is still missing', () => {
  const current = render(
    view([
      report('W7O', {
        needed: false,
        status: 'CW: Second O still needed; use another band or UTC date.',
      }),
    ]),
    [qso('W7O')],
  )
  const marker = current.layers.find((layer) => layer.id === 'spot-beacon-5')
  assert.match(marker?.svg ?? '', /#ABC2AE/)
  assert.doesNotMatch(marker?.svg ?? '', /#7CD9CF/)
  assert.match(
    current.controls?.find((control) => control.id === 'spot-W7O')?.label ?? '',
    /another band or UTC date/,
  )
})

test('large scenes expose radio tuning controls with the selected callsign and literal frequency', () => {
  const current = render(view([report(), report('W7B')]), [qso('W7O')])
  assert.equal(current.controls?.find((control) => control.id === 'tune-spot')?.event, 'tune-spot')
  assert.equal(current.controls?.find((control) => control.id === 'spot-W7O')?.event, 'spot:W7O')
  assert.equal(current.controls?.find((control) => control.id === 'next-spot')?.event, 'next-spot')
  assert.match(text(current), /W7O/)
  assert.match(text(current), /7050\.0 CW/)
  assert.match(text(current), /Tune 7050\.0/)
  assert.match(
    current.controls?.find((control) => control.id === 'tune-spot')?.label ?? '',
    /Tune radio to W7O, 7050\.0 kHz, 40m CW/,
  )
})

test('small scenes keep call and frequency visible with one full-size tune target and readable outcome', () => {
  const status = 'Radio disconnected. Connect it in settings.'
  const current = render(view([report()], { tuneStatus: status }), [qso('W7O')], 280, 300)
  assert.match(text(current), /W7O 7050\.0/)
  const visibleStatus =
    current.layers.find((layer) => layer.id === 'tune-label')?.text?.literal ?? ''
  assert.match(visibleStatus, /^Radio discon/)
  assert.ok(visibleStatus.endsWith('…'))
  assert.deepEqual(
    current.controls?.map((control) => control.id),
    ['tune-spot'],
  )
  const tune = current.controls?.[0]
  assert.ok(tune)
  assert.equal(tune.height, 44)
  assert.ok((tune.width ?? 0) >= 44)
  assert.ok(tune.label.includes(status))
})

test('integrated hit targets stay inside the scene and clear the bonus card at supported sizes', () => {
  for (const [width, height] of [
    [280, 300],
    [320, 620],
    [400, 320],
    [560, 660],
    [800, 300],
  ]) {
    const current = render(
      view([report(), report('W7B'), report('W4S')]),
      [qso('W7O')],
      width,
      height,
    )
    const bonusY = current.layers.find((layer) => layer.id === 'bonus-card')?.y ?? 0
    for (const control of current.controls ?? []) {
      const { x = 0, y = 0, width: w = 0, height: h = 0 } = control
      assert.ok(x >= 0 && y >= 0, `${width}×${height}: ${control.id} starts in bounds`)
      assert.ok(
        x + w <= width && y + h <= height,
        `${width}×${height}: ${control.id} ends in bounds`,
      )
      assert.ok(w >= 44 && h >= 44, `${width}×${height}: ${control.id} has a usable target`)
      if (control.id === 'tune-spot' || control.id === 'next-spot')
        assert.ok(y + h <= bonusY, `${width}×${height}: ${control.id} clears bonus card`)
    }
    if (width < 400) assert.ok(!current.controls?.some((control) => /^spot-W7/.test(control.id)))
    assert.equal(new Set(current.layers.map((layer) => layer.id)).size, current.layers.length)
    assert.equal(
      new Set(current.controls?.map((control) => control.id)).size,
      current.controls?.length,
    )
  }
})

test('W4S stays on its bonus card with a usable target even when letter targets are too narrow', () => {
  const current = render(view([report('W4S')]), [], 280, 300)
  assert.ok(current.layers.some((layer) => layer.id === 'bonus-spot-beacon'))
  assert.ok(!current.layers.some((layer) => /^spot-beacon-/.test(layer.id)))
  const bonus = current.controls?.find((control) => control.id === 'spot-W4S')
  assert.equal(bonus?.event, 'spot:W4S')
  assert.ok((bonus?.height ?? 0) >= 44)
  assert.match(text(current), /W4S is still in the brush/)
})

test('spot arrivals add static status indicators without starting celebrations or new motion', () => {
  for (const reduced of [false, true]) {
    const current = render(view([report(), report('W4S')]), [], 560, 660, quiet, reduced)
    assert.equal(current.values.hop, 0)
    assert.equal(current.values.wave, 0)
    assert.equal(current.values['skunk-hop'], 0)
    for (const layer of current.layers.filter((layer) => layer.id.includes('spot-beacon'))) {
      assert.equal(layer.pulse, undefined)
      assert.equal(layer.transitionMs, undefined)
      assert.equal(layer.translateY, undefined)
      assert.equal(layer.rotation, undefined)
    }
    assert.ok(!current.layers.some((layer) => layer.id.startsWith('letter-sparkle-')))
  }
})

test('earned celebrations retain journal and animation priority over live leads', () => {
  const found: CelebrationFrame = {
    kind: 'letter',
    label: 'CW B found!',
    letters: ['B'],
    mode: 'CW',
    phase: 1,
    hopping: true,
    nextTick: true,
  }
  const current = render(view(), [qso('W7B')], 560, 660, found)
  assert.match(text(current), /CW B found!/)
  assert.ok(!current.controls?.some((control) => control.id === 'tune-spot'))
  assert.ok(current.controls?.some((control) => control.id === 'wave'))
  assert.equal(current.values.hop, 1)
  assert.ok(current.layers.some((layer) => layer.id === 'letter-sparkle-0'))
})

test('empty, unsupported and unavailable spots preserve the original forest and wave', () => {
  const baseline = render()
  for (const status of ['empty', 'unsupported', 'unavailable'] as const) {
    const current = render(view([report()], { status }))
    assert.deepEqual(current, baseline)
  }
})

test('missing radio availability fails closed without offering a tuning action', () => {
  const current = render(
    view([report(), report('W4S')], { radio: undefined, tuneStatus: 'Radio tune requested.' }),
  )
  assert.match(text(current), /Manual tuning/)
  assert.doesNotMatch(text(current), /Radio tune requested|Tune radio|Tune 7050/)
  assert.ok(!current.controls?.some((control) => control.id === 'tune-spot'))
  assert.equal(
    current.controls?.find((control) => control.id === 'spot-W7O')?.event,
    'select-spot:W7O',
  )
  assert.equal(
    current.controls?.find((control) => control.id === 'spot-W4S')?.event,
    'select-spot:W4S',
  )
  assert.ok(
    current.controls
      ?.filter((control) => control.id.startsWith('spot-'))
      .every((control) => control.label.startsWith('Show ')),
  )
})

test('connecting and manual radios keep spot selection while advertising no radio actions', () => {
  for (const radio of [
    { status: 'connecting', message: 'The logging radio is connecting. Wait for CAT to be ready.' },
    { status: 'manual', message: 'The logging radio is disconnected. Set its frequency manually.' },
  ] as const) {
    const current = render(view([report(), report('W7B'), report('W4S')], { radio }))
    assert.match(text(current), radio.status === 'connecting' ? /Connecting…/ : /Manual tuning/)
    assert.ok(text(current).includes(radio.message))
    assert.ok(!current.controls?.some((control) => control.id === 'tune-spot'))
    assert.ok(!current.layers.some((layer) => layer.id === 'tune-button'))
    for (const call of ['W7O', 'W7B', 'W4S']) {
      const control = current.controls?.find((candidate) => candidate.id === `spot-${call}`)
      assert.equal(control?.event, `select-spot:${call}`)
      assert.ok(control?.label.startsWith(`Show ${call}, `))
    }
    assert.equal(
      current.controls?.find((control) => control.id === 'next-spot')?.event,
      'next-spot',
    )
    assert.ok(current.controls?.every((control) => !/\bTune\b/.test(control.label)))
  }
})

test('tiny disconnected and connecting journals retain call and frequency without becoming buttons', () => {
  for (const [status, label] of [
    ['manual', 'Manual tuning'],
    ['connecting', 'Connecting…'],
  ] as const) {
    const current = render(
      view([report()], { radio: { status, message: 'Radio unavailable.' } }),
      [],
      280,
      300,
    )
    assert.match(text(current), /W7O 7050\.0/)
    assert.equal(current.layers.find((layer) => layer.id === 'tune-label')?.text?.literal, label)
    assert.deepEqual(current.controls, [])
    assert.ok(!current.layers.some((layer) => layer.id === 'tune-button'))
    const journal = current.layers.find((layer) => layer.id === 'journal-card')
    assert.equal(journal?.height, 44)
  }
})

test('radio availability changes preserve progress and restore tune controls only when ready', () => {
  const qsos = [qso('W7B', 'mixed-b', '20m', 'SSB'), qso('W7O')]
  const rows = [report(), report('W7B'), report('W4S')]
  const ready = render(view(rows), qsos)
  for (const status of ['connecting', 'manual'] as const) {
    const changed = render(
      view(rows, { radio: { status, message: 'Radio connection changed.' } }),
      qsos,
    )
    for (const id of [
      'tile-0',
      'tile-4',
      'mixed-dot-0',
      'primary-score-text',
      'mixed-score-text',
      'bonus-status',
    ])
      assert.deepEqual(
        changed.layers.find((layer) => layer.id === id),
        ready.layers.find((layer) => layer.id === id),
      )
    assert.deepEqual(changed.values, ready.values)
    assert.ok(
      !changed.controls?.some(
        (control) => control.event === 'tune-spot' || control.event?.startsWith('spot:'),
      ),
    )
  }
  assert.deepEqual(render(view(rows), qsos), ready)
})

test('manual and connecting scenes retain bounded selection targets across narrow and large layouts', () => {
  for (const [width, height] of [
    [280, 300],
    [320, 620],
    [400, 320],
    [560, 660],
    [800, 300],
  ]) {
    for (const status of ['manual', 'connecting'] as const) {
      const current = render(
        view([report(), report('W7B'), report('W4S')], {
          radio: { status, message: 'No logging radio is selected. Set the frequency manually.' },
        }),
        [qso('W7O')],
        width,
        height,
      )
      for (const control of current.controls ?? []) {
        const { x = 0, y = 0, width: w = 0, height: h = 0 } = control
        assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height)
        assert.ok(w >= 44 && h >= 44)
        assert.ok(control.event === 'next-spot' || control.event?.startsWith('select-spot:'))
      }
      if (width < 400) assert.ok(!current.controls?.some((control) => /^spot-W7/.test(control.id)))
    }
  }
})
