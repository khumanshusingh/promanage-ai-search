import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BadgeCheck, CircleHelp, ExternalLink, FileSearch, Lightbulb, Link2, Loader2, Lock, MessageSquareWarning, RefreshCw, ScanSearch, Search, ShieldCheck, Sparkles, ThumbsDown, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { discoveryId, eligibilityFor } from '@/lib/discovery'
import { useStore } from '@/store/AppStore'
import { CATEGORY_LABELS, FIELD_LABELS, FIELD_ORDER, LOCATION_BY_ID, SURFACE } from '@/data/seed'
import type { NotRelevantReason, Observation, ReviewStatus } from '@/data/types'
import { factualState, hasMismatch, issueStatus } from '@/lib/metrics'
import { evidenceFor, useIssueActions } from '@/lib/issueActions'
import { OUTCOME_TEXT, outcomeForIssue, revisedFacts } from '@/lib/aiStatus'
import { factId } from '@/lib/facts'
import { AnswerCompare, AnswerText, EvaluationBadge, IssueStatusBadge, MentionBadge, PageHeader, PermButton, SampleBadge, SeverityBadge, VerificationBadge } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, Textarea, Label, FieldError } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'
import { CreateTaskDialog } from './Issues'

const REVIEW_META: Record<ReviewStatus, { label: string; tone: 'danger' | 'neutral' | 'blue' | 'warning' }> = {
  confirmed: { label: 'Confirmed discrepancy', tone: 'danger' },
  not_issue: { label: 'Not an issue', tone: 'neutral' },
  investigating: { label: 'Needs investigation', tone: 'blue' },
  unreviewed: { label: 'Unreviewed', tone: 'warning' },
}

/** Only claims that don't match the record need a human decision; a non-mention is an observation, not an error. */
function needsReview(o: Observation) {
  return o.extractedClaims.some((c) => c.evaluation !== 'match')
}

