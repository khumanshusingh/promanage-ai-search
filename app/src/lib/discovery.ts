import type {
  Audit,
  DiscoveryOpportunity,
  DiscoveryRecheck,
  DiscoveryRecord,
  DiscoveryStatus,
  EligibilityReview,
  EligibilityStatus,
  FactEdit,
  FactKey,
  FieldKey,
  Location,
  NotRelevantReason,
  Observation,
  OptimizationRecommendation,
  PromptTemplate,
  ReadinessFinding,
  Recheck,
  Release,
  Task,
} from '@/data/types'
import { COMPETITORS, LOCATION_BY_ID, ORG, sourceRecordsFor } from '@/data/seed'
import { effectiveLocation, factId } from './facts'

/*
  Discoverability Improvement (PRD v4). Kept apart from accuracy Issues.
  A non-mention is an observation, never an error or a confirmed SEO defect.
  Opportunities, findings and outcomes are derived from records + seeded,
  simulated source snapshots. Nothing here is fetched or published.
*/

export const discoveryId = (auditId: string, locationId: string) => `disc-${auditId}-${locationId}`
export const eligibilityKey = (locationId: string, promptId: string) => `${locationId}:${promptId}`

export const NOT_RELEVANT_REASONS: Record<NotRelevantReason, string> = {
  service_mismatch: 'We don’t offer this service',
  geography_mismatch: 'Not the area this centre serves',
  inactive_location: 'Centre closed or inactive',
  ambiguous_query: 'The question is too vague',
  other: 'Other reason',
}

/** Services a centre has said it offers but that aren't in the approved record yet (simulated fixtures). */
export const SERVICE_CANDIDATES: Record<string, { promptId: string; service: string; source: string }[]> = {
  // Whitefield's Montessori programme is now independently verified in the seed (PRD v7); this hook stays for other centres.
  koramangala: [{ promptId: 'p5', service: 'Montessori programme (Nursery–UKG)', source: 'Centre brochure shared by Arjun Mehta (Regional Ops), Sept 2026 — not yet in the approved record' }],
}

type Verdict = { verdict: 'yes' | 'no' | 'unknown'; basis: string; service?: string }

const has = (v: string | null | undefined, word: string) => !!v && v.toLowerCase().includes(word)

/** What the verified record says about whether a centre can genuinely answer this unbranded question. */
function requirement(loc: Location, prompt: PromptTemplate | undefined): Verdict {
  const f = loc.verifiedFields
  switch (prompt?.id) {
    case 'p1':
    case 'p4':
      return { verdict: 'yes', basis: `Core preschool service in ${loc.neighborhood}` }
    case 'p2': {
      const sat = f.saturdayTours
      if (sat.status !== 'verified' || !sat.value) return { verdict: 'unknown', basis: 'Saturday visits aren’t confirmed in your record', service: 'Saturday visits' }
      if (sat.value.startsWith('No ')) return { verdict: 'no', basis: `Your record says “${sat.value}”`, service: 'Saturday visits' }
      return { verdict: 'yes', basis: `Verified: ${sat.value}` }
    }
    case 'p3':
      return has(f.programs.value, 'daycare') ? { verdict: 'yes', basis: 'Verified: daycare is in the programme list' } : { verdict: 'no', basis: 'Daycare isn’t in your verified programmes', service: 'Daycare' }
    case 'p5':
      return has(f.programs.value, 'montessori') ? { verdict: 'yes', basis: 'Verified: Montessori programme' } : { verdict: 'no', basis: 'Montessori isn’t in your verified programmes', service: 'Montessori programme' }
    case 'p9':
      return has(f.programs.value, 'playgroup') ? { verdict: 'yes', basis: 'Verified: Playgroup for toddlers' } : { verdict: 'no', basis: 'Playgroup isn’t in your verified programmes' }
    default:
      return { verdict: 'unknown', basis: 'Custom question — relevance needs a person to review' }
  }
}

export interface EligibilityView {
  status: EligibilityStatus
  source: 'review' | 'record' | 'suggestion'
  basis: string
  reviewer: string
  reason?: NotRelevantReason
  /** What a person should do when status is unknown. */
  suggestion?: 'confirm_service' | 'mark_not_relevant' | 'review'
  candidate?: { service: string; source: string }
  at?: string
}

