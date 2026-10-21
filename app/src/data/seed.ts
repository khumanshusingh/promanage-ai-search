import type { ControlledChannel, FieldKey, Location, Organization, Person, PromptTemplate, SourceRecord, SourceUpdate, SurfaceId, VerifiedField } from './types'
import { hashString } from '@/lib/random'

/*
  All fixtures are fictional and simulated. BrightNest Preschools, its centers,
  people, phone numbers, addresses and competitor names do not exist.
*/

export const ORG: Organization = {
  id: 'org-brightnest',
  name: 'BrightNest Preschools',
  sector: 'Early childhood education',
  totalLocationCount: 150,
  simulated: true,
}

export const SURFACE = 'AI search · Surface A'

export const SURFACES: Record<SurfaceId, { label: string; short: string; note: string }> = {
  A: { label: 'AI search · Surface A', short: 'Surface A', note: 'Primary sampled AI search surface.' },
  B: { label: 'Surface B · conceptual', short: 'Surface B', note: 'Conceptual multi-engine expansion. Compared only with itself — never merged with Surface A.' },
}

export const PEOPLE: Person[] = [
  { id: 'u-ananya', name: 'Ananya Iyer', title: 'Digital Marketing Manager', role: 'marketing' },
  { id: 'u-priya', name: 'Priya Raman', title: 'Regional Operations Manager', role: 'regional', region: 'Bengaluru East' },
  { id: 'u-arjun', name: 'Arjun Mehta', title: 'Regional Operations Manager', role: 'regional', region: 'Bengaluru South' },
  { id: 'u-kavya', name: 'Kavya Nair', title: 'Web & Content Lead', role: 'marketing' },
  { id: 'u-rahul', name: 'Rahul Desai', title: 'ProManage Customer Success', role: 'csm' },
]

export const ROLE_PERSON: Record<string, string> = {
  brand: 'u-ananya',
  promanage: 'u-rahul',
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Name',
  operatingStatus: 'Operating status',
  address: 'Address',
  phone: 'Phone',
  hours: 'Opening hours',
  saturdayTours: 'Saturday tours',
  programs: 'Programs & services',
  website: 'Website',
}

export const FIELD_ORDER: FieldKey[] = ['name', 'operatingStatus', 'address', 'phone', 'hours', 'saturdayTours', 'programs', 'website']

const v = (value: string): VerifiedField => ({ value, status: 'verified' })

const STD_HOURS = 'Mon–Fri 8:30 AM–6:30 PM'
const STD_PROGRAMS = 'Playgroup, Nursery, LKG, UKG, Daycare'

interface PilotSeed {
  id: string
  neighborhood: string
  region: string
  address: string
  phoneSuffix: string
  lastVerifiedAt: string
  overrides?: Partial<Record<FieldKey, VerifiedField>>
}

