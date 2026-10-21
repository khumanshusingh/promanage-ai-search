import type { Issue, IssueDisposition, Observation, PromptTemplate, Review, Task } from '@/data/types'

/*
  Every KPI in the app is computed here from observation records.
  Nothing on screen is a hard-coded number.
*/

export interface Ratio {
  num: number
  den: number
  pct: number | null
}

export const ratio = (num: number, den: number): Ratio => ({ num, den, pct: den === 0 ? null : (num / den) * 100 })

export type PromptLookup = Record<string, PromptTemplate>

export const isDiscovery = (o: Observation, prompts: PromptLookup) => !!prompts[o.promptId]?.includeInDiscoveryMetric

/** Sampled discovery mention rate: unbranded discovery responses that mention the center ÷ all unbranded discovery responses. */
export function mentionRate(obs: Observation[], prompts: PromptLookup): Ratio {
  const d = obs.filter((o) => isDiscovery(o, prompts))
  return ratio(d.filter((o) => o.mentioned).length, d.length)
}

/** Discovery responses that named a different BrightNest branch but not this one — brand-level only. */
export function brandOnlyMentions(obs: Observation[], prompts: PromptLookup): Ratio {
  const d = obs.filter((o) => isDiscovery(o, prompts))
  return ratio(d.filter((o) => o.mentionedBrand && !o.mentioned).length, d.length)
}

/** Pilot locations mentioned in ≥1 sampled unbranded discovery response. */
export function locationsMentioned(obs: Observation[], prompts: PromptLookup): Ratio {
  const all = new Set(obs.map((o) => o.locationId))
  const hit = new Set(obs.filter((o) => isDiscovery(o, prompts) && o.mentioned).map((o) => o.locationId))
  return ratio(hit.size, all.size)
}

export interface FactualSummary {
  responses: number
  claims: number
  match: number
  mismatch: number
  cannotEvaluate: number
  unverifiable: number
}

/** Branded factual accuracy checks — kept separate from discovery metrics. */
export function factualSummary(obs: Observation[], prompts: PromptLookup): FactualSummary {
  const b = obs.filter((o) => !isDiscovery(o, prompts))
  const claims = obs.flatMap((o) => o.extractedClaims)
  return {
    responses: b.length,
    claims: claims.length,
    match: claims.filter((c) => c.evaluation === 'match').length,
    mismatch: claims.filter((c) => c.evaluation === 'mismatch').length,
    cannotEvaluate: claims.filter((c) => c.evaluation === 'cannot_evaluate').length,
    unverifiable: claims.filter((c) => c.evaluation === 'unverifiable').length,
  }
}

export const hasMismatch = (o: Observation) => o.extractedClaims.some((c) => c.evaluation === 'mismatch')

/** Human-confirmed claims that conflict with a verified record. Unverified records can never reach this count. */
export function confirmedMismatches(obs: Observation[], reviews: Record<string, Review>): number {
  return obs.filter((o) => hasMismatch(o) && reviews[o.id]?.status === 'confirmed').length
}

export type ObservationOutcome = 'mismatch' | 'unverifiable' | 'omission' | 'clear'

/** Mutually exclusive outcome bucket for each observation (sums to the observation total). */
export function outcomeOf(o: Observation, prompts: PromptLookup): ObservationOutcome {
  if (hasMismatch(o)) return 'mismatch'
  if (o.extractedClaims.some((c) => c.evaluation === 'unverifiable' || c.evaluation === 'cannot_evaluate')) return 'unverifiable'
  if (isDiscovery(o, prompts) && !o.mentioned) return 'omission'
  return 'clear'
}

export function outcomeCounts(obs: Observation[], prompts: PromptLookup) {
  const out: Record<ObservationOutcome, number> = { mismatch: 0, unverifiable: 0, omission: 0, clear: 0 }
  obs.forEach((o) => out[outcomeOf(o, prompts)]++)
  return out
}

export interface LocationRow {
  locationId: string
  discoveryTested: number
  mentions: number
  rate: Ratio
  factualChecks: number
  flagged: number
  confirmed: number
  cannotEvaluate: number
  status: 'flagged' | 'review' | 'clear' | 'confirmed'
}

