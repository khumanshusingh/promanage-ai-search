import type { FactEdit, FieldKey, Issue, Observation, PromptTemplate, Recheck } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { compareClaim, isDiscovery, type RecheckOutcome } from './metrics'

export const OUTCOME_TEXT: Record<RecheckOutcome, { label: string; short: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  changed: { label: 'No mismatch in latest sample', short: 'No mismatch in latest sample', tone: 'success' },
  unchanged: { label: 'Still observed in latest sample', short: 'Still observed', tone: 'danger' },
  uncertain: { label: 'Inconclusive — claim not comparable in latest sample', short: 'Inconclusive', tone: 'warning' },
  not_comparable: { label: 'Not comparable — verified facts changed; new baseline required', short: 'New baseline required', tone: 'neutral' },
}

/** Location+field pairs whose verified value changed between the baseline and a recheck — those comparisons are invalid. */
export function revisedFacts(recheck: Pick<Recheck, 'factSnapshot'> | undefined): Set<string> {
  const out = new Set<string>()
  if (!recheck) return out
  for (const [id, e] of Object.entries(recheck.factSnapshot as Record<string, FactEdit>)) {
    const [loc, field] = id.split(':')
    const base = LOCATION_BY_ID[loc]?.verifiedFields[field as FieldKey]
    if (!base || e.status !== 'verified') continue
    if (base.status !== 'verified' || base.value !== e.value) out.add(`${loc}:${field}`)
  }
  return out
}

/** Pure comparison of a baseline issue against a later matched sample (same location + prompt + field + rules). */
export function outcomeForIssue(issue: Issue, baseline: Observation[], later: Observation[], prompts: Record<string, PromptTemplate>, revised: Set<string> = new Set()): RecheckOutcome {
  if (issue.field && revised.has(`${issue.locationId}:${issue.field}`)) return 'not_comparable'
  if (issue.category === 'discovery_gap') {
    return later.some((o) => o.locationId === issue.locationId && isDiscovery(o, prompts) && o.mentioned) ? 'changed' : 'unchanged'
  }
  if (!issue.field) return 'uncertain'
  if (issue.claimId) {
    const base = baseline.find((o) => o.id === issue.observationId)
    const match = later.find((o) => o.locationId === issue.locationId && o.promptId === issue.promptId)
    return base ? compareClaim(base, match, issue.field) : 'uncertain'
  }
  // Source-level issues: every claim about this field for the location in the later sample.
  const claims = later.filter((o) => o.locationId === issue.locationId).flatMap((o) => o.extractedClaims.filter((c) => c.field === issue.field))
  if (!claims.length || claims.some((c) => c.evaluation === 'cannot_evaluate')) return 'uncertain'
  return claims.some((c) => c.evaluation === 'mismatch') ? 'unchanged' : 'changed'
}

/**
 * Observed AI-answer status for an issue, from the latest matched recheck.
 * Deliberately independent of task/source status: updating a source never marks an answer fixed.
 */
export function useAiAnswerStatus(issue: Issue | undefined): { outcome: RecheckOutcome | null; wave: number } | null {
  const { observationsFor, rechecksFor, hasRelease, promptsById } = useStore()
  if (!issue) return null
  const rechecks = rechecksFor(issue.auditId)
  if (!hasRelease('V2') || rechecks.length === 0) return { outcome: null, wave: 0 }
  const latest = rechecks[rechecks.length - 1]
  return { outcome: outcomeForIssue(issue, observationsFor(issue.auditId, 0), observationsFor(issue.auditId, latest.wave), promptsById, revisedFacts(latest)), wave: latest.wave }
}
