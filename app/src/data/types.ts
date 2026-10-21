export type Release = 'MVP' | 'V1' | 'V2'
/** Demo viewing role (not authentication). */
export type Role = 'brand' | 'promanage'

/** Job type of a person — used for assignment, not for permissions. */
export type PersonKind = 'marketing' | 'regional' | 'csm'

export type FieldKey = 'name' | 'operatingStatus' | 'address' | 'phone' | 'hours' | 'saturdayTours' | 'programs' | 'website'
export type FieldStatus = 'verified' | 'needs_verification' | 'unknown'
export type VerificationStatus = 'verified' | 'needs_verification' | 'unknown'

export interface Organization {
  id: string
  name: string
  sector: string
  totalLocationCount: number
  simulated: true
}

export interface VerifiedField {
  value: string | null
  status: FieldStatus
  note?: string
}

export interface Location {
  id: string
  organizationId: string
  name: string
  neighborhood: string
  city: string
  region: string
  isPilot: boolean
  verifiedFields: Record<FieldKey, VerifiedField>
  verificationStatus: VerificationStatus
  lastVerifiedAt: string
  sourceOwner: string
  simulated: true
}

export type PromptCategory = 'discovery' | 'services' | 'reputation' | 'branded'

export interface PromptTemplate {
  id: string
  intent: 'unbranded_discovery' | 'branded_fact'
  category: PromptCategory
  text: string
  includeInDiscoveryMetric: boolean
  custom?: boolean
  defaultSelected?: boolean
  provenance?: string
}

export type AuditMode = 'self-serve' | 'assisted'

export interface CsvImportSummary {
  fileName: string
  totalRows: number
  validRows: number
  matchedRows: number
}

export interface Audit {
  id: string
  name: string
  createdAt: string
  createdBy: Role
  locationIds: string[]
  promptIds: string[]
  surface: string
  status: 'complete'
  mode: AuditMode
  csvImport?: CsvImportSummary
  simulated: true
}

export type SurfaceId = 'A' | 'B'

export type ClaimEvaluation = 'match' | 'mismatch' | 'cannot_evaluate' | 'unverifiable'

export interface ExtractedClaim {
  id: string
  field: FieldKey | 'other'
  label: string
  /** Exact span of answer text the claim was extracted from. */
  span: string
  value: string
  evaluation: ClaimEvaluation
  sensitive?: boolean
  /** Verified-record value at the time of evaluation (null when not verified). */
  expected: string | null
}

export interface Citation {
  title: string
  url: string
}

export type ReviewStatus = 'unreviewed' | 'confirmed' | 'not_issue' | 'investigating'

export interface Observation {
  id: string
  auditId: string
  wave: number
  locationId: string
  promptId: string
  query: string
  sampledAt: string
  surface: SurfaceId
  answerText: string
  /** The specific location was named (counts toward location mention rate). */
  mentioned: boolean
  /** Any BrightNest center was named — brand-level only, never counted as branch visibility. */
  mentionedBrand: boolean
  /** Another BrightNest branch named instead of this one, if any. */
  otherBranchName?: string
  /** Rank in a list-style answer, if mentioned in one. */
  position?: number
  extractedClaims: ExtractedClaim[]
  citations: Citation[]
  simulated: true
}

export interface ReviewEvidence {
  claim: string
  field: string
  verifiedValue: string | null
  query: string
  sampledAt: string
  surface: string
  citations: string
}

export interface Review {
  status: ReviewStatus
  note?: string
  by: Role
  at: string
  /** Snapshot of the evidence at the moment of the decision — never rewritten. */
  evidence?: ReviewEvidence
  history?: { status: ReviewStatus; by: Role; at: string; note?: string }[]
}

export type Disposition = 'monitoring' | 'closed' | 'reinvestigate'

export type InvestigationStatus = 'not_started' | 'in_progress' | 'completed' | 'inconclusive'

export interface Investigation {
  status: InvestigationStatus
  /** Increments each time the Brand asks for further investigation. */
  round: number
  finding?: string
  requestedBy: Role
  requestedAt: string
  updatedAt: string
  history: { at: string; by: Role; text: string }[]
}

