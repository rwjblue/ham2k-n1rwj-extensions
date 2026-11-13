// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import {
  type AccountHook,
  base64ToBytes as decodeBase64,
  type HookContext,
} from '@ham2k/extension-sdk'
import type { LotwCertificateStatus } from './certificate-status.ts'
import type { LotwSigningPort } from './signing.ts'

export const maxLotwCertificateBytes = 64 * 1024

export interface LotwAccountPorts {
  base64ToBytes?: typeof decodeBase64
  // Parse/decrypt the P12 and validate the certificate and its matching key.
  // Only the provider owns that key; callers receive its signing capability.
  loadCertificate(p12: Uint8Array, password: string, ctx: HookContext): Promise<LotwSigningPort>
  checkCertificateStatus?(serial: string, ctx: HookContext): Promise<LotwCertificateStatus>
}

export interface LotwAccountCredentials {
  p12: Uint8Array
  password: string
}

const invalid = 'Could not open the LoTW certificate. Check the file and its password.'
const maxEncodedLength = 4 * Math.ceil(maxLotwCertificateBytes / 3)
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const accountProblems = {
  missing: 'Choose a LoTW certificate file (.p12) in the LoTW account settings first.',
  validity: 'The LoTW certificate is outside its validity dates. Check your clock and certificate.',
  revoked: 'LoTW reports this certificate was revoked. Choose a current .p12 file.',
  superseded: 'LoTW reports this certificate was replaced. Choose the latest .p12 file.',
}

/** Only fixed, operator-facing messages may pass through the credential error boundary. */
export class LotwAccountProblem extends Error {
  constructor(problem: keyof typeof accountProblems) {
    super(accountProblems[problem])
  }
}

function decodedLength(encoded: string): number {
  if (
    encoded.length === 0 ||
    encoded.length > maxEncodedLength ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    throw new Error(invalid)
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const length = (encoded.length / 4) * 3 - padding
  // Check unused bits as well as shape: there is one canonical encoding for
  // these bytes. The actual decoder remains the SDK's, never a local codec.
  const trailing = alphabet.indexOf(encoded[encoded.length - padding - 1])
  if (
    length < 1 ||
    length > maxLotwCertificateBytes ||
    (padding === 2 && (trailing & 15) !== 0) ||
    (padding === 1 && (trailing & 3) !== 0)
  ) {
    throw new Error(invalid)
  }
  return length
}

/** Read only the host's secure account credentials, never settings or filenames. */
export function readLotwAccountCredentials(
  credentials: Record<string, string> | undefined,
  base64ToBytes = decodeBase64,
): LotwAccountCredentials {
  try {
    const encoded = credentials?.certificate
    const password = credentials?.certificatePassword ?? ''
    if (typeof encoded !== 'string' || typeof password !== 'string') throw new Error(invalid)
    const expectedLength = decodedLength(encoded)
    const p12 = base64ToBytes(encoded)
    if (!(p12 instanceof Uint8Array) || p12.length !== expectedLength) throw new Error(invalid)
    return { p12, password }
  } catch {
    // Decoder errors may contain the credential value. Never surface them.
    throw new Error(invalid)
  }
}

function certificateIdentity(signing: LotwSigningPort): string {
  const call = signing.certificate.callsign
  if (
    typeof call !== 'string' ||
    !/^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/.test(call) ||
    !/[A-Z]/.test(call) ||
    !/\d/.test(call) ||
    call.length < 3 ||
    call.length > 20 ||
    typeof signing.signSha1 !== 'function' ||
    typeof signing.gzip !== 'function'
  ) {
    throw new Error(invalid)
  }
  return call
}

/** Open a fresh signing capability from the current secure account value. */
export async function loadLotwAccount(
  credentials: Record<string, string> | undefined,
  ctx: HookContext,
  ports: LotwAccountPorts,
): Promise<LotwSigningPort> {
  try {
    const { p12, password } = readLotwAccountCredentials(credentials, ports.base64ToBytes)
    const signing = await ports.loadCertificate(p12, password, ctx)
    certificateIdentity(signing)
    return signing
  } catch (error) {
    // Parser/password/key errors can include private material or filenames.
    if (error instanceof LotwAccountProblem) throw error
    throw new Error(invalid)
  }
}

export function createLotwAccountHook(ports: LotwAccountPorts): AccountHook {
  return {
    label: 'LoTW Upload Preview',
    description: 'Choose the LoTW certificate file (.p12) you exported from TQSL.',
    synchronizable: false,
    fields: [
      {
        key: 'certificate',
        label: 'LoTW certificate file (.p12)',
        type: 'file',
        accept: { extensions: ['p12'] },
        maxBytes: maxLotwCertificateBytes,
      },
      { key: 'certificatePassword', label: 'Certificate file password (if set)', type: 'secret' },
    ],
    async testCredentials(credentials, ctx) {
      const signing = await loadLotwAccount(credentials, ctx, ports)
      const call = certificateIdentity(signing)
      const status = await ports.checkCertificateStatus?.(signing.certificate.serial, ctx)
      if (status === 'revoked' || status === 'superseded') throw new LotwAccountProblem(status)
      if (status === 'unknown') {
        return `Certificate file for ${call} opened. LoTW certificate status could not be checked.`
      }
      return `Certificate for ${call} is ready.`
    },
  }
}
