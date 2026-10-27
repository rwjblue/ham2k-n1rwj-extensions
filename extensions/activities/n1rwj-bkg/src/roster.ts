// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { type Member, normalizeCall, object, type Roster } from './model.ts'

function field(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid BKG ${name}`)
  return value.trim()
}

/** Consume the club's public v2 contract, projecting away photos/map data. */
export function parseRoster(body: string, downloadedAt: number): Roster {
  if (!body || body.length > 8_000_000) throw new Error('Invalid BKG roster size')
  if (
    !Number.isSafeInteger(downloadedAt) ||
    downloadedAt < 0 ||
    downloadedAt > 8_640_000_000_000_000
  )
    throw new Error('Invalid BKG download time')
  const value = object(JSON.parse(body))
  if (value.schema_version !== '2') throw new Error('Unsupported BKG roster version')
  const generatedAt = typeof value.generated_at === 'string' ? Date.parse(value.generated_at) : NaN
  if (!Number.isFinite(generatedAt) || !/^sha256:[a-f0-9]{64}$/.test(String(value.content_hash)))
    throw new Error('Invalid BKG roster metadata')
  if (!Array.isArray(value.members) || !value.members.length || value.members.length > 100_000)
    throw new Error('Invalid BKG member list')
  const members: Member[] = []
  const byCall = new Map<string, Member>()
  const byNumber = new Map<number, Member>()
  for (const raw of value.members) {
    const entry = object(raw)
    const number = entry.bkg_number
    const call = normalizeCall(field(entry.callsign, 'callsign', 32))
    const sponsor = entry.sponsor_bkg_number
    if (
      typeof number !== 'number' ||
      !Number.isSafeInteger(number) ||
      number < 1 ||
      // Historical published rows can contain a letter O in place of zero.
      // Retain the exact source identity without guessing a correction, and
      // do not discard the entire roster because that row lacks a digit.
      !/^(?=.*[A-Z])[A-Z\d]+$/.test(call) ||
      byCall.has(call) ||
      byNumber.has(number) ||
      !(
        sponsor === null ||
        (typeof sponsor === 'number' && Number.isSafeInteger(sponsor) && sponsor > 0)
      )
    )
      throw new Error('Invalid or duplicate BKG identity')
    const member: Member = {
      number,
      call,
      name: field(entry.name, 'name', 120),
      qth: field(entry.qth, 'QTH', 120),
      sponsor,
    }
    members.push(member)
    byCall.set(call, member)
    byNumber.set(number, member)
  }
  if (members.some((member) => member.sponsor !== null && !byNumber.has(member.sponsor)))
    throw new Error('Unknown BKG sponsor')
  return {
    members,
    byCall,
    byNumber,
    revision: String(value.content_hash),
    generatedAt,
    downloadedAt,
  }
}