const PILOTS: PilotSeed[] = [
  {
    id: 'whitefield', neighborhood: 'Whitefield', region: 'Bengaluru East', address: '14 Palm Grove Road, Whitefield, Bengaluru 560066', phoneSuffix: '1101', lastVerifiedAt: '2026-10-02T10:20:00+05:30',
    // Independently verified by regional operations (v7 fixture): the Montessori programme is an approved offering.
    overrides: { programs: { value: 'Playgroup, Nursery, LKG, UKG, Daycare, Montessori programme (Nursery–UKG)', status: 'verified' } },
  },
  { id: 'hsr-layout', neighborhood: 'HSR Layout', region: 'Bengaluru South', address: '221 27th Main, Sector 2, HSR Layout, Bengaluru 560102', phoneSuffix: '1102', lastVerifiedAt: '2026-09-28T16:05:00+05:30' },
  { id: 'koramangala', neighborhood: 'Koramangala', region: 'Bengaluru South', address: '9 Jasmine Lane, 5th Block, Koramangala, Bengaluru 560095', phoneSuffix: '1103', lastVerifiedAt: '2026-10-05T11:40:00+05:30' },
  { id: 'indiranagar', neighborhood: 'Indiranagar', region: 'Bengaluru East', address: '3 Cedar Court, 12th Main, Indiranagar, Bengaluru 560038', phoneSuffix: '1104', lastVerifiedAt: '2026-10-01T09:15:00+05:30' },
  { id: 'sarjapur', neighborhood: 'Sarjapur', region: 'Bengaluru South', address: 'Plot 22, Dommasandra Circle, Sarjapur Road, Bengaluru 562125', phoneSuffix: '1105', lastVerifiedAt: '2026-09-22T14:30:00+05:30' },
  { id: 'jayanagar', neighborhood: 'Jayanagar', region: 'Bengaluru South', address: '41 Lotus Street, 4th Block, Jayanagar, Bengaluru 560011', phoneSuffix: '1106', lastVerifiedAt: '2026-10-07T12:00:00+05:30' },
  {
    id: 'bellandur', neighborhood: 'Bellandur', region: 'Bengaluru East', address: '7 Lakeview Avenue, Bellandur, Bengaluru 560103', phoneSuffix: '1107', lastVerifiedAt: '2026-06-11T09:00:00+05:30',
    overrides: {
      phone: { value: null, status: 'unknown', note: 'Imported from legacy CRM; no owner confirmation on file.' },
      saturdayTours: { value: null, status: 'unknown', note: 'Not captured in the approved record.' },
    },
  },
  { id: 'brookefield', neighborhood: 'Brookefield', region: 'Bengaluru East', address: '12 Brookefield Main Road, Brookefield, Bengaluru 560037', phoneSuffix: '1108', lastVerifiedAt: '2026-09-30T15:10:00+05:30' },
  {
    id: 'electronic-city', neighborhood: 'Electronic City', region: 'Bengaluru South', address: '88 Tech Park Road, Phase 1, Electronic City, Bengaluru 560100', phoneSuffix: '1109', lastVerifiedAt: '2026-08-19T10:45:00+05:30',
    overrides: {
      hours: { value: null, status: 'needs_verification', note: 'Center system and listing disagree (8:30–6:30 vs 9:00–5:00). Awaiting center confirmation.' },
    },
  },
  { id: 'marathahalli', neighborhood: 'Marathahalli', region: 'Bengaluru East', address: '5 Outer Ring Road Service Lane, Marathahalli, Bengaluru 560037', phoneSuffix: '1110', lastVerifiedAt: '2026-10-03T13:25:00+05:30' },
]

const SAT_TOURS: Record<string, string> = {
  whitefield: 'Saturday tours 10 AM–1 PM',
  koramangala: 'Saturday open house 10 AM–12 PM',
  'hsr-layout': 'Saturday tours by appointment',
}

function statusFromFields(fields: Record<FieldKey, VerifiedField>) {
  const statuses = Object.values(fields).map((f) => f.status)
  if (statuses.includes('unknown')) return 'unknown' as const
  if (statuses.includes('needs_verification')) return 'needs_verification' as const
  return 'verified' as const
}

function buildPilot(p: PilotSeed): Location {
  const fields: Record<FieldKey, VerifiedField> = {
    name: v(`BrightNest Preschool – ${p.neighborhood}`),
    operatingStatus: v('Open'),
    address: v(p.address),
    phone: v(`+91 80 4000 ${p.phoneSuffix}`),
    hours: v(STD_HOURS),
    saturdayTours: v(SAT_TOURS[p.id] ?? 'No Saturday tours (weekday visits only)'),
    programs: v(STD_PROGRAMS),
    website: v(`https://brightnest.example/centers/${p.id}`),
    ...p.overrides,
  }
  return {
    id: p.id,
    organizationId: ORG.id,
    name: `BrightNest ${p.neighborhood}`,
    neighborhood: p.neighborhood,
    city: 'Bengaluru',
    region: p.region,
    isPilot: true,
    verifiedFields: fields,
    verificationStatus: statusFromFields(fields),
    lastVerifiedAt: p.lastVerifiedAt,
    sourceOwner: p.region === 'Bengaluru East' ? 'Priya Raman (Regional Ops)' : 'Arjun Mehta (Regional Ops)',
    simulated: true,
  }
}

