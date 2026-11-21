import { verify, X509Certificate } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { gunzipSync } from 'node:zlib'
import type {
  AccountHook,
  ExtensionDefinition,
  HookContext,
  PushRequest,
  PushScope,
  TransferHook,
} from '@ham2k/extension-sdk'
import { expect, test } from 'vitest'
import manifest from '../manifest.json'
import vector from './fixtures/lotw/vector.json'

const fixtures = new URL('./fixtures/lotw/', import.meta.url)
const now = Date.parse('2027-01-01T00:00:00Z')
const password = 'ferry-fixture'

const scope: PushScope = { kind: 'chasing', stationCall: 'W1AW' }
const destination = { id: 'w1aw', label: 'W1AW', stationCall: 'W1AW' }
const request: PushRequest = {
  service: 'lotw',
  stationCall: 'W1AW',
  destination,
  records: [
    {
      uuid: 'chasing-contact',
      adif: [
        '<CALL:5>K1ABC<QSO_DATE:8>20261022<TIME_ON:6>123456<BAND:3>20m<MODE:3>FT8' +
          '<FREQ:6>14.074<STATION_CALLSIGN:4>W1AW<MY_DXCC:3>291<MY_GRIDSQUARE:6>FN31pr' +
          '<QTH:10>São Tomé <MY_STATE:2>CT<MY_CNTY:10>CT,Tolland<MY_CQ_ZONE:1>5<MY_ITU_ZONE:1>8<EOR>',
      ],
    },
  ],
}

const sandboxModules = Promise.all(
  Object.keys(manifest.sharedDependencies).map(async (name) => {
    const loaded = await import(name)
    return [name, name === 'i18next' ? loaded.default : loaded] as const
  }),
).then(Object.fromEntries)

type Scenario = {
  status?: string
  statusUnavailable?: boolean
  randomUnavailable?: boolean
  expired?: boolean
}

async function activate(kind: 'current' | 'legacy', scenario: Scenario = {}) {
  const [source, sharedModules, p12, certPem] = await Promise.all([
    readFile(new URL('../build/index.js', import.meta.url), 'utf8'),
    sandboxModules,
    readFile(new URL(`synthetic-${kind}.p12`, fixtures)),
    readFile(new URL('certificate.pem', fixtures)),
  ])
  const certificate = new X509Certificate(certPem)
  const serial = BigInt(`0x${certificate.serialNumber}`).toString()
  const clock = scenario.expired ? Date.parse(certificate.validTo) + 1 : now
  const credentials = { certificate: p12.toString('base64'), certificatePassword: password }
  const ctx: HookContext = { online: true, account: { credentials } }
  const calls: { method: string; params: Record<string, unknown> }[] = []
  let definition: ExtensionDefinition | undefined
  let account: AccountHook | undefined
  let transfer: TransferHook | undefined

  const sandbox = createContext({
    performance: { now: () => performance.now() },
    __halo: {
      sharedModules,
      defineExtension(value: ExtensionDefinition) {
        definition = value
      },
    },
  })
  runInContext(
    `globalThis.Date = class extends Date {
      constructor(...args) { super(...(args.length ? args : [${clock}])) }
      static now() { return ${clock} }
    };
    Math.random = () => { throw new Error('Ambient entropy is forbidden') };`,
    sandbox,
  )
  expect(
    runInContext(
      '[typeof process, typeof require, typeof Buffer, typeof fetch, typeof crypto, typeof window, typeof document]',
      sandbox,
    ),
  ).toEqual(Array.from({ length: 7 }, () => 'undefined'))
  runInContext(source, sandbox, { filename: 'n1rwj-lotw-preview.js', timeout: 5000 })
  definition?.onActivation({
    registerHook(category, { hook }) {
      if (category === 'account') account = hook as AccountHook
      if (category === 'transfer') transfer = hook as TransferHook
    },
    async hostCall(method, params) {
      calls.push({ method, params })
      if (method === 'randomBytes') {
        if (scenario.randomUnavailable) throw new Error('No secure source')
        const { length } = params
        if (typeof length !== 'number' || length < 1 || length > 4096)
          throw new Error('Invalid entropy request')
        // These bytes deliberately make the offline fixture reproducible.
        return Buffer.alloc(length, 7).toString('base64')
      }
      if (
        method === 'fetchStrict' &&
        params.url === `https://lotw.arrl.org/lotw/crl?serial=${serial}`
      ) {
        expect(params.redirect).toBe('error')
        expect(params.method ?? 'GET').toBe('GET')
        expect(params.bodyBase64).toBeUndefined()
        if (scenario.statusUnavailable) throw new Error('Certificate status unavailable')
        return {
          status: 200,
          body: `<LoTW_CRL><Serial>${serial}</Serial><Status>${scenario.status ?? 'Unrevoked'}</Status></LoTW_CRL>`,
        }
      }
      if (method === 'fetchStrict' && params.url === 'https://lotw.arrl.org/lotw/upload') {
        expect(params.redirect).toBe('error')
        expect(params.method).toBe('POST')
        return { status: 200, body: '<!-- .UPL. accepted -->' }
      }
      throw new Error(`Unexpected host method ${method}`)
    },
  })

  if (!account || !transfer?.push)
    throw new Error('The bundle did not activate LoTW account and push hooks')
  const push = transfer.push.bind(transfer)
  const posts = () => calls.filter(({ params }) => params.method === 'POST')
  const statusChecks = () =>
    calls.filter(({ params }) => params.url === `https://lotw.arrl.org/lotw/crl?serial=${serial}`)
  return { account, transfer, push, ctx, credentials, calls, certificate, posts, statusChecks }
}

