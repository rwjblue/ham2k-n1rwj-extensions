const maxRecordLength = 64 * 1024
const maxFields = 256
const invalidRecord = 'Could not read the prepared LoTW contact.'

// HaLo writes transfer lengths in UTF-8 bytes. Keep slice offsets in UTF-16
// code units so we can return the original field values without re-encoding.
function fieldEnd(input: string, start: number, bytes: number): number {
  let end = start
  while (bytes > 0) {
    const codePoint = input.codePointAt(end)
    if (codePoint === undefined) throw new Error(invalidRecord)
    if (codePoint <= 0x7f) bytes -= 1
    else if (codePoint <= 0x7ff) bytes -= 2
    else if (codePoint <= 0xffff) bytes -= 3
    else bytes -= 4
    end += codePoint <= 0xffff ? 1 : 2
  }
  if (bytes !== 0) throw new Error(invalidRecord)
  return end
}

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
    if (!Number.isSafeInteger(length) || names.has(key) || ++count > maxFields) {
      throw new Error(invalidRecord)
    }
    const end = fieldEnd(input, start, length)
    names.add(key)
    fields[key] = input.slice(start, end)
    position = end
  }
  throw new Error(invalidRecord)
}
