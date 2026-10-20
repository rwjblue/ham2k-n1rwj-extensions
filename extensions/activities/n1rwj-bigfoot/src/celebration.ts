import type { Contact, Progress, ProgressMode } from './rules.ts'
import { buildProgress } from './rules.ts'

export type CelebrationKind = 'letter' | 'bonus' | 'complete' | 'greeting'

export type CelebrationFrame = {
  kind: CelebrationKind | null
  label: string
  letters: string[]
  mode: ProgressMode | null
  // Native scenes tween toward this target: 1 is up, 0 is on the ground.
  phase: 0 | 1
  hopping: boolean
  nextTick: boolean
}

export type CelebrationClock = {
  instanceId: string
  operationId: string
  now: number
  reducedMotion: boolean
}

export type CelebrationUpdate = CelebrationClock & {
  focus: ProgressMode
  contacts: readonly Contact[]
  recordIds: readonly string[]
  reason: string
}

type Celebration = {
  kind: CelebrationKind
  label: string
  letters: string[]
  mode: ProgressMode | null
  startedAt: number
  motion: boolean
}

type HuntState = {
  instanceId: string
  operationId: string
  focus: ProgressMode
  recordIds: Set<string>
  earned: Set<string>
  current: Set<string>
  celebration?: Celebration
}

const MODES: readonly ProgressMode[] = ['CW', 'MIXED', 'PHONE', 'DIGITAL']
const LABELS: Record<ProgressMode, string> = {
  CW: 'CW',
  MIXED: 'Mixed',
  PHONE: 'Phone',
  DIGITAL: 'Digital',
}
const LOG_REASONS = new Set(['operation', 'qsoLogged', 'coalesced'])
const RESET_REASONS = new Set(['initial', 'visible', 'config', 'runtime'])
const DURATION = 4000
const MAX_HUNTS = 12

function quiet(): CelebrationFrame {
  return {
    kind: null,
    label: '',
    letters: [],
    mode: null,
    phase: 0,
    hopping: false,
    nextTick: false,
  }
}

function huntKey(clock: Pick<CelebrationClock, 'instanceId' | 'operationId'>): string {
  return JSON.stringify([clock.instanceId, clock.operationId])
}

function slotKey(mode: ProgressMode, index: number): string {
  return `${mode}:slot:${index}`
}

function earnedCredits(progress: Record<ProgressMode, Progress>): Set<string> {
  const earned = new Set<string>()
  for (const mode of MODES) {
    for (const [index, slot] of progress[mode].slots.entries()) {
      if (slot.contact) earned.add(slotKey(mode, index))
    }
    if (progress[mode].bonus) earned.add(`${mode}:bonus`)
    if (progress[mode].complete) earned.add(`${mode}:complete`)
  }
  return earned
}

function opportunity(
  mode: ProgressMode,
  progress: Record<ProgressMode, Progress>,
  withoutNewRecords: Record<ProgressMode, Progress>,
  earned: Set<string>,
): Pick<Celebration, 'kind' | 'label' | 'letters' | 'mode'> | undefined {
  const selected = progress[mode]
  const before = withoutNewRecords[mode]
  const letters = selected.slots.flatMap((slot, index) => {
    if (!slot.contact || before.slots[index]?.contact || earned.has(slotKey(mode, index))) return []
    return [slot.call === 'W7O' ? (index === 4 ? 'O₁' : 'O₂') : slot.letter]
  })
  const bonus = !!selected.bonus && !before.bonus && !earned.has(`${mode}:bonus`)
  const complete = selected.complete && !before.complete && !earned.has(`${mode}:complete`)
  const title = LABELS[mode]
  if (complete) return { kind: 'complete', label: `${title} BIGFOOT complete!`, letters, mode }
  if (letters.length) {
    return { kind: 'letter', label: `${title} ${letters.join(' + ')} found!`, letters, mode }
  }
  if (bonus) return { kind: 'bonus', label: `${title} Skunk Ape bonus found!`, letters: [], mode }
  return undefined
}

/**
 * In-memory visual feedback only. The log and rules remain the source of
 * progress; this remembers previously seen credits so reopening or restoring a
 * contact does not replay an award. Each call is deterministic in its inputs.
 */
