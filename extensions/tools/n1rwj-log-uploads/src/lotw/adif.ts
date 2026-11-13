const maxRecordLength = 64 * 1024
const maxFields = 256
const invalidRecord = 'Could not read the prepared LoTW contact.'

/** Reads one host-prepared ADIF record, not an ADIF file with a header. */
export function readTransferAdif(input: string): Record<string, string> {
  if (typeof input !== 'string' || input.length > maxRecordLength) {
    throw new Error(invalidRecord)
  }
  const fields: Record<string, string> = {}
  const names = new Set<string>()
  let position = 0
  let count = 0
  while (position < input.length) {
    while (position < input.length && /\s/.test(input[position])) position++
    if (input[position] !== '<') throw new Error(invalidRecord)
    const close = input.indexOf('>', position + 1)
    if (close === -1) throw new Error(invalidRecord)
    const tag = input.slice(position + 1, close)
    if (tag.toUpperCase() === 'EOR') {
      if (count === 0 || input.slice(close + 1).trim()) throw new Error(invalidRecord)
      return fields
    }
    const match = /^([A-Z][A-Z0-9_]*):(\d+)(?::[A-Z0-9])?$/i.exec(tag)
    if (!match) throw new Error(invalidRecord)
    const key = match[1].toUpperCase()
    const length = Number(match[2])
    const start = close + 1
    const end = start + length
    if (
      !Number.isSafeInteger(length) ||
      end > input.length ||
      names.has(key) ||
      ++count > maxFields
    ) {
      throw new Error(invalidRecord)
    }
    names.add(key)
    fields[key] = input.slice(start, end)
    position = end
  }
  throw new Error(invalidRecord)
}
