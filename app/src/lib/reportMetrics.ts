/*
  Executive AI Visibility Report (PRD v9): one pure, scope-aware calculation shared by the Detect
  dashboard and the PDF, so both always show the same numerators and denominators.
  No React, no store, no '@/' runtime imports: it can be unit-tested in plain Node.

  Units are kept apart on purpose:
  - sampled ANSWERS (one per location × question),
  - extracted CLAIMS (several per branded answer, each matched against the verified record),
  - flagged FINDINGS (answers that need attention; not the same as mismatched claims).
*/

export type Score = {
  numerator: number
  denominator: number
  /** null when the denominator is 0: shown as "Not enough data", never 0%. */
  percentage: number | null
  excludedCount: number
  methodologyLabel: string
}

export type Eligibility = 'eligible' | 'unknown' | 'not_relevant'
export type ClaimStatus = 'match' | 'mismatch' | 'cannot_evaluate' | 'unverifiable'
export type FlagStatus = 'confirmed' | 'verify' | 'confusion' | 'review'

export interface ReportRow {
  locationId: string
  questionId: string
  question: string
  category: 'discovery' | 'factual'
  sampledAt: string
  answer: string
  citations: { title: string; url: string }[]
  /** Discovery rows only. */
  mentioned?: boolean
  eligibility?: Eligibility
  relevanceBasis?: string
  /** Prompt category, e.g. 'services' (used to prefer specific examples). */
  intent?: string
  claims: { label: string; value: string; expected: string | null; evaluation: ClaimStatus }[]
}

export interface FlaggedFinding {
  id: string
  locationId: string
  question: string
  status: FlagStatus
  severity: 'high' | 'medium' | 'low'
  fieldPhrase: string
  aiSaid?: string
  record?: string | null
  mixedUpWith?: string
}

export interface ReportInput {
  brandId: string
  brandName: string
  totalLocations: number
  auditId: string
  auditTitle: string
  auditedAt: string
  surfaceLabel: string
  simulated: boolean
  locations: { id: string; name: string; neighborhood: string; city: string }[]
  questionTemplates: { id: string; template: string; category: 'discovery' | 'factual' }[]
  rows: ReportRow[]
  flagged: FlaggedFinding[]
}

export interface KeyFinding {
  kind: 'discovery' | 'accuracy'
  locationName: string
  question: string
  text: string
}

export interface LocationScore {
  locationId: string
  name: string
  discovery: Score
  mentioned: number
  eligible: number
  accuracy: Score
  correct: number
  mismatch: number
  unverified: number
  observation: string
}

export interface ReportSnapshot {
  reportVersion: 'mvp-exec-v1'
  brandId: string
  brandName: string
  totalLocations: number
  auditId: string
  auditTitle: string
  auditedAt: string
  surfaceLabel: string
  simulated: boolean
  scopeFingerprint: string
  partialScope: boolean
  locations: ReportInput['locations']
  questionTemplates: ReportInput['questionTemplates']
  rows: ReportRow[]
  sampledAnswers: number
  samplingWindow: { from: string; to: string } | null
  discovery: Score
  discoveryCounts: { eligibleNotMentioned: number; relevanceNotConfirmed: number; notRelevant: number; unbrandedAnswers: number }
  accuracy: Score
  accuracyStatusCounts: { matching: number; conflicting: number; unverifiable: number; pendingReview: number; totalClaims: number }
  flaggedCounts: { total: number; confirmed: number; verify: number; confusion: number; review: number }
  locationScores: LocationScore[]
  keyFindings: KeyFinding[]
  followUpAreas: string[]
  disclaimer: string
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)

export function discoveryScore(rows: ReportRow[]): Score {
  const disc = rows.filter((r) => r.category === 'discovery')
  const eligible = disc.filter((r) => r.eligibility === 'eligible')
  const mentioned = eligible.filter((r) => r.mentioned).length
  return {
    numerator: mentioned,
    denominator: eligible.length,
    percentage: pct(mentioned, eligible.length),
    excludedCount: disc.length - eligible.length,
    methodologyLabel: 'Eligible sampled unbranded answers that mention the relevant centre ÷ eligible sampled unbranded answers',
  }
}