const OTHER_CENTERS: Array<[string, string, string[]]> = [
  ['Bengaluru', 'Bengaluru North & West', ['Malleshwaram', 'Rajajinagar', 'Yelahanka', 'Hebbal', 'JP Nagar', 'Banashankari', 'BTM Layout', 'Bannerghatta Road', 'Frazer Town', 'RT Nagar', 'Basavanagudi', 'Kalyan Nagar', 'Hennur', 'KR Puram', 'Mahadevapura', 'Kengeri', 'Vijayanagar', 'Domlur', 'Ulsoor', 'Banaswadi']],
  ['Chennai', 'South', ['Adyar', 'Anna Nagar', 'Velachery', 'Thoraipakkam', 'T Nagar', 'Porur', 'Tambaram', 'Mylapore', 'Nungambakkam', 'Sholinganallur', 'Perungudi', 'Medavakkam']],
  ['Hyderabad', 'South', ['Gachibowli', 'Kondapur', 'Madhapur', 'Kukatpally', 'Banjara Hills', 'Jubilee Hills', 'Miyapur', 'Manikonda', 'Begumpet', 'Secunderabad', 'Kompally', 'Nallagandla']],
  ['Kochi', 'South', ['Kakkanad', 'Edappally', 'Kaloor', 'Vyttila', 'Panampilly Nagar', 'Aluva', 'Thrippunithura', 'Palarivattom']],
  ['Coimbatore', 'South', ['RS Puram', 'Saibaba Colony', 'Peelamedu', 'Vadavalli', 'Saravanampatti', 'Singanallur', 'Race Course', 'Ganapathy']],
  ['Mysuru', 'South', ['Vijayanagar 2nd Stage', 'Kuvempunagar', 'Hebbal Mysuru', 'Gokulam', 'JP Nagar Mysuru', 'Bogadi']],
  ['Pune', 'West', ['Baner', 'Wakad', 'Hinjewadi', 'Kharadi', 'Viman Nagar', 'Aundh', 'Kothrud', 'Hadapsar', 'Magarpatta', 'Pimple Saudagar', 'Balewadi', 'Undri']],
  ['Mumbai', 'West', ['Powai', 'Andheri West', 'Bandra', 'Goregaon', 'Thane West', 'Chembur', 'Malad', 'Borivali', 'Kandivali', 'Vashi', 'Kharghar', 'Mulund']],
  ['Ahmedabad', 'West', ['Satellite', 'Prahlad Nagar', 'Bodakdev', 'Vastrapur', 'Thaltej', 'Navrangpura', 'Maninagar', 'Gota', 'Chandkheda', 'Bopal']],
  ['Delhi NCR', 'North', ['Gurugram Sector 56', 'Noida Sector 62', 'Dwarka', 'Vasant Kunj', 'Rohini', 'Indirapuram', 'Greater Kailash', 'Saket', 'Golf Course Road', 'Sohna Road', 'Noida Sector 137', 'Faridabad Sector 21']],
  ['Jaipur', 'North', ['Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C-Scheme', 'Jagatpura', 'Raja Park', 'Tonk Road', 'Sodala']],
  ['Chandigarh', 'North', ['Sector 35', 'Sector 8', 'Mohali Phase 7', 'Panchkula Sector 20', 'Zirakpur', 'Sector 44', 'Kharar', 'Mohali Sector 70']],
  ['Kolkata', 'East', ['Salt Lake', 'New Town', 'Ballygunge', 'Behala', 'Garia', 'Rajarhat', 'Dum Dum', 'Tollygunge', 'Alipore', 'Jadavpur', 'Howrah', 'Park Circus']],
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function buildOther(city: string, region: string, neighborhood: string, index: number): Location {
  const h = hashString(`${city}:${neighborhood}`)
  const roll = h % 100
  const fields: Record<FieldKey, VerifiedField> = {
    name: v(`BrightNest Preschool – ${neighborhood}`),
    operatingStatus: v('Open'),
    address: v(`${(h % 180) + 1} ${neighborhood} Main Road, ${city}`),
    phone: v(`+91 ${city === 'Bengaluru' ? '80' : '22'} 4100 ${String(2000 + index).padStart(4, '0')}`),
    hours: roll < 12 ? { value: null, status: 'needs_verification', note: 'Seasonal hours pending confirmation.' } : v(STD_HOURS),
    saturdayTours: roll >= 94 ? { value: null, status: 'unknown' } : v(h % 3 === 0 ? 'Saturday tours by appointment' : 'No Saturday tours (weekday visits only)'),
    programs: v(STD_PROGRAMS),
    website: v(`https://brightnest.example/centers/${slug(neighborhood)}`),
  }
  const month = String((h % 9) + 1).padStart(2, '0')
  const day = String((h % 27) + 1).padStart(2, '0')
  return {
    id: slug(`${neighborhood}-${city === 'Bengaluru' ? '' : city}`),
    organizationId: ORG.id,
    name: `BrightNest ${neighborhood}`,
    neighborhood,
    city,
    region,
    isPilot: false,
    verifiedFields: fields,
    verificationStatus: statusFromFields(fields),
    lastVerifiedAt: `2026-${month}-${day}T10:00:00+05:30`,
    sourceOwner: `${city} center admin`,
    simulated: true,
  }
}

export const PILOT_IDS = PILOTS.map((p) => p.id)

export const LOCATIONS: Location[] = (() => {
  const out = PILOTS.map(buildPilot)
  let i = 0
  for (const [city, region, hoods] of OTHER_CENTERS) {
    for (const hood of hoods) out.push(buildOther(city, region, hood, i++))
  }
  return out
})()

export const LOCATION_BY_ID: Record<string, Location> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]))

