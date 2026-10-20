import { type CallFilterHook, maxFilterCalls } from '../../../../packages/spot-filters/src/index.ts'
import { targetForCall } from './targets.ts'

/** Fixed roster membership only; it does not establish event credit or activity. */
export const BigfootSpotFilter: CallFilterHook = {
  async describe() {
    return {
      version: 1,
      label: 'BIGFOOT 2026',
      available: true,
      defaultSelected: false,
    }
  },
  async matchCalls(args) {
    if (
      args?.version !== 1 ||
      !Array.isArray(args.calls) ||
      args.calls.length > maxFilterCalls ||
      args.calls.some((call) => typeof call !== 'string' || call.length > 64)
    ) {
      throw new Error('Unsupported spot call-filter request')
    }
    return {
      version: 1,
      available: true,
      calls: [...new Set(args.calls.map((call) => call.trim().toUpperCase()))].filter((call) =>
        Boolean(targetForCall(call)),
      ),
    }
  },
}
