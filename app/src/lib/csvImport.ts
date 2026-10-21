import { LOCATIONS } from '@/data/seed'
import type { FieldKey } from '@/data/types'

/*
  In-browser CSV validation for assisted audits. Nothing is uploaded or synced.
  CSV values are never treated as verified truth: matched rows are audited
  against the existing verified ProManage record, and differences are listed.
*/

export const CSV_COLUMNS = ['location_name', 'neighborhood', 'city', 'address', 'phone', 'website'] as const
export const MAX_CSV_BYTES = 100_000
export const MAX_CSV_ROWS = 200

export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(','),
  'BrightNest Whitefield,Whitefield,Bengaluru,"14 Palm Grove Road, Whitefield, Bengaluru 560066",+91 80 4000 1101,https://brightnest.example/centers/whitefield',
  'BrightNest HSR Layout,HSR Layout,Bengaluru,"221 27th Main, Sector 2, HSR Layout, Bengaluru 560102",+91 80 4000 1102,https://brightnest.example/centers/hsr-layout',
  'BrightNest Indiranagar,Indiranagar,Bengaluru,"3 Cedar Court, 12th Main, Indiranagar, Bengaluru 560038",+91 80 4000 9911,https://brightnest.example/centers/indiranagar',
  'BrightNest Yeshwanthpur,Yeshwanthpur,Bengaluru,"9 Station Road, Yeshwanthpur, Bengaluru 560022",+91 80 4000 1199,https://brightnest.example/centers/yeshwanthpur',
  ',Koramangala,Bengaluru,,080-1234,brightnest.example/koramangala',
].join('\n')

export interface CsvRowResult {
  line: number
  values: Record<(typeof CSV_COLUMNS)[number], string>
  errors: string[]
  matchId?: string
  diffs: { field: FieldKey; csv: string; record: string | null }[]
}

export interface CsvParseResult {
  ok: boolean
  fatal?: string
  rows: CsvRowResult[]
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim()))
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function validateCsv(text: string, byteSize: number): CsvParseResult {
  if (byteSize > MAX_CSV_BYTES) return { ok: false, fatal: `File is ${(byteSize / 1024).toFixed(0)} KB — the limit is ${MAX_CSV_BYTES / 1000} KB.`, rows: [] }
  const all = parseCsvText(text.replace(/^\uFEFF/, ''))
  if (!all.length) return { ok: false, fatal: 'The file is empty.', rows: [] }
  const header = all[0].map((h) => h.trim().toLowerCase())
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length) return { ok: false, fatal: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected: ${CSV_COLUMNS.join(', ')}.`, rows: [] }
  const body = all.slice(1)
  if (body.length > MAX_CSV_ROWS) return { ok: false, fatal: `${body.length} rows — the limit is ${MAX_CSV_ROWS}.`, rows: [] }

  const seen = new Set<string>()
  const rows = body.map((cells, idx): CsvRowResult => {
    const values = Object.fromEntries(CSV_COLUMNS.map((c) => [c, (cells[header.indexOf(c)] ?? '').trim()])) as CsvRowResult['values']
    const errors: string[] = []
    if (!values.location_name) errors.push('location_name is required')
    if (!values.neighborhood) errors.push('neighborhood is required')
    if (!values.city) errors.push('city is required')
    if (values.phone && !/^\+\d[\d\s-]{7,}$/.test(values.phone)) errors.push('phone must be international format (+91 …)')
    if (values.website && !/^https:\/\/[^\s]+\.[^\s]+$/.test(values.website)) errors.push('website must be an https:// URL')
    if (Object.values(values).some((v) => v.length > 200)) errors.push('a value exceeds 200 characters')
    const key = norm(values.neighborhood + values.city)
    if (key && seen.has(key)) errors.push('duplicate neighborhood + city')
    seen.add(key)

    const match = LOCATIONS.find((l) => norm(l.neighborhood) === norm(values.neighborhood) && norm(l.city) === norm(values.city))
    const diffs: CsvRowResult['diffs'] = []
    if (match) {
      for (const [col, field] of [['address', 'address'], ['phone', 'phone'], ['website', 'website']] as const) {
        const rec = match.verifiedFields[field].value
        if (values[col] && values[col] !== rec) diffs.push({ field, csv: values[col], record: rec })
      }
    }
    return { line: idx + 2, values, errors, matchId: errors.length ? undefined : match?.id, diffs }
  })
  return { ok: true, rows }
}