export const PROMPTS: PromptTemplate[] = [
  { id: 'p1', intent: 'unbranded_discovery', category: 'discovery', text: 'Best preschools near {neighborhood}, {city}', includeInDiscoveryMetric: true, defaultSelected: true },
  { id: 'p2', intent: 'unbranded_discovery', category: 'discovery', text: 'Best preschools offering Saturday tours near {neighborhood}, {city}', includeInDiscoveryMetric: true, defaultSelected: true },
  { id: 'p3', intent: 'unbranded_discovery', category: 'services', text: 'Preschools with daycare and extended hours in {neighborhood}', includeInDiscoveryMetric: true, defaultSelected: true },
  { id: 'p4', intent: 'unbranded_discovery', category: 'reputation', text: 'Preschools near {neighborhood} with good parent reviews', includeInDiscoveryMetric: true, defaultSelected: true },
  { id: 'p5', intent: 'unbranded_discovery', category: 'services', text: 'Best Montessori preschools in {neighborhood}, {city}', includeInDiscoveryMetric: true, defaultSelected: true },
  { id: 'p6', intent: 'branded_fact', category: 'branded', text: 'Does BrightNest {neighborhood} offer Saturday campus tours?', includeInDiscoveryMetric: false, defaultSelected: true },
  { id: 'p7', intent: 'branded_fact', category: 'branded', text: 'BrightNest {neighborhood} phone number and opening hours', includeInDiscoveryMetric: false, defaultSelected: true },
  { id: 'p8', intent: 'branded_fact', category: 'branded', text: 'Where is BrightNest Preschool {neighborhood} located?', includeInDiscoveryMetric: false, defaultSelected: true },
  { id: 'p9', intent: 'unbranded_discovery', category: 'discovery', text: 'Preschools for 2-year-olds near {neighborhood}', includeInDiscoveryMetric: true },
  { id: 'p10', intent: 'branded_fact', category: 'branded', text: 'What programs does BrightNest {neighborhood} offer?', includeInDiscoveryMetric: false },
]

export const CATEGORY_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  services: 'Services',
  reputation: 'Reputation',
  branded: 'Branded facts',
}

export const COMPETITORS = [
  'Little Acorns Learning Centre',
  'Kidzmosaic Preschool',
  'Sunbeam Montessori House',
  'Treetop Kids Academy',
  'Pebbles Play School',
  'Maple Sprouts Preschool',
  'Rainbow Steps Early Years',
  'Orchard Lane Kindergarten',
]

export const CHANNEL_LABELS: Record<ControlledChannel, string> = {
  owned_website: 'Owned website',
  managed_listing: 'Managed listing (GBP)',
  external_request: 'External site — request only',
  verification: 'Business verification',
}

export const CHANNEL_HINT: Record<ControlledChannel, string> = {
  owned_website: 'BrightNest controls this content (center page CMS).',
  managed_listing: 'Business listing managed through ProManage.',
  external_request: 'Independent site. BrightNest can request a correction; the site owner decides.',
  verification: 'The centre confirms the true value; Marketing approves it in the master record.',
}

export function channelTarget(channel: ControlledChannel, locationId: string) {
  const sources = sourceRecordsFor(locationId)
  if (channel === 'owned_website') return `Center page — ${sources.find((s) => s.channel === 'owned_website')?.url}`
  if (channel === 'managed_listing') return 'Google Business Profile (via ProManage Listing Management)'
  if (channel === 'verification') return 'ProManage master record — centre confirmation'
  const ext = sources.find((s) => s.channel === 'external_directory')
  return ext ? `${ext.label} — ${ext.url}` : 'Independent directory'
}

/** Verified coordinates (GeoCoordinates is only emitted when verified). */
export const GEO: Record<string, string> = {
  whitefield: '12.9698, 77.7499',
  'hsr-layout': '12.9116, 77.6474',
  koramangala: '12.9352, 77.6245',
  indiranagar: '12.9784, 77.6408',
  jayanagar: '12.9299, 77.5826',
  brookefield: '12.9655, 77.7186',
}

