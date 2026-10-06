import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate as settleHostCalls } from 'node:timers/promises'
import { createContext, runInContext } from 'node:vm'
import type { ActivationApi, ExtensionDefinition, JSONValue, PanelHook } from '@ham2k/extension-sdk'
import { environment } from '../../packages/reception/tests/environment.ts'
import type { Manifest } from './extensions.ts'

/** A deterministic host timer bridge, without installing timer globals in the VM. */
export function createHostTimerHarness() {
  let elapsed = 0
  let sequence = 0
  const pending = new Map<number, { at: number; callback: () => void }>()
  const api: NonNullable<ActivationApi['timers']> = {
    set(callback, delay, repeat, args) {
      assert.equal(repeat, false, 'Reception work uses one-shot timers')
      assert.ok(typeof callback === 'function')
      assert.ok(typeof delay === 'number' && Number.isFinite(delay) && delay >= 0)
      assert.ok(pending.size < 16, 'Extension stays within the host timer limit')
      const id = ++sequence
      pending.set(id, { at: elapsed + delay, callback: () => callback(...args) })
      return id
    },
    clear(id) {
      assert.equal(typeof id, 'number')
      pending.delete(id as number)
    },
  }
  return {
    api,
    get pendingCount() {
      return pending.size
    },
    advance(millis: number) {
      const until = elapsed + millis
      while (true) {
        const due = [...pending.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        const [id, timer] = due
        pending.delete(id)
        elapsed = timer.at
        timer.callback()
      }
      elapsed = until
    },
  }
}

/** Exercises the selected SDK's actual binary and timer bridges in a sandbox VM.
 * This stand-in for the host is not a native Ham2K runtime test.
 */
export async function verifyPskBundle(path: string, manifest: Manifest) {
  const clock = Date.now()
  const timers = createHostTimerHarness()
  const definitions: ExtensionDefinition[] = []
  const calls: { method: string; params: Record<string, unknown> }[] = []
  const saved: Record<string, JSONValue> = {
    unrelated: 'preserved',
    'psk-reports-v1': JSON.stringify({
      version: 1,
      reports: [
        {
          id: 'cached',
          sc: 'N1RWJ',
          rc: 'K1ABC/P',
          sl: 'FN42',
          rl: 'FN31',
          f: 14074000,
          md: 'FT8',
          b: '20m',
          t: Math.floor(Date.now() / 1000) - 120,
        },
      ],
    }),
  }
  let listener: ((event: Record<string, unknown>) => void) | undefined
  let panel: PanelHook | undefined
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies ?? {}).map(async (name) => {
        const module = await import(name)
        return [name, name === 'i18next' ? module.default : module]
      }),
    ),
  )
  const sandbox = createContext({
    Date: class extends Date {
      static now() {
        return clock
      }
    },
    __polo: {
      sharedModules,
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
      registerSocket: (callback: typeof listener) => {
        listener = callback
        return 1
      },
      log: (message: string) => {
        throw new Error(message)
      },
    },
  })
  for (const name of ['setTimeout', 'setInterval', 'WebSocket', 'fetch', 'Buffer', 'process'])
    assert.equal(runInContext(`typeof ${name}`, sandbox), 'undefined')
  runInContext(await readFile(path, 'utf8'), sandbox, { timeout: 5000 })
  assert.equal(definitions.length, 1)
  assert.ok('api' in definitions[0])
  assert.equal(definitions[0].api, 5)
  definitions[0].onActivation({
    timers: timers.api,
    registerHook: (category, registration) => {
      assert.equal(category, 'panel')
      panel = registration.hook as PanelHook
    },
    hostCall: async (method, params) => {
      calls.push({ method, params })
      if (method === 'getSettings') return { extensions: { [`extension_${manifest.key}`]: saved } }
      if (method === 'setSettings') {
        assert.equal(params.ns, manifest.key)
        Object.assign(saved, params.values)
        return null
      }
      if (method === 'fetch')
        return {
          status: 200,
          body: `<pskreporter><receptionReport senderCallsign="N1RWJ" receiverCallsign="W1AW" receiverLocator="FN31" frequency="14074000" mode="FT8" flowStartSeconds="${Math.floor(Date.now() / 1000) - 60}"/></pskreporter>`,
        }
      return null
    },
  })
  assert.ok(panel)
  const args = {
    panelKey: 'psk-reporter',
    instanceId: 'smoke',
    environment: environment(),
    operation: { stationCall: 'N1RWJ', grid: 'FN42' },
    qsoCount: 0,
    config: {},
    reason: 'operation' as const,
  }
  assert.ok(JSON.stringify(await panel.render(args, { online: true })).includes('K1ABC/P'))
  assert.deepEqual(
    calls.filter((call) => call.method.startsWith('webSocket')).map((call) => call.method),
    ['webSocketOpen'],
  )
  const opened = calls.find((call) => call.method === 'webSocketOpen')
  assert.ok(opened)
  assert.equal(opened.params.url, 'wss://mqtt.pskreporter.info:1886')
  assert.equal(JSON.stringify(opened.params.protocols), '["mqtt"]')
  assert.ok(listener)
  listener({ type: 'open', protocol: 'mqtt' })
  const sent = () =>
    calls
      .filter((call) => call.method === 'webSocketSend')
      .map((call) => Buffer.from(String(call.params.binary), 'base64'))
  assert.equal(sent()[0][0], 0x10)
  const receive = (bytes: number[]) =>
    listener?.({ type: 'message', binary: Buffer.from(bytes).toString('base64') })
  receive([0x20, 2, 0, 0])
  assert.equal(sent()[1][0], 0x82)
  assert.ok(sent()[1].includes(Buffer.from('pskr/filter/v2/+/+/N1RWJ/#')))
  receive([0x90, 3, 0, 1, 0])
  const topic = Buffer.from('pskr/filter/v2/20m/FT8/N1RWJ/CU3AT/FN42/HM68/291/149')
  const payload = Buffer.from(
    JSON.stringify({
      sc: 'N1RWJ',
      rc: 'CU3AT',
      sl: 'FN42',
      rl: 'HM68',
      f: 14074000,
      md: 'FT8',
      b: '20m',
      t: Math.floor(Date.now() / 1000),
      rp: -12,
    }),
  )
  const body = [topic.length >> 8, topic.length & 255, ...topic, ...payload]
  const length: number[] = []
  let remaining = body.length
  do {
    const byte = remaining % 128
    remaining = Math.floor(remaining / 128)
    length.push(byte | (remaining ? 128 : 0))
  } while (remaining)
  receive([0x30, ...length, ...body])
  const content = await panel.render(args, { online: true })
  assert.equal(content.kind, 'scene')
  if (content.kind !== 'scene') throw new Error('Expected API-5 reception scene')
  const rendered = JSON.stringify(content)
  assert.ok(rendered.includes('Live reception'))
  assert.ok(rendered.includes('CU3AT'))
  const band = content.scene.controls?.find((control) => control.id === 'band')
  assert.equal(band?.kind, 'nativeDropdown')
  assert.ok(band?.event)
  const choice = await panel.onEvent?.(
    {
      ...args,
      event: {
        controlId: 'band',
        action: band.event,
        phase: 'commit',
        text: '20m',
        sequence: 1,
      },
    },
    { online: true },
  )
  assert.equal(choice?.strings?.band, '20m')
  const filtered = await panel.render(args, { online: true })
  if (filtered.kind !== 'scene') throw new Error('Expected committed reception scene')
  assert.equal(filtered.scene.strings?.band, '20m')
  const refresh = filtered.scene.controls?.find((control) => control.id === 'refresh')
  assert.ok(refresh?.event)
  await panel.onEvent?.(
    {
      ...args,
      event: { controlId: 'refresh', action: refresh.event, phase: 'activate', sequence: 2 },
    },
    { online: true },
  )
  // The event returns before HTTP; settle fixture host calls outside the sandbox VM.
  await settleHostCalls()
  const fetched = calls.find((call) => call.method === 'fetch')
  assert.ok(fetched)
  assert.equal(fetched.params.timeout, undefined)
  assert.ok(
    String(fetched.params.url).startsWith(
      'https://retrieve.pskreporter.info/query?senderCallsign=N1RWJ',
    ),
  )
  assert.ok(JSON.stringify(await panel.render(args, { online: true })).includes('W1AW'))
  // Real timer delays advance while sandbox Date stays frozen and no panel renders.
  timers.advance(15_000)
  assert.equal(sent()[sent().length - 1][0], 0xc0)
  receive([0xd0, 0])
  timers.advance(15_000)
  assert.equal(sent()[sent().length - 1][0], 0xe0)
  const socketCalls = calls.filter((call) => call.method.startsWith('webSocket'))
  assert.equal(socketCalls[socketCalls.length - 1]?.method, 'webSocketClose')
  for (let i = 0; i < 60; i++) await Promise.resolve()
  const historyBudget = saved['psk-history-next-request-v1']
  assert.ok(
    typeof historyBudget === 'number' ||
      (historyBudget &&
        typeof historyBudget === 'object' &&
        !Array.isArray(historyBudget) &&
        historyBudget.version === 2 &&
        historyBudget.remainingMs === 300_000),
  )
  assert.ok(String(saved['psk-reports-v1']).includes('CU3AT'))
  assert.equal(saved.unrelated, 'preserved')
  assert.ok(!calls.some((call) => call.method === 'kvGet' || call.method === 'kvSet'))
  await panel.render(args, { online: true })
  const opens = calls.filter((call) => call.method === 'webSocketOpen').length
  assert.equal(opens, 2)
  assert.ok(definitions[0].onHide)
  await definitions[0].onHide()
  timers.advance(300_000)
  await settleHostCalls()
  assert.equal(calls.filter((call) => call.method === 'webSocketOpen').length, opens)
  assert.equal(timers.pendingCount, 0)
  for (const name of ['setTimeout', 'setInterval', 'WebSocket', 'fetch', 'Buffer', 'process'])
    assert.equal(runInContext(`typeof ${name}`, sandbox), 'undefined')
  console.log(
    'Candidate SDK bundle smoke passed: socket grant, MQTT handshake, binary report, HTTP history, force reload, persistent settings, native scene, host timers, silent lease expiry, hide teardown.',
  )
}
