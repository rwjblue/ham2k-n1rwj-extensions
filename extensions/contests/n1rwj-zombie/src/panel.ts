import type { PanelHook, PanelRenderArgs } from '@ham2k/extension-sdk'
import { createZombieCelebrations } from './celebration.ts'
import {
  buildZombieExperience,
  refreshZombieExperience,
  type ZombieExperience,
} from './experience.ts'
import { EVENT_REF, object, type Qson, RULES_URL, refOf, text } from './model.ts'
import { zombiePanelPreview } from './panel-preview.ts'
import { rebirthLabel, zombieScene } from './scene.ts'
import { eventCountdownLabel } from './schedule.ts'

function markdown(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1')
    .replace(/[\r\n]/g, ' ')
}
function utc(at: number): string {
  return `${new Date(at).toISOString().slice(11, 16)} UTC`
}
export function zombieWatchMarkdown(model: ZombieExperience, now: number): string {
  const rows = model.rebirths.map(
    (row) =>
      `| ${markdown(row.zombieName)} · ${row.call} | ${row.band} | ${rebirthLabel(row)} · ${utc(row.nextAt)} |`,
  )
  const title = {
    unconfigured: 'Set the event-day UTC offset in Zombie setup.',
    upcoming: 'Waiting for the event to start.',
    active: 'The shuffle is on!',
    ended: 'The shuffle has ended.',
  }[model.sessionState]
  return [
    '## 🪦 Rebirth watch',
    title,
    eventCountdownLabel(model.session, now),
    rows.length
      ? ['| Zombie | Band | Eligible again |', '| :--- | :--- | :--- |', ...rows].join('\n')
      : 'No rebirths available. A qualifying contact starts a two-hour watch when there is time to return before the event ends.',
    'Timers use each callsign and actual band independently. 10m and 15m share scoring, with separate rebirths. **Eligible again does not mean currently on air.**',
    `[Official rules](${RULES_URL})`,
  ].join('\n\n')
}
export function zombieBookMarkdown(model: ZombieExperience): string {
  return [
    '## 📖 Book of the Undead',
    `${model.visitors.length} distinct callsigns · ${model.scoresheet.qsos} qualifying QSOs · ${model.scoresheet.bonusQsos} bonus QSOs`,
    ...(model.visitors.length
      ? model.visitors
          .slice(0, 60)
          .map((visitor) =>
            [
              `### ${markdown(visitor.zombieName)} · ${visitor.call}`,
              `**#${markdown(visitor.zombieNumber)}** · ${markdown(visitor.spc)}  \n${visitor.bands.join(', ')} · ${visitor.qsos} qualifying QSOs · last visit ${new Date(visitor.lastAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
            ].join('\n\n'),
          )
      : [
          'The pages are quiet. Log a complete, qualifying exchange to welcome your first visitor.',
        ]),
    ...(model.visitors.length > 60
      ? ['Showing the 60 most recent visitors. ADIF retains the full log.']
      : []),
    'Names, locations and numbers come from copied exchanges in qualifying contacts. History suggestions alone do not create a visitor.',
  ].join('\n\n')
}

export function createZombiePanel(): PanelHook {
  const celebrations = createZombieCelebrations()
  const snapshots = new Map<string, ZombieExperience>()
  const active = new Map<string, string>()
  const keyFor = (args: PanelRenderArgs) =>
    JSON.stringify([args.instanceId ?? args.panelKey, args.operation.uuid])
  function remember(key: string, model: ZombieExperience) {
    snapshots.delete(key)
    snapshots.set(key, model)
    while (snapshots.size > 12) {
      const first = snapshots.keys().next().value
      if (first !== undefined) snapshots.delete(first)
    }
  }
  const clockFor = (args: PanelRenderArgs) => ({
    key: keyFor(args),
    now: args.clock?.realNowMillis ?? Date.now(),
    reducedMotion: args.config.motion === false || args.environment?.reducedMotion === true,
  })
  return {
    async getPanels() {
      return [
        {
          key: 'graveyard',
          title: 'Zombie Shuffle',
          icon: 'ghost',
          preview: zombiePanelPreview,
          description: 'A friendly graveyard, per-band rebirth watch, and Book of the Undead.',
          on: ['operation', 'qsoLogged'],
          form: [
            {
              type: 'field',
              fieldType: 'select',
              key: 'view',
              label: 'View',
              value: 'scene',
              options: [
                { value: 'scene', label: 'Graveyard scene' },
                { value: 'watch', label: 'Detailed rebirth watch' },
                { value: 'book', label: 'Book of the Undead' },
              ],
            },
            {
              type: 'field',
              fieldType: 'checkbox',
              key: 'motion',
              label: 'Animate the graveyard and celebrations',
              value: true,
            },
          ],
        },
      ]
    },
    async render(args, ctx) {
      const { operation } = args
      if (!refOf(operation))
        return {
          kind: 'markdown',
          content:
            'Add **Zombie Shuffle 2026** to a dedicated operation to open your midnight radio club.',
          triggers: [],
        }
      if (text(refOf(operation)?.ref) !== EVENT_REF)
        return {
          kind: 'markdown',
          content:
            'This event edition has no confirmed rules. Select **Zombie Shuffle 2026** in the operation’s activities.',
          triggers: [],
        }
      if (typeof operation.uuid !== 'string' || !ctx.getQsos)
        return {
          kind: 'markdown',
          content:
            'The operation log is unavailable. Reopen this operation in a Ham2K version with extension log access.',
          triggers: [],
        }
      const key = keyFor(args)
      const clock = clockFor(args)
      const now = args.clock?.nowMillis ?? Date.now()
      const cached = snapshots.get(key)
      let model: ZombieExperience
      let frame = celebrations.frame(clock)
      if (args.reason === 'tick' && cached) {
        // Watch ticks and short celebrations reuse scored state. No log or
        // network reads occur on this path.
        model = refreshZombieExperience(cached, now)
      } else {
        let qsos: Qson[] | null
        try {
          qsos = await ctx.getQsos(operation.uuid)
        } catch {
          qsos = null
        }
        if (!qsos) {
          snapshots.delete(key)
          active.delete(args.instanceId ?? args.panelKey)
          return {
            kind: 'markdown',
            content:
              'The operation log could not be read. Reopen the operation to refresh Zombie progress.',
            triggers: [],
          }
        }
        // The panel context does not include the host's canonical segment
        // timeline. Never substitute current setup for historical overrides.
        if (
          qsos.some((qso) => {
            const event = object(qso.event)
            return (
              !qso.deleted &&
              qso.band === 'event' &&
              ['start', 'break'].includes(text(event.event)) &&
              event.operation &&
              typeof event.operation === 'object' &&
              !Array.isArray(event.operation)
            )
          })
        ) {
          snapshots.delete(key)
          active.delete(args.instanceId ?? args.panelKey)
          return {
            kind: 'markdown',
            content:
              'This operation has start/break setup overrides. Use native Zombie Info and scoring for this log, or a dedicated operation without segment overrides for the graveyard and rebirth watch.',
            triggers: [],
          }
        }
        model = buildZombieExperience(operation, qsos, now)
        const instance = args.instanceId ?? args.panelKey
        const switched = active.get(instance) !== operation.uuid
        active.set(instance, operation.uuid)
        while (active.size > 12) {
          const first = active.keys().next().value
          if (first !== undefined) active.delete(first)
        }
        frame = celebrations.update({
          ...clock,
          experience: model,
          recordIds: qsos.map((qso) => text(qso.uuid)).filter(Boolean),
          reason: switched ? 'visible' : args.reason,
        })
      }
      remember(key, model)
      const watchTicks = model.sessionState === 'active' || model.sessionState === 'upcoming'
      const forestView =
        args.config.view !== 'watch' &&
        args.config.view !== 'book' &&
        args.environment?.version === 1
      // Even a static reduced-motion message expires after four seconds.
      const triggers = frame.kind && forestView ? ['tick:1'] : watchTicks ? ['tick:60'] : []
      if (forestView)
        return {
          kind: 'svgScene',
          title: `Zombie Shuffle · ${model.scoresheet.qsos} QSOs`,
          scene: zombieScene({
            experience: model,
            frame,
            now,
            environment: args.environment,
            motion: args.config.motion !== false,
          }),
          triggers,
        }
      return {
        kind: 'markdown',
        title: 'Zombie Shuffle',
        content:
          args.config.view === 'book' ? zombieBookMarkdown(model) : zombieWatchMarkdown(model, now),
        triggers: args.config.view === 'book' ? [] : triggers,
      }
    },
    async onEvent(args) {
      if (
        args.event.action !== 'greet' ||
        args.config.view === 'book' ||
        args.config.view === 'watch' ||
        !snapshots.has(keyFor(args)) ||
        active.get(args.instanceId ?? args.panelKey) !== args.operation.uuid
      )
        throw new Error('Open the Zombie graveyard to say CQ BOO.')
      const frame = celebrations.greet(clockFor(args))
      return { values: { shuffle: frame.phase } }
    },
  }
}