function unpackUpload(params: Record<string, unknown>): string {
  const { bodyBase64, headers } = params
  if (typeof bodyBase64 !== 'string' || !headers || typeof headers !== 'object')
    throw new Error('Expected a binary multipart body')
  expect(params.body).toBeUndefined()
  const contentType = (headers as Record<string, string>)['Content-Type']
  const boundary = /^multipart\/form-data; boundary=(\S+)$/.exec(contentType)?.[1]
  if (!boundary) throw new Error('Missing multipart boundary')
  const body = Buffer.from(bodyBase64, 'base64')
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="upfile"; filename="ham2k-log.tq8"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n',
    'ascii',
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'ascii')
  expect(body.subarray(0, header.length)).toEqual(header)
  expect(body.subarray(-footer.length)).toEqual(footer)
  return gunzipSync(body.subarray(header.length, -footer.length)).toString('ascii')
}

test.each(['current', 'legacy'] as const)(
  'the built extension imports a %s certificate, signs, and records a binary upload receipt',
  async (kind) => {
    const f = await activate(kind)
    expect(manifest.api).toBe(29)
    expect(manifest.hooks).toContain('account')
    expect(manifest.domains).toContain('lotw.arrl.org')
    expect(f.account.fields).toContainEqual(
      expect.objectContaining({
        type: 'file',
        key: 'certificate',
        label: 'LoTW certificate file (.p12)',
      }),
    )
    expect(f.account.synchronizable).toBe(false)
    await expect(f.account.testCredentials(f.credentials, f.ctx)).resolves.toBe(
      'Certificate for W1AW is ready.',
    )
    expect(f.statusChecks()).toHaveLength(1)
    expect(f.posts()).toHaveLength(0)
    const beforeSuggestions = f.calls.length
    await expect(
      f.transfer.suggestDestinations({ service: 'lotw', scope, stationCalls: ['W1AW'] }, f.ctx),
    ).resolves.toEqual([destination])
    expect(f.calls).toHaveLength(beforeSuggestions)
    await expect(f.push(request, f.ctx)).resolves.toEqual([{ uuid: 'chasing-contact' }])
    expect(f.calls.some(({ method }) => method === 'randomBytes')).toBe(true)
    expect(f.statusChecks()).toHaveLength(1)
    const posts = f.posts()
    expect(posts).toHaveLength(1)
    expect(JSON.stringify(f.calls)).not.toContain(f.credentials.certificate)
    expect(JSON.stringify(f.calls)).not.toContain(password)
    const text = unpackUpload(posts[0].params)
    expect(text).not.toContain(f.credentials.certificate)
    expect(text).not.toContain(password)
    const certBase64 = f.certificate.raw.toString('base64')
    expect(text).toContain(`<CERTIFICATE:${certBase64.length}>${certBase64}\n`)
    const signature = /<SIGN_LOTW_V2\.0:\d+:6>([A-Za-z0-9+/=]+)\n/.exec(text)?.[1]
    expect(signature).toBe(vector.signatureBase64)
    expect(text).toContain(`<SIGNDATA:${vector.canonical.length}>${vector.canonical}\n`)
    expect(
      verify(
        'RSA-SHA1',
        Buffer.from(vector.canonical, 'ascii'),
        f.certificate.publicKey,
        Buffer.from(signature ?? '', 'base64'),
      ),
    ).toBe(true)
  },
)

