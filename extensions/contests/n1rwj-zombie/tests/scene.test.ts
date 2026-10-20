import type { PanelEnvironment } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { buildZombieExperience } from '../src/experience.ts'
import type { Qson } from '../src/model.ts'
import { zombieScene } from '../src/scene.ts'

const now = Date.parse('2026-10-30T21:45:00Z')
const operation: Qson = {
  uuid: 'scene',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      ourZombieName: 'COUNT ROB',
      ourZombieNumber: '002',
      ourSpc: 'RI',
      utcOffset: '-04:00',
    },
  ],
}
const contact: Qson = {
  uuid: 'first',
  startAtMillis: now - 120 * 60_000,
  mode: 'CW',
  band: '40m',
  their: { call: 'K1ABC', sent: '599' },
  refs: [{ type: 'zombie', theirSpc: 'MA', theirZombieName: 'OLD NICK', theirZombieNumber: '007' }],
}
const quiet = { kind: null, label: '', phase: 0, nextTick: false } as const

function environment(width: number, height: number, reducedMotion = false): PanelEnvironment {
  return {
    width,
    height,
    version: 1,
    reducedMotion,
    typography: { body: { fontFamily: 'Roboto' } },
  } as PanelEnvironment
}

describe('Zombie native scene', () => {
  for (const [width, height] of [
    [560, 660],
    [280, 620],
    [480, 380],
    [280, 300],
    [1200, 1100],
  ]) {
    it(`keeps all native layers and controls in bounds at ${width}×${height}`, () => {
      const scene = zombieScene({
        experience: buildZombieExperience(operation, [contact], now),
        frame: quiet,
        now,
        environment: environment(width ?? 560, height ?? 660),
        motion: true,
      })
      expect(scene.layers.length).toBeLessThanOrEqual(128)
      const ids = scene.layers.map((layer) => layer.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const layer of [...scene.layers, ...(scene.controls ?? [])]) {
        expect(layer.x).toBeGreaterThanOrEqual(0)
        expect(layer.y).toBeGreaterThanOrEqual(0)
        expect((layer.x ?? 0) + (layer.width ?? 0)).toBeLessThanOrEqual(scene.width + 0.1)
        expect((layer.y ?? 0) + (layer.height ?? 0)).toBeLessThanOrEqual(scene.height + 0.1)
      }
      expect(scene).not.toHaveProperty('strings')
      expect(scene).not.toHaveProperty('layout')
      expect(JSON.stringify(scene)).not.toMatch(/<script|<image|<text|https?:\/\/(?!www\.w3\.org)/)
    })
  }
  it('uses copied identity, actual-band readiness, and four score groups', () => {
    const model = buildZombieExperience(operation, [contact], now)
    const scene = zombieScene({ experience: model, frame: quiet, now, motion: true })
    const texts = scene.layers.flatMap((layer) => (layer.text?.literal ? [layer.text.literal] : []))
    expect(texts).toContain('COUNT ROB  ·  #002')
    expect(texts).toContain('ELIGIBLE NOW')
    expect(texts).toContain('40m · #007')
    expect(texts).toContain('10m/15m')
    expect(texts).toContain('Ends in 6h 15m')
    expect(scene.layers[0]).toMatchObject({ id: 'background', x: 0, y: 0, width: 560, height: 660 })
    expect(scene.layers[0]?.svg).toContain('<rect width="560" height="660" fill="#211A35"/>')
    expect(scene.values?.participation).toBe(1)
  })
  it('respects motion settings while preserving static earned feedback', () => {
    const model = buildZombieExperience(operation, [contact], now)
    const scene = zombieScene({
      experience: model,
      now,
      frame: { kind: 'rebirth', label: 'BACK FROM THE DEAD!', phase: 1, nextTick: true },
      environment: environment(560, 660, true),
      motion: true,
    })
    expect(scene.values?.shuffle).toBe(0)
    expect(scene.layers.some((layer) => layer.pulse)).toBe(false)
    expect(scene.layers.filter((layer) => layer.transitionMs).length).toBe(0)
    expect(scene.layers.some((layer) => layer.id.startsWith('sparkle'))).toBe(true)
    expect(scene.layers.some((layer) => layer.text?.literal === 'A LITTLE AFTERLIFE')).toBe(true)
  })
})
