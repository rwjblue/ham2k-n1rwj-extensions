import type { PanelContent, PanelHook, PanelRenderArgs } from '@ham2k/extension-sdk'
import { bigfootRef, eventFromOperation, FORM_URL, RULES_URL, SPOTS_URL } from './activity.ts'
import { type CelebrationFrame, createCelebrations } from './celebration.ts'
import { huntPanelPreview } from './panel-preview.ts'
import {
  buildProgress,
  type Contact,
  type Progress,
  type ProgressMode,
  type Qson,
  qualifyingContacts,
  sameModeProgress,
} from './rules.ts'
import { huntScene } from './scene.ts'

const MODE_LABELS: Record<ProgressMode, string> = {
  CW: 'CW',
  MIXED: 'Mixed',
  PHONE: 'Phone',
  DIGITAL: 'Digital',
}

function contactLabel(contact: Contact | undefined): string {
  if (!contact) return 'Still needed'
  return `${contact.utcDate} ${new Date(contact.at).toISOString().slice(11, 16)}Z · ${contact.band} ${contact.mode}`
}

function oEvidence(progress: Progress): string {
  return [
    `**First O:** ${contactLabel(progress.slots[4]?.contact)}`,
    `**Second O:** ${contactLabel(progress.slots[5]?.contact)}`,
  ].join('  \n')
}