export type PlanItemKind = ControlledChannel | 'structured_info'

export interface PlanItem {
  id: string
  kind: PlanItemKind
  title: string
  owner: string
  detail: string
}

export type PlanStatus = 'draft' | 'awaiting_brand_approval' | 'approved' | 'changes_requested' | 'declined'

export interface CorrectionPlan {
  issueId: string
  round: number
  status: PlanStatus
  why: string
  items: PlanItem[]
  taskIds: string[]
  comments: { at: string; by: Role; kind: 'note' | 'changes' | 'decline' | 'approve' | 'sent'; text: string }[]
  updatedAt: string
}

export interface CheckRequest {
  id: string
  at: string
  by: Role
  note?: string
  status: 'requested' | 'completed'
  auditId?: string
}

export interface IssueDisposition {
  status: Disposition
  note?: string
  by: string
  at: string
}

export interface SourceUpdate {
  value: string
  previous: string | null
  at: string
  taskId: string
}

export type IssueCategory = 'factual_mismatch' | 'discovery_gap' | 'unsupported_claim' | 'source_inconsistency' | 'unknown_fact'
export type Severity = 'high' | 'medium' | 'low'

export interface Issue {
  id: string
  auditId: string
  observationId: string
  locationId: string
  promptId: string
  claimId?: string
  category: IssueCategory
  severity: Severity
  confidenceLabel: string
  title: string
  summary: string
  explanations: string[]
  /** Key into reviews: the observation for answer-level issues, the issue id otherwise. */
  reviewKey: string
  field?: FieldKey
  possibleSourceIds: string[]
  /** Answer may mix this centre with another BrightNest centre. */
  entityConfusion?: string
}

export type TaskStatus = 'open' | 'in_progress' | 'prepared' | 'approved' | 'source_updated' | 'awaiting_recheck' | 'closed'

export type ControlledChannel = 'owned_website' | 'managed_listing' | 'external_request' | 'verification'

export type AssetKind = 'jsonld' | 'factsheet'

export interface ActivityEntry {
  id: string
  at: string
  actor: string
  kind: 'created' | 'status' | 'comment' | 'approval' | 'system'
  text: string
}

export interface Task {
  id: string
  issueId?: string
  /** Discovery work: the opportunity and plan recommendation this task implements (never an accuracy issue). */
  opportunityId?: string
  recommendationId?: string
  locationId: string
  title: string
  assigneeId: string
  channel: ControlledChannel
  /** The specific controlled surface, e.g. the center page URL. */
  target: string
  dueAt: string
  notes: string
  status: TaskStatus
  assetKinds: AssetKind[]
  /** Field this source action corrects (drives the simulated snapshot update on completion). */
  field?: FieldKey
  evidence: { label: string; value: string }[]
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  activity: ActivityEntry[]
}

export type SourceChannel = 'owned_website' | 'managed_listing' | 'external_directory'

export interface SourceRecord {
  id: string
  locationId: string
  channel: SourceChannel
  label: string
  url: string
  observedAt: string
  managedByCustomer: boolean
  /** Snapshot couldn't be captured — manual check required. */
  inaccessible?: boolean
  /** Field values as they appear on this source; null = not stated. Missing key = mirrors nothing (not captured). */
  values: Partial<Record<FieldKey, string | null>>
  simulated: true
}

export type FactKey = FieldKey | 'geo'
export type FactStatus = 'verified' | 'unverified' | 'missing' | 'pending_approval'

export interface BusinessFact {
  id: string
  locationId: string
  key: FactKey
  label: string
  value: string | null
  verificationStatus: FactStatus
  verifiedBy?: string
  verifiedAt?: string
  sourceOwner: string
  applicability: string
  whereUsed: string[]
  note?: string
  requested?: boolean
  proposedValue?: string
}

export interface FactEdit {
  status: 'verified' | 'pending_approval' | 'requested'
  value?: string
  by: string
  at: string
}

export interface AssetApproval {
  status: 'draft' | 'approved'
  approvedBy?: string
  approvedAt?: string
  fingerprint?: string
  exportedAt?: string
  version?: number
}

