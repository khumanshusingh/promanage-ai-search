import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DemoChapter, PrioritySearchGoal, ProposalApproval, PublicationAttempt, ActivityEntry, AssetApproval, AssetKind, Audit, AuditMode, CheckRequest, ControlledChannel, CorrectionPlan, CsvImportSummary, DiscoveryRecord, Disposition, EligibilityReview, Investigation, NotRelevantReason, OptimizationRecommendation, PlanItem, FactEdit, FieldKey, Issue, IssueDisposition, Observation, PromptTemplate, Recheck, Release, Review, ReviewEvidence, ReviewStatus, Role, SourceRecord, SourceUpdate, SurfaceId, Task, TaskStatus } from '@/data/types'
import { CHANNEL_LABELS, fillPrompt, LOCATION_BY_ID, ORG, PEOPLE, PROMPTS, ROLE_PERSON, SURFACE, sourceRecordsFor } from '@/data/seed'
import { buildObservation } from '@/data/answers'
import { deriveIssues } from '@/data/issues'
import { buildFacts, effectiveLocation, FACT_LABELS, factId } from '@/lib/facts'
import { deriveOpportunities, eligibilityKey, readinessFindings } from '@/lib/discovery'
import { suggestPlan } from '@/lib/plans'
import { simulateAttempt } from '@/lib/publishing'
import { buildFactSheet, buildJsonLd } from '@/lib/geoMarkup'

export const STORAGE_KEY = 'promanage-ai-visibility-demo'
const VERSION = 7

export interface MonitoringPrefs {
  enabled: boolean
  day: string
  cohortAuditId: string | null
  savedAt?: string
}

interface PersistedState {
  version: number
  release: Release
  role: Role
  onboardingDismissed: boolean
  audits: Audit[]
  customPrompts: PromptTemplate[]
  reviews: Record<string, Review>
  tasks: Task[]
  rechecks: Recheck[]
  monitoring: MonitoringPrefs
  ackedAlerts: string[]
  notifyRequests: string[]
  activity: ActivityEntry[]
  factEdits: Record<string, FactEdit>
  assets: Record<string, AssetApproval>
  showSimLabels: boolean
  discoveryEligibility: Record<string, EligibilityReview>
  discovery: Record<string, DiscoveryRecord>
  /** v7: audits whose findings ProManage has already prepared improvements for (simulated backend). */
  autoPrepared: Record<string, string>
  approvals: ProposalApproval[]
  publications: PublicationAttempt[]
  goals: PrioritySearchGoal[]
  selectedGoalId: string | null
  detectLocationIds: string[] | null
  detectPromptIds: string[] | null
  dispositions: Record<string, IssueDisposition>
  sourceUpdates: Record<string, SourceUpdate>
  investigations: Record<string, Investigation>
  plans: Record<string, CorrectionPlan>
  checkRequests: CheckRequest[]
}

const norm = (q: string) => q.toLowerCase().replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim()

/** Seeded optional goal (PRD v7 §8). Not selected by default — the standard check stays the default view. */
const SEEDED_GOAL: PrioritySearchGoal = {
  id: 'goal-whitefield-montessori',
  organizationId: 'org-brightnest',
  locationIds: ['whitefield'],
  anchorQuestion: 'Best Montessori preschools in Whitefield, Bengaluru?',
  normalizedAnchor: norm('Best Montessori preschools in Whitefield, Bengaluru?'),
  label: 'Whitefield Priority Question',
  goalVersion: 1,
  importance: 'high',
  status: 'active',
  promptId: 'p5',
  history: [{ version: 1, anchorQuestion: 'Best Montessori preschools in Whitefield, Bengaluru?', locationIds: ['whitefield'], at: '2026-10-20T09:00:00+05:30' }],
  createdBy: 'promanage',
  createdAt: '2026-10-20T09:00:00+05:30',
  updatedAt: '2026-10-20T09:00:00+05:30',
  simulated: true,
}

/** Exact seeded prompt this question matches for the location (so existing evidence can be linked), if any. */
export function matchPrompt(question: string, locationId: string, prompts: PromptTemplate[]) {
  const loc = LOCATION_BY_ID[locationId]
  if (!loc) return undefined
  return prompts.find((p) => norm(fillPrompt(p.text, loc)) === norm(question))?.id
}

const initialState = (): PersistedState => ({
  version: VERSION,
  release: 'MVP',
  role: 'brand',
  onboardingDismissed: false,
  audits: [],
  customPrompts: [],
  reviews: {},
  tasks: [],
  rechecks: [],
  monitoring: { enabled: false, day: 'Monday', cohortAuditId: null },
  ackedAlerts: [],
  notifyRequests: [],
  activity: [],
  factEdits: {},
  assets: {},
  showSimLabels: false,
  discoveryEligibility: {},
  discovery: {},
  autoPrepared: {},
  approvals: [],
  publications: [],
  goals: [SEEDED_GOAL],
  selectedGoalId: null,
  detectLocationIds: null,
  detectPromptIds: null,
  dispositions: {},
  sourceUpdates: {},
  investigations: {},
  plans: {},
  checkRequests: [],
})

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.version !== VERSION) return initialState()
    return { ...initialState(), ...parsed }
  } catch {
    return initialState()
  }
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const now = () => new Date().toISOString()
const DAY = 86_400_000

export const actorName = (role: Role) => PEOPLE.find((p) => p.id === ROLE_PERSON[role])?.name ?? role

export const RELEASE_RANK: Record<Release, number> = { MVP: 0, V1: 1, V2: 2 }

export interface NewTaskInput {
  issueId?: string
  locationId: string
  title: string
  assigneeId: string
  channel: ControlledChannel
  target: string
  dueAt: string
  notes: string
  assetKinds?: AssetKind[]
  status?: TaskStatus
  field?: FieldKey
  evidence?: { label: string; value: string }[]
}

export const assetKey = (locationId: string, kind: AssetKind) => `${locationId}:${kind}`

/** Current fingerprint of the verified facts an asset would be generated from. */
export function assetFingerprint(locationId: string, kind: AssetKind, edits: Record<string, FactEdit>) {
  const facts = buildFacts(locationId, edits)
  const loc = LOCATION_BY_ID[locationId]
  return kind === 'jsonld' ? buildJsonLd(facts, loc).fingerprint : buildFactSheet(facts, loc).fingerprint
}

interface Store extends PersistedState {
  prompts: PromptTemplate[]
  promptsById: Record<string, PromptTemplate>
  latestAudit: Audit | null
  issues: Issue[]
  issueById: Record<string, Issue>
  scopeLocationIds: Set<string> | null
  inScope: (locationId: string) => boolean
  can: (perm: Permission) => boolean
  hasRelease: (r: Release) => boolean
  observationsFor: (auditId: string, wave?: number, surface?: SurfaceId) => Observation[]
  assetState: (locationId: string, kind: AssetKind) => AssetApproval & { stale: boolean }
  rechecksFor: (auditId: string) => Recheck[]
  setRelease: (r: Release) => void
  setRole: (r: Role) => void
  dismissOnboarding: () => void
  resetDemo: () => void
  createAudit: (input: { name: string; locationIds: string[]; promptIds: string[]; mode?: AuditMode; csvImport?: CsvImportSummary }) => Audit
  saveCustomPrompt: (p: PromptTemplate) => void
  deleteCustomPrompt: (id: string) => void
  setReview: (reviewKey: string, status: ReviewStatus, note?: string, context?: string, evidence?: ReviewEvidence) => void
  setEligibility: (locationId: string, promptId: string, status: 'eligible' | 'not_relevant' | null, reason?: NotRelevantReason, note?: string) => void
  confirmService: (locationId: string, service: string) => void
  requestServiceConfirmation: (oppId: string, service: string) => void
  setDiscoveryDecision: (oppId: string, kind: 'worth_investigating' | 'dismissed' | null, note?: string) => void
  startDiscoveryInvestigation: (oppId: string, note?: string) => void
  runReadinessCheck: (oppId: string) => void
  reviewFinding: (oppId: string, findingId: string, verdict: 'confirmed' | 'not_gap' | null) => void
  markNoControllableGap: (oppId: string, note?: string) => void
  saveDiscoveryPlan: (oppId: string, input: { summary: string; recommendations: OptimizationRecommendation[] }, send: boolean) => void
  approveDiscoveryPlan: (oppId: string, note?: string) => void
  requestDiscoveryPlanChanges: (oppId: string, comment: string) => void
  declineDiscoveryPlan: (oppId: string, reason: string) => void
  recordDiscoveryUpdate: (taskId: string, evidence: string) => void
  reopenDiscovery: (oppId: string, note: string) => void
  archiveDiscovery: (oppId: string, note?: string) => void
  setDisposition: (issueId: string, status: Disposition | null, note?: string) => void
  recordExternalChange: (taskId: string) => void
  sourcesFor: (locationId: string) => SourceRecord[]
  addActivity: (text: string) => void
  requestInvestigation: (issueId: string, note?: string) => void
  completeInvestigation: (issueId: string, status: 'completed' | 'inconclusive', finding: string) => void
  savePlan: (issueId: string, plan: { why: string; items: PlanItem[] }, send: boolean) => void
  approvePlan: (issueId: string, note?: string) => void
  openChapter: (c: DemoChapter) => void
  setDetectLocations: (ids: string[]) => void
  setDetectPrompts: (ids: string[]) => void
  prepareImprovements: (auditId: string) => void
  /** Records a demo product event in the existing activity log (no analytics SDK). */
  logEvent: (text: string) => void
  authorizeProposal: (proposalKey: string, targetIds: string[], comment?: string) => void
  rejectProposal: (proposalKey: string, action: 'request_changes' | 'decline', comment: string) => void
  reviseProposal: (proposalKey: string) => void
  retryPublication: (taskId: string) => void
  saveGoal: (input: { question: string; locationId: string; label?: string; importance?: 'standard' | 'high' }) => PrioritySearchGoal
  updateGoal: (id: string, patch: { status?: PrioritySearchGoal['status']; question?: string }) => void
  selectGoal: (id: string | null) => void
  requestPlanChanges: (issueId: string, comment: string) => void
  declinePlan: (issueId: string, reason: string) => void
  requestCheck: (note?: string) => CheckRequest
  completeCheckRequest: (id: string, auditId: string) => void
  createTask: (input: NewTaskInput) => Task
  setTaskStatus: (taskId: string, status: TaskStatus, note?: string) => void
  approveTask: (taskId: string) => void
  attachAssets: (taskId: string, kinds: AssetKind[]) => void
  requestVerification: (factId: string) => void
  verifyFact: (factId: string, value: string) => void
  approveFactEdit: (factId: string) => void
  rejectFactEdit: (factId: string) => void
  approveAsset: (locationId: string, kind: AssetKind) => void
  markAssetExported: (locationId: string, kind: AssetKind) => void
  setShowSimLabels: (v: boolean) => void
  addTaskComment: (taskId: string, text: string) => void
  runRecheck: (auditId: string) => Recheck
  setMonitoring: (m: Partial<MonitoringPrefs>) => void
  ackAlert: (key: string) => void
  requestNotify: (feature: string) => void
}

