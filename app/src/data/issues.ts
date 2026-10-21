import type { ExtractedClaim, FactEdit, FieldKey, Issue, Observation, PromptTemplate, Severity } from './types'
import { FIELD_LABELS, LOCATION_BY_ID, LOCATIONS, sourceRecordsFor } from './seed'

const LOCATIONS_PILOT = LOCATIONS.filter((l) => l.isPilot)
import { effectiveLocation } from '@/lib/facts'

/*
  Issue rubric (PRD §S5):
  High   — wrong phone/address, false closed status, unsupported sensitive claims, materially wrong service availability
  Medium — incorrect opening hours; inconsistent controlled content; record gaps on contact-critical fields
  Low    — minor detail or a one-off omission that needs more evidence
*/

const MISMATCH_SEVERITY: Record<FieldKey, Severity> = {
  operatingStatus: 'high',
  phone: 'high',
  address: 'high',
  saturdayTours: 'high',
  programs: 'high',
  hours: 'medium',
  name: 'low',
  website: 'low',
}

const MISMATCH_EXPLANATIONS: Record<string, string[]> = {
  saturdayTours: [
    'A third-party directory page cited in this response may still carry an older visit policy.',
    'The center page may not state Saturday tours prominently enough for the answer to pick up.',
    'The answer may be generalising from other centers that only offer weekday visits.',
  ],
  phone: ['An outdated number may still be listed on a directory or aggregator page.', 'Call-tracking or a previous landline may be associated with the center elsewhere.'],
  hours: ['A listing may still show seasonal or older hours.', 'Daycare hours and class hours may be conflated.'],
  address: ['The answer may be conflating this center with a nearby BrightNest center.', 'A directory may hold a stale or approximate pin location.'],
  operatingStatus: [
    'A managed listing may carry a temporary-closure flag that was never removed.',
    'An independent directory may have marked the center closed after a past renovation.',
  ],
  default: ['A source outside BrightNest’s control may carry different information.', 'The answer may be summarising incompletely.'],
}

export function issueIdFor(auditId: string, locationId: string, promptId: string, kind: string) {
  const first = auditId === 'aud-001' || auditId === 'demo-001'
  if (first && locationId === 'whitefield' && promptId === 'p6' && kind === 'mismatch') return 'issue-saturday-tours'
  if (first && locationId === 'hsr-layout' && promptId === 'p7' && kind === 'mismatch') return 'issue-hsr-hours'
  return `iss-${auditId}-${locationId}-${promptId}-${kind}`
}

/** Sources whose stated value differs from the verified fact (possible explanations, never proven causes). */
function divergentSources(locationId: string, field: FieldKey, verified: string | null) {
  return sourceRecordsFor(locationId)
    .filter((s) => field in s.values && (s.values[field] ?? null) !== verified)
    .map((s) => s.id)
}

