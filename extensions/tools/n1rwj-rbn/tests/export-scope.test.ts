import { describe, expect, it } from 'vitest'
import { receptionScope } from '../src/export/scope.ts'

const time = Date.UTC(2026, 9, 4, 14)
const operation = { uuid: 'operation', stationCall: 'N1RWJ', grid: 'FN41aa' }
describe('reception export interval', () => {
  it('uses actual dated contacts with margins and ignores deleted, future, and other-station contacts', () => {
    const scope = receptionScope(
      operation,
      [
        { our: { call: 'N1RWJ' }, startAtMillis: time, endAtMillis: time + 60_000 },
        { our: { call: 'N1RWJ/P' }, startAtMillis: time - 3600_000 },
        { deleted: true, startAtMillis: time - 7200_000 },
        { startAtMillis: time + 7200_000 },
      ],
      time + 3600_000,
    )
    if (!scope) throw new Error('Missing reception scope')
    expect(scope.request).toMatchObject({
      operationId: 'operation',
      call: 'N1RWJ',
      startMs: time - 300_000,
      endMs: time + 360_000,
    })
    expect(scope.warnings.join(' ')).toContain('does not identify when CQ was called')
  })
  it('does not invent dates for empty operations', () => {
    expect(receptionScope(operation, [], time)).toBeNull()
    expect(
      receptionScope({ ...operation, stationCall: '' }, [{ startAtMillis: time }], time),
    ).toBeNull()
  })
  it('omits one misleading transmitter position when operation segments moved', () => {
    const scope = receptionScope(operation, [{ startAtMillis: time }], time + 600_000, null, [
      { fromMillis: time, operation: { ...operation, grid: 'EM12' } },
    ])
    if (!scope) throw new Error('Missing reception scope')
    expect(scope.request.origin).toBeUndefined()
    expect(scope.warnings.join(' ')).toContain('different locations')
  })
})
