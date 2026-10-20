import type { PanelRadioResult, PanelRadioState } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import type { BigfootSpotRow } from './spots.ts'

export type BigfootSpotRadioDependencies = Partial<Pick<typeof host, 'readRadio' | 'setRadio'>>

export interface BigfootSpotRadioResult {
  /** The host accepted the request; this is not hardware confirmation. */
  tuned: boolean
  message: string
}

function modeFor(row: BigfootSpotRow, radio: PanelRadioState): string | undefined {
  const supported = Array.isArray(radio.modes) ? radio.modes : []
  const preferred =
    row.mode === 'SSB'
      ? [row.frequency < 10_000 ? 'LSB' : 'USB']
      : row.mode === 'FT8' || row.mode === 'FT4'
        ? [row.mode, 'DATA-USB']
        : [row.mode]
  // Do not guess an RTTY sideband or substitute a generic digital mode.
  return preferred.find((mode) => supported.includes(mode))
}

function refusal(reason: PanelRadioResult['reason'], call: string): string {
  if (reason === 'changed') return `Radio selection changed. Select ${call} again.`
  if (reason === 'transmitting') return `Radio is transmitting. Select ${call} again afterward.`
  if (reason === 'disconnected') return `Radio is disconnected. Enter ${call} manually.`
  if (reason === 'unsupported') return `Radio does not support this change. Enter ${call} manually.`
  if (reason === 'invalid') return `Radio refused this frequency or mode. Enter ${call} manually.`
  return `Radio did not accept the tuning request. Enter ${call} manually.`
}

/** Tune only after the operator chooses a spot. This never inserts or logs a QSO. */
export async function tuneBigfootSpot(
  row: BigfootSpotRow,
  dependencies: BigfootSpotRadioDependencies = host,
): Promise<BigfootSpotRadioResult> {
  const unavailable = (message: string): BigfootSpotRadioResult => ({ tuned: false, message })
  const frequencyHz = Math.round(row.frequency * 1000)
  if (
    !Number.isFinite(row.frequency) ||
    row.frequency <= 0 ||
    !Number.isSafeInteger(frequencyHz) ||
    frequencyHz <= 0 ||
    frequencyHz > 1e12
  )
    return unavailable(`Invalid spot frequency. Enter ${row.call} manually.`)
  if (typeof dependencies.readRadio !== 'function' || typeof dependencies.setRadio !== 'function')
    return unavailable(`Update Ham2K to tune from a spot. Enter ${row.call} manually.`)

  let radio: PanelRadioState | null
  try {
    radio = await dependencies.readRadio()
  } catch {
    return unavailable(`Radio access is unavailable. Enter ${row.call} manually.`)
  }
  if (!radio || typeof radio.id !== 'string' || !radio.id)
    return unavailable(`No logging radio is selected. Enter ${row.call} manually.`)
  if (radio.status !== 'connected')
    return unavailable(`Radio is disconnected. Enter ${row.call} manually.`)
  if (radio.stale)
    return unavailable(`Radio reading is stale. Select ${row.call} again when it updates.`)
  if (radio.problem) return unavailable(`Radio is unavailable. Enter ${row.call} manually.`)
  if (radio.transmitting === true)
    return unavailable(`Radio is transmitting. Select ${row.call} again afterward.`)
  if (radio.canTune !== true)
    return unavailable(`Radio is not ready to tune. Enter ${row.call} manually.`)

  const mode = modeFor(row, radio)
  let result: PanelRadioResult
  try {
    result = await dependencies.setRadio({
      // Omit selection: the host must reject if the designated logging radio
      // changed since readRadio(), rather than tune a different radio.
      id: radio.id,
      frequencyHz,
      ...(mode ? { mode } : {}),
    })
  } catch {
    return unavailable(`Radio tuning failed. Enter ${row.call} manually.`)
  }
  if (result?.accepted !== true) return unavailable(refusal(result?.reason, row.call))
  return {
    tuned: true,
    message: mode
      ? `Radio tune requested: ${row.frequency.toFixed(1)} kHz ${mode}. Enter ${row.call} in the logger.`
      : `Frequency requested: ${row.frequency.toFixed(1)} kHz. Set ${row.mode} mode and enter ${row.call} in the logger.`,
  }
}
