import { describe, expect, it } from 'vitest'
import { createInstalledKernel } from './installed-kernel.ts'

function kernelFixture(protocol: 'legacy' | 'claimed'): string {
  const publish =
    protocol === 'legacy'
      ? 'globalThis.__polo = host'
      : `
        let claimedToken
        globalThis.__halo = {
          claimBridge(token) {
            if (claimedToken || token.length < 32) throw new Error('Invalid bridge claim')
            claimedToken = token
          },
          bridge(token, entry, ...args) {
            if (!claimedToken || claimedToken !== token) throw new Error('Unclaimed bridge')
            return host[entry](...args)
          },
        }
      `
  return `
    let evaluating = false
    let bundleApi
    let active = false
    const send = (message) => sendMessage('polo', JSON.stringify(message))
    const host = {
      beginBundle(_key, api) {
        if (evaluating) throw new Error('A bundle is already open')
        evaluating = true
        bundleApi = api
      },
      endBundle() { evaluating = false },
      activateAll() { active = !evaluating && globalThis.evaluated },
      invokeHook(id, category, key, method, argsJson) {
        if (!active || category !== 'panel' || key !== 'n1rwj-probe') {
          send({ type: 'result', id, ok: false, error: 'No active panel' })
          return
        }
        send({ type: 'hostCall', callId: id, method, params: JSON.parse(argsJson) })
      },
      hostResponse(id, ok, json) {
        const reply = JSON.parse(json)
        send(ok
          ? { type: 'result', id, ok, value: { bundleApi, reply } }
          : { type: 'result', id, ok, error: reply })
      },
    }
    ${publish}
  `
}

describe.each(['legacy', 'claimed'] as const)('%s installed kernel', (protocol) => {
  it('passes the manifest API and invokes a panel through the host', async () => {
    const host = createInstalledKernel(kernelFixture(protocol), {
      onHostCall: ({ method, params }) => ({ method, ...params }),
    })
    const manifest = { key: 'n1rwj-probe', api: 12 }
    expect(() => host.loadBundle(manifest, 'throw new Error("Bad bundle")', 'bad.js')).toThrow(
      'Bad bundle',
    )
    host.loadBundle(manifest, 'globalThis.evaluated = true', 'probe.js')
    await host.activateAll()

    const render = host.invokeHook('panel', manifest.key, 'render', { reason: 'preview' })
    const panels = host.invokeHook('panel', manifest.key, 'getPanels', {})
    await expect(render).resolves.toEqual({
      bundleApi: 12,
      reply: { method: 'render', reason: 'preview' },
    })
    await expect(panels).resolves.toEqual({ bundleApi: 12, reply: { method: 'getPanels' } })
  })

  it('returns a useful failure when the simulated host refuses the call', async () => {
    const host = createInstalledKernel(kernelFixture(protocol), {
      async onHostCall() {
        throw new Error('Request refused')
      },
    })
    host.loadBundle({ key: 'n1rwj-probe', api: 12 }, 'globalThis.evaluated = true', 'probe.js')
    await host.activateAll()

    await expect(host.invokeHook('panel', 'n1rwj-probe', 'render', {})).rejects.toThrow(
      'panel/n1rwj-probe.render failed: Request refused',
    )
  })
})
