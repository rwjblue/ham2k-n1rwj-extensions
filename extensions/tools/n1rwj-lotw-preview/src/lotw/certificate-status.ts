// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { LotwHostPorts } from './host.ts'

export type LotwCertificateStatus = 'unrevoked' | 'revoked' | 'superseded' | 'unknown'

const maxResponseLength = 16_384
// HaLo allows 10 seconds for Account Test, including local P12 validation.
const timeout = 5_000
const statusReply =
  /^\s*<LoTW_CRL>\s*<Serial>\s*([0-9]{1,50})\s*<\/Serial>\s*<Status>\s*(Unrevoked|Revoked|Superceded|Superseded)\s*<\/Status>\s*<\/LoTW_CRL>\s*$/

/** Look up only the public certificate serial for Account Test. */
export async function checkLotwCertificateStatus(
  serial: string,
  fetch: LotwHostPorts['fetch'],
): Promise<LotwCertificateStatus> {
  if (!/^[1-9][0-9]{0,49}$/.test(serial)) return 'unknown'

  try {
    const { status, body } = await fetch(`https://lotw.arrl.org/lotw/crl?serial=${serial}`, {
      method: 'GET',
      redirect: 'error',
      // LoTW permits intermediaries to cache this response for two weeks.
      headers: { 'Cache-Control': 'no-cache' },
      timeout,
    })
    if (status !== 200 || typeof body !== 'string' || body.length > maxResponseLength) {
      return 'unknown'
    }
    const match = statusReply.exec(body)
    if (!match || match[1] !== serial) return 'unknown'
    if (match[2] === 'Unrevoked') return 'unrevoked'
    if (match[2] === 'Revoked') return 'revoked'
    return 'superseded'
  } catch {
    // The network can fail before a trustworthy status reaches the sandbox.
    // Do not expose errors containing the URL or certificate serial.
    return 'unknown'
  }
}
