/** Quote every cell, including headers and nested JSON, and neutralize spreadsheet formulas. */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) && typeof value !== 'number') text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n'
}
