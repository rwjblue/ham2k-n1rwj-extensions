import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import type {
  ActivationApi,
  ClusterHook,
  ClusterLine,
  ClusterMatch,
  ClusterReply,
  ClusterStatus,
  ExtensionDefinition,
  Spot,
  SpotsHook,
} from '@ham2k/extension-sdk'
import { buildExtension } from '@ham2k/extension-tools'
import { build } from 'esbuild'

export interface ClusterSpotsHarnessHost {
  clusterStatus(): Promise<ClusterStatus>
  clusterLines(args?: {
    after?: number
    limit?: number
    match?: ClusterMatch
  }): Promise<ClusterLine[]>
  clusterSubscribe(args?: { match?: ClusterMatch }): Promise<ClusterStatus>
  clusterUnsubscribe(): Promise<unknown>
  clusterSend(command: string): Promise<ClusterReply>
  putSpots(spots: Spot[]): void | Promise<void>
  removeSpots(keys: string[]): void | Promise<void>
  replaceSpots?(spots: Spot[]): void | Promise<void>
  log?(message: string): void
}

const extensionPath = 'extensions/spots/ham2k-cluster-spots'
const partiesPath = 'packages/qso-parties/src'
const upstreamFiles = [
  `${extensionPath}/manifest.json`,
  `${extensionPath}/src/index.ts`,
  `${extensionPath}/src/parse.ts`,
  `${extensionPath}/src/spotText.ts`,
  `${extensionPath}/src/i18n.ts`,
  `${extensionPath}/src/i18n/en.json`,
  `${extensionPath}/src/i18n/es.json`,
  `${partiesPath}/identities.ts`,
  `${partiesPath}/identity.ts`,
]

export interface ClusterSpotsHarness {
  fetchSpots(): Promise<Spot[]>
  onLines(lines: ClusterLine[]): Promise<void>
  dispose(): void
}

type HarnessFactory = (host: ClusterSpotsHarnessHost) => ClusterSpotsHarness

/** Build the actual upstream code at RBN's vendor pin and load a fresh VM per connection. */
export async function prepareClusterSpots(commit: string): Promise<HarnessFactory> {
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Cluster Spots needs a full commit SHA.')

  const files = await Promise.all(
    upstreamFiles.map(async (path) => {
      const response = await fetch(
        `https://raw.githubusercontent.com/ham2k/extensions/${commit}/${path}`,
        { signal: AbortSignal.timeout(30_000) },
      )
      if (!response.ok) throw new Error(`Cluster Spots source ${path}: HTTP ${response.status}`)
      return { path, contents: await response.text() }
    }),
  )
  const scratch = await mkdtemp(join(tmpdir(), 'rbn-cluster-upstream-'))
  try {
    const dir = join(scratch, extensionPath)
    await symlink(
      fileURLToPath(new URL('../../node_modules/', import.meta.url)),
      join(scratch, 'node_modules'),
      'junction',
    )
    for (const file of files) {
      const target = join(scratch, file.path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.contents)
    }
    const { outDir } = await buildExtension(
      (options) =>
        build({
          ...options,
          alias: {
            ...options.alias,
            '@ham2k/qso-parties/identities': join(scratch, partiesPath, 'identities.ts'),
            '@ham2k/qso-parties/identity': join(scratch, partiesPath, 'identity.ts'),
          },
        }),
      { dir },
    )
    return await prepareBundle(outDir, 'ham2k-cluster-spots')
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/** Load the normal RBN build with its Vail input empty, so every report is attributable to Telnet. */
export function prepareRbnCluster(): Promise<HarnessFactory> {
  const dir = fileURLToPath(new URL('../../extensions/tools/n1rwj-rbn/build/', import.meta.url))
  return prepareBundle(dir, 'n1rwj-rbn')
}

async function prepareBundle(dir: string, key: string): Promise<HarnessFactory> {
  const [source, manifestText] = await Promise.all([
    readFile(join(dir, 'index.js'), 'utf8'),
    readFile(join(dir, 'manifest.json'), 'utf8'),
  ])
  const manifest = JSON.parse(manifestText) as { sharedDependencies: Record<string, string> }
  const sharedModules = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.sharedDependencies).map(async (name) => {
        const module = await import(name)
        return [name, name === 'i18next' ? module.default : module]
      }),
    ),
  )
  return (host) => activateBundle(source, sharedModules, key, host)
}

