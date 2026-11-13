import { gzipSync } from 'node:zlib'
import type { HookContext, PushRecord, PushRequest, PushScope } from '@ham2k/extension-sdk'
import { expect, test, vi } from 'vitest'
import type { LotwSigningPort } from '../src/lotw/signing.ts'
import { createLotwTransferHook } from '../src/lotw/transfer.ts'
import type { LotwUploadRequest } from '../src/lotw/upload.ts'
import vector from './fixtures/lotw/vector.json'

const nowMillis = Date.parse('2027-01-01T00:00:00Z')
const context: HookContext = { online: true }
const scope: PushScope = {
  kind: 'operation',
  operation: { uuid: 'operation', stationCall: 'W1AW' },
}

function adif(overrides: Record<string, string | undefined> = {}) {
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
    ...overrides,
  }
  return `${Object.entries(fields)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `<${name}:${value.length}>${value}`)
    .join('')}<EOR>`
}

function record(uuid: string, overrides: Record<string, string | undefined> = {}): PushRecord {
  return { uuid, adif: [adif(overrides)] }
}

function fixture() {
  let currentMillis = nowMillis
  const signing: LotwSigningPort = {
    certificate: {
      // A synthetic signer port. Wire-format cryptography has an independent
      // public-certificate vector in lotw.test.ts.
      derBase64: 'AQID',
      callsign: 'W1AW',
      dxcc: 291,
      validFromMillis: Date.parse('2025-01-01T00:00:00Z'),
      validToMillis: Date.parse('2030-01-01T00:00:00Z'),
      qsoFrom: '2025-01-01',
      revocationCheck: { status: 'unrevoked', checkedAtMillis: nowMillis },
    },
    signSha1: vi.fn(async () => vector.signatureBase64),
    gzip: vi.fn(async (text) => gzipSync(text)),
  }
  const transport = vi.fn(async (_request: LotwUploadRequest) => ({
    status: 200,
    body: '<!-- .UPL. accepted -->',
  }))
  const connect = vi.fn(async () => ({ signing, transport, realNowMillis: () => currentMillis }))
  const hook = createLotwTransferHook({ connect })
  const request = (records: PushRecord[]): PushRequest => ({
    service: 'lotw',
    stationCall: 'W1AW',
    destination: { id: 'w1aw', stationCall: 'W1AW' },
    records,
  })
  return {
    hook,
    signing,
    transport,
    connect,
    request,
    advance(millis: number) {
      currentMillis += millis
    },
    push: (records: PushRecord[]) => hook.push(request(records), context),
  }
}

test('offers only unsent contacts and the certificate station destination', async () => {
  const f = fixture()
  await expect(f.hook.suggestPushes({ scope }, context)).resolves.toEqual([
    {
      key: 'lotw',
      service: 'lotw',
      label: 'Push to LoTW',
      select: { notSentTo: 'lotw' },
      payload: { full: true, includePrivateData: false, omit: ['app_*', 'notes', 'comment'] },
    },
  ])
  expect(f.connect).not.toHaveBeenCalled()
  await expect(
    f.hook.suggestDestinations(
      { service: 'lotw', scope, stationCalls: ['N1RWJ', 'W1AW'] },
      context,
    ),
  ).resolves.toEqual([{ id: 'w1aw', label: 'W1AW', stationCall: 'W1AW' }])
  await expect(
    f.hook.suggestDestinations({ service: 'lotw', scope, stationCalls: ['N1RWJ'] }, context),
  ).resolves.toEqual([])
  expect(f.transport).not.toHaveBeenCalled()
})

test('offers nothing for test operations, unknown scopes or another service', async () => {
  const f = fixture()
  const testing: PushScope = { kind: 'operation', operation: { stationCall: 'W1AW/TEST' } }
  // Future scopes arrive as JSON; this cast simulates a newer host.
  const future = { kind: 'log' } as unknown as PushScope
  for (const candidate of [testing, future]) {
    await expect(f.hook.suggestPushes({ scope: candidate }, context)).resolves.toEqual([])
    await expect(
      f.hook.suggestDestinations(
        { service: 'lotw', scope: candidate, stationCalls: ['W1AW'] },
        context,
      ),
    ).resolves.toEqual([])
  }
  await expect(
    f.hook.suggestDestinations({ service: 'qrz', scope, stationCalls: ['W1AW'] }, context),
  ).resolves.toEqual([])
  expect(f.connect).not.toHaveBeenCalled()
})