export interface Recheck {
  id: string
  priorAuditId: string
  wave: number
  cohortFingerprint: string
  sampledAt: string
  createdAt: string
  /** Verified-fact edits in force when the recheck was sampled (claims are evaluated against these). */
  factSnapshot: Record<string, FactEdit>
  simulated: true
}

/* ───────────── Discoverability Improvement (PRD v4) ─────────────
   Kept apart from accuracy Issues: a non-mention is an observation, never an error. */

export type EligibilityStatus = 'eligible' | 'not_relevant' | 'unknown'
export type NotRelevantReason = 'service_mismatch' | 'geography_mismatch' | 'inactive_location' | 'ambiguous_query' | 'other'

/** Human eligibility decision for one location + unbranded question (applies to every wave of that pair). */
export interface EligibilityReview {
  status: 'eligible' | 'not_relevant'
  reason?: NotRelevantReason
  note?: string
  by: Role
  byName: string
  at: string
}

export type ReadinessCategory = 'content' | 'listing' | 'structured_data' | 'crawl_access' | 'freshness' | 'offsite'
export type ReadinessCertainty = 'confirmed_gap' | 'potential_gap' | 'no_gap' | 'unknown'
export type DiscoverySourceOwner = 'brand' | 'promanage_managed' | 'third_party' | 'unknown'

export interface ReadinessFinding {
  id: string
  opportunityId: string
  category: ReadinessCategory
  surfaceLabel: string
  url?: string
  inspectedAt: string
  evidenceType: 'simulated_snapshot' | 'verified_business_fact' | 'user_confirmed'
  sourceOwner: DiscoverySourceOwner
  observation: string
  /** What the inspected source currently says (simulated snapshot), when relevant. */
  snapshot?: string
  confirmedGap: boolean
  certainty: ReadinessCertainty
  /** Verified facts this finding depends on (fact ids `${locationId}:${key}`). */
  factualEvidenceIds: string[]
  /** Unbranded prompts the gap relates to. */
  promptIds: string[]
  needsSiteOwner?: boolean
  /** Accuracy work on the same source is tracked in the accuracy journey, never merged. */
  linkedAccuracyField?: FieldKey
  /** The accuracy correction on the same source already delivers this change — don't propose it twice. */
  coveredByAccuracy?: boolean
  blockedReason?: string
  recommendedAction?: string
}

export type OptimizationChannel = 'owned_website' | 'managed_listing' | 'external_request' | 'structured_info'

export interface OptimizationRecommendation {
  id: string
  findingId?: string
  channel: OptimizationChannel
  controlledSource: string
  owner: string
  title: string
  brandTitle: string
  currentText?: string
  proposedText?: string
  businessFactIds: string[]
  requiresBrandApproval: boolean
  effort: 'Small' | 'Medium' | 'Large'
  gapConfidence: 'Confirmed gap' | 'Potential gap'
  aiImpactNote: string
  dependency?: string
  technicalAssetIds?: AssetKind[]
}

export type OptimizationPlanStatus = 'draft' | 'awaiting_brand_approval' | 'approved' | 'changes_requested' | 'declined'

export interface OptimizationPlan {
  id: string
  opportunityId: string
  round: number
  createdBy: string
  status: OptimizationPlanStatus
  summary: string
  recommendations: OptimizationRecommendation[]
  brandApprovalBy?: string
  brandApprovalAt?: string
  approvalComment?: string
  taskIds: string[]
  comments: { at: string; by: Role; kind: 'sent' | 'changes' | 'decline' | 'approve'; text: string }[]
  updatedAt: string
}

/** Everything people decided about one opportunity. Status is derived from this, never stored separately. */
export interface DiscoveryRecord {
  decision?: { kind: 'worth_investigating' | 'dismissed'; by: Role; byName: string; at: string; note?: string }
  confirmRequested?: { by: string; at: string; service: string }
  investigation?: {
    status: 'in_progress' | 'completed'
    requestedBy: Role
    requestedAt: string
    checkedAt?: string
    completedAt?: string
    result?: 'gaps_found' | 'no_gap'
    findingReviews: Record<string, 'confirmed' | 'not_gap'>
    note?: string
  }
  plan?: OptimizationPlan
  /** Earlier plan rounds, kept unchanged when a new investigation round starts. */
  previousPlans?: OptimizationPlan[]
  monitorOnly?: { by: string; at: string; note?: string }
  archived?: { by: string; at: string; note?: string }
  history: { at: string; by: string; text: string }[]
}

