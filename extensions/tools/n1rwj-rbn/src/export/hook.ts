import type { ExportHook, ExportOptionsRequest, ExportRequest } from '@ham2k/extension-sdk'
import { exportFilename, exportQso, startMillisOf } from '@ham2k/extension-sdk'
import { watchedCall } from '../config.ts'
import type { RbnClient } from '../data/client.ts'
import { receiverLocation } from '../data/parser.ts'
import type { ReceiverMetadata } from '../data/receivers.ts'
import { emptyEvidence, evidenceForRange, type RbnEvidence } from './evidence.ts'
import { publicReceptionEvidence } from './privacy.ts'
import {
  renderEvidenceCsv,
  renderEvidenceHtml,
  renderEvidenceJson,
  renderEvidenceMap,
  renderEvidenceMarkdown,
  renderEvidenceQsoCsv,
} from './render.ts'
import { receptionScope } from './scope.ts'
import { evidenceFromSnapshots, mergeEvidenceSnapshot } from './snapshot.ts'

const formats = [
  {
    extension: 'html',
    label: 'RBN reception report',
    mime: 'text/html',
    render: renderEvidenceHtml,
  },
  {
    extension: 'md',
    label: 'RBN reception summary',
    mime: 'text/markdown',
    render: renderEvidenceMarkdown,
  },
  {
    extension: 'csv',
    label: 'RBN individual observations',
    mime: 'text/csv',
    render: renderEvidenceCsv,
  },
  {
    extension: 'json',
    label: 'RBN collected evidence',
    mime: 'application/json',
    render: renderEvidenceJson,
  },
  {
    extension: 'svg',
    label: 'RBN reception map',
    mime: 'image/svg+xml',
    render: renderEvidenceMap,
  },
  {
    extension: 'qso.csv',
    label: 'RBN contact context',
    mime: 'text/csv',
    render: renderEvidenceQsoCsv,
  },
] as const
interface EvidenceReader {
  readEvidence(operationId: string, call: string): Promise<RbnEvidence | null>
}

function filename(args: ExportOptionsRequest, extension: string) {
  return exportFilename({
    stationCall: args.operation.stationCall,
    activity: 'RBN',
    modifier:
      extension === 'json' ? 'evidence' : extension === 'csv' ? 'observations' : 'reception',
    startAtMillis: startMillisOf(args.operation, args.qsos),
    extension,
    compact: args.compactFilenames,
  })
}

