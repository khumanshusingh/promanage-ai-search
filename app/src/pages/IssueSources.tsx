import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bot, Building2, CircleHelp, ExternalLink, Globe, Inbox, Loader2, Lock, MapPin, MessageSquare, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { FIELD_LABELS, LOCATION_BY_ID, PEOPLE, SURFACE } from '@/data/seed'
import type { ControlledChannel, FieldKey, Issue, SourceRecord } from '@/data/types'
import { buildFacts } from '@/lib/facts'
import { issueStatus } from '@/lib/metrics'
import { useIssueActions } from '@/lib/issueActions'
import { CATEGORY_LABEL, IssueStatusBadge, PageHeader, PermButton, SeverityBadge, TaskStatusBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'
import { CreateTaskDialog } from './Issues'

type Assessment = 'matches' | 'inconsistent' | 'not_stated' | 'unable' | 'unverified' | 'updated'

const ASSESS: Record<Assessment, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' | 'teal' }> = {
  matches: { label: 'Matches verified record', tone: 'success' },
  inconsistent: { label: 'Verified source inconsistency', tone: 'danger' },
  not_stated: { label: 'Not stated', tone: 'neutral' },
  unable: { label: 'Unable to inspect — manual check required', tone: 'warning' },
  unverified: { label: 'Cannot compare — record unverified', tone: 'warning' },
  updated: { label: 'Updated — matches verified record', tone: 'teal' },
}

const SOURCE_META: Record<SourceRecord['channel'], { icon: React.ReactNode; control: string; owner: string }> = {
  owned_website: { icon: <Globe />, control: 'Brand-controlled', owner: 'Kavya Nair (Web & Content)' },
  managed_listing: { icon: <MapPin />, control: 'Authorized managed listing', owner: 'Listing Management (ProManage)' },
  external_directory: { icon: <ExternalLink />, control: 'Third party — not directly editable', owner: 'Directory operator' },
}

function assess(src: SourceRecord, field: FieldKey, verified: string | null, updated: boolean): Assessment {
  if (src.inaccessible) return 'unable'
  if (!(field in src.values) || src.values[field] == null) return 'not_stated'
  if (!verified) return 'unverified'
  if (src.values[field] === verified) return updated ? 'updated' : 'matches'
  return 'inconsistent'
}

