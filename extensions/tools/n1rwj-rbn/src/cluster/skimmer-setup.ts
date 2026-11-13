import type { ClusterStatus, host } from '@ham2k/extension-sdk'
import {
  clusterFeedCommands,
  isPromptFor,
  nodeProgramFromPrompt,
} from '../vendor/cluster-spots.mjs'

export type ClusterSetupHost = Pick<typeof host, 'clusterStatus' | 'clusterLines' | 'clusterSend'> &
  Partial<Pick<typeof host, 'log'>>

const retryMs = 120_000
const promptLine = /^\s*\S+\s+de\s.+>\s*$/i
const refusal =
  /^\s*(?:sorry|error|invalid|unknown command|unrecogni[sz]ed command|not allowed|permission denied|you (?:are not|need))\b/i

function profileOf(status: ClusterStatus): string | undefined {
  if (status.state !== 'connected' || !status.call) return undefined
  return JSON.stringify([status.call.toUpperCase(), status.node.host, status.node.port])
}

/** Cluster Spots configures each login and node once per extension runtime. */
export function createClusterFeedSetup(host: ClusterSetupHost, now = Date.now) {
  const configured = new Set<string>()
  const retryAt = new Map<string, number>()
  let running = false

  return async function configure(status: ClusterStatus, isCurrent: () => boolean) {
    const profile = profileOf(status)
    if (!profile || !isCurrent() || running || configured.has(profile)) return
    if (now() < (retryAt.get(profile) ?? -Infinity)) return

    running = true
    try {
      // The latest prompt identifies the current node even on a busy feed.
      const [latest] = await host.clusterLines({ limit: 1, match: [promptLine] })
      const program =
        latest &&
        status.call &&
        isPromptFor(latest.text, status.call) &&
        nodeProgramFromPrompt(latest.text)
      if (!program) {
        retryAt.set(profile, now() + retryMs)
        return
      }

      for (const command of clusterFeedCommands[program]) {
        if (!isCurrent()) return
        const active = await host.clusterStatus()
        if (!isCurrent() || profileOf(active) !== profile) return
        const reply = await host.clusterSend(command)
        if (!reply.ok || reply.lines.some((line) => refusal.test(line))) {
          throw new Error(`${command} was not confirmed (${reply.error ?? 'refused'}).`)
        }
      }
      configured.add(profile)
      retryAt.delete(profile)
    } catch (error) {
      retryAt.set(profile, now() + retryMs)
      host.log?.(`DX cluster setup failed: ${String(error)}`)
    } finally {
      running = false
    }
  }
}
