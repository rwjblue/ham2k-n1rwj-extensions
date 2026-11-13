// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
// PKCS#12 import and LoTW OIDs are adapted from the implementation credited
// in assets/LoTW-SIGNING-NOTICE.txt.
import forge from 'node-forge'
import { maxLotwCertificateBytes } from './account.ts'
import type { LotwCertificate } from './signing.ts'

type Asn1 = forge.asn1.Asn1
type RsaPrivateKey = forge.pki.rsa.PrivateKey
type RsaPublicKey = forge.pki.rsa.PublicKey
type RandomBytes = (length: number) => Promise<Uint8Array>

interface OpenLotwCertificate {
  certificate: LotwCertificate
  signSha1(canonicalAscii: string, randomBytes: RandomBytes): Promise<string>
}

const oid = {
  call: '1.3.6.1.4.1.12348.1.1',
  first: '1.3.6.1.4.1.12348.1.2',
  last: '1.3.6.1.4.1.12348.1.3',
  dxcc: '1.3.6.1.4.1.12348.1.4',
  pbes2: '1.2.840.113549.1.5.13',
  pbkdf2: '1.2.840.113549.1.5.12',
  tripleDes: '1.2.840.113549.1.12.1.3',
  rc2: '1.2.840.113549.1.12.1.6',
}
const maxKdfRounds = 100_000
const maxTotalKdfRounds = 150_000

// These synchronous Forge entry points lack declarations in @types/node-forge.
// The draft pins Forge and keeps this copy inside the extension bundle.
const asn1 = forge.asn1 as typeof forge.asn1 & { maxDepth: number }
const pbe = (
  forge.pki as typeof forge.pki & {
    pbe: { getCipher(algorithm: string, params: Asn1, password: string): unknown }
  }
).pbe

function binary(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
}

function parseDer(input: string): Asn1 {
  const buffer = forge.util.createBuffer(input)
  const result = asn1.fromDer(buffer, true)
  if (buffer.length()) throw new Error('Trailing ASN.1 bytes')
  return result
}

function children(node: Asn1 | undefined): Asn1[] {
  return Array.isArray(node?.value) ? node.value : []
}

function readOid(node: Asn1 | undefined): string {
  return node?.type === asn1.Type.OID && typeof node.value === 'string'
    ? asn1.derToOid(node.value)
    : ''
}

function kdfRounds(rounds: Asn1 | undefined, salt: Asn1 | undefined): number {
  if (
    salt?.type !== asn1.Type.OCTETSTRING ||
    typeof salt.value !== 'string' ||
    salt.value.length < 1 ||
    salt.value.length > 1024 ||
    rounds?.type !== asn1.Type.INTEGER ||
    typeof rounds.value !== 'string' ||
    rounds.value.length < 1 ||
    rounds.value.length > 4 ||
    rounds.value.charCodeAt(0) >= 128
  ) {
    throw new Error('Unsupported certificate password derivation parameters')
  }
  let count = 0
  for (const char of rounds.value) count = count * 256 + char.charCodeAt(0)
  if (count < 1 || count > maxKdfRounds) {
    throw new Error('Certificate password derivation exceeds the work limit')
  }
  return count
}

function readContainer(input: Uint8Array, password: string): forge.pkcs12.Pkcs12Pfx {
  if (!input.length || input.length > maxLotwCertificateBytes || password.length > 1024) {
    throw new Error('Certificate backup exceeds the size limit')
  }
  const originalCipher = pbe.getCipher
  const originalDepth = asn1.maxDepth
  try {
    asn1.maxDepth = 32
    const root = parseDer(binary(input))
    const mac = children(children(root)[2])
    const macOid = readOid(children(children(mac[0])[0])[0])
    if (!['sha1', 'sha256', 'sha384', 'sha512'].some((name) => macOid === forge.pki.oids[name])) {
      throw new Error('Certificate backup requires a supported integrity MAC')
    }
    let spent = kdfRounds(
      mac[2] ?? asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\x01'),
      mac[1],
    )
    // Check every decryption before Forge enters its synchronous KDF.
    // Bag parameters can themselves be inside an encrypted safe.
    pbe.getCipher = (algorithm, params, secret) => {
      const fields = children(params)
      if (algorithm === oid.pbes2) {
        const kdf = children(fields[0])
        if (readOid(kdf[0]) !== oid.pbkdf2) {
          throw new Error('Unsupported certificate password derivation')
        }
        const [salt, rounds] = children(kdf[1])
        spent += 2 * kdfRounds(rounds, salt)
      } else if (algorithm === oid.tripleDes || algorithm === oid.rc2) {
        const [salt, rounds] = fields
        spent += 3 * kdfRounds(rounds, salt)
      } else {
        throw new Error('Unsupported certificate backup encryption')
      }
      if (spent > maxTotalKdfRounds) {
        throw new Error('Certificate password derivation exceeds the work limit')
      }
      return originalCipher(algorithm, params, secret)
    }
    return forge.pkcs12.pkcs12FromAsn1(root, true, password)
  } finally {
    pbe.getCipher = originalCipher
    asn1.maxDepth = originalDepth
  }
}

