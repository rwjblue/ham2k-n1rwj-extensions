import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ActivationApi } from '@ham2k/extension-sdk'
import { satisfies } from 'semver'
import { selectExtensions } from './lib/extensions.ts'
import { createInstalledKernel } from './lib/installed-kernel.ts'

const assetsPath =
  'Contents/Frameworks/App.framework/Versions/A/Resources/flutter_assets/assets/extensions'

function appInfo(app: string) {
  const plist = join(app, 'Contents/Info.plist')
  const field = (name: string) =>
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${name}`, plist], {
      encoding: 'utf8',
    }).trim()
  return { app, version: field('CFBundleShortVersionString'), build: field('CFBundleVersion') }
}

async function selectApp(explicitPath?: string) {
  if (explicitPath) return { ...appInfo(explicitPath), selection: 'explicit path' }
  // App updates may retain the old Mac Logger directory while renaming the
  // executable to Power Logger. Check the running bundle path, not its name.
  const running = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' }).split('\n')
  const candidates = []
  for (const name of await readdir('/Applications')) {
    if (!/^Ham2K (?:Mac|Power) Logger(?: \([^)]+\))?\.app$/.test(name)) continue
    const app = join('/Applications', name)
    try {
      await access(join(app, assetsPath, 'kernel.js'))
      candidates.push({
        ...appInfo(app),
        running: running.some((command) => command.startsWith(`${app}/Contents/MacOS/`)),
      })
    } catch {
      // Ignore incomplete app copies; the explicit-path form reports errors.
    }
  }
  candidates.sort(
    (a, b) => Number(b.running) - Number(a.running) || Number(b.build) - Number(a.build),
  )
  const selected = candidates[0]
  if (!selected) {
    throw new Error('No Ham2K Logger app found in /Applications. Pass the installed .app path.')
  }
  return {
    app: selected.app,
    version: selected.version,
    build: selected.build,
    selection: selected.running ? 'running app' : 'latest installed build',
  }
}

export { assetsPath as installedHostAssetsPath, selectApp as selectInstalledHost }

export async function verifyInstalledHost(
  root: string,
  key?: string,
  appPath?: string,
): Promise<void> {
  const installation = await selectApp(appPath)
  const { app } = installation
  const assets = join(app, assetsPath)
  const kernelSource = await readFile(join(assets, 'kernel.js'), 'utf8')
  const extensions = await selectExtensions(root, key)
  const logs: string[] = []
  let timerWake = false
  const host = createInstalledKernel(kernelSource, {
    onHostCall: ({ method }) => (method === 'getSettings' ? { locale: 'en' } : null),
    onLog: (message) => logs.push(message),
    onTimerWake: () => {
      timerWake = true
    },
  })
  const { kernel } = host
  const problems: string[] = []
  let socketEventDelivered = false
  if (kernel.registerSocket && host.socketEvent) {
    const socketId = kernel.registerSocket((event) => {
      socketEventDelivered = event.type === 'close'
    })
    host.socketEvent(socketId, { type: 'close' })
  }
  for (const { manifest } of extensions) {
    if (Array.isArray(manifest.webSockets) && manifest.webSockets.length && !socketEventDelivered) {
      problems.push(
        `${manifest.key}: installed kernel lacks the API-2 WebSocket bridge; use build 171 or newer`,
      )
    }
    for (const [name, range] of Object.entries(manifest.sharedDependencies ?? {})) {
      const actual = kernel.sharedVersions[name]
      if (!actual || !satisfies(actual, range)) {
        problems.push(
          `${manifest.key} ${name}: requires ${range}; installed ${actual ?? 'missing'}`,
        )
      }
    }
  }

  const probeKey = 'n1rwj-host-probe'
  let timerBindings: ActivationApi['timers']
  let shown = 0
  let hidden = 0
  kernel.defineExtension({
    key: probeKey,
    version: '0.0.0',
    onShow() {
      shown++
    },
    onHide() {
      hidden++
    },
    onActivation({ registerHook, timers }) {
      timerBindings = timers
      registerHook('lookup', {
        key: probeKey,
        hook: { probe: async (_args, ctx) => Object.keys(ctx) },
      })
    },
  })
  await host.activateAll()
  const probe = await host.invokeHook('lookup', probeKey, 'probe', { online: false })
  const contextCapabilities = Array.isArray(probe) ? probe : []
  if (!contextCapabilities.includes('getHistoryForCall')) {
    problems.push(
      'HookContext.getHistoryForCall is unavailable; cross-operation history cannot run',
    )
  }

  // The SDK adopts activation's owner-bound set/clear pair; the installed
  // kernel posts timerWake and the native host responds through runTimers.
  // Exercise only that JavaScript contract here, with no wall-clock waiting.
  let fired = 0
  let cancelledFired = 0
  const timerCapabilities = {
    activationBindings:
      typeof timerBindings?.set === 'function' && typeof timerBindings?.clear === 'function',
    runTimers: Boolean(host.runTimers),
    wakeMessage: false,
    oneShot: false,
    cancellation: false,
    visibilityCallbacks: false,
  }
  if (timerCapabilities.activationBindings && host.runTimers && timerBindings) {
    timerBindings.set(() => fired++, 0, false, [])
    const cancelled = timerBindings.set(() => cancelledFired++, 0, false, [])
    timerBindings.clear(cancelled)
    host.runTimers()
    host.runTimers()
    timerCapabilities.wakeMessage = timerWake
    timerCapabilities.oneShot = fired === 1
    timerCapabilities.cancellation = cancelledFired === 0
  }
  if (host.setAppVisible) {
    host.setAppVisible(false)
    host.setAppVisible(true)
    timerCapabilities.visibilityCallbacks = hidden === 1 && shown === 1
  }
  for (const { manifest } of extensions) {
    if (
      typeof manifest.api === 'number' &&
      manifest.api >= 3 &&
      !Object.values(timerCapabilities).every(Boolean)
    ) {
      problems.push(
        `${manifest.key}: installed kernel lacks working API-3 timers or visibility callbacks; update Ham2K Logger`,
      )
    }
  }

  const registeredHooks: string[] = []
  if (problems.length === 0) {
    for (const { dir, manifest } of extensions) {
      const bundle = await readFile(join(dir, 'build/index.js'), 'utf8')
      host.loadBundle(manifest, bundle, `${manifest.key}-built-es2020.js`)
    }
    await host.activateAll()
    const allHooks = kernel.registeredHooks()
    for (const { manifest } of extensions)
      registeredHooks.push(...allHooks.filter((hook) => hook.endsWith(`(${manifest.key})`)))
    problems.push(...logs.filter((message) => message.includes('ERROR')))
  }

  console.log(
    JSON.stringify(
      {
        ...installation,
        kernelSha256: createHash('sha256').update(kernelSource).digest('hex'),
        sharedVersions: kernel.sharedVersions,
        contextCapabilities,
        timerCapabilities,
        socketEventDelivered,
        registeredHooks,
        compatible: problems.length === 0,
        problems,
        scope:
          'Installed JavaScript kernel under Node VM. This does not exercise native install checks, timer scheduling, or app UI.',
      },
      null,
      2,
    ),
  )
  if (problems.length) process.exitCode = 1
}