export function eligibilityFor(locationId: string, prompt: PromptTemplate | undefined, reviews: Record<string, EligibilityReview>, factEdits: Record<string, FactEdit>): EligibilityView {
  const r = prompt ? reviews[eligibilityKey(locationId, prompt.id)] : undefined
  if (r) {
    return {
      status: r.status,
      source: 'review',
      basis: r.status === 'not_relevant' ? NOT_RELEVANT_REASONS[r.reason ?? 'other'] + (r.note ? ` — ${r.note}` : '') : r.note ?? 'Confirmed as a good match',
      reviewer: `${r.byName} (${r.by === 'brand' ? 'Brand' : 'ProManage'})`,
      reason: r.reason,
      at: r.at,
    }
  }
  const loc = effectiveLocation(locationId, factEdits)
  const req = requirement(loc, prompt)
  if (req.verdict === 'yes') return { status: 'eligible', source: 'record', basis: req.basis, reviewer: 'Verified business record' }
  const candidate = SERVICE_CANDIDATES[locationId]?.find((c) => c.promptId === prompt?.id)
  return {
    status: 'unknown',
    source: 'suggestion',
    basis: candidate ? `${req.basis}. ${candidate.service} is listed in a centre document but not approved yet.` : req.basis,
    reviewer: 'Needs review',
    suggestion: candidate || req.verdict === 'unknown' ? (candidate ? 'confirm_service' : 'review') : 'mark_not_relevant',
    candidate: candidate ? { service: candidate.service, source: candidate.source } : undefined,
  }
}

export const isUnbranded = (o: Observation, prompts: Record<string, PromptTemplate>) => !!prompts[o.promptId]?.includeInDiscoveryMetric

/** Competitor names that appear in a sampled answer (context only — not market share or causal proof). */
export function competitorsIn(o: Observation) {
  return COMPETITORS.filter((c) => o.answerText.includes(c))
}

/* ───────────── Seeded, simulated readiness snapshots ───────────── */

type Facts = Record<FactKey, string | null>

interface FindingSeed {
  key: string
  category: ReadinessFinding['category']
  surface: 'web' | 'listing' | 'dir' | 'sitemap'
  sourceOwner: ReadinessFinding['sourceOwner']
  promptIds: string[]
  certainty: ReadinessFinding['certainty']
  observation: string
  snapshot?: string
  /** The gap can only be confirmed once these facts are verified (and contain the text, if given). */
  needs?: { key: FactKey; contains?: string }[]
  needsSiteOwner?: boolean
  linkedAccuracyField?: FieldKey
  coveredByAccuracy?: boolean
  recommend?: (f: Facts, loc: Location) => Omit<OptimizationRecommendation, 'id' | 'findingId' | 'gapConfidence'>
}

const AI_NOTE = 'Makes accurate information easier to find. It does not guarantee any AI assistant will mention the centre.'

const montessori = (f: Facts) => (f.programs ?? '').split(',').map((s) => s.trim()).find((s) => /montessori/i.test(s)) ?? 'Montessori programme'

