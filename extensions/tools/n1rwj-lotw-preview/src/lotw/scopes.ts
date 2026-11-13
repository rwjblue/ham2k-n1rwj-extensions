// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { isTestOperation } from '@ham2k/extension-sdk'

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function realCall(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/.test(value) &&
    !isTestOperation(value)
  )
}

/** A null selection refuses the scope; an absent call covers every call. */
export function lotwScopeSelection(scope: unknown): { stationCall?: string } | null {
  if (!object(scope)) return null
  if (scope.kind === 'operation') {
    if (!object(scope.operation) || typeof scope.operation.stationCall !== 'string') return null
    const calls = scope.operation.stationCall
      .split(',')
      .map((call) => call.trim().toUpperCase())
      .filter(Boolean)
    if (calls.length === 0 || !calls.every(realCall)) return null
    // HaLo stores multiple station calls in this comma-separated field.
    // Destinations follow the stationCalls supplied with the resolved contacts.
    return {}
  }
  if (scope.kind === 'chasing') {
    return realCall(scope.stationCall) ? { stationCall: scope.stationCall } : null
  }
  if (scope.kind === 'log') {
    if (scope.stationCall === undefined) return {}
    return realCall(scope.stationCall) ? { stationCall: scope.stationCall } : null
  }
  return null
}
