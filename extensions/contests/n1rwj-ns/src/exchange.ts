import { annotateCallAgainstCountryFile } from '@ham2k/extension-sdk'
import { DXCC_BY_CODE, DXCC_BY_PREFIX, type DXCCEntity } from '@ham2k/lib-dxcc-data'
import { location, PROVINCES, STATES } from '../../../../packages/mini-contest/src/exchange.ts'
import { object, type Qson, refOf, text } from '../../../../packages/mini-contest/src/model.ts'
import { normalizeCall } from '../../../../packages/n1mm/src/callsign.ts'

export const QTH_PATTERN = '(?=[A-Z0-9/]*[A-Z])[A-Z0-9]+(?:/[A-Z0-9]+)*'
const NS_STATES = new Set([...STATES, 'AK', 'HI'])
// NAQP has thirteen Canadian subdivisions. NF and LB are accepted historical
// exchanges but share the Newfoundland and Labrador multiplier, NL.
const canonicalProvince = (value: string) => (['NF', 'LB'].includes(value) ? 'NL' : value)
// NS explicitly adds Trinidad & Tobago, Aruba and the former Netherlands
// Antilles to NAQP. PJ2/PJ4 are its current South American successor entities;
// the other current PJ entities already qualify as North American DXCCs.
const EXTRA_ENTITIES = new Set([90, 91, 517, 520])
const DOMESTIC_ENTITIES = new Set([1, 6, 110, 291])
const PREFIX_ENTITIES: Record<string, DXCCEntity> = Object.fromEntries(
  Object.values(DXCC_BY_CODE)
    .filter((entity) => !entity.deleted)
    .flatMap((entity) => entity.prefixes.map((prefix) => [prefix, entity])),
)

function qthEntity(value: string): DXCCEntity | undefined {
  if (!value) return undefined
  const entity = DXCC_BY_PREFIX[value] ?? PREFIX_ENTITIES[value]
  return entity && !entity.deleted ? entity : undefined
}
function eligibleEntity(entity: DXCCEntity): boolean {
  return (
    entity.continents.includes('NA') ||
    entity.dxccCode === 110 ||
    EXTRA_ENTITIES.has(entity.dxccCode)
  )
}
function stationEntity(their: Qson): DXCCEntity | undefined {
  const guess = object(their.guess)
  const info = annotateCallAgainstCountryFile(text(their.call))
  return (
    (typeof their.dxccCode === 'number' ? DXCC_BY_CODE[their.dxccCode] : undefined) ??
    qthEntity(location(their.entityPrefix)) ??
    (typeof guess.dxccCode === 'number' ? DXCC_BY_CODE[guess.dxccCode] : undefined) ??
    qthEntity(location(guess.entityPrefix)) ??
    (typeof info.dxccCode === 'number' ? DXCC_BY_CODE[info.dxccCode] : undefined)
  )
}
function subdivision(value: string): string | undefined {
  return NS_STATES.has(value)
    ? `state:${value}`
    : PROVINCES.has(value)
      ? `province:${canonicalProvince(value)}`
      : undefined
}
function ambiguousCountry(their: Qson, value: string): DXCCEntity | undefined {
  // HI can be Hawaii or the Dominican Republic; ON can be Ontario or
  // Belgium. A matching station entity disambiguates the country prefix.
  // An explicit host state correction still takes priority over that guess.
  const entity = qthEntity(value)
  return entity &&
    !DOMESTIC_ENTITIES.has(entity.dxccCode) &&
    location(their.state) !== value &&
    stationEntity(their)?.dxccCode === entity.dxccCode
    ? entity
    : undefined
}
export function validQth(value: string): boolean {
  if (NS_STATES.has(value) || PROVINCES.has(value) || value === 'DX') return true
  if (value.length > 10 || !new RegExp(`^(?:${QTH_PATTERN})$`).test(value)) return false
  const entity = qthEntity(value)
  // K/VE alone omit the required state or province. Alaska/Hawaii prefixes
  // are accepted, but suggestions use their exchanged state abbreviations.
  return !!entity && ![1, 291].includes(entity.dxccCode)
}
export function nsMultiplier(qso: Qson, value: string): string | undefined {
  if (/\/(?:MM|AM)$/.test(normalizeCall(text(object(qso.their).call)))) return undefined
  // Exchanged subdivisions take priority over callsign guesses; a portable
  // station may be operating away from its callsign's nominal location.
  const state = subdivision(value)
  if (state) {
    const country = ambiguousCountry(object(qso.their), value)
    return country ? (eligibleEntity(country) ? `dxcc:${country.dxccCode}` : undefined) : state
  }
  if (!value || value === 'DX') return undefined
  const entity = qthEntity(value)
  if (!entity || !eligibleEntity(entity)) return undefined
  if (entity.dxccCode === 6) return 'state:AK'
  if (entity.dxccCode === 110) return 'state:HI'
  return DOMESTIC_ENTITIES.has(entity.dxccCode) ? undefined : `dxcc:${entity.dxccCode}`
}
export function guessedQth(their: Qson): string {
  if (/\/(?:MM|AM)$/.test(normalizeCall(text(their.call)))) return 'DX'
  const guess = object(their.guess)
  const entity = stationEntity(their)
  const state = location(their.state) || location(guess.state)
  if (entity?.dxccCode === 291) return NS_STATES.has(state) ? state : ''
  if (entity?.dxccCode === 1) return PROVINCES.has(state) ? canonicalProvince(state) : ''
  if (entity?.dxccCode === 6) return 'AK'
  if (entity?.dxccCode === 110) return 'HI'
  return entity ? (eligibleEntity(entity) ? entity.entityPrefix : 'DX') : ''
}
export function historyQth(value: string, call: string): string {
  // In the shared N1MM State column these postal codes describe Caribbean
  // stations. On-air country prefixes remain distinct from postal aliases.
  if (value === 'PR' || value === 'VI') {
    const entity = stationEntity({ call })
    if (value === 'PR' && entity?.dxccCode === 202) return 'KP4'
    if (value === 'VI' && entity?.dxccCode === 285) return 'KP2'
  }
  return validQth(value) ? value : ''
}
function northAmericanStation(their: Qson, qth: string): boolean | undefined {
  if (subdivision(qth)) {
    const country = ambiguousCountry(their, qth)
    return country ? eligibleEntity(country) : true
  }
  if (qth === 'DX') return false
  const entity = qth ? qthEntity(qth) : undefined
  if (entity) return eligibleEntity(entity)
  const inferred = stationEntity(their)
  return inferred ? eligibleEntity(inferred) : undefined
}
export function ineligibleReason(qso: Qson, operation: Qson): string | undefined {
  const ours = normalizeCall(text(operation.stationCall))
  const theirs = normalizeCall(text(object(qso.their).call))
  if (ours && ours === theirs) return 'Cannot work your own station'
  if (
    northAmericanStation({ call: ours }, location(refOf(operation, 'ns')?.ourLocation)) === false &&
    northAmericanStation(object(qso.their), location(refOf(qso, 'ns')?.location)) === false
  )
    return 'Contact must include a North American station'
  return undefined
}