const SEEDS: Record<string, FindingSeed[]> = {
  whitefield: [
    {
      key: 'content-montessori',
      category: 'content',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p5'],
      certainty: 'confirmed_gap',
      needs: [{ key: 'programs', contains: 'montessori' }],
      observation: 'The centre page lists Playgroup–UKG admissions and daycare but never mentions the Montessori programme.',
      snapshot: 'BrightNest Whitefield offers Playgroup, Nursery, LKG and UKG, with an on-site daycare. Admissions are open for the next term.',
      recommend: (f, loc) => ({
        channel: 'owned_website',
        controlledSource: `Centre page — ${f.website}`,
        owner: 'BrightNest website team',
        title: 'Add a factual Montessori summary and FAQ to the centre page',
        brandTitle: 'Describe your Montessori programme on the Whitefield centre page',
        currentText: 'BrightNest Whitefield offers Playgroup, Nursery, LKG and UKG, with an on-site daycare. Admissions are open for the next term.',
        proposedText: `BrightNest ${loc.neighborhood} offers ${f.programs}. The centre is at ${f.address} and is open ${f.hours}.\n\nDoes BrightNest ${loc.neighborhood} offer a Montessori programme?\nYes — ${montessori(f)}. Call ${f.phone} to ask about admissions.`,
        businessFactIds: ['programs', 'address', 'hours', 'phone'].map((k) => factId(loc.id, k as FactKey)),
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
      }),
    },
    {
      key: 'content-saturday',
      category: 'content',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p2'],
      certainty: 'confirmed_gap',
      needs: [{ key: 'saturdayTours' }],
      linkedAccuracyField: 'saturdayTours',
      coveredByAccuracy: true,
      observation: 'The page only says “Weekday campus visits only (9 AM–4 PM)”. It doesn’t answer whether parents can visit on a Saturday.',
      snapshot: 'Campus visits: weekday campus visits only (9 AM–4 PM).',
      recommend: (f, loc) => ({
        channel: 'owned_website',
        controlledSource: `Centre page — ${f.website}`,
        owner: 'BrightNest website team',
        title: 'Add a “Can I visit on Saturday?” answer using the verified tour times',
        brandTitle: 'Answer “Can I visit on Saturday?” on the centre page',
        currentText: 'Campus visits: weekday campus visits only (9 AM–4 PM).',
        proposedText: `Can I visit BrightNest ${loc.neighborhood} on a Saturday?\nYes — ${f.saturdayTours}, by booking. Regular classes and daycare run ${f.hours}.`,
        businessFactIds: [factId(loc.id, 'saturdayTours'), factId(loc.id, 'hours')],
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
        dependency: 'Same page as the Saturday-tours accuracy correction. The page edit can be shared; accuracy and discovery outcomes are tracked separately.',
      }),
    },
    {
      key: 'listing-services',
      category: 'listing',
      surface: 'listing',
      sourceOwner: 'promanage_managed',
      promptIds: ['p5'],
      certainty: 'confirmed_gap',
      needs: [{ key: 'programs', contains: 'montessori' }],
      observation: 'The managed listing’s services show “Preschool · Daycare”. The Montessori programme isn’t listed.',
      snapshot: 'Services: Preschool · Daycare',
      recommend: (f, loc) => ({
        channel: 'managed_listing',
        controlledSource: 'Google Business Profile — ProManage Listing Management',
        owner: 'ProManage',
        title: 'Add the verified Montessori programme to the managed listing services',
        brandTitle: 'List the Montessori programme on your Google Business Profile',
        currentText: 'Services: Preschool · Daycare',
        proposedText: `Services: Preschool · Daycare · ${montessori(f)}`,
        businessFactIds: [factId(loc.id, 'programs')],
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
      }),
    },
    {
      key: 'structured-data',
      category: 'structured_data',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p1', 'p5'],
      certainty: 'confirmed_gap',
      observation: 'No LocalBusiness / Preschool structured data was found in the centre page source.',
      snapshot: 'Page source: no schema.org markup detected.',
      recommend: (_f, loc) => ({
        channel: 'structured_info',
        controlledSource: 'Centre page — generated in GEO Readiness',
        owner: 'ProManage',
        title: 'Publish JSON-LD generated from verified facts (GEO Readiness)',
        brandTitle: 'Technical information prepared by ProManage for the centre page',
        businessFactIds: ['name', 'address', 'phone', 'hours', 'programs'].map((k) => factId(loc.id, k as FactKey)),
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: 'Structured data helps supported systems read the facts. It does not guarantee inclusion in any AI answer.',
        technicalAssetIds: ['jsonld'],
      }),
    },
    {
      key: 'freshness-sitemap',
      category: 'freshness',
      surface: 'sitemap',
      sourceOwner: 'brand',
      promptIds: ['p1'],
      certainty: 'potential_gap',
      needsSiteOwner: true,
      observation: 'The sitemap lists the centre page with a last-modified date of 12 Mar 2024. A snapshot can’t tell whether that date is accurate or whether search systems have re-read the page since.',
      snapshot: '<lastmod>2024-03-12</lastmod>',
      recommend: () => ({
        channel: 'owned_website',
        controlledSource: 'Sitemap — brightnest.example/sitemap.xml',
        owner: 'BrightNest website team',
        title: 'Ask the web team to confirm the sitemap date matches the real last update',
        brandTitle: 'Page accessibility check — confirm the page’s update date',
        requiresBrandApproval: false,
        businessFactIds: [],
        effort: 'Small',
        aiImpactNote: 'Only change the date if the page really changed. A truthful date can’t be forced to affect AI answers.',
      }),
    },
    {
      key: 'offsite-directory',
      category: 'offsite',
      surface: 'dir',
      sourceOwner: 'third_party',
      promptIds: ['p1', 'p5'],
      certainty: 'potential_gap',
      observation: 'Bengaluru Preschool Directory lists the centre with an address and phone number only — no programmes.',
      snapshot: 'BrightNest Whitefield · 14 Palm Grove Road · +91 80 4000 1101',
      recommend: (f, loc) => ({
        channel: 'external_request',
        controlledSource: 'Bengaluru Preschool Directory — independent site (request only)',
        owner: 'ProManage',
        title: 'Request the directory add the verified programme list',
        brandTitle: 'Ask Bengaluru Preschool Directory to add your programmes',
        currentText: 'No programmes listed.',
        proposedText: `Programmes: ${f.programs}`,
        businessFactIds: [factId(loc.id, 'programs')],
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: 'The directory decides whether to change its page. No ranking benefit is implied.',
      }),
    },
  ],
  'hsr-layout': [
    {
      key: 'content-daycare',
      category: 'content',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p3'],
      certainty: 'confirmed_gap',
      needs: [{ key: 'hours' }],
      linkedAccuracyField: 'hours',
      observation: 'The page mentions daycare in one line but doesn’t answer “daycare and extended hours” questions — and it still shows the old Mon–Sat hours.',
      snapshot: 'Our centre: Playgroup to UKG and daycare. Open Mon–Sat 9 AM–6 PM.',
      recommend: (f, loc) => ({
        channel: 'owned_website',
        controlledSource: `Centre page — ${f.website}`,
        owner: 'BrightNest website team',
        title: 'Add a daycare and extended-hours answer using verified hours',
        brandTitle: 'Answer “Do you offer daycare and extended hours?” on the centre page',
        currentText: 'Our centre: Playgroup to UKG and daycare. Open Mon–Sat 9 AM–6 PM.',
        proposedText: `Does BrightNest ${loc.neighborhood} offer daycare and extended hours?\nYes — daycare runs alongside ${f.programs}. The centre is open ${f.hours}.`,
        businessFactIds: [factId(loc.id, 'programs'), factId(loc.id, 'hours')],
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
        dependency: 'Publish with (or after) the opening-hours correction on this page. The two are tracked separately.',
      }),
    },
    { key: 'listing-services', category: 'listing', surface: 'listing', sourceOwner: 'promanage_managed', promptIds: ['p3'], certainty: 'no_gap', observation: 'Listing services include Daycare and the verified hours.' },
  ],
  indiranagar: [
    {
      key: 'content-intro',
      category: 'content',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p1'],
      certainty: 'confirmed_gap',
      observation: 'The centre page has an enquiry form but no short description of the centre, its programmes or where it is.',
      snapshot: 'Welcome to BrightNest Indiranagar! Enquire now.',
      recommend: (f, loc) => ({
        channel: 'owned_website',
        controlledSource: `Centre page — ${f.website}`,
        owner: 'BrightNest website team',
        title: 'Add a short factual introduction to the centre page',
        brandTitle: 'Add a short introduction to the Indiranagar centre page',
        currentText: 'Welcome to BrightNest Indiranagar! Enquire now.',
        proposedText: `BrightNest ${loc.neighborhood} is a preschool at ${f.address}. It offers ${f.programs} and is open ${f.hours}. Call ${f.phone} to arrange a visit.`,
        businessFactIds: ['address', 'programs', 'hours', 'phone'].map((k) => factId(loc.id, k as FactKey)),
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
      }),
    },
    { key: 'listing-services', category: 'listing', surface: 'listing', sourceOwner: 'promanage_managed', promptIds: ['p1'], certainty: 'no_gap', observation: 'Listing services, category and hours match the verified record.' },
    { key: 'offsite-directory', category: 'offsite', surface: 'dir', sourceOwner: 'third_party', promptIds: ['p1'], certainty: 'potential_gap', linkedAccuracyField: 'phone', observation: 'CityKids Directory shows an old phone number. This is tracked as an information accuracy issue, not part of a discovery plan.' },
  ],
  jayanagar: [
    {
      key: 'content-daycare',
      category: 'content',
      surface: 'web',
      sourceOwner: 'brand',
      promptIds: ['p1', 'p3'],
      certainty: 'confirmed_gap',
      observation: 'The page lists classes only. It doesn’t mention the on-site daycare, its hours, or describe the centre.',
      snapshot: 'BrightNest Jayanagar — Playgroup, Nursery, LKG, UKG.',
      recommend: (f, loc) => ({
        channel: 'owned_website',
        controlledSource: `Centre page — ${f.website}`,
        owner: 'BrightNest website team',
        title: 'Describe the centre and its daycare hours on the centre page',
        brandTitle: 'Describe the centre and its daycare on the Jayanagar page',
        currentText: 'BrightNest Jayanagar — Playgroup, Nursery, LKG, UKG.',
        proposedText: `BrightNest ${loc.neighborhood} is a preschool at ${f.address}, offering ${f.programs}.\n\nDo you offer daycare and extended hours?\nYes — the centre and daycare are open ${f.hours}.`,
        businessFactIds: ['address', 'programs', 'hours'].map((k) => factId(loc.id, k as FactKey)),
        requiresBrandApproval: true,
        effort: 'Small',
        aiImpactNote: AI_NOTE,
      }),
    },
    { key: 'offsite-directory', category: 'offsite', surface: 'dir', sourceOwner: 'third_party', promptIds: ['p1'], certainty: 'unknown', observation: 'KinderFinder couldn’t be captured in the snapshot — manual check required. No action proposed.' },
  ],
  koramangala: [
    { key: 'content-page', category: 'content', surface: 'web', sourceOwner: 'brand', promptIds: ['p4'], certainty: 'no_gap', observation: 'The page describes programmes, daycare hours, the Saturday open house and location, consistent with the verified record.' },
    { key: 'listing-services', category: 'listing', surface: 'listing', sourceOwner: 'promanage_managed', promptIds: ['p4'], certainty: 'no_gap', observation: 'Listing services, category and hours match the verified record.' },
    { key: 'structured-data', category: 'structured_data', surface: 'web', sourceOwner: 'brand', promptIds: ['p4'], certainty: 'no_gap', observation: 'Structured data is present and consistent with verified facts.' },
    { key: 'offsite-reviews', category: 'offsite', surface: 'dir', sourceOwner: 'unknown', promptIds: ['p4'], certainty: 'no_gap', observation: 'Parent reviews are outside this plan. Any review activity must be genuine — never bought, incentivised without disclosure, or posted by staff.' },
  ],
}

