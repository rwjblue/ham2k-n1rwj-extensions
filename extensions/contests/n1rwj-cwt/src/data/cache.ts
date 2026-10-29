import { parseCallHistory } from '../history/index.ts'
import type { ParsedCallHistory } from '../history/types.ts'

export interface Snapshot {
  schema: 1
  body: string
  url: string
  fetchedAt: string
}
export interface LoadedFile {
  snapshot: Snapshot
  parsed: ParsedCallHistory
}
export function checkedSnapshot(value: unknown): LoadedFile {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schema' in value) ||
    value.schema !== 1 ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    !('url' in value) ||
    typeof value.url !== 'string' ||
    !('fetchedAt' in value) ||
    typeof value.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.fetchedAt))
  ) {
    throw new Error('Invalid CWT cache format. Previous data retained.')
  }
  if (value.body.length > 5_000_000) throw new Error('CWT file exceeds the 5 MB limit.')
  if (/<(?:!doctype|html|body|script|form)\b/i.test(value.body)) {
    throw new Error('Invalid CWT file: received HTML instead of call-history text.')
  }
  const parsed = parseCallHistory(value.body)
  if (
    !parsed.usable ||
    parsed.issues.some((issue) => issue.code === 'invalid-row' || issue.code === 'invalid-exchange')
  ) {
    throw new Error(
      `Invalid CWT file: ${parsed.issues
        .filter(
          (issue) =>
            issue.severity === 'error' ||
            issue.code === 'invalid-row' ||
            issue.code === 'invalid-exchange',
        )
        .map((issue) => issue.message)
        .slice(0, 3)
        .join('; ')}`,
    )
  }
  return {
    snapshot: { schema: 1, body: value.body, url: value.url, fetchedAt: value.fetchedAt },
    parsed,
  }
}

/** Native Data Files own durable storage and replay validated snapshots at startup.
 * Keep only the parsed index in memory; host KV is limited to small records. */
export function createFileCache() {
  let current: LoadedFile | undefined
  let error: string | undefined
  function install(next: LoadedFile): Snapshot {
    if (!current || Date.parse(next.snapshot.fetchedAt) >= Date.parse(current.snapshot.fetchedAt))
      current = next
    error = undefined
    return { ...current.snapshot }
  }
  return {
    current: () => current,
    error: () => error,
    async replace(snapshot: Snapshot): Promise<Snapshot> {
      try {
        return install(checkedSnapshot(snapshot))
      } catch (cause) {
        error = String(cause)
        throw cause
      }
    },
    accept(raw: unknown): void {
      try {
        install(checkedSnapshot(raw))
      } catch (cause) {
        error = String(cause)
      }
    },
    async remove(): Promise<void> {
      current = undefined
      error = undefined
    },
  }
}

export type FileCache = ReturnType<typeof createFileCache>
