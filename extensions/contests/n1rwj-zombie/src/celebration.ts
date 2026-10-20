import type { ZombieExperience } from './experience.ts'

export type ZombieCelebrationFrame = {
  kind: 'contact' | 'rebirth' | 'bonus' | 'greeting' | null
  label: string
  phase: 0 | 1
  nextTick: boolean
}

type Clock = { key: string; now: number; reducedMotion: boolean }
type State = {
  records: Set<string>
  eligible: Set<string>
  event?: { kind: ZombieCelebrationFrame['kind']; label: string; at: number; motion: boolean }
}

const quiet = (): ZombieCelebrationFrame => ({ kind: null, label: '', phase: 0, nextTick: false })

/** Visual feedback is ephemeral; the scorer remains the source of credit. */
export function createZombieCelebrations() {
  const states = new Map<string, State>()
  function remember(key: string, state: State) {
    states.delete(key)
    states.set(key, state)
    while (states.size > 12) {
      const oldest = states.keys().next().value
      if (oldest !== undefined) states.delete(oldest)
    }
  }
  function frame(clock: Clock): ZombieCelebrationFrame {
    const state = states.get(clock.key)
    const event = state?.event
    if (!event) return quiet()
    const elapsed = clock.now - event.at
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 4000) {
      state.event = undefined
      return quiet()
    }
    if (clock.reducedMotion) event.motion = false
    return {
      kind: event.kind,
      label: event.label,
      phase: event.motion && Math.floor(elapsed / 1000) % 2 === 0 ? 1 : 0,
      nextTick: event.motion,
    }
  }
  function update(
    input: Clock & { experience: ZombieExperience; recordIds: string[]; reason: string },
  ) {
    const ids = new Set(input.experience.eligibleContacts.map((contact) => contact.uuid))
    const records = new Set(input.recordIds)
    const previous = states.get(input.key)
    if (!previous) {
      remember(input.key, { records, eligible: ids })
      return quiet()
    }
    const logChange = ['operation', 'qsoLogged', 'coalesced'].includes(input.reason)
    if (
      (!logChange && input.reason !== 'event') ||
      [...previous.eligible].some((id) => !ids.has(id))
    )
      previous.event = undefined
    if (logChange) {
      const added = input.experience.eligibleContacts
        .filter((contact) => records.has(contact.uuid) && !previous.records.has(contact.uuid))
        .sort((a, b) => b.time - a.time)
      const contact = added.find((item) => item.bonus) ?? added[0]
      if (contact) {
        const kind = contact.bonus ? 'bonus' : contact.rebirth ? 'rebirth' : 'contact'
        previous.event = {
          kind,
          label: contact.bonus
            ? 'A bonus soul on the air!'
            : contact.rebirth
              ? 'BACK FROM THE DEAD!'
              : 'Another soul on the air!',
          at: input.now,
          motion: !input.reducedMotion,
        }
      }
    }
    for (const uuid of input.recordIds) previous.records.add(uuid)
    previous.eligible = ids
    remember(input.key, previous)
    return frame(input)
  }
  function greet(clock: Clock): ZombieCelebrationFrame {
    const state = states.get(clock.key)
    if (!state) return quiet()
    state.event = {
      kind: 'greeting',
      label: 'CQ BOO! Your zombie waves hello.',
      at: clock.now,
      motion: !clock.reducedMotion,
    }
    return frame(clock)
  }
  return { update, frame, greet }
}