function defaultSeeds(locationId: string): FindingSeed[] {
  const loc = LOCATION_BY_ID[locationId]
  const sources = sourceRecordsFor(locationId)
  const listing = sources.find((s) => s.channel === 'managed_listing')
  const divergent = (Object.entries(listing?.values ?? {}) as [FieldKey, string | null][]).find(([k, v]) => v !== null && loc.verifiedFields[k].status === 'verified' && v !== loc.verifiedFields[k].value)
  const unverified = (Object.entries(loc.verifiedFields) as [FieldKey, { status: string }][]).filter(([, f]) => f.status !== 'verified').map(([k]) => k)
  return [
    unverified.length
      ? { key: 'content-page', category: 'content', surface: 'web', sourceOwner: 'brand', promptIds: [], certainty: 'unknown', observation: `Some facts aren’t verified in the record (${unverified.join(', ')}), so page content can’t be checked against them yet.` }
      : { key: 'content-page', category: 'content', surface: 'web', sourceOwner: 'brand', promptIds: [], certainty: 'no_gap', observation: 'The centre page lists programmes, hours and contact details consistent with the verified record.' },
    divergent
      ? { key: 'listing-services', category: 'listing', surface: 'listing', sourceOwner: 'promanage_managed', promptIds: [], certainty: 'potential_gap', linkedAccuracyField: divergent[0], observation: `The managed listing shows a different ${divergent[0] === 'operatingStatus' ? 'open/closed status' : divergent[0]}. This is tracked as an information accuracy issue, not part of a discovery plan.` }
      : { key: 'listing-services', category: 'listing', surface: 'listing', sourceOwner: 'promanage_managed', promptIds: [], certainty: 'no_gap', observation: 'Listing services, category and hours match the verified record.' },
  ]
}

