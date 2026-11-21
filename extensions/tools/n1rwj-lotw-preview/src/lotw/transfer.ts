// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import {
  type DestinationsRequest,
  entityForCall,
  type HookContext,
  isTestOperation,
  type PushRecord,
  type PushRequest,
  type PushSuggestionsRequest,
  type TransferHook,
} from '@ham2k/extension-sdk'
import { readTransferAdif } from './adif.ts'
import { lotwScopeSelection } from './scopes.ts'
import {
  buildSignedTq8,
  type LotwContact,
  type LotwSigningPort,
  type LotwStation,
} from './signing.ts'
import { type LotwUploadTransport, uploadLotwTq8 } from './upload.ts'

export interface LotwTransferConnection {
  signing: LotwSigningPort
  transport: LotwUploadTransport
  realNowMillis(): number
}

export interface LotwTransferPorts {
  // Resolve the native account and supported transport before doing any
  // work. The extension must not substitute preferences or a text body for
  // missing secure credentials or binary host APIs.
  connect(ctx: HookContext): Promise<LotwTransferConnection>
  stationCall?(ctx: HookContext): string
  elapsedNowMillis?(): number
}

interface PreparedContact {
  station: LotwStation
  contact: LotwContact
}

const service = 'lotw'
const chunkSize = 25
// Core stops a chunk at 60 seconds. Keep time for its bridge and write-back,
// and shorten each HTTP timeout as this chunk spends its own budget.
const pushBudgetMillis = 45_000
const invalid = 'Could not prepare the contacts for LoTW. Check their station and log data.'

function required(fields: Record<string, string>, key: string): string {
  const value = fields[key]?.trim().toUpperCase()
  if (!value) throw new Error(invalid)
  return value
}

function optional(fields: Record<string, string>, key: string): string | undefined {
  return fields[key] === undefined ? undefined : required(fields, key)
}

function integer(fields: Record<string, string>, key: string): number {
  const value = required(fields, key)
  if (!/^\d{1,3}$/.test(value)) throw new Error(invalid)
  return Number(value)
}

function optionalInteger(fields: Record<string, string>, key: string): number | undefined {
  return fields[key] === undefined ? undefined : integer(fields, key)
}

function prepareAdif(uuid: string, input: string, stationCall: string): PreparedContact {
  const fields = readTransferAdif(input)
  // HaLo's exporter writes UNKNOWN when Chasing or Logs supplies a contact
  // without an operation. TransferService already selected and supplied
  // the destination callsign, and verifyDestination checked its certificate.
  const unknownStationCall = fields.STATION_CALLSIGN === 'UNKNOWN'
  const call = unknownStationCall ? stationCall : required(fields, 'STATION_CALLSIGN')
  const grid = required(fields, 'MY_GRIDSQUARE')
  const state = optional(fields, 'MY_STATE')
  const qualifiedCounty = optional(fields, 'MY_CNTY')
  if (
    call !== stationCall ||
    !/^[A-R]{2}\d{2}(?:[A-X]{2}(?:\d{2})?)?$/.test(grid) ||
    grid === 'AA00' ||
    grid.startsWith('AA00AA')
  ) {
    throw new Error(invalid)
  }
  // Restore only the call-derived DXCC field HaLo's exporter would supply.
  // Preserve the logged entity when present so signing checks it against the certificate.
  const dxcc =
    unknownStationCall && fields.MY_DXCC === undefined
      ? entityForCall(stationCall).dxccCode
      : integer(fields, 'MY_DXCC')
  if (dxcc === undefined) throw new Error(invalid)
  let county: string | undefined
  if (qualifiedCounty !== undefined) {
    const parts = qualifiedCounty.split(',').map((part) => part.trim())
    if (!state || parts.length !== 2 || parts[0] !== state || !parts[1]) {
      throw new Error(invalid)
    }
    county = parts[1]
  }
  const date = required(fields, 'QSO_DATE')
  const time = required(fields, 'TIME_ON')
  // The core exporter supplies UTC seconds. Do not invent seconds from a
  // four-digit ADIF time, or sign a different contact from the one supplied.
  if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(time)) throw new Error(invalid)
  return {
    station: {
      callsign: call,
      dxcc,
      grid,
      ...(state === undefined ? {} : { state }),
      ...(county === undefined ? {} : { county }),
      ...(fields.MY_CQ_ZONE === undefined ? {} : { cqZone: optionalInteger(fields, 'MY_CQ_ZONE') }),
      ...(fields.MY_ITU_ZONE === undefined
        ? {}
        : { ituZone: optionalInteger(fields, 'MY_ITU_ZONE') }),
      ...(fields.MY_IOTA === undefined ? {} : { iota: optional(fields, 'MY_IOTA') }),
    },
    contact: {
      id: uuid,
      call: required(fields, 'CALL'),
      band: required(fields, 'BAND'),
      mode: required(fields, 'MODE'),
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      time: `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`,
      ...(fields.SUBMODE === undefined ? {} : { submode: optional(fields, 'SUBMODE') }),
      ...(fields.FREQ === undefined ? {} : { frequencyMHz: optional(fields, 'FREQ') }),
      ...(fields.BAND_RX === undefined ? {} : { bandRx: optional(fields, 'BAND_RX') }),
      ...(fields.FREQ_RX === undefined ? {} : { frequencyRxMHz: optional(fields, 'FREQ_RX') }),
      ...(fields.PROP_MODE === undefined ? {} : { propagation: optional(fields, 'PROP_MODE') }),
      ...(fields.SAT_NAME === undefined ? {} : { satellite: optional(fields, 'SAT_NAME') }),
    },
  }
}

