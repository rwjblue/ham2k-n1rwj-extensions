import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import forge from 'node-forge'
import { describe, expect, it, vi } from 'vitest'
import { openLotwCertificate } from '../src/lotw/certificate.ts'
import vector from './fixtures/lotw/vector.json'

const fixturePassword = 'ferry-fixture'
const fixture = (format: string) =>
  Uint8Array.from(readFileSync(new URL(`./fixtures/lotw/synthetic-${format}.p12`, import.meta.url)))

describe('TrustedQSL certificate backups', () => {
  it.each(['legacy', 'current'])(
    'matches the OpenSSL signature for a %s backup',
    async (format) => {
      const opened = openLotwCertificate(fixture(format), fixturePassword)
      const randomBytes = vi.fn(async (size: number) =>
        Uint8Array.from({ length: size }, (_, index) => index % 256),
      )
      const originalRandom = forge.random.getBytes
      const certificate = new X509Certificate(
        readFileSync(new URL('./fixtures/lotw/certificate.pem', import.meta.url)),
      )
      expect(opened.certificate).toMatchObject({
        serial: BigInt(`0x${certificate.serialNumber}`).toString(),
        callsign: 'W1AW',
        dxcc: 291,
        derBase64: certificate.raw.toString('base64'),
      })
      await expect(opened.signSha1(vector.canonical, randomBytes)).resolves.toBe(
        vector.signatureBase64,
      )
      expect(randomBytes).toHaveBeenCalledExactlyOnceWith(1024)
      expect(forge.random.getBytes).toBe(originalRandom)
    },
  )

  it('cannot sign with missing or short host entropy', async () => {
    const opened = openLotwCertificate(fixture('current'), fixturePassword)
    await expect(opened.signSha1(vector.canonical, async () => new Uint8Array(31))).rejects.toThrow(
      'Secure randomness is unavailable',
    )
    await expect(
      opened.signSha1(vector.canonical, async () => {
        throw new Error('Host randomness refused')
      }),
    ).rejects.toThrow('Host randomness refused')
  })

  it('rejects the wrong password, excessive size, and data after the P12', () => {
    const original = fixture('current')
    expect(() => openLotwCertificate(original, 'wrong password')).toThrow()
    expect(() => openLotwCertificate(new Uint8Array(65_537), fixturePassword)).toThrow('size limit')
    const padded = new Uint8Array(original.length + 1)
    padded.set(original)
    expect(() => openLotwCertificate(padded, fixturePassword)).toThrow()
  })

  it('bounds the MAC work before entering the password derivation', () => {
    const root = forge.asn1.fromDer(Buffer.from(fixture('current')).toString('binary'))
    if (typeof root.value === 'string') throw new Error('Invalid test fixture')
    const mac = root.value[2]
    if (typeof mac.value === 'string') throw new Error('Invalid test fixture')
    mac.value[2] = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.INTEGER,
      false,
      '\x01\x86\xa1', // 100,001 rounds
    )
    const input = Uint8Array.from(Buffer.from(forge.asn1.toDer(root).getBytes(), 'binary'))
    expect(() => openLotwCertificate(input, fixturePassword)).toThrow(
      'derivation exceeds the work limit',
    )
  })
})
