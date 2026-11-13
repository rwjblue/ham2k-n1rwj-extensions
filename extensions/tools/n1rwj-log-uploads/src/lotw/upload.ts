import { requireTq8Bytes } from './signing.ts'

export type LotwUploadResult =
  | { state: 'queued' }
  | { state: 'rejected' }
  | { state: 'unknown'; reason: 'http' | 'response' | 'transport' }

export interface LotwUploadRequest {
  url: 'https://lotw.arrl.org/lotw/upload'
  method: 'POST'
  redirect: 'error'
  headers: { 'Content-Type': string }
  body: Uint8Array
  timeout: number
}

export type LotwUploadTransport = (
  request: LotwUploadRequest,
) => Promise<{ status: number; body: string }>

const ENDPOINT = 'https://lotw.arrl.org/lotw/upload'
const BOUNDARY_PREFIX = '----Ham2KLogUpload'
const MAX_RESPONSE_LENGTH = 64 * 1024

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0))
}

function hasBytes(body: Uint8Array, needle: Uint8Array): boolean {
  let offset = body.indexOf(needle[0])
  while (offset !== -1 && offset + needle.length <= body.length) {
    if (needle.every((byte, index) => body[offset + index] === byte)) return true
    offset = body.indexOf(needle[0], offset + 1)
  }
  return false
}

function multipart(tq8: Uint8Array): Pick<LotwUploadRequest, 'headers' | 'body'> {
  let attempt = 0
  let boundary = `${BOUNDARY_PREFIX}${attempt}`
  while (hasBytes(tq8, ascii(boundary))) {
    attempt += 1
    if (attempt >= 32) throw new Error('Unable to delimit the LoTW multipart payload')
    boundary = `${BOUNDARY_PREFIX}${attempt}`
  }
  const header = ascii(
    `--${boundary}\r\nContent-Disposition: form-data; name="upfile"; filename="ham2k-log.tq8"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n',
  )
  const footer = ascii(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(header.length + tq8.length + footer.length)
  body.set(header)
  body.set(tq8, header.length)
  body.set(footer, header.length + tq8.length)
  return { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body }
}

export function parseLotwUploadResponse(status: number, body: string): LotwUploadResult {
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    return { state: 'unknown', reason: 'http' }
  }
  if (body.length > MAX_RESPONSE_LENGTH) return { state: 'unknown', reason: 'response' }
  const matches = [...body.matchAll(/<!--\s*\.UPL\.\s+([\s\S]*?)\s*-->/gi)]
  if (matches.length === 1) {
    const result = matches[0][1].trim().toLowerCase()
    if (result === 'accepted') return { state: 'queued' }
    if (result === 'rejected') return { state: 'rejected' }
  }
  return { state: 'unknown', reason: 'response' }
}

export async function uploadLotwTq8(
  tq8: Uint8Array,
  transport: LotwUploadTransport,
): Promise<LotwUploadResult> {
  requireTq8Bytes(tq8)
  const request = multipart(tq8)
  try {
    const { status, body } = await transport({
      ...request,
      url: ENDPOINT,
      method: 'POST',
      redirect: 'error',
      timeout: 30_000,
    })
    return parseLotwUploadResponse(status, body)
  } catch {
    // A transport failure can happen after LoTW receives the file.
    return { state: 'unknown', reason: 'transport' }
  }
}
