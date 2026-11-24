// SPDX-License-Identifier: MIT

import type { HookContext, RegisterHookParams } from '@ham2k/extension-sdk'

export interface OperationLocationCandidate {
  state: string
  county?: string
}

export interface OperationLocationResult {
  state?: string
  county?: string
  candidates?: OperationLocationCandidate[]
}

export interface OperationLocationHook {
  resolve(
    args: { latitude: number; longitude: number; accuracyMeters: number },
    ctx: HookContext,
  ): Promise<OperationLocationResult | null>
}

// The published API 31 SDK predates this hook. This extends the type of the
// existing registerHook callback until its declarations catch up.
export type RegisterOperationLocation = (
  category: 'operationLocation',
  params: Omit<RegisterHookParams, 'hook'> & { hook: OperationLocationHook },
) => void