test('the built extension stops before sending when the host cannot supply secure entropy', async () => {
  const f = await activate('current', { randomUnavailable: true })
  await expect(f.push(request, f.ctx)).rejects.toThrow()
  expect(f.calls.some(({ method }) => method === 'randomBytes')).toBe(true)
  expect(f.posts()).toHaveLength(0)
})

test.each([
  ['an unknown reply', { status: 'Not found' }],
  ['a connection failure', { statusUnavailable: true }],
] as const)(
  'Account Test reports %s without blocking a later upload',
  async (_reason, scenario) => {
    const f = await activate('current', scenario)
    await expect(f.account.testCredentials(f.credentials, f.ctx)).resolves.toBe(
      'Certificate file for W1AW opened. LoTW certificate status could not be checked.',
    )
    expect(f.posts()).toHaveLength(0)
    expect(f.statusChecks()).toHaveLength(1)
    await expect(f.push(request, f.ctx)).resolves.toEqual([{ uuid: 'chasing-contact' }])
    expect(f.statusChecks()).toHaveLength(1)
    expect(f.posts()).toHaveLength(1)
  },
)

test('Account Test can open the file while offline', async () => {
  const f = await activate('current')
  await expect(f.account.testCredentials(f.credentials, { ...f.ctx, online: false })).resolves.toBe(
    'Certificate file for W1AW opened. LoTW certificate status could not be checked.',
  )
  expect(f.calls).toHaveLength(0)
})

test.each([
  ['Revoked', 'LoTW reports this certificate was revoked.'],
  ['Superceded', 'LoTW reports this certificate was replaced.'],
])('Account Test reports that LoTW returned %s', async (status, message) => {
  const f = await activate('current', { status })
  await expect(f.account.testCredentials(f.credentials, f.ctx)).rejects.toThrow(message)
  expect(f.statusChecks()).toHaveLength(1)
  expect(f.posts()).toHaveLength(0)
})

test('a valid saved certificate can upload without running Account Test', async () => {
  const f = await activate('current', { statusUnavailable: true })
  await expect(f.push(request, f.ctx)).resolves.toEqual([{ uuid: 'chasing-contact' }])
  expect(f.statusChecks()).toHaveLength(0)
  expect(f.posts()).toHaveLength(1)
})

test('an expired certificate stops a push before any network request', async () => {
  const f = await activate('current', { expired: true })
  await expect(f.push(request, f.ctx)).rejects.toThrow('outside its validity dates')
  expect(f.calls).toHaveLength(0)
})

test('a wrong certificate password produces no upload or leaked password', async () => {
  const f = await activate('legacy')
  const certificatePassword = 'private wrong password 😀'
  const failed = f.account.testCredentials({ ...f.credentials, certificatePassword }, f.ctx)
  await expect(failed).rejects.toThrow()
  await expect(failed).rejects.not.toThrow(certificatePassword)
  const push = f.push(request, {
    ...f.ctx,
    account: { credentials: { ...f.credentials, certificatePassword } },
  })
  await expect(push).rejects.toThrow()
  await expect(push).rejects.not.toThrow(certificatePassword)
  expect(f.calls).toHaveLength(0)
})
