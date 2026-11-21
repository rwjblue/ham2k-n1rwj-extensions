import type { HookContext } from '@ham2k/extension-sdk'
import { expect, test, vi } from 'vitest'
import {
  createLotwAccountHook,
  type LotwAccountPorts,
  loadLotwAccount,
  maxLotwCertificateBytes,
  readLotwAccountCredentials,
} from '../src/lotw/account.ts'
import type { LotwSigningPort } from '../src/lotw/signing.ts'

const context: HookContext = { online: false }
const privateBytes = Uint8Array.of(0, 0x8b, 0xff)
const encodedCertificate = 'AIv/'
const credentials = {
  certificate: encodedCertificate,
  'certificate:name': 'my-private-backup.p12',
  certificatePassword: '  private password  ',
}
const invalid = 'Could not open the LoTW certificate. Check the file and its password.'

function fixture() {
  const signing: LotwSigningPort = {
    certificate: {
      derBase64: 'AA==',
      serial: '1',
      callsign: 'W1AW',
      dxcc: 291,
      validFromMillis: 0,
      validToMillis: 100,
      qsoFrom: '2020-01-01',
    },
    signSha1: vi.fn(),
    gzip: vi.fn(),
  }
  const ports = {
    base64ToBytes: vi.fn(() => privateBytes),
    loadCertificate: vi.fn(async () => signing),
  } satisfies LotwAccountPorts
  return { signing, ports, hook: createLotwAccountHook(ports) }
}

test('defines a bounded account file and password in the host secure credential dialog', () => {
  const { hook } = fixture()
  expect(hook.fields).toEqual([
    {
      key: 'certificate',
      label: 'LoTW certificate file (.p12)',
      type: 'file',
      accept: { extensions: ['p12'] },
      maxBytes: 65_536,
    },
    { key: 'certificatePassword', label: 'Certificate file password (if set)', type: 'secret' },
  ])
  expect(hook.synchronizable).toBe(false)
  expect(hook).not.toHaveProperty('oauth2')
})

test('tests entered credentials and derives identity from the validated certificate', async () => {
  const f = fixture()
  const currentContext: HookContext = {
    online: false,
    account: { credentials: { certificate: 'old saved credential' } },
  }
  await expect(f.hook.testCredentials(credentials, currentContext)).resolves.toBe(
    'Certificate for W1AW is ready.',
  )
  expect(f.ports.base64ToBytes).toHaveBeenCalledExactlyOnceWith(encodedCertificate)
  expect(f.ports.loadCertificate).toHaveBeenCalledExactlyOnceWith(
    privateBytes,
    '  private password  ',
    currentContext,
  )
  expect(f.signing.signSha1).not.toHaveBeenCalled()
  expect(f.signing.gzip).not.toHaveBeenCalled()
  expect(credentials).toEqual({
    certificate: encodedCertificate,
    'certificate:name': 'my-private-backup.p12',
    certificatePassword: '  private password  ',
  })
})

test('connection loading reopens the current credential and returns the provider capability', async () => {
  const f = fixture()
  await expect(loadLotwAccount(credentials, context, f.ports)).resolves.toBe(f.signing)
  await expect(
    loadLotwAccount({ certificate: encodedCertificate }, context, f.ports),
  ).resolves.toBe(f.signing)
  expect(f.ports.loadCertificate).toHaveBeenLastCalledWith(privateBytes, '', context)
  expect(f.ports.loadCertificate).toHaveBeenCalledTimes(2)
})

test('a filename is optional display data and never supplies a certificate identity or password', async () => {
  const f = fixture()
  await expect(
    f.hook.testCredentials(
      { certificate: encodedCertificate, 'certificate:name': 'N1RWJ.p12' },
      context,
    ),
  ).resolves.toBe('Certificate for W1AW is ready.')
  await expect(
    f.hook.testCredentials({ certificate: encodedCertificate, password: 'unrelated' }, context),
  ).resolves.toBe('Certificate for W1AW is ready.')
  expect(f.ports.loadCertificate).toHaveBeenLastCalledWith(privateBytes, '', context)
})