const SURFACE_LABEL = (s: FindingSeed['surface'], locationId: string) => {
  const src = sourceRecordsFor(locationId)
  if (s === 'web') return { label: 'Official centre page', url: src.find((r) => r.channel === 'owned_website')?.url }
  if (s === 'listing') return { label: 'Google Business Profile (managed in ProManage)', url: src.find((r) => r.channel === 'managed_listing')?.url }
  if (s === 'sitemap') return { label: 'Website sitemap', url: 'https://brightnest.example/sitemap.xml' }
  const dir = src.find((r) => r.channel === 'external_directory')
  return { label: dir?.label ?? 'Third-party directories', url: dir?.url }
}

const factsOf = (locationId: string, edits: Record<string, FactEdit>): Facts => {
  const loc = effectiveLocation(locationId, edits)
  const out = Object.fromEntries(Object.entries(loc.verifiedFields).map(([k, f]) => [k, f.status === 'verified' ? f.value : null])) as Facts
  return out
}

export interface FindingWithDraft extends ReadinessFinding {
  draft?: OptimizationRecommendation
}

/** Readiness findings for an opportunity from seeded snapshots, evaluated against the current verified facts. */
export function readinessFindings(opp: Pick<DiscoveryOpportunity, 'id' | 'locationId'>, edits: Record<string, FactEdit>, inspectedAt: string): FindingWithDraft[] {
  const seeds = SEEDS[opp.locationId] ?? defaultSeeds(opp.locationId)
  const facts = factsOf(opp.locationId, edits)
  const loc = LOCATION_BY_ID[opp.locationId]
  return seeds.map((s) => {
    const missing = (s.needs ?? []).filter((n) => !facts[n.key] || (n.contains && !has(facts[n.key], n.contains)))
    const blocked = missing.length > 0
    const surf = SURFACE_LABEL(s.surface, opp.locationId)
    const id = `${opp.id}:${s.key}`
    const certainty = blocked && s.certainty === 'confirmed_gap' ? 'potential_gap' : s.certainty
    const draft = s.recommend && !blocked ? { ...s.recommend(facts, loc), id: `rec-${s.key}`, findingId: id, gapConfidence: certainty === 'confirmed_gap' ? ('Confirmed gap' as const) : ('Potential gap' as const) } : undefined
    return {
      id,
      opportunityId: opp.id,
      category: s.category,
      surfaceLabel: surf.label,
      url: surf.url,
      inspectedAt,
      evidenceType: s.needs?.length ? 'verified_business_fact' : 'simulated_snapshot',
      sourceOwner: s.sourceOwner,
      observation: s.observation,
      snapshot: s.snapshot,
      confirmedGap: certainty === 'confirmed_gap',
      certainty,
      factualEvidenceIds: (s.needs ?? []).map((n) => factId(opp.locationId, n.key)),
      promptIds: s.promptIds,
      needsSiteOwner: s.needsSiteOwner,
      linkedAccuracyField: s.linkedAccuracyField,
      coveredByAccuracy: s.coveredByAccuracy,
      blockedReason: blocked ? `Needs a confirmed business fact first: ${missing.map((m) => (m.contains ? `${m.contains[0].toUpperCase()}${m.contains.slice(1)} in the programme list` : m.key)).join(', ')}` : undefined,
      recommendedAction: draft?.title,
      draft,
    }
  })
}

