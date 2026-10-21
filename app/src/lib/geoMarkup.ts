import type { BusinessFact, FactKey, Location } from '@/data/types'
import { hashString } from './random'

/*
  Deterministic structured-data and fact-sheet generation from VERIFIED facts only.
  - schema.org types: ChildCare (a LocalBusiness, so it supports address, geo,
    telephone and openingHoursSpecification) + Preschool (EducationalOrganization).
  - Saturday tours are a visiting-hours fact. schema.org has no property for tour
    appointments, so they are deliberately NOT mapped into JSON-LD; they appear in
    the human-readable fact sheet FAQ instead.
  - The rules check below is local and illustrative; it is not Google's Rich
    Results Test or any crawler's validation.
*/

const STATE_BY_CITY: Record<string, string> = {
  Bengaluru: 'Karnataka',
  Mysuru: 'Karnataka',
  Chennai: 'Tamil Nadu',
  Coimbatore: 'Tamil Nadu',
  Hyderabad: 'Telangana',
  Kochi: 'Kerala',
  Pune: 'Maharashtra',
  Mumbai: 'Maharashtra',
  Ahmedabad: 'Gujarat',
  'Delhi NCR': 'Delhi',
  Jaipur: 'Rajasthan',
  Chandigarh: 'Chandigarh',
  Kolkata: 'West Bengal',
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_ABBR: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

function to24(h: string, m: string | undefined, ap: string) {
  let hour = Number(h) % 12
  if (ap.toUpperCase() === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${m ?? '00'}`
}

/** "Mon–Fri 8:30 AM–6:30 PM" → OpeningHoursSpecification, or null when it can't be parsed safely. */
export function parseHours(value: string) {
  const m = value.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[–-]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!m) return null
  const [, d1, d2, h1, m1, a1, h2, m2, a2] = m
  const days = DAYS.slice(DAY_ABBR[d1], DAY_ABBR[d2] + 1)
  if (!days.length) return null
  return { '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: to24(h1, m1, a1), closes: to24(h2, m2, a2) }
}

export function parseAddress(value: string, loc: Location) {
  const parts = value.split(',').map((p) => p.trim())
  const last = parts.length > 1 ? parts.pop()! : ''
  const pm = last.match(/^(.*?)\s*(\d{6})$/)
  return {
    '@type': 'PostalAddress',
    streetAddress: parts.join(', ') || value,
    addressLocality: (pm ? pm[1] : last) || loc.city,
    ...(STATE_BY_CITY[loc.city] ? { addressRegion: STATE_BY_CITY[loc.city] } : {}),
    ...(pm ? { postalCode: pm[2] } : {}),
    addressCountry: 'IN',
  }
}

export interface MappingRow {
  path: string
  factKey: FactKey | null
  factLabel: string
  included: boolean
  reason: string
}

export interface Check {
  label: string
  pass: boolean
  detail: string
  level: 'error' | 'warning'
}

export interface JsonLdResult {
  data: Record<string, unknown>
  mapping: MappingRow[]
  warnings: string[]
  checks: Check[]
  readiness: { num: number; den: number }
  usedFactIds: string[]
  fingerprint: string
}

const get = (facts: BusinessFact[], key: FactKey) => facts.find((f) => f.key === key)
const ok = (f?: BusinessFact) => !!f && f.verificationStatus === 'verified' && !!f.value

export function buildJsonLd(facts: BusinessFact[], loc: Location): JsonLdResult {
  const data: Record<string, unknown> = { '@context': 'https://schema.org', '@type': ['ChildCare', 'Preschool'] }
  const mapping: MappingRow[] = [{ path: '@type', factKey: null, factLabel: 'Category (constant)', included: true, reason: 'ChildCare + Preschool for a preschool with daycare' }]
  const warnings: string[] = []
  const used: BusinessFact[] = []

  const map = (path: string, key: FactKey, build: (v: string) => unknown, note?: string) => {
    const f = get(facts, key)
    if (ok(f)) {
      const out = build(f!.value!)
      if (out === null) {
        mapping.push({ path, factKey: key, factLabel: f!.label, included: false, reason: 'Verified value could not be converted safely — omitted' })
        warnings.push(`${f!.label} is verified but couldn't be converted to ${path}; it was omitted.`)
        return
      }
      data[path] = out
      used.push(f!)
      mapping.push({ path, factKey: key, factLabel: f!.label, included: true, reason: note ?? 'Verified fact' })
    } else {
      const why = !f || f.verificationStatus === 'missing' ? 'Missing from record' : f.verificationStatus === 'pending_approval' ? 'Edit awaiting approval' : 'Not verified'
      mapping.push({ path, factKey: key, factLabel: f?.label ?? key, included: false, reason: `${why} — omitted` })
      warnings.push(`${f?.label ?? key}: ${why.toLowerCase()}, so ${path} was omitted.`)
    }
  }

  const website = get(facts, 'website')
  if (ok(website)) data['@id'] = `${website!.value}#location`
  map('name', 'name', (v) => v)
  map('url', 'website', (v) => (/^https:\/\//.test(v) ? v : null))
  map('telephone', 'phone', (v) => v)
  map('address', 'address', (v) => parseAddress(v, loc))
  map('geo', 'geo', (v) => {
    const [lat, lng] = v.split(',').map((x) => Number(x.trim()))
    return Number.isFinite(lat) && Number.isFinite(lng) ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } : null
  })

  const status = get(facts, 'operatingStatus')
  if (ok(status) && status!.value !== 'Open') {
    mapping.push({ path: 'openingHoursSpecification', factKey: 'hours', factLabel: 'General opening hours', included: false, reason: 'Center not verified as open — hours withheld' })
    warnings.push('Operating status is not “Open”; opening hours were withheld.')
  } else {
    map('openingHoursSpecification', 'hours', (v) => {
      const spec = parseHours(v)
      return spec ? [spec] : null
    }, 'General operating hours only (not tour slots)')
  }
  map('description', 'programs', (v) => `${get(facts, 'name')?.value ?? loc.name} offers ${v}.`, 'Services summarised as plain description')

  mapping.push({
    path: '—',
    factKey: 'saturdayTours',
    factLabel: 'Saturday tours (visiting hours)',
    included: false,
    reason: 'No schema.org property for tour appointments; published in the fact sheet FAQ instead',
  })
  mapping.push({ path: '—', factKey: 'operatingStatus', factLabel: 'Operating status', included: false, reason: 'No standard property; used to gate opening hours and stated in the fact sheet' })

  const eligible = ['name', 'url', 'telephone', 'address', 'geo', 'openingHoursSpecification', 'description']
  const num = eligible.filter((k) => k in data).length
  const addr = data.address as Record<string, string> | undefined
  const checks: Check[] = [
    { label: 'schema.org context and type', pass: true, detail: 'ChildCare + Preschool', level: 'error' },
    { label: 'name present', pass: 'name' in data, detail: 'Required for a recognisable entity', level: 'error' },
    { label: 'address complete', pass: !!addr && !!addr.streetAddress && !!addr.postalCode && !!addr.addressLocality, detail: addr ? (addr.postalCode ? 'Street, locality, postal code, country' : 'Postal code missing') : 'No verified address', level: 'error' },
    { label: 'telephone format', pass: typeof data.telephone === 'string' && /^\+\d[\d\s-]{7,}$/.test(data.telephone as string), detail: 'International format (+91…)', level: 'warning' },
    { label: 'url uses https', pass: typeof data.url === 'string', detail: 'Canonical center page', level: 'warning' },
    { label: 'opening hours parsed', pass: 'openingHoursSpecification' in data, detail: 'General hours only; tour slots excluded', level: 'warning' },
    { label: 'only verified facts included', pass: used.every((f) => f.verificationStatus === 'verified'), detail: `${used.length} verified facts used`, level: 'error' },
  ]
  return {
    data,
    mapping,
    warnings,
    checks,
    readiness: { num, den: eligible.length },
    usedFactIds: used.map((f) => f.id),
    fingerprint: fingerprintOf(used),
  }
}

