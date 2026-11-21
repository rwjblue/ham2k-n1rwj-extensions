import { gzipSync } from 'node:zlib'
import type { FetchOptions, HookContext, PushRecord, PushScope } from '@ham2k/extension-sdk'
import { expect, test, vi } from 'vitest'
import { createLotwConnection } from '../src/lotw/connection.ts'
import type { LotwSigningPort } from '../src/lotw/signing.ts'
import { createLotwTransferHook } from '../src/lotw/transfer.ts'
import vector from './fixtures/lotw/vector.json'

const now = Date.parse('2027-01-01T00:00:00Z')
const password = 'synthetic-certificate-password'
const credentials = { certificate: 'AQID', certificatePassword: password }
const context: HookContext = { online: true, account: { credentials } }

function record(): PushRecord {
  const fields = {
    CALL: 'K1ABC',
    QSO_DATE: '20261022',
    TIME_ON: '123456',
    BAND: '20m',
    MODE: 'FT8',
    FREQ: '14.074',
    STATION_CALLSIGN: 'W1AW',
    MY_DXCC: '291',
    MY_GRIDSQUARE: 'FN31pr',
    MY_STATE: 'CT',
    MY_CNTY: 'CT,Tolland',
    MY_CQ_ZONE: '5',
    MY_ITU_ZONE: '8',
  }
  return {
    uuid: 'chasing-contact',
    adif: [
      `${Object.entries(fields)
        .map(([key, value]) => `<${key}:${value.length}>${value}`)
        .join('')}<EOR>`,
    ],
  }
}

function fixture() {
  const signing: LotwSigningPort = {
    certificate: {
      derBase64: 'BAUG',
      serial: '1',
      callsign: 'W1AW',
      dxcc: 291,
      validFromMillis: Date.parse('2025-01-01T00:00:00Z'),
      validToMillis: Date.parse('2030-01-01T00:00:00Z'),
      qsoFrom: '2025-01-01',
    },
    signSha1: vi.fn(async () => vector.signatureBase64),
    gzip: vi.fn(async (ascii) => gzipSync(ascii)),
  }
  const host = {
    randomBytes: vi.fn(async (length: number) => new Uint8Array(length).fill(7)),
    fetch: vi.fn(async (_url: string, _options?: FetchOptions) => ({
      status: 200,
      body: '<!-- .UPL. accepted -->',
    })),
  }
  const loadCertificate = vi.fn(
    async (
      _p12: Uint8Array,
      _password: string,
      _ctx: HookContext,
      randomBytes: (length: number) => Promise<Uint8Array>,
    ) => {
      // Synthetic provider: exercise the supplied source rather than use
      // ambient entropy. This fixture does not parse a real certificate.
      await randomBytes(32)
      return signing
    },
  )
  const connection = createLotwConnection({
    host,
    loadCertificate,
    realNowMillis: () => now,
  })
  return { connection, host, loadCertificate, signing }
}

test('account Test validates the entered file rather than a previously saved account', async () => {
  const f = fixture()
  await expect(
    f.connection.account.testCredentials(credentials, {
      ...context,
      account: { credentials: { certificate: 'BwgJ', certificatePassword: 'old-password' } },
    }),
  ).resolves.toContain('W1AW')
  expect(f.loadCertificate.mock.calls[0]?.slice(0, 2)).toEqual([
    new Uint8Array([1, 2, 3]),
    password,
  ])
  expect(f.host.randomBytes).toHaveBeenCalledWith(32)
  expect(f.host.fetch).not.toHaveBeenCalled()
})

test('connect reloads secure account credentials without retaining the previous file or password', async () => {
  const f = fixture()
  await f.connection.connect(context)
  await f.connection.connect({
    ...context,
    account: { credentials: { certificate: 'BwgJ', certificatePassword: 'replacement-password' } },
  })
  expect(f.loadCertificate.mock.calls.map((args) => args.slice(0, 2))).toEqual([
    [new Uint8Array([1, 2, 3]), password],
    [new Uint8Array([7, 8, 9]), 'replacement-password'],
  ])
  expect(f.host.fetch).not.toHaveBeenCalled()
})

test('composes secure account, entropy, signing and binary transport for a chasing push', async () => {
  const f = fixture()
  const hook = createLotwTransferHook(f.connection)
  const scope: PushScope = { kind: 'chasing', stationCall: 'W1AW' }
  const destinations = await hook.suggestDestinations(
    { service: 'lotw', scope, stationCalls: ['W1AW'] },
    context,
  )
  expect(destinations).toEqual([{ id: 'w1aw', label: 'W1AW', stationCall: 'W1AW' }])
  await expect(
    hook.push(
      {
        service: 'lotw',
        stationCall: 'W1AW',
        destination: destinations[0],
        records: [record()],
      },
      context,
    ),
  ).resolves.toEqual([{ uuid: 'chasing-contact' }])
  expect(f.host.fetch).toHaveBeenCalledExactlyOnceWith(
    'https://lotw.arrl.org/lotw/upload',
    expect.objectContaining({ method: 'POST', redirect: 'error', body: expect.any(Uint8Array) }),
  )
  expect(f.signing.signSha1).toHaveBeenCalledWith(vector.canonical)
  const body = f.host.fetch.mock.calls[0]?.[1]?.body
  if (!(body instanceof Uint8Array)) throw new Error('Expected a binary upload body')
  expect(Buffer.from(body).toString('ascii')).not.toContain(password)
})

test('an unavailable secure source stops connection before any upload', async () => {
  const f = fixture()
  f.host.randomBytes.mockRejectedValue(new Error(`provider included ${password}`))
  const failed = f.connection.connect(context)
  await expect(failed).rejects.toThrow()
  await expect(failed).rejects.not.toThrow(password)
  expect(f.host.fetch).not.toHaveBeenCalled()
})

test('a lost upload reply stops without retrying or exposing provider errors', async () => {
  const f = fixture()
  f.host.fetch.mockRejectedValue(new Error(`provider included ${password}`))
  const hook = createLotwTransferHook(f.connection)
  await expect(
    hook.push(
      {
        service: 'lotw',
        stationCall: 'W1AW',
        destination: { id: 'w1aw', stationCall: 'W1AW' },
        records: [record()],
      },
      context,
    ),
  ).rejects.toThrow('LoTW did not acknowledge')
  expect(f.host.fetch).toHaveBeenCalledTimes(1)
})