export const CATEGORY_LABEL: Record<ReadinessFinding['category'], string> = {
  content: 'Content & direct answers',
  listing: 'Connected listing',
  structured_data: 'Structured data',
  crawl_access: 'Page accessibility',
  freshness: 'Recency & publication',
  offsite: 'Off-site information',
}

/* ───────────── Matched recheck ───────────── */

/** Simulated measurement-context changes that make a follow-up incomparable for a centre. */
const CONTEXT_CHANGES: Record<string, Record<number, string>> = {
  jayanagar: { 1: 'Follow-up 1 for this centre was sampled with a city-wide location setting instead of Jayanagar (simulated provider setting change). The questions aren’t equivalent, so no before/after is shown.' },
}

export function compareDiscovery(
  opp: DiscoveryOpportunity,
  baseline: Observation[],
  later: Observation[],
  recheck: Recheck,
  eligiblePromptIds: Set<string>,
  updatesRecordedAt: string | null,
): DiscoveryRecheck {
  const mine = (list: Observation[]) => list.filter((o) => o.locationId === opp.locationId && eligiblePromptIds.has(o.promptId))
  const b = mine(baseline)
  const l = mine(later)
  const reason = CONTEXT_CHANGES[opp.locationId]?.[recheck.wave]
  const keys = b.map((o) => o.promptId)
  const sameCohort = keys.length === l.length && keys.every((k) => l.some((o) => o.promptId === k && o.surface === b[0]?.surface))
  const comparable = !reason && sameCohort && b.length > 0
  const targets = opp.targetPromptIds.filter((p) => eligiblePromptIds.has(p))
  const targetAfter = l.filter((o) => targets.includes(o.promptId) && o.mentioned).length
  const outcome: DiscoveryRecheck['outcome'] = !comparable ? 'inconclusive' : targets.length === 0 ? 'mention_observed' : targetAfter === targets.length ? 'mention_observed' : targetAfter === 0 ? 'still_absent' : 'mixed'
  return {
    id: `${opp.id}-w${recheck.wave}`,
    opportunityId: opp.id,
    baselineAuditId: opp.auditId,
    recheckWave: recheck.wave,
    normalizedPromptKeys: keys.map((k) => `${opp.locationId}:${k}:A:en-IN`),
    locationId: opp.locationId,
    measurementSurface: 'AI search · Surface A',
    comparable,
    nonComparabilityReason: reason ?? (!sameCohort ? 'The follow-up didn’t sample the same questions for this centre.' : undefined),
    baselineMentionCount: b.filter((o) => o.mentioned).length,
    baselineEligibleCount: b.length,
    recheckMentionCount: l.filter((o) => o.mentioned).length,
    recheckEligibleCount: l.length,
    targetMentionedAfter: targetAfter,
    targetCount: targets.length,
    sampledAt: recheck.sampledAt,
    afterUpdates: !!updatesRecordedAt && new Date(updatesRecordedAt).getTime() <= new Date(recheck.createdAt).getTime(),
    outcome,
    simulated: true,
  }
}

/* ───────────── Opportunity derivation ───────────── */

export interface DeriveContext {
  prompts: Record<string, PromptTemplate>
  eligibility: Record<string, EligibilityReview>
  factEdits: Record<string, FactEdit>
  records: Record<string, DiscoveryRecord>
  tasks: Task[]
  release: Release
}

const RANK: Record<Release, number> = { MVP: 0, V1: 1, V2: 2 }

const INTENT_LABEL: Record<string, string> = {
  p1: 'Best preschools nearby',
  p2: 'Saturday visits',
  p3: 'Daycare & extended hours',
  p4: 'Parent reviews',
  p5: 'Montessori programmes',
  p9: 'Toddler playgroups',
}