export type Permission =
  | 'runAudit'
  | 'reviewDecision'
  | 'markInvestigating'
  | 'createTask'
  | 'approveSource'
  | 'updateTask'
  | 'runRecheck'
  | 'configureMonitoring'
  | 'editPrompts'
  | 'verifyFact'
  | 'approveFact'
  | 'requestVerification'
  | 'assistedAudit'
  | 'investigate'
  | 'draftPlan'
  | 'approvePlan'
  | 'requestCheck'
  | 'qualifyDiscovery'
  | 'confirmService'

const PERMISSIONS: Record<Role, Permission[]> = {
  // Brand owns business facts and approvals.
  brand: ['runAudit', 'reviewDecision', 'markInvestigating', 'approveSource', 'verifyFact', 'approveFact', 'requestVerification', 'approvePlan', 'requestCheck', 'qualifyDiscovery', 'confirmService'],
  // ProManage investigates, prepares and executes; it can't approve facts or plans for the Brand.
  promanage: ['runAudit', 'assistedAudit', 'editPrompts', 'markInvestigating', 'createTask', 'updateTask', 'runRecheck', 'configureMonitoring', 'verifyFact', 'requestVerification', 'investigate', 'draftPlan', 'qualifyDiscovery'],
}

export const PERMISSION_HINT: Record<Permission, string> = {
  runAudit: 'Checks are run by the Brand or ProManage.',
  reviewDecision: 'Only the Brand can confirm or dismiss business information.',
  markInvestigating: '',
  createTask: 'ProManage creates and coordinates correction tasks.',
  approveSource: 'Only the Brand can approve changes to its business information.',
  updateTask: 'ProManage or the source owner records task progress.',
  runRecheck: 'Follow-up checks are run by ProManage.',
  configureMonitoring: 'Monitoring is configured by ProManage.',
  editPrompts: 'Prompt templates are managed by ProManage.',
  verifyFact: '',
  approveFact: 'Only the Brand can approve business facts.',
  requestVerification: '',
  assistedAudit: 'Assisted audits are run by ProManage.',
  investigate: 'Source investigation is handled by ProManage.',
  draftPlan: 'Correction plans are prepared by ProManage.',
  approvePlan: 'Only the Brand can approve a correction plan.',
  requestCheck: 'Only the Brand can request a check.',
  qualifyDiscovery: '',
  confirmService: 'Only the Brand can confirm which services a centre offers. ProManage can ask for confirmation.',
}

function isAssetApproved(s: PersistedState, locationId: string, kind: AssetKind) {
  const a = s.assets[assetKey(locationId, kind)]
  return a?.status === 'approved' && a.fingerprint === assetFingerprint(locationId, kind, s.factEdits)
}

/** `disc-<auditId>-<locationId>` → its parts. */
export function parseOpp(oppId: string) {
  const m = oppId.match(/^disc-([a-z]+-\d+)-(.+)$/)
  return { auditId: m?.[1] ?? '', locationId: m?.[2] ?? '' }
}
const oppLocName = (oppId: string) => LOCATION_BY_ID[parseOpp(oppId).locationId]?.name ?? oppId
const discRecord = (s: PersistedState, oppId: string): DiscoveryRecord => s.discovery[oppId] ?? { history: [] }
/** `disc:<opportunityId>` / `acc:<issueId>` → ['disc' | 'acc', id] */
const splitKey = (key: string) => [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] as const