test('signs host-prepared ADIF and returns id-less receipts only after queue acknowledgement', async () => {
  const f = fixture()
  await expect(
    f.push([
      record('contact', { NOTES: 'Private <EOR> note', NAME: 'Private Name', APP_TEST: 'discard' }),
    ]),
  ).resolves.toEqual([{ uuid: 'contact' }])
  expect(f.signing.signSha1).toHaveBeenCalledWith(vector.canonical)
  expect(f.signing.gzip).toHaveBeenCalledTimes(1)
  expect(vi.mocked(f.signing.gzip).mock.calls[0][0]).not.toMatch(/Private|APP_TEST|NOTES|NAME/)
  expect(f.transport).toHaveBeenCalledOnce()
  expect(f.transport.mock.calls[0][0]).toMatchObject({
    url: 'https://lotw.arrl.org/lotw/upload',
    method: 'POST',
    redirect: 'error',
    timeout: 30_000,
  })
})

test('combines consecutive contacts from one location and separates a changed location', async () => {
  const f = fixture()
  await expect(
    f.push([
      record('one'),
      record('two', { TIME_ON: '123457' }),
      record('three', { MY_GRIDSQUARE: 'FN32aa', MY_CNTY: undefined, TIME_ON: '123458' }),
    ]),
  ).resolves.toEqual([{ uuid: 'one' }, { uuid: 'two' }, { uuid: 'three' }])
  expect(f.transport).toHaveBeenCalledTimes(2)
  const files = vi.mocked(f.signing.gzip).mock.calls.map(([text]) => text)
  expect(files[0].match(/<REC_TYPE:8>tCONTACT/g)).toHaveLength(2)
  expect(files[0]).toContain('<GRIDSQUARE:6>FN31PR')
  expect(files[1]).toContain('<GRIDSQUARE:6>FN32AA')
  expect(files[1]).not.toContain('TOLLAND')
})

test('reduces repeated program records for one contact without changing its signed identity', async () => {
  const f = fixture()
  await expect(
    f.push([
      {
        uuid: 'one',
        adif: [adif({ MY_POTA_REF: 'US-0001' }), adif({ MY_POTA_REF: 'US-0002' })],
      },
    ]),
  ).resolves.toEqual([{ uuid: 'one' }])
  expect(f.signing.signSha1).toHaveBeenCalledOnce()

  await expect(
    f.push([{ uuid: 'mismatch', adif: [adif(), adif({ CALL: 'K2ABC' })] }]),
  ).rejects.toThrow('Could not prepare')
  expect(f.transport).toHaveBeenCalledOnce()
})

test.each([
  { MY_GRIDSQUARE: undefined },
  { MY_GRIDSQUARE: 'AA00AA' },
  { MY_GRIDSQUARE: 'FN31PR,FN32AA' },
  { MY_DXCC: undefined },
  { STATION_CALLSIGN: 'N1RWJ' },
  { TIME_ON: '1234' },
  { MY_CNTY: 'MA,Tolland' },
])(
  'refuses incomplete or contradictory prepared metadata before signing: %j',
  async (overrides) => {
    const f = fixture()
    await expect(f.push([record('one', overrides)])).rejects.toThrow('Could not prepare')
    expect(f.signing.signSha1).not.toHaveBeenCalled()
    expect(f.transport).not.toHaveBeenCalled()
  },
)

test.each([
  { MY_DXCC: '1' },
  { MY_STATE: 'XX', MY_CNTY: undefined },
  { QSO_DATE: '20260230' },
  { MODE: 'UNSUPPORTED' },
])(
  'signer guards still reject invalid station/contact fields before HTTP: %j',
  async (overrides) => {
    const f = fixture()
    await expect(f.push([record('one', overrides)])).rejects.toThrow('Could not sign')
    expect(f.transport).not.toHaveBeenCalled()
  },
)

test('validates and signs all locations before sending any of them', async () => {
  const f = fixture()
  await expect(
    f.push([record('one'), record('bad', { MY_GRIDSQUARE: 'FN32AA', MODE: 'UNSUPPORTED' })]),
  ).rejects.toThrow('Could not sign')
  expect(f.transport).not.toHaveBeenCalled()
})