const invalidCredentials: (Record<string, string> | undefined)[] = [
  undefined,
  {},
  { 'certificate:name': 'W1AW.p12' },
  { certificate: '' },
  { certificate: ' ' },
  { certificate: 'AA' },
  { certificate: 'AA===' },
  { certificate: 'AA==\n' },
  { certificate: 'AA=/' },
  { certificate: 'AB==' },
  { certificate: 'AAB=' },
]

test.each(invalidCredentials)(
  'rejects missing, empty or noncanonical certificate bytes before decoding: %j',
  (value) => {
    const f = fixture()
    expect(() => readLotwAccountCredentials(value, f.ports.base64ToBytes)).toThrow(invalid)
    expect(f.ports.base64ToBytes).not.toHaveBeenCalled()
    expect(f.ports.loadCertificate).not.toHaveBeenCalled()
  },
)

test('measures decoded length before allocating even at the maximum Base64 length', () => {
  const f = fixture()
  const sameEncodedLengthButTooManyBytes = 'AAAA'.repeat(Math.ceil(maxLotwCertificateBytes / 3))
  const evenLarger = 'AAAA'.repeat(Math.ceil(maxLotwCertificateBytes / 3) + 1)
  for (const certificate of [sameEncodedLengthButTooManyBytes, evenLarger]) {
    expect(() => readLotwAccountCredentials({ certificate }, f.ports.base64ToBytes)).toThrow(
      invalid,
    )
  }
  expect(f.ports.base64ToBytes).not.toHaveBeenCalled()
})

test('accepts exactly 64KiB, including the canonical padding at the size boundary', () => {
  const f = fixture()
  const bytes = new Uint8Array(maxLotwCertificateBytes)
  const certificate = `${'AAAA'.repeat(Math.floor(maxLotwCertificateBytes / 3))}AA==`
  vi.mocked(f.ports.base64ToBytes).mockReturnValue(bytes)
  expect(readLotwAccountCredentials({ certificate }, f.ports.base64ToBytes)).toEqual({
    p12: bytes,
    password: '',
  })
  expect(f.ports.base64ToBytes).toHaveBeenCalledExactlyOnceWith(certificate)
})

test.each([new Uint8Array(0), new Uint8Array(2), new Uint8Array(4)])(
  'requires the decoder to return exactly the claimed number of bytes',
  (bytes) => {
    const f = fixture()
    vi.mocked(f.ports.base64ToBytes).mockReturnValue(bytes)
    expect(() => readLotwAccountCredentials(credentials, f.ports.base64ToBytes)).toThrow(invalid)
    expect(f.ports.loadCertificate).not.toHaveBeenCalled()
  },
)

test('decoder and parser/password failures expose neither private credentials nor filenames', async () => {
  const f = fixture()
  const secret = 'private password my-private-backup.p12 AIv/ private key bytes'
  vi.mocked(f.ports.base64ToBytes).mockImplementationOnce(() => {
    throw new Error(secret)
  })
  await expect(f.hook.testCredentials(credentials, context)).rejects.toMatchObject({
    message: invalid,
  })
  vi.mocked(f.ports.loadCertificate).mockRejectedValueOnce(new Error(secret))
  await expect(f.hook.testCredentials(credentials, context)).rejects.toMatchObject({
    message: invalid,
  })
})

test('removed or cleared account credentials cannot reopen a previously valid certificate', async () => {
  const f = fixture()
  await expect(loadLotwAccount(credentials, context, f.ports)).resolves.toBe(f.signing)
  const clearedCredentials: (Record<string, string> | undefined)[] = [
    undefined,
    {},
    { certificate: '', 'certificate:name': 'W1AW.p12' },
  ]
  for (const cleared of clearedCredentials) {
    await expect(loadLotwAccount(cleared, context, f.ports)).rejects.toThrow(invalid)
  }
  expect(f.ports.loadCertificate).toHaveBeenCalledOnce()
})

test.each(['', 'my-private-backup.p12', 'W1AW\nprivate password', 'w1aw', 'NO-CALL', '1234'])(
  'refuses an invalid certificate identity without falling back to the filename: %s',
  async (callsign) => {
    const f = fixture()
    f.signing.certificate.callsign = callsign
    await expect(f.hook.testCredentials(credentials, context)).rejects.toThrow(invalid)
  },
)
