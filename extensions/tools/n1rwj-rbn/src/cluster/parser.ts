import type { ClusterLine } from '@ham2k/extension-sdk'
import { bandForExactFrequencyInMHz } from '@ham2k/lib-operation-data'
import { isValidReceiver } from '../data/parser.ts'
import { isValidCall, type RbnReport } from '../model.ts'
import { clusterAnnouncementPattern, spotTime } from '../vendor/cluster-spots.mjs'

export type ClusterRbnMode = 'CW' | 'RTTY' | 'FT4' | 'FT8'
export type ClusterRbnReport = RbnReport & { mode: ClusterRbnMode }

// biome-ignore lint/suspicious/noControlCharactersInRegex: Telnet spots can start with a bell.
export const clusterSkimmerLines = /^[\x00-\x20\x7f]*DX[ \t]+de[ \t]+[^\s:]+-#:/i
// biome-ignore lint/suspicious/noControlCharactersInRegex: Normalize Telnet control bytes as Cluster Spots does.
const controlCharacters = /[\x00-\x1f\x7f]/g
const minuteMs = 60_000
const qualiteeMarker = /(?:^| )Q:[1-9]\*?\+?(?= |$)/
const modes: Record<string, ClusterRbnMode> = {
  CW: 'CW',
  RTT: 'RTTY',
  RTTY: 'RTTY',
  FT4: 'FT4',
  FT8: 'FT8',
}

function measurement(match: RegExpMatchArray | null, min: number, max: number): number | null {
  const value = Number(match?.[1])
  return value >= min && value <= max ? value : null
}

/** Parse live-style skimmer reports in the raw RBN and retail cluster formats. */
export function parseClusterReport(line: ClusterLine): ClusterRbnReport | null {
  if (
    !Number.isFinite(line.at) ||
    typeof line.text !== 'string' ||
    line.text.length > 256 ||
    !clusterSkimmerLines.test(line.text) ||
    /[\r\n]/.test(line.text.trim())
  ) {
    return null
  }
  const text = line.text
    .replace(controlCharacters, ' ')
    .trim()
    .toUpperCase()
    .replace(/^DX +DE +/, 'DX DE ')
  const match = clusterAnnouncementPattern.exec(text)
  if (!match) return null
  const [, spotter, frequency, call, measurements, utc] = match
  const receiver = spotter.slice(0, -2)
  if (!isValidCall(call) || !isValidReceiver(receiver)) return null
  const frequencyKhz = Number(frequency)
  // The shared library's exact helper takes kHz despite its name.
  const band = bandForExactFrequencyInMHz(frequencyKhz)
  if (!band) return null

  // The shared matcher takes the last UTC field. RBN rejects an ambiguous clock.
  if (/(?:^| )\d{4}Z(?= |$)/.test(measurements)) return null
  const hour = Number(utc.slice(0, 2))
  const minute = Number(utc.slice(2))
  if (hour >= 24 || minute >= 60) return null
  const timeMs = spotTime(utc, line.at)
  const ageMinutes = Math.floor(line.at / minuteMs) - timeMs / minuteMs
  if (!(ageMinutes >= 0)) return null
  const receivedModes = new Set<ClusterRbnMode>()
  for (const token of measurements.matchAll(
    /(?:^| )(CW|RTTY?|FT\d+|PSK\d*|[UL]SB|SSB|MFSK\d*|JS8|WSPR|BCN|DXF)(?= |$)/g,
  )) {
    const mode = modes[token[1]]
    if (!mode) return null
    receivedModes.add(mode)
  }
  const wpm = measurement(measurements.match(/(?:^| )(\d+) *WPM(?= |$)/), 1, 100)
  // The RBN Aggregator can send CW as SNR followed by a speed in WPM.
  // Neither a CW-range frequency nor an unlabelled speed determines the mode.
  if (
    wpm !== null &&
    /^[+-]?\d+ *DB +\d+ *WPM(?:$| +(?:CQ|TEST|BEACON|NCDXF)(?: |$))/.test(measurements)
  ) {
    receivedModes.add('CW')
  }
  const [mode] = receivedModes
  if (!mode || receivedModes.size !== 1) return null
  // DXSpider can wait up to five minutes for corroboration and forwards the
  // selected report's original UTC minute. Ordinary reports get one minute bucket.
  const maxAgeMinutes = mode === 'CW' && qualiteeMarker.test(measurements) ? 5 : 1
  if (ageMinutes > maxAgeMinutes) return null
  return {
    id: `cluster:${String(line.seq).padStart(16, '0')}`,
    call,
    receiver,
    frequencyKhz,
    band,
    mode,
    snrDb: measurement(measurements.match(/(?:^| )([+-]?\d+) *DB(?= |$)/), -100, 150),
    wpm: mode === 'CW' ? wpm : null,
    timeMs,
    // A locator in the comment need not describe the receiver.
    receiverLatitude: null,
    receiverLongitude: null,
    country: null,
  }
}
