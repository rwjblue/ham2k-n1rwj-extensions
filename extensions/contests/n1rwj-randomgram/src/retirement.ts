import type { JSONValue } from '@ham2k/extension-sdk'
import { host } from '@ham2k/extension-sdk'
import { object, position, type Qson, refOf, text } from './model.ts'

const EXTENSION_KEY = 'n1rwj-randomgram'
export interface RetirementStore {
  through(operation: Qson): Promise<number>
  isRetired(operation: Qson, item: number): Promise<boolean>
  retire(operation: Qson, item: number): Promise<void>
}

interface RetirementState {
  through: Qson
  items: Qson
}

function retiredItems(state: RetirementState, key: string): number[] {
  const stored = state.items[key]
  if (Array.isArray(stored)) {
    return stored.map(position).filter((item): item is number => item !== undefined)
  }
  // A prototype checkpoint without an exact-item ledger proves only its
  // highest item was retired, never that earlier list positions were used.
  const highest = position(state.through[key])
  return highest === undefined ? [] : [highest]
}

// The host KV is volatile. Settings persist deliberate skipped positions on
// this device; the accompanying log note records the literal group as well.
export function createRetirementStore(
  read: () => Promise<Qson> = host.getSettings,
  write: (values: Record<string, JSONValue>) => Promise<void> = host.setSettings,
): RetirementStore {
  let loaded: Promise<RetirementState> | undefined
  let pending = Promise.resolve()
  const state = () =>
    (loaded ??= read()
      .then((settings) => {
        const own = object(object(settings.extensions)[`extension_${EXTENSION_KEY}`])
        return {
          through: { ...object(own.retiredThrough) },
          items: { ...object(own.retiredItems) },
        }
      })
      .catch((error: unknown) => {
        loaded = undefined
        throw error
      }))
  const key = (operation: Qson) => `${text(operation.uuid)}|${text(refOf(operation)?.ref)}`
  return {
    async through(operation) {
      if (!text(operation.uuid)) return 0
      return position((await state()).through[key(operation)]) ?? 0
    },
    async isRetired(operation, item) {
      if (!text(operation.uuid)) return false
      return retiredItems(await state(), key(operation)).includes(item)
    },
    async retire(operation, item) {
      if (!text(operation.uuid)) throw new Error('Open a saved RandomGram operation first.')
      if (position(item) === undefined)
        throw new Error('The TX item must be a positive whole number.')
      const next = pending.then(async () => {
        const current = await state()
        const operationKey = key(operation)
        const retiredThrough = {
          ...current.through,
          [operationKey]: Math.max(position(current.through[operationKey]) ?? 0, item),
        }
        const exactItems = {
          ...current.items,
          [operationKey]: [...new Set([...retiredItems(current, operationKey), item])].sort(
            (a, b) => a - b,
          ),
        }
        await write({ retiredThrough, retiredItems: exactItems })
        loaded = Promise.resolve({ through: retiredThrough, items: exactItems })
      })
      pending = next.catch(() => {})
      await next
    },
  }
}
