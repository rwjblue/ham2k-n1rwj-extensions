import { gzipSync } from 'node:zlib'
import type { FetchOptions } from '@ham2k/extension-sdk'
import { expect, test, vi } from 'vitest'
import { createLotwHostAdapters, maxLotwRequestBytes } from '../src/lotw/host.ts'
import { type LotwUploadRequest, uploadLotwTq8 } from '../src/lotw/upload.ts'

function makeHost() {
  return {
    randomBytes: vi.fn(async (length: number) => new Uint8Array(length).fill(0x8b)),
    fetch: vi.fn(async (_url: string, _options?: FetchOptions) => ({
      status: 200,
      body: '<!-- .UPL. accepted -->',
    })),
  }
}

function makeRequest(body = new Uint8Array([0, 0x8b, 0xff])): LotwUploadRequest {
  return {
    url: 'https://lotw.arrl.org/lotw/upload',
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'multipart/form-data; boundary=synthetic' },
    body,
    timeout: 1234,
  }
}

test('adapter creation reads no credentials, fetches nothing, and consumes no entropy', () => {
  const host = makeHost()
  createLotwHostAdapters(host)
  expect(host.randomBytes).not.toHaveBeenCalled()
  expect(host.fetch).not.toHaveBeenCalled()
})

test.each([1, 256, 4096])('gets exactly %i secure bytes through the host', async (length) => {
  const host = makeHost()
  const adapters = createLotwHostAdapters(host)
  const first = await adapters.randomBytes(length)
  const second = await adapters.randomBytes(length)
  expect(first).toBeInstanceOf(Uint8Array)
  expect(first).toHaveLength(length)
  expect(first.every((byte) => byte === 0x8b)).toBe(true)
  expect(second).not.toBe(first)
  expect(host.randomBytes.mock.calls).toEqual([[length], [length]])
  expect(host.fetch).not.toHaveBeenCalled()
})

