import type {
  CommandHook,
  HookContext,
  PanelHook,
  PanelRadioState,
  PanelRenderArgs,
  PanelSceneEvent,
} from '@ham2k/extension-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import { createHooks } from '../src/index.ts'

vi.mock('@ham2k/extension-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ham2k/extension-sdk')>()),
  defineExtension: vi.fn(),
  host: {},
}))

afterEach(() => vi.useRealTimers())

const context: HookContext = { online: false }
const macro = { label: 'Set filter', alias: 'Filter', radio: 'k4-main', text: 'BW0040;IS 0000;' }
const connectedRadio: PanelRadioState = {
  id: macro.radio,
  name: 'K4 Main',
  status: 'connected',
  stale: false,
  problem: null,
  frequencyHz: 14_050_000,
  mode: 'CW',
  powerWatts: 20,
  transmitting: false,
  meters: {},
  canTune: true,
  spectrum: null,
}

function fixture(
  macros: (typeof macro & { format?: 'text' | 'hex' })[] = [macro],
  radio = connectedRadio,
) {
  const radioHost = {
    getSettings: vi.fn(async () => ({
      extensions: { 'extension_n1rwj-cat-macros': { macros } },
    })),
    readRadio: vi.fn(async () => radio),
    sendRadioRaw: vi.fn(async () => ({ accepted: true, state: radio })),
    statusBar: { setMessage: vi.fn(async () => {}) },
  }
  const hooks: { panel: PanelHook; command: CommandHook } = createHooks(radioHost)
  return { radioHost, ...hooks }
}

async function firstButton(
  panel: PanelHook,
  overrides: Partial<PanelRenderArgs> = {},
  hookContext = context,
) {
  const [descriptor] = await panel.getPanels({}, hookContext)
  if (!descriptor) throw new Error('Expected a CAT macros panel')
  const args: PanelRenderArgs = {
    panelKey: descriptor.key,
    instanceId: 'cat-macros-1',
    operation: {},
    qsoCount: 0,
    config: {},
    reason: 'initial',
    ...overrides,
  }
  const content = await panel.render(args, hookContext)
  if (content.kind !== 'scene') throw new Error('Expected a CAT macro scene')
  const button = content.scene.controls?.find((control) => control.kind === 'nativeButton')
  if (!button?.event || !panel.onEvent) throw new Error('Expected a CAT macro button event')
  const event = { controlId: button.id, action: button.event }
  const onEvent = panel.onEvent.bind(panel)
  return {
    button,
    press: (phase: PanelSceneEvent['phase'] = 'activate', sequence = 1) =>
      onEvent({ ...args, event: { ...event, phase, sequence } }, hookContext),
  }
}

it('previews a shortcut without dispatching and sends its exact CAT text on execution', async () => {
  const { command, radioHost } = fixture()

  const preview = await command.interpret({ input: 'catmacro filter' }, context)
  expect(preview).toHaveProperty('describe')
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()

  const result = await command.interpret({ input: 'catmacro filter', execute: true }, context)
  expect(result).toHaveProperty('confirm')
  expect(radioHost.readRadio).toHaveBeenCalledWith(macro.radio)
  expect(radioHost.sendRadioRaw).toHaveBeenCalledExactlyOnceWith({
    id: macro.radio,
    selection: macro.radio,
    text: macro.text,
  })
})

it('refuses an ambiguous alias without sending to either radio', async () => {
  const conflicting = { ...macro, alias: 'FILTER', radio: 'k4-sub' }
  const { command, radioHost } = fixture([macro, conflicting])

  const result = await command.interpret({ input: 'CATMACRO FILTER', execute: true }, context)

  expect(result).toHaveProperty('error')
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()
})

it('refuses a macro when its pinned radio is disconnected', async () => {
  const { command, radioHost } = fixture([macro], { ...connectedRadio, status: 'disconnected' })

  const result = await command.interpret({ input: 'CATMACRO FILTER', execute: true }, context)

  expect(result).toHaveProperty('error')
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()
})

it('dispatches the same saved macro only when its native button is activated', async () => {
  const { panel, radioHost } = fixture()
  const { button, press } = await firstButton(panel)
  expect(button.label).toBe(macro.label)

  await press('change')
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()

  await press('activate', 2)
  expect(radioHost.sendRadioRaw).toHaveBeenCalledExactlyOnceWith({
    id: macro.radio,
    selection: macro.radio,
    text: macro.text,
  })
  expect(radioHost.statusBar.setMessage).toHaveBeenCalledOnce()

  radioHost.sendRadioRaw.mockClear()
  radioHost.getSettings.mockResolvedValue({
    extensions: { 'extension_n1rwj-cat-macros': { macros: [{ ...macro, text: 'FA;' }] } },
  })
  await press('activate', 3)
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()
  expect(radioHost.statusBar.setMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: expect.stringContaining('changed') }),
  )
})