function prepareRecord(record: PushRecord, stationCall: string): PreparedContact {
  if (
    !record.uuid ||
    record.deleted ||
    !Array.isArray(record.adif) ||
    record.adif.length === 0 ||
    record.adif.length > 25
  ) {
    throw new Error(invalid)
  }
  const entries = record.adif.map((adif) => prepareAdif(record.uuid, adif, stationCall))
  const first = entries[0]
  // Program exports may repeat one contact for several references. LoTW
  // receives that contact once; every signed field must agree across them.
  if (entries.some((entry) => JSON.stringify(entry) !== JSON.stringify(first))) {
    throw new Error(invalid)
  }
  return first
}

function verifyDestination(request: PushRequest, connection: LotwTransferConnection): string {
  const stationCall = connection.signing.certificate.callsign
  if (
    request.service !== service ||
    request.stationCall !== stationCall ||
    request.destination.stationCall !== stationCall ||
    request.destination.id !== stationCall.toLowerCase() ||
    isTestOperation(stationCall)
  ) {
    throw new Error('The LoTW destination must match the certificate’s station callsign.')
  }
  return stationCall
}

/** Upload-only transfer: core owns selection, ADIF, receipt writes and progress. */
export function createLotwTransferHook(ports: LotwTransferPorts) {
  let active = false
  const elapsedNowMillis = ports.elapsedNowMillis ?? (() => performance.now())
  return {
    label: 'Logbook of the World',
    description: 'Send contacts to LoTW’s processing queue.',
    services: [{ key: service, label: 'Logbook of the World' }],
    async suggestPushes({ scope }: PushSuggestionsRequest, _ctx: HookContext) {
      if (lotwScopeSelection(scope) === null) return []
      return [
        {
          key: service,
          service,
          label: 'Push to LoTW',
          select: { notSentTo: service },
          payload: { full: true, includePrivateData: false, omit: ['app_*', 'notes', 'comment'] },
        },
      ]
    },
    async suggestDestinations(
      { service: requestedService, scope, stationCalls }: DestinationsRequest,
      ctx: HookContext,
    ) {
      const selection = lotwScopeSelection(scope)
      if (requestedService !== service || selection === null) return []
      const call = ports.stationCall
        ? ports.stationCall(ctx)
        : (await ports.connect(ctx)).signing.certificate.callsign
      return stationCalls.includes(call) &&
        !isTestOperation(call) &&
        (selection.stationCall === undefined || selection.stationCall === call)
        ? [{ id: call.toLowerCase(), label: call, stationCall: call }]
        : []
    },
    async push(request, ctx) {
      if (active) throw new Error('A LoTW upload is already running.')
      if (!ctx.online) throw new Error('Connect to the internet before uploading to LoTW.')
      active = true
      try {
        const started = elapsedNowMillis()
        const connection = await ports.connect(ctx)
        const stationCall = verifyDestination(request, connection)
        const seen = new Set<string>()
        if (request.records.length > chunkSize) throw new Error(invalid)
        let prepared: PreparedContact[]
        try {
          prepared = request.records.map((record) => {
            if (seen.has(record.uuid)) throw new Error(invalid)
            seen.add(record.uuid)
            return prepareRecord(record, stationCall)
          })
        } catch {
          throw new Error(invalid)
        }
        const groups: { station: LotwStation; contacts: LotwContact[] }[] = []
        for (const { station, contact } of prepared) {
          const previous = groups[groups.length - 1]
          if (previous && JSON.stringify(previous.station) === JSON.stringify(station)) {
            previous.contacts.push(contact)
          } else {
            groups.push({ station, contacts: [contact] })
          }
        }
        // Validate and sign the complete host chunk before the first upload,
        // so an invalid later location cannot cause a partly sent chunk.
        const files: Uint8Array[] = []
        try {
          for (const { station, contacts } of groups) {
            files.push(
              await buildSignedTq8(
                connection.signing,
                station,
                contacts,
                connection.realNowMillis(),
              ),
            )
          }
        } catch {
          throw new Error(
            'Could not sign the contacts for LoTW. Check the certificate and log data.',
          )
        }
        const transport: LotwUploadTransport = (request) => {
          const remaining = pushBudgetMillis - (elapsedNowMillis() - started)
          if (!Number.isFinite(remaining) || remaining <= 0 || remaining > pushBudgetMillis)
            throw new Error('LoTW upload time budget exceeded')
          return connection.transport({ ...request, timeout: Math.min(request.timeout, remaining) })
        }
        for (const file of files) {
          const result = await uploadLotwTq8(file, transport)
          if (result.state !== 'queued') {
            // Throwing stops core from sending later chunks. Core deliberately
            // records no receipts for this chunk, including any earlier
            // accepted location batches; an operator retry can replay them.
            throw new Error(
              result.state === 'rejected'
                ? 'LoTW refused the upload. Check the certificate in HaLo’s LoTW account settings and review the contacts before trying again.'
                : 'LoTW did not acknowledge the upload. Check Your Account → Your Activity in LoTW before retrying.',
            )
          }
        }
        // This is queue acceptance, not QSL confirmation. LoTW issues no
        // per-contact id; core records the time/hash/revision under transfer.
        return request.records.map(({ uuid }) => ({ uuid }))
      } finally {
        active = false
      }
    },
  } satisfies TransferHook
}
