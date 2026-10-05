import { gridToLocation, locationToGrid6 } from '@ham2k/lib-geo-tools'
import type { EvidenceRequest, RbnEvidence } from './evidence.ts'

function publicRequest(request: EvidenceRequest): EvidenceRequest {
  const { origin, ...rest } = request
  if (!origin) return rest
  const grid = locationToGrid6(origin.latitude, origin.longitude)
  if (!grid) return rest
  const [latitude, longitude] = gridToLocation(grid)
  return {
    ...rest,
    origin: { latitude, longitude, label: `${grid.toUpperCase()} (6-character grid center)` },
  }
}

/** Follow the SDK's default six-character grid precision for private locations. */
export function publicReceptionEvidence(
  evidence: RbnEvidence,
  includePrivateData: boolean,
): RbnEvidence {
  if (includePrivateData) return evidence
  return {
    ...evidence,
    request: publicRequest(evidence.request),
    attempts: evidence.attempts.map((attempt) => ({
      ...attempt,
      request: publicRequest(attempt.request),
    })),
    warnings: [
      ...new Set([
        ...evidence.warnings,
        'Transmitter origins are shown at six-character grid precision; precise operator coordinates and location labels are withheld.',
      ]),
    ],
  }
}
