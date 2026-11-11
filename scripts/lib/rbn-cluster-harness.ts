import { setTimeout as delay } from 'node:timers/promises'
import type { ClusterLine, ClusterMatch, ClusterStatus, Spot } from '@ham2k/extension-sdk'
import {
  clusterSkimmerLines,
  parseClusterReport,
} from '../../extensions/tools/n1rwj-rbn/src/cluster/parser.ts'
import {
  clusterAnnouncementPattern,
  clusterFeedCommands,
  isPromptFor,
  nodeProgramFromPrompt,
  spotTime,
} from '../../extensions/tools/n1rwj-rbn/src/vendor/cluster-spots.mjs'
import { connectClusterTelnet } from './rbn-cluster-telnet.ts'
import type { ClusterSpotsHarnessHost, prepareRbnCluster } from './rbn-cluster-upstream.ts'

export type ClusterPreset = ClusterStatus['node']

// PoLo's knownClusterNodes in app/lib/services/cluster/cluster_settings.dart.
export const poloClusterPresets = [
  { name: 'K3LR', host: 'dx.k3lr.com', port: 23 },
  { name: 'K1TTT', host: 'k1ttt.net', port: 7373 },
  { name: 'W3LPL', host: 'dxc.w3lpl.net', port: 7373 },
  { name: 'NC7J', host: 'dxc.nc7j.com', port: 7373 },
  { name: 'VE7CC-1', host: 've7cc.net', port: 23 },
] as const satisfies readonly ClusterPreset[]

type ExtensionFactory = Awaited<ReturnType<typeof prepareRbnCluster>>
type Client = 'RBN' | 'Cluster Spots'

interface CommandResult {
  client: Client
  command: string
  ok: boolean
  error?: string
  reply: string[]
}

const scrollbackSize = 5000
const ioTimeoutMs = 10_000
const setupTimeoutMs = 45_000
const historyCommand = 'SH/DX/100'
const broadcast = /^\s*(?:DX|WWV|WCY) de /i
const refusal =
  /^\s*(?:sorry|error|invalid|unknown command|unrecogni[sz]ed command|not allowed|permission denied|you (?:are not|need))\b/i
// biome-ignore lint/suspicious/noControlCharactersInRegex: Telnet spots can carry a bell.
const controlCharacters = /[\x00-\x1f\x7f]/g

function matcher(patterns?: ClusterMatch) {
  if (!patterns?.length) return () => true
  const regexes = patterns.map((pattern) =>
    typeof pattern === 'string'
      ? new RegExp(pattern)
      : new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')),
  )
  return (text: string) => regexes.some((regex) => regex.test(text.slice(0, 256)))
}

