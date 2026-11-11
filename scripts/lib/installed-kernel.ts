import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createContext, runInContext } from 'node:vm'
import type { ActivationApi } from '@ham2k/extension-sdk'

interface KernelExports {
  sharedVersions: Record<string, string>
  registeredHooks(): string[]
  registerSocket?(listener: (event: { type: string }) => void): number
  defineExtension(definition: {
    key: string
    version: string
    onShow?(): void
    onHide?(): void
    onActivation(context: {
      timers?: ActivationApi['timers']
      registerHook(
        category: string,
        definition: {
          key: string
          hook: { probe(args: unknown, context: Record<string, unknown>): Promise<string[]> }
        },
      ): void
    }): void
  }): void
}

type HostArguments = {
  beginBundle: [key: string, api: number | null]
  endBundle: []
  activateAll: []
  invokeHook: [id: number, category: string, key: string, method: string, argsJson: string]
  hostResponse: [id: number, ok: boolean, resultJson: string]
  runTimers: []
  setAppVisible: [visible: boolean]
  socketEvent: [id: number, eventJson: string]
}

type HostEntry = keyof HostArguments
type LegacyKernel = KernelExports & {
  [Entry in HostEntry]?: (...args: HostArguments[Entry]) => unknown
}
interface ClaimedKernel extends KernelExports {
  claimBridge(token: string): void
  bridge<Entry extends HostEntry>(
    token: string,
    entry: Entry,
    ...args: HostArguments[Entry]
  ): unknown
}

export interface KernelHostCall {
  method: string
  params?: Record<string, unknown>
}

interface HookResult {
  id: number
  ok: boolean
  value?: unknown
  error?: string
}

type KernelMessage =
  | ({ type: 'hostCall'; callId: number } & KernelHostCall)
  | ({ type: 'result' } & HookResult)
  | { type: 'log'; message: string }
  | { type: 'timerWake' }

interface KernelOptions {
  onHostCall(call: KernelHostCall): unknown
  onLog?(message: string): void
  onTimerWake?(): void
}

export function createInstalledKernel(source: string, options: KernelOptions) {
  const pending = new Map<number, (result: HookResult) => void>()
  let nextInvocation = 1
  const context = createContext({
    performance,
    sendMessage(_channel: string, raw: string) {
      const message = JSON.parse(raw) as KernelMessage
      if (message.type === 'hostCall') {
        queueMicrotask(() => {
          void respond(message)
        })
      } else if (message.type === 'result') pending.get(message.id)?.(message)
      else if (message.type === 'log') options.onLog?.(message.message)
      else if (message.type === 'timerWake') options.onTimerWake?.()
    },
  })
  runInContext(source, context, { filename: 'installed-kernel.js', timeout: 5000 })
  const halo = context.__halo as ClaimedKernel | undefined
  const polo = context.__polo as LegacyKernel | undefined
  const kernel = halo ?? polo
  if (!kernel) throw new Error('Installed app has no recognizable Ham2K JavaScript kernel.')

  const token = randomUUID()
  // API 16 separates the native host's entries from the bundle's SDK surface.
  // Claim once before the first bundle and keep the token out of VM globals.
  halo?.claimBridge(token)

  function callHost<Entry extends HostEntry>(entry: Entry, ...args: HostArguments[Entry]): unknown {
    if (halo) return halo.bridge(token, entry, ...args)
    const call = polo?.[entry]
    if (!call) throw new Error(`Installed Ham2K kernel has no ${entry} host entry.`)
    return Reflect.apply(call, polo, args)
  }

  async function respond(message: KernelHostCall & { callId: number }) {
    let payload: string
    try {
      payload = JSON.stringify((await options.onHostCall(message)) ?? null)
    } catch (error) {
      callHost(
        'hostResponse',
        message.callId,
        false,
        JSON.stringify(error instanceof Error ? error.message : String(error)),
      )
      return
    }
    callHost('hostResponse', message.callId, true, payload)
  }

  return {
    kernel,
    loadBundle(manifest: { key: string; api?: unknown }, bundle: string, filename: string) {
      callHost('beginBundle', manifest.key, typeof manifest.api === 'number' ? manifest.api : null)
      try {
        runInContext(bundle, context, { filename, timeout: 5000 })
      } finally {
        callHost('endBundle')
      }
    },
    activateAll: () => callHost('activateAll'),
    runTimers: halo || polo?.runTimers ? () => callHost('runTimers') : undefined,
    setAppVisible:
      halo || polo?.setAppVisible
        ? (visible: boolean) => callHost('setAppVisible', visible)
        : undefined,
    socketEvent:
      halo || polo?.socketEvent
        ? (id: number, event: { type: string }) =>
            callHost('socketEvent', id, JSON.stringify(event))
        : undefined,
    invokeHook(category: string, key: string, method: string, args: unknown) {
      const id = nextInvocation++
      const label = `${category}/${key}.${method}`
      return new Promise<unknown>((resolve, reject) => {
        const deadline = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`${label} exceeded the host five-second deadline.`))
        }, 5000)
        function complete() {
          clearTimeout(deadline)
          pending.delete(id)
        }
        pending.set(id, (result) => {
          complete()
          if (result.ok) resolve(result.value)
          else reject(new Error(`${label} failed: ${result.error ?? 'unknown kernel error'}`))
        })
        try {
          callHost('invokeHook', id, category, key, method, JSON.stringify(args))
        } catch (error) {
          complete()
          reject(error)
        }
      })
    },
  }
}