/*
  Simulated source snapshots. These are fixtures standing in for content a
  connected website/listing integration would return — not live fetches.
*/
const SOURCE_OVERRIDES: Record<string, Partial<Record<'owned_website' | 'managed_listing' | 'external_directory', Partial<Record<FieldKey, string | null>>>>> = {
  whitefield: {
    owned_website: { saturdayTours: 'Weekday campus visits only (9 AM–4 PM)' },
    managed_listing: { saturdayTours: null },
    external_directory: { saturdayTours: 'No Saturday tours' },
  },
  'hsr-layout': { owned_website: { hours: 'Mon–Sat 9 AM–6 PM' }, external_directory: { hours: 'Mon–Sat 9 AM–6 PM' } },
  indiranagar: { external_directory: { phone: '+91 80 4000 9911' } },
  jayanagar: {},
  brookefield: { external_directory: { address: 'ITPL Main Road, Whitefield, Bengaluru 560066' } },
  marathahalli: {
    managed_listing: { operatingStatus: 'Temporarily closed' },
    external_directory: { operatingStatus: 'Permanently closed' },
  },
  'electronic-city': { owned_website: { hours: 'Mon–Fri 8:30 AM–6:30 PM' }, managed_listing: { hours: 'Mon–Fri 9 AM–5 PM' } },
  bellandur: { owned_website: { phone: '+91 80 4000 1107', saturdayTours: null }, managed_listing: { phone: '+91 80 4000 1107' } },
}

const EXTERNAL_DIRECTORY: Record<string, { label: string; url: string; inaccessible?: boolean }> = {
  'hsr-layout': { label: 'Bengaluru Preschool Directory', url: 'https://bengaluru-preschool-directory.example/hsr-layout' },
  jayanagar: { label: 'KinderFinder', url: 'https://kinderfinder.example/bengaluru/jayanagar', inaccessible: true },
  whitefield: { label: 'Bengaluru Preschool Directory', url: 'https://bengaluru-preschool-directory.example/whitefield' },
  indiranagar: { label: 'CityKids Directory', url: 'https://citykids-directory.example/blr/indiranagar' },
  brookefield: { label: 'Bengaluru Preschool Directory', url: 'https://bengaluru-preschool-directory.example/brookefield' },
  marathahalli: { label: 'LocalSchools Index', url: 'https://localschools-index.example/bengaluru/marathahalli' },
}

const SOURCE_FIELDS: FieldKey[] = ['operatingStatus', 'address', 'phone', 'hours', 'saturdayTours', 'programs']

/** Simulated source snapshots; `updates` applies completed, authorized source actions (past observations are untouched). */
export function sourceRecordsFor(locationId: string, updates: Record<string, SourceUpdate> = {}): SourceRecord[] {
  const loc = LOCATION_BY_ID[locationId]
  if (!loc) return []
  const mirror = () => Object.fromEntries(SOURCE_FIELDS.map((k) => [k, loc.verifiedFields[k].value])) as Partial<Record<FieldKey, string | null>>
  const ov = SOURCE_OVERRIDES[locationId] ?? {}
  const observedAt = '2026-10-14T09:00:00+05:30'
  const out: SourceRecord[] = [
    {
      id: `${locationId}-web`,
      locationId,
      channel: 'owned_website',
      label: 'BrightNest center page',
      url: loc.verifiedFields.website.value ?? `https://brightnest.example/centers/${locationId}`,
      observedAt,
      managedByCustomer: true,
      values: { ...mirror(), ...ov.owned_website },
      simulated: true,
    },
    {
      id: `${locationId}-listing`,
      locationId,
      channel: 'managed_listing',
      label: 'Google Business Profile (managed in ProManage)',
      url: `https://maps.example/place/brightnest-${locationId}`,
      observedAt,
      managedByCustomer: true,
      values: { ...mirror(), ...ov.managed_listing },
      simulated: true,
    },
  ]
  const ext = EXTERNAL_DIRECTORY[locationId]
  const applyUpdates = (list: SourceRecord[]) =>
    list.map((r) => {
      const own = Object.entries(updates).filter(([k]) => k.startsWith(`${r.id}:`))
      if (!own.length) return r
      const values = { ...r.values }
      for (const [k, u] of own) values[k.split(':')[1] as FieldKey] = u.value
      return { ...r, values, observedAt: own.map(([, u]) => u.at).sort().pop()! }
    })
  if (ext) {
    out.push({ id: `${locationId}-dir`, locationId, channel: 'external_directory', label: ext.label, url: ext.url, observedAt: ext.inaccessible ? '2026-10-14T09:00:00+05:30' : '2024-11-02T00:00:00+05:30', managedByCustomer: false, inaccessible: ext.inaccessible, values: { ...ov.external_directory }, simulated: true })
  }
  return applyUpdates(out)
}

export function fillPrompt(text: string, loc: Pick<Location, 'neighborhood' | 'city'>) {
  return text.replace(/\{neighborhood\}/g, loc.neighborhood).replace(/\{city\}/g, loc.city)
}