function spotIdentity(call: string, frequency: number, receiver: string, timeMs: number) {
  return JSON.stringify([
    call.toUpperCase(),
    frequency,
    receiver.toUpperCase().replace(/-#$/, ''),
    timeMs,
  ])
}

export async function samplePreset(
  preset: ClusterPreset,
  call: string,
  seconds: number,
  createRbn: ExtensionFactory,
  createClusterSpots?: ExtensionFactory,
) {
  let state: ClusterStatus['state'] = 'idle'
  let error: string | undefined
  let lastSeq = 0
  let sockets = 0
  let session: Awaited<ReturnType<typeof connectClusterTelnet>> | undefined
  let connecting: Promise<ClusterStatus> | undefined
  const scrollback: ClusterLine[] = []
  const commands: CommandResult[] = []
  const logs: string[] = []
  const subscriptions = new Map<Client, { cursor: number; matches: ReturnType<typeof matcher> }>()
  const liveKeys = new Set<string>()
  const parsedCwKeys = new Set<string>()
  const published = { RBN: new Set<string>(), 'Cluster Spots': new Set<string>() }
  const examples: string[] = []
  const rejectedCwExamples: string[] = []
  let wireCw = 0
  let rbnParsedCw = 0
  let qualiteeCw = 0
  let sampledAfter: number | undefined

  function status(): ClusterStatus {
    return { state, node: preset, call: session?.call, lastSeq, error }
  }

  function fail(reason: string) {
    state = 'failed'
    error = reason
  }

  function onLine(line: ClusterLine) {
    lastSeq = line.seq
    scrollback.push(line)
    if (scrollback.length > scrollbackSize) scrollback.shift()
    if (
      sampledAfter === undefined ||
      line.seq <= sampledAfter ||
      !clusterSkimmerLines.test(line.text)
    )
      return
    const report = parseClusterReport(line)
    const raw = clusterAnnouncementPattern.exec(line.text.replace(controlCharacters, ' ').trim())
    if (report?.mode !== 'CW' && (!raw || !/\b(?:CW|\d+ *WPM)\b/i.test(raw[4]))) return
    wireCw++
    if (/\bQ:\d/i.test(raw?.[4] ?? '')) qualiteeCw++
    if (examples.length < 3) examples.push(line.text)
    if (report?.mode === 'CW') {
      rbnParsedCw++
      const key = spotIdentity(report.call, report.frequencyKhz, report.receiver, report.timeMs)
      parsedCwKeys.add(key)
      liveKeys.add(key)
    } else if (rejectedCwExamples.length < 3) {
      rejectedCwExamples.push(line.text)
    }
    // Cluster Spots can publish lines that RBN's stricter report parser rejects.
    if (raw) {
      const [, receiver, frequency, call, , hhmm] = raw
      liveKeys.add(spotIdentity(call, Number(frequency), receiver, spotTime(hhmm, line.at)))
    }
  }

  function connect() {
    if (connecting) return connecting
    state = 'connecting'
    sockets++
    connecting = connectClusterTelnet({
      ...preset,
      call,
      timeoutMs: ioTimeoutMs,
      onLine,
      onClose: fail,
    }).then(
      (link) => {
        session = link
        state = 'connected'
        return status()
      },
      (reason: unknown) => {
        fail(String(reason))
        return status()
      },
    )
    return connecting
  }

  function recordSpots(client: Client, spots: Spot[]) {
    for (const spot of spots) {
      const receiver = spot.spot.sourceInfo?.spotter
      if (spot.mode !== 'CW' || spot.freq === undefined || typeof receiver !== 'string') continue
      const key = spotIdentity(spot.their.call, spot.freq, receiver, spot.spot.timeInMillis)
      if (liveKeys.has(key)) published[client].add(key)
    }
  }

  function bridge(client: Client): ClusterSpotsHarnessHost {
    return {
      clusterStatus: async () => status(),
      async clusterLines({ after = 0, limit, match } = {}) {
        const matches = matcher(match)
        const lines = scrollback.filter(({ seq, text }) => seq > after && matches(text))
        return limit === undefined ? lines : lines.slice(Math.max(0, lines.length - limit))
      },
      async clusterSubscribe({ match } = {}) {
        subscriptions.set(client, {
          cursor: subscriptions.get(client)?.cursor ?? lastSeq,
          matches: matcher(match),
        })
        return connect()
      },
      async clusterUnsubscribe() {
        subscriptions.delete(client)
        return status()
      },
      async clusterSend(command) {
        const reply = session
          ? await session.send(command)
          : { ok: false, lines: [], error: 'disconnected' }
        const response = reply.lines.filter((line) => !broadcast.test(line))
        const refused = response.some((line) => refusal.test(line))
        commands.push({
          client,
          command,
          ok: reply.ok && !refused,
          error: reply.error ?? (refused ? 'refused' : undefined),
          reply: response.slice(0, 5),
        })
        return reply
      },
      putSpots: (spots) => recordSpots(client, spots),
      replaceSpots: (spots) => recordSpots(client, spots),
      removeSpots() {},
      log: (message) => logs.push(`${client}: ${message}`),
    }
  }

  const rbn = createRbn(bridge('RBN'))
  const upstream = createClusterSpots?.(bridge('Cluster Spots'))
  const extensions = { RBN: rbn, 'Cluster Spots': upstream }

  async function deliver() {
    await Promise.all(
      [...subscriptions].map(async ([client, subscription]) => {
        const lines = scrollback.filter(
          ({ seq, text }) => seq > subscription.cursor && subscription.matches(text),
        )
        subscription.cursor = lastSeq
        if (lines.length) await extensions[client]?.onLines(lines)
      }),
    )
  }

  async function refresh() {
    await Promise.all(
      (
        [
          ['RBN', rbn],
          ['Cluster Spots', upstream],
        ] as const
      ).map(async ([client, extension]) => {
        if (extension) recordSpots(client, await extension.fetchSpots())
      }),
    )
  }

  const started = Date.now()
  let observedFrom: number | undefined
  let observedMs = 0
  let dialect: ReturnType<typeof nodeProgramFromPrompt>
  let rbnSetup = false
  let upstreamSetup = false
  function setupCompleted(client: Client, expected: readonly string[]) {
    const sent = commands.filter((entry) => entry.client === client)
    return expected.every((command, index) => sent[index]?.ok && sent[index]?.command === command)
  }

  try {
    await refresh()
    // The extension holds the session in the background after its first Spots fetch.
    if (!connecting) throw new Error('No extension requested a cluster connection.')
    const connected = await connecting
    if (connected.state === 'connected' && connected.call) {
      const prompt = [...scrollback]
        .reverse()
        .find(({ text }) => isPromptFor(text, connected.call ?? ''))
      dialect = prompt && nodeProgramFromPrompt(prompt.text)
      if (!dialect)
        throw new Error(
          `Could not identify the cluster from its prompt: ${prompt?.text ?? 'missing'}`,
        )
      const expected = clusterFeedCommands[dialect]
      const setupDeadline = Date.now() + setupTimeoutMs
      while (status().state === 'connected' && Date.now() < setupDeadline) {
        rbnSetup = setupCompleted('RBN', expected)
        upstreamSetup = Boolean(
          upstream && setupCompleted('Cluster Spots', [...expected, historyCommand]),
        )
        if (rbnSetup && (!upstream || upstreamSetup)) break
        await delay(250)
        await deliver()
      }
      if (rbnSetup && (!upstream || upstreamSetup)) {
        // Cluster Spots may request history during startup. Count only subsequent live lines.
        sampledAfter = lastSeq
        observedFrom = Date.now()
        const deadline = observedFrom + seconds * 1000
        let nextRefresh = observedFrom + 60_000
        while (status().state === 'connected' && Date.now() < deadline) {
          await delay(Math.min(1000, deadline - Date.now()))
          await deliver()
          if (Date.now() >= nextRefresh) {
            await refresh()
            nextRefresh += 60_000
          }
        }
        observedMs = Date.now() - observedFrom
        if (status().state === 'connected') await refresh()
      } else if (!error) {
        error = 'Cluster setup did not complete.'
      }
    }
  } catch (reason) {
    error = String(reason)
  } finally {
    rbn.dispose()
    upstream?.dispose()
    session?.close()
  }

  const rbnCw = published.RBN.size
  const clusterSpotsCw = upstream ? published['Cluster Spots'].size : null
  return {
    preset: preset.name,
    address: `${preset.host}:${preset.port}`,
    call,
    mode: upstream ? 'both' : 'RBN alone',
    dialect,
    started: new Date(started).toISOString(),
    observedFrom: observedFrom === undefined ? undefined : new Date(observedFrom).toISOString(),
    observedSeconds: Math.round(observedMs / 1000),
    sockets,
    wireCw,
    qualiteeCw,
    rbnParsedCw,
    rbnUniqueParsedCw: parsedCwKeys.size,
    rejectedCwExamples,
    rbnCw,
    clusterSpotsCw,
    passed:
      !error &&
      rbnSetup &&
      rbnCw > 0 &&
      (!upstream || (upstreamSetup && (clusterSpotsCw ?? 0) > 0)),
    error,
    examples,
    commands,
    logs: logs.slice(-10),
    ...(error && { lastLines: scrollback.filter(({ text }) => !broadcast.test(text)).slice(-8) }),
  }
}
