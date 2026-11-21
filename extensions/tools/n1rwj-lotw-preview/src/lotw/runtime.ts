// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type HookContext, host as sdkHost } from '@ham2k/extension-sdk'
import { gzipSync, strToU8 } from 'fflate/browser'
import { LotwAccountProblem, readLotwAccountCredentials } from './account.ts'
import { openLotwCertificate } from './certificate.ts'
import { checkLotwCertificateStatus } from './certificate-status.ts'
import { createLotwConnection } from './connection.ts'
import type { LotwHostPorts } from './host.ts'
import type { LotwCertificate } from './signing.ts'

function checkCertificateDates(
  certificate: Pick<LotwCertificate, 'validFromMillis' | 'validToMillis'>,
  now: number,
): void {
  if (
    !Number.isFinite(now) ||
    now < certificate.validFromMillis ||
    now > certificate.validToMillis
  ) {
    throw new LotwAccountProblem('validity')
  }
}

function requireStoredCertificate(ctx: HookContext): Record<string, string> {
  const credentials = ctx.account?.credentials
  if (!credentials?.certificate) throw new LotwAccountProblem('missing')
  return credentials
}

export function createLotwRuntimeConnection({
  host = sdkHost,
  realNowMillis = Date.now,
}: {
  host?: LotwHostPorts
  realNowMillis?: () => number
} = {}) {
  const connection = createLotwConnection({
    host,
    realNowMillis,
    async loadCertificate(p12, password, _ctx, randomBytes) {
      const opened = openLotwCertificate(p12, password)
      checkCertificateDates(opened.certificate, realNowMillis())
      return {
        certificate: opened.certificate,
        signSha1: (text) => opened.signSha1(text, randomBytes),
        async gzip(text) {
          return gzipSync(strToU8(text), { mtime: 0 })
        },
      }
    },
    async checkCertificateStatus(serial, ctx) {
      if (!ctx.online) return 'unknown'
      return checkLotwCertificateStatus(serial, (url, options) => host.fetch(url, options))
    },
  })
  return {
    account: connection.account,
    stationCall(ctx: HookContext) {
      // Resolve the callsign locally as Exports refreshes. Only Account Test
      // requests certificate status from LoTW.
      const { p12, password } = readLotwAccountCredentials(requireStoredCertificate(ctx))
      let opened: ReturnType<typeof openLotwCertificate>
      try {
        opened = openLotwCertificate(p12, password)
      } catch {
        throw new Error('Could not open the LoTW certificate. Check the file and its password.')
      }
      checkCertificateDates(opened.certificate, realNowMillis())
      return opened.certificate.callsign
    },
    async connect(ctx: HookContext) {
      requireStoredCertificate(ctx)
      return connection.connect(ctx)
    },
  }
}