function checkPrivateKey(key: RsaPrivateKey): void {
  const { n, e, d, p, q, dP, dQ, qInv } = key
  const bits = n.bitLength()
  const one = forge.jsbn.BigInteger.ONE
  if (
    bits < 1024 ||
    bits > 4096 ||
    [n, e, d, p, q, dP, dQ, qInv].some((part) => part.signum() <= 0 || part.bitLength() > bits) ||
    e.compareTo(one) <= 0 ||
    e.bitLength() > 32 ||
    !e.testBit(0) ||
    p.equals(q) ||
    Math.abs(p.bitLength() - q.bitLength()) > 1 ||
    !p.multiply(q).equals(n)
  ) {
    throw new Error('Unsupported RSA private key')
  }
  const p1 = p.subtract(one)
  const q1 = q.subtract(one)
  const ed = e.multiply(d)
  if (
    !d.mod(p1).equals(dP) ||
    !d.mod(q1).equals(dQ) ||
    !ed.mod(p1).equals(one) ||
    !ed.mod(q1).equals(one) ||
    !q.multiply(qInv).mod(p).equals(one)
  ) {
    throw new Error('Invalid RSA private key')
  }
}

function authorizationValue(certificate: forge.pki.Certificate, id: string): string | undefined {
  const values = certificate.extensions.filter((entry) => entry.id === id)
  if (!values.length) return undefined
  const value: unknown = values[0].value
  if (values.length !== 1 || typeof value !== 'string' || value.length > 32) {
    throw new Error('Invalid certificate authorization')
  }
  // TQSL uses raw text. Some certificate producers wrap the text as DER.
  if (/^(?:\d{1,3}|\d{4}-\d{2}-\d{2})$/.test(value)) return value
  const decoded = parseDer(value)
  if (
    decoded.tagClass !== asn1.Class.UNIVERSAL ||
    decoded.constructed ||
    ![asn1.Type.UTF8, asn1.Type.PRINTABLESTRING, asn1.Type.IA5STRING].includes(decoded.type) ||
    typeof decoded.value !== 'string'
  ) {
    throw new Error('Invalid certificate authorization')
  }
  return decoded.value
}

function authorizationDate(value: string | undefined): string {
  const millis = value ? Date.parse(`${value}T00:00:00Z`) : NaN
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(millis) ||
    new Date(millis).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Invalid certificate QSO date authorization')
  }
  return value
}

async function signSha1(
  key: RsaPrivateKey,
  publicKey: RsaPublicKey,
  canonicalAscii: string,
  randomBytes: RandomBytes,
): Promise<string> {
  if (!/^[\x20-\x7e]{1,1024}$/.test(canonicalAscii)) {
    throw new Error('Invalid LoTW signing data')
  }
  const seed = await randomBytes(1024)
  if (!(seed instanceof Uint8Array) || seed.byteLength !== 1024) {
    throw new Error('Secure randomness is unavailable for LoTW signing')
  }
  const prng = forge.random.createInstance() as ReturnType<typeof forge.random.createInstance> &
    Pick<typeof forge.random, 'getBytesSync'>
  let seedUsed = false
  prng.seedFileSync = (needed) => {
    if (seedUsed || needed !== seed.byteLength) {
      throw new Error('LoTW signer exhausted its secure seed')
    }
    seedUsed = true
    return binary(seed)
  }
  const width = Math.floor(key.n.bitLength() / 8)
  const candidates = prng.getBytesSync(64 * width)
  const originalGetBytes = forge.random.getBytes
  const digest = forge.md.sha1.create()
  digest.update(canonicalAscii)
  let offset = 0
  // Forge's private RSA operation obtains blinding factors through its
  // synchronous getBytes call. The override stays in this bundle and contains
  // no await, so it cannot overlap another signer or use ambient entropy.
  let signature: string
  try {
    forge.random.getBytes = (requested, callback) => {
      if (callback || Math.floor(requested) !== width || offset + width > candidates.length) {
        throw new Error('LoTW signer exhausted its secure blinding bytes')
      }
      const result = candidates.slice(offset, offset + width)
      offset += width
      return result
    }
    signature = key.sign(digest)
  } finally {
    forge.random.getBytes = originalGetBytes
  }
  if (offset === 0 || !publicKey.verify(digest.digest().getBytes(), signature)) {
    throw new Error('LoTW signature failed verification')
  }
  return forge.util.encode64(signature)
}

