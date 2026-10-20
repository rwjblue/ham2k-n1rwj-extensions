import type { PanelRadioResult, PanelRadioSet, PanelRadioState } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { tuneBigfootSpot } from '../src/spot-radio.ts'
import type { BigfootSpotRow } from '../src/spots.ts'

function spot(overrides: Partial<BigfootSpotRow> = {}): BigfootSpotRow {
  return {
    call: 'W7B',
    label: 'B',
    band: '20m',
    mode: 'CW',
    frequency: 14050,
    at: Date.UTC(2026, 9, 20),
    needed: true,
    status: 'B needed',
    ...overrides,
  }
}

function radio(overrides: Partial<PanelRadioState> = {}): PanelRadioState {
  return {
    id: 'logging-radio',
    name: 'Test radio',
    status: 'connected',
    stale: false,
    problem: null,
    frequencyHz: 7_030_000,
    mode: 'CW',
    powerWatts: 5,
    transmitting: false,
    meters: {},
    canTune: true,
    modes: ['CW', 'LSB', 'USB', 'DATA-USB', 'RTTY'],
    ...overrides,
  }
}

function dependencies(state: PanelRadioState | null = radio()) {
  return {
    readRadio: vi.fn(async () => state),
    setRadio: vi.fn(
      async (_request: PanelRadioSet): Promise<PanelRadioResult> => ({
        accepted: true,
        state,
      }),
    ),
  }
}