const Ctx = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — state still works in memory */
    }
  }, [state])

  const prompts = useMemo(() => [...PROMPTS, ...state.customPrompts], [state.customPrompts])
  const promptsById = useMemo(() => Object.fromEntries(prompts.map((p) => [p.id, p])), [prompts])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const observationCache = useMemo(() => new Map<string, Observation[]>(), [prompts, state.audits, state.rechecks])

  const observationsFor = useCallback(
    (auditId: string, wave = 0, surface: SurfaceId = 'A') => {
      const key = `${auditId}:${wave}:${surface}`
      const hit = observationCache.get(key)
      if (hit) return hit
      const audit = state.audits.find((a) => a.id === auditId)
      if (!audit) return []
      const recheck = state.rechecks.find((r) => r.priorAuditId === auditId && r.wave === wave)
      if (wave > 0 && !recheck) return []
      // Follow-up answers are sampled during the check, i.e. from the moment the user started it (never before).
      const base = wave === 0 ? audit.createdAt : new Date(new Date(recheck!.sampledAt).getTime() + 600_000).toISOString()
      // Baseline claims are evaluated against the record as it was; rechecks against the facts verified at that time.
      const snapshot = recheck?.factSnapshot ?? {}
      const list: Observation[] = []
      let i = 0
      for (const locId of audit.locationIds) {
        if (!LOCATION_BY_ID[locId]) continue
        const loc = wave === 0 ? LOCATION_BY_ID[locId] : effectiveLocation(locId, snapshot)
        for (const pid of audit.promptIds) {
          const p = promptsById[pid]
          if (p) list.push(buildObservation(audit, wave, loc, p, i++, base, surface))
        }
      }
      observationCache.set(key, list)
      return list
    },
    [observationCache, state.audits, state.rechecks, promptsById],
  )

  const issues = useMemo(
    () => state.audits.flatMap((a) => deriveIssues(a.id, observationsFor(a.id, 0), promptsById, state.factEdits)),
    [state.audits, observationsFor, promptsById, state.factEdits],
  )
  const issueById = useMemo(() => Object.fromEntries(issues.map((i) => [i.id, i])), [issues])

  const scopeLocationIds = useMemo(() => {
    // Both demo roles see the whole BrightNest account.
    return null as Set<string> | null
  }, [state.role])

  const inScope = useCallback((id: string) => !scopeLocationIds || scopeLocationIds.has(id), [scopeLocationIds])
  const can = useCallback((perm: Permission) => PERMISSIONS[state.role].includes(perm), [state.role])
  const hasRelease = useCallback((r: Release) => RELEASE_RANK[state.release] >= RELEASE_RANK[r], [state.release])

  const log = (s: PersistedState, text: string, kind: ActivityEntry['kind'] = 'system'): ActivityEntry[] =>
    [{ id: uid('act'), at: now(), actor: actorName(s.role), kind, text }, ...s.activity].slice(0, 60)

  /** One simulated, permission-checked write for one target. Idempotent; never touches recorded AI answers. */
  const attempt = (s: PersistedState, taskId: string, key: string, version: string): PersistedState => {
    const t = s.tasks.find((x) => x.id === taskId)
    if (!t) return s
    const prior = s.publications.filter((a) => a.taskId === taskId)
    if (prior.some((a) => a.state === 'success' || a.state === 'manual_handoff')) return s
    const sim = simulateAttempt(t, prior.length + 1)
    let sourceUpdates = s.sourceUpdates
    let before: string | undefined
    let after: string | undefined
    if (t.opportunityId) {
      const rec = s.discovery[t.opportunityId]?.plan?.recommendations.find((r) => r.id === t.recommendationId)
      before = rec?.currentText
      after = rec?.proposedText
    } else if (t.field) {
      const srcId = `${t.locationId}-${t.channel === 'owned_website' ? 'web' : t.channel === 'managed_listing' ? 'listing' : 'dir'}`
      before = sourceRecordsFor(t.locationId, s.sourceUpdates).find((r) => r.id === srcId)?.values[t.field] ?? undefined
      after = effectiveLocation(t.locationId, s.factEdits).verifiedFields[t.field].value ?? undefined
      if (sim.state === 'success' && (t.channel === 'owned_website' || t.channel === 'managed_listing') && after) {
        sourceUpdates = { ...sourceUpdates, [`${srcId}:${t.field}`]: { value: after, previous: before ?? null, at: now(), taskId } }
      }
    }
    const status: TaskStatus = sim.state === 'success' ? 'awaiting_recheck' : sim.state === 'manual_handoff' ? 'source_updated' : t.status
    const rec: PublicationAttempt = { id: uid('pub'), taskId, proposalKey: key, approvedVersion: version, permission: sim.permission, permissionChecked: true, state: sim.state, before, after, detail: sim.detail, simulated: true, recordedAt: now() }
    const text = sim.state === 'success' ? `Update recorded (simulated): ${sim.detail} Recorded AI answers are unchanged.` : sim.state === 'manual_handoff' ? sim.detail : `Not published: ${sim.detail}`
    return {
      ...s,
      sourceUpdates,
      publications: [...s.publications, rec],
      tasks: s.tasks.map((x) =>
        x.id === taskId
          ? {
              ...x,
              status,
              evidence: sim.state === 'success' ? [...x.evidence, { label: 'Publication evidence', value: sim.detail }] : x.evidence,
              activity: [...x.activity, { id: uid('a'), at: now(), actor: 'ProManage (automated)', kind: 'system', text }, ...(status !== x.status ? [{ id: uid('a'), at: now(), actor: 'System', kind: 'status' as const, text: `Status → ${taskStatusLabel(status, x.channel)}` }] : [])],
            }
          : x,
      ),
    }
  }

  const store: Store = {
    ...state,
    prompts,
    promptsById,
    latestAudit: state.audits[state.audits.length - 1] ?? null,
    issues,
    issueById,
    scopeLocationIds,
    inScope,
    can,
    hasRelease,
    observationsFor,
    assetState: (locationId, kind) => {
      const a = state.assets[assetKey(locationId, kind)] ?? { status: 'draft' as const }
      const stale = a.status === 'approved' && a.fingerprint !== assetFingerprint(locationId, kind, state.factEdits)
      return { ...a, status: stale ? 'draft' : a.status, stale }
    },
    rechecksFor: (auditId) => state.rechecks.filter((r) => r.priorAuditId === auditId).sort((a, b) => a.wave - b.wave),

    setRelease: (release) => setState((s) => ({ ...s, release })),

    // Click-to-unlock (PRD v7 §5): opening a chapter only reveals capability. It never approves or publishes anything.
    openChapter: (c) =>
      setState((s) => {
        const next = (['MVP', 'V1', 'V2'] as Release[])[c - 1]
        return RELEASE_RANK[next] > RELEASE_RANK[s.release] ? { ...s, release: next } : s
      }),

    setDetectLocations: (ids) => setState((s) => ({ ...s, detectLocationIds: ids })),
    setDetectPrompts: (ids) => setState((s) => ({ ...s, detectPromptIds: ids })),

    // Simulated ProManage backend: investigate the standard check's findings and prepare evidence-backed proposals.
    prepareImprovements: (auditId) =>
      setState((s) => {
        const audit = s.audits.find((a) => a.id === auditId)
        if (!audit || s.autoPrepared[auditId]) return s
        const at = now()
        const system = 'ProManage (automated)'
        const discovery = { ...s.discovery }
        const investigations = { ...s.investigations }
        const plans = { ...s.plans }
        let prepared = 0
        const opps = deriveOpportunities(audit, observationsFor(auditId, 0), { prompts: promptsById, eligibility: s.discoveryEligibility, factEdits: s.factEdits, records: s.discovery, tasks: s.tasks, release: 'V1' })
        for (const opp of opps) {
          const r = discovery[opp.id] ?? { history: [] }
          if (opp.eligibility !== 'eligible' || r.plan || r.monitorOnly || r.decision?.kind === 'dismissed' || r.archived) continue
          const findings = readinessFindings(opp, s.factEdits, at)
          // Changes the accuracy correction already makes aren't proposed twice; only confirmed, controllable gaps (plus request-only and site-admin checks) are proposed.
          const usable = findings.filter((f) => f.draft && !f.blockedReason && !f.coveredByAccuracy && (f.certainty === 'confirmed_gap' || f.category === 'offsite' || f.category === 'freshness' || f.draft.delivery === 'advisory_only'))
          const confirmed = usable.filter((f) => f.certainty === 'confirmed_gap')
          const base = { ...r, decision: r.decision ?? { kind: 'worth_investigating' as const, by: 'promanage' as Role, byName: system, at } }
          if (!confirmed.length) {
            discovery[opp.id] = { ...base, investigation: { status: 'completed', requestedBy: 'promanage', requestedAt: at, checkedAt: at, completedAt: at, result: 'no_gap', findingReviews: {}, note: 'Sources inspected look complete' }, monitorOnly: { by: system, at, note: 'No confirmed, controllable gap found' }, history: [...r.history, { at, by: system, text: 'Checked managed sources — no supported change recommended yet' }] }
            continue
          }
          const loc = LOCATION_BY_ID[opp.locationId]
          discovery[opp.id] = {
            ...base,
            investigation: { status: 'completed', requestedBy: 'promanage', requestedAt: at, checkedAt: at, completedAt: at, result: 'gaps_found', findingReviews: Object.fromEntries(usable.map((f) => [f.id, 'confirmed' as const])) },
            plan: {
              id: `plan-${opp.id}-r1`,
              opportunityId: opp.id,
              round: 1,
              createdBy: system,
              status: 'awaiting_brand_approval',
              summary: `${loc.name} wasn’t mentioned in ${opp.targetPromptIds.length} relevant sampled search${opp.targetPromptIds.length === 1 ? '' : 'es'} (${opp.intentCategory}). ProManage checked the information it manages for this centre and found specific gaps you can approve fixing. These make accurate information easier to find; they can’t guarantee any AI answer changes.`,
              recommendations: usable.map((f) => f.draft!),
              taskIds: [],
              comments: [{ at, by: 'promanage', kind: 'sent', text: 'Prepared by ProManage (simulated) and sent for Brand authorization' }],
              updatedAt: at,
            },
            history: [...r.history, { at, by: system, text: `Investigated managed sources and prepared ${usable.length} recommendations (simulated)` }],
          }
          prepared++
        }
        for (const issue of issues.filter((i) => i.auditId === auditId && i.category === 'factual_mismatch' && !i.entityConfusion)) {
          if (plans[issue.id] || s.reviews[issue.reviewKey]?.status === 'not_issue') continue
          const verified = issue.field ? effectiveLocation(issue.locationId, s.factEdits).verifiedFields[issue.field] : null
          if (!verified || verified.status !== 'verified') continue
          const draft = suggestPlan(issue, sourceRecordsFor(issue.locationId, s.sourceUpdates), s.factEdits)
          const round = investigations[issue.id]?.round ?? 1
          investigations[issue.id] = { status: 'completed', round, finding: draft.items.length ? 'Controllable source differences found' : 'Sources we can inspect match your information', requestedBy: 'promanage', requestedAt: at, updatedAt: at, history: [...(investigations[issue.id]?.history ?? []), { at, by: 'promanage', text: 'Source comparison prepared automatically (simulated)' }] }
          if (draft.items.length) {
            plans[issue.id] = { issueId: issue.id, round, status: 'awaiting_brand_approval', why: draft.why, items: draft.items, taskIds: [], comments: [{ at, by: 'promanage', kind: 'sent', text: 'Prepared by ProManage (simulated)' }], updatedAt: at }
            prepared++
          }
        }
        return { ...s, discovery, investigations, plans, autoPrepared: { ...s.autoPrepared, [auditId]: at }, activity: log(s, `recommendation_generated · ProManage prepared ${prepared} improvement proposals (simulated)`) }
      }),

    authorizeProposal: (key, targetIds, comment) => {
      const [kind, id] = splitKey(key)
      // 1. Freeze the approval: version, scope (selected targets) and verified facts it relies on.
      setState((s) => {
        const actor = actorName(s.role)
        if (kind === 'disc') {
          const r = s.discovery[id]
          const plan = r?.plan
          if (!plan || plan.status !== 'awaiting_brand_approval') return s
          const chosen = plan.recommendations.filter((x) => targetIds.includes(x.id))
          if (!chosen.length) return s
          const approval: ProposalApproval = { id: uid('appr'), proposalKey: key, approvedVersion: `r${plan.round}`, approvedTargetIds: chosen.map((c) => c.id), approverRole: 'brand', approverName: actor, verifiedFactVersionIds: [...new Set(chosen.flatMap((c) => c.businessFactIds))].map((f) => `${f}@${s.factEdits[f]?.at ?? 'seed'}`), action: 'approve', comment, at: now() }
          const left = plan.recommendations.filter((x) => !targetIds.includes(x.id))
          return { ...s, approvals: [...s.approvals, approval], discovery: { ...s.discovery, [id]: { ...r, plan: { ...plan, recommendations: chosen }, history: [...r.history, { at: now(), by: actor, text: `Authorized ${chosen.length} change${chosen.length === 1 ? '' : 's'} (version r${plan.round})${left.length ? `; not authorized: ${left.map((l) => l.brandTitle).join(', ')}` : ''}` }] } } }
        }
        const plan = s.plans[id]
        const issue = issues.find((i) => i.id === id)
        if (!plan || !issue || plan.status !== 'awaiting_brand_approval') return s
        const chosen = plan.items.filter((x) => targetIds.includes(x.id))
        if (!chosen.length) return s
        const approval: ProposalApproval = { id: uid('appr'), proposalKey: key, approvedVersion: `r${plan.round}`, approvedTargetIds: chosen.map((c) => c.id), approverRole: 'brand', approverName: actor, verifiedFactVersionIds: issue.field ? [`${issue.locationId}:${issue.field}@${s.factEdits[`${issue.locationId}:${issue.field}`]?.at ?? 'seed'}`] : [], action: 'approve', comment, at: now() }
        const prev = s.reviews[issue.reviewKey]
        // Authorizing a correction confirms the AI statement was wrong (verified record is the reference).
        const reviews = prev?.status === 'confirmed' ? s.reviews : { ...s.reviews, [issue.reviewKey]: { status: 'confirmed' as const, by: s.role, at: now(), note: 'Confirmed when authorizing the correction', evidence: prev?.evidence, history: [...(prev?.history ?? []), { status: 'confirmed' as const, by: s.role, at: now() }] } }
        return { ...s, reviews, approvals: [...s.approvals, approval], plans: { ...s.plans, [id]: { ...plan, items: chosen } } }
      })
      // 2. Existing approval engine creates the tasks (reused, not duplicated).
      if (kind === 'disc') store.approveDiscoveryPlan(id, comment)
      else store.approvePlan(id, comment)
      // 3. Simulated automatic execution, per target, only within the approved scope.
      setState((s) => {
        const plan = kind === 'disc' ? s.discovery[id]?.plan : s.plans[id]
        if (!plan || plan.status !== 'approved') return s
        let next = s
        for (const taskId of plan.taskIds) next = attempt(next, taskId, key, `r${plan.round}`)
        const results = plan.taskIds.map((tid) => next.publications.filter((p) => p.taskId === tid).pop()).filter(Boolean)
        const count = (st: string) => results.filter((r) => r!.state === st).length
        let activity = log(next, `proposal_approved · ${key} · version r${plan.round}`, 'approval')
        activity = log({ ...next, activity }, `publish_target_result · ${key} · ${count('success')} published, ${count('failed')} failed, ${count('blocked')} need site admin, ${count('manual_handoff')} external request prepared (simulated)`, 'status')
        if (count('manual_handoff')) activity = log({ ...next, activity }, `external_request_draft_approved · ${key} · handed off to ProManage, not sent`, 'status')
        return { ...next, activity }
      })
    },

    logEvent: (text) => setState((s) => ({ ...s, activity: log(s, text, 'system') })),

    rejectProposal: (key, action, comment) => {
      const [kind, id] = splitKey(key)
      setState((s) => {
        const plan = kind === 'disc' ? s.discovery[id]?.plan : s.plans[id]
        if (!plan) return s
        return { ...s, approvals: [...s.approvals, { id: uid('appr'), proposalKey: key, approvedVersion: `r${plan.round}`, approvedTargetIds: [], approverRole: 'brand', approverName: actorName(s.role), verifiedFactVersionIds: [], action, comment, at: now() }] }
      })
      setState((s) => ({ ...s, activity: log(s, `${action === 'decline' ? 'proposal_declined' : 'proposal_changes_requested'} · ${key}`, 'status') }))
      if (kind === 'disc') (action === 'decline' ? store.declineDiscoveryPlan : store.requestDiscoveryPlanChanges)(id, comment)
      else (action === 'decline' ? store.declinePlan : store.requestPlanChanges)(id, comment)
    },

    // Simulated ProManage turnaround on a change request: a new version that needs fresh authorization.
    reviseProposal: (key) =>
      setState((s) => {
        const [kind, id] = splitKey(key)
        const at = now()
        if (kind === 'disc') {
          const r = s.discovery[id]
          const plan = r?.plan
          if (!plan || plan.status !== 'changes_requested') return s
          const ask = plan.comments.filter((c) => c.kind === 'changes').pop()?.text ?? ''
          return { ...s, discovery: { ...s.discovery, [id]: { ...r, previousPlans: [...(r.previousPlans ?? []), plan], plan: { ...plan, id: `plan-${id}-r${plan.round + 1}`, round: plan.round + 1, status: 'awaiting_brand_approval', summary: `${plan.summary}\n\nRevised after your comment: “${ask}”. Only verified facts are used.`, comments: [...plan.comments, { at, by: 'promanage', kind: 'sent', text: `Revised version r${plan.round + 1} sent (simulated)` }], updatedAt: at }, history: [...r.history, { at, by: 'ProManage (automated)', text: `Revised plan to r${plan.round + 1} after Brand comment` }] } } }
        }
        const plan = s.plans[id]
        if (!plan || plan.status !== 'changes_requested') return s
        const ask = plan.comments.filter((c) => c.kind === 'changes').pop()?.text ?? ''
        const inv = s.investigations[id]
        return { ...s, investigations: inv ? { ...s.investigations, [id]: { ...inv, round: plan.round + 1 } } : s.investigations, plans: { ...s.plans, [id]: { ...plan, round: plan.round + 1, status: 'awaiting_brand_approval', why: `${plan.why} Revised after your comment: “${ask}”.`, comments: [...plan.comments, { at, by: 'promanage', kind: 'sent', text: `Revised version r${plan.round + 1} sent (simulated)` }], updatedAt: at } } }
      }),

    retryPublication: (taskId) =>
      setState((s) => {
        const last = s.publications.filter((a) => a.taskId === taskId).pop()
        if (!last || last.state !== 'failed') return s
        const next = attempt(s, taskId, last.proposalKey, last.approvedVersion)
        return { ...next, activity: log(next, `Retried ${taskId} after ProManage re-validated access (simulated)`, 'status') }
      }),

    saveGoal: ({ question, locationId, label, importance }) => {
      const q = question.trim()
      const goal: PrioritySearchGoal = {
        id: uid('goal'),
        organizationId: ORG.id,
        locationIds: [locationId],
        anchorQuestion: q,
        normalizedAnchor: norm(q),
        label,
        goalVersion: 1,
        importance: importance ?? 'standard',
        status: 'active',
        promptId: matchPrompt(q, locationId, prompts),
        history: [{ version: 1, anchorQuestion: q, locationIds: [locationId], at: now() }],
        createdBy: 'brand',
        createdAt: now(),
        updatedAt: now(),
        simulated: true,
      }
      setState((s) => ({ ...s, goals: [...s.goals, goal], selectedGoalId: goal.id, activity: log(s, `Saved visibility goal · “${q}” · ${LOCATION_BY_ID[locationId]?.name}`, 'created') }))
      return goal
    },

    updateGoal: (id, patch) =>
      setState((s) => ({
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== id) return g
          if (patch.question && norm(patch.question) !== g.normalizedAnchor) {
            // A changed question is a new version: earlier observations stay with the old version.
            const v = g.goalVersion + 1
            return { ...g, anchorQuestion: patch.question.trim(), normalizedAnchor: norm(patch.question), goalVersion: v, promptId: matchPrompt(patch.question, g.locationIds[0], prompts), history: [...g.history, { version: v, anchorQuestion: patch.question.trim(), locationIds: g.locationIds, at: now() }], updatedAt: now() }
          }
          return patch.status ? { ...g, status: patch.status, updatedAt: now() } : g
        }),
        selectedGoalId: patch.status === 'archived' && s.selectedGoalId === id ? null : s.selectedGoalId,
      })),

    selectGoal: (id) => setState((s) => ({ ...s, selectedGoalId: id })),
    setRole: (role) => setState((s) => ({ ...s, role })),
    dismissOnboarding: () => setState((s) => ({ ...s, onboardingDismissed: true })),
    resetDemo: () => {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
      setState(initialState())
    },

    createAudit: ({ name, locationIds, promptIds, mode, csvImport }) => {
      const id = `aud-${String(state.audits.length + 1).padStart(3, '0')}`
      const audit: Audit = { id, name, createdAt: now(), createdBy: state.role, locationIds, promptIds, surface: SURFACE, status: 'complete', mode: mode ?? (state.role === 'promanage' ? 'assisted' : 'self-serve'), csvImport, simulated: true }
      setState((s) => ({
        ...s,
        audits: [...s.audits, audit],
        monitoring: { ...s.monitoring, cohortAuditId: s.monitoring.cohortAuditId ?? id },
        activity: log(s, `Ran audit ${id} · ${locationIds.length} centers × ${promptIds.length} prompts`),
      }))
      return audit
    },

    saveCustomPrompt: (p) =>
      setState((s) => {
        const exists = s.customPrompts.some((x) => x.id === p.id)
        return { ...s, customPrompts: exists ? s.customPrompts.map((x) => (x.id === p.id ? p : x)) : [...s.customPrompts, p] }
      }),
    deleteCustomPrompt: (id) => setState((s) => ({ ...s, customPrompts: s.customPrompts.filter((p) => p.id !== id) })),

    setReview: (observationId, status, note, context, evidence) =>
      setState((s) => {
        const prev = s.reviews[observationId]
        const [, locId] = observationId.match(/^[a-z]+-\d+-(.+)-p\w+$/) ?? []
        const loc = context ?? (locId ? LOCATION_BY_ID[locId]?.name : 'issue')
        const labels: Record<ReviewStatus, string> = { confirmed: 'Confirmed discrepancy', not_issue: 'Marked not an issue', investigating: 'Marked needs investigation', unreviewed: 'Cleared review' }
        return {
          ...s,
          reviews: {
            ...s.reviews,
            [observationId]: {
              status,
              note,
              by: s.role,
              at: now(),
              evidence: evidence ?? prev?.evidence,
              history: [...(prev?.history ?? []), { status, by: s.role, at: now(), note }],
            },
          },
          activity: log(s, `${labels[status]} · ${loc}`, 'status'),
        }
      }),

    createTask: (input) => {
      const actor = actorName(state.role)
      const kinds = input.assetKinds ?? []
      // Content that already carries business approval moves the task straight to Approved.
      const preApproved = input.status === 'prepared' && kinds.length > 0 && kinds.every((k) => isAssetApproved(state, input.locationId, k))
      const task: Task = {
        id: `task-${String(state.tasks.length + 1).padStart(3, '0')}`,
        issueId: input.issueId,
        locationId: input.locationId,
        title: input.title,
        assigneeId: input.assigneeId,
        channel: input.channel,
        target: input.target,
        dueAt: input.dueAt,
        notes: input.notes,
        assetKinds: kinds,
        field: input.field,
        evidence: input.evidence ?? [],
        status: preApproved ? 'approved' : (input.status ?? 'open'),
        approvedBy: preApproved ? state.assets[assetKey(input.locationId, kinds[0])]?.approvedBy : undefined,
        approvedAt: preApproved ? state.assets[assetKey(input.locationId, kinds[0])]?.approvedAt : undefined,
        createdAt: now(),
        activity: [
          { id: uid('a'), at: now(), actor, kind: 'created', text: `Created task (${CHANNEL_LABELS[input.channel]}) and assigned to ${PEOPLE.find((p) => p.id === input.assigneeId)?.name}` },
          ...(kinds.length ? [{ id: uid('a'), at: now(), actor, kind: 'system' as const, text: `Attached ${kinds.map((k) => (k === 'jsonld' ? 'JSON-LD' : 'fact sheet')).join(' and ')} from GEO Readiness` }] : []),
          ...(preApproved ? [{ id: uid('a'), at: now(), actor: 'System', kind: 'approval' as const, text: 'Attached content was already approved in GEO Readiness — task starts at Approved' }] : []),
        ],
      }
      setState((s) => ({ ...s, tasks: [...s.tasks, task], activity: log(s, `Created ${task.id}: ${task.title}`, 'created') }))
      return task
    },

    setTaskStatus: (taskId, status, note) =>
      setState((s) => {
        const t = s.tasks.find((x) => x.id === taskId)
        if (!t) return s
        let sourceUpdates = s.sourceUpdates
        let next: TaskStatus = status
        const extra: ActivityEntry[] = []
        if (status === 'source_updated' && (t.channel === 'owned_website' || t.channel === 'managed_listing')) {
          // Authorized source change (simulated): update the snapshot, never the recorded AI answer.
          const srcId = `${t.locationId}-${t.channel === 'owned_website' ? 'web' : 'listing'}`
          const verified = t.field ? effectiveLocation(t.locationId, s.factEdits).verifiedFields[t.field].value : null
          if (t.field && verified) {
            const before = sourceRecordsFor(t.locationId, s.sourceUpdates).find((r) => r.id === srcId)?.values[t.field] ?? null
            sourceUpdates = { ...sourceUpdates, [`${srcId}:${t.field}`]: { value: verified, previous: before, at: now(), taskId } }
          }
          next = 'awaiting_recheck'
          extra.push(
            { id: uid('a'), at: now(), actor: 'System', kind: 'system', text: `Source updated (simulated): ${CHANNEL_LABELS[t.channel].toLowerCase()}${t.field && verified ? ` now states “${verified}”` : ''}. The recorded AI answer is unchanged.` },
            { id: uid('a'), at: now(), actor: 'System', kind: 'status', text: 'Status → Awaiting AI recheck' },
          )
        }
        return {
          ...s,
          sourceUpdates,
          tasks: s.tasks.map((x) =>
            x.id === taskId
              ? {
                  ...x,
                  status: next,
                  activity: [...x.activity, { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'status', text: `Status → ${taskStatusLabel(status, x.channel)}${note ? ` · ${note}` : ''}` }, ...extra],
                }
              : x,
          ),
          activity: log(s, `${taskId} moved to ${taskStatusLabel(next, t.channel)}`, 'status'),
        }
      }),

    recordExternalChange: (taskId) =>
      setState((s) => {
        const t = s.tasks.find((x) => x.id === taskId)
        if (!t) return s
        const verified = t.field ? effectiveLocation(t.locationId, s.factEdits).verifiedFields[t.field].value : null
        const srcId = `${t.locationId}-dir`
        const before = t.field ? (sourceRecordsFor(t.locationId, s.sourceUpdates).find((r) => r.id === srcId)?.values[t.field] ?? null) : null
        return {
          ...s,
          sourceUpdates: t.field && verified ? { ...s.sourceUpdates, [`${srcId}:${t.field}`]: { value: verified, previous: before, at: now(), taskId } } : s.sourceUpdates,
          tasks: s.tasks.map((x) =>
            x.id === taskId
              ? {
                  ...x,
                  status: 'awaiting_recheck',
                  activity: [
                    ...x.activity,
                    { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'system', text: 'Evidence recorded: the directory now shows the corrected value (simulated snapshot).' },
                    { id: uid('a'), at: now(), actor: 'System', kind: 'status', text: 'Status → Awaiting AI recheck' },
                  ],
                }
              : x,
          ),
          activity: log(s, `${taskId}: external change evidenced`, 'status'),
        }
      }),

    setEligibility: (locationId, promptId, status, reason, note) =>
      setState((s) => {
        const key = eligibilityKey(locationId, promptId)
        const next = { ...s.discoveryEligibility }
        if (status) next[key] = { status, reason: status === 'not_relevant' ? (reason ?? 'other') : undefined, note, by: s.role, byName: actorName(s.role), at: now() }
        else delete next[key]
        const loc = LOCATION_BY_ID[locationId]
        const what = status === 'not_relevant' ? 'Marked not relevant' : status === 'eligible' ? 'Confirmed relevant' : 'Cleared relevance decision'
        return { ...s, discoveryEligibility: next, activity: log(s, `${what} · ${loc?.name} · “${promptsById[promptId]?.text.replace('{neighborhood}', loc?.neighborhood ?? '').replace('{city}', loc?.city ?? '')}”`, 'status') }
      }),

    confirmService: (locationId, service) =>
      setState((s) => {
        // Reuses the business-fact workflow: Brand confirms directly; ProManage can only propose (pending Brand approval).
        const id = factId(locationId, 'programs')
        const current = effectiveLocation(locationId, s.factEdits).verifiedFields.programs.value ?? ''
        if (current.toLowerCase().includes(service.toLowerCase())) return s
        const value = current ? `${current}, ${service}` : service
        const direct = s.role === 'brand'
        return {
          ...s,
          factEdits: { ...s.factEdits, [id]: { status: direct ? 'verified' : 'pending_approval', value, by: actorName(s.role), at: now() } },
          discovery: Object.fromEntries(Object.entries(s.discovery).map(([k, r]) => [k, r.confirmRequested && k.endsWith(`-${locationId}`) && direct ? { ...r, confirmRequested: undefined, history: [...r.history, { at: now(), by: actorName(s.role), text: `Confirmed service: ${service}` }] } : r])),
          activity: log(s, `${direct ? 'Confirmed service' : 'Proposed service'} · ${LOCATION_BY_ID[locationId]?.name} · ${service}`, 'approval'),
        }
      }),

    requestServiceConfirmation: (oppId, service) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        return { ...s, discovery: { ...s.discovery, [oppId]: { ...r, confirmRequested: { by: actorName(s.role), at: now(), service }, history: [...r.history, { at: now(), by: actorName(s.role), text: `Asked the Brand to confirm: ${service}` }] } }, activity: log(s, `Asked Brand to confirm a service · ${oppLocName(oppId)}`, 'status') }
      }),

    setDiscoveryDecision: (oppId, kind, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        const text = kind === 'worth_investigating' ? 'Marked worth investigating' : kind === 'dismissed' ? 'Marked not relevant' : 'Cleared decision'
        return {
          ...s,
          discovery: { ...s.discovery, [oppId]: { ...r, decision: kind ? { kind, by: s.role, byName: actorName(s.role), at: now(), note } : undefined, history: [...r.history, { at: now(), by: actorName(s.role), text: `${text}${note ? ` — ${note}` : ''}` }] } },
          activity: log(s, `${text} · discovery · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    startDiscoveryInvestigation: (oppId, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        const text = s.role === 'brand' ? `Asked ProManage to investigate${note ? ` — ${note}` : ''}` : 'Investigation started'
        return {
          ...s,
          discovery: {
            ...s.discovery,
            [oppId]: {
              ...r,
              decision: r.decision?.kind === 'worth_investigating' ? r.decision : { kind: 'worth_investigating', by: s.role, byName: actorName(s.role), at: now(), note },
              investigation: { status: 'in_progress', requestedBy: s.role, requestedAt: now(), findingReviews: r.investigation?.findingReviews ?? {}, checkedAt: r.investigation?.checkedAt },
              monitorOnly: undefined,
              history: [...r.history, { at: now(), by: actorName(s.role), text }],
            },
          },
          activity: log(s, `${text} · discovery · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    runReadinessCheck: (oppId) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        const inv = r.investigation ?? { status: 'in_progress' as const, requestedBy: s.role, requestedAt: now(), findingReviews: {} }
        return {
          ...s,
          discovery: {
            ...s.discovery,
            [oppId]: { ...r, decision: r.decision ?? { kind: 'worth_investigating', by: s.role, byName: actorName(s.role), at: now() }, investigation: { ...inv, checkedAt: now() }, history: [...r.history, { at: now(), by: actorName(s.role), text: 'Ran readiness check on seeded source snapshots (simulated)' }] },
          },
          activity: log(s, `Readiness check run · ${oppLocName(oppId)}`),
        }
      }),

    reviewFinding: (oppId, findingId, verdict) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        if (!r.investigation) return s
        const reviews = { ...r.investigation.findingReviews }
        if (verdict) reviews[findingId] = verdict
        else delete reviews[findingId]
        return { ...s, discovery: { ...s.discovery, [oppId]: { ...r, investigation: { ...r.investigation, findingReviews: reviews } } } }
      }),

    markNoControllableGap: (oppId, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        if (!r.investigation) return s
        return {
          ...s,
          discovery: {
            ...s.discovery,
            [oppId]: {
              ...r,
              investigation: { ...r.investigation, status: 'completed', result: 'no_gap', completedAt: now(), note },
              monitorOnly: { by: actorName(s.role), at: now(), note },
              history: [...r.history, { at: now(), by: actorName(s.role), text: `No controllable information gap found — monitor this query${note ? ` (${note})` : ''}` }],
            },
          },
          activity: log(s, `No controllable gap found · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    saveDiscoveryPlan: (oppId, input, send) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        const prev = r.plan
        const round = prev ? (prev.status === 'declined' ? prev.round + 1 : prev.round) : (r.previousPlans?.length ?? 0) + 1
        const comments = [...(prev && prev.round === round ? prev.comments : []), ...(send ? [{ at: now(), by: s.role, kind: 'sent' as const, text: 'Sent to Brand for approval' }] : [])]
        return {
          ...s,
          discovery: {
            ...s.discovery,
            [oppId]: {
              ...r,
              investigation: r.investigation ? { ...r.investigation, status: send ? 'completed' : r.investigation.status, result: 'gaps_found', completedAt: send ? now() : r.investigation.completedAt } : r.investigation,
              monitorOnly: undefined,
              plan: { id: `plan-${oppId}-r${round}`, opportunityId: oppId, round, createdBy: actorName(s.role), status: send ? 'awaiting_brand_approval' : 'draft', summary: input.summary, recommendations: input.recommendations, taskIds: [], comments, updatedAt: now() },
              history: [...r.history, { at: now(), by: actorName(s.role), text: send ? `Improvement plan sent to Brand (${input.recommendations.length} recommendations)` : 'Improvement plan saved as draft' }],
            },
          },
          activity: log(s, `${send ? 'Discovery improvement plan sent to Brand' : 'Discovery plan drafted'} · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    approveDiscoveryPlan: (oppId, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        const plan = r.plan
        // Only a plan waiting for approval can become work: declined / changes-requested plans can't be implemented.
        if (!plan || plan.status !== 'awaiting_brand_approval') return s
        const { locationId } = parseOpp(oppId)
        const loc = LOCATION_BY_ID[locationId]
        const actor = actorName(s.role)
        const assets = { ...s.assets }
        const technical = plan.recommendations.filter((x) => x.channel === 'structured_info')
        for (const t of technical) {
          for (const k of t.technicalAssetIds ?? []) {
            const key = assetKey(locationId, k)
            assets[key] = { ...assets[key], status: 'approved', approvedBy: `${actor} (discovery plan approval)`, approvedAt: now(), fingerprint: assetFingerprint(locationId, k, s.factEdits), version: (assets[key]?.version ?? 0) + 1 }
          }
        }
        let n = s.tasks.length
        const mk = (rec: OptimizationRecommendation, channel: ControlledChannel, assetKinds: AssetKind[] = []): Task => {
          n += 1
          const approved = rec.requiresBrandApproval || assetKinds.length > 0
          return {
            id: `task-${String(n).padStart(3, '0')}`,
            opportunityId: oppId,
            recommendationId: rec.id,
            locationId,
            title: `${rec.title} — ${loc.neighborhood}`,
            assigneeId: channel === 'owned_website' ? 'u-kavya' : 'u-rahul',
            channel,
            target: rec.controlledSource,
            dueAt: new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10),
            notes: rec.proposedText ?? rec.title,
            status: approved ? 'approved' : 'open',
            assetKinds,
            evidence: [
              { label: 'Discovery opportunity', value: `${loc.name} · not mentioned in selected unbranded searches` },
              ...(rec.currentText ? [{ label: 'Current text (snapshot)', value: rec.currentText }] : []),
              ...(rec.proposedText ? [{ label: 'Approved text', value: rec.proposedText }] : []),
              { label: 'Plan approved by', value: `${actor} (Brand)` },
            ],
            approvedBy: approved ? `${actor} (Brand)` : undefined,
            approvedAt: approved ? now() : undefined,
            createdAt: now(),
            activity: [
              { id: uid('a'), at: now(), actor: 'System', kind: 'created', text: `Created from the approved discovery improvement plan (${CHANNEL_LABELS[channel]})` },
              ...(approved ? [{ id: uid('a'), at: now(), actor, kind: 'approval' as const, text: 'Business approval given by Brand on the improvement plan' }] : []),
              ...(assetKinds.length ? [{ id: uid('a'), at: now(), actor: 'System', kind: 'system' as const, text: 'Attached JSON-LD from GEO Readiness (approved with the plan)' }] : []),
            ],
          }
        }
        const newTasks: Task[] = []
        for (const rec of plan.recommendations) {
          if (rec.channel === 'structured_info') continue
          newTasks.push(mk(rec, rec.channel as ControlledChannel))
        }
        if (technical.length) {
          const kinds = [...new Set(technical.flatMap((t) => t.technicalAssetIds ?? []))] as AssetKind[]
          const web = newTasks.find((t) => t.channel === 'owned_website' && t.status === 'approved')
          if (web) {
            web.assetKinds = kinds
            web.activity.push({ id: uid('a'), at: now(), actor: 'System', kind: 'system', text: 'Attached JSON-LD from GEO Readiness (approved with the plan)' })
          } else newTasks.push(mk(technical[0], 'owned_website', kinds))
        }
        return {
          ...s,
          assets,
          tasks: [...s.tasks, ...newTasks],
          discovery: {
            ...s.discovery,
            [oppId]: {
              ...r,
              plan: { ...plan, status: 'approved', brandApprovalBy: actor, brandApprovalAt: now(), approvalComment: note, taskIds: newTasks.map((t) => t.id), updatedAt: now(), comments: [...plan.comments, { at: now(), by: s.role, kind: 'approve', text: note || 'Plan approved' }] },
              history: [...r.history, { at: now(), by: actor, text: `Brand approved the improvement plan — ${newTasks.length} task${newTasks.length === 1 ? '' : 's'} created` }],
            },
          },
          activity: log(s, `Brand approved discovery improvement plan · ${loc.name}`, 'approval'),
        }
      }),

    requestDiscoveryPlanChanges: (oppId, comment) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        if (!r.plan) return s
        return {
          ...s,
          discovery: { ...s.discovery, [oppId]: { ...r, plan: { ...r.plan, status: 'changes_requested', updatedAt: now(), comments: [...r.plan.comments, { at: now(), by: s.role, kind: 'changes', text: comment }] }, history: [...r.history, { at: now(), by: actorName(s.role), text: `Requested changes — ${comment}` }] } },
          activity: log(s, `Brand requested changes to discovery plan · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    declineDiscoveryPlan: (oppId, reason) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        if (!r.plan) return s
        return {
          ...s,
          discovery: { ...s.discovery, [oppId]: { ...r, plan: { ...r.plan, status: 'declined', updatedAt: now(), comments: [...r.plan.comments, { at: now(), by: s.role, kind: 'decline', text: reason }] }, history: [...r.history, { at: now(), by: actorName(s.role), text: `Declined the plan — ${reason}` }] } },
          activity: log(s, `Brand declined discovery plan · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    recordDiscoveryUpdate: (taskId, evidence) =>
      setState((s) => {
        const t = s.tasks.find((x) => x.id === taskId)
        if (!t?.opportunityId) return s
        const external = t.channel === 'external_request'
        const next: TaskStatus = external ? 'source_updated' : 'awaiting_recheck'
        return {
          ...s,
          tasks: s.tasks.map((x) =>
            x.id === taskId
              ? {
                  ...x,
                  status: next,
                  evidence: [...x.evidence, { label: external ? 'Request evidence' : 'Publication evidence', value: evidence }],
                  activity: [
                    ...x.activity,
                    { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'system', text: external ? `Update recorded (simulated): correction request sent — ${evidence}. The site owner decides.` : `Update recorded (simulated): ${evidence}. Recorded AI answers are unchanged.` },
                    { id: uid('a'), at: now(), actor: 'System', kind: 'status', text: `Status → ${taskStatusLabel(next, x.channel)}` },
                  ],
                }
              : x,
          ),
          activity: log(s, `${taskId} moved to ${taskStatusLabel(next, t.channel)}`, 'status'),
        }
      }),

    reopenDiscovery: (oppId, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        return {
          ...s,
          discovery: {
            ...s.discovery,
            [oppId]: {
              ...r,
              investigation: { status: 'in_progress', requestedBy: s.role, requestedAt: now(), findingReviews: {}, checkedAt: undefined },
              monitorOnly: undefined,
              // The previous plan stays on record — a new round needs a new, separately approved plan.
              previousPlans: r.plan ? [...(r.previousPlans ?? []), r.plan] : r.previousPlans,
              plan: undefined,
              history: [...r.history, { at: now(), by: actorName(s.role), text: `New investigation round started — ${note}${r.plan ? ` (previous plan round ${r.plan.round} kept on record)` : ''}` }],
            },
          },
          activity: log(s, `New discovery investigation round · ${oppLocName(oppId)}`, 'status'),
        }
      }),

    archiveDiscovery: (oppId, note) =>
      setState((s) => {
        const r = discRecord(s, oppId)
        return { ...s, discovery: { ...s.discovery, [oppId]: { ...r, archived: { by: actorName(s.role), at: now(), note }, history: [...r.history, { at: now(), by: actorName(s.role), text: `Archived${note ? ` — ${note}` : ''}` }] } }, activity: log(s, `Archived discovery opportunity · ${oppLocName(oppId)}`) }
      }),

    setDisposition: (issueId, status, note) =>
      setState((s) => {
        const next = { ...s.dispositions }
        if (status) next[issueId] = { status, note, by: actorName(s.role), at: now() }
        else delete next[issueId]
        const labels: Record<Disposition, string> = { monitoring: 'Set to monitor', closed: 'Closed issue', reinvestigate: 'Reopened investigation' }
        const tasks =
          status === 'closed'
            ? s.tasks.map((t) =>
                t.issueId === issueId && t.status === 'awaiting_recheck'
                  ? { ...t, status: 'closed' as const, activity: [...t.activity, { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'status' as const, text: `Status → Closed · issue closed${note ? ` (${note})` : ''}` }] }
                  : t,
              )
            : s.tasks
        return { ...s, tasks, dispositions: next, activity: log(s, `${status ? labels[status] : 'Cleared disposition'} · ${issueId}`, 'status') }
      }),

    sourcesFor: (locationId) => sourceRecordsFor(locationId, state.sourceUpdates),
    addActivity: (text) => setState((s) => ({ ...s, activity: log(s, text) })),

    requestInvestigation: (issueId, note) =>
      setState((s) => {
        const prev = s.investigations[issueId]
        const round = prev ? prev.round + (prev.status === 'in_progress' ? 0 : 1) : 1
        const text = prev ? `Further investigation requested${note ? ` — ${note}` : ''}` : `Sent to ProManage for review${note ? ` — ${note}` : ''}`
        return {
          ...s,
          investigations: {
            ...s.investigations,
            [issueId]: { status: 'in_progress', round, requestedBy: s.role, requestedAt: now(), updatedAt: now(), finding: undefined, history: [...(prev?.history ?? []), { at: now(), by: s.role, text }] },
          },
          dispositions: prev ? { ...s.dispositions, [issueId]: { status: 'reinvestigate', note, by: actorName(s.role), at: now() } } : s.dispositions,
          activity: log(s, `${text} · ${issueId}`, 'status'),
        }
      }),

    completeInvestigation: (issueId, status, finding) =>
      setState((s) => {
        const prev = s.investigations[issueId]
        if (!prev) return s
        return {
          ...s,
          investigations: { ...s.investigations, [issueId]: { ...prev, status, finding, updatedAt: now(), history: [...prev.history, { at: now(), by: s.role, text: `Investigation ${status === 'completed' ? 'completed' : 'inconclusive'}: ${finding}` }] } },
          activity: log(s, `Investigation ${status} · ${issueId}`, 'status'),
        }
      }),

    savePlan: (issueId, plan, send) =>
      setState((s) => {
        const inv = s.investigations[issueId]
        const prev = s.plans[issueId]
        const round = inv?.round ?? 1
        const comments = [...(prev && prev.round === round ? prev.comments : []), ...(send ? [{ at: now(), by: s.role, kind: 'sent' as const, text: 'Sent to Brand for approval' }] : [])]
        return {
          ...s,
          plans: { ...s.plans, [issueId]: { issueId, round, status: send ? 'awaiting_brand_approval' : 'draft', why: plan.why, items: plan.items, taskIds: [], comments, updatedAt: now() } },
          investigations: inv && inv.status === 'in_progress' && send ? { ...s.investigations, [issueId]: { ...inv, status: 'completed', finding: inv.finding ?? 'Controllable source differences found', updatedAt: now() } } : s.investigations,
          activity: log(s, `${send ? 'Correction plan sent to Brand' : 'Correction plan drafted'} · ${issueId}`, 'status'),
        }
      }),

    approvePlan: (issueId, note) =>
      setState((s) => {
        const plan = s.plans[issueId]
        if (!plan || plan.status !== 'awaiting_brand_approval') return s
        const issue = issues.find((i) => i.id === issueId)
        if (!issue) return s
        const loc = LOCATION_BY_ID[issue.locationId]
        const actor = actorName(s.role)
        const withAssets = plan.items.some((it) => it.kind === 'structured_info')
        const assets = { ...s.assets }
        if (withAssets) {
          for (const k of ['jsonld', 'factsheet'] as AssetKind[]) {
            const key = assetKey(issue.locationId, k)
            assets[key] = { ...assets[key], status: 'approved', approvedBy: `${actor} (plan approval)`, approvedAt: now(), fingerprint: assetFingerprint(issue.locationId, k, s.factEdits), version: (assets[key]?.version ?? 0) + 1 }
          }
        }
        let n = s.tasks.length
        const verified = issue.field ? effectiveLocation(issue.locationId, s.factEdits).verifiedFields[issue.field].value : null
        const newTasks: Task[] = plan.items
          .filter((it) => it.kind !== 'structured_info')
          .map((it) => {
            const channel = it.kind as ControlledChannel
            n += 1
            return {
              id: `task-${String(n).padStart(3, '0')}`,
              issueId,
              locationId: issue.locationId,
              title: `${it.title} — ${loc.neighborhood}`,
              assigneeId: channel === 'owned_website' ? 'u-kavya' : 'u-rahul',
              channel,
              target: it.detail,
              dueAt: new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10),
              notes: plan.why,
              status: 'approved' as TaskStatus,
              assetKinds: channel === 'owned_website' && withAssets ? (['jsonld', 'factsheet'] as AssetKind[]) : [],
              field: issue.field,
              evidence: [
                { label: 'Issue', value: `${issue.id} · ${issue.title}` },
                ...(verified ? [{ label: 'Verified value', value: verified }] : []),
                { label: 'Plan approved by', value: `${actor} (Brand)` },
              ],
              approvedBy: `${actor} (Brand)`,
              approvedAt: now(),
              createdAt: now(),
              activity: [
                { id: uid('a'), at: now(), actor: 'System', kind: 'created' as const, text: `Created from the approved correction plan (${CHANNEL_LABELS[channel]})` },
                { id: uid('a'), at: now(), actor, kind: 'approval' as const, text: 'Business approval given by Brand on the correction plan' },
              ],
            }
          })
        return {
          ...s,
          assets,
          tasks: [...s.tasks, ...newTasks],
          plans: { ...s.plans, [issueId]: { ...plan, status: 'approved', taskIds: newTasks.map((t) => t.id), updatedAt: now(), comments: [...plan.comments, { at: now(), by: s.role, kind: 'approve', text: note || 'Plan approved' }] } },
          activity: log(s, `Brand approved correction plan · ${loc.name}`, 'approval'),
        }
      }),

    requestPlanChanges: (issueId, comment) =>
      setState((s) => {
        const plan = s.plans[issueId]
        if (!plan) return s
        return {
          ...s,
          plans: { ...s.plans, [issueId]: { ...plan, status: 'changes_requested', updatedAt: now(), comments: [...plan.comments, { at: now(), by: s.role, kind: 'changes', text: comment }] } },
          activity: log(s, `Brand requested changes to plan · ${issueId}`, 'status'),
        }
      }),

    declinePlan: (issueId, reason) =>
      setState((s) => {
        const plan = s.plans[issueId]
        if (!plan) return s
        return {
          ...s,
          plans: { ...s.plans, [issueId]: { ...plan, status: 'declined', updatedAt: now(), comments: [...plan.comments, { at: now(), by: s.role, kind: 'decline', text: reason }] } },
          activity: log(s, `Brand declined plan · ${issueId}`, 'status'),
        }
      }),

    requestCheck: (note) => {
      const req: CheckRequest = { id: `req-${String(state.checkRequests.length + 1).padStart(3, '0')}`, at: now(), by: state.role, note, status: 'requested' }
      setState((s) => ({ ...s, checkRequests: [...s.checkRequests, req], activity: log(s, 'Requested first AI visibility check from ProManage', 'created') }))
      return req
    },

    completeCheckRequest: (id, auditId) =>
      setState((s) => ({ ...s, checkRequests: s.checkRequests.map((r) => (r.id === id ? { ...r, status: 'completed', auditId } : r)) })),

    approveTask: (taskId) =>
      setState((s) => {
        const t = s.tasks.find((x) => x.id === taskId)
        if (!t) return s
        const assets = { ...s.assets }
        for (const k of t.assetKinds) assets[assetKey(t.locationId, k)] = { ...assets[assetKey(t.locationId, k)], status: 'approved', approvedBy: actorName(s.role), approvedAt: now(), fingerprint: assetFingerprint(t.locationId, k, s.factEdits) }
        return {
          ...s,
          assets,
          tasks: s.tasks.map((x) =>
            x.id === taskId
              ? {
                  ...x,
                  status: 'approved',
                  approvedBy: actorName(s.role),
                  approvedAt: now(),
                  activity: [...x.activity, { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'approval', text: `Business approval given for ${CHANNEL_LABELS[x.channel].toLowerCase()} change${x.assetKinds.length ? ' and attached content' : ''}` }],
                }
              : x,
          ),
          activity: log(s, `Approved ${taskId}`, 'approval'),
        }
      }),

    attachAssets: (taskId, kinds) =>
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t
          const assetKinds = [...new Set([...t.assetKinds, ...kinds])]
          const early = t.status === 'open' || t.status === 'in_progress' || t.status === 'prepared'
          const allApproved = assetKinds.every((k) => isAssetApproved(s, t.locationId, k))
          const status: TaskStatus = early ? (allApproved ? 'approved' : 'prepared') : t.status
          return {
            ...t,
            assetKinds,
            status,
            approvedBy: status === 'approved' && !t.approvedBy ? actorName(s.role) : t.approvedBy,
            approvedAt: status === 'approved' && !t.approvedAt ? now() : t.approvedAt,
            activity: [
              ...t.activity,
              { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'system', text: `Attached ${kinds.map((k) => (k === 'jsonld' ? 'JSON-LD' : 'fact sheet')).join(' and ')} from GEO Readiness` },
              ...(status !== t.status ? [{ id: uid('a'), at: now(), actor: actorName(s.role), kind: 'status' as const, text: `Status → ${TASK_STATUS_LABEL[status]}${status === 'approved' ? ' (all attached content approved)' : ''}` }] : []),
            ],
          }
        }),
      })),

    requestVerification: (factId) =>
      setState((s) => ({
        ...s,
        factEdits: { ...s.factEdits, [factId]: { status: 'requested', by: actorName(s.role), at: now() } },
        activity: log(s, `Requested verification · ${LOCATION_BY_ID[factId.split(':')[0]]?.name} ${FACT_LABELS[factId.split(':')[1] as keyof typeof FACT_LABELS]?.toLowerCase()}`),
      })),

    verifyFact: (factId, value) =>
      setState((s) => {
        const direct = s.role === 'brand'
        return {
          ...s,
          factEdits: { ...s.factEdits, [factId]: { status: direct ? 'verified' : 'pending_approval', value, by: actorName(s.role), at: now() } },
          activity: log(s, `${direct ? 'Verified' : 'Proposed'} ${FACT_LABELS[factId.split(':')[1] as keyof typeof FACT_LABELS]?.toLowerCase()} · ${LOCATION_BY_ID[factId.split(':')[0]]?.name}`, 'approval'),
        }
      }),

    approveFactEdit: (factId) =>
      setState((s) => {
        const e = s.factEdits[factId]
        if (!e) return s
        return { ...s, factEdits: { ...s.factEdits, [factId]: { ...e, status: 'verified', by: `${e.by}, approved by ${actorName(s.role)}`, at: now() } }, activity: log(s, `Approved fact change · ${LOCATION_BY_ID[factId.split(':')[0]]?.name}`, 'approval') }
      }),

    rejectFactEdit: (factId) =>
      setState((s) => {
        const next = { ...s.factEdits }
        delete next[factId]
        return { ...s, factEdits: next, activity: log(s, `Rejected fact change · ${LOCATION_BY_ID[factId.split(':')[0]]?.name}`) }
      }),

    approveAsset: (locationId, kind) =>
      setState((s) => {
        const key = assetKey(locationId, kind)
        return {
          ...s,
          assets: { ...s.assets, [key]: { ...s.assets[key], status: 'approved', approvedBy: actorName(s.role), approvedAt: now(), fingerprint: assetFingerprint(locationId, kind, s.factEdits), version: (s.assets[key]?.version ?? 0) + 1 } },
          tasks: s.tasks.map((t) =>
            t.locationId === locationId && t.assetKinds.includes(kind) && t.status === 'prepared' && t.assetKinds.every((k) => k === kind || isAssetApproved(s, locationId, k))
              ? { ...t, status: 'approved', approvedBy: actorName(s.role), approvedAt: now(), activity: [...t.activity, { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'approval', text: 'Business approval given in GEO Readiness' }] }
              : t,
          ),
          activity: log(s, `Approved ${kind === 'jsonld' ? 'JSON-LD' : 'fact sheet'} · ${LOCATION_BY_ID[locationId]?.name}`, 'approval'),
        }
      }),

    markAssetExported: (locationId, kind) =>
      setState((s) => {
        const key = assetKey(locationId, kind)
        return { ...s, assets: { ...s.assets, [key]: { ...(s.assets[key] ?? { status: 'draft' }), exportedAt: now() } } }
      }),

    setShowSimLabels: (showSimLabels) => setState((s) => ({ ...s, showSimLabels })),

    addTaskComment: (taskId, text) =>
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, activity: [...t.activity, { id: uid('a'), at: now(), actor: actorName(s.role), kind: 'comment', text }] } : t)),
      })),

    runRecheck: (auditId) => {
      const audit = state.audits.find((a) => a.id === auditId)!
      const at = now()
      const wave = state.rechecks.filter((r) => r.priorAuditId === auditId).length + 1
      const recheck: Recheck = {
        id: `${auditId}-recheck-${wave}`,
        priorAuditId: auditId,
        wave,
        cohortFingerprint: `${audit.locationIds.length}L×${audit.promptIds.length}P · ${audit.surface} · rules v1`,
        // One timestamp for the whole follow-up: when the user ran it (shown in Measure, history, timeline and reports).
        sampledAt: at,
        createdAt: at,
        factSnapshot: Object.fromEntries(Object.entries(state.factEdits).filter(([, e]) => e.status === 'verified')),
        simulated: true,
      }
      setState((s) => ({
        ...s,
        rechecks: [...s.rechecks, recheck],
        tasks: s.tasks.map((t) =>
          t.status === 'awaiting_recheck' && audit.locationIds.includes(t.locationId)
            ? { ...t, activity: [...t.activity, { id: uid('a'), at: now(), actor: 'System', kind: 'system', text: `Recheck ${wave} sampled. Review the outcome on Monitoring before closing.` }] }
            : t,
        ),
        activity: log(s, `Ran recheck ${wave} for ${auditId}`),
      }))
      return recheck
    },

    setMonitoring: (m) => setState((s) => ({ ...s, monitoring: { ...s.monitoring, ...m, savedAt: now() } })),
    ackAlert: (key) => setState((s) => ({ ...s, ackedAlerts: [...new Set([...s.ackedAlerts, key])] })),
    requestNotify: (feature) => setState((s) => ({ ...s, notifyRequests: [...new Set([...s.notifyRequests, feature])] })),
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Assigned',
  in_progress: 'In progress',
  prepared: 'Content prepared',
  approved: 'Business approved',
  source_updated: 'Source updated',
  awaiting_recheck: 'Awaiting AI recheck',
  closed: 'Closed',
}

export const TASK_FLOW: TaskStatus[] = ['open', 'in_progress', 'prepared', 'approved', 'source_updated', 'awaiting_recheck', 'closed']

/** Source-action labels; external and verification channels name their states honestly. */
export function taskStatusLabel(status: TaskStatus, channel: ControlledChannel) {
  if (channel === 'external_request') {
    if (status === 'prepared') return 'Request drafted'
    if (status === 'source_updated') return 'Request sent — external correction pending'
  }
  if (channel === 'verification') {
    if (status === 'prepared') return 'Value proposed'
    if (status === 'approved') return 'Business approved'
    if (status === 'source_updated') return 'Fact verified'
  }
  if (status === 'open') return 'Assigned'
  if (status === 'approved') return 'Business approved'
  if (status === 'source_updated') return 'Source updated (simulated)'
  return TASK_STATUS_LABEL[status]
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
