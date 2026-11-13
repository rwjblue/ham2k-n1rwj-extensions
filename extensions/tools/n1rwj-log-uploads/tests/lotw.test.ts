import { verify, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { expect, test, vi } from 'vitest'
import { buildSignedTq8, type LotwSigningPort } from '../src/lotw/signing.ts'
import {
  type LotwUploadRequest,
  parseLotwUploadResponse,
  uploadLotwTq8,
} from '../src/lotw/upload.ts'
import vector from './fixtures/lotw/vector.json'

// Public synthetic certificate and independently generated signature from
// Ferry's fixtures/signing. They carry no ARRL authority.
const certificate = new X509Certificate(
  readFileSync(new URL('./fixtures/lotw/certificate.pem', import.meta.url)),
)
const nowMillis = Date.parse('2027-01-01T00:00:00Z')

function makePort(): LotwSigningPort {
  return {
    certificate: {
      derBase64: certificate.raw.toString('base64'),
      callsign: 'W1AW',
      dxcc: 291,
      validFromMillis: Date.parse(certificate.validFrom),
      validToMillis: Date.parse(certificate.validTo),
      qsoFrom: '2025-01-01',
      revocationCheck: { status: 'unrevoked', checkedAtMillis: nowMillis },
    },
    signSha1: vi.fn(async (canonical) => {
      expect(canonical).toBe(vector.canonical)
      return vector.signatureBase64
    }),
    gzip: async (ascii) => gzipSync(ascii),
  }
}

test('serializes the Ferry canonical bytes and a signature that verifies independently', async () => {
  const port = makePort()
  const bytes = await buildSignedTq8(port, vector.station, [vector.contact], nowMillis)
  const text = gunzipSync(bytes).toString('ascii')
  expect(text).toContain(
    `<CERTIFICATE:${port.certificate.derBase64.length}>${port.certificate.derBase64}`,
  )
  expect(text).toContain('<GRIDSQUARE:6>FN31PR\n')
  expect(text).toContain('<REC_TYPE:8>tCONTACT\n')
  expect(text).toContain(`<SIGNDATA:${vector.canonical.length}>${vector.canonical}\n`)
  expect(text).toContain(
    `<SIGN_LOTW_V2.0:${vector.signatureBase64.length}:6>${vector.signatureBase64}\n`,
  )
  expect(
    verify(
      'RSA-SHA1',
      Buffer.from(vector.canonical, 'ascii'),
      certificate.publicKey,
      Buffer.from(vector.signatureBase64, 'base64'),
    ),
  ).toBe(true)
})

test('preserves eight-character grids and rejects unsupported batch members before signing', async () => {
  const port = makePort()
  const station = { ...vector.station, grid: 'FN31pr12' }
  port.signSha1 = vi.fn(async (canonical) => {
    expect(canonical).toBe(vector.canonical.replace('FN31PR', 'FN31PR12'))
    return vector.signatureBase64
  })
  const bytes = await buildSignedTq8(port, station, [vector.contact], nowMillis)
  expect(gunzipSync(bytes).toString('ascii')).toContain('<GRIDSQUARE:8>FN31PR12\n')

  const invalidPort = makePort()
  await expect(
    buildSignedTq8(
      invalidPort,
      station,
      [vector.contact, { ...vector.contact, id: 'invalid-mode', mode: 'FST4W' }],
      nowMillis,
    ),
  ).rejects.toThrow('Unsupported LoTW mode')
  expect(invalidPort.signSha1).not.toHaveBeenCalled()
})

test('refuses a mismatched or stale certificate and a QSO outside its date window', async () => {
  const port = makePort()
  const contacts = [vector.contact]
  await expect(
    buildSignedTq8(port, { ...vector.station, dxcc: 1 }, contacts, nowMillis),
  ).rejects.toThrow('must match the certificate')
  await expect(
    buildSignedTq8(port, vector.station, contacts, nowMillis + 86_400_001),
  ).rejects.toThrow('fresh unrevoked certificate status')
  port.certificate.qsoFrom = '2026-10-23'
  await expect(buildSignedTq8(port, vector.station, contacts, nowMillis)).rejects.toThrow(
    'outside certificate authorization',
  )
  expect(port.signSha1).not.toHaveBeenCalled()
})

test('sends unchanged gzip bytes as one multipart upfile and accepts a queue acknowledgement', async () => {
  const tq8 = gzipSync('sample synthetic QSO')
  const transport = vi.fn(async (request: LotwUploadRequest) => {
    expect(request.url).toBe('https://lotw.arrl.org/lotw/upload')
    expect(request.method).toBe('POST')
    expect(request.redirect).toBe('error')
    const boundary = request.headers['Content-Type'].split('boundary=')[1]
    const body = Buffer.from(request.body)
    const part = body.indexOf('\r\n\r\n')
    expect(body.subarray(0, part).toString('ascii')).toBe(
      `--${boundary}\r\nContent-Disposition: form-data; name="upfile"; filename="ham2k-log.tq8"\r\nContent-Type: application/octet-stream`,
    )
    expect(body.subarray(part + 4, part + 4 + tq8.length)).toEqual(tq8)
    expect(body.subarray(part + 4 + tq8.length).toString('ascii')).toBe(`\r\n--${boundary}--\r\n`)
    return { status: 200, body: '<!-- .UPL. accepted -->' }
  })
  await expect(uploadLotwTq8(tq8, transport)).resolves.toEqual({ state: 'queued' })
  expect(transport).toHaveBeenCalledTimes(1)
})

test('distinguishes rejection from indeterminate upload responses and avoids transport retries', async () => {
  const accepted = '<!-- .UPL. accepted -->'
  const rejected = '<!-- .UPL. rejected -->'
  expect(parseLotwUploadResponse(200, rejected)).toEqual({ state: 'rejected' })
  expect(parseLotwUploadResponse(200, accepted + rejected)).toEqual({
    state: 'unknown',
    reason: 'response',
  })
  expect(parseLotwUploadResponse(200, 'server maintenance')).toEqual({
    state: 'unknown',
    reason: 'response',
  })
  expect(parseLotwUploadResponse(503, accepted)).toEqual({ state: 'unknown', reason: 'http' })
  const transport = vi.fn(async () => {
    throw new Error('timeout')
  })
  await expect(uploadLotwTq8(gzipSync('sample synthetic QSO'), transport)).resolves.toEqual({
    state: 'unknown',
    reason: 'transport',
  })
  expect(transport).toHaveBeenCalledTimes(1)
})