export function fingerprintOf(used: BusinessFact[]) {
  return hashString(used.map((f) => `${f.key}=${f.value}`).join('|')).toString(36)
}

/** Serialise for embedding in <script type="application/ld+json">: escape "<" so the payload can't close the tag. */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export const jsonLdSnippet = (data: unknown) => `<script type="application/ld+json">\n${serializeJsonLd(data)}\n</script>`

// ---------- Fact sheet ----------

export interface FactSheetModel {
  title: string
  url: string
  status?: string
  rows: { label: string; value: string }[]
  tours?: string
  programs?: string
  faq: { q: string; a: string }[]
  omitted: string[]
  lastVerified: string
  usedFactIds: string[]
  fingerprint: string
}

export function buildFactSheet(facts: BusinessFact[], loc: Location): FactSheetModel {
  const used: BusinessFact[] = []
  const val = (key: FactKey) => {
    const f = get(facts, key)
    if (ok(f)) {
      used.push(f!)
      return f!.value!
    }
    return undefined
  }
  const name = val('name') ?? loc.name
  const status = val('operatingStatus')
  const address = val('address')
  const phone = val('phone')
  const website = val('website')
  const hours = val('hours')
  const tours = val('saturdayTours')
  const programs = val('programs')
  const rows = [
    address && { label: 'Address', value: address },
    phone && { label: 'Phone', value: phone },
    website && { label: 'Website', value: website },
    hours && { label: 'General opening hours', value: hours },
  ].filter(Boolean) as { label: string; value: string }[]

  const faq: { q: string; a: string }[] = []
  if (tours) {
    faq.push({
      q: `Can I visit ${name} on a Saturday?`,
      a: tours.startsWith('No ') ? `${tours}. Weekday visits can be booked with the center.` : `Yes. ${tours}, by appointment. These are tour slots, not class hours.`,
    })
  }
  if (hours) faq.push({ q: 'What are the opening hours?', a: `${hours}. These are general operating hours for classes and daycare.` })
  if (programs) faq.push({ q: 'Which programs are offered?', a: programs + '.' })
  if (address) faq.push({ q: 'Where is the center?', a: address + '.' })

  const omitted = facts.filter((f) => !ok(f) && f.key !== 'geo').map((f) => f.label)
  const lastVerified = used.map((f) => f.verifiedAt ?? '').sort().pop() || loc.lastVerifiedAt
  return {
    title: name,
    url: `https://brightnest.example/centers/${loc.id}/facts`,
    status,
    rows,
    tours,
    programs,
    faq,
    omitted,
    lastVerified,
    usedFactIds: used.map((f) => f.id),
    fingerprint: fingerprintOf(used),
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Standalone, accessible HTML document. Every value is escaped; nothing is executed. */
export function factSheetHtml(m: FactSheetModel, jsonLd?: unknown) {
  const e = escapeHtml
  const date = new Date(m.lastVerified).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(m.title)} — Center facts</title>
<link rel="canonical" href="${e(m.url)}">
${jsonLd ? jsonLdSnippet(jsonLd) + '\n' : ''}<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;color:#16243a;line-height:1.55}dt{font-weight:600;margin-top:12px}dd{margin:2px 0 0}h2{margin-top:32px;font-size:1.1rem}footer{margin-top:40px;font-size:.85rem;color:#6b7a90}</style>
</head>
<body>
<main>
<h1>${e(m.title)}</h1>
${m.status ? `<p><strong>Status:</strong> ${e(m.status)}</p>\n` : ''}<dl>
${m.rows.map((r) => `<dt>${e(r.label)}</dt><dd>${e(r.value)}</dd>`).join('\n')}
</dl>
${m.tours ? `<h2>Visiting and tours</h2>\n<p>${e(m.tours)}. Tour slots are separate from general opening hours.</p>\n` : ''}${m.programs ? `<h2>Programs</h2>\n<p>${e(m.programs)}</p>\n` : ''}${m.faq.length ? `<h2>Frequently asked questions</h2>\n${m.faq.map((f) => `<h3>${e(f.q)}</h3>\n<p>${e(f.a)}</p>`).join('\n')}\n` : ''}</main>
<footer>Information verified by BrightNest Preschools. Last verified ${e(date)}.</footer>
</body>
</html>
`
}

export function factSheetText(m: FactSheetModel) {
  const lines = [m.title, m.status ? `Status: ${m.status}` : '', ...m.rows.map((r) => `${r.label}: ${r.value}`)]
  if (m.tours) lines.push('', `Visiting and tours: ${m.tours}. Tour slots are separate from general opening hours.`)
  if (m.programs) lines.push('', `Programs: ${m.programs}`)
  if (m.faq.length) lines.push('', 'FAQ', ...m.faq.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`]))
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n')
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const okCopy = document.execCommand('copy')
    ta.remove()
    return okCopy
  }
}
