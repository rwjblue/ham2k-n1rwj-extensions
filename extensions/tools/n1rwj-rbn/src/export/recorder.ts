import type { PanelRenderArgs } from '@ham2k/extension-sdk'
import { operationOrigin, readConfig, watchedCall } from '../config.ts'
import type { RbnCollectionResult, RbnQuery } from '../data/client.ts'
import { isValidCall } from '../model.ts'
import type { EvidenceRequest } from './evidence.ts'

/** Recording has exactly the same visible-panel scope as polling. */
export function createReceptionRecorder(
  append: (request: EvidenceRequest, event: RbnCollectionResult) => Promise<unknown>,
  onError: (error: unknown) => void = () => {},
) {
  const placements = new Map<
    string,
    { request: EvidenceRequest; query: RbnQuery; expiresMs: number }
  >()
  return {
    observe(args: PanelRenderArgs, time: number) {
      if (!args.instanceId) return
      placements.delete(args.instanceId)
      if (!args.operation?.uuid || args.config?.recordReception === false) return
      const config = readConfig(args.config)
      const call = watchedCall(args.operation, config.watchCall)
      if (!isValidCall(call)) return
      const origin = operationOrigin(args.operation, config.gridOverride)
      placements.set(args.instanceId, {
        query: { call, windowMinutes: config.windowMinutes },
        expiresMs: time + 75_000,
        request: {
          operationId: String(args.operation.uuid),
          call,
          startMs: Math.max(0, time - config.windowMinutes * 60_000),
          endMs: time,
          ...(origin ? { origin } : {}),
        },
      })
      while (placements.size > 8) {
        const oldest = placements.keys().next().value
        if (oldest !== undefined) placements.delete(oldest)
      }
    },
    prepare(query: RbnQuery, startedAtMs: number) {
      const frozen = new Map<string, EvidenceRequest>()
      for (const [id, placement] of placements) {
        if (placement.expiresMs <= startedAtMs) {
          placements.delete(id)
          continue
        }
        if (
          placement.query.call !== query.call ||
          placement.query.windowMinutes !== query.windowMinutes
        )
          continue
        const request = {
          ...placement.request,
          startMs: Math.max(0, startedAtMs - query.windowMinutes * 60_000),
          endMs: startedAtMs,
        }
        frozen.set(request.operationId, request)
      }
      if (!frozen.size) return undefined
      return (event: RbnCollectionResult) => {
        for (const request of frozen.values()) void append(request, event).catch(onError)
      }
    },
    pause() {
      placements.clear()
    },
  }
}
