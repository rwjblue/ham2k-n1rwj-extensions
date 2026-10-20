// Copyright ©️ 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  ActivityHook,
  FormElement,
  LoggingControlDescriptor,
  RefHandlerHook,
} from '@ham2k/extension-sdk'
import type { LoadedFile } from './data.ts'
import { effectiveSent, exchangeText, received } from './exchange.ts'
import { createZombieHistory } from './history.ts'
import {
  BONUS_NUMBER,
  EVENT_REF,
  object,
  type Qson,
  RULES_URL,
  refOf,
  TYPE,
  text,
} from './model.ts'
import { operationSession, sessionFor } from './schedule.ts'
import { zombieSpcSuggestion } from './spc.ts'

type Manifest = { key: string; icon: string; accentColor: string }

export function createActivity(
  manifest: Manifest,
  file: () => LoadedFile | undefined = () => undefined,
) {
  const history = createZombieHistory()
  const activity = {
    async suggest({ searchTerm, scoped }, _ctx) {
      const term = (searchTerm ?? '').trim().toUpperCase()
      if (
        term &&
        !['ZOMBIE', 'ZOMBIE SHUFFLE', 'BOO', 'CQ BOO', EVENT_REF].some((alias) =>
          alias.includes(term),
        )
      )
        return []
      const now = Date.now()
      if (!term && !scoped && (now < Date.UTC(2026, 9, 1) || now >= Date.UTC(2026, 10, 1)))
        return []
      return [
        {
          type: TYPE,
          ref: EVENT_REF,
          program: 'Contest',
          label: 'Zombie Shuffle 2026',
          shortLabel: 'Zombie 2026',
          name: 'October 30 · 15:00–midnight local time · CW / QRP',
          relevance: 1 / (1 + Math.abs(Date.UTC(2026, 9, 30) - now) / 86_400_000),
        },
      ]
    },
    async operationControls({ operation }, _ctx) {
      const op = refOf(operation)
      const elements: FormElement[] = [
        {
          type: 'field',
          fieldType: 'select',
          key: 'ref',
          label: 'Event',
          value: text(op?.ref) || EVENT_REF,
          options: [{ value: EVENT_REF, label: '2026 · Friday, October 30' }],
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourSpc',
          label: 'Your state / province / country',
          uppercase: true,
          placeholder: 'RI, ONT or country',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourZombieNumber',
          label: 'Your assigned Zombie number or three-digit area code',
          placeholder: 'Keep your regular number here, including when a bonus station',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourZombieName',
          label: 'Your spooky name',
          uppercase: true,
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'bonusStation',
          label: `I am an approved 2026 bonus station (send ${BONUS_NUMBER})`,
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'utcOffset',
          label: 'UTC offset at your operating location on October 30 (required)',
          placeholder: '-04:00, -07:00 or +00:00',
          validate(value) {
            return sessionFor(EVENT_REF, String(value ?? ''))
              ? null
              : 'Enter the event-day UTC offset as +HH:MM or -HH:MM.'
          },
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'flexibleHours',
          label: 'HI, AK or DX: use flexible hours on the local event date',
        },
        {
          type: 'markdown',
          text: `CW only, 5 W or less, October 30, 2026. Normally 15:00–midnight at your operating location; HI, AK and DX may use other hours. Set the UTC offset for that date, including daylight saving time.\n\nSend RST, state/province/country, Zombie number and spooky name. RST uses the normal Sent/Rcvd fields. Type _ for a space in the received SPC or Zombie name field: OLD_NICK becomes OLD NICK. Space advances to the next field; pasted spaces are preserved. Bonus stations send ${BONUS_NUMBER}; your regular number stays configured above. The same station may be worked on each band again after two elapsed hours.\n\n[Official rules](${RULES_URL})`,
        },
      ]
      return [
        {
          key: `${manifest.key}/setup`,
          label: 'Zombie Shuffle',
          icon: manifest.icon,
          color: manifest.accentColor,
          order: 10,
          editable: true,
          input: {
            kind: 'form',
            refType: TYPE,
            form: { title: 'Zombie Shuffle setup', elements },
          },
        },
      ]
    },
    async loggingControls({ operation, qso }, ctx) {
      if (!refOf(operation)) return []
      const hints = await history.suggestions(operation, qso ?? {}, ctx, file())
      const spc = hints.spc || zombieSpcSuggestion(object(qso?.their))
      const control = (
        field: string,
        label: string,
        shortLabel: string,
        order: number,
        suggestedValue: string | undefined,
        numeric = false,
      ): LoggingControlDescriptor => ({
        key: `${manifest.key}/${field}`,
        label,
        shortLabel,
        order,
        icon: manifest.icon,
        color: manifest.accentColor,
        input: {
          kind: 'text',
          refType: TYPE,
          field,
          uppercase: true,
          // Numeric text is deliberately not a core-allocated serial.
          ...(numeric
            ? { numeric: true, pattern: '[0-9]+' }
            : { transforms: [{ pattern: '_', replacement: ' ', flags: 'g' }] }),
          suggestedValue: suggestedValue || ' ',
          placeholder: suggestedValue || undefined,
        },
      })
      return [
        control('theirSpc', 'State / province / country (_ = space)', 'SPC', 10, spc),
        control('theirZombieNumber', 'Zombie number', 'Zombie #', 20, hints.zombieNumber, true),
        control('theirZombieName', 'Zombie name (_ = space)', 'Name', 30, hints.zombieName),
      ]
    },
    async processQsoBeforeSave({ operation, qso }, _ctx) {
      if (!refOf(operation)) return null
      const ours = effectiveSent(operation, qso)
      const held = object(object(qso.our).zombie)
      const year =
        'ref' in held ? text(held.ref) : text(refOf(qso)?.ref) || text(refOf(operation)?.ref)
      return {
        // Native QSON sides retain JSON extras and their one-level patch merge
        // works on older hosts too. Ref patches require newer host behavior.
        our: { zombie: { ...ours, ref: year } },
        their: { exchange: exchangeText(received(qso)) },
      }
    },
  } satisfies ActivityHook
  const decorate = (ref: Qson) => {
    const operation: Qson = { refs: [ref] }
    const session = operationSession(operation)
    const exchange = effectiveSent(operation, {})
    return {
      ...ref,
      type: TYPE,
      program: 'Contest',
      label: `Zombie Shuffle ${text(ref.ref) || EVENT_REF}`,
      shortLabel: `Zombie ${text(ref.ref) || EVENT_REF}`,
      name: `${exchangeText(exchange) || 'Configure your exchange'} · ${session ? `UTC${text(ref.utcOffset)}` : 'Set event-day UTC offset'}`,
    }
  }
  const refHandler = {
    async validateRef({ ref }, _ctx) {
      const normalized = text(ref.ref).trim()
      return { valid: normalized === EVENT_REF, normalized }
    },
    async decorateRef({ ref }, _ctx) {
      return decorate(ref as Qson)
    },
    async suggestOperationTitle({ ref }, _ctx) {
      const decorated = decorate(ref as Qson)
      return { for: decorated.label, subtitle: decorated.name }
    },
    async linkForRef(_args, _ctx) {
      return { url: RULES_URL, label: 'Zombie Shuffle rules' }
    },
  } satisfies RefHandlerHook
  return { activity, refHandler, history }
}
