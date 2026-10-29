import type { HookContext, JSONValue } from '@ham2k/extension-sdk'
import { object, type Qson, refOf, text } from '../../../../packages/mini-contest/src/model.ts'
import { initialQsyState, isQsyState, type OperatingMode, type QsyState, replayQsy } from './qsy.ts'

type Entry = {
  identity?: string
  session: string
  revision: number
  state?: QsyState
  readAttempted: boolean
  loading?: Promise<QsyState>
}
function identity(operation: Qson): string | undefined {
  return typeof operation.createdAtMillis === 'number' && operation.stationCall
    ? JSON.stringify([operation.createdAtMillis, operation.stationCall])
    : undefined
}
function stateFrom(value: JSONValue | undefined): QsyState | undefined {
  const state = object(value).qsy
  return isQsyState(state) ? state : undefined
}
const copy = (state: QsyState): QsyState => ({
  ...state,
  pending: [...state.pending],
  recent: [...state.recent],
})
function currentState(entry: Entry): QsyState {
  entry.state ??= initialQsyState(false)
  return entry.state
}

/** Scoring supplies checkpointed QSY state. A cold guide reads the operation
 * once, sharing that promise across controls/panels rather than per keystroke. */
export function createGuideStore() {
  const entries = new Map<string, Entry>()
  function entryFor(operation: Qson): { entry: Entry; uuid: string } {
    const uuid = text(operation.uuid)
    const stamp = identity(operation)
    const session = text(refOf(operation, 'ns')?.ref)
    const matches = stamp
      ? [...entries.entries()].filter(
          ([key, entry]) =>
            !key.startsWith('unscored:') && entry.identity === stamp && entry.session === session,
        )
      : []
    if (!uuid && (!stamp || matches.length > 1))
      return { entry: { session, revision: 0, readAttempted: false }, uuid: '' }
    const key =
      uuid ||
      (matches.length === 1 ? matches[0]?.[0] : undefined) ||
      `unscored:${stamp ?? ''}:${session}`
    let entry = entries.get(key)
    if (
      !entry ||
      entry.session !== session ||
      (stamp && entry.identity && stamp !== entry.identity)
    ) {
      if (entries.size >= 8) entries.delete(entries.keys().next().value ?? '')
      entry = { identity: stamp, session, revision: 0, readAttempted: false }
      entries.set(key, entry)
    }
    return { entry, uuid: uuid || (key.startsWith('unscored:') ? '' : key) }
  }
  return {
    rememberMode(operation: Qson, mode: OperatingMode) {
      const { entry } = entryFor(operation)
      if (entry.state) entry.state.mode = mode
    },
    accept(operation: Qson, scoresheet: JSONValue | undefined) {
      if (scoresheet === undefined) return
      const { entry } = entryFor(operation)
      entry.revision++
      entry.state = copy(stateFrom(scoresheet) ?? initialQsyState(false))
      entry.readAttempted = false
    },
    async current(operation: Qson, ctx: HookContext): Promise<QsyState> {
      const { entry, uuid } = entryFor(operation)
      if (entry.state?.complete) return entry.state
      if (entry.loading) return entry.loading
      if (!uuid || !ctx.getQsos || entry.readAttempted) return currentState(entry)
      entry.readAttempted = true
      const revision = entry.revision
      entry.loading = ctx
        .getQsos(uuid)
        .then((rows) => {
          if (entry.revision === revision && rows) entry.state = replayQsy(rows, operation)
          return currentState(entry)
        })
        .catch(() => currentState(entry))
        .finally(() => {
          entry.loading = undefined
        })
      return entry.loading
    },
  }
}