test.each([0, -1, 4097, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'refuses invalid entropy length %s before calling the host',
  async (length) => {
    const host = makeHost()
    await expect(createLotwHostAdapters(host).randomBytes(length)).rejects.toThrow(
      'Secure randomness is unavailable for LoTW signing.',
    )
    expect(host.randomBytes).not.toHaveBeenCalled()
  },
)

test.each([new Uint8Array(0), new Uint8Array(3), new Uint8Array(5)])(
  'refuses a host entropy answer with the wrong length',
  async (answer) => {
    const host = makeHost()
    host.randomBytes.mockResolvedValue(answer)
    await expect(createLotwHostAdapters(host).randomBytes(4)).rejects.toThrow(
      'Secure randomness is unavailable for LoTW signing.',
    )
    expect(host.randomBytes).toHaveBeenCalledTimes(1)
  },
)

test('refuses non-byte entropy and does not fall back to another source', async () => {
  const randomBytes = vi.fn(async () => [1, 2, 3, 4] as unknown as Uint8Array)
  await expect(
    createLotwHostAdapters({ ...makeHost(), randomBytes }).randomBytes(4),
  ).rejects.toThrow('Secure randomness is unavailable for LoTW signing.')
  expect(randomBytes).toHaveBeenCalledTimes(1)
})

test('redacts secure-source failures without retrying', async () => {
  const host = makeHost()
  host.randomBytes.mockRejectedValue(new Error('private key and certificate password'))
  await expect(createLotwHostAdapters(host).randomBytes(32)).rejects.toThrow(
    /^Secure randomness is unavailable for LoTW signing\.$/,
  )
  expect(host.randomBytes).toHaveBeenCalledTimes(1)
})

test('forwards only the selected byte view, timeout and redirect refusal to the original URL', async () => {
  const host = makeHost()
  const body = new Uint8Array([99, 0, 0x8b, 0xff, 77]).subarray(1, 4)
  const request = makeRequest(body)
  await expect(createLotwHostAdapters(host).transport(request)).resolves.toEqual({
    status: 200,
    body: '<!-- .UPL. accepted -->',
  })
  expect(host.fetch).toHaveBeenCalledExactlyOnceWith('https://lotw.arrl.org/lotw/upload', {
    method: 'POST',
    headers: request.headers,
    body,
    redirect: 'error',
    timeout: 1234,
  })
  expect(host.fetch.mock.calls[0][1]?.body).toBe(body)
  expect(host.fetch.mock.calls[0][1]?.body).toEqual(new Uint8Array([0, 0x8b, 0xff]))
  expect(host.randomBytes).not.toHaveBeenCalled()
  expect(request).toEqual(makeRequest(body))
})

test('carries the signed-file multipart payload through the SDK seam byte for byte', async () => {
  const host = makeHost()
  const tq8 = gzipSync(new Uint8Array([0, 0x8b, 0xff]))
  await expect(uploadLotwTq8(tq8, createLotwHostAdapters(host).transport)).resolves.toEqual({
    state: 'queued',
  })
  expect(host.fetch).toHaveBeenCalledTimes(1)
  const [url, options] = host.fetch.mock.calls[0]
  expect(url).toBe('https://lotw.arrl.org/lotw/upload')
  const bytes = options?.body
  expect(bytes).toBeInstanceOf(Uint8Array)
  const requestBody = Buffer.from(bytes as Uint8Array)
  const partStart = requestBody.indexOf('\r\n\r\n') + 4
  expect(requestBody.subarray(partStart, partStart + tq8.byteLength)).toEqual(tq8)
  expect(options?.redirect).toBe('error')
  expect(options?.timeout).toBe(30_000)
  expect(host.randomBytes).not.toHaveBeenCalled()
})

test('accepts the 16 MiB request limit and refuses one byte more before HTTP', async () => {
  const host = makeHost()
  const transport = createLotwHostAdapters(host).transport
  const limit = new Uint8Array(maxLotwRequestBytes)
  await expect(transport(makeRequest(limit))).resolves.toHaveProperty('status', 200)
  expect(host.fetch.mock.calls[0][1]?.body).toBe(limit)
  await expect(transport(makeRequest(new Uint8Array(maxLotwRequestBytes + 1)))).rejects.toThrow(
    'Could not prepare the LoTW upload request.',
  )
  expect(host.fetch).toHaveBeenCalledTimes(1)
})

test.each([
  { url: 'https://services.ham2k.net/lotw.arrl.org/lotw/upload' },
  { method: 'GET' },
  { redirect: 'follow' },
  { body: 'base64 is not an upload body' },
  { timeout: 0 },
  { timeout: Number.NaN },
  { headers: { 'Content-Type': '' } },
])('refuses invalid upload options before HTTP: %j', async (overrides) => {
  const host = makeHost()
  const request = { ...makeRequest(), ...overrides } as unknown as LotwUploadRequest
  await expect(createLotwHostAdapters(host).transport(request)).rejects.toThrow(
    /^Could not prepare the LoTW upload request\.$/,
  )
  expect(host.fetch).not.toHaveBeenCalled()
})

test.each(['redirect refused: private Location', 'lost connection with private response'])(
  'redacts host failures, treats delivery as uncertain and never retries: %s',
  async (message) => {
    const host = makeHost()
    host.fetch.mockRejectedValue(new Error(message))
    const adapters = createLotwHostAdapters(host)
    await expect(adapters.transport(makeRequest())).rejects.toThrow(
      /^LoTW did not acknowledge the upload\. It may already have reached the server\.$/,
    )
    expect(host.fetch).toHaveBeenCalledTimes(1)
    host.fetch.mockClear()
    await expect(
      uploadLotwTq8(gzipSync('synthetic contacts'), adapters.transport),
    ).resolves.toEqual({
      state: 'unknown',
      reason: 'transport',
    })
    expect(host.fetch).toHaveBeenCalledTimes(1)
  },
)