export function createCelebrations() {
  const hunts = new Map<string, HuntState>()
  const activeOperations = new Map<string, string>()

  function remember(key: string, state: HuntState) {
    hunts.delete(key)
    hunts.set(key, state)
    while (hunts.size > MAX_HUNTS) {
      const oldest = hunts.keys().next().value
      if (oldest !== undefined) hunts.delete(oldest)
    }
    for (const instance of activeOperations.keys()) {
      if (![...hunts.values()].some((hunt) => hunt.instanceId === instance))
        activeOperations.delete(instance)
    }
  }

  function frame(clock: CelebrationClock): CelebrationFrame {
    if (activeOperations.get(clock.instanceId) !== clock.operationId) return quiet()
    const key = huntKey(clock)
    const state = hunts.get(key)
    if (!state?.celebration) return quiet()
    remember(key, state)
    const event = state.celebration
    const elapsed = clock.now - event.startedAt
    // A clock reset or a delayed hidden-panel tick must not restart a dance.
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= DURATION) {
      state.celebration = undefined
      return quiet()
    }
    if (clock.reducedMotion) event.motion = false
    const hopping = event.motion
    const step = Math.floor(elapsed / 1000)
    return {
      kind: event.kind,
      label: event.label,
      letters: [...event.letters],
      mode: event.mode,
      phase: hopping && step % 2 === 0 ? 1 : 0,
      hopping,
      nextTick: hopping,
    }
  }

  function update(input: CelebrationUpdate): CelebrationFrame {
    const key = huntKey(input)
    const progress = buildProgress(input.contacts)
    const credits = earnedCredits(progress)
    const previous = hunts.get(key)
    const switched = activeOperations.get(input.instanceId) !== input.operationId
    activeOperations.set(input.instanceId, input.operationId)
    if (!previous) {
      remember(key, {
        instanceId: input.instanceId,
        operationId: input.operationId,
        focus: input.focus,
        recordIds: new Set(input.recordIds),
        earned: credits,
        current: credits,
      })
      return quiet()
    }

    const focusChanged = previous.focus !== input.focus
    const silent = switched || focusChanged || !LOG_REASONS.has(input.reason)
    const newIds = new Set(input.recordIds.filter((uuid) => !previous.recordIds.has(uuid)))
    const creditRemoved = [...previous.current].some((credit) => !credits.has(credit))
    if (switched || focusChanged || RESET_REASONS.has(input.reason) || creditRemoved) {
      previous.celebration = undefined
    }
    if (!silent && newIds.size) {
      // Removing NEW records proves they enabled the credit. Merely editing
      // an old contact alongside a new unrelated QSO cannot trigger a dance.
      // This also handles a backdated new O becoming the first chronological
      // O while the old contact supplies the now-earned second slot.
      const withoutNewRecords = buildProgress(
        input.contacts.filter((contact) => !newIds.has(contact.uuid)),
      )
      const earned =
        opportunity(input.focus, progress, withoutNewRecords, previous.earned) ??
        (input.focus === 'MIXED'
          ? undefined
          : opportunity('MIXED', progress, withoutNewRecords, previous.earned))
      if (earned) {
        previous.celebration = {
          ...earned,
          startedAt: input.now,
          motion: !input.reducedMotion,
        }
      }
    }

    previous.focus = input.focus
    previous.current = credits
    for (const uuid of input.recordIds) previous.recordIds.add(uuid)
    // Keep every mode's history, even when another mode has visual focus.
    for (const credit of credits) previous.earned.add(credit)
    remember(key, previous)
    return frame(input)
  }

  function greet(clock: CelebrationClock): CelebrationFrame {
    const key = huntKey(clock)
    const state = hunts.get(key)
    if (!state || activeOperations.get(clock.instanceId) !== clock.operationId) return quiet()
    state.celebration = {
      kind: 'greeting',
      label: 'Bigfoot says hello!',
      letters: [],
      mode: null,
      startedAt: clock.now,
      motion: !clock.reducedMotion,
    }
    remember(key, state)
    return frame(clock)
  }

  return { update, frame, greet }
}
