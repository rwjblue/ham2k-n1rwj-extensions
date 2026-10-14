import type { CommandHook, FormDefinition, JSONValue } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import { resolveSent, validGroup } from './exchange.ts'
import { receivedSubmission, submissionText } from './exports.ts'
import { operationGroups, position, type Qson, REF_TYPE, refOf, text } from './model.ts'
import type { RetirementStore } from './retirement.ts'

function annotation(note: string, ref: Qson): Qson {
  return {
    band: 'event',
    freq: 0,
    mode: 'note',
    our: { call: 'EVENT' },
    their: { call: 'NOTE' },
    event: { event: 'note', note },
    refs: [ref],
  }
}

export function createCommands(
  retired: RetirementStore,
  showForm: (form: FormDefinition) => Promise<unknown> = host.showForm,
): CommandHook {
  return {
    async catalog() {
      return [
        {
          command: 'RGREPORT',
          describe: 'Copy received RandomGram groups for submission',
          category: 'RandomGram',
          needsOperation: true,
        },
        {
          command: 'RGSWL',
          params: '<group>',
          describe: 'Log a RandomGram group copied while listening',
          category: 'RandomGram',
          needsOperation: true,
          expectsParams: true,
        },
        {
          command: 'RGSKIP',
          params: '[TX item]',
          describe: 'Retire a transmitted RandomGram group without logging a contact',
          category: 'RandomGram',
          needsOperation: true,
        },
      ]
    },
    async interpret({ input, operation, qso, execute }, ctx) {
      const match = /^\s*(RGSWL|RGSKIP|RGREPORT)(?:\s+(.*))?\s*$/i.exec(input)
      if (!match) return null
      if (!operation || !refOf(operation)) return { error: 'Open a RandomGram operation first.' }
      const opRef = refOf(operation)
      const command = match[1].toUpperCase()
      const arg = (match[2] ?? '').trim().toUpperCase()
      if (command === 'RGREPORT') {
        if (arg) return { error: 'RGREPORT does not take a parameter.' }
        if (execute) {
          if (!ctx.getQsos || !text(operation.uuid))
            return { error: 'This host cannot retrieve the operation’s received groups.' }
          const qsos = await ctx.getQsos(text(operation.uuid))
          if (!qsos) return { error: 'The operation log is unavailable. Try again.' }
          const submission = receivedSubmission(operation, qsos)
          const omissions: string[] = []
          if (submission.repeated)
            omissions.push(
              `${submission.repeated} repeated received group${submission.repeated === 1 ? '' : 's'} omitted.`,
            )
          if (submission.invalid)
            omissions.push(
              `${submission.invalid} invalid entr${submission.invalid === 1 ? 'y' : 'ies'} omitted.`,
            )
          await showForm({
            title: 'RandomGram received groups',
            elements: [
              {
                type: 'markdown',
                text:
                  'Select and copy the text below for your email submission. It includes received QSO and listening-only groups once each. Close this dialog after copying.' +
                  (omissions.length ? `\n\n${omissions.join(' ')}` : ''),
              },
              {
                type: 'field',
                fieldType: 'multiline',
                key: 'submission',
                label: 'Received-group submission (select and copy)',
                value: submissionText(operation, qsos),
              },
            ],
          })
        }
        return {
          describe: 'Copy received groups for submission (including listening-only entries)',
        }
      }
      if (command === 'RGSWL') {
        if (!arg)
          return { expectsParams: true, describe: 'Enter the five-character group you copied.' }
        if (!validGroup(arg, opRef?.alphabet === 'letters' ? 'letters' : 'alphanumeric'))
          return { error: 'Enter exactly five characters matching this event’s alphabet.' }
        return {
          describe: `Log received group ${arg} (listening only)`,
          commands: [
            {
              addQso: annotation(`RandomGram RX ${arg} (listening only)`, {
                type: REF_TYPE,
                ref: text(opRef?.ref),
                theirGroup: arg,
                listeningOnly: true,
              }),
            },
          ],
        }
      }
      if (qso?.uuid)
        return { error: 'RGSKIP is for a new, unlogged group. Keep recorded contacts intact.' }
      const item = arg ? position(arg) : position(refOf(qso ?? {})?.ourSerial)
      if (!item)
        return {
          error: 'Start a contact to select a TX item, or enter RGSKIP followed by its number.',
        }
      const group = operationGroups(operation)[item - 1]
      if (!group || !validGroup(group, opRef?.alphabet === 'letters' ? 'letters' : 'alphanumeric'))
        return { error: 'That TX item is not present in the issued list.' }
      const selected = resolveSent(operation, qso ?? {})
      if (!arg && selected.state !== 'ready')
        return { error: 'No valid TX group is selected. Enter the actual issued item number.' }
      if (!arg && selected.group !== group)
        return {
          error:
            'The TX override differs from this list item. Enter the item number for the group you actually sent.',
        }
      if (execute) {
        if (await retired.isRetired(operation, item))
          return { error: 'That TX item is already retired.' }
        // Persist a retirement hint before returning the log action. Current
        // hosts still need an explicit TX item correction after a skipped QSO.
        await retired.retire(operation, item)
      }
      const ref: Record<string, JSONValue> = {
        type: REF_TYPE,
        ref: text(opRef?.ref),
        ourSerial: item,
        ourGroup: group,
        skipped: true,
      }
      return {
        describe: `Record used item ${item} (${group}); set TX item to your next unused position before transmitting`,
        commands: [
          {
            addQso: annotation(
              `RandomGram TX item ${item}: ${group} used without a contact. Set TX item to your next unused position before transmitting.`,
              ref,
            ),
          },
        ],
      }
    },
  }
}