export const intentLabel = (promptId: string, prompts: Record<string, PromptTemplate>) => INTENT_LABEL[promptId] ?? prompts[promptId]?.text.replace(/\{neighborhood\}|\{city\}/g, '').replace(/\s+/g, ' ').trim() ?? promptId

export const DONE_TASK = ['source_updated', 'awaiting_recheck', 'closed']

/** When the plan's controlled-source work was all recorded (null until every task is done). */
export function updatesRecordedAt(rec: DiscoveryRecord | undefined, tasks: Task[]): string | null {
  const plan = rec?.plan
  if (!plan || plan.status !== 'approved' || !plan.taskIds.length) return null
  const own = tasks.filter((t) => plan.taskIds.includes(t.id))
  if (!own.length || !own.every((t) => DONE_TASK.includes(t.status))) return null
  const times = own.flatMap((t) => t.activity.filter((a) => /Status → (Source updated|Request sent|Awaiting AI recheck)|Update recorded/.test(a.text)).map((a) => a.at))
  return times.sort().pop() ?? plan.updatedAt
}

/** When the first plan update was recorded on any source (partial publication still counts as “updates recorded”). */
export function anyUpdateRecordedAt(rec: DiscoveryRecord | undefined, tasks: Task[]): string | null {
  const plan = rec?.plan
  if (!plan || plan.status !== 'approved') return null
  const done = tasks.filter((t) => plan.taskIds.includes(t.id) && DONE_TASK.includes(t.status))
  const times = done.flatMap((t) => t.activity.filter((a) => /Status → |Update recorded/.test(a.text)).map((a) => a.at))
  return times.sort().pop() ?? null
}

export function deriveOpportunities(audit: Audit, observations: Observation[], ctx: DeriveContext): DiscoveryOpportunity[] {
  const out: DiscoveryOpportunity[] = []
  for (const locId of audit.locationIds) {
    const unbranded = observations.filter((o) => o.locationId === locId && isUnbranded(o, ctx.prompts))
    const missed = unbranded.filter((o) => !o.mentioned)
    if (!missed.length) continue
    const id = discoveryId(audit.id, locId)
    const rec = ctx.records[id]
    const elig = (pid: string) => eligibilityFor(locId, ctx.prompts[pid], ctx.eligibility, ctx.factEdits).status
    const targets = missed.filter((o) => elig(o.promptId) !== 'not_relevant')
    const eligibility: EligibilityStatus = targets.some((o) => elig(o.promptId) === 'eligible') ? 'eligible' : targets.length ? 'unknown' : 'not_relevant'
    const opp: DiscoveryOpportunity = {
      id,
      organizationId: ORG.id,
      auditId: audit.id,
      locationId: locId,
      observationIds: unbranded.map((o) => o.id),
      missedPromptIds: missed.map((o) => o.promptId),
      targetPromptIds: targets.map((o) => o.promptId),
      intentCategory: [...new Set(targets.map((o) => intentLabel(o.promptId, ctx.prompts)))].join(' · ') || 'No eligible questions',
      promptGroupId: `${audit.id}:unbranded`,
      eligibility,
      status: 'observed',
      createdAt: audit.createdAt,
      lastUpdatedAt: rec?.history[rec.history.length - 1]?.at ?? audit.createdAt,
      readinessFindingIds: [],
      planId: rec?.plan?.id,
    }
    opp.status = statusOf(opp, rec, ctx)
    opp.readinessFindingIds = rec?.investigation ? readinessFindings(opp, ctx.factEdits, rec.investigation.checkedAt ?? audit.createdAt).map((f) => f.id) : []
    out.push(opp)
  }
  return out
}

/** One underlying status derived from the decision, investigation, plan and task facts (no parallel flags). */
export function statusOf(opp: DiscoveryOpportunity, rec: DiscoveryRecord | undefined, ctx: Pick<DeriveContext, 'tasks' | 'release'>): DiscoveryStatus {
  if (rec?.archived) return 'archived'
  if (opp.eligibility === 'not_relevant' || rec?.decision?.kind === 'dismissed') return 'not_relevant'
  if (rec?.decision?.kind !== 'worth_investigating' && !rec?.investigation) return opp.eligibility === 'unknown' ? 'eligibility_review' : 'observed'
  if (RANK[ctx.release] < 1) return 'qualified'
  const inv = rec?.investigation
  if (!inv) return 'qualified'
  if (rec?.monitorOnly || inv.result === 'no_gap') return 'no_gap'
  const plan = rec?.plan
  if (!plan) return 'investigating'
  if (plan.status === 'draft') return 'proposal_draft'
  if (plan.status === 'awaiting_brand_approval') return 'awaiting_approval'
  if (plan.status === 'changes_requested') return 'changes_requested'
  if (plan.status === 'declined') return 'declined'
  return updatesRecordedAt(rec, ctx.tasks) ? 'awaiting_recheck' : 'implementing'
}