export function deriveIssues(auditId: string, observations: Observation[], promptsById: Record<string, PromptTemplate>, edits: Record<string, FactEdit> = {}): Issue[] {
  const issues: Issue[] = []
  const seenRecordGaps = new Set<string>()

  for (const obs of observations) {
    const loc = LOCATION_BY_ID[obs.locationId]
    if (!loc) continue
    obs.extractedClaims.forEach((c: ExtractedClaim) => {
      if (c.evaluation === 'mismatch' && c.field !== 'other') {
        const other = c.field === 'address' ? LOCATIONS_PILOT.find((l) => l.id !== obs.locationId && c.value.includes(l.neighborhood)) : undefined
        issues.push({
          entityConfusion: other?.neighborhood,
          id: issueIdFor(auditId, obs.locationId, obs.promptId, 'mismatch'),
          auditId,
          observationId: obs.id,
          reviewKey: obs.id,
          locationId: obs.locationId,
          promptId: obs.promptId,
          claimId: c.id,
          field: c.field,
          category: 'factual_mismatch',
          severity: MISMATCH_SEVERITY[c.field],
          confidenceLabel: other ? `Possible entity confusion with ${other.neighborhood} · needs centre verification` : 'Rule match against verified record · needs human review',
          title: other ? `Possible entity confusion — address of ${other.neighborhood}` : c.field === 'operatingStatus' ? 'Center described as closed' : `${FIELD_LABELS[c.field]} differs from verified record`,
          summary: `Answer says “${c.value}”; verified record says “${c.expected}”.`,
          explanations: MISMATCH_EXPLANATIONS[c.field] ?? MISMATCH_EXPLANATIONS.default,
          possibleSourceIds: divergentSources(obs.locationId, c.field, c.expected),
        })
      } else if (c.evaluation === 'unverifiable') {
        issues.push({
          id: issueIdFor(auditId, obs.locationId, obs.promptId, 'unsupported'),
          auditId,
          observationId: obs.id,
          reviewKey: obs.id,
          locationId: obs.locationId,
          promptId: obs.promptId,
          claimId: c.id,
          category: 'unsupported_claim',
          severity: c.sensitive ? 'high' : 'low',
          confidenceLabel: 'Not present in verified record',
          title: c.sensitive ? 'Unsupported sensitive claim' : 'Claim not supported by verified record',
          summary: `Answer states “${c.value}”, which is not part of the approved BrightNest record.`,
          explanations: ['A forum post or review may describe a past or informal arrangement.', 'The answer may be inferring a service from similar centers.'],
          possibleSourceIds: [],
        })
      } else if (c.evaluation === 'cannot_evaluate' && c.field !== 'other') {
        const k = `${obs.locationId}:${c.field}`
        if (seenRecordGaps.has(k)) return
        seenRecordGaps.add(k)
        const field = loc.verifiedFields[c.field]
        issues.push({
          id: issueIdFor(auditId, obs.locationId, obs.promptId, `gap-${c.field}`),
          auditId,
          observationId: obs.id,
          reviewKey: obs.id,
          locationId: obs.locationId,
          promptId: obs.promptId,
          claimId: c.id,
          field: c.field,
          category: 'unknown_fact',
          severity: c.field === 'phone' || c.field === 'hours' ? 'medium' : 'low',
          confidenceLabel: field.status === 'unknown' ? 'Record status unknown' : 'Record needs verification',
          title: `${FIELD_LABELS[c.field]} is not verified`,
          summary: `Answer states “${c.value}”, but the BrightNest ${FIELD_LABELS[c.field].toLowerCase()} record is ${field.status === 'unknown' ? 'not verified' : 'awaiting verification'}. Needs verification — not counted as a mismatch.`,
          explanations: [field.note ?? 'The approved record has no verified value for this field.', 'Verify the fact in GEO Readiness; then the claim can be evaluated in the next recheck.'],
          possibleSourceIds: sourceRecordsFor(obs.locationId).filter((s) => s.values[c.field as FieldKey] != null).map((s) => s.id),
        })
      }
    })
  }

  // Inconsistent controlled source content: owned website / managed listing disagree with a verified fact.
  const audited = [...new Set(observations.map((o) => o.locationId))]
  for (const locId of audited) {
    const loc = effectiveLocation(locId, edits)
    const anchor = observations.find((o) => o.locationId === locId && !promptsById[o.promptId]?.includeInDiscoveryMetric) ?? observations.find((o) => o.locationId === locId)!
    const byField = new Map<FieldKey, string[]>()
    for (const src of sourceRecordsFor(locId)) {
      if (!src.managedByCustomer) continue
      for (const [key, val] of Object.entries(src.values) as [FieldKey, string | null][]) {
        const fact = loc.verifiedFields[key]
        if (fact.status !== 'verified' || !fact.value) continue
        if ((val ?? null) !== fact.value && val !== null) byField.set(key, [...(byField.get(key) ?? []), src.id])
      }
    }
    for (const [key, srcIds] of byField) {
      const labels = srcIds.map((id) => (id.endsWith('-web') ? 'owned website' : 'managed listing')).join(' and ')
      issues.push({
        id: issueIdFor(auditId, locId, key, 'source'),
        auditId,
        observationId: anchor.id,
        reviewKey: `${auditId}:${locId}:${key}:source`,
        locationId: locId,
        promptId: anchor.promptId,
        field: key,
        category: 'source_inconsistency',
        severity: key === 'operatingStatus' || key === 'phone' || key === 'address' ? 'high' : 'medium',
        confidenceLabel: 'Controlled source differs from verified record',
        title: `${FIELD_LABELS[key]} inconsistent on ${labels}`,
        summary: `The ${labels} ${srcIds.length > 1 ? 'state' : 'states'} a different ${FIELD_LABELS[key].toLowerCase()} than the verified record (“${loc.verifiedFields[key].value}”).`,
        explanations: ['Content was not updated when the record changed.', 'Correcting controlled sources improves consistency; it does not guarantee any AI answer changes.'],
        possibleSourceIds: srcIds,
      })
    }
  }

  // Non-mentions in unbranded questions are NOT issues. They become Discovery Opportunities (lib/discovery.ts),
  // with their own eligibility, status and metrics, so an omission is never counted as an error.

  const sevRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return issues.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
}