function matchOf(value: unknown): ClusterMatch | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map((pattern: string | { source: string; flags: string }) =>
    typeof pattern === 'string' ? pattern : new RegExp(pattern.source, pattern.flags),
  )
}

function activateBundle(
  source: string,
  sharedModules: Record<string, unknown>,
  key: string,
  host: ClusterSpotsHarnessHost,
): ClusterSpotsHarness {
  const definitions: ExtensionDefinition[] = []
  const sandbox = createContext({
    __polo: {
      sharedModules,
      defineExtension: (definition: ExtensionDefinition) => definitions.push(definition),
      log: (message: string) => host.log?.(message),
    },
  })
  runInContext(source, sandbox, { timeout: 5_000, filename: `${key}.js` })
  if (definitions.length !== 1 || definitions[0].key !== key) {
    throw new Error(`Expected one ${key} definition.`)
  }
  const definition = definitions[0]

  let cluster: ClusterHook | undefined
  let spots: SpotsHook | undefined
  let disposed = false
  let nextTimer = 0
  const pending = new Map<number, NodeJS.Timeout>()
  const timers: NonNullable<ActivationApi['timers']> = {
    set(callback, delay, repeat, args) {
      if (disposed || typeof callback !== 'function' || typeof delay !== 'number') {
        throw new Error(`Invalid timer for ${key}.`)
      }
      const id = ++nextTimer
      const fire = () => {
        if (!repeat) pending.delete(id)
        callback(...args)
      }
      pending.set(id, repeat ? setInterval(fire, delay) : setTimeout(fire, delay))
      return id
    },
    clear(id) {
      if (typeof id !== 'number') return
      clearTimeout(pending.get(id))
      pending.delete(id)
    },
  }

  definition.onActivation({
    timers,
    registerHook(category, registration) {
      if (category === 'cluster') cluster = registration.hook as ClusterHook
      if (category === 'spots') spots = registration.hook as SpotsHook
    },
    async hostCall(method, params) {
      if (disposed) throw new Error(`${key} harness is closed.`)
      switch (method) {
        case 'getSettings':
          return { extensions: { 'extension_n1rwj-rbn': { spotMode: 'CW', spotContinents: [] } } }
        case 'fetch':
          if (key !== 'n1rwj-rbn' || new URL(String(params.url)).hostname !== 'vailrerbn.com') {
            throw new Error(`Unexpected fetch from ${key}: ${String(params.url)}`)
          }
          return { status: 200, body: '{"spots":[]}' }
        case 'clusterStatus':
          return host.clusterStatus()
        case 'clusterLines':
          return host.clusterLines({
            after: typeof params.after === 'number' ? params.after : undefined,
            limit: typeof params.limit === 'number' ? params.limit : undefined,
            match: matchOf(params.match),
          })
        case 'clusterSubscribe':
          return host.clusterSubscribe({ match: matchOf(params.match) })
        case 'clusterUnsubscribe':
          return host.clusterUnsubscribe()
        case 'clusterSend':
          return host.clusterSend(String(params.command))
        case 'putSpots':
          return host.putSpots(params.spots as Spot[])
        case 'removeSpots':
          return host.removeSpots(params.keys as string[])
        case 'replaceSpots':
          return host.replaceSpots?.(params.spots as Spot[])
        default:
          throw new Error(`Unsupported ${key} harness host call: ${method}`)
      }
    },
  })
  if (!spots || !cluster) throw new Error(`${key} did not register its live hooks.`)
  const spotsHook = spots
  const clusterHook = cluster
  return {
    fetchSpots: () => spotsHook.fetchSpots({}, { online: true, distanceUnits: 'miles' }),
    onLines: (lines) => clusterHook.onLines({ lines }, { online: true }),
    dispose() {
      if (disposed) return
      void definition.onHide?.()
      disposed = true
      for (const id of pending.keys()) timers.clear(id)
    },
  }
}
