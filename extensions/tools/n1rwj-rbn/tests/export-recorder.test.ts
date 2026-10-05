import type { PanelRenderArgs } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createReceptionRecorder } from '../src/export/recorder.ts'

const time = Date.UTC(2026, 9, 4, 14)
function args(operationId = 'first', config = {}): PanelRenderArgs {
  return {
    panelKey: 'my-signal',
    instanceId: 'panel',
    operation: { uuid: operationId, stationCall: 'N1RWJ', grid: 'FN41aa' },
    config,
    reason: 'tick',
    qsoCount: 0,
  }
}
describe('visible reception evidence ownership', () => {
  it('freezes the operation before an in-flight response and keeps receiver data before display filters', async () => {
    const append = vi.fn().mockResolvedValue(undefined)
    const recorder = createReceptionRecorder(append)
    recorder.observe(args('first', { minSnrDb: 20, band: '40m' }), time)
    const finish = recorder.prepare({ call: 'N1RWJ', windowMinutes: 15 }, time)
    if (!finish) throw new Error('Missing capture callback')
    recorder.observe(args('second'), time + 1000)
    const result = {
      startedAtMs: time,
      retrievedAtMs: time + 2000,
      payload: { spots: [{ snr: 1 }] },
      status: 200,
    }
    finish(result)
    await Promise.resolve()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'first', call: 'N1RWJ', startMs: time - 15 * 60_000 }),
      result,
    )
    expect(append).toHaveBeenCalledTimes(1)
  })
  it('stops collection after expiry, hiding, disabling, or leaving an operation', () => {
    const recorder = createReceptionRecorder(vi.fn())
    recorder.observe(args(), time)
    expect(recorder.prepare({ call: 'N1RWJ', windowMinutes: 15 }, time + 75_000)).toBeUndefined()
    recorder.observe(args(), time)
    recorder.pause()
    expect(recorder.prepare({ call: 'N1RWJ', windowMinutes: 15 }, time)).toBeUndefined()
    recorder.observe(args(), time)
    recorder.observe(args('first', { recordReception: false }), time)
    expect(recorder.prepare({ call: 'N1RWJ', windowMinutes: 15 }, time)).toBeUndefined()
    recorder.observe(args(), time)
    recorder.observe({ ...args(), operation: undefined } as unknown as PanelRenderArgs, time)
    expect(recorder.prepare({ call: 'N1RWJ', windowMinutes: 15 }, time)).toBeUndefined()
  })
  it('matches the query exactly and deduplicates two panels recording one operation', async () => {
    const append = vi.fn().mockResolvedValue(undefined)
    const recorder = createReceptionRecorder(append)
    recorder.observe(args(), time)
    recorder.observe({ ...args(), instanceId: 'second-panel' }, time)
    expect(recorder.prepare({ call: 'N1RWJ/P', windowMinutes: 15 }, time)).toBeUndefined()
    expect(recorder.prepare({ call: 'N1RWJ', windowMinutes: 30 }, time)).toBeUndefined()
    recorder.prepare(
      { call: 'N1RWJ', windowMinutes: 15 },
      time,
    )?.({
      startedAtMs: time,
      retrievedAtMs: time,
      error: 'Timeout',
    })
    await Promise.resolve()
    expect(append).toHaveBeenCalledTimes(1)
  })
})
