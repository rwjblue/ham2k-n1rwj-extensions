import type { ActivityHook, RefHandlerHook } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { EVENT_2026, eventForYear, type Qson } from './rules.ts'

export const REF_TYPE = 'bigfoot'
export const RULES_URL =
  'https://w7dk.org/?view=article&id=319:3rd-annual-national-sasquatch-day-special-event&catid=185'
export const SPOTS_URL = 'https://w7dk.org/?view=article&id=309&catid=178'
export const FORM_URL = 'https://w7dk.org/images/rct_special_events/BIGFOOT_QSO_SHEET.pdf'

export function bigfootRef(operation: Qson): Qson | undefined {
  return Array.isArray(operation.refs)
    ? operation.refs.find(
        (ref): ref is Qson =>
          !!ref && typeof ref === 'object' && !Array.isArray(ref) && ref.type === REF_TYPE,
      )
    : undefined
}

export function eventFromOperation(operation: Qson) {
  return eventForYear(bigfootRef(operation)?.ref)
}

export const BigfootActivity = {
  async suggest({ searchTerm, scoped }) {
    const term = (searchTerm ?? '').trim().toUpperCase()
    const searchable = 'BIGFOOT HUNT SASQUATCH SKUNK APE 2026 W7B W7I W7G W7F W7O W7T W4S'
    if (term && !term.split(/\s+/).every((word) => searchable.includes(word))) return []
    const now = Date.now()
    if (
      !term &&
      !scoped &&
      (now < EVENT_2026.startAtMillis - 30 * 86400000 || now >= EVENT_2026.endAtMillis)
    )
      return []
    return [
      {
        type: REF_TYPE,
        ref: '2026',
        program: 'Special Event',
        label: 'BIGFOOT Hunt 2026',
        shortLabel: 'BIGFOOT 2026',
        name: 'October 13–21 UTC · Radio Club of Tacoma',
        relevance: 1,
      },
    ]
  },
  async operationControls() {
    return [
      {
        key: `${manifest.key}/setup`,
        label: manifest.name,
        icon: manifest.icon,
        color: manifest.accentColor,
        order: 10,
        editable: true,
        input: {
          kind: 'form',
          refType: REF_TYPE,
          form: {
            title: 'BIGFOOT Hunt setup',
            elements: [
              {
                type: 'field',
                fieldType: 'select',
                key: 'ref',
                label: 'Event edition',
                value: '2026',
                options: [{ value: '2026', label: '2026 · October 13–21 UTC' }],
              },
              {
                type: 'markdown',
                text:
                  'Use a dedicated operation for this hunt. Contacts count from October 13, 2026 at 0000 UTC through October 21 at 2359 UTC. Log the actual callsign, band, mode and reports.\n\nSpell BIGFOOT with two W7O contacts on different bands, modes or UTC dates. W4S is tracked separately as the Skunk Ape bonus.\n\nAdd the BIGFOOT Hunt panel to your logging layout to see CW and mixed-mode progress. Only the confirmed 2026 edition is available.\n\n[Official rules](' +
                  RULES_URL +
                  ')',
              },
            ],
          },
        },
      },
    ]
  },
} satisfies ActivityHook

export const BigfootRefHandler = {
  async validateRef({ ref }) {
    const event = eventForYear(ref.ref)
    return { valid: !!event, ...(event ? { normalized: String(event.year) } : {}) }
  },
  async decorateRef({ ref }) {
    const event = eventForYear(ref.ref)
    return {
      ...ref,
      program: 'Special Event',
      label: event ? `BIGFOOT Hunt ${event.year}` : 'BIGFOOT Hunt — unknown edition',
      shortLabel: event ? `BIGFOOT ${event.year}` : 'BIGFOOT',
      name: event
        ? 'October 13–21 UTC · Radio Club of Tacoma'
        : 'Select the confirmed 2026 edition',
    }
  },
  async suggestOperationTitle({ ref }) {
    const event = eventForYear(ref.ref)
    return event ? { for: `BIGFOOT Hunt ${event.year}`, priority: 100 } : null
  },
  async linkForRef({ ref }) {
    return eventForYear(ref.ref) ? { url: RULES_URL, label: 'BIGFOOT event rules' } : null
  },
} satisfies RefHandlerHook
