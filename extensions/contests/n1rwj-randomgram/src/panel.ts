import type {
  PanelEnvironment,
  PanelHook,
  PanelRenderArgs,
  PanelScene,
  PanelSceneLayer,
} from '@ham2k/extension-sdk'

import { receivedGroup, resolveSent } from './exchange.ts'
import { object, operationGroups, refOf, text } from './model.ts'

function textScale(environment: PanelEnvironment | undefined): number {
  if (!environment) return 1
  // Reserve using the largest reported role ratio. The host scales each Text
  // once, and an accessibility scaler may not use one ratio at every size.
  return Math.max(
    1,
    ...Object.values(environment.typography).map((role) =>
      role.fontSize > 0 ? role.scaledFontSize / role.fontSize : 1,
    ),
  )
}

function groupsAfter(
  operation: PanelRenderArgs['operation'],
  position: number | undefined,
): number {
  return position !== undefined ? Math.max(0, operationGroups(operation).length - position) : 0
}

/** A read-only projection of the same exchange the logger/keyer resolves. */
export function exchangeScene(args: PanelRenderArgs): PanelScene {
  const sent = resolveSent(args.operation, args.qso ?? {})
  const opRef = refOf(args.operation)
  const total = operationGroups(args.operation).length
  const environment = args.environment
  const width = Math.max(200, environment?.width ?? 360)
  const height = Math.max(160, environment?.height ?? 240)
  const scale = textScale(environment)
  const padding = 12
  const availableWidth = width - padding * 2
  const compact = height < 220
  const mono = environment?.typography.mono.fontFamily ?? 'RobotoMono'
  const statusColor = sent.state === 'invalid' ? environment?.colors.error : undefined
  const labelSize = Math.min(14, availableWidth / (30 * 0.55 * scale))
  const groupSize = Math.min(compact ? 48 : 64, availableWidth / (5 * 0.7 * scale + 0.3))
  const detailSize = Math.min(14, availableWidth / (32 * 0.55 * scale))
  const rstSize = 16
  const txHeight = Math.max(groupSize * scale * 1.25, compact ? 54 : 74)
  const labelHeight = Math.max(20, labelSize * scale * 1.35)
  const detailHeight = Math.max(22, detailSize * scale * 1.35)
  const rstHeight = Math.max(24, rstSize * scale * 1.35)
  const rxSize = Math.min(compact ? 26 : 36, availableWidth / (5 * 0.7 * scale + 0.3))
  const rxHeight = Math.max(32, rxSize * scale * 1.25)
  const txY = padding + labelHeight
  const rstY = txY + txHeight
  const detailY = rstY + rstHeight
  const rxY = detailY + detailHeight + 6
  const layers: PanelSceneLayer[] = []

  function addText(
    id: string,
    literal: string,
    y: number,
    layerHeight: number,
    size: number,
    options: { mono?: boolean; weight?: number; color?: string } = {},
  ): void {
    layers.push({
      id,
      x: padding,
      y,
      width: availableWidth,
      height: layerHeight,
      text: {
        literal,
        size,
        fontWeight: options.weight ?? 400,
        ...(options.mono ? { fontFamily: mono, letterSpacing: 1 } : {}),
        ...(options.color ? { color: options.color } : {}),
      },
    })
  }

  const event = text(opRef?.ref)
  addText(
    'tx-label',
    event ? `TRANSMIT · RandomGram ${event}` : 'TRANSMIT · RandomGram',
    padding,
    labelHeight,
    labelSize,
  )

  const stateText: Record<string, string> = {
    inactive: 'Add RandomGram to this operation',
    unconfigured: 'Load your TX list in activity setup',
    pending: 'Enter a callsign to select a group',
    exhausted: 'TX list exhausted',
    invalid: 'TX group unavailable',
  }
  if (opRef && sent.group) {
    addText('tx-group', sent.group, txY, txHeight, groupSize, { mono: true, weight: 700 })
  } else {
    addText(
      'tx-state',
      stateText[opRef ? sent.state : 'inactive'] ?? 'No TX group selected',
      txY,
      txHeight,
      detailSize + 2,
      {
        color: statusColor,
      },
    )
  }

  const rst = text(object(args.qso?.our).sent)
  addText('rst', rst ? `RST ${rst}` : 'RST —', rstY, rstHeight, rstSize)
  const progress =
    sent.position !== undefined
      ? `Item ${sent.position} / ${total} · ${groupsAfter(args.operation, sent.position)} after this`
      : total > 0
        ? `${total} groups loaded`
        : ''
  addText('tx-details', progress, detailY, detailHeight, detailSize)

  const received = receivedGroup(args.qso ?? {})
  addText('rx-label', 'RECEIVED', rxY, labelHeight, labelSize)
  addText('rx-group', received || '— — — — —', rxY + labelHeight, rxHeight, rxSize, { mono: true })

  const helpY = rxY + labelHeight + rxHeight + 8
  if (opRef && helpY + detailHeight + padding <= height) {
    addText('guidance', 'Sent it without logging? Use RGSKIP.', helpY, detailHeight, detailSize)
  }

  return {
    version: 1,
    width,
    height: Math.max(height, rxY + labelHeight + rxHeight + padding),
    values: {},
    layers,
  }
}

export const Panel = {
  async getPanels() {
    return [
      {
        key: 'exchange',
        title: 'RandomGram Exchange',
        description: 'The exact group to send and the group copied from the other station.',
        icon: 'form-textbox',
        on: ['operation', 'qso', 'qsoLogged'],
      },
    ]
  },
  async render(args: PanelRenderArgs) {
    return {
      kind: 'svgScene' as const,
      scene: exchangeScene(args),
      triggers: ['operation', 'qso', 'qsoLogged'],
    }
  },
} satisfies PanelHook
