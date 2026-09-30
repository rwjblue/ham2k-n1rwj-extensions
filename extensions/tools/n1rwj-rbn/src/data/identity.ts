// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

/** RBN may report a numeric receiver suffix as its bare station ID. */
export function receiverFamily(call: string): string {
  return call.replace(/-\d+$/, '')
}