export default function IssueSourcesPage() {
  const { id = '' } = useParams()
  const store = useStore()
  const { issueById, observationsFor, inScope, factEdits, sourcesFor, sourceUpdates, tasks, reviews, dispositions, setDisposition, hasRelease, can } = store
  const { assignVerification, runMatchedRecheck } = useIssueActions()
  const [taskChannel, setTaskChannel] = useState<ControlledChannel | null>(null)
  const [rechecking, setRechecking] = useState(false)
  const issue: Issue | undefined = issueById[id]

  const loc = issue ? LOCATION_BY_ID[issue.locationId] : undefined
  const obs = useMemo(() => (issue ? observationsFor(issue.auditId, 0).find((o) => o.id === issue.observationId) : undefined), [issue, observationsFor])

  if (!issue || !loc || !obs) {
    return <EmptyState icon={<Inbox />} title="Issue not found" description="Open an issue from the inbox to compare its sources." action={<Button asChild><Link to="/issues">All issues</Link></Button>} />
  }
  if (!inScope(issue.locationId)) return <EmptyState icon={<Lock />} title="Outside your assigned region" action={<Button asChild><Link to="/issues">All issues</Link></Button>} />

  const field = issue.field
  const facts = buildFacts(issue.locationId, factEdits)
  const fact = field ? facts.find((f) => f.key === field) : undefined
  const verified = fact?.verificationStatus === 'verified' ? fact.value : null
  const claim = obs.extractedClaims.find((c) => c.id === issue.claimId) ?? (field ? obs.extractedClaims.find((c) => c.field === field) : undefined)
  const sources = sourcesFor(issue.locationId)
  const rows = field
    ? sources.map((s) => ({ src: s, a: assess(s, field, verified, !!sourceUpdates[`${s.id}:${field}`]), upd: sourceUpdates[`${s.id}:${field}`] }))
    : []
  const bad = (ch: SourceRecord['channel']) => rows.some((r) => r.src.channel === ch && r.a === 'inconsistent')
  const unable = rows.some((r) => r.a === 'unable')
  const status = issueStatus(issue, reviews, tasks, dispositions)
  const issueTasks = tasks.filter((t) => t.issueId === issue.id)
  const taskFor = (c: ControlledChannel) => issueTasks.find((t) => t.channel === c)

  type Rec = { key: string; title: string; detail: string; action: React.ReactNode }
  const recs: Rec[] = []
  if (field && !verified) {
    recs.push({
      key: 'verify',
      title: 'Request business verification',
      detail: `The master record for ${FIELD_LABELS[field].toLowerCase()} isn't independently verified. Confirm the true value before correcting anything.`,
      action: (
        <PermButton perm="requestVerification" size="sm" variant="primary" onClick={() => assignVerification(issue)}>
          <ShieldCheck />
          Request verification
        </PermButton>
      ),
    })
  }
  if (bad('owned_website')) {
    recs.push({
      key: 'web',
      title: 'Prepare website correction',
      detail: 'The official center page differs from the verified record. BrightNest controls this content.',
      action: taskFor('owned_website') ? (
        <Button size="sm" asChild>
          <Link to={`/tasks/${taskFor('owned_website')!.id}`}>Open {taskFor('owned_website')!.id}</Link>
        </Button>
      ) : (
        <PermButton perm="createTask" size="sm" variant="primary" onClick={() => setTaskChannel('owned_website')}>
          Create correction task
        </PermButton>
      ),
    })
  }
  if (bad('managed_listing')) {
    recs.push({
      key: 'listing',
      title: 'Open managed listing',
      detail: 'The connected Google Business Profile differs. Update it through Listing Management — no separate editor here.',
      action: (
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link to={`/listings/${issue.locationId}?field=${field}&from=${issue.id}`}>Open managed listing</Link>
          </Button>
          {taskFor('managed_listing') ? (
            <Button size="sm" asChild>
              <Link to={`/tasks/${taskFor('managed_listing')!.id}`}>Open {taskFor('managed_listing')!.id}</Link>
            </Button>
          ) : (
            <PermButton perm="createTask" size="sm" variant="primary" onClick={() => setTaskChannel('managed_listing')}>
              Create listing update task
            </PermButton>
          )}
        </div>
      ),
    })
  }
  if (bad('external_directory')) {
    recs.push({
      key: 'dir',
      title: 'Prepare a correction request',
      detail: 'An independent directory is outdated. It isn’t directly editable — BrightNest can only request a change.',
      action: taskFor('external_request') ? (
        <Button size="sm" asChild>
          <Link to={`/tasks/${taskFor('external_request')!.id}`}>Open {taskFor('external_request')!.id}</Link>
        </Button>
      ) : (
        <PermButton perm="createTask" size="sm" variant={recs.length ? 'secondary' : 'primary'} onClick={() => setTaskChannel('external_request')}>
          Prepare correction request
        </PermButton>
      ),
    })
  }
  const noControllable = field && verified && !bad('owned_website') && !bad('managed_listing') && !bad('external_directory')
  const monitoring = dispositions[issue.id]?.status === 'monitoring'

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <>
            <Link to={`/issues/${issue.id}`} className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              {issue.title}
            </Link>
            <span className="text-line">/</span>
            <span>Sources</span>
          </>
        }
        title={`Source comparison${field ? ` · ${FIELD_LABELS[field]}` : ''}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/locations/${loc.id}/answers?audit=${issue.auditId}&prompt=${issue.promptId}`} className="font-medium text-brand hover:underline">
              {loc.name}
            </Link>
            <SeverityBadge severity={issue.severity} />
            <Badge tone="outline">{CATEGORY_LABEL[issue.category]}</Badge>
            <IssueStatusBadge status={status} />
          </span>
        }
        actions={
          <Button asChild>
            <Link to={`/geo-readiness/${loc.id}?from=${issue.id}`}>
              <Sparkles />
              GEO Readiness
            </Link>
          </Button>
        }
      />

      <div className={cn('mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]', obs.citations.length ? 'border-brand-line bg-brand-soft' : 'border-[#f1dcb2] bg-warning-soft')}>
        <CircleHelp className={cn('mt-0.5 size-4 shrink-0', obs.citations.length ? 'text-brand' : 'text-warning')} />
        <p className="text-ink">
          {obs.citations.length ? (
            <>
              <span className="font-medium">This answer cited {obs.citations.map((c) => c.url).join(', ')}.</span> A citation shows what the answer referenced, not that the source caused it.
            </>
          ) : (
            <>
              <span className="font-medium">No citation in this sample — source unknown.</span> Differences below are confirmed source inconsistencies, but any link to the AI answer is a hypothesis.
            </>
          )}
        </p>
      </div>

      {!field ? (
        <Card className="p-6">
          <p className="text-[14px] font-semibold text-ink">This issue isn't tied to a single business fact</p>
          <p className="mt-1 text-[13px] text-body">{issue.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" asChild>
              <Link to={`/geo-readiness/${loc.id}?from=${issue.id}`}>Review content in GEO Readiness</Link>
            </Button>
            <Button onClick={() => { setDisposition(issue.id, 'monitoring', 'Discovery gap — monitor across rechecks'); toast.success('Set to monitor') }}>Monitor across rechecks</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0">
            <CardHeader title="Where this fact appears" description="Simulated snapshots of sources BrightNest can see. The AI answer is shown for reference and can't be edited." />
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>{FIELD_LABELS[field]}</Th>
                  <Th>Assessment & action</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td className="min-w-[200px]">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <Building2 className="size-4 text-muted" />
                      ProManage master record
                    </p>
                    <p className="text-[12px] text-muted">Owned by business · {fact?.verifiedAt ? `verified ${fmtDate(fact.verifiedAt)} by ${fact.verifiedBy}` : loc.sourceOwner}</p>
                  </Td>
                  <Td className={cn(fact?.value ? 'font-medium text-ink' : 'italic text-muted')}>{fact?.value ?? 'Not captured'}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge tone={verified ? 'success' : 'warning'}>{verified ? 'Verified truth' : fact?.verificationStatus === 'pending_approval' ? 'Awaiting approval' : 'Not verified'}</Badge>
                      <Link to={`/geo-readiness/${loc.id}?tab=facts&from=${issue.id}`} className="text-[12.5px] font-medium text-brand hover:underline">
                        {verified ? 'Review fact' : 'Verify / approve fact'}
                      </Link>
                    </div>
                  </Td>
                </Tr>
                {rows.map(({ src, a, upd }) => {
                  const meta = SOURCE_META[src.channel]
                  const v = src.values[field]
                  const ch: ControlledChannel = src.channel === 'owned_website' ? 'owned_website' : src.channel === 'managed_listing' ? 'managed_listing' : 'external_request'
                  return (
                    <Tr key={src.id} className={cn(a === 'inconsistent' && 'bg-danger-soft/40')}>
                      <Td className="min-w-[180px] max-w-[260px]">
                        <p className="flex items-center gap-2 font-medium text-ink [&_svg]:size-4 [&_svg]:text-muted">
                          {meta.icon}
                          {src.label}
                        </p>
                        <p className="truncate text-[12px] text-muted" title={src.url}>
                          {meta.control} · checked {fmtDate(src.observedAt)}
                        </p>
                      </Td>
                      <Td className="max-w-[240px]">
                        {src.inaccessible ? (
                          <span className="italic text-muted">Snapshot unavailable</span>
                        ) : (
                          <>
                            {upd && <p className="text-[12px] text-muted line-through">{upd.previous ?? 'not stated'}</p>}
                            <span className={cn(v == null ? 'italic text-muted' : 'text-ink')}>{v ?? 'Not stated'}</span>
                          </>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1.5">
                        <Badge tone={ASSESS[a].tone}>{ASSESS[a].label}</Badge>
                        {upd && <p className="text-[11.5px] text-muted">via {upd.taskId} · {fmtDate(upd.at)}</p>}
                        {a === 'inconsistent' &&
                          (taskFor(ch) ? (
                            <Link to={`/tasks/${taskFor(ch)!.id}`} className="inline-flex">
                              <TaskStatusBadge status={taskFor(ch)!.status} channel={ch} />
                            </Link>
                          ) : src.channel === 'managed_listing' ? (
                            <Button size="sm" asChild>
                              <Link to={`/listings/${loc.id}?field=${field}&from=${issue.id}`}>Open listing</Link>
                            </Button>
                          ) : (
                            <PermButton perm="createTask" size="sm" onClick={() => setTaskChannel(ch)}>
                              {src.channel === 'owned_website' ? 'Prepare website update' : 'Draft request'}
                            </PermButton>
                          ))}
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
                <Tr>
                  <Td>
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <Bot className="size-4 text-muted" />
                      AI answer
                    </p>
                    <p className="text-[12px] text-muted">
                      External model · {SURFACE} · {fmtDateTime(obs.sampledAt)}
                    </p>
                  </Td>
                  <Td className="font-medium text-ink">{claim ? claim.value : '—'}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={claim?.evaluation === 'mismatch' ? 'danger' : claim?.evaluation === 'match' ? 'success' : 'warning'}>
                        {obs.citations.length ? `${obs.citations.length} citation${obs.citations.length > 1 ? 's' : ''}` : 'No citations'}
                      </Badge>
                      <span className="text-[12px] text-muted">Preserve and recheck — can't be edited</span>
                    </div>
                  </Td>
                </Tr>
              </tbody>
            </Table>
            <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">Agreement between an incorrect source and the AI answer doesn't prove that source caused the answer. Past observations are never rewritten.</p>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Recommended next steps" description="Based on sources BrightNest can inspect" />
              <div className="divide-y divide-line">
                {recs.map((r, i) => (
                  <div key={r.key} className="px-5 py-3.5">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <span className="grid size-5 place-items-center rounded-full bg-brand-soft text-[11px] text-brand">{i + 1}</span>
                      {r.title}
                    </p>
                    <p className="mt-1 text-[12.5px] text-body">{r.detail}</p>
                    <div className="mt-2.5">{r.action}</div>
                  </div>
                ))}
                {noControllable && (
                  <div className="px-5 py-3.5">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <BadgeCheck className="size-4 text-success" />
                      No verified controllable-source discrepancy found
                    </p>
                    <p className="mt-1 text-[12.5px] text-body">
                      The website and managed listing match the verified record{unable ? ', and one directory couldn’t be inspected' : ''}. Possible reasons include stale indexes, uncited external content, model generation or entity confusion. Generating new markup won't fix this.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={monitoring ? 'secondary' : 'primary'}
                        disabled={monitoring}
                        onClick={() => {
                          setDisposition(issue.id, 'monitoring', 'All known controllable sources correct — preserve evidence and monitor')
                          toast.success('Evidence preserved', { description: 'Issue set to “Unresolved externally · monitoring”.' })
                        }}
                      >
                        {monitoring ? 'Monitoring' : 'Preserve evidence & monitor'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          store.addActivity(`Provider feedback drafted for ${issue.id} (no provider integration — copy and submit manually)`)
                          toast('Provider feedback drafted', { description: 'Saved to activity. There is no provider integration in this workspace.' })
                        }}
                      >
                        <MessageSquare />
                        Log provider feedback
                      </Button>
                      {hasRelease('V2') && (
                        <PermButton
                          perm="runRecheck"
                          size="sm"
                          disabled={rechecking}
                          onClick={async () => {
                            setRechecking(true)
                            await runMatchedRecheck(issue.auditId)
                            setRechecking(false)
                          }}
                        >
                          {rechecking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          Recheck
                        </PermButton>
                      )}
                    </div>
                  </div>
                )}
                {recs.length === 0 && !noControllable && <p className="px-5 py-4 text-[13px] text-muted">Verify the master record first, then compare again.</p>}
              </div>
            </Card>
            {issueTasks.length > 0 && (
              <Card>
                <CardHeader title="Source actions" />
                <ul className="divide-y divide-line">
                  {issueTasks.map((t) => (
                    <li key={t.id}>
                      <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{t.title}</p>
                          <p className="text-[12px] text-muted">
                            {t.id} · {PEOPLE.find((p) => p.id === t.assigneeId)?.name}
                          </p>
                        </div>
                        <TaskStatusBadge status={t.status} channel={t.channel} />
                        <ArrowRight className="size-4 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {!can('createTask') && <p className="text-[12px] text-brand">Your role can review sources; Marketing creates correction tasks.</p>}
          </div>
        </div>
      )}

      {fact && fact.verificationStatus !== 'verified' && (
        <p className="mt-4 flex items-center gap-2 text-[12.5px] text-warning">
          <AlertTriangle className="size-4" />
          Comparisons stay “Cannot compare” until {FIELD_LABELS[field!].toLowerCase()} is verified.
        </p>
      )}
      {taskChannel && <CreateTaskDialog open={!!taskChannel} onOpenChange={(o) => !o && setTaskChannel(null)} issue={issue} channel={taskChannel} />}
    </div>
  )
}
