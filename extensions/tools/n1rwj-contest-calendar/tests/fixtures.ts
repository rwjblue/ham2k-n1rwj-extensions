// Minimal records following ContestClock /api/contests, checked 2026-10-07.
// Catalog data: Joseph Leone (W4GGJ), CC BY 4.0, https://contestclock.com/data.
export const NOW = Date.parse('2026-10-07T12:00:00Z')

export function occurrence(overrides: Record<string, unknown> = {}) {
  return {
    contest_id: 'cwops-cwt',
    uid: 'cwops-cwt-20261007T1300@contestcal',
    name: 'CWops Test (CWT)',
    start: '2026-10-07T13:00:00Z',
    end: '2026-10-07T14:00:00Z',
    start_wall: null,
    end_wall: null,
    local_rolling: false,
    modes: ['CW'],
    rules_url: 'https://cwops.org/cwops-tests/',
    verified: true,
    ...overrides,
  }
}

export function payload(rows: unknown[] = [occurrence()], query: Record<string, unknown> = {}) {
  return JSON.stringify({
    query: {
      kind: 'default',
      from: new Date(NOW).toISOString(),
      to: new Date(NOW + 30 * 24 * 60 * 60_000).toISOString(),
      filters: [],
      ...query,
    },
    count: rows.length,
    occurrences: rows,
  })
}
