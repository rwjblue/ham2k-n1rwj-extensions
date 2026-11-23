// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type {
  CommandHook,
  JSONValue,
  PanelHook,
  PanelRadioRaw,
  PanelRadioState,
  PanelRenderArgs,
  PanelSceneControl,
  SimpleSettingsPanel,
  TemplateContextArgs,
} from '@ham2k/extension-sdk'
import { defineExtension, host, triggersForTemplate } from '@ham2k/extension-sdk'
import manifest from '../manifest.json'
import { buttonLabel, macroContext, macroText, usesLiquid } from './templates.ts'

const title = 'CAT Macros'
const commandName = 'CATMACRO'
const aliasPattern = /^[A-Za-z0-9-]+$/
const settingsPath = 'Settings → CAT Control → CAT Macros'

const settings = {
  kind: 'simple',
  title,
  section: manifest.settings.section,
  sidebar: false,
  icon: manifest.icon,
  fields: [
    {
      type: 'field',
      fieldType: 'list',
      key: 'macros',
      label: 'Saved macros',
      itemLabel: 'Macro',
      itemTitle: `\${label} (\${alias})`,
      orderable: true,
      value: [],
      itemFields: [
        {
          type: 'field',
          fieldType: 'textTemplate',
          key: 'label',
          label: 'Button label',
          templateContext: 'text',
          description: 'Enter text or Liquid. The pane supplies the selected radio.',
          value: '',
        },
        {
          type: 'field',
          fieldType: 'text',
          key: 'alias',
          label: 'Shortcut alias',
          description: 'Use a unique alias to bind a key, for example CATMACRO NB-ON.',
          pattern: aliasPattern.source,
          patternError: 'Use letters, numbers or hyphens.',
          value: '',
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'radio',
          label: 'Radio',
          options: '$core.radios',
          none: 'Choose a radio',
          value: '',
        },
        {
          type: 'field',
          fieldType: 'select',
          key: 'format',
          label: 'Format',
          value: 'text',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Hex bytes', value: 'hex' },
          ],
        },
        {
          type: 'field',
          fieldType: 'textTemplate',
          key: 'text',
          label: 'CAT command',
          templateContext: 'text',
          description:
            'Enter text or Liquid. For Hex bytes, separate two-digit hex values with whitespace.',
          value: '',
        },
      ],
    },
    {
      type: 'action',
      style: 'row',
      key: 'about',
      label: 'About CAT Macros',
      icon: 'information-outline',
      method: 'showAbout',
    },
  ],
  async showAbout() {
    await host.showForm({
      title: 'About CAT Macros',
      elements: [
        {
          type: 'markdown',
          text: 'Add CAT Macros to your layout. Choose Text for text protocols or Hex bytes for CI-V and other binary protocols. The label and CAT command accept Liquid, including `op.station`, `radio.mode`, and `radio.frequencyHz`. The settings preview uses HaLo’s sample data. The pane and shortcut use the selected radio.',
        },
        {
          type: 'markdown',
          text: 'With `EXP KEYS` enabled, add `CATMACRO <alias>` in **Keyboard Shortcuts → Commands → Add Command** to bind a key.',
        },
      ],
    })
  },
} satisfies SimpleSettingsPanel & { showAbout(): Promise<void> }

interface Macro {
  label: string
  radio: string
  format: 'text' | 'hex'
  text: string
  event: string
}

type RadioHost = Pick<typeof host, 'getSettings' | 'readRadio' | 'sendRadioRaw'> & {
  statusBar: Pick<typeof host.statusBar, 'setMessage'>
}

function record(value: JSONValue | undefined): Record<string, JSONValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function panelContext(args: PanelRenderArgs, appName?: string): TemplateContextArgs {
  return {
    appName,
    operation: args.operation,
    qso: args.qso,
    qsoCount: args.qsoCount,
    nowMillis: args.clock?.nowMillis,
  }
}

