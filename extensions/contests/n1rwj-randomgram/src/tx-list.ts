export interface ParsedTxList {
  groups: string[]
  call?: string
  event?: string
  declaredCount?: number
  error?: string
}

function parseGroups(
  source: string,
  metadata: Omit<ParsedTxList, 'groups' | 'error'>,
): ParsedTxList {
  const groups = source.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (groups.length === 0) return { ...metadata, groups: [], error: 'No code groups found.' }
  const invalid = groups.find((group) => !/^[A-Z0-9]{5}$/.test(group))
  if (invalid) {
    return {
      ...metadata,
      groups: [],
      error: `Invalid code group “${invalid}”. Every group must have five letters or digits.`,
    }
  }
  if (new Set(groups).size !== groups.length) {
    return { ...metadata, groups: [], error: 'The list contains duplicate code groups.' }
  }
  if (metadata.declaredCount !== undefined && metadata.declaredCount !== groups.length) {
    return {
      ...metadata,
      groups: [],
      error: `The list declares ${metadata.declaredCount} groups but contains ${groups.length}.`,
    }
  }
  return { ...metadata, groups }
}

export function parseTxList(source: string): ParsedTxList {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const headings = lines
    .map((line, index) => ({ match: /^\s*TX List for\s+([A-Z0-9/]+)\s*:\s*$/i.exec(line), index }))
    .filter((heading) => heading.match !== null)
  if (headings.length === 0) {
    if (/TX List for|Tx List of\s*\[|-end-/i.test(source)) {
      return {
        groups: [],
        error: 'The organizer list is missing a valid “TX List for CALL:” heading.',
      }
    }
    return parseGroups(source, {})
  }
  if (headings.length !== 1) {
    return { groups: [], error: 'Paste one issued TX list at a time.' }
  }
  const heading = headings[0]
  const call = heading.match?.[1].toUpperCase()
  const prefix = lines.slice(0, heading.index).join('\n')
  const metadata: Omit<ParsedTxList, 'groups' | 'error'> = { call }
  const event = /^\s*Event:\s*(RG#\d+)\b/im.exec(prefix)?.[1]
  if (event) metadata.event = event.toUpperCase()
  const count = /Tx List of\s*\[(\d+)\]/i.exec(prefix)?.[1]
  if (count !== undefined) {
    const declaredCount = Number(count)
    if (!Number.isSafeInteger(declaredCount) || declaredCount < 1) {
      return {
        ...metadata,
        groups: [],
        error: 'The organizer list has an invalid declared group count.',
      }
    }
    metadata.declaredCount = declaredCount
  }
  const metadataCall = /^\s*Call:\s*([A-Z0-9/]+)\s*$/im.exec(prefix)?.[1].toUpperCase()
  if (metadataCall && metadataCall !== call) {
    return {
      ...metadata,
      groups: [],
      error: 'The callsign in the list heading does not match its metadata.',
    }
  }
  const endIndex = lines.findIndex(
    (line, index) => index > heading.index && /^\s*-end-\s*$/i.test(line),
  )
  if (endIndex === -1) {
    return {
      ...metadata,
      groups: [],
      error: 'The organizer list is incomplete: its “-end-” marker is missing.',
    }
  }
  return parseGroups(lines.slice(heading.index + 1, endIndex).join('\n'), metadata)
}