export default function LocationAnswersPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const store = useStore()
  const { audits, observationsFor, promptsById, reviews, setReview, inScope, issues, tasks, hasRelease, rechecksFor, can, dispositions, discoveryEligibility, setEligibility, factEdits } = store
  const { assignVerification, runMatchedRecheck } = useIssueActions()
  const [rechecking, setRechecking] = useState(false)
  const loc = LOCATION_BY_ID[id]

  const candidateAudits = audits.filter((a) => a.locationIds.includes(id))
  const audit = candidateAudits.find((a) => a.id === params.get('audit')) ?? candidateAudits[candidateAudits.length - 1]
  const rechecks = audit && hasRelease('V2') ? rechecksFor(audit.id) : []
  const wave = Math.min(Number(params.get('wave') ?? 0) || 0, rechecks.length)

  const obs = useMemo(() => (audit ? observationsFor(audit.id, wave).filter((o) => o.locationId === id) : []), [audit, observationsFor, wave, id])
  const defaultObs = obs.find(hasMismatch) ?? obs.find((o) => needsReview(o)) ?? obs[0]
  const selected = obs.find((o) => o.promptId === params.get('prompt')) ?? defaultObs
  const [activeClaim, setActiveClaim] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissNote, setDismissNote] = useState('')
  const [dismissErr, setDismissErr] = useState<string>()
  const [taskOpen, setTaskOpen] = useState(false)

  useEffect(() => {
    setActiveClaim(selected?.extractedClaims.find((c) => c.evaluation !== 'match')?.id)
    setNote(selected ? (reviews[selected.id]?.note ?? '') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  if (!loc) {
    return <EmptyState icon={<FileSearch />} title="Location not found" action={<Button asChild><Link to="/locations">All locations</Link></Button>} />
  }
  if (!inScope(id)) {
    return <EmptyState icon={<Lock />} title="Outside your assigned region" description={`${loc.name} is in ${loc.region}. Regional managers see their assigned centers only.`} action={<Button asChild><Link to="/overview">Back to overview</Link></Button>} />
  }
  if (!audit || !selected) {
    return (
      <EmptyState
        icon={<ScanSearch />}
        title={`No sampled answers for ${loc.name} yet`}
        description="Include this center in an audit to see sampled AI answers and claim checks."
        action={
          <PermButton perm="runAudit" variant="primary" onClick={() => navigate('/audits/new')}>
            New audit
          </PermButton>
        }
      />
    )
  }

  const prompt = promptsById[selected.promptId]
  const baselineObs = wave > 0 ? observationsFor(audit.id, 0).find((o) => o.locationId === id && o.promptId === selected.promptId) : undefined
  const discovery = !!prompt?.includeInDiscoveryMetric
  const review = reviews[selected.id]
  const baselineId = wave === 0 ? selected.id : `${audit.id}-${id}-${selected.promptId}`
  const issue = issues.find((i) => i.reviewKey === baselineId)
  const mismatch = hasMismatch(selected)
  const highSeverity = issue?.severity === 'high'
  const reviewable = wave === 0 && needsReview(selected)
  const relevantFields = new Set(selected.extractedClaims.map((c) => c.field))
  const task = issue ? tasks.find((t) => t.issueId === issue.id && t.channel !== 'verification') ?? tasks.find((t) => t.issueId === issue.id) : undefined
  const factual = issue ? factualState(issue, reviews) : null
  const cannotEvaluate = wave === 0 ? selected.extractedClaims.find((c) => c.evaluation === 'cannot_evaluate') : undefined
  const verificationRequested = cannotEvaluate && cannotEvaluate.field !== 'other' ? !!factEdits[factId(id, cannotEvaluate.field)] || tasks.some((t) => t.issueId === issue?.id && t.channel === 'verification') : false
  const evidence = evidenceFor(selected, issue?.claimId)
  const recheck = wave > 0 ? rechecks.find((r) => r.wave === wave) : undefined
  const recheckOutcome = issue && wave > 0 ? outcomeForIssue(issue, observationsFor(audit.id, 0), observationsFor(audit.id, wave), promptsById, revisedFacts(recheck)) : null
  const reviewerName = (r: string) => (store.role === r ? 'you' : r === 'brand' ? 'Brand' : r === 'promanage' ? 'ProManage' : 'Regional Manager')

  const select = (promptId: string) => {
    const next = new URLSearchParams(params)
    next.set('prompt', promptId)
    next.set('audit', audit.id)
    setParams(next, { replace: true })
  }
  const setWave = (w: number) => {
    const next = new URLSearchParams(params)
    if (w) next.set('wave', String(w))
    else next.delete('wave')
    setParams(next, { replace: true })
  }
  const decide = (status: ReviewStatus, n = note) => {
    setReview(selected.id, status, n || undefined, loc.name, evidenceFor(selected, issue?.claimId))
    toast.success(REVIEW_META[status].label, { description: `${loc.name} · “${selected.query}”` })
  }

  const grouped = [
    { label: 'Unbranded discovery', items: obs.filter((o) => promptsById[o.promptId]?.includeInDiscoveryMetric) },
    { label: 'Branded facts', items: obs.filter((o) => !promptsById[o.promptId]?.includeInDiscoveryMetric) },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <>
            <Link to={`/audits/${audit.id}`} className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              {audit.name}
            </Link>
            <span className="text-line">/</span>
            <span>Answers</span>
          </>
        }
        title={loc.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {loc.region} · {loc.city}
            </span>
            <VerificationBadge status={loc.verificationStatus} />
          </span>
        }
        actions={
          <>
            {hasRelease('V1') && (
              <Button asChild>
                <Link to={`/geo-readiness/${id}${issue ? `?from=${issue.id}` : ''}`}>
                  <Sparkles />
                  Open GEO Readiness
                </Link>
              </Button>
            )}
            {candidateAudits.length > 1 && (
              <Select value={audit.id} onChange={(e) => setParams({ audit: e.target.value })} aria-label="Audit" className="w-56">
                {candidateAudits.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.name}
                  </option>
                ))}
              </Select>
            )}
            {rechecks.length > 0 && (
              <Select value={wave} onChange={(e) => setWave(Number(e.target.value))} aria-label="Sample" className="w-44">
                <option value={0}>Baseline sample</option>
                {rechecks.map((r) => (
                  <option key={r.id} value={r.wave}>
                    Recheck {r.wave}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[272px_minmax(0,1fr)] min-[1400px]:grid-cols-[264px_minmax(0,1fr)_300px] 2xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        {/* Prompt list */}
        <Card className="self-start lg:sticky lg:top-[84px]">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Sampled prompts</p>
            <p className="text-[12px] text-muted">
              {obs.length} responses · {wave === 0 ? 'baseline' : `recheck ${wave}`}
            </p>
          </div>
          <nav className="scrollbar-thin max-h-[calc(100vh-220px)] overflow-y-auto py-1" aria-label="Prompts">
            {grouped.map((g) =>
              g.items.length ? (
                <div key={g.label}>
                  <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#97a3b4]">{g.label}</p>
                  {g.items.map((o) => {
                    const p = promptsById[o.promptId]
                    const disc = !!p?.includeInDiscoveryMetric
                    const r = reviews[o.id]
                    const active = o.id === selected.id
                    const flagged = hasMismatch(o)
                    const pending = wave === 0 && needsReview(o) && !r
                    return (
                      <button
                        key={o.id}
                        onClick={() => select(o.promptId)}
                        aria-current={active}
                        className={cn('relative block w-full px-4 py-2.5 text-left transition-colors', active ? 'bg-brand-soft' : 'hover:bg-subtle')}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
                        <p className={cn('line-clamp-2 text-[13px] leading-snug', active ? 'font-medium text-ink' : 'text-body')}>{o.query}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11.5px] text-muted">{CATEGORY_LABELS[p?.category ?? 'discovery']}</span>
                          <MentionBadge mentioned={o.mentioned} branded={!disc} brandOnly={o.mentionedBrand} />
                          {flagged && (
                            <Badge tone="danger">
                              <AlertTriangle />
                              Flag
                            </Badge>
                          )}
                          {r && r.status !== 'unreviewed' && <Badge tone={REVIEW_META[r.status].tone}>{REVIEW_META[r.status].label}</Badge>}
                          {pending && <span className="size-1.5 rounded-full bg-warning" title="Awaiting review" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null,
            )}
          </nav>
        </Card>

        {/* Answer + evaluation */}
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{discovery ? 'Unbranded discovery prompt' : 'Branded fact prompt'}</p>
                <p className="mt-0.5 text-[15.5px] font-semibold text-ink">“{selected.query}”</p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Sampled {fmtDateTime(selected.sampledAt)} · {SURFACE}
                  {wave > 0 && ` · recheck ${wave}`}
                </p>
              </div>
              <SampleBadge />
            </div>
            {discovery && (
              <div className={cn('flex items-center gap-2 border-b border-line px-5 py-2.5 text-[13px]', selected.mentioned ? 'bg-teal-soft/60 text-teal-ink' : 'bg-subtle text-body')}>
                {selected.mentioned ? <BadgeCheck className="size-4" /> : <CircleHelp className="size-4 text-muted" />}
                {selected.mentioned
                  ? `Mentioned — listed #${selected.position} in this sampled response`
                  : selected.otherBranchName
                    ? `Not mentioned in this sampled response — ${selected.otherBranchName} was named instead (brand-level mention only)`
                    : 'Not mentioned in this sampled response'}
              </div>
            )}
            <div className="px-5 py-5">
              <AnswerText text={selected.answerText} claims={selected.extractedClaims} activeClaimId={activeClaim} brandName={`BrightNest Preschool – ${loc.neighborhood}`} otherBrandName={selected.otherBranchName} onClaimClick={setActiveClaim} />
            </div>
            <div className="border-t border-line px-5 py-3">
              {selected.citations.length ? (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-muted">
                    <Link2 className="size-3.5" />
                    Sources cited in this response
                  </p>
                  <ul className="space-y-1">
                    {selected.citations.map((c) => (
                      <li key={c.url} className="flex items-center gap-1.5 text-[13px]">
                        <ExternalLink className="size-3.5 text-muted" />
                        <span className="text-ink">{c.title}</span>
                        <span className="truncate text-muted">{c.url}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[12.5px] text-muted">No citations in this sample — source unknown.</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <p className="text-[14px] font-semibold text-ink">Claim checks</p>
              <p className="text-[12.5px] text-muted">Each extracted claim is compared with the verified BrightNest record (rules v1).</p>
            </div>
            {selected.extractedClaims.length === 0 ? (
              <p className="px-5 py-5 text-[13px] text-muted">{discovery ? 'No factual claims about this center were extracted from this response.' : 'The response did not state any checkable facts about this center.'}</p>
            ) : (
              <div className="divide-y divide-line">
                <div className="hidden grid-cols-[120px_1fr_1fr_160px] gap-4 bg-subtle px-5 py-2 text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted md:grid">
                  <span>Field</span>
                  <span>AI answer</span>
                  <span>Verified record</span>
                  <span>Evaluation</span>
                </div>
                {selected.extractedClaims.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveClaim(c.id)}
                    className={cn('grid w-full grid-cols-1 gap-2 px-5 py-3 text-left transition-colors md:grid-cols-[104px_1fr_1fr_auto] md:gap-4', activeClaim === c.id ? 'bg-[#f7f9ff]' : 'hover:bg-subtle')}
                  >
                    <span className="text-[13px] font-medium text-ink">{c.label}</span>
                    <span className="text-[13px] text-body">
                      <span className="text-muted md:hidden">AI: </span>“{c.value}”
                    </span>
                    <span className={cn('text-[13px]', c.expected ? 'text-body' : 'italic text-muted')}>
                      <span className="not-italic text-muted md:hidden">Record: </span>
                      {c.expected ?? (c.evaluation === 'unverifiable' ? 'Not part of the approved record' : 'No verified value — cannot evaluate')}
                    </span>
                    <span>
                      <EvaluationBadge evaluation={c.evaluation} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {issue && issue.explanations.length > 0 && (mismatch || issue.category !== 'factual_mismatch') && wave === 0 && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Lightbulb className="size-4 text-warning" />
                Possible explanations
                <Badge tone="warning">Hypotheses — not established causes</Badge>
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {issue.explanations.map((e) => (
                  <li key={e} className="flex gap-2 text-[13px] text-body">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
                    {e}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {wave > 0 && baselineObs && (
            <Card className="p-5">
              <p className="mb-3 text-[14px] font-semibold text-ink">Original vs. recheck {wave}</p>
              <AnswerCompare
                before={baselineObs}
                after={selected}
                brandName={`BrightNest Preschool – ${loc.neighborhood}`}
                outcome={
                  issue && recheckOutcome ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-subtle px-3.5 py-2.5 text-[13px]">
                      <Badge tone={OUTCOME_TEXT[recheckOutcome].tone}>{OUTCOME_TEXT[recheckOutcome].short}</Badge>
                      <span className="text-muted">Observed change; causation not established. The original sample is preserved unchanged.</span>
                    </div>
                  ) : undefined
                }
              />
            </Card>
          )}

          {/* Review */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink">Review</p>
              <div className="flex flex-wrap items-center gap-2">
                {issue && <SeverityBadge severity={issue.severity} />}
                {issue && <Badge tone={factual === 'Confirmed' ? 'danger' : factual === 'Dismissed' ? 'neutral' : 'warning'}>{factual === 'Confirmed' ? 'Confirmed by user' : factual}</Badge>}
                {issue && hasRelease('V1') && <IssueStatusBadge status={issueStatus(issue, reviews, tasks, dispositions)} />}
              </div>
            </div>
            {wave > 0 ? (
              <p className="mt-2 text-[13px] text-muted">Recheck answers are new, read-only observations. Review decisions stay on the original sample.</p>
            ) : discovery && !selected.mentioned ? (
              <div className="mt-2">
                <p className="flex items-start gap-2 text-[13px] text-body">
                  <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted" />
                  Not mentioned in this sampled response. This is an observation, not an error — check whether the centre genuinely fits this query.
                </p>
                {(() => {
                  const el = eligibilityFor(selected.locationId, promptsById[selected.promptId], discoveryEligibility, factEdits)
                  const set = (st: 'eligible' | 'not_relevant' | null, reason?: NotRelevantReason) => {
                    setEligibility(selected.locationId, selected.promptId, st, reason, st === 'eligible' ? 'Confirmed by ProManage against the verified record' : undefined)
                    toast.success(st === 'eligible' ? 'Marked eligible' : st === 'not_relevant' ? 'Marked not relevant — excluded from the eligible mention rate' : 'Relevance decision cleared')
                  }
                  return (
                    <div className="mt-3 space-y-2">
                      <p className="text-[12.5px] text-body">
                        <span className="font-medium text-ink">Eligibility: </span>
                        {el.status === 'eligible' ? 'Eligible' : el.status === 'not_relevant' ? 'Not relevant' : 'Unknown'} · {el.basis} · <span className="text-muted">{el.reviewer}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <PermButton perm="qualifyDiscovery" size="sm" variant={el.status === 'eligible' && el.source === 'review' ? 'primary' : 'secondary'} onClick={() => set(el.status === 'eligible' && el.source === 'review' ? null : 'eligible')}>
                          Eligible
                        </PermButton>
                        <PermButton perm="qualifyDiscovery" size="sm" variant={el.status === 'not_relevant' ? 'primary' : 'secondary'} onClick={() => set(el.status === 'not_relevant' ? null : 'not_relevant', el.suggestion === 'mark_not_relevant' ? 'service_mismatch' : 'other')}>
                          Not relevant
                        </PermButton>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/discovery/${discoveryId(selected.auditId, selected.locationId)}`}>Open discoverability investigation</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : !reviewable ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-success">
                <ShieldCheck className="size-4" />
                No issues found in this sample — no review needed.
              </p>
            ) : cannotEvaluate ? (
              <div className="mt-3 rounded-lg border border-[#f1dcb2] bg-warning-soft px-4 py-3">
                <p className="text-[13.5px] font-medium text-ink">Cannot evaluate against verified truth</p>
                <p className="mt-0.5 text-[12.5px] text-body">The BrightNest record for {cannotEvaluate.label.toLowerCase()} isn't independently verified, so this claim can't be confirmed or dismissed yet. It isn't counted as a mismatch.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {verificationRequested ? (
                    <Badge tone="blue">Awaiting source-of-truth verification</Badge>
                  ) : (
                    <PermButton perm="requestVerification" size="sm" variant="primary" onClick={() => (issue ? assignVerification(issue) : undefined)}>
                      <ShieldCheck />
                      Request centre verification
                    </PermButton>
                  )}
                  {hasRelease('V1') && (
                    <Button size="sm" asChild>
                      <Link to={`/geo-readiness/${id}`}>Verify in GEO Readiness</Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {issue && (mismatch || issue.category === 'unsupported_claim') && (
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-line bg-subtle px-4 py-3 text-[12.5px] sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">AI answer</dt>
                      <dd className="font-medium text-ink">{evidence.claim}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Approved record</dt>
                      <dd className="font-medium text-ink">{evidence.verifiedValue ?? 'Not in approved record'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Observed</dt>
                      <dd className="text-body">
                        {fmtDateTime(selected.sampledAt)} · {SURFACE}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Citations</dt>
                      <dd className="text-body">{selected.citations.length ? `${selected.citations.length} cited` : 'No citations — source unknown'}</dd>
                    </div>
                  </dl>
                )}
                {issue?.entityConfusion && (
                  <p className="mt-3 rounded-lg border border-[#f1dcb2] bg-warning-soft px-3 py-2 text-[12.5px] text-body">
                    <span className="font-medium text-ink">Possible entity confusion.</span> The answer may mix this centre with BrightNest {issue.entityConfusion}. Confirm with the centre before treating it as a factual mismatch.
                  </p>
                )}
                {issue?.category === 'unsupported_claim' && (
                  <p className="mt-3 rounded-lg border border-[#f1dcb2] bg-warning-soft px-3 py-2 text-[12.5px] text-body">
                    <span className="font-medium text-ink">Needs specialist/business verification.</span> This claim isn't in the approved record and won't be auto-corrected.
                  </p>
                )}
                {review && review.status !== 'unreviewed' && (
                  <div className="mt-3 rounded-lg border border-line px-4 py-3 text-[13px]">
                    <p className="flex items-center gap-2 text-ink">
                      <UserRound className="size-4 text-muted" />
                      <span className="font-medium">{REVIEW_META[review.status].label}</span> by {reviewerName(review.by)} · {fmtDateTime(review.at)}
                    </p>
                    {review.note && <p className="mt-0.5 pl-6 text-muted">“{review.note}”</p>}
                    {review.evidence && review.status === 'confirmed' && (
                      <p className="mt-2 pl-6 text-[12px] text-muted">
                        Evidence saved: {review.evidence.claim} vs “{review.evidence.verifiedValue}” · prompt “{review.evidence.query}” · {fmtDateTime(review.evidence.sampledAt)} · {review.evidence.surface} · {review.evidence.citations}
                      </p>
                    )}
                    {(review.history?.length ?? 0) > 1 && (
                      <details className="mt-2 pl-6 text-[12px] text-muted">
                        <summary className="cursor-pointer text-brand">Review history ({review.history!.length})</summary>
                        <ul className="mt-1 space-y-0.5">
                          {review.history!.map((h, i) => (
                            <li key={i}>
                              {REVIEW_META[h.status].label} · {reviewerName(h.by)} · {fmtDateTime(h.at)}
                              {h.note ? ` · “${h.note}”` : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <Label htmlFor="review-note" hint="Optional">
                    Reviewer note
                  </Label>
                  <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked with the centre on 20 Oct; approved hours are Mon–Fri 8:30–6:30." className="min-h-[64px]" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {issue?.entityConfusion || issue?.category === 'unsupported_claim' ? (
                    <PermButton perm="requestVerification" variant="primary" onClick={() => issue && assignVerification(issue)}>
                      <ShieldCheck />
                      Request centre verification
                    </PermButton>
                  ) : null}
                  <PermButton perm="reviewDecision" variant={review?.status === 'confirmed' ? 'primary' : issue?.entityConfusion ? 'secondary' : 'primary'} disabled={!mismatch || review?.status === 'confirmed'} onClick={() => decide('confirmed')}>
                    <MessageSquareWarning />
                    {review?.status === 'confirmed' ? 'Discrepancy confirmed' : 'Confirm discrepancy'}
                  </PermButton>
                  <PermButton
                    perm="reviewDecision"
                    variant="secondary"
                    onClick={() => {
                      if (highSeverity) {
                        setDismissNote(note)
                        setDismissErr(undefined)
                        setDismissOpen(true)
                      } else decide('not_issue')
                    }}
                  >
                    <ThumbsDown />
                    Not an issue
                  </PermButton>
                  <PermButton perm="markInvestigating" variant="secondary" onClick={() => decide('investigating')}>
                    <FileSearch />
                    Needs investigation
                  </PermButton>
                </div>
                {!can('reviewDecision') && <p className="mt-2 text-[12px] text-brand">Your role can flag items for investigation; factual decisions are made by Marketing.</p>}
              </>
            )}

            {/* V1 continuation: what you can do next */}
            {wave === 0 && issue && hasRelease('V1') && review?.status !== 'not_issue' && (mismatch || issue.category !== 'factual_mismatch') && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">What you can do</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" asChild>
                    <Link to={`/issues/${issue.id}/sources`}>
                      <Search />
                      Investigate sources
                    </Link>
                  </Button>
                  <PermButton perm="requestVerification" size="sm" onClick={() => assignVerification(issue)}>
                    <ShieldCheck />
                    Assign verification
                  </PermButton>
                  {task && (
                    <Button size="sm" asChild>
                      <Link to={`/tasks/${task.id}`}>Open {task.id}</Link>
                    </Button>
                  )}
                  {hasRelease('V2') && (
                    <PermButton
                      perm="runRecheck"
                      size="sm"
                      disabled={rechecking}
                      onClick={async () => {
                        setRechecking(true)
                        const r = await runMatchedRecheck(audit.id)
                        setRechecking(false)
                        setWave(r.wave)
                      }}
                    >
                      {rechecking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Run matched recheck
                    </PermButton>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-muted">{selected.citations.length ? 'Cited sources are evidence of what the answer referenced, not proof of cause.' : 'No source citation in this sample. Source inconsistencies are hypotheses, not confirmed causes.'}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Verified record */}
        <Card className="self-start lg:col-span-2 min-[1400px]:sticky min-[1400px]:top-[84px] min-[1400px]:col-span-1">
          <div className="border-b border-line px-5 py-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">Verified BrightNest record</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <VerificationBadge status={loc.verificationStatus} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-muted">Last verified</dt>
                <dd className="font-medium text-ink">{fmtDate(loc.lastVerifiedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">Source owner</dt>
                <dd className="font-medium text-ink">{loc.sourceOwner}</dd>
              </div>
            </dl>
          </div>
          <ul className="divide-y divide-line">
            {FIELD_ORDER.map((k) => {
              const f = loc.verifiedFields[k]
              const relevant = relevantFields.has(k)
              return (
                <li key={k} className={cn('px-5 py-2.5', relevant && 'bg-[#f7f9ff] shadow-[inset_3px_0_0_var(--brand-blue)]')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-muted">{FIELD_LABELS[k]}</p>
                    {f.status === 'verified' ? <BadgeCheck className="size-3.5 text-success" aria-label="Verified" /> : <Badge tone="warning">{f.status === 'unknown' ? 'Unknown' : 'Needs verification'}</Badge>}
                  </div>
                  <p className={cn('mt-0.5 break-words text-[13px]', f.value ? 'text-ink' : 'italic text-muted')}>{f.value ?? f.note ?? 'No verified value'}</p>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[11.5px] text-muted">Source of truth: ProManage master location record.</p>
        </Card>
      </div>

      <Dialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title="Mark high-severity item as not an issue?"
        description="High-severity findings need a short justification for the audit trail."
        footer={
          <>
            <Button onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (dismissNote.trim().length < 8) return setDismissErr('Add a brief reason (at least 8 characters).')
                setNote(dismissNote)
                decide('not_issue', dismissNote.trim())
                setDismissOpen(false)
              }}
            >
              Mark not an issue
            </Button>
          </>
        }
      >
        <Label htmlFor="dismiss-note">Reason</Label>
        <Textarea id="dismiss-note" value={dismissNote} onChange={(e) => { setDismissNote(e.target.value); setDismissErr(undefined) }} invalid={!!dismissErr} placeholder="e.g. Center confirmed Saturday tours were paused this month." />
        <FieldError>{dismissErr}</FieldError>
      </Dialog>
      {issue && <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} issue={issue} onCreated={(t) => navigate(`/tasks/${t.id}`)} />}
    </div>
  )
}