export function locationRows(obs: Observation[], prompts: PromptLookup, reviews: Record<string, Review>): LocationRow[] {
  const ids = [...new Set(obs.map((o) => o.locationId))]
  return ids.map((id) => {
    const mine = obs.filter((o) => o.locationId === id)
    const disc = mine.filter((o) => isDiscovery(o, prompts))
    const mentions = disc.filter((o) => o.mentioned).length
    const claims = mine.flatMap((o) => o.extractedClaims)
    const flaggedObs = mine.filter(hasMismatch)
    const confirmed = flaggedObs.filter((o) => reviews[o.id]?.status === 'confirmed').length
    const unresolved = flaggedObs.filter((o) => !reviews[o.id] || reviews[o.id].status === 'unreviewed' || reviews[o.id].status === 'investigating').length
    const cannotEvaluate = claims.filter((c) => c.evaluation === 'cannot_evaluate' || c.evaluation === 'unverifiable').length
    return {
      locationId: id,
      discoveryTested: disc.length,
      mentions,
      rate: ratio(mentions, disc.length),
      factualChecks: mine.filter((o) => !isDiscovery(o, prompts)).flatMap((o) => o.extractedClaims).length,
      flagged: flaggedObs.length,
      confirmed,
      cannotEvaluate,
      status: unresolved > 0 ? 'flagged' : confirmed > 0 ? 'confirmed' : cannotEvaluate > 0 ? 'review' : 'clear',
    }
  })
}

export type IssueStatus = 'needs_review' | 'needs_verification' | 'investigating' | 'confirmed' | 'dismissed' | 'in_task' | 'external_pending' | 'awaiting_recheck' | 'monitoring' | 'closed'

/** Overall issue lifecycle shown in the inbox. Factual state, source action and AI outcome are also shown separately. */
export function issueStatus(issue: Issue, reviews: Record<string, Review>, tasks: Task[], dispositions: Record<string, IssueDisposition> = {}): IssueStatus {
  const r = reviews[issue.reviewKey]
  const d = dispositions[issue.id]
  if (r?.status === 'not_issue') return 'dismissed'
  if (d?.status === 'closed') return 'closed'
  const own = tasks.filter((t) => t.issueId === issue.id)
  const task = own.find((t) => t.channel !== 'verification') ?? own[0]
  if (task && d?.status !== 'reinvestigate') {
    if (task.status === 'closed') return 'closed'
    if (task.status === 'awaiting_recheck') return 'awaiting_recheck'
    if (task.status === 'source_updated') return task.channel === 'external_request' ? 'external_pending' : 'awaiting_recheck'
    return 'in_task'
  }
  if (d?.status === 'monitoring') return 'monitoring'
  if (r?.status === 'confirmed') return 'confirmed'
  if (r?.status === 'investigating') return 'investigating'
  if (issue.category === 'unknown_fact' || issue.category === 'unsupported_claim' || issue.entityConfusion) return 'needs_verification'
  return 'needs_review'
}

/** Factual issue state machine (PRD §9): Potential → Needs business verification → Confirmed / Dismissed / Unverifiable. */
export function factualState(issue: Issue, reviews: Record<string, Review>): 'Potential' | 'Needs business verification' | 'Confirmed' | 'Dismissed' | 'Unverifiable' {
  const r = reviews[issue.reviewKey]
  if (r?.status === 'not_issue') return 'Dismissed'
  if (r?.status === 'confirmed') return 'Confirmed'
  if (issue.category === 'discovery_gap') return 'Potential'
  if (issue.category === 'unknown_fact' || issue.category === 'unsupported_claim' || issue.entityConfusion || r?.status === 'investigating') return 'Needs business verification'
  return 'Potential'
}

export type RecheckOutcome = 'changed' | 'unchanged' | 'uncertain' | 'not_comparable'

/** Compare a baseline flagged claim with the same location + prompt + field in a later wave. */
export function compareClaim(_baseline: Observation, later: Observation | undefined, field: string): RecheckOutcome {
  if (!later) return 'uncertain'
  const c = later.extractedClaims.find((x) => x.field === field)
  if (!c) return 'uncertain'
  if (c.evaluation === 'match') return 'changed'
  if (c.evaluation === 'mismatch' || c.evaluation === 'unverifiable') return 'unchanged'
  return 'uncertain'
}

export const fmtPct = (r: Ratio, digits = 0) => (r.pct === null ? '—' : `${r.pct.toFixed(digits)}%`)