export function createRbnExportHook(
  archive: EvidenceReader,
  now: () => number = Date.now,
  lookup?: (receiver: string) => ReceiverMetadata | undefined,
  readSnapshots?: NonNullable<RbnClient['readSnapshots']>,
): ExportHook {
  const offered = new Map<string, RbnEvidence>()
  let sequence = 0
  function withDirectory(evidence: RbnEvidence): RbnEvidence {
    let directoryUsed = false
    const reports = evidence.reports.map((report) => {
      const node = lookup?.(report.receiver)
      const [latitude, longitude] = receiverLocation(node?.grid)
      if (!node || latitude === null || longitude === null) return report
      directoryUsed = true
      return {
        ...report,
        receiverGrid: node.grid,
        receiverLatitude: latitude,
        receiverLongitude: longitude,
        receiverLocationSource: 'rbn-directory' as const,
        country: node.country ?? report.country,
      }
    })
    return {
      ...evidence,
      reports,
      warnings: [
        ...new Set([
          ...evidence.warnings,
          ...(directoryUsed
            ? [
                'Receiver locations use the cached RBN directory when these export options were offered. They are grid centers, not verified historical receiver positions. Original provider grids remain in raw rows when those rows were archived.',
              ]
            : []),
        ]),
      ],
    }
  }
  async function collectSaved(
    args: ExportOptionsRequest | ExportRequest,
  ): Promise<RbnEvidence | null> {
    const call = watchedCall(args.operation, '')
    const archived = args.operation.uuid
      ? await archive.readEvidence(String(args.operation.uuid), call)
      : null
    const cached = evidenceFromSnapshots(
      args.operation,
      call,
      (await readSnapshots?.(call)) ?? [],
      now(),
    )
    const saved = mergeEvidenceSnapshot(archived, cached)
    const selected = receptionScope(
      args.operation,
      args.qsos,
      now(),
      saved,
      'segments' in args ? args.segments : undefined,
    )
    if (!selected) return null
    const evidence = saved
      ? evidenceForRange(saved, selected.request)
      : emptyEvidence(selected.request, now())
    return withDirectory({
      ...evidence,
      warnings: [
        ...new Set([
          ...evidence.warnings,
          ...selected.warnings,
          'This export reads saved reception evidence and cached reports only. No network request or new recording was started.',
          ...(!archived && !saved
            ? [
                'No saved reception observations are available for this station. Open My Signal to obtain a rolling snapshot, or enable Save reception evidence in panel settings to opt in to bounded recording during future visible-panel requests.',
              ]
            : []),
        ]),
      ],
    })
  }
  return {
    async getExportTypes() {
      return formats.map((format) => ({
        exportType: `rbnReception-${format.extension}`,
        activationType: 'rbnReception',
        format: format.extension,
        label: format.label,
        defaults: { includePrivateData: false, includeLookupData: false },
      }))
    },
    async suggestExportOptions(args) {
      const selected = await collectSaved(args)
      if (!selected) return []
      // All companion files use one immutable dataset, even if a visible panel
      // updates its cache between the files. Keep at most eight offered datasets.
      const datasetKey = `rbn:${++sequence}`
      offered.set(datasetKey, selected)
      while (offered.size > 8) {
        const oldest = offered.keys().next().value
        if (oldest !== undefined) offered.delete(oldest)
      }
      return formats.map((format, index) => ({
        exportType: `rbnReception-${format.extension}`,
        // The host uses exportKey as the checkbox identity. Give every format
        // its own identity while retaining one shared immutable dataset.
        exportKey: `${datasetKey}:${format.extension}`,
        format: format.extension,
        label: format.label,
        filename: filename(args, format.extension),
        icon: 'radar',
        priority: 10 + index,
        selectedByDefault: index === 0,
        templateData: {
          activity: 'RBN',
          modifier:
            format.extension === 'json'
              ? 'evidence'
              : format.extension === 'csv'
                ? 'observations'
                : 'reception',
        },
      }))
    },
    async generateExport(args, ctx) {
      const format = formats.find(
        (candidate) => args.exportType === `rbnReception-${candidate.extension}`,
      )
      if (!format) throw new Error('Unknown RBN export format.')
      let datasetKey: string | undefined
      if (args.exportKey) {
        const suffix = `:${format.extension}`
        datasetKey = args.exportKey.endsWith(suffix)
          ? args.exportKey.slice(0, -suffix.length)
          : undefined
        if (!datasetKey || !/^rbn:\d+$/.test(datasetKey))
          throw new Error('RBN export option does not match the requested format.')
      }
      const selected = datasetKey ? offered.get(datasetKey) : await collectSaved(args)
      if (!selected) {
        throw new Error(
          args.exportKey
            ? 'RBN export options expired. Reopen Exports to use the available saved evidence.'
            : 'RBN exports need dated contacts, a cached My Signal snapshot, or saved reception evidence for this station.',
        )
      }
      const call = watchedCall(args.operation, '')
      const operationId = String(args.operation.uuid ?? `${call}:${selected.request.startMs}`)
      if (selected.request.call !== call || selected.request.operationId !== operationId)
        throw new Error('RBN export options belong to another operation or station.')
      const effectiveScope = receptionScope(
        args.operation,
        args.qsos,
        now(),
        selected,
        args.segments,
      )
      const moving = effectiveScope?.warnings.some((warning) =>
        warning.includes('different locations'),
      )
      const requestWithoutOrigin = { ...selected.request }
      delete requestWithoutOrigin.origin
      const gathered: RbnEvidence = moving
        ? {
            ...selected,
            request: requestWithoutOrigin,
            warnings: [...selected.warnings, ...(effectiveScope?.warnings ?? [])],
          }
        : selected
      const includePrivateData =
        args.includePrivateData ?? args.exportSettings?.includePrivateData ?? false
      const evidence: RbnEvidence = publicReceptionEvidence(
        {
          ...gathered,
          warnings: [
            ...new Set([
              ...gathered.warnings,
              ...(ctx.online === false
                ? ['Exported offline from saved reception evidence and cache.']
                : []),
            ]),
          ],
        },
        includePrivateData,
      )
      const qsos = args.qsos.map((qso) =>
        exportQso(qso, {
          includePrivateData,
          includeLookupData:
            args.includeLookupData ?? args.exportSettings?.includeLookupData ?? false,
        }),
      )
      return {
        filename: filename(args, format.extension),
        mimeType: format.mime,
        content: format.render(evidence, { title: args.exportTitle, qsos }),
      }
    },
  }
}