test('refuses deletes, duplicate UUIDs, missing ADIF and oversized host chunks', async () => {
  const f = fixture()
  for (const records of [
    [{ uuid: 'deleted', deleted: true, adif: [] }],
    [record('one'), record('one')],
    [{ uuid: 'empty', adif: [] }],
    Array.from({ length: 26 }, (_, index) => record(String(index))),
  ]) {
    await expect(f.push(records)).rejects.toThrow('Could not prepare')
  }
  expect(f.transport).not.toHaveBeenCalled()
})

test('rejects a wrong service/destination and offline execution', async () => {
  const f = fixture()
  for (const changes of [
    { service: 'qrz' },
    { stationCall: 'N1RWJ' },
    { destination: { id: 'other', stationCall: 'W1AW' } },
    { destination: { id: 'w1aw', stationCall: 'N1RWJ' } },
  ]) {
    await expect(
      f.hook.push({ ...f.request([record('one')]), ...changes }, context),
    ).rejects.toThrow('must match')
  }
  await expect(f.hook.push(f.request([record('one')]), { online: false })).rejects.toThrow(
    'Connect to the internet',
  )
  expect(f.transport).not.toHaveBeenCalled()
})

test.each(['rejected', 'unknown', 'transport'] as const)(
  'throws on the first %s upload so core stops later chunks',
  async (kind) => {
    const f = fixture()
    if (kind === 'transport') f.transport.mockRejectedValueOnce(new Error('secret request body'))
    else
      f.transport.mockResolvedValueOnce({
        status: 200,
        body: kind === 'rejected' ? '<!-- .UPL. rejected -->' : 'secret server reply',
      })
    await expect(
      f.push([record('one'), record('two', { MY_GRIDSQUARE: 'FN32AA' })]),
    ).rejects.toThrow(kind === 'rejected' ? 'LoTW refused' : 'LoTW did not acknowledge')
    expect(f.transport).toHaveBeenCalledOnce()
  },
)

test('throws after a later location fails, leaving the whole chunk for an operator retry', async () => {
  const f = fixture()
  f.transport
    .mockResolvedValueOnce({ status: 200, body: '<!-- .UPL. accepted -->' })
    .mockResolvedValueOnce({ status: 503, body: 'unavailable' })
  const records = [
    record('one'),
    record('two', { MY_GRIDSQUARE: 'FN32AA' }),
    record('three', { MY_GRIDSQUARE: 'FN33AA' }),
  ]
  await expect(f.push(records)).rejects.toThrow('LoTW did not acknowledge')
  expect(f.transport).toHaveBeenCalledTimes(2)
  // Core has no results from the failed chunk; a later explicit retry may
  // replay its accepted subbatch. The adapter never retries by itself.
  await expect(f.push(records)).resolves.toEqual(records.map(({ uuid }) => ({ uuid })))
  expect(f.transport).toHaveBeenCalledTimes(5)
})

test('shortens HTTP deadlines to stay within a single core chunk budget', async () => {
  const f = fixture()
  f.transport.mockImplementation(async (request) => {
    f.advance(request.timeout)
    return { status: 200, body: '<!-- .UPL. accepted -->' }
  })
  await expect(
    f.push([
      record('one'),
      record('two', { MY_GRIDSQUARE: 'FN32AA' }),
      record('three', { MY_GRIDSQUARE: 'FN33AA' }),
    ]),
  ).rejects.toThrow('LoTW did not acknowledge')
  expect(f.transport.mock.calls.map(([request]) => request.timeout)).toEqual([30_000, 15_000])
})

test('prevents concurrent pushes but releases the guard when an upload ends', async () => {
  const f = fixture()
  let resolveUpload: ((value: { status: number; body: string }) => void) | undefined
  f.transport.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveUpload = resolve
      }),
  )
  const pending = f.push([record('one')])
  await vi.waitFor(() => expect(resolveUpload).toBeDefined())
  await expect(f.push([record('two')])).rejects.toThrow('already running')
  if (!resolveUpload) throw new Error('The upload did not start')
  resolveUpload({ status: 200, body: '<!-- .UPL. accepted -->' })
  await expect(pending).resolves.toEqual([{ uuid: 'one' }])
  await expect(f.push([record('two')])).resolves.toEqual([{ uuid: 'two' }])
})