export type DiscoveryStatus =
  | 'observed'
  | 'eligibility_review'
  | 'qualified'
  | 'not_relevant'
  | 'investigating'
  | 'no_gap'
  | 'proposal_draft'
  | 'awaiting_approval'
  | 'changes_requested'
  | 'declined'
  | 'implementing'
  | 'awaiting_recheck'
  | 'rechecked'
  | 'archived'

export interface DiscoveryRecheck {
  id: string
  opportunityId: string
  baselineAuditId: string
  recheckWave: number
  normalizedPromptKeys: string[]
  locationId: string
  measurementSurface: string
  comparable: boolean
  nonComparabilityReason?: string
  baselineMentionCount: number
  baselineEligibleCount: number
  recheckMentionCount: number
  recheckEligibleCount: number
  targetMentionedAfter: number
  targetCount: number
  sampledAt: string
  /** Whether the plan's source updates were recorded before this check was run. */
  afterUpdates: boolean
  outcome: 'mention_observed' | 'still_absent' | 'mixed' | 'inconclusive'
  simulated: true
}

export interface DiscoveryOpportunity {
  id: string
  organizationId: string
  auditId: string
  locationId: string
  /** Every unbranded observation for this centre in the audit (the matched cohort). */
  observationIds: string[]
  /** Unbranded questions where this centre was not mentioned (baseline). */
  missedPromptIds: string[]
  /** Missed questions still counted as eligible or awaiting review (not marked Not relevant). */
  targetPromptIds: string[]
  intentCategory: string
  promptGroupId: string
  eligibility: EligibilityStatus
  status: DiscoveryStatus
  createdAt: string
  lastUpdatedAt: string
  readinessFindingIds: string[]
  planId?: string
}

export interface Person {
  id: string
  name: string
  title: string
  role: PersonKind
  region?: string
}

/* ───────────── v7 audit-first lifecycle: authorization, simulated publishing, optional goals ───────────── */

export type DemoChapter = 1 | 2 | 3

export type TargetPermission = 'connected_authorized' | 'connected_read_only' | 'requires_site_admin' | 'third_party_unmanaged' | 'unsupported'

/** Brand decision on a prepared proposal (discovery plan or accuracy correction plan). Immutable once recorded. */
export interface ProposalApproval {
  id: string
  /** `disc:<opportunityId>` or `acc:<issueId>` */
  proposalKey: string
  approvedVersion: string
  approvedTargetIds: string[]
  approverRole: 'brand'
  approverName: string
  verifiedFactVersionIds: string[]
  action: 'approve' | 'request_changes' | 'decline'
  comment?: string
  at: string
}

/** One simulated write attempt against one target. Never touches recorded AI answers. */
export interface PublicationAttempt {
  id: string
  taskId: string
  proposalKey: string
  approvedVersion: string
  permission: TargetPermission
  permissionChecked: boolean
  state: 'success' | 'pending' | 'failed' | 'blocked' | 'manual_handoff'
  before?: string
  after?: string
  detail: string
  simulated: true
  recordedAt: string
}

/** Optional, secondary: a Brand-entered question + location to focus on after the standard check. */
export interface PrioritySearchGoal {
  id: string
  organizationId: string
  locationIds: string[]
  anchorQuestion: string
  normalizedAnchor: string
  label?: string
  goalVersion: number
  importance?: 'standard' | 'high'
  status: 'active' | 'paused' | 'archived'
  /** Existing prompt template this exact question matches (seeded demo evidence), if any. */
  promptId?: string
  history: { version: number; anchorQuestion: string; locationIds: string[]; at: string }[]
  createdBy: 'brand' | 'promanage'
  createdAt: string
  updatedAt: string
  simulated: true
}
