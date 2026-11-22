// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { PanelRadioState, TemplateContextArgs } from '@ham2k/extension-sdk'
import { oneLine, renderTemplate, templateContext } from '@ham2k/extension-sdk'

export function usesLiquid(source: string): boolean {
  return source.includes('{{') || source.includes('{%')
}

export function macroContext(args: TemplateContextArgs, radio?: PanelRadioState | null) {
  const context = templateContext(args)
  if (radio) {
    context.radio = {
      name: radio.name,
      status: radio.status,
      connected: radio.status === 'connected' && !radio.stale,
      stale: radio.stale,
      mode: radio.mode,
      frequencyHz: radio.frequencyHz,
      reportedFrequencyHz: radio.reportedFrequencyHz,
      powerWatts: radio.powerWatts,
      transmitting: radio.transmitting,
      channel: radio.channel,
      opStyle: radio.opStyle,
      tuner: radio.tuner,
      passband: radio.passband,
      antennas: radio.antennas,
    }
  }
  return context
}

export function macroText(source: string, context: Record<string, unknown>, label: string): string {
  return usesLiquid(source) ? renderTemplate(source, context, label) : source
}

export function buttonLabel(source: string, context: Record<string, unknown>, alias: string) {
  try {
    const text = usesLiquid(source)
      ? oneLine(renderTemplate(source, context, alias))
      : source.trim()
    return { text: text || alias, invalid: false }
  } catch {
    return { text: alias, invalid: true }
  }
}