export function createHooks(radioHost: RadioHost): { panel: PanelHook; command: CommandHook } {
  let previousMacros = new Map<string, Macro | null>()
  let eventVersion = 0

  async function getMacros() {
    const extensions = record((await radioHost.getSettings()).extensions)
    const { macros } = record(extensions[`extension_${manifest.key}`])
    const byAlias = new Map<string, Macro | null>()
    for (const entry of Array.isArray(macros) ? macros : []) {
      const { alias, label, radio, text, format = 'text' } = record(entry)
      if (
        typeof alias !== 'string' ||
        !aliasPattern.test(alias) ||
        typeof label !== 'string' ||
        !label.trim() ||
        typeof radio !== 'string' ||
        !radio ||
        (format !== 'text' && format !== 'hex') ||
        typeof text !== 'string' ||
        !text.trim()
      )
        continue

      const key = alias.toUpperCase()
      if (byAlias.has(key)) {
        byAlias.set(key, null)
        continue
      }
      const old = previousMacros.get(key)
      // An old button can stay on screen until the next render. Its click
      // must match the saved templates and radio it represented at render time.
      const event =
        old?.label === label && old.radio === radio && old.format === format && old.text === text
          ? old.event
          : `send:${key}:${++eventVersion}`
      byAlias.set(key, { label, radio, format, text, event })
    }
    previousMacros = byAlias
    return byAlias
  }

  async function sendMacro(
    alias: string,
    macro: Macro,
    args: TemplateContextArgs,
  ): Promise<{ error: string } | { confirm: string }> {
    const radio = await radioHost.readRadio(macro.radio)
    if (radio?.id !== macro.radio || radio.status !== 'connected') {
      return { error: `${alias}: the selected radio is disconnected or unavailable.` }
    }
    const context = macroContext(args, radio)
    let text: string
    try {
      text = macroText(macro.text, context, `${alias} CAT command`)
    } catch (error) {
      return { error: error instanceof Error ? error.message : `${alias}: invalid CAT template.` }
    }
    if (!text.trim()) return { error: `${alias}: CAT template produced no command.` }

    let payload: Pick<PanelRadioRaw, 'text' | 'bytes'> = { text }
    if (macro.format === 'hex') {
      const tokens = text.trim().split(/\s+/)
      if (tokens.length > 4096 || tokens.some((token) => !/^[0-9a-f]{2}$/i.test(token))) {
        return { error: `${alias}: enter up to 4096 two-digit hex bytes separated by whitespace.` }
      }
      payload = { bytes: tokens.map((token) => Number.parseInt(token, 16)) }
    }

    const label = buttonLabel(macro.label, context, alias).text
    const result = await radioHost.sendRadioRaw({
      id: macro.radio,
      selection: macro.radio,
      ...payload,
    })
    if (!result.accepted) {
      return { error: `${label}: CAT send refused (${result.reason ?? 'unknown reason'}).` }
    }
    return { confirm: `${label} sent to ${radio.name ?? 'the selected radio'}.` }
  }

  return {
    panel: {
      async getPanels() {
        // Global settings have no panel trigger. Visible panes pick up edits on the next tick.
        return [{ key: manifest.key, title, icon: manifest.icon, on: ['tick:2'] }]
      },
      async render(args, ctx) {
        const controls: PanelSceneControl[] = []
        const macros = await getMacros()
        const templateArgs = panelContext(args, ctx.appName)
        const triggers = new Set<string>()
        const radios = new Map<string, PanelRadioState | null>()
        for (const [alias, macro] of macros) {
          if (!macro) continue
          if (usesLiquid(macro.label)) {
            for (const trigger of triggersForTemplate(macro.label)) triggers.add(trigger)
            if (/\bradio\b/.test(macro.label)) {
              triggers.add('radio')
              if (!radios.has(macro.radio)) {
                const radio = await radioHost.readRadio(macro.radio)
                radios.set(macro.radio, radio?.id === macro.radio ? radio : null)
              }
            }
          }
          const label = buttonLabel(
            macro.label,
            macroContext(templateArgs, radios.get(macro.radio)),
            alias,
          )
          controls.push({
            id: `macro-${alias}`,
            label: label.invalid ? `${label.text} (label error)` : label.text,
            kind: 'nativeButton',
            variant: 'tonal',
            event: macro.event,
          })
        }
        if (controls.length === 0) {
          return {
            kind: 'markdown',
            content: `Add a complete macro with a unique alias in **${settingsPath}**.`,
          }
        }
        return {
          kind: 'scene',
          triggers: [...triggers],
          scene: {
            version: 1,
            width: 1,
            height: 1,
            values: {},
            layers: [],
            controls,
            layout: {
              wrap: controls.map(({ id }) => ({ control: id })),
              spacing: 8,
              runSpacing: 8,
              padding: 8,
            },
          },
        }
      },
      async onEvent(args, ctx) {
        const { event } = args
        const match = /^send:([A-Z0-9-]+):[0-9]+$/.exec(event.action)
        const alias = match?.[1]
        if (event.phase !== 'activate' || !alias || event.controlId !== `macro-${alias}`)
          return { values: {} }

        const macro = (await getMacros()).get(alias)
        const result =
          macro?.event === event.action
            ? await sendMacro(alias, macro, panelContext(args, ctx.appName))
            : { error: `CAT macro ${alias} changed. Wait for the pane to refresh.` }
        await radioHost.statusBar.setMessage({
          key: 'cat-macros',
          icon: manifest.icon,
          text: 'error' in result ? result.error : result.confirm,
        })
        return { values: {} }
      },
    },
    command: {
      async catalog() {
        return [
          {
            command: commandName,
            params: '<alias>',
            describe: 'Run a saved CAT macro',
            category: 'Radio',
            expectsParams: true,
          },
        ]
      },
      async interpret({ input, execute, operation, qso }, ctx) {
        const match = /^CATMACRO(?:\s+(.+))?$/i.exec(input.trim())
        if (!match) return null
        const alias = match[1]?.toUpperCase()
        if (!alias)
          return {
            expectsParams: true,
            describe: 'Enter the shortcut alias for a saved CAT macro.',
          }

        const macro = (await getMacros()).get(alias)
        if (macro === null) return { error: `CAT macro alias ${alias} is used more than once.` }
        if (!macro) return { error: `CAT macro ${alias} is unavailable. Check ${settingsPath}.` }
        if (!execute) return { describe: `Send CAT macro ${alias}.` }
        return sendMacro(alias, macro, { operation, qso, appName: ctx.appName })
      },
    },
  }
}

defineExtension({
  ...manifest,
  onActivation({ registerHook }) {
    const { panel, command } = createHooks(host)
    registerHook('panel', { hook: panel })
    registerHook('command', { hook: command })
    registerHook('settingsPanel', { hook: settings })
  },
})
