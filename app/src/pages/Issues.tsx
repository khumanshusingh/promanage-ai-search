import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ClipboardPlus, ExternalLink, FileSearch, Inbox, Info, Lightbulb, MessageSquareWarning, Search, ShieldCheck, Sparkles, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { CHANNEL_HINT, CHANNEL_LABELS, channelTarget, LOCATION_BY_ID, PEOPLE, SURFACE } from '@/data/seed'
import type { ControlledChannel, Issue, Task } from '@/data/types'
import { factualState, issueStatus, type IssueStatus } from '@/lib/metrics'
import { evidenceFor, useIssueActions } from '@/lib/issueActions'
import { InvestigationPanel } from '@/components/promanage'
import { OUTCOME_TEXT, useAiAnswerStatus } from '@/lib/aiStatus'
import { effectiveLocation } from '@/lib/facts'
import { AnswerCompare, AnswerText, CATEGORY_LABEL, EvaluationBadge, ISSUE_STATUS, IssueStatusBadge, PageHeader, PermButton, SampleBadge, SeverityBadge, TaskStatusBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { DiscoveryList } from './DiscoveryInvestigation'
import { fmtDateTime } from '@/lib/utils'

function defaultTaskFor(issue: Issue) {
  const loc = LOCATION_BY_ID[issue.locationId]
  const regional = PEOPLE.find((p) => p.role === 'regional' && p.region === loc.region)
  const field = issue.field ?? ''
  const title =
    issue.category === 'factual_mismatch'
      ? field === 'saturdayTours'
        ? 'Review outdated Saturday-tour information'
        : field === 'operatingStatus'
          ? `Remove closure status from listing — ${loc.neighborhood}`
          : field === 'phone'
            ? `Correct listed phone number — ${loc.neighborhood}`
            : field === 'hours'
              ? `Align opening hours across sources — ${loc.neighborhood}`
              : field === 'address'
                ? `Fix address references — ${loc.neighborhood}`
                : `Correct ${field} — ${loc.neighborhood}`
      : issue.category === 'source_inconsistency'
        ? `Update ${field === 'hours' ? 'opening hours' : field === 'saturdayTours' ? 'Saturday-tour details' : field} on controlled sources — ${loc.neighborhood}`
        : issue.category === 'unknown_fact'
          ? `Verify ${field === 'hours' ? 'opening hours' : field} in master record — ${loc.neighborhood}`
          : issue.category === 'unsupported_claim'
            ? `Check unsupported claim — ${loc.neighborhood}`
            : `Review center page content — ${loc.neighborhood}`
  const channel: ControlledChannel =
    issue.category === 'source_inconsistency'
      ? issue.possibleSourceIds.some((id) => id.endsWith('-web'))
        ? 'owned_website'
        : 'managed_listing'
      : field === 'phone' || field === 'address' || field === 'operatingStatus'
        ? 'managed_listing'
        : 'owned_website'
  return { title, assigneeId: regional?.id ?? 'u-kavya', channel }
}

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export function CreateTaskDialog({ open, onOpenChange, issue, onCreated, channel: forcedChannel }: { open: boolean; onOpenChange: (o: boolean) => void; issue: Issue; onCreated?: (t: Task) => void; channel?: ControlledChannel }) {
  const { createTask, observationsFor, sourcesFor, factEdits } = useStore()
  const claim = observationsFor(issue.auditId).find((o) => o.id === issue.observationId)?.extractedClaims.find((c) => c.id === issue.claimId)
  const defaults = defaultTaskFor(issue)
  const [title, setTitle] = useState(defaults.title)
  const [assigneeId, setAssigneeId] = useState(defaults.assigneeId)
  const [channel, setChannel] = useState<ControlledChannel>(defaults.channel)
  const [dueAt, setDueAt] = useState(plusDays(7))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setTitle(defaults.title)
    setAssigneeId(defaults.assigneeId)
    setChannel(forcedChannel ?? defaults.channel)
    if (forcedChannel === 'external_request') setTitle(`Request directory correction — ${LOCATION_BY_ID[issue.locationId].neighborhood}`)
    else if (forcedChannel === 'managed_listing') setTitle(`Update managed listing — ${LOCATION_BY_ID[issue.locationId].neighborhood}`)
    else if (forcedChannel === 'owned_website' && issue.field === 'hours') setTitle(`Correct opening hours on center page — ${LOCATION_BY_ID[issue.locationId].neighborhood}`)
    if (forcedChannel === 'owned_website') setAssigneeId('u-kavya')
    setDueAt(plusDays(7))
    setNotes(forcedChannel === 'external_request' && issue.field ? `Hello — the listing for ${LOCATION_BY_ID[issue.locationId].name} shows outdated ${issue.field === 'hours' ? 'opening hours' : issue.field}. The verified value is “${effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value}”. Please update your page. — BrightNest Marketing` : issue.category === 'factual_mismatch' && claim ? `AI answer: “${claim.value}”. Verified record: “${claim.expected}”.` : issue.summary)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, issue.id, forcedChannel])

  const verifiedValue = issue.field ? effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value : null
  const srcSuffix = channel === 'owned_website' ? 'web' : channel === 'managed_listing' ? 'listing' : channel === 'external_request' ? 'dir' : null
  const src = srcSuffix ? sourcesFor(issue.locationId).find((r) => r.id === `${issue.locationId}-${srcSuffix}`) : undefined
  const evidence = [
    claim ? { label: 'AI answer', value: `“${claim.value}” (${claim.label})` } : null,
    verifiedValue ? { label: 'Verified value', value: verifiedValue } : null,
    src && issue.field ? { label: `${src.label} shows`, value: `${src.values[issue.field] ?? 'not stated'} · ${src.url}` } : null,
    { label: 'Issue', value: `${issue.id} · ${issue.title}` },
  ].filter(Boolean) as { label: string; value: string }[]

  const submit = () => {
    const e: Record<string, string> = {}
    if (title.trim().length < 6) e.title = 'Title should be at least 6 characters.'
    if (!assigneeId) e.assignee = 'Choose an owner.'
    if (!channel) e.source = 'Choose the controlled channel to correct.'
    if (!dueAt) e.due = 'Choose a due date.'
    else if (dueAt < new Date().toISOString().slice(0, 10)) e.due = 'Due date cannot be in the past.'
    setErrors(e)
    if (Object.keys(e).length) return
    const t = createTask({ issueId: issue.id, locationId: issue.locationId, title: title.trim(), assigneeId, channel, target: channelTarget(channel, issue.locationId), dueAt, notes: notes.trim(), field: issue.field, evidence })
    toast.success('Correction task created', { description: `${t.id} assigned to ${PEOPLE.find((p) => p.id === assigneeId)?.name}` })
    onOpenChange(false)
    onCreated?.(t)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create correction task"
      description="Corrects a source BrightNest controls. It does not change any AI answer directly."
      className="max-w-[560px]"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} />
          <FieldError>{errors.title}</FieldError>
        </div>
        <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-[12.5px]">
          <span className="text-muted">Associated issue · </span>
          <span className="font-medium text-ink">{issue.title}</span>
          <span className="text-muted"> · {LOCATION_BY_ID[issue.locationId].name}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="t-owner">Assign to</Label>
            <Select id="t-owner" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} invalid={!!errors.assignee}>
              {PEOPLE.filter((p) => p.role !== 'csm').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.title}
                  {p.region ? ` (${p.region})` : ''}
                </option>
              ))}
            </Select>
            <FieldError>{errors.assignee}</FieldError>
          </div>
          <div>
            <Label htmlFor="t-due">Due date</Label>
            <Input id="t-due" type="date" value={dueAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueAt(e.target.value)} invalid={!!errors.due} />
            <FieldError>{errors.due}</FieldError>
          </div>
        </div>
        <div>
          <Label htmlFor="t-source">Controlled channel</Label>
          <Select id="t-source" value={channel} onChange={(e) => setChannel(e.target.value as ControlledChannel)} invalid={!!errors.source}>
            {(Object.keys(CHANNEL_LABELS) as ControlledChannel[]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[12px] text-muted">
            {CHANNEL_HINT[channel]} Target: {channelTarget(channel, issue.locationId)}
          </p>
          <FieldError>{errors.source}</FieldError>
        </div>
        <div className="rounded-lg border border-line bg-subtle px-3 py-2.5">
          <p className="mb-1 text-[12px] font-medium text-muted">Evidence attached</p>
          <ul className="space-y-0.5 text-[12.5px]">
            {evidence.map((e) => (
              <li key={e.label}>
                <span className="text-muted">{e.label}: </span>
                <span className="text-ink">{e.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Label htmlFor="t-notes" hint="Optional">
            {channel === 'external_request' ? 'Correction request draft' : 'Notes'}
          </Label>
          <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Dialog>
  )
}

function IssueDetail({ issue }: { issue: Issue }) {
  const { observationsFor, reviews, tasks, setReview, promptsById, can, hasRelease, dispositions, setDisposition, sourcesFor, rechecksFor } = useStore()
  const { assignVerification } = useIssueActions()
  const navigate = useNavigate()
  const obs = observationsFor(issue.auditId).find((o) => o.id === issue.observationId)!
  const loc = LOCATION_BY_ID[issue.locationId]
  const status = issueStatus(issue, reviews, tasks, dispositions)
  const task = tasks.find((t) => t.issueId === issue.id && t.channel !== 'verification') ?? tasks.find((t) => t.issueId === issue.id)
  const factual = factualState(issue, reviews)
  const ai = useAiAnswerStatus(issue)
  const rechecks = rechecksFor(issue.auditId)
  const latestObs = rechecks.length ? observationsFor(issue.auditId, rechecks[rechecks.length - 1].wave).find((o) => o.locationId === issue.locationId && o.promptId === issue.promptId) : undefined
  const needsVerification = factual === 'Needs business verification' && !tasks.some((t) => t.issueId === issue.id && t.channel === 'verification')
  const claim = obs.extractedClaims.find((c) => c.id === issue.claimId)
  const review = reviews[issue.reviewKey]
  const sources = sourcesFor(issue.locationId).filter((x) => issue.possibleSourceIds.includes(x.id))
  const [taskOpen, setTaskOpen] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonErr, setReasonErr] = useState<string>()
  const needsConfirm = (issue.category === 'factual_mismatch' || issue.category === 'source_inconsistency') && review?.status !== 'confirmed'

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <>
            <Link to="/issues" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              Issues
            </Link>
            <span className="text-line">/</span>
            <span>{issue.id}</span>
          </>
        }
        title={issue.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/locations/${loc.id}/answers?audit=${issue.auditId}&prompt=${issue.promptId}`} className="font-medium text-brand hover:underline">
              {loc.name}
            </Link>
            <span className="text-line">•</span>
            <SeverityBadge severity={issue.severity} />
            <Badge tone="outline">{CATEGORY_LABEL[issue.category]}</Badge>
            <IssueStatusBadge status={status} />
          </span>
        }
        actions={
          <>
            {status !== 'dismissed' && status !== 'closed' && (
              <PermButton
                perm="reviewDecision"
                onClick={() => {
                  setReason('')
                  setReasonErr(undefined)
                  setDismissOpen(true)
                }}
              >
                <ThumbsDown />
                Mark as non-issue
              </PermButton>
            )}
            <Button asChild>
              <Link to={`/geo-readiness/${issue.locationId}?from=${issue.id}`}>
                <Sparkles />
                Open GEO Readiness
              </Link>
            </Button>
            {!task && !needsVerification && !needsConfirm && (
              <PermButton perm="createTask" disabled={status === 'dismissed'} onClick={() => setTaskOpen(true)}>
                <ClipboardPlus />
                Create task
              </PermButton>
            )}
            {needsVerification ? (
              <PermButton perm="requestVerification" variant="primary" onClick={() => assignVerification(issue)}>
                <ShieldCheck />
                Request centre verification
              </PermButton>
            ) : needsConfirm ? (
              <PermButton
                perm="reviewDecision"
                variant="primary"
                disabled={status === 'dismissed'}
                onClick={() => {
                  setReview(issue.reviewKey, 'confirmed', undefined, LOCATION_BY_ID[issue.locationId].name, evidenceFor(obs, issue.claimId))
                  toast.success(issue.category === 'source_inconsistency' ? 'Confirmed inconsistency' : 'Confirmed discrepancy', { description: 'Evidence saved. Next: investigate sources.' })
                }}
              >
                <MessageSquareWarning />
                {issue.category === 'source_inconsistency' ? 'Confirm inconsistency' : 'Confirm discrepancy'}
              </PermButton>
            ) : (
              <Button variant="primary" asChild>
                <Link to={`/issues/${issue.id}/sources`}>
                  <Search />
                  Investigate sources
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">Factual issue</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{factual}</p>
          <p className="text-[12px] text-muted">{review?.status && review.status !== 'unreviewed' ? `${review.status === 'confirmed' ? 'Confirmed' : review.status === 'not_issue' ? 'Dismissed' : 'Flagged'} · ${fmtDateTime(review.at)}` : factual === 'Needs business verification' ? 'Confirm the true value with the centre' : 'Review the evidence below'}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">Source action</p>
          {task ? (
            <>
              <div className="mt-1.5">
                <TaskStatusBadge status={task.status} channel={task.channel} />
              </div>
              <Link to={`/tasks/${task.id}`} className="text-[12px] text-brand hover:underline">
                {task.id} · {CHANNEL_LABELS[task.channel]}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-[15px] font-semibold text-ink">Not started</p>
              <p className="text-[12px] text-muted">{dispositions[issue.id]?.status === 'monitoring' ? 'No controllable source to fix — monitoring' : 'Investigate sources to choose an action'}</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">AI outcome</p>
          {ai?.outcome ? (
            <>
              <div className="mt-1.5">
                <Badge tone={OUTCOME_TEXT[ai.outcome].tone}>{OUTCOME_TEXT[ai.outcome].short}</Badge>
              </div>
              <p className="text-[12px] text-muted">Recheck {ai.wave} · causation not established</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[15px] font-semibold text-ink">Not rechecked</p>
              <p className="text-[12px] text-muted">{hasRelease('V2') ? 'Run a matched recheck to observe' : 'Rechecks arrive with monitoring'}</p>
            </>
          )}
        </div>
      </div>

      <InvestigationPanel issue={issue} />

      {hasRelease('V2') && latestObs && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-ink">Matched recheck comparison</p>
            <div className="flex flex-wrap gap-2">
              {ai?.outcome === 'changed' && status !== 'closed' && (
                <PermButton perm="approveSource" size="sm" variant="primary" onClick={() => { setDisposition(issue.id, 'closed', `Closed after recheck ${ai.wave}: no mismatch in latest sample`); toast.success('Issue closed', { description: 'Disposition recorded. This does not guarantee future answers.' }) }}>
                  Close issue
                </PermButton>
              )}
              {ai?.outcome === 'unchanged' && (
                <PermButton perm="createTask" size="sm" variant="primary" onClick={() => { setDisposition(issue.id, 'reinvestigate', `Still observed in recheck ${ai.wave}`); navigate(`/issues/${issue.id}/sources`) }}>
                  Start new investigation
                </PermButton>
              )}
              {ai?.outcome === 'not_comparable' && (
                <Button size="sm" asChild>
                  <Link to="/monitoring">New baseline required</Link>
                </Button>
              )}
              {status !== 'monitoring' && status !== 'closed' && (
                <Button size="sm" onClick={() => { setDisposition(issue.id, 'monitoring', 'Keep monitoring across rechecks'); toast.success('Set to monitor') }}>
                  Keep monitoring
                </Button>
              )}
            </div>
          </div>
          <AnswerCompare
            before={obs}
            after={latestObs}
            brandName={`BrightNest Preschool – ${loc.neighborhood}`}
            outcome={
              ai?.outcome ? (
                <p className="text-[12.5px] text-muted">
                  <Badge tone={OUTCOME_TEXT[ai.outcome].tone} className="mr-2">
                    {OUTCOME_TEXT[ai.outcome].short}
                  </Badge>
                  {ai.outcome === 'changed' ? 'Observed improvement — causation not established.' : ai.outcome === 'unchanged' ? 'The incorrect claim still appears. The issue stays open.' : ai.outcome === 'not_comparable' ? 'Verified facts changed since the baseline, so this comparison is invalid.' : 'The latest answer doesn’t contain a comparable claim.'}
                </p>
              ) : undefined
            }
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{issue.claimId ? 'Exact sampled answer' : 'Related sampled answer'}</p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink">“{obs.query}”</p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Sampled {fmtDateTime(obs.sampledAt)} · {SURFACE}
                </p>
              </div>
              <SampleBadge />
            </div>
            <div className="px-5 py-5">
              <AnswerText text={obs.answerText} claims={obs.extractedClaims} activeClaimId={claim?.id} brandName={`BrightNest Preschool – ${loc.neighborhood}`} />
            </div>
            {obs.citations.length > 0 && (
              <div className="border-t border-line px-5 py-3 text-[12.5px]">
                <span className="text-muted">Sources shown in response: </span>
                {obs.citations.map((c) => (
                  <span key={c.url} className="mr-3 text-ink">
                    {c.title} <span className="text-muted">({c.url})</span>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {claim && (
            <Card>
              <CardHeader title="Comparison" description="Sampled claim vs. approved source of truth" />
              <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                <div className="p-5">
                  <p className="text-[12px] font-medium text-muted">AI answer says</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink">“{claim.value}”</p>
                  <p className="mt-1 text-[12px] text-muted">{claim.label}</p>
                </div>
                <div className="p-5">
                  <p className="text-[12px] font-medium text-muted">Verified record says</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink">{claim.expected ? `“${claim.expected}”` : <span className="font-normal italic text-muted">No verified value</span>}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    Owner: {loc.sourceOwner}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-[12px] font-medium text-muted">Evaluation</p>
                  <div className="mt-1.5">
                    <EvaluationBadge evaluation={claim.evaluation} />
                  </div>
                  <p className="mt-2 text-[12px] text-muted">{issue.confidenceLabel}</p>
                </div>
              </div>
            </Card>
          )}

          {sources.length > 0 && (
            <Card>
              <CardHeader title="Affected source surfaces" description="Sources whose content differs from, or doesn't state, the verified fact (simulated snapshots)" />
              <ul className="divide-y divide-line">
                {sources.map((src) => {
                  const v = issue.field ? src.values[issue.field] : undefined
                  return (
                    <li key={src.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                      <ExternalLink className="size-4 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{src.label}</p>
                        <p className="truncate text-[12px] text-muted">{src.url}</p>
                      </div>
                      {issue.field && <span className="text-body">{v === null ? <span className="italic text-muted">Not stated</span> : v === undefined ? <span className="text-muted">—</span> : `“${v}”`}</span>}
                      <Badge tone={src.managedByCustomer ? 'teal' : 'outline'}>{src.managedByCustomer ? (src.channel === 'owned_website' ? 'Owned website' : 'Managed listing') : 'External — request only'}</Badge>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
              <Lightbulb className="size-4 text-warning" />
              Possible explanations
              <Badge tone="warning">Uncertain — not attributed</Badge>
            </p>
            <ul className="mt-3 space-y-2">
              {issue.explanations.map((e) => (
                <li key={e} className="flex gap-2.5 text-[13.5px] text-body">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#c5cfdb]" />
                  {e}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-muted">We can't see why a model produced an answer. These are leads to check, not root causes.</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink">Details</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ['Summary', issue.summary],
                ['Audit', issue.auditId],
                ['Prompt type', promptsById[issue.promptId]?.includeInDiscoveryMetric ? 'Unbranded discovery' : 'Branded fact'],
                ['Confidence', issue.confidenceLabel],
                ['Review', review ? `${review.status.replace('_', ' ')} · ${fmtDateTime(review.at)}` : 'Not reviewed'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {!can('reviewDecision') && review?.status !== 'investigating' && (
              <PermButton perm="markInvestigating" size="sm" className="mt-4" onClick={() => { setReview(issue.reviewKey, 'investigating'); toast.success('Marked needs investigation') }}>
                <FileSearch />
                Flag for investigation
              </PermButton>
            )}
          </Card>
          {task && (
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-ink">Correction task</p>
              <button onClick={() => navigate(`/tasks/${task.id}`)} className="mt-2 w-full rounded-lg border border-line p-3 text-left hover:bg-subtle">
                <p className="text-[13px] font-medium text-ink">{task.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  <span className="text-[12px] text-muted">{PEOPLE.find((p) => p.id === task.assigneeId)?.name}</span>
                </div>
              </button>
            </Card>
          )}
          <div className="rounded-xl border border-brand-line bg-brand-soft p-4 text-[12.5px] leading-snug text-ink">
            <p className="flex items-center gap-1.5 font-semibold">
              <Info className="size-4 text-brand" />
              What a correction can and can't do
            </p>
            <p className="mt-1.5 text-body">Updating a website or listing corrects information BrightNest controls. It doesn't mean an external AI answer is fixed — that can only be observed in a later recheck.</p>
          </div>
        </div>
      </div>

      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} issue={issue} onCreated={(t) => navigate(`/tasks/${t.id}`)} />
      <Dialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title="Mark as non-issue?"
        description="Add a reason for the audit trail. You can revisit this from the location's answers."
        footer={
          <>
            <Button onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (issue.severity === 'high' && reason.trim().length < 8) return setReasonErr('High-severity items need a brief reason (8+ characters).')
                setReview(issue.reviewKey, 'not_issue', reason.trim() || undefined)
                setDismissOpen(false)
                toast.success('Marked as non-issue')
              }}
            >
              Mark as non-issue
            </Button>
          </>
        }
      >
        <Label htmlFor="reason" hint={issue.severity === 'high' ? 'Required for high severity' : 'Optional'}>
          Reason
        </Label>
        <Textarea id="reason" value={reason} onChange={(e) => { setReason(e.target.value); setReasonErr(undefined) }} invalid={!!reasonErr} />
        <FieldError>{reasonErr}</FieldError>
      </Dialog>
    </div>
  )
}

export default function IssuesPage() {
  const { id } = useParams()
  const { issues, issueById, reviews, tasks, inScope, latestAudit, dispositions, hasRelease } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'discovery' ? 'discovery' : 'accuracy'
  const tabs = (
    <Segmented
      ariaLabel="Investigation type"
      value={tab}
      onChange={(t) => setParams(t === 'discovery' ? { tab: 'discovery' } : {})}
      options={[
        { value: 'accuracy', label: 'Information accuracy' },
        { value: 'discovery', label: 'Discoverability' },
      ]}
    />
  )
  const [q, setQ] = useState('')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [region, setRegion] = useState('all')
  const [type, setType] = useState('all')
  const [owner, setOwner] = useState('all')
  const [locFilter, setLocFilter] = useState('all')

  const scoped = useMemo(() => issues.filter((i) => inScope(i.locationId)), [issues, inScope])
  const { observationsFor } = useStore()
  const queryOf = (i: Issue) => observationsFor(i.auditId).find((o) => o.id === i.observationId)?.query ?? ''
  const ownerOf = (i: Issue) => tasks.find((t) => t.issueId === i.id)?.assigneeId ?? 'unassigned'
  const filtered = scoped.filter((i) => {
    const loc = LOCATION_BY_ID[i.locationId]
    if (severity !== 'all' && i.severity !== severity) return false
    if (status !== 'all' && issueStatus(i, reviews, tasks, dispositions) !== status) return false
    if (region !== 'all' && loc.region !== region) return false
    if (type !== 'all' && i.category !== type) return false
    if (owner !== 'all' && ownerOf(i) !== owner) return false
    if (locFilter !== 'all' && i.locationId !== locFilter) return false
    if (q && !`${loc.name} ${queryOf(i)} ${i.title}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  if (id) {
    const issue = issueById[id]
    if (!issue) {
      return (
        <EmptyState
          icon={<Inbox />}
          title="Issue not found"
          description={latestAudit ? `No issue “${id}” in current audits.` : 'Run an audit to generate issues.'}
          action={
            <Button variant="primary" asChild>
              <Link to={latestAudit ? '/issues' : '/audits/new'}>{latestAudit ? 'All issues' : 'New audit'}</Link>
            </Button>
          }
        />
      )
    }
    if (!inScope(issue.locationId)) return <EmptyState icon={<Inbox />} title="Outside your assigned region" action={<Button asChild><Link to="/issues">All issues</Link></Button>} />
    return <IssueDetail issue={issue} />
  }

  if (tab === 'discovery' || !hasRelease('V1')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Investigations" subtitle={tab === 'discovery' ? 'Relevant outlets not mentioned in sampled unbranded answers. Observations, not errors.' : 'Evidence-backed findings from sampled answers.'} actions={tabs} />
        <Card>
          {tab === 'discovery' ? (
            <DiscoveryList />
          ) : (
            <EmptyState icon={<Inbox />} title="Accuracy investigations arrive in V1" description="In MVP, review flagged answers from audit results. Discoverability eligibility review is available now." action={<Button variant="primary" onClick={() => setParams({ tab: 'discovery' })}>Open Discoverability</Button>} />
          )}
        </Card>
      </div>
    )
  }

  const counts = { high: scoped.filter((i) => i.severity === 'high').length, review: scoped.filter((i) => issueStatus(i, reviews, tasks, dispositions) === 'needs_review').length }
  const regions = [...new Set(scoped.map((i) => LOCATION_BY_ID[i.locationId].region))]
  const clear = () => {
    setQ('')
    setSeverity('all')
    setStatus('all')
    setRegion('all')
    setType('all')
    setOwner('all')
    setLocFilter('all')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Investigations"
        subtitle="Evidence-backed findings from sampled answers. Not every omission is an error."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {tabs}
            <Badge tone="danger">{counts.high} high severity</Badge>
            <Badge tone="warning">{counts.review} need review</Badge>
          </div>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search center or prompt" className="pl-9" aria-label="Search issues" />
          </div>
          <Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="w-48" aria-label="Location">
            <option value="all">All locations</option>
            {[...new Set(scoped.map((i) => i.locationId))].map((id) => (
              <option key={id} value={id}>
                {LOCATION_BY_ID[id].name}
              </option>
            ))}
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36" aria-label="Severity">
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44" aria-label="Status">
            <option value="all">All statuses</option>
            {(Object.keys(ISSUE_STATUS) as IssueStatus[]).map((s) => (
              <option key={s} value={s}>
                {ISSUE_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-48" aria-label="Type">
            <option value="all">All types</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-40" aria-label="Region">
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-40" aria-label="Owner">
            <option value="all">Any owner</option>
            <option value="unassigned">Unassigned</option>
            {PEOPLE.filter((p) => p.role !== 'csm').map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <span className="tabular ml-auto text-[12.5px] text-muted">
            {filtered.length} of {scoped.length}
          </span>
        </div>
        {scoped.length === 0 ? (
          <EmptyState icon={<Inbox />} title="No issues yet" description="Issues appear after an audit runs." action={<PermButton perm="runAudit" variant="primary" onClick={() => navigate('/audits/new')}>New audit</PermButton>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search />} title="No issues match these filters" action={<Button size="sm" onClick={clear}>Clear filters</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Issue</Th>
                <Th>Center</Th>
                <Th>Type</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const loc = LOCATION_BY_ID[i.locationId]
                const own = ownerOf(i)
                return (
                  <Tr key={i.id} onClick={() => navigate(`/issues/${i.id}`)}>
                    <Td className="max-w-[360px]">
                      <Link to={`/issues/${i.id}`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {i.title}
                      </Link>
                      <p className="truncate text-[12px] text-muted">“{queryOf(i)}”</p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {loc.name}
                      <p className="text-[12px] text-muted">{loc.region}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-body">{CATEGORY_LABEL[i.category]}</Td>
                    <Td>
                      <SeverityBadge severity={i.severity} />
                    </Td>
                    <Td>
                      <IssueStatusBadge status={issueStatus(i, reviews, tasks, dispositions)} />
                    </Td>
                    <Td className="whitespace-nowrap text-body">{own === 'unassigned' ? <span className="text-muted">Unassigned</span> : PEOPLE.find((p) => p.id === own)?.name}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <div className="border-t border-line px-5 py-3 text-[12px] text-muted">Severity rubric: High — wrong phone/address, false closed status, unsupported sensitive claims, wrong service availability · Medium — opening hours, inconsistent controlled content, unknown contact facts · Low — minor details, single-sample omissions.</div>
      </Card>
    </div>
  )
}
