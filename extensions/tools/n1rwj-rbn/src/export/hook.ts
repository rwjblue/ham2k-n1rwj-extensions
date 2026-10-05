import type { ExportHook, ExportOptionsRequest, ExportRequest } from '@ham2k/extension-sdk'
import { exportFilename, exportQso, startMillisOf } from '@ham2k/extension-sdk'
import { watchedCall } from '../config.ts'
import { receiverLocation } from '../data/parser.ts'
import type { ReceiverMetadata } from '../data/receivers.ts'
import type { RbnEvidence } from './evidence.ts'
import type { createEvidenceRetriever } from './history.ts'
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
type Retriever = ReturnType<typeof createEvidenceRetriever>

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
  retriever: Retriever,
  now: () => number = Date.now,
  lookup?: (receiver: string) => ReceiverMetadata | undefined,
): ExportHook {
  async function scope(args: ExportOptionsRequest | ExportRequest) {
    const call = watchedCall(args.operation, '')
    const saved = args.operation.uuid
      ? await retriever.readEvidence(String(args.operation.uuid), call)
      : null
    return receptionScope(
      args.operation,
      args.qsos,
      now(),
      saved,
      'segments' in args ? args.segments : undefined,
    )
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
      const selected = await scope(args)
      if (!selected) return []
      return formats.map((format, index) => ({
        exportType: `rbnReception-${format.extension}`,
        exportKey: `rbn:${selected.request.call}:${selected.request.startMs}:${selected.request.endMs}`,
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
      const selected = await scope(args)
      if (!selected)
        throw new Error(
          'RBN exports need dated contacts or saved reception evidence for this station.',
        )
      const fixed = args.exportKey?.match(/^rbn:([^:]+):(\d+):(\d+)$/)
      if (args.exportKey && (!fixed || fixed[1] !== selected.request.call))
        throw new Error('Invalid RBN export interval.')
      if (fixed) {
        const startMs = Number(fixed[2]),
          endMs = Number(fixed[3])
        if (
          !Number.isSafeInteger(startMs) ||
          !Number.isSafeInteger(endMs) ||
          startMs <= 0 ||
          endMs <= startMs ||
          endMs > now()
        )
          throw new Error('Invalid RBN export interval.')
        selected.request = { ...selected.request, startMs, endMs }
      }
      const gathered = await retriever.retrieveEvidence(selected.request, { online: ctx.online })
      const includePrivateData =
        args.includePrivateData ?? args.exportSettings?.includePrivateData ?? false
      let directoryUsed = false
      const reports = gathered.reports.map((report) => {
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
      const evidence: RbnEvidence = publicReceptionEvidence(
        {
          ...gathered,
          reports,
          warnings: [
            ...new Set([
              ...gathered.warnings,
              ...selected.warnings,
              ...(directoryUsed
                ? [
                    'Receiver locations use the current cached RBN directory where available. They are grid centers at export time, not verified historical receiver positions; original provider grids remain in raw rows.',
                  ]
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