/* ───────────── Brand-facing language (PRD §9) ───────────── */

export type BrandTone = 'warning' | 'blue' | 'danger' | 'neutral' | 'teal' | 'success'

export const DISCOVERY_STAGE: Record<DiscoveryStatus, { label: string; tone: BrandTone; cta: string; pmLabel: string }> = {
  observed: { label: 'Not mentioned in some selected searches', tone: 'neutral', cta: 'Review searches', pmLabel: 'Observed' },
  eligibility_review: { label: 'Does this search match your centre?', tone: 'warning', cta: 'Check relevance', pmLabel: 'Eligibility review' },
  qualified: { label: 'Worth investigating — saved for ProManage', tone: 'blue', cta: 'View details', pmLabel: 'Qualified' },
  not_relevant: { label: 'Not relevant to these searches', tone: 'neutral', cta: 'View details', pmLabel: 'Not relevant' },
  investigating: { label: 'ProManage is checking your centre’s information', tone: 'blue', cta: 'View progress', pmLabel: 'Investigating' },
  proposal_draft: { label: 'ProManage is checking your centre’s information', tone: 'blue', cta: 'View progress', pmLabel: 'Proposal draft' },
  no_gap: { label: 'No clear information change to make — monitoring', tone: 'neutral', cta: 'View details', pmLabel: 'Monitor only' },
  awaiting_approval: { label: 'Suggested improvements ready', tone: 'warning', cta: 'Review suggested improvements', pmLabel: 'Awaiting Brand approval' },
  changes_requested: { label: 'ProManage is revising the suggestions', tone: 'blue', cta: 'View progress', pmLabel: 'Changes requested' },
  declined: { label: 'You declined the suggestions', tone: 'neutral', cta: 'View details', pmLabel: 'Declined' },
  implementing: { label: 'Update in progress', tone: 'blue', cta: 'Track updates', pmLabel: 'Implementing' },
  awaiting_recheck: { label: 'Website or listing update recorded — waiting for the next AI check', tone: 'warning', cta: 'Track updates', pmLabel: 'Source update recorded · awaiting recheck' },
  rechecked: { label: 'Latest follow-up AI check available', tone: 'blue', cta: 'View latest check', pmLabel: 'Rechecked' },
  archived: { label: 'Archived', tone: 'neutral', cta: 'View details', pmLabel: 'Archived' },
}

export const RECHECK_OUTCOME: Record<DiscoveryRecheck['outcome'], { label: string; brand: string; tone: BrandTone }> = {
  mention_observed: { label: 'Mention observed', brand: 'Mentioned in the latest follow-up AI check', tone: 'success' },
  mixed: { label: 'Mixed', brand: 'Mentioned in some of the selected searches', tone: 'blue' },
  still_absent: { label: 'Still absent', brand: 'Still not mentioned in the selected searches', tone: 'neutral' },
  inconclusive: { label: 'Inconclusive', brand: 'Inconclusive — measurement conditions changed', tone: 'warning' },
}

/* ───────────── Metrics (separate denominators, PRD §7) ───────────── */

export interface DiscoveryMetrics {
  /** All completed unbranded observations in scope. */
  total: number
  mentioned: number
  notMentioned: number
  /** Eligible observations (decided by a person or matched by the verified record). */
  eligible: number
  eligibleMentioned: number
  awaitingReview: number
  notRelevant: number
  /** Any BrightNest branch named instead — brand-level only, never counted as this outlet. */
  brandOnly: number
}

export function discoveryMetrics(observations: Observation[], ctx: Pick<DeriveContext, 'prompts' | 'eligibility' | 'factEdits'>): DiscoveryMetrics {
  const d = observations.filter((o) => isUnbranded(o, ctx.prompts))
  const status = (o: Observation) => eligibilityFor(o.locationId, ctx.prompts[o.promptId], ctx.eligibility, ctx.factEdits).status
  const eligible = d.filter((o) => status(o) === 'eligible')
  return {
    total: d.length,
    mentioned: d.filter((o) => o.mentioned).length,
    notMentioned: d.filter((o) => !o.mentioned).length,
    eligible: eligible.length,
    eligibleMentioned: eligible.filter((o) => o.mentioned).length,
    awaitingReview: d.filter((o) => status(o) === 'unknown').length,
    notRelevant: d.filter((o) => status(o) === 'not_relevant').length,
    brandOnly: d.filter((o) => o.mentionedBrand && !o.mentioned).length,
  }
}