/** Open a backup and hold its private key only in the returned signing capability. */
export function openLotwCertificate(input: Uint8Array, password: string): OpenLotwCertificate {
  const p12 = readContainer(input, password)
  const bags = (type: string) => p12.getBags({ bagType: type })[type] ?? []
  const keys = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)]
  const key = keys[0]?.key
  if (keys.length !== 1 || !key) throw new Error('Exactly one RSA private key is required')
  checkPrivateKey(key)

  const certificates = bags(forge.pki.oids.certBag)
  if (certificates.length > 8) throw new Error('Certificate chain exceeds the size limit')
  const matching = certificates
    .flatMap((bag) => (bag.cert ? [bag.cert] : []))
    .filter(
      (cert) =>
        'n' in cert.publicKey && cert.publicKey.n.equals(key.n) && cert.publicKey.e.equals(key.e),
    )
  if (matching.length !== 1) throw new Error('Certificate and private key must match uniquely')
  const cert = matching[0]
  const publicKey = cert.publicKey
  if (!('n' in publicKey)) throw new Error('RSA public key is required')
  const usage = cert.getExtension('keyUsage')
  if (usage && (!('digitalSignature' in usage) || usage.digitalSignature !== true)) {
    throw new Error('Certificate is unsuitable for signing')
  }
  const constraints = cert.getExtension('basicConstraints')
  if (constraints && 'cA' in constraints && constraints.cA === true) {
    throw new Error('A LoTW callsign certificate is required')
  }
  const names = cert.subject.attributes.filter((attribute) => attribute.type === oid.call)
  const call = names[0]?.value
  const callsign = names.length === 1 && typeof call === 'string' ? call.toUpperCase() : ''
  const dxccText = authorizationValue(cert, oid.dxcc)
  const dxcc = dxccText && /^\d{1,3}$/.test(dxccText) ? Number(dxccText) : NaN
  if (
    callsign.length < 3 ||
    callsign.length > 20 ||
    !/^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/.test(callsign) ||
    !/[A-Z]/.test(callsign) ||
    !/\d/.test(callsign) ||
    callsign.startsWith('0') ||
    (callsign.startsWith('1') && !/^1[AMS]/.test(callsign)) ||
    !Number.isInteger(dxcc) ||
    dxcc < 1 ||
    dxcc > 522
  ) {
    throw new Error('LoTW callsign or DXCC authorization is missing')
  }
  const qsoFrom = authorizationDate(authorizationValue(cert, oid.first))
  const last = authorizationValue(cert, oid.last)
  const qsoTo = last === undefined ? undefined : authorizationDate(last)
  const validFromMillis = cert.validity.notBefore.getTime()
  const validToMillis = cert.validity.notAfter.getTime()
  if (
    (qsoTo && qsoTo < qsoFrom) ||
    !Number.isFinite(validFromMillis) ||
    !Number.isFinite(validToMillis) ||
    validFromMillis > validToMillis
  ) {
    throw new Error('Invalid certificate date authorization')
  }
  if (!/^[\da-f]{1,40}$/i.test(cert.serialNumber)) {
    throw new Error('Invalid certificate serial number')
  }
  const serial = BigInt(`0x${cert.serialNumber}`).toString()
  if (serial === '0') throw new Error('Invalid certificate serial number')
  const der = asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  return {
    certificate: {
      derBase64: forge.util.encode64(der),
      serial,
      callsign,
      dxcc,
      validFromMillis,
      validToMillis,
      qsoFrom,
      ...(qsoTo === undefined ? {} : { qsoTo }),
    },
    signSha1: (canonicalAscii, randomBytes) =>
      signSha1(key, publicKey, canonicalAscii, randomBytes),
  }
}
