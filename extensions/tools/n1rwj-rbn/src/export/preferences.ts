export const additionalExportChoices = [
  { label: 'Markdown summary', value: 'md' },
  { label: 'Individual observations (CSV)', value: 'csv' },
  { label: 'Collected evidence (JSON)', value: 'json' },
  { label: 'Reception map (SVG)', value: 'svg' },
  { label: 'Contact context (CSV)', value: 'qso.csv' },
]

export function validAdditionalExportFormats(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((format) => additionalExportChoices.some((choice) => choice.value === format))
  )
}

/** Saved choices only add requested companions; the HTML report is always available. */
export function additionalExportFormats(raw: Record<string, unknown>): string[] {
  const selected = raw.additionalExportFormats
  if (!Array.isArray(selected) || !validAdditionalExportFormats(selected)) return []
  return additionalExportChoices
    .filter((choice) => selected.includes(choice.value))
    .map((choice) => choice.value)
}