it('renders a Liquid label and expands matching context against fresh radio readings on both execution paths', async () => {
  const now = Date.UTC(2026, 10, 22, 14, 7)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  const hookContext = { ...context, appName: 'HaLo Test' }
  const operation = { stationCall: 'N1RWJ' }
  const qso = { their: { call: 'W1AW//K2ABC' }, callField: { call: 'K2ABC' } }
  const { panel, command, radioHost } = fixture([
    {
      ...macro,
      label:
        '{{ app.name }} · {{ op.station }} · {{ qso.call }} · {{ radio.name }} {{ radio.mode | downcase }} · {{ now | date: "%H:%M" }}',
      text:
        "{% if app.name == 'HaLo Test' and op.station == 'N1RWJ' and now != blank %}" +
        '  FA{{ radio.frequencyHz | pad: 11 }};\nPC{{ radio.powerWatts | pad: 3 }};  {% endif %}',
    },
  ])
  const { button, press } = await firstButton(
    panel,
    { operation, qso, clock: { nowMillis: now, realNowMillis: now } },
    hookContext,
  )
  expect(button.label).toBe('HaLo Test · N1RWJ · K2ABC · K4 Main cw · 14:07')
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()

  radioHost.readRadio.mockClear()
  const commandArgs = { input: 'CATMACRO FILTER', operation }
  const preview = await command.interpret(commandArgs, hookContext)
  expect(preview).toHaveProperty('describe', expect.stringContaining('FILTER'))
  expect(radioHost.readRadio).not.toHaveBeenCalled()
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()

  radioHost.readRadio.mockResolvedValue({
    ...connectedRadio,
    mode: 'USB',
    frequencyHz: 14_075_000,
    powerWatts: 42,
  })
  const expected = {
    id: macro.radio,
    selection: macro.radio,
    text: '  FA00014075000;\nPC042;  ',
  }
  await press()
  expect(radioHost.sendRadioRaw).toHaveBeenCalledExactlyOnceWith(expected)

  const result = await command.interpret({ ...commandArgs, execute: true }, hookContext)
  expect(result).toHaveProperty('confirm')
  expect(radioHost.sendRadioRaw).toHaveBeenCalledTimes(2)
  expect(radioHost.sendRadioRaw).toHaveBeenLastCalledWith(expected)
})

it('uses the draft on a pane click and handles its absence on a keyboard shortcut', async () => {
  const { panel, command, radioHost } = fixture([
    {
      ...macro,
      text: '{% if qso.call != blank %}BW0040;{% else %}BW0200;{% endif %}',
    },
  ])
  const { press } = await firstButton(panel, { qso: { their: { call: 'W1AW' } } })

  await press()
  expect(radioHost.sendRadioRaw).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: 'BW0040;' }),
  )

  const result = await command.interpret({ input: 'CATMACRO FILTER', execute: true }, context)
  expect(result).toHaveProperty('confirm')
  expect(radioHost.sendRadioRaw).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: 'BW0200;' }),
  )
})

it('sends the IC-7300 CI-V command as bytes from either the button or its shortcut', async () => {
  const radio = { ...connectedRadio, id: 'ic7300', name: 'IC-7300' }
  const { panel, command, radioHost } = fixture(
    [
      {
        ...macro,
        label: 'Noise blanker on',
        alias: 'NB-ON',
        radio: radio.id,
        format: 'hex',
        text: 'fe FE 94 e0\n16 22 {{ 1 | pad: 2 }} fd',
      },
    ],
    radio,
  )
  const { press } = await firstButton(panel)
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()

  await press()
  const result = await command.interpret({ input: 'CATMACRO NB-ON', execute: true }, context)
  expect(result).toHaveProperty('confirm')

  const expected = {
    id: radio.id,
    selection: radio.id,
    bytes: [0xfe, 0xfe, 0x94, 0xe0, 0x16, 0x22, 0x01, 0xfd],
  }
  expect(radioHost.sendRadioRaw.mock.calls).toEqual([[expected], [expected]])
})

it.each(['01z', '1', '0102'])(
  'refuses malformed hex byte %s without dispatching',
  async (token) => {
    const { panel, command, radioHost } = fixture([
      { ...macro, format: 'hex', text: `FE FE 94 E0 16 22 ${token} FD` },
    ])
    const { press } = await firstButton(panel)

    await press()
    expect(radioHost.statusBar.setMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/hex|byte/i) }),
    )

    const result = await command.interpret({ input: 'CATMACRO FILTER', execute: true }, context)
    expect(result).toHaveProperty('error', expect.stringMatching(/hex|byte/i))
    expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()
  },
)

it.each([
  ['blank output', ' {% if radio.transmitting %}FA;{% endif %}\n ', /no command/i],
  ['a syntax error', '{% if radio.transmitting %}FA;', /not closed/i],
])('reports %s without dispatching CAT from either path', async (_description, text, error) => {
  const { panel, command, radioHost } = fixture([{ ...macro, text }])
  const { press } = await firstButton(panel)

  await press()
  expect(radioHost.statusBar.setMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: expect.stringMatching(error) }),
  )

  const result = await command.interpret({ input: 'CATMACRO FILTER', execute: true }, context)
  expect(result).toHaveProperty('error', expect.stringMatching(error))
  expect(radioHost.sendRadioRaw).not.toHaveBeenCalled()
})

it.each([
  ['an empty result', '{{ radio.missing }}', /^FILTER$/],
  ['a syntax error', '{% if radio.mode %}Set filter', /FILTER.*label|label.*FILTER/i],
])(
  'shows the alias for a label with %s and keeps valid CAT sendable',
  async (_description, label, expected) => {
    const { panel, radioHost } = fixture([{ ...macro, label }])
    const { button, press } = await firstButton(panel)
    expect(button.label).toMatch(expected)

    await press()
    expect(radioHost.sendRadioRaw).toHaveBeenCalledExactlyOnceWith({
      id: macro.radio,
      selection: macro.radio,
      text: macro.text,
    })
  },
)
