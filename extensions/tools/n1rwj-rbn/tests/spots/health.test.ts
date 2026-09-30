import type { FetchOptions, FetchResponse } from '@ham2k/extension-sdk'
import { expect, it, vi } from 'vitest'
import { fakeTimers } from '../../../../../packages/reception/tests/timers.ts'
import { RbnRequestError } from '../../src/data/errors.ts'
import { createRbnTransport } from '../../src/data/transport.ts'
import { createHealthCheck } from '../../src/spots/health.ts'
import { createRbnSpots } from '../../src/spots/index.ts'

const endpoint = 'https://vailrerbn.com/api/v1/health'
const healthy = { status: 200, body: '{"status":"ok","database":"connected"}' }

it('expires health results after a real minute even when developer time is frozen', async () => {
  const timers = fakeTimers()
  const fetch = vi.fn(async () => healthy)
  const check = createHealthCheck(fetch, () => 1000, timers.driver)
  expect(await check(true)).toBeNull()
  timers.advance(59_999)
  expect(await check(true)).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
  fetch.mockResolvedValue({ status: 503, body: '' })
  timers.advance(1)
  expect((await check(true))?.message).toContain('HTTP 503')
  expect(timers.pending.size).toBe(1)
  fetch.mockResolvedValue(healthy)
  timers.advance(60_000)
  expect(await check(true)).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('coalesces settings checks, caches failures for a minute, and clears them on recovery', async () => {
  let now = 1000
  let finish: (value: FetchResponse) => void = () => {}
  const fetch = vi.fn(
    () =>
      new Promise<FetchResponse>((resolve) => {
        finish = resolve
      }),
  )
  const check = createHealthCheck(fetch, () => now)
  const first = check(true)
  const second = check(true)
  expect(fetch.mock.calls).toEqual([[endpoint, { timeout: 2000 }]])
  finish({ status: 503, body: 'private response body' })
  expect(await first).toEqual(await second)
  expect((await check(true))?.message).toContain('HTTP 503')
  expect(fetch).toHaveBeenCalledTimes(1)
  now += 60_000
  const recovered = check(true)
  finish(healthy)
  expect(await recovered).toBeNull()
  expect(await check(true)).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([
  [{ status: 429, body: '{}' }, 'HTTP 429'],
  [{ status: 200, body: 'invalid' }, 'invalid response'],
  [{ status: 200, body: '{"spots":[]}' }, 'unexpected response'],
  [{ status: 200, body: 'x'.repeat(64_001) }, 'unexpected response'],
  [{ status: 200, body: '{"status":"error","database":"connected"}' }, 'service problem'],
  [{ status: 200, body: '{"status":"ok","database":"disconnected"}' }, 'database is unavailable'],
] as const)(
  'explains HTTP and service failures without displaying response bodies',
  async (response, message) => {
    const notice = await createHealthCheck(async () => response)(true)
    expect(notice?.title).toBe('RBN service health check failed')
    expect(notice?.message).toContain(message)
  },
)

it.each([
  [new Error('TimeoutException after 0:00:01.999978: Future not completed'), 'timed out'],
  [new Error('secret host detail'), 'could not be reached'],
  [new RbnRequestError('rate-limit', 'secret detail'), 'rate limit clears'],
] as const)(
  'keeps the settings diagnostic usable when the host rejects a request',
  async (error, message) => {
    const notice = await createHealthCheck(async () => {
      throw error
    })(true)
    expect(notice?.message).toContain(message)
    expect(notice?.message).not.toContain('secret')
  },
)

it('does not mistake Vailmorse presence for the live RBN feed and skips checks offline', async () => {
  const fetch = vi.fn(async () => ({
    status: 200,
    body: '{"status":"ok","database":"connected","vailmorse":{"connected":false}}',
  }))
  const check = createHealthCheck(fetch)
  expect((await check(false))?.title).toBe('RBN service status not checked')
  expect(fetch).not.toHaveBeenCalled()
  expect(await check(true)).toBeNull()
  expect((await check(false))?.message).toContain('offline')
})

it('honors shared rate-limit backoff without sending a health request', async () => {
  const fetch = vi.fn(async () => ({ status: 429, body: '{}' }))
  const transport = createRbnTransport(fetch, () => 1000)
  await transport('https://vailrerbn.com/api/v1/spots')
  expect((await createHealthCheck(transport)(true))?.message).toContain('rate limit clears')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('puts a failing health notice before the editable form, checks concurrently, and never probes from Spots', async () => {
  let finish: (value: FetchResponse) => void = () => {}
  const fetch = vi.fn(async (url: string, _options?: FetchOptions) =>
    url === endpoint ? { status: 503, body: '' } : { status: 200, body: '{"spots":[]}' },
  )
  let readingSettings = false
  const runtime = createRbnSpots({
    fetch,
    lookup: () => undefined,
    bridge: { invokeAll: async () => [], invokeOne: async () => [] },
    getSettings: async () => {
      if (readingSettings)
        await new Promise<FetchResponse>((resolve) => {
          finish = resolve
        })
      return { extensions: { 'extension_n1rwj-rbn': { spotCallFilter: 'none' } } }
    },
    setSettings: async () => {},
  })
  await runtime.spots.fetchSpots({}, { online: true })
  expect(fetch.mock.calls.some(([url]) => url === endpoint)).toBe(false)
  fetch.mockClear()
  readingSettings = true
  const pending = runtime.settings.getDefinition({ panelKey: 'n1rwj-rbn' }, { online: true })
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(endpoint, { timeout: 2000 }))
  finish(healthy)
  const form = await pending
  expect(form.elements[0]).toMatchObject({
    type: 'markdown',
    text: expect.stringContaining('HTTP 503'),
  })
  expect(form.elements).toContainEqual(
    expect.objectContaining({ key: 'spotCallFilter', value: 'none' }),
  )
})