/** Verified fact match rate: matches ÷ (matches + mismatches). Unverified or uncheckable claims are excluded, never counted as wrong. */
export function accuracyScore(rows: ReportRow[]): Score {
  const claims = rows.filter((r) => r.category === 'factual').flatMap((r) => r.claims)
  const match = claims.filter((c) => c.evaluation === 'match').length
  const mismatch = claims.filter((c) => c.evaluation === 'mismatch').length
  return {
    numerator: match,
    denominator: match + mismatch,
    percentage: pct(match, match + mismatch),
    excludedCount: claims.length - match - mismatch,
    methodologyLabel: 'Checkable claims that match the verified business record ÷ checkable claims with a match or mismatch outcome',
  }
}

export const formatScore = (s: Score) => (s.percentage === null ? 'Not enough verified data' : `${Math.round(s.percentage)}%`)

export function buildReportSnapshot(input: ReportInput, scopeLocationIds?: string[]): ReportSnapshot {
  const scope = scopeLocationIds?.length ? input.locations.filter((l) => scopeLocationIds.includes(l.id)) : input.locations
  const ids = new Set(scope.map((l) => l.id))
  const rows = input.rows.filter((r) => ids.has(r.locationId))
  const flagged = input.flagged.filter((f) => ids.has(f.locationId))
  const nameOf = (id: string) => scope.find((l) => l.id === id)?.name ?? id
  const neighbourhoodOf = (id: string) => scope.find((l) => l.id === id)?.neighborhood ?? id

  const discovery = discoveryScore(rows)
  const accuracy = accuracyScore(rows)
  const discRows = rows.filter((r) => r.category === 'discovery')
  const claims = rows.filter((r) => r.category === 'factual').flatMap((r) => r.claims)
  const times = rows.map((r) => r.sampledAt).sort()

  const locationScores: LocationScore[] = scope.map((l) => {
    const own = rows.filter((r) => r.locationId === l.id)
    const d = discoveryScore(own)
    const a = accuracyScore(own)
    const ownClaims = own.filter((r) => r.category === 'factual').flatMap((r) => r.claims)
    const ownFlags = flagged.filter((f) => f.locationId === l.id)
    const bits: string[] = []
    const confirmed = ownFlags.find((f) => f.status === 'confirmed')
    if (confirmed) bits.push(`wrong ${confirmed.fieldPhrase} (“${confirmed.aiSaid}”)`)
    const confusion = ownFlags.find((f) => f.status === 'confusion')
    if (confusion) bits.push(`possible mix-up with ${confusion.mixedUpWith}`)
    if (d.denominator === 0) bits.push('no eligible discovery sample')
    else if (d.numerator === 0) bits.push('never mentioned')
    else if (d.numerator === d.denominator) bits.push('mentioned every time')
    else bits.push(`missing in ${d.denominator - d.numerator} of ${d.denominator}`)
    const unverified = ownClaims.filter((c) => c.evaluation === 'unverifiable' || c.evaluation === 'cannot_evaluate').length
    if (unverified) bits.push(`${unverified} unverifiable claim${unverified === 1 ? '' : 's'}`)
    const text = bits.join('; ')
    return {
      locationId: l.id,
      name: l.name,
      discovery: d,
      mentioned: d.numerator,
      eligible: d.denominator,
      accuracy: a,
      correct: a.numerator,
      mismatch: a.denominator - a.numerator,
      unverified,
      observation: text.charAt(0).toUpperCase() + text.slice(1),
    }
  })

  // Key findings: evidence-linked, in audit order. Discovery examples prefer service-specific questions
  // (they map to verified programme facts); accuracy examples use confirmed mismatches only.
  const keyFindings: KeyFinding[] = []
  const order = (id: string) => scope.findIndex((l) => l.id === id)
  const missed = discRows
    .filter((r) => r.eligibility === 'eligible' && !r.mentioned)
    .sort((a, b) => order(a.locationId) - order(b.locationId) || Number(b.intent === 'services') - Number(a.intent === 'services'))
  const confirmed = flagged.filter((f) => f.status === 'confirmed')
  const sev = { high: 0, medium: 1, low: 2 }
  const accFirst = [...confirmed].sort((a, b) => order(a.locationId) - order(b.locationId))[0]
  const accSecond = confirmed.filter((f) => f !== accFirst).sort((a, b) => sev[a.severity] - sev[b.severity] || order(a.locationId) - order(b.locationId))[0]
  const discFirst = missed[0]
  const discSecond = missed.find((r) => discFirst && r.locationId !== discFirst.locationId)
  if (discFirst) keyFindings.push({ kind: 'discovery', locationName: nameOf(discFirst.locationId), question: discFirst.question, text: `Not mentioned in a sampled answer to a question that fits the centre${discFirst.relevanceBasis ? ` (${discFirst.relevanceBasis.replace(/^Verified:\s*/i, 'verified: ')})` : ''}. A discovery opportunity, not necessarily an AI error.` })
  for (const f of [accFirst, accSecond].filter(Boolean) as FlaggedFinding[]) keyFindings.push({ kind: 'accuracy', locationName: nameOf(f.locationId), question: f.question, text: `Sampled AI answer said “${f.aiSaid}”; the verified business record says “${f.record}”.` })
  if (discSecond && keyFindings.length < 4) keyFindings.push({ kind: 'discovery', locationName: nameOf(discSecond.locationId), question: discSecond.question, text: 'Not mentioned in a sampled answer to a question that fits the centre. A discovery opportunity, not necessarily an AI error.' })

  // Follow-up areas: categories supported by the data, never V1 tasks or root causes.
  const followUpAreas: string[] = []
  const lowDisc = locationScores.filter((l) => l.eligible > 0 && l.mentioned / l.eligible < 0.5)
  if (lowDisc.length) followUpAreas.push(`Check programme and service information on centre pages and managed listings where mention rates are lowest: ${lowDisc.map((l) => neighbourhoodOf(l.locationId)).join(', ')}.`)
  const wrong = confirmed.map((f) => `${f.fieldPhrase} (${neighbourhoodOf(f.locationId)})`)
  if (wrong.length) followUpAreas.push(`Correct sources that may state conflicting facts: ${wrong.join(', ')}.`)
  const unverifiedClaims = claims.filter((c) => c.evaluation === 'unverifiable' || c.evaluation === 'cannot_evaluate').length
  const toVerify = flagged.filter((f) => f.status === 'verify' || f.status === 'confusion').length
  if (unverifiedClaims || toVerify) followUpAreas.push(`Verify business information that couldn’t be checked (${unverifiedClaims} claim${unverifiedClaims === 1 ? '' : 's'}${toVerify ? `; ${toVerify} answer${toVerify === 1 ? '' : 's'} need confirming` : ''}) before treating it as correct or incorrect.`)
  const unknown = discRows.filter((r) => r.eligibility === 'unknown').length
  if (unknown) followUpAreas.push(`Confirm whether ${unknown} sampled question${unknown === 1 ? '' : 's'} fit${unknown === 1 ? 's' : ''} each centre’s services; they are excluded from the mention rate until confirmed.`)

  return {
    reportVersion: 'mvp-exec-v1',
    brandId: input.brandId,
    brandName: input.brandName,
    totalLocations: input.totalLocations,
    auditId: input.auditId,
    auditTitle: input.auditTitle,
    auditedAt: input.auditedAt,
    surfaceLabel: input.surfaceLabel,
    simulated: input.simulated,
    scopeFingerprint: `${input.auditId}:${[...ids].sort().join(',')}`,
    partialScope: scope.length !== input.locations.length,
    locations: scope,
    questionTemplates: input.questionTemplates,
    rows,
    sampledAnswers: rows.length,
    samplingWindow: times.length ? { from: times[0], to: times[times.length - 1] } : null,
    discovery,
    discoveryCounts: {
      eligibleNotMentioned: discovery.denominator - discovery.numerator,
      relevanceNotConfirmed: discRows.filter((r) => r.eligibility === 'unknown').length,
      notRelevant: discRows.filter((r) => r.eligibility === 'not_relevant').length,
      unbrandedAnswers: discRows.length,
    },
    accuracy,
    accuracyStatusCounts: {
      matching: accuracy.numerator,
      conflicting: accuracy.denominator - accuracy.numerator,
      unverifiable: accuracy.excludedCount,
      pendingReview: 0,
      totalClaims: claims.length,
    },
    flaggedCounts: {
      total: flagged.length,
      confirmed: flagged.filter((f) => f.status === 'confirmed').length,
      verify: flagged.filter((f) => f.status === 'verify').length,
      confusion: flagged.filter((f) => f.status === 'confusion').length,
      review: flagged.filter((f) => f.status === 'review').length,
    },
    locationScores,
    keyFindings,
    followUpAreas,
    disclaimer: input.simulated
      ? 'Concept prototype with a fictional brand and deterministic simulated AI answers. Results describe sampled answers, not all AI searches, and are not an official ProManage report.'
      : 'Results describe sampled AI answers, not all AI searches.',
  }
}
