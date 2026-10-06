import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import type { JSONValue } from '@ham2k/extension-sdk'
import type { EvidenceRequest } from '../../src/export/evidence.ts'
import { createEvidenceRetriever } from '../../src/export/history.ts'
import { createRbnExportHook } from '../../src/export/hook.ts'

const start = Date.UTC(2026, 9, 4, 14)
const end = start + 90 * 60_000
const grids: Record<string, string> = {
  'SK-A': 'FN42',
  'SK-B': 'FM19',
  'SK-C': 'EM79',
  'SK-D': 'EM12',
  'SK-E': 'EN52',
  'SK-F': 'DM79',
  'SK-G': 'JO31',
}
const batches: [number, string, [string, number][]][] = [
  [
    2,
    '40m',
    [
      ['SK-A', 24],
      ['SK-B', 19],
      ['SK-C', 13],
      ['SK-E', 10],
    ],
  ],
  [
    12,
    '40m',
    [
      ['SK-A', 22],
      ['SK-B', 20],
      ['SK-C', 14],
    ],
  ],
  [
    17,
    '40m',
    [
      ['SK-A', 25],
      ['SK-B', 21],
      ['SK-C', 16],
      ['SK-E', 12],
    ],
  ],
  [
    27,
    '40m',
    [
      ['SK-A', 23],
      ['SK-B', 18],
      ['SK-C', 15],
    ],
  ],
  [
    47,
    '20m',
    [
      ['SK-C', 18],
      ['SK-D', 16],
      ['SK-F', 9],
      ['SK-G', 1],
    ],
  ],
  [
    57,
    '20m',
    [
      ['SK-C', 20],
      ['SK-D', 18],
      ['SK-F', 11],
      ['SK-G', 2],
    ],
  ],
  [
    62,
    '20m',
    [
      ['SK-C', 19],
      ['SK-D', 17],
      ['SK-F', 12],
      ['SK-G', 3],
    ],
  ],
  [
    72,
    '20m',
    [
      ['SK-C', 21],
      ['SK-D', 19],
      ['SK-F', 14],
      ['SK-G', 2],
    ],
  ],
  [
    77,
    '20m',
    [
      ['SK-C', 20],
      ['SK-D', 20],
      ['SK-F', 13],
      ['SK-G', 4],
    ],
  ],
  [
    87,
    '20m',
    [
      ['SK-C', 18],
      ['SK-D', 22],
      ['SK-F', 15],
      ['SK-G', 3],
    ],
  ],
]
let id = 1000
const rows: Record<string, JSONValue>[] = batches.flatMap(([minute, band, receivers]) =>
  receivers.map(([receiver, snr]) => ({
    id: ++id,
    timestamp: new Date(start + minute * 60_000).toISOString(),
    callsign: 'N1RWJ',
    spotter: receiver,
    spotter_grid: grids[receiver],
    frequency: band === '40m' ? 7060 : 14060,
    mode: 'CW',
    snr,
    wpm: 20,
  })),
)
rows.push({
  id: ++id,
  timestamp: new Date(start + 82 * 60_000).toISOString(),
  callsign: 'N1RWJ',
  spotter: 'UNKNOWN',
  frequency: 14060,
  mode: 'CW',
  snr: null,
  wpm: 20,
})
const qsos: Record<string, JSONValue>[] = [
  {
    uuid: 'demo-qso-1',
    our: { call: 'N1RWJ' },
    their: { call: 'DEMO1', grid: 'FM19' },
    startAtMillis: start + 5 * 60_000,
    freq: 7060,
    band: '40m',
    mode: 'CW',
  },
  {
    uuid: 'demo-qso-2',
    our: { call: 'N1RWJ' },
    their: { call: 'DEMO2', grid: 'EM12' },
    startAtMillis: start + 52 * 60_000,
    freq: 14060,
    band: '20m',
    mode: 'CW',
  },
  {
    uuid: 'demo-qso-3',
    our: { call: 'N1RWJ' },
    their: { call: 'DEMO3', grid: 'JO31' },
    startAtMillis: start + 66 * 60_000,
    freq: 14060,
    band: '20m',
    mode: 'CW',
  },
  {
    uuid: 'demo-qso-4',
    our: { call: 'N1RWJ' },
    their: { call: 'DEMO4' },
    startAtMillis: start + 85 * 60_000,
    freq: 14060,
    band: '20m',
    mode: 'CW',
  },
]

