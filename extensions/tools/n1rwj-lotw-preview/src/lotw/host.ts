// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { host as sdkHost } from '@ham2k/extension-sdk'
import type { LotwUploadRequest, LotwUploadTransport } from './upload.ts'

export type LotwHostPorts = Pick<typeof sdkHost, 'randomBytes' | 'fetch'>

export const maxLotwRequestBytes = 16 * 1024 * 1024
const maxRandomBytes = 4096
const endpoint = 'https://lotw.arrl.org/lotw/upload'
const entropyFailure = 'Secure randomness is unavailable for LoTW signing.'
const invalidRequest = 'Could not prepare the LoTW upload request.'
const uploadFailure = 'LoTW did not acknowledge the upload. It may already have reached the server.'

function validateRequest(request: LotwUploadRequest): void {
  if (
    request.url !== endpoint ||
    request.method !== 'POST' ||
    request.redirect !== 'error' ||
    !(request.body instanceof Uint8Array) ||
    request.body.byteLength > maxLotwRequestBytes ||
    !Number.isFinite(request.timeout) ||
    request.timeout <= 0 ||
    typeof request.headers?.['Content-Type'] !== 'string' ||
    !request.headers['Content-Type'].trim()
  ) {
    throw new Error(invalidRequest)
  }
}

/** Prepare SDK adapters without storing keys or doing work on creation. */
export function createLotwHostAdapters(host: LotwHostPorts = sdkHost): {
  randomBytes(length: number): Promise<Uint8Array>
  transport: LotwUploadTransport
} {
  return {
    async randomBytes(length) {
      if (!Number.isInteger(length) || length < 1 || length > maxRandomBytes) {
        throw new Error(entropyFailure)
      }
      try {
        const bytes = await host.randomBytes(length)
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
          throw new Error(entropyFailure)
        }
        return bytes
      } catch {
        // Never expose provider errors or fall back to a weaker source.
        throw new Error(entropyFailure)
      }
    },
    async transport(request) {
      try {
        validateRequest(request)
      } catch {
        throw new Error(invalidRequest)
      }
      try {
        // The host owns browser proxy routing and the trusted fetch dispatch.
        // Passing the byte view unchanged preserves only the selected slice.
        return await host.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': request.headers['Content-Type'] },
          body: request.body,
          redirect: 'error',
          timeout: request.timeout,
        })
      } catch {
        // A redirect or a lost reply may follow delivery. The caller decides
        // what to do with an uncertain result; this adapter never retries.
        throw new Error(uploadFailure)
      }
    },
  }
}