export function progressMarkdown(contacts: Contact[], focus: ProgressMode): string {
  const progress = buildProgress(contacts)
  const selected = progress[focus]
  const mixed = progress.MIXED
  const status = (contact: Contact | undefined) => (contact ? '✓' : '—')
  const rows = selected.slots.map((slot, index) => {
    const label = slot.call === 'W7O' ? `O${index === 4 ? '₁' : '₂'}` : slot.letter
    return `| ${label} · ${slot.call} | ${status(slot.contact)}${focus === 'MIXED' ? '' : ` | ${status(mixed.slots[index]?.contact)}`} |`
  })
  rows.push(
    `| Skunk Ape · W4S | ${status(selected.bonus)}${focus === 'MIXED' ? '' : ` | ${status(mixed.bonus)}`} |`,
  )
  const modes = (['CW', 'PHONE', 'DIGITAL', 'MIXED'] as const)
    .map(
      (mode) =>
        `**${MODE_LABELS[mode]} ${progress[mode].worked}/7**${progress[mode].complete ? ' ✓' : ''}`,
    )
    .join(' · ')
  const singleModes = Object.entries(sameModeProgress(contacts))
    .filter(([mode]) => mode === 'FT8' || mode === 'FT4' || mode === 'RTTY')
    .map(([mode, result]) => `${mode} ${result.worked}/7`)
    .join(' · ')
  return [
    modes,
    selected.complete
      ? `**${MODE_LABELS[focus]} BIGFOOT complete!**`
      : `### ${MODE_LABELS[focus]} checklist`,
    [
      `| Target | ${MODE_LABELS[focus]}${focus === 'MIXED' ? '' : ' | Mixed'} |`,
      `| :--- | :---:${focus === 'MIXED' ? '' : ' | :---:'} |`,
      ...rows,
    ].join('\n'),
    oEvidence(selected),
    'The second W7O needs a different band, actual mode, or UTC date. An all-CW pair needs another band or UTC date.',
    focus !== 'MIXED' && mixed.slots[5]?.contact && !selected.slots[5]?.contact
      ? `Mixed-mode O pair: ${contactLabel(mixed.slots[4]?.contact)}; ${contactLabel(mixed.slots[5]?.contact)}.`
      : '',
    `Digital breakdown: ${singleModes}.`,
    'October 13 0000–October 21 2359 UTC, 2026. Progress covers this operation only. QSOs on other dates, callsigns, bands or modes are excluded.',
    `[Event spots](${SPOTS_URL}) · [RBN](https://www.reversebeacon.net/) · [Rules](${RULES_URL})`,
    `Use the Exports panel for BIGFOOT ADIF and the CSV worksheet. [Certificate request form](${FORM_URL}): send the completed form and $5 to the organizer, received by November 30.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function focusFor(config: PanelRenderArgs['config']): ProgressMode {
  return config.focus === 'PHONE' || config.focus === 'DIGITAL' || config.focus === 'MIXED'
    ? config.focus
    : 'CW'
}

function clockFor(args: PanelRenderArgs) {
  const realNow = args.clock?.realNowMillis
  return {
    instanceId: args.instanceId ?? args.panelKey,
    operationId: typeof args.operation?.uuid === 'string' ? args.operation.uuid : '',
    now: typeof realNow === 'number' && Number.isFinite(realNow) ? realNow : Date.now(),
    reducedMotion: args.config.motion === false || args.environment?.reducedMotion === true,
  }
}

export function createBigfootPanel(): PanelHook {
  const celebrations = createCelebrations()
  const snapshots = new Map<string, { contacts: Contact[]; focus: ProgressMode }>()
  const snapshotKey = (args: PanelRenderArgs) =>
    JSON.stringify([args.instanceId ?? args.panelKey, args.operation?.uuid])
  function remember(key: string, value: { contacts: Contact[]; focus: ProgressMode }) {
    snapshots.delete(key)
    snapshots.set(key, value)
    while (snapshots.size > 12) {
      const first = snapshots.keys().next().value
      if (first !== undefined) snapshots.delete(first)
    }
  }
  return {
    async getPanels() {
      return [
        {
          key: 'hunt',
          title: 'BIGFOOT Hunt',
          icon: 'paw',
          description:
            '🌲🐾 Watch Bigfoot celebrate new letters! CW + Mixed progress, both O contacts, and the 🦨 Skunk Ape bonus.',
          preview: huntPanelPreview,
          on: ['operation', 'qsoLogged'],
          form: [
            {
              type: 'field',
              fieldType: 'select',
              key: 'focus',
              label: 'Hunt mode',
              value: 'CW',
              options: (['CW', 'MIXED', 'PHONE', 'DIGITAL'] as const).map((mode) => ({
                value: mode,
                label: MODE_LABELS[mode],
              })),
            },
            {
              type: 'field',
              fieldType: 'select',
              key: 'view',
              label: 'View',
              value: 'scene',
              options: [
                { value: 'scene', label: 'Forest scene' },
                { value: 'checklist', label: 'Detailed checklist' },
              ],
            },
            {
              type: 'field',
              fieldType: 'checkbox',
              key: 'motion',
              label: 'Animate the forest and celebrations',
              value: true,
            },
          ],
        },
      ]
    },
    async render(args, ctx): Promise<PanelContent> {
      const { operation, config } = args
      if (!operation)
        return {
          kind: 'markdown',
          triggers: [],
          title: 'BIGFOOT Hunt',
          content: 'Open a BIGFOOT operation to see hunt progress.',
        }
      const event = eventFromOperation(operation)
      if (!event)
        return {
          kind: 'markdown',
          triggers: [],
          title: 'BIGFOOT Hunt',
          content: bigfootRef(operation)
            ? 'This event edition has no confirmed rules. Select BIGFOOT Hunt 2026 in the operation’s activities.'
            : 'Add **BIGFOOT Hunt 2026** to this operation’s activities. Use a dedicated operation for the hunt, then log the actual event station, band, mode and reports.',
        }
      if (typeof operation.uuid !== 'string' || !ctx.getQsos)
        return {
          kind: 'markdown',
          triggers: [],
          title: `BIGFOOT Hunt ${event.year}`,
          content:
            'The operation log is unavailable. Reopen the operation in a Ham2K version with extension log access.',
        }
      const focus = focusFor(config)
      // Environment is sent by scene-capable hosts. Older hosts keep the
      // original checklist and saved panel identity without a compatibility bump.
      const forestView = config.view !== 'checklist' && args.environment?.version === 1
      const key = snapshotKey(args)
      const cached = snapshots.get(key)
      let contacts: Contact[]
      let frame: CelebrationFrame | undefined
      const clock = clockFor(args)
      if (forestView && args.reason === 'tick' && cached?.focus === focus) {
        // A bounded celebration advances from an already-read log snapshot.
        // No per-frame or per-keystroke log/host calls are needed.
        contacts = cached.contacts
        frame = celebrations.frame(clock)
      } else {
        // Read on log/operation changes, including same-count edits/deletions.
        let qsos: Qson[] | null
        try {
          qsos = await ctx.getQsos(operation.uuid)
        } catch {
          qsos = null
        }
        if (!qsos)
          return {
            kind: 'markdown',
            triggers: [],
            content:
              'The operation log is unavailable. Reopen the operation to refresh BIGFOOT progress.',
          }
        contacts = qualifyingContacts(qsos, event)
        if (forestView) {
          remember(key, { contacts, focus })
          frame = celebrations.update({
            ...clock,
            focus,
            contacts,
            reason: args.reason,
            recordIds: qsos.flatMap((qso) => (typeof qso.uuid === 'string' ? [qso.uuid] : [])),
          })
        }
      }
      if (forestView && frame)
        return {
          kind: 'svgScene',
          title: `BIGFOOT Hunt · ${MODE_LABELS[focus]} ${buildProgress(contacts)[focus].worked}/7`,
          scene: huntScene({
            contacts,
            focus,
            frame,
            environment: args.environment,
            motion: config.motion !== false,
          }),
          triggers: frame.nextTick ? ['tick:1'] : [],
        }
      return {
        kind: 'markdown',
        title: `BIGFOOT Hunt ${event.year}`,
        content: progressMarkdown(contacts, focus),
        triggers: [],
      }
    },
    async onEvent(args) {
      if (args.event.action !== 'wave' || !snapshots.has(snapshotKey(args))) {
        throw new Error('Open the BIGFOOT forest scene to wave hello.')
      }
      const frame = celebrations.greet(clockFor(args))
      return { values: { hop: frame.phase, wave: frame.phase } }
    },
  }
}

export const BigfootPanel = createBigfootPanel()