/** Synthetic archives are preloaded before the production export hook reads them. */
export async function generateRbnExportSamples(root: string, destination: string) {
  const output = resolve(root, destination)
  for (const scenario of ['complete', 'partial'] as const) {
    const saved = new Map<string, JSONValue>()
    let timerSequence = 0
    const handles = new Map<number, ReturnType<typeof setTimeout>>()
    const retriever = createEvidenceRetriever({
      now: () => end,
      timers: {
        setTimeout(callback, delay) {
          const id = ++timerSequence
          handles.set(
            id,
            setTimeout(() => {
              handles.delete(id)
              callback()
            }, delay),
          )
          return id
        },
        clearTimeout(id) {
          const handle = handles.get(id)
          if (handle) clearTimeout(handle)
          handles.delete(id)
        },
      },
      storage: {
        read: async (key) => saved.get(key) ?? null,
        write: async (key, value) => {
          saved.set(key, value)
        },
      },
      fetch: async () => {
        if (scenario === 'partial') throw new Error('Synthetic timeout: history unavailable')
        return {
          status: 200,
          body: JSON.stringify({
            spots: [...rows, { ...rows[0], id: 2000, callsign: 'N1RWJ/P' }],
            total: rows.length + 1,
            offset: 0,
            limit: 500,
          }),
        }
      },
    })
    const request: EvidenceRequest = {
      operationId: `synthetic-${scenario}`,
      call: 'N1RWJ',
      startMs: start,
      endMs: end,
      origin: { latitude: 41.0208333333, longitude: -71.9583333333, label: 'FN41aa' },
    }
    for (const minute of [15, 30, 45, 60, 75, 90]) {
      if (scenario === 'partial' && minute > 45) break
      const at = start + minute * 60_000
      const windowStart = at - 15 * 60_000
      const selected = rows.filter((row) => {
        const time = Date.parse(String(row.timestamp))
        return time >= windowStart && time <= at
      })
      await retriever.appendLive(
        { ...request, startMs: windowStart, endMs: at },
        minute === 45
          ? { startedAtMs: at, retrievedAtMs: at, error: 'Synthetic missed visible-panel poll' }
          : {
              startedAtMs: at,
              retrievedAtMs: at,
              status: 200,
              payload: { spots: selected, total: selected.length, offset: 0, limit: 500 },
            },
      )
    }
    // The synthetic fixture explicitly preloads retrospective evidence. The
    // production export hook only reads this saved dataset and never fetches.
    await retriever.retrieveEvidence(request)
    const hook = createRbnExportHook(retriever, () => end)
    const operation = { uuid: request.operationId, stationCall: 'N1RWJ', grid: 'FN41aa' }
    const directory = resolve(output, scenario)
    await mkdir(directory, { recursive: true })
    for (const extension of ['html', 'md', 'csv', 'json', 'svg', 'qso.csv']) {
      const report = await hook.generateExport(
        {
          operation,
          qsos,
          exportType: `rbnReception-${extension}`,
          exportTitle: `SYNTHETIC EXAMPLE — ${scenario === 'complete' ? 'Recovered activation reception' : 'Partial reception evidence'}`,
        },
        { online: true },
      )
      await writeFile(resolve(directory, `reception.${extension}`), report.content)
    }
  }
  await writeFile(
    resolve(output, 'README.md'),
    `# Generated RBN export examples\n\nThese are synthetic observations and contacts, generated by the production export hook from preloaded deterministic archives. They are not a record of N1RWJ's actual activation. Rebuild with \`mise run rbn:export-samples\`.\n\n- [Complete report](complete/reception.html): the fixture preloads a full historical service response, including spots missed by visible polling.\n- [Partial report](partial/reception.html): the fixture retains only early collected observations and a failed historical retrieval; later intervals remain unknown.\n\nHistorical retrieval runs only during fixture preparation. The installed extension exports saved evidence and cached reports without starting a history request. Recording is opt-in and off by default. A complete synthetic archive demonstrates rendering and provenance; it does not claim that visible-panel recording produces complete activations.\n\nEach folder contains HTML, Markdown, individual-observation CSV, collected-evidence JSON, SVG map, and contact-context CSV exports. Unknown receiver location and missing SNR remain in the evidence. DEMO calls identify fictional contacts.\n`,
  )
  console.log(`Generated production RBN export samples in ${output}`)
}
