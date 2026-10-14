import type { ActivityHook, FormElement, RefHandlerHook } from '@ham2k/extension-sdk'
import { receivedGroup, resolveSent, validGroup } from './exchange.ts'
import { operationGroups, REF_TYPE, RULES_URL, refOf, text } from './model.ts'
import type { RetirementStore } from './retirement.ts'
import { parseTxList } from './tx-list.ts'

function eventKey(value: unknown): string {
  const source = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^\d+$/.test(source) ? `RG#${source}` : source
}

export function createActivity(retired: RetirementStore) {
  const activity = {
    async suggest({ searchTerm, scoped }) {
      const term = (searchTerm ?? '').trim().toUpperCase()
      if (
        !scoped &&
        !['RG', 'RANDOMGRAM', 'RANDOM GRAM'].some((name) => term && name.includes(term))
      )
        return []
      const ref = /^\d+$/.test(term) || /^RG#\d+$/.test(term) ? eventKey(term) : 'RG'
      return [
        {
          type: REF_TYPE,
          ref,
          program: 'Contest',
          label: 'RandomGram',
          shortLabel: 'RG',
          name: 'Exchange organizer-issued five-character groups',
          relevance: 1,
        },
      ]
    },
    async operationControls({ operation }) {
      const original = refOf(operation)
      const groups = operationGroups(operation)
      const fromList = (state: Record<string, unknown>) =>
        parseTxList(typeof state.txList === 'string' ? state.txList : '')
      const participant = (value: unknown, state: Record<string, unknown>) =>
        (typeof value === 'string' ? value.trim().toUpperCase() : '') ||
        text(operation.stationCall).trim().toUpperCase() ||
        fromList(state).call ||
        text(original?.issuedCall).trim().toUpperCase()
      const originalOwner =
        text(original?.participant).trim().toUpperCase() ||
        text(original?.issuedCall).trim().toUpperCase() ||
        text(operation.stationCall).trim().toUpperCase()
      const selectedEvent = (value: unknown, state: Record<string, unknown>) => {
        const key = eventKey(value)
        return key && key !== 'RG' ? key : (fromList(state).event ?? '')
      }
      const elements: FormElement[] = [
        {
          type: 'field',
          fieldType: 'text',
          key: 'ref',
          label: 'Event number',
          value: text(original?.ref) === 'RG' ? '' : text(original?.ref),
          placeholder: 'RG#48',
          uppercase: true,
          validate(value, state) {
            const selected = selectedEvent(value, state)
            if (!/^RG#\d+$/.test(selected))
              return 'Enter the event number or paste the complete issued list.'
            if (/^RG#\d+$/.test(text(original?.ref)) && selected !== text(original?.ref))
              return 'Use a new operation for a different RandomGram event.'
            return null
          },
          transform: selectedEvent,
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'participant',
          label: 'Your callsign / SWL ID',
          value: originalOwner,
          uppercase: true,
          validate(value, state) {
            return groups.length && participant(value, state) !== originalOwner
              ? 'Use a new operation for a different list owner.'
              : null
          },
          transform: participant,
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'alphabet',
          label: 'Code groups for this event',
          value: text(original?.alphabet) || 'alphanumeric',
          validate(value) {
            return original?.alphabet && value !== original.alphabet
              ? 'Use a new operation for a different event alphabet.'
              : null
          },
          options: [
            { value: 'alphanumeric', label: 'Letters and digits' },
            { value: 'letters', label: 'Letters only' },
          ],
        },
        {
          type: 'field',
          fieldType: 'multiline',
          key: 'txList',
          label: 'Organizer-issued TX list',
          value: text(original?.txList) || groups.join('\n'),
          placeholder: 'Paste the whole organizer message or one group per line.',
          validate(value, state) {
            const raw = typeof value === 'string' ? value : ''
            if (!raw.trim())
              return groups.length
                ? 'Keep the issued groups; use a new operation to replace this list.'
                : null
            const parsed = parseTxList(raw)
            if (parsed.error) return parsed.error
            if (
              parsed.groups.some(
                (group) =>
                  !validGroup(group, state.alphabet === 'letters' ? 'letters' : 'alphanumeric'),
              )
            )
              return 'The list does not match this event’s selected alphabet.'
            const owner = participant(state.participant, state)
            if (parsed.call && owner && parsed.call !== owner)
              return 'This list was issued to a different callsign / SWL ID.'
            if (parsed.event && parsed.event !== selectedEvent(state.ref, state))
              return 'The issued list belongs to a different event.'
            if (groups.some((group, index) => parsed.groups[index] !== group))
              return 'Keep existing groups in their original order; append additional issued groups below them.'
            return null
          },
          transform(value) {
            return typeof value === 'string' ? value.trim().replace(/\r\n?/g, '\n') : ''
          },
        },
        {
          type: 'markdown',
          text:
            'Send a real RST and one new group per QSO. Repeat contacts are allowed after calling or answering CQ RG. Import only the list issued for this event. Additional lists can be appended.\n\nAdd the RandomGram Exchange pane to keep the full TX group visible. For a listening-only entry use `RGSWL GROUP`. Use `RGREPORT` to copy all received groups. After transmitting an unlogged group, use `RGSKIP`, then manually set the TX item to the next unused position before sending.\n\nFinal scores depend on the organizer’s cross-checks. Export received groups for submission.\n\n[Organizer rules](' +
            RULES_URL +
            ')',
        },
      ]
      return [
        {
          key: 'n1rwj-randomgram/setup',
          label: 'RandomGram',
          icon: 'shuffle-variant',
          color: '#00695C',
          order: 10,
          editable: true,
          input: { kind: 'form', refType: REF_TYPE, form: { title: 'RandomGram setup', elements } },
        },
      ]
    },
    async loggingControls({ operation }) {
      if (!refOf(operation)) return []
      const start = (await retired.through(operation)) + 1
      const common = { icon: 'shuffle-variant', color: '#00695C' }
      return [
        {
          ...common,
          key: 'n1rwj-randomgram/tx-item',
          label: 'TX item',
          order: 10,
          skipFocus: true,
          input: {
            kind: 'serial',
            refType: REF_TYPE,
            field: 'ourSerial',
            sequence: { key: 'tx-item', start },
          },
        },
        {
          ...common,
          key: 'n1rwj-randomgram/rx-group',
          label: 'RX group',
          order: 20,
          input: {
            kind: 'text',
            refType: REF_TYPE,
            field: 'theirGroup',
            uppercase: true,
            maxLength: 5,
            pattern: refOf(operation)?.alphabet === 'letters' ? '[A-Z]{5}' : '[A-Z0-9]{5}',
          },
        },
        {
          ...common,
          key: 'n1rwj-randomgram/tx-override',
          label: 'TX override',
          shortLabel: 'TX fix',
          order: 30,
          skipFocus: true,
          input: {
            kind: 'text',
            refType: REF_TYPE,
            field: 'ourGroup',
            uppercase: true,
            maxLength: 5,
            pattern: refOf(operation)?.alphabet === 'letters' ? '[A-Z]{5}' : '[A-Z0-9]{5}',
          },
        },
      ]
    },
    async processQsoBeforeSave({ operation, qso }) {
      if (!refOf(operation) || qso.band === 'event') return null
      const sent = resolveSent(operation, qso)
      // Snapshot the literal exchange. Batch contacts with no allocated item
      // yet retain a blank TX snapshot; exports can resolve their final index.
      return { our: { exchange: sent.group }, their: { exchange: receivedGroup(qso) } }
    },
  } satisfies ActivityHook

  const refHandler = {
    async validateRef({ ref }) {
      const normalized = eventKey(ref.ref)
      return { valid: /^RG(?:#\d+)?$/.test(normalized), normalized }
    },
    async decorateRef({ ref }) {
      const parsed = parseTxList(text(ref.txList))
      const txGroups = parsed.error ? [] : parsed.groups
      const enteredEvent = eventKey(ref.ref)
      const event = enteredEvent && enteredEvent !== 'RG' ? enteredEvent : parsed.event || 'RG'
      return {
        ...ref,
        ref: event,
        txGroups,
        txList: txGroups.join('\n'),
        ...(parsed.call ? { issuedCall: parsed.call } : {}),
        ...(parsed.event ? { issuedEvent: parsed.event } : {}),
        ...(parsed.declaredCount ? { issuedCount: parsed.declaredCount } : {}),
        program: 'Contest',
        label: event === 'RG' ? 'RandomGram' : `RandomGram ${event}`,
        shortLabel: event,
        name: txGroups.length
          ? `${txGroups.length} issued TX groups`
          : 'Listening only / TX list not imported',
      }
    },
    async suggestOperationTitle({ ref }) {
      return {
        for: ref.ref === 'RG' ? 'RandomGram' : `RandomGram ${ref.ref}`,
        subtitle: text(ref.participant) || undefined,
      }
    },
    async linkForRef() {
      return { url: RULES_URL, label: 'RandomGram rules' }
    },
  } satisfies RefHandlerHook
  return { activity, refHandler }
}
