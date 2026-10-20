import type {
  BoardSpot,
  PanelContent,
  PanelHook,
  PanelRenderArgs,
  PanelSceneEventResult,
} from '@ham2k/extension-sdk'
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
import {
  type BigfootRadioAvailability,
  readBigfootRadioAvailability,
  tuneBigfootSpot,
} from './spot-radio.ts'
import type { HuntSpotView } from './spot-view.ts'
import { buildSpotRows } from './spots.ts'

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

function appNow(args: PanelRenderArgs): number {
  const now = args.clock?.nowMillis
  return typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
}

function spotConfig(args: PanelRenderArgs) {
  return {
    filter: args.config.board === 'all' ? ('all' as const) : ('user' as const),
    maxAgeMinutes:
      args.config.windowMinutes === 5 || args.config.windowMinutes === 30
        ? args.config.windowMinutes
        : 15,
    annotate: false as const,
  }
}

type Snapshot = {
  generation: number
  contacts?: Contact[]
  qsoCount?: number
  board?: BoardSpot[]
  boardAt?: number
  boardConfig?: string
  spotStatus: HuntSpotView['status']
  selectedCall?: string
  selectedKey?: string
  tuneStatus?: string
  tunedTo?: string
  tuning?: boolean
  radio?: BigfootRadioAvailability
  radioAt?: number
}

function spotView(state: Snapshot, args: PanelRenderArgs): HuntSpotView {
  const event = eventFromOperation(args.operation)
  const now = appNow(args)
  if (!event || now < event.startAtMillis || now >= event.endAtMillis)
    return { status: 'empty', rows: [] }
  const rows = buildSpotRows({
    spots: state.board ?? [],
    contacts: state.contacts ?? [],
    event,
    focus: focusFor(args.config),
    now,
    maxAgeMinutes: spotConfig(args).maxAgeMinutes,
    onePerCall: true,
  })
  const selected =
    rows.find((row) => row.call === state.selectedCall) ?? rows.find((row) => row.needed) ?? rows[0]
  if (selected?.call !== state.selectedCall) {
    state.selectedCall = selected?.call
    state.tuneStatus = undefined
  }
  state.selectedKey = selected
    ? `${selected.call}|${selected.frequency}|${selected.mode}`
    : undefined
  return {
    status: state.spotStatus === 'ready' && !rows.length ? 'empty' : state.spotStatus,
    rows,
    selected,
    radio: state.radio,
    tuneStatus:
      selected && state.tunedTo === `${selected.call}|${selected.frequency}|${selected.mode}`
        ? state.tuneStatus
        : undefined,
  }
}

function spotsMarkdown(view: HuntSpotView): string {
  if (view.status === 'unsupported') return 'Update Ham2K to see cached spots in the forest.'
  if (view.status === 'unavailable')
    return 'Spots are temporarily unavailable; the panel will retry.'
  if (!view.rows.length)
    return 'No recent matching BIGFOOT spots. Check your spot sources and filters.'
  return [
    '### Spotted stations',
    ...view.rows.map(
      (row) =>
        `**${row.call}** · ${row.frequency.toFixed(1)} kHz · ${row.band} ${row.mode}${row.needed ? ' · Needed' : ''}`,
    ),
    'Enter the callsign in the logger manually. Use the forest scene to tune a connected radio.',
  ].join('\n\n')
}