describe('BIGFOOT spot radio tuning', () => {
  it('requests CW frequency in whole Hz using the captured logging radio identity', async () => {
    const deps = dependencies()
    const result = await tuneBigfootSpot(spot({ frequency: 14050.1234 }), deps)
    expect(deps.readRadio).toHaveBeenCalledExactlyOnceWith()
    expect(deps.setRadio).toHaveBeenCalledExactlyOnceWith({
      id: 'logging-radio',
      frequencyHz: 14_050_123,
      mode: 'CW',
    })
    expect(result).toEqual({
      tuned: true,
      message: 'Radio tune requested: 14050.1 kHz CW. Enter W7B in the logger.',
    })
    // Acceptance may precede the radio reporting its new frequency.
    expect(result.message).not.toContain('Radio tuned')
  })

  it.each([
    { frequency: 7250, band: '40m', mode: 'LSB' },
    { frequency: 14250, band: '20m', mode: 'USB' },
  ])('chooses supported voice sideband at $frequency kHz', async ({ frequency, band, mode }) => {
    const deps = dependencies()
    await tuneBigfootSpot(spot({ frequency, band, mode: 'SSB' }), deps)
    expect(deps.setRadio).toHaveBeenCalledWith({
      id: 'logging-radio',
      frequencyHz: frequency * 1000,
      mode,
    })
  })

  it.each(['FT8', 'FT4'] as const)('uses supported DATA-USB for %s', async (mode) => {
    const deps = dependencies()
    await tuneBigfootSpot(spot({ mode, frequency: 14074 }), deps)
    expect(deps.setRadio).toHaveBeenCalledWith({
      id: 'logging-radio',
      frequencyHz: 14_074_000,
      mode: 'DATA-USB',
    })
  })

  it('prefers an exact supported digital mode and never sends other radio settings', async () => {
    const deps = dependencies(radio({ modes: ['FT8', 'DATA-USB'] }))
    await tuneBigfootSpot(spot({ mode: 'FT8', frequency: 14074 }), deps)
    expect(deps.setRadio.mock.calls[0]?.[0]).toEqual({
      id: 'logging-radio',
      frequencyHz: 14_074_000,
      mode: 'FT8',
    })
  })

  it('uses exact supported RTTY without guessing an audio or reverse sideband', async () => {
    const deps = dependencies()
    await tuneBigfootSpot(spot({ mode: 'RTTY', frequency: 14090 }), deps)
    expect(deps.setRadio).toHaveBeenCalledWith({
      id: 'logging-radio',
      frequencyHz: 14_090_000,
      mode: 'RTTY',
    })
  })

  it.each([
    { mode: 'CW', supported: ['USB'] },
    { mode: 'SSB', supported: ['LSB'] },
    { mode: 'FT4', supported: ['DATA-LSB'] },
    { mode: 'RTTY', supported: ['RTTY-USB', 'RTTY-LSB'] },
  ] as const)(
    'requests frequency only when $mode mapping is uncertain',
    async ({ mode, supported }) => {
      const deps = dependencies(radio({ modes: [...supported] }))
      const result = await tuneBigfootSpot(spot({ mode }), deps)
      expect(deps.setRadio).toHaveBeenCalledWith({ id: 'logging-radio', frequencyHz: 14_050_000 })
      expect(result.tuned).toBe(true)
      expect(result.message).toContain(`Set ${mode} mode`)
      expect(result.message).toContain('enter W7B in the logger')
    },
  )

  it('uses frequency only when an older radio read has no supported mode list', async () => {
    const deps = dependencies(radio({ modes: undefined }))
    await tuneBigfootSpot(spot(), deps)
    expect(deps.setRadio).toHaveBeenCalledWith({ id: 'logging-radio', frequencyHz: 14_050_000 })
  })

  it.each([
    null,
    radio({ id: null }),
    radio({ status: 'disconnected' }),
    radio({ status: 'connecting' }),
    radio({ status: 'disconnecting' }),
    radio({ status: 'error' }),
    radio({ stale: true }),
    radio({ problem: 'Driver unavailable' }),
    radio({ transmitting: true }),
    radio({ canTune: false }),
  ])('refuses a missing or unavailable radio without sending a command', async (state) => {
    const deps = dependencies(state)
    const result = await tuneBigfootSpot(spot(), deps)
    expect(result.tuned).toBe(false)
    expect(result.message).toContain('W7B')
    expect(deps.setRadio).not.toHaveBeenCalled()
  })

  it('allows a radio with no TX telemetry while retaining the host transmission guard', async () => {
    const deps = dependencies(radio({ transmitting: null }))
    expect((await tuneBigfootSpot(spot(), deps)).tuned).toBe(true)
    expect(deps.setRadio).toHaveBeenCalledOnce()
  })

  it.each([
    'changed',
    'disconnected',
    'transmitting',
    'invalid',
    'unsupported',
    'stopped',
  ] as const)('reports host refusal %s without claiming a tune', async (reason) => {
    const deps = dependencies()
    deps.setRadio.mockResolvedValue({ accepted: false, reason, state: radio() })
    const result = await tuneBigfootSpot(spot(), deps)
    expect(result.tuned).toBe(false)
    expect(result.message).toContain('W7B')
  })

  it('handles missing radio APIs without invoking either one', async () => {
    const readRadio = vi.fn(async () => radio())
    const setRadio = vi.fn(async () => ({ accepted: true, state: radio() }))
    expect((await tuneBigfootSpot(spot(), {})).tuned).toBe(false)
    expect((await tuneBigfootSpot(spot(), { readRadio })).tuned).toBe(false)
    expect((await tuneBigfootSpot(spot(), { setRadio })).tuned).toBe(false)
    expect(readRadio).not.toHaveBeenCalled()
    expect(setRadio).not.toHaveBeenCalled()
  })

  it('handles rejected reads and writes without exposing host errors or claiming success', async () => {
    const deps = dependencies()
    deps.readRadio.mockRejectedValueOnce(new Error('readRadio blocked: no grant'))
    expect(await tuneBigfootSpot(spot(), deps)).toEqual({
      tuned: false,
      message: 'Radio access is unavailable. Enter W7B manually.',
    })
    expect(deps.setRadio).not.toHaveBeenCalled()
    deps.setRadio.mockRejectedValueOnce(new Error('setRadio unsupported'))
    expect(await tuneBigfootSpot(spot(), deps)).toEqual({
      tuned: false,
      message: 'Radio tuning failed. Enter W7B manually.',
    })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 0.0001, 1e10])(
    'rejects unusable frequency %s before reading the radio',
    async (frequency) => {
      const deps = dependencies()
      expect((await tuneBigfootSpot(spot({ frequency }), deps)).tuned).toBe(false)
      expect(deps.readRadio).not.toHaveBeenCalled()
      expect(deps.setRadio).not.toHaveBeenCalled()
    },
  )
})
