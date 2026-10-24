// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  ActivityHook,
  FormElement,
  LoggingControlDescriptor,
  RefHandlerHook,
} from '@ham2k/extension-sdk'
import { EVENTS, eventFor, eventOn, sessionFor, upcomingSessions } from './events.ts'
import { getExchange, KEY_OPTIONS, snapshotBeforeSave } from './exchange.ts'
import { HOME, KEY, memberNumber, object, type RosterGetter, refOf, TYPE, text } from './model.ts'
import { lookupMember } from './roster.ts'

export interface ActivityPreferences {
  myNumber?: string
  myName?: string
  mySpc?: string
  myKey?: string
}
export type PreferencesGetter = () => ActivityPreferences | Promise<ActivityPreferences>
const qualification = [
  { code: '', name: 'Unknown' },
  { code: 'yes', name: 'Confirmed qualifying exchange' },
  { code: 'no', name: 'Not qualifying' },
]

export function createActivity(
  getRoster: RosterGetter,
  getPreferences: PreferencesGetter = () => ({}),
): ActivityHook {
  return {
    async suggest({ searchTerm, scoped }) {
      const term = text(searchTerm).toLowerCase()
      const now = Date.now()
      const sessions = upcomingSessions(now, 100)
      const suggestions = [
        {
          type: TYPE,
          ref: 'general',
          label: 'SKCC contacts and hunting',
          shortLabel: 'SKCC',
          program: 'Club activity',
          name: EVENTS[0].description,
          relevance: 1,
        },
        ...sessions.map((session) => ({
          type: TYPE,
          ref: session.key,
          label: session.label,
          shortLabel: eventFor(session.event)?.label ?? 'SKCC',
          program: eventFor(session.event)?.contest ? 'Contest' : 'Club activity',
          name: `${new Date(session.start).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${eventFor(session.event)?.description ?? ''}`,
          relevance: session.start <= now && session.end > now ? 1 : 0.5,
        })),
      ]
      return suggestions
        .filter((item) => {
          if (term || scoped) return true
          const session = sessionFor(item.ref)
          return (
            session !== undefined &&
            (session.qrsStart ?? session.start) <= now &&
            (session.qrsEnd ?? session.end) > now
          )
        })
        .filter(
          (item) =>
            !term || term === 'skcc' || `${item.label} ${item.ref}`.toLowerCase().includes(term),
        )
        .slice(0, 24)
    },
    async operationControls({ operation }) {
      const defaults = await getPreferences()
      const current = refOf(operation) ?? {}
      const options = [
        { value: 'general', label: 'Everyday SKCC contacts and hunting' },
        ...upcomingSessions(Date.now(), 100).map((session) => ({
          value: session.key,
          label: session.label,
        })),
      ]
      const key = text(current.ref)
      if (key && !options.some((option) => option.value === key))
        options.unshift({ value: key, label: sessionFor(key)?.label ?? key })
      const value = (field: string, fallback?: string) =>
        field in current ? current[field] : fallback
      const elements: FormElement[] = [
        {
          type: 'field',
          fieldType: 'select',
          key: 'ref',
          label: 'Activity / event edition',
          options,
          value: key || 'general',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourNumber',
          label: 'My transmitted SKCC number (with C/T/S), or NONE',
          uppercase: true,
          value: value('ourNumber', defaults.myNumber),
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourName',
          label: 'My transmitted name',
          value: value('ourName', defaults.myName),
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourSpc',
          label: 'My transmitted state / province / country code',
          uppercase: true,
          value: value('ourSpc', defaults.mySpc),
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'ourKey',
          label: 'My key',
          options: KEY_OPTIONS.map((option) => ({ value: option.code, label: option.name })),
          value: value('ourKey', defaults.myKey),
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'ourQualified',
          label: 'My operation follows SKCC key and exchange rules',
          options: qualification.map((option) => ({ value: option.code, label: option.name })),
          value: value('ourQualified', ''),
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'ourKeyDeclared',
          label: 'I identify my key type over the air (Triple Key evidence)',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'ourGrid',
          label: 'My transmitted grid (QSO Party)',
        },
        {
          type: 'field',
          fieldType: 'number',
          key: 'ourPower',
          label: 'My transmitted power (watts; leave unknown blank)',
        },
        {
          type: 'field',
          fieldType: 'callsign',
          key: 'ourOperatorCall',
          label: 'My personal operator callsign',
        },
        {
          type: 'field',
          fieldType: 'checkbox',
          key: 'captureDetails',
          label: 'Show key, operator, power, speed and event-region fields',
        },
        {
          type: 'markdown',
          text: 'Roster values are hints. Receive and confirm the exchange; a roster match alone never proves a qualifying QSO. End times and actual station locations use the logger’s ordinary QSO fields. SKCC can be combined with POTA and other activities.',
        },
      ]
      const event = eventOn(operation)
      if (event && event.id !== 'general')
        elements.push({
          type: 'markdown',
          text: `${event.description}\n\n[Current official rules](${event.rules})`,
        })
      if (event?.contest)
        elements.push(
          {
            type: 'field',
            fieldType: 'select',
            key: 'entryCategory',
            label: 'Entry category',
            options: ['QRPp', 'QRP', 'QRO', 'QRO+', 'Multi-Operator', 'SWL'].map((label) => ({
              value: label,
              label,
            })),
          },
          {
            type: 'field',
            fieldType: 'callsign',
            key: 'bonusCall',
            label: 'Reviewed designated bonus callsign (SKS; blank means not configured)',
          },
        )
      if (
        event?.id === 'wes' ||
        event?.id === 'sks' ||
        event?.id === 'skse' ||
        event?.id === 'sksa'
      )
        elements.push(
          {
            type: 'field',
            fieldType: 'text',
            key: 'themeName',
            label: 'Reviewed event theme / rule changes',
          },
          {
            type: 'field',
            fieldType: 'select',
            key: 'themeMode',
            label: 'Scoring review',
            options: [
              { value: '', label: 'Not reviewed — base estimate only' },
              { value: 'none', label: 'Reviewed — standard rules, no extra theme bonus' },
              {
                value: 'additive',
                label: 'Reviewed — standard rules plus manually calculated theme bonus',
              },
              { value: 'custom', label: 'Special scoring — enter reviewed final score' },
            ],
          },
          {
            type: 'field',
            fieldType: 'number',
            key: 'themeBonus',
            label: 'Manually reviewed additional theme points',
          },
          {
            type: 'field',
            fieldType: 'number',
            key: 'reviewedScore',
            label: 'Reviewed final score (special scoring only)',
          },
          {
            type: 'markdown',
            text: 'Monthly themes may change more than bonus points. Only select standard rules after reviewing the edition. For a special formula, keep the exchange worksheet and enter the independently reviewed final score. Bonuses are not inferred from today’s roster.',
          },
        )
      if (event?.id === 'qso-party')
        elements.push({
          type: 'field',
          fieldType: 'checkbox',
          key: 'photoSoapbox',
          label: 'Photo and soapbox included in the submission (+100 points)',
        })
      return [
        {
          key: `${KEY}/setup`,
          label: 'SKCC setup',
          icon: 'key',
          order: 20,
          input: {
            kind: 'form',
            refType: TYPE,
            form: {
              title: 'SKCC setup',
              elements: elements.map((element) =>
                element.type === 'field' && element.key in current
                  ? { ...element, value: current[element.key] }
                  : element,
              ),
            },
          },
        },
      ]
    },
    async loggingControls({ operation, qso = {} }) {
      if (!refOf(operation)) return []
      const received = getExchange(qso)
      const their = object(qso.their)
      const member = lookupMember(
        getRoster(),
        text(their.call),
        'number' in received ? received.number : undefined,
      )
      const hint = (field: string, fallback?: string) =>
        field in received ? undefined : fallback || ' '
      const controls: LoggingControlDescriptor[] = []
      const input = (field: string, label: string, order: number, suggestion?: string) =>
        controls.push({
          key: `${KEY}/${field}`,
          label,
          shortLabel: label,
          icon: 'key',
          order,
          input: {
            kind: 'text',
            refType: TYPE,
            field,
            uppercase: true,
            suggestedValue: suggestion,
          },
        })
      input('name', 'Name', 10, hint('name', member?.name))
      input('spc', 'SPC', 20, hint('spc', member?.spc))
      input(
        'number',
        'SKCC #',
        30,
        hint('number', member ? member.number + member.suffix : undefined),
      )
      controls.push({
        key: `${KEY}/qualified`,
        label: 'Received exchange',
        shortLabel: 'Valid?',
        icon: 'key',
        order: 40,
        input: { kind: 'options', refType: TYPE, field: 'qualified', options: qualification },
      })
      const event = eventOn(operation)
      if (event?.id === 'qso-party') input('grid', 'Grid', 35)
      if (
        refOf(operation)?.captureDetails === true ||
        event?.id === 'k3y' ||
        event?.id === 'cskm'
      ) {
        input('operatorCall', 'Operator call', 50)
        controls.push({
          key: `${KEY}/key`,
          label: 'Their key',
          icon: 'key',
          order: 60,
          input: { kind: 'options', refType: TYPE, field: 'key', options: KEY_OPTIONS },
        })
        input('power', 'Their watts', 70)
        input('wpm', 'WPM', 80)
        input('region', 'Event region', 90)
      } else if (event?.id === 'skse') input('wpm', 'WPM (QRS edges)', 50)
      return controls
    },
    async processQsoBeforeSave({ qso, operation }) {
      if (!refOf(operation) && !refOf(qso)) return null
      const defaults = await getPreferences()
      const setup = {
        type: TYPE,
        ref: 'general',
        ourNumber: defaults.myNumber ?? '',
        ourName: defaults.myName ?? '',
        ourSpc: defaults.mySpc ?? '',
        ourKey: defaults.myKey ?? '',
        ...refOf(operation),
      }
      return snapshotBeforeSave(qso, { ...operation, refs: [setup] })
    },
  }
}

export const SKCCRefHandler: RefHandlerHook = {
  async validateRef({ ref }) {
    const raw = text(ref.ref)
    return {
      valid:
        raw === 'general' ||
        !!sessionFor(raw) ||
        !!memberNumber(raw) ||
        (!raw && ('number' in ref || 'name' in ref)),
    }
  },
  async decorateRef({ ref }) {
    const session = sessionFor(ref.ref)
    if (session)
      return {
        ...ref,
        label: session.label,
        shortLabel: eventFor(session.event)?.label ?? 'SKCC',
        program: eventFor(session.event)?.contest ? 'Contest' : 'Club activity',
      }
    return {
      ...ref,
      label:
        text(ref.ref) === 'general'
          ? 'SKCC contacts and hunting'
          : `SKCC ${text(ref.number) || text(ref.ref)}`,
      shortLabel: 'SKCC',
      program: 'Club activity',
    }
  },
  async suggestOperationTitle({ ref }) {
    const session = sessionFor(ref.ref)
    return session ? { for: session.label, priority: 80 } : null
  },
  async linkForRef({ ref }) {
    return { url: eventFor(ref.ref)?.rules ?? HOME, label: 'SKCC rules and information' }
  },
}