export function createBigfootPanel(
  tuneSpot = tuneBigfootSpot,
  readRadioAvailability = readBigfootRadioAvailability,
): PanelHook {
  const celebrations = createCelebrations()
  const snapshots = new Map<string, Snapshot>()
  const placements = new Map<string, string>()
  const snapshotKey = (args: PanelRenderArgs) =>
    JSON.stringify([args.instanceId ?? args.panelKey, args.operation?.uuid])
  function remember(key: string, value: Snapshot) {
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
          on: ['operation', 'qsoLogged', 'spots'],
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
            {
              type: 'field',
              fieldType: 'select',
              key: 'board',
              label: 'Spots to read',
              value: 'user',
              options: [
                { value: 'user', label: 'Follow Spots filters' },
                { value: 'all', label: 'All cached spots' },
              ],
            },
            {
              type: 'field',
              fieldType: 'select',
              key: 'windowMinutes',
              label: 'Last heard within',
              value: 15,
              options: [5, 15, 30].map((value) => ({ value, label: `${value} minutes` })),
            },
          ],
        },
      ]
    },
    async render(args, ctx): Promise<PanelContent> {
      const placement = args.instanceId ?? args.panelKey
      placements.delete(placement)
      placements.set(placement, snapshotKey(args))
      while (placements.size > 12) {
        const first = placements.keys().next().value
        if (first !== undefined) placements.delete(first)
      }
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
      const state = snapshots.get(key) ?? { generation: 0, spotStatus: 'unsupported' as const }
      remember(key, state)
      const generation = ++state.generation
      let contacts: Contact[]
      let frame: CelebrationFrame | undefined
      const clock = clockFor(args)
      if (
        (args.reason === 'tick' || args.reason === 'spots') &&
        state.contacts &&
        state.qsoCount === args.qsoCount
      ) {
        // A bounded celebration advances from an already-read log snapshot.
        // No per-frame or per-keystroke log/host calls are needed.
        contacts = state.contacts
        frame = celebrations.frame(clock)
      } else {
        state.contacts = undefined
        state.qsoCount = undefined
        // Read on log/operation changes, including same-count edits/deletions.
        let qsos: Qson[] | null
        try {
          qsos = await ctx.getQsos(operation.uuid)
        } catch {
          qsos = null
        }
        if (generation !== state.generation) return { kind: 'markdown', content: '' }
        if (!qsos)
          return {
            kind: 'markdown',
            triggers: [],
            content:
              'The operation log is unavailable. Reopen the operation to refresh BIGFOOT progress.',
          }
        contacts = qualifyingContacts(qsos, event)
        state.contacts = contacts
        state.qsoCount = args.qsoCount
        if (forestView) {
          frame = celebrations.update({
            ...clock,
            focus,
            contacts,
            reason: args.reason,
            recordIds: qsos.flatMap((qso) => (typeof qso.uuid === 'string' ? [qso.uuid] : [])),
          })
        }
      }
      const now = appNow(args)
      const options = spotConfig(args)
      const configKey = JSON.stringify(options)
      const inEvent = now >= event.startAtMillis && now < event.endAtMillis
      if (
        inEvent &&
        typeof ctx.getSpots === 'function' &&
        (args.reason !== 'tick' ||
          state.boardAt === undefined ||
          now < state.boardAt ||
          now - state.boardAt >= 60_000 ||
          state.boardConfig !== configKey)
      ) {
        try {
          const board = await ctx.getSpots(options)
          if (!Array.isArray(board)) throw new Error('Invalid spots response')
          if (generation !== state.generation) return { kind: 'markdown', content: '' }
          state.board = board
          state.spotStatus = 'ready'
        } catch (error) {
          if (generation !== state.generation) return { kind: 'markdown', content: '' }
          state.board = undefined
          state.spotStatus =
            /getSpots.*(?:not implemented|unsupported|unknown)|(?:unsupported|unknown).*getSpots/i.test(
              String(error),
            )
              ? 'unsupported'
              : 'unavailable'
        }
        state.boardAt = now
        state.boardConfig = configKey
      } else if (typeof ctx.getSpots !== 'function') {
        state.board = undefined
        state.spotStatus = 'unsupported'
      }
      const spots = spotView(state, args)
      const watchRadio = forestView && spots.rows.length > 0
      if (
        watchRadio &&
        (state.radioAt === undefined ||
          clock.now < state.radioAt ||
          clock.now - state.radioAt >= 5_000)
      ) {
        let radio: BigfootRadioAvailability
        try {
          radio = await readRadioAvailability()
        } catch {
          radio = { status: 'manual', message: 'Radio access is unavailable.' }
        }
        if (generation !== state.generation) return { kind: 'markdown', content: '' }
        state.radio = radio
        state.radioAt = clock.now
      }
      spots.radio = state.radio
      const triggers: PanelContent['triggers'] = frame?.nextTick
        ? ['tick:1']
        : watchRadio
          ? ['tick:5']
          : inEvent && spots.status !== 'unsupported'
            ? ['tick:60']
            : []
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
            spots,
          }),
          triggers,
        }
      return {
        kind: 'markdown',
        title: `BIGFOOT Hunt ${event.year}`,
        content: `${progressMarkdown(contacts, focus)}${inEvent ? `\n\n${spotsMarkdown(spots)}` : ''}`,
        triggers,
      }
    },
    async onEvent(args): Promise<PanelSceneEventResult> {
      const key = snapshotKey(args)
      const state = snapshots.get(key)
      if (
        !state?.contacts ||
        placements.get(args.instanceId ?? args.panelKey) !== key ||
        args.config.view === 'checklist' ||
        args.environment?.version !== 1
      )
        throw new Error('Open the BIGFOOT forest scene to use its controls.')
      const action = args.event.action
      if (action === 'wave') {
        const frame = celebrations.greet(clockFor(args))
        return { values: { hop: frame.phase, wave: frame.phase } }
      }
      const displayedKey = state.selectedKey
      const view = spotView(state, args)
      if (action === 'next-spot') {
        const index = view.rows.findIndex((row) => row.call === state.selectedCall)
        state.selectedCall = view.rows[(index + 1) % view.rows.length]?.call
        state.tuneStatus = undefined
        return { values: {} }
      }
      const row =
        action === 'tune-spot'
          ? view.selected
          : action.startsWith('spot:')
            ? view.rows.find((row) => row.call === action.slice(5))
            : action.startsWith('select-spot:')
              ? view.rows.find((row) => row.call === action.slice(12))
              : undefined
      if (
        !row ||
        view.status !== 'ready' ||
        (action === 'tune-spot' && state.selectedKey !== displayedKey)
      ) {
        state.tuneStatus = 'This report has expired. Wait for a fresh spot.'
        return { values: {} }
      }
      if (state.tuning) return { values: {} }
      state.selectedCall = row.call
      state.selectedKey = `${row.call}|${row.frequency}|${row.mode}`
      if (action.startsWith('select-spot:') || state.radio?.status !== 'ready') {
        state.tuneStatus = undefined
        return { values: {} }
      }
      state.tuneStatus = undefined
      state.tunedTo = state.selectedKey
      state.tuning = true
      const targetKey = state.selectedKey
      const stillSelected = () =>
        state.selectedKey === targetKey && placements.get(args.instanceId ?? args.panelKey) === key
      try {
        const result = await tuneSpot(row)
        if (stillSelected()) state.tuneStatus = result.message
      } catch {
        if (stillSelected()) state.tuneStatus = 'Radio unavailable. Tune manually.'
      } finally {
        state.tuning = false
        if (stillSelected()) state.radioAt = undefined
      }
      return { values: {} }
    },
  }
}

export const BigfootPanel = createBigfootPanel()
