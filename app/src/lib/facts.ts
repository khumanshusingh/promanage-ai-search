import type { BusinessFact, FactEdit, FactKey, FieldKey, Location } from '@/data/types'
import { FIELD_LABELS, GEO, LOCATION_BY_ID } from '@/data/seed'

/*
  Business facts = the verified location record, viewed fact-by-fact, with any
  verification/edits made in GEO Readiness layered on top.
*/

export const FACT_ORDER: FactKey[] = ['name', 'operatingStatus', 'address', 'geo', 'phone', 'website', 'hours', 'saturdayTours', 'programs']

export const FACT_LABELS: Record<FactKey, string> = { ...FIELD_LABELS, geo: 'Coordinates', hours: 'General opening hours', saturdayTours: 'Saturday tours (visiting hours)' }

const APPLICABILITY: Record<FactKey, string> = {
  name: 'Identity',
  operatingStatus: 'Whole center',
  address: 'Location',
  geo: 'Location',
  phone: 'Contact',
  website: 'Contact',
  hours: 'General operating hours (classes & daycare)',
  saturdayTours: 'Campus tours by appointment — not operating hours',
  programs: 'Services offered',
}

const WHERE_USED: Record<FactKey, string[]> = {
  name: ['JSON-LD', 'Fact sheet', 'Listing'],
  operatingStatus: ['Fact sheet', 'Listing'],
  address: ['JSON-LD', 'Fact sheet', 'Listing'],
  geo: ['JSON-LD'],
  phone: ['JSON-LD', 'Fact sheet', 'Listing'],
  website: ['JSON-LD', 'Fact sheet'],
  hours: ['JSON-LD', 'Fact sheet', 'Listing'],
  saturdayTours: ['Fact sheet FAQ'],
  programs: ['JSON-LD', 'Fact sheet'],
}

export const factId = (locationId: string, key: FactKey) => `${locationId}:${key}`

export function buildFacts(locationId: string, edits: Record<string, FactEdit>): BusinessFact[] {
  const loc = LOCATION_BY_ID[locationId]
  if (!loc) return []
  return FACT_ORDER.map((key) => {
    const id = factId(locationId, key)
    const base =
      key === 'geo'
        ? { value: GEO[locationId] ?? null, status: GEO[locationId] ? 'verified' : 'unknown', note: GEO[locationId] ? undefined : 'Coordinates not captured in the master record.' }
        : loc.verifiedFields[key as FieldKey]
    let status: BusinessFact['verificationStatus'] = base.status === 'verified' && base.value ? 'verified' : base.value || base.status === 'needs_verification' ? 'unverified' : 'missing'
    let value = base.value
    const edit = edits[id]
    const fact: BusinessFact = {
      id,
      locationId,
      key,
      label: FACT_LABELS[key],
      value,
      verificationStatus: status,
      verifiedBy: status === 'verified' ? loc.sourceOwner.replace(/ \(.*\)$/, '') : undefined,
      verifiedAt: status === 'verified' ? loc.lastVerifiedAt : undefined,
      sourceOwner: loc.sourceOwner,
      applicability: APPLICABILITY[key],
      whereUsed: WHERE_USED[key],
      note: 'note' in base ? base.note : undefined,
    }
    if (edit?.status === 'verified') {
      value = edit.value ?? value
      status = 'verified'
      Object.assign(fact, { value, verificationStatus: status, verifiedBy: edit.by, verifiedAt: edit.at, note: undefined })
    } else if (edit?.status === 'pending_approval') {
      Object.assign(fact, { verificationStatus: 'pending_approval', proposedValue: edit.value })
    } else if (edit?.status === 'requested') {
      fact.requested = true
    }
    return fact
  })
}

/** Location record with verified fact edits applied — used to evaluate claims in later rechecks. */
export function effectiveLocation(locationId: string, edits: Record<string, FactEdit>): Location {
  const loc = LOCATION_BY_ID[locationId]
  const relevant = Object.entries(edits).filter(([id, e]) => id.startsWith(`${locationId}:`) && e.status === 'verified' && e.value)
  if (!relevant.length) return loc
  const fields = { ...loc.verifiedFields }
  for (const [id, e] of relevant) {
    const key = id.split(':')[1] as FactKey
    if (key !== 'geo') fields[key] = { value: e.value!, status: 'verified' }
  }
  return { ...loc, verifiedFields: fields }
}
