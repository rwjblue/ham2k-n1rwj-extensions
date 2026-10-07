import type { PanelHook } from '@ham2k/extension-sdk'
import { bigfootRef, eventFromOperation, FORM_URL, RULES_URL, SPOTS_URL } from './activity.ts'
import {
  buildProgress,
  type Contact,
  type Progress,
  type ProgressMode,
  qualifyingContacts,
  sameModeProgress,
} from './rules.ts'

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

export const BigfootPanel = {
  async getPanels() {
    return [
      {
        key: 'hunt',
        title: 'BIGFOOT Hunt',
        icon: 'paw',
        description: 'BIGFOOT letters, qualifying W7O contacts and Skunk Ape bonus.',
        on: ['operation', 'qsoLogged'],
        form: [
          {
            type: 'field',
            fieldType: 'select',
            key: 'focus',
            label: 'Checklist mode',
            value: 'CW',
            options: (['CW', 'MIXED', 'PHONE', 'DIGITAL'] as const).map((mode) => ({
              value: mode,
              label: MODE_LABELS[mode],
            })),
          },
        ],
      },
    ]
  },
  async render({ operation, config }, ctx) {
    if (!operation)
      return {
        kind: 'markdown',
        title: 'BIGFOOT Hunt',
        content: 'Open a BIGFOOT operation to see hunt progress.',
      }
    const event = eventFromOperation(operation)
    if (!event)
      return {
        kind: 'markdown',
        title: 'BIGFOOT Hunt',
        content: bigfootRef(operation)
          ? 'This event edition has no confirmed rules. Select BIGFOOT Hunt 2026 in the operation’s activities.'
          : 'Add **BIGFOOT Hunt 2026** to this operation’s activities. Use a dedicated operation for the hunt, then log the actual event station, band, mode and reports.',
      }
    if (typeof operation.uuid !== 'string' || !ctx.getQsos)
      return {
        kind: 'markdown',
        title: `BIGFOOT Hunt ${event.year}`,
        content:
          'The operation log is unavailable. Reopen the operation in a Ham2K version with extension log access.',
      }
    // Read only on operation/log changes, never on a callsign keystroke. Do
    // not cache by qsoCount: editing a band, mode or date can change credit.
    const qsos = await ctx.getQsos(operation.uuid)
    if (!qsos)
      return {
        kind: 'markdown',
        content:
          'The operation log is unavailable. Reopen the operation to refresh BIGFOOT progress.',
      }
    const focus =
      config.focus === 'PHONE' || config.focus === 'DIGITAL' || config.focus === 'MIXED'
        ? config.focus
        : 'CW'
    return {
      kind: 'markdown',
      title: `BIGFOOT Hunt ${event.year}`,
      content: progressMarkdown(qualifyingContacts(qsos, event), focus),
    }
  },
} satisfies PanelHook
