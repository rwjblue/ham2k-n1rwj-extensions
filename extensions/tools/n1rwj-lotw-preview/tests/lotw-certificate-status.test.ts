import { describe, expect, it, vi } from 'vitest'
import { checkLotwCertificateStatus } from '../src/lotw/certificate-status.ts'
import type { LotwHostPorts } from '../src/lotw/host.ts'

const serial = '12345678901234567890'
const reply = (status: string, echoedSerial = serial) =>
  `<LoTW_CRL>\n  <Serial>${echoedSerial}</Serial>\n  <Status>${status}</Status>\n</LoTW_CRL>\n`

function fakeFetch(body: string, status = 200) {
  return vi.fn<LotwHostPorts['fetch']>().mockResolvedValue({ status, body })
}

describe('LoTW certificate status', () => {
  it('fetches only the decimal certificate serial and accepts a matching unrevoked reply', async () => {
    const fetch = fakeFetch(reply('Unrevoked'))
    await expect(checkLotwCertificateStatus(serial, fetch)).resolves.toBe('unrevoked')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://lotw.arrl.org/lotw/crl?serial=${serial}`,
      {
        method: 'GET',
        redirect: 'error',
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 5_000,
      },
    )
  })

  it.each([
    ['Revoked', 'revoked'],
    ['Superceded', 'superseded'],
    ['Superseded', 'superseded'],
  ])('handles LoTW status %s', async (status, expected) => {
    const fetch = fakeFetch(reply(status))
    await expect(checkLotwCertificateStatus(serial, fetch)).resolves.toBe(expected)
  })

  it.each(['', '0', '01', '-1', '7&serial=8', '0x12', '9'.repeat(51)])(
    'does not send invalid serial %s',
    async (invalid) => {
      const fetch = fakeFetch(reply('Unrevoked'))
      await expect(checkLotwCertificateStatus(invalid, fetch)).resolves.toBe('unknown')
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['different serial', reply('Unrevoked', '9')],
    ['unknown status', reply('Bad serial')],
    ['HTML wrapper', `<html>${reply('Unrevoked')}</html>`],
    ['duplicate reply', reply('Unrevoked') + reply('Revoked')],
    ['duplicate status', reply('Unrevoked</Status><Status>Revoked')],
    ['oversized reply', reply('Unrevoked') + ' '.repeat(16_384)],
    ['missing serial', '<LoTW_CRL><Status>Unrevoked</Status></LoTW_CRL>'],
  ])('does not trust a %s', async (_description, body) => {
    await expect(checkLotwCertificateStatus(serial, fakeFetch(body))).resolves.toBe('unknown')
  })

  it.each([206, 302, 401, 500])('does not trust a %s response', async (status) => {
    const fetch = fakeFetch(reply('Unrevoked'), status)
    await expect(checkLotwCertificateStatus(serial, fetch)).resolves.toBe('unknown')
  })

  it('returns unknown after a refused or unavailable request', async () => {
    const fetch = vi.fn<LotwHostPorts['fetch']>().mockRejectedValue(new Error(serial))
    await expect(checkLotwCertificateStatus(serial, fetch)).resolves.toBe('unknown')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
