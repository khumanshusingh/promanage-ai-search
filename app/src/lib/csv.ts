export type CsvRow = Record<string, string | number | boolean | null | undefined>

const escape = (v: CsvRow[string]) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: CsvRow[], preamble: string[] = []): string {
  if (rows.length === 0) return preamble.join('\n')
  const headers = Object.keys(rows[0])
  const lines = [...preamble.map((p) => escape(p)), headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\r\n')
}

/** Real client-side download — no server involved. */
export function downloadCsv(filename: string, rows: CsvRow[], preamble: string[] = []) {
  const blob = new Blob(['﻿' + toCsv(rows, preamble)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
