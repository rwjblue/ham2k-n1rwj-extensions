import type { ClusterLine, ClusterMatch, ClusterReply, ClusterStatus } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createClusterFeedSetup } from '../../src/cluster/skimmer-setup.ts'

const connected: ClusterStatus = {
  state: 'connected',
  node: { name: 'VE7CC-1', host: 've7cc.net', port: 23 },
  call: 'N1RWJ',
  lastSeq: 12,
}
const ccPrompt = 'N1RWJ de VE7CC-1 11-Nov-2026 1710Z CCC >'
const arPrompt = 'N1RWJ de NC7J 11-Nov 1710Z arc6>'
const dxSpiderPrompt = 'N1RWJ de W3LPL 11-Nov-2026 1710Z dxspider >'
const ccCommands = ['SET/NOFILTER', 'SET/FILTER DXBM/OFF', 'SET/SKIMMER']

function setup() {
  let now = Date.UTC(2026, 10, 11, 17, 10)
  let status = connected
  let lines: ClusterLine[] = [{ text: ccPrompt, seq: status.lastSeq, at: now }]
  const host = {
    clusterStatus: vi.fn(async () => status),
    clusterLines: vi.fn(async ({ limit, match }: { limit?: number; match?: ClusterMatch } = {}) => {
      const matches = lines.filter(({ text }) =>
        match ? match.some((pattern) => new RegExp(pattern).test(text)) : true,
      )
      return limit === undefined ? matches : matches.slice(-limit)
    }),
    clusterSend: vi.fn(
      async (_command: string): Promise<ClusterReply> => ({ ok: true, lines: [] }),
    ),
  }
  const configure = createClusterFeedSetup(host, () => now)
  return {
    host,
    configure: (isCurrent = () => true) => configure(status, isCurrent),
    commands: () => host.clusterSend.mock.calls.map(([command]) => command),
    advance: (ms: number) => {
      now += ms
    },
    setStatus: (next: ClusterStatus) => {
      status = next
    },
    setPrompts: (...texts: string[]) => {
      lines = texts.map((text, index) => ({ text, seq: 12 + index, at: now }))
      status = { ...status, lastSeq: lines[lines.length - 1]?.seq ?? 0 }
    },
  }
}

describe('live feed setup on the shared connection', () => {
  it.each([
    ['AR-Cluster', arPrompt, ['SET DX FILTER']],
    ['DXSpider', dxSpiderPrompt, ['CLEAR/SPOTS ALL', 'SET/SKIMMER CW RTTY PSK BEACON']],
    ['CC Cluster', ccPrompt, ccCommands],
  ] as const)(
    'sends exactly the upstream %s setup commands in order',
    async (_, prompt, expected) => {
      const { commands, configure, setPrompts } = setup()
      setPrompts(prompt)

      await configure()

      expect(commands()).toEqual(expected)
    },
  )

  it('coalesces simultaneous setup and remembers the configured profile across reconnects', async () => {
    const { commands, configure, setStatus } = setup()

    await Promise.all([configure(), configure()])
    setStatus({ ...connected, state: 'idle', call: undefined })
    await configure()
    setStatus({ ...connected, call: 'n1rwj', lastSeq: 24 })
    await configure()

    expect(commands()).toEqual(ccCommands)
  })

  it('configures a different operator or endpoint as a separate profile', async () => {
    const { commands, configure, setStatus, setPrompts } = setup()
    await configure()

    setStatus({ ...connected, call: 'W1AW' })
    setPrompts(ccPrompt.replace('N1RWJ', 'W1AW'))
    await configure()

    setStatus({ ...connected, node: { ...connected.node, port: 7373 } })
    setPrompts(arPrompt)
    await configure()

    expect(commands()).toEqual([...ccCommands, ...ccCommands, 'SET DX FILTER'])
  })

  it('ignores an older recognized prompt when the newest prompt has an unknown dialect', async () => {
    const { commands, configure, setPrompts } = setup()
    setPrompts(ccPrompt, 'N1RWJ de OTHER 1710Z >')

    await configure()

    expect(commands()).toEqual([])
  })

  it('stops after a refusal and retries the full sequence once the backoff expires', async () => {
    const { advance, commands, configure, host } = setup()
    host.clusterSend.mockResolvedValueOnce({ ok: false, lines: [], error: 'refused' })

    await configure()
    advance(119_999)
    await configure()
    expect(commands()).toEqual(['SET/NOFILTER'])

    advance(1)
    await configure()
    expect(commands()).toEqual(['SET/NOFILTER', ...ccCommands])
  })

  it('stops the sequence if the node changes after the first command', async () => {
    const { commands, configure, host, setStatus } = setup()
    host.clusterSend.mockImplementationOnce(async () => {
      setStatus({ ...connected, node: { ...connected.node, host: 'different-node.example' } })
      return { ok: true, lines: [] }
    })

    await configure()

    expect(commands()).toEqual(['SET/NOFILTER'])
  })

  it('stops before sending when the live connection is no longer wanted', async () => {
    const { commands, configure, host } = setup()
    let current = true
    host.clusterLines.mockImplementationOnce(async () => {
      current = false
      return [{ text: ccPrompt, seq: connected.lastSeq, at: Date.UTC(2026, 10, 11, 17, 10) }]
    })

    await configure(() => current)

    expect(commands()).toEqual([])
  })
})
