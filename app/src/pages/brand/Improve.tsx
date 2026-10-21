import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Code2, Copy, Download, Loader2, RotateCcw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Issue, Task } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { parseOpp, useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { buildFacts, effectiveLocation } from '@/lib/facts'
import { buildFactSheet, buildJsonLd, copyText, downloadText, factSheetText, serializeJsonLd } from '@/lib/geoMarkup'
import { aggregate, AGGREGATE_LABEL, PERMISSION_LABEL, STATE_LABEL, targetPermission } from '@/lib/publishing'
import { CATEGORY_LABEL } from '@/lib/discovery'
import { FIELD_PHRASE } from '@/lib/brandStatus'
import { FactComparison } from '@/components/brand'
import { KpiCard, NextStep, PageHeader, PermButton } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, Textarea } from '@/components/ui/input'
import { EmptyState, Progress, Segmented } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

interface Target {
  id: string
  label: string
  where: string
  channel: 'owned_website' | 'managed_listing' | 'external_request' | 'structured_info' | 'verification'
  before?: string | null
  after?: string | null
}

function Disclosure({ title, children, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-line">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[14px] font-medium text-ink hover:bg-subtle">
        {title}
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-line px-4 py-3">{children}</div>}
    </div>
  )
}

/** Read-only evidence for informed consent. Only artifacts actually involved in this proposal are shown. */
function TechnicalDetails({ locationId, targets, contentDiffs }: { locationId: string; targets: Target[]; contentDiffs: { title: string; before?: string; after?: string }[] }) {
  const { factEdits } = useStore()
  const facts = buildFacts(locationId, factEdits)
  const loc = LOCATION_BY_ID[locationId]
  const withSchema = targets.some((t) => t.channel === 'structured_info')
  const jsonld = withSchema ? serializeJsonLd(buildJsonLd(facts, loc).data) : null
  const sheet = withSchema ? factSheetText(buildFactSheet(facts, loc)) : null
  const manual = targets.filter((t) => ['third_party_unmanaged', 'requires_site_admin'].includes(targetPermission({ channel: t.channel === 'structured_info' ? 'owned_website' : (t.channel as never), recommendationId: t.id, locationId }).permission))
  return (
    <Disclosure title={<span className="flex items-center gap-2"><Code2 className="size-4 text-muted" />Technical details prepared by ProManage</span>}>
      <p className="text-[12.5px] text-muted">Read-only. Generated from verified facts and the same source snapshots ProManage inspected. You don’t need to edit any of it.</p>
      {contentDiffs.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">Content and listing changes</p>
          <ul className="space-y-2">
            {contentDiffs.map((d) => (
              <li key={d.title} className="rounded-lg border border-line bg-subtle px-3 py-2 font-mono text-[12px]">
                <p className="font-sans text-[12.5px] font-medium text-ink">{d.title}</p>
                <p className="whitespace-pre-line text-danger">- {d.before ?? '(not stated)'}</p>
                <p className="whitespace-pre-line text-success">+ {d.after ?? '(no wording change)'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {jsonld && (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-ink">LocalBusiness structured data (JSON-LD)</p>
            <Badge tone="success">Validated against verified facts</Badge>
            <Button size="sm" variant="ghost" onClick={async () => { await copyText(jsonld); toast.success('JSON-LD copied') }}>
              <Copy />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadText(`${locationId}-jsonld.json`, jsonld, 'application/json')}>
              <Download />
              Download
            </Button>
          </div>
          <pre className="scrollbar-thin max-h-64 overflow-auto rounded-lg border border-line bg-[#0f1b2d] px-3 py-2 text-[11.5px] leading-relaxed text-[#d7e3f4]" aria-label="JSON-LD preview" tabIndex={0}>
            {jsonld}
          </pre>
          <p className="mt-1 text-[12px] text-muted">Correct markup helps supported systems read the facts. It doesn’t guarantee AI uptake.</p>
        </div>
      )}
      {sheet && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">AI-readable fact sheet</p>
          <pre className="scrollbar-thin max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-subtle px-3 py-2 text-[12px] text-body">{sheet}</pre>
        </div>
      )}
      <div>
        <p className="mb-1 text-[13px] font-semibold text-ink">Fact provenance</p>
        <ul className="text-[12.5px] text-body">
          {facts
            .filter((f) => f.verificationStatus === 'verified' && ['programs', 'hours', 'saturdayTours', 'phone', 'address', 'operatingStatus'].includes(f.key))
            .map((f) => (
              <li key={f.id}>
                {f.label}: {f.value} · verified by {f.verifiedBy}
                {f.verifiedAt ? ` on ${fmtDate(f.verifiedAt)}` : ''}
              </li>
            ))}
        </ul>
      </div>
      {manual.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">What we cannot change automatically</p>
          <ul className="list-disc pl-5 text-[12.5px] text-body">
            {manual.map((t) => (
              <li key={t.id}>
                {t.label} — {targetPermission({ channel: t.channel as never, recommendationId: t.id, locationId }).reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[12px] text-muted">No crawler or security settings are changed automatically. Simulated: no real API, CMS or listing write happens in this prototype.</p>
    </Disclosure>
  )
}

interface Fix {
  id: string
  title: string
  where: string
  channel: Target['channel']
  before?: string | null
  after?: string | null
  facts?: string[]
  note?: string
}

/** Which task carries a fix after approval (structured data is published with the website task). */
function taskForFix(fix: Fix, taskIds: string[], tasks: Task[], kind: 'disc' | 'acc') {
  const own = tasks.filter((t) => taskIds.includes(t.id))
  if (fix.channel === 'structured_info') return own.find((t) => t.assetKinds.includes('jsonld')) ?? own.find((t) => t.channel === 'owned_website')
  return kind === 'disc' ? own.find((t) => t.recommendationId === fix.id) : own.find((t) => t.channel === fix.channel)
}

function Clamp({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 160
  return (
    <>
      <p className={cn('whitespace-pre-line text-[13.5px] leading-relaxed', !open && long && 'line-clamp-3')}>{text}</p>
      {long && (
        <button className="mt-1 text-[12.5px] font-medium text-brand hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Show full text'}
        </button>
      )}
    </>
  )
}

/** The actionable heart of a proposal: selectable fix cards + one authorize bar, or per-target results after approval. */
function FixPanel({ proposalKey, kind, locationId, fixes, status, taskIds, onApproved }: { proposalKey: string; kind: 'disc' | 'acc'; locationId: string; fixes: Fix[]; status: string; taskIds: string[]; onApproved: () => void }) {
  const { authorizeProposal, rejectProposal, reviseProposal, tasks, publications, retryPublication } = useStore()
  const [picked, setPicked] = useState<string[]>(fixes.map((f) => f.id))
  const [dlg, setDlg] = useState<null | 'approve' | 'request_changes' | 'decline'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string>()
  const awaiting = status === 'awaiting_brand_approval'
  const approved = status === 'approved'
  const perm = (f: Fix) => targetPermission({ channel: f.channel === 'structured_info' ? 'owned_website' : (f.channel as never), recommendationId: f.id, locationId })
  const auto = fixes.filter((f) => picked.includes(f.id) && perm(f).permission === 'connected_authorized').length
  const agg = aggregate(publications, taskIds)
  return (
    <div className="rounded-xl border-2 border-brand-line bg-brand-soft/30">
      <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">
            {fixes.length} recommended fix{fixes.length === 1 ? '' : 'es'}
          </p>
          <p className="text-[12.5px] text-body">
            {approved ? AGGREGATE_LABEL[agg] : awaiting ? `${picked.length} selected · ${auto} publish automatically after approval · ${picked.length - auto} need follow-up` : status === 'declined' ? 'You declined these fixes. Nothing was published.' : 'ProManage is revising these fixes. Nothing was published.'}
          </p>
        </div>
        {awaiting && (
          <div className="flex flex-wrap gap-2">
            <PermButton perm="approvePlan" variant="primary" disabled={!picked.length} onClick={() => { setText(''); setDlg('approve') }}>
              <ShieldCheck />
              Approve & authorize ({picked.length})
            </PermButton>
            <PermButton perm="approvePlan" onClick={() => { setText(''); setErr(undefined); setDlg('request_changes') }}>
              Request changes
            </PermButton>
            <PermButton perm="approvePlan" variant="ghost" onClick={() => { setText(''); setErr(undefined); setDlg('decline') }}>
              Decline
            </PermButton>
          </div>
        )}
        {status === 'changes_requested' && (
          <Button size="sm" onClick={() => { reviseProposal(proposalKey); toast.success('Revised version ready for authorization (simulated)') }}>
            See revised version
          </Button>
        )}
        {approved && <Badge tone="neutral">Demo: simulated publication</Badge>}
      </div>
      <ul className="space-y-2.5 p-3">
        {fixes.map((f) => {
          const pm = perm(f)
          const t = approved ? taskForFix(f, taskIds, tasks, kind) : undefined
          const last = t ? publications.filter((a) => a.taskId === t.id).pop() : undefined
          const st = last ? STATE_LABEL[last.state] : null
          const on = picked.includes(f.id)
          return (
            <li key={f.id} className={cn('rounded-xl border bg-surface px-4 py-3 shadow-card', awaiting && on ? 'border-brand' : 'border-line')}>
              <div className="flex items-start gap-3">
                {awaiting && <Checkbox checked={on} onCheckedChange={(v) => setPicked((p) => (v ? [...p, f.id] : p.filter((x) => x !== f.id)))} aria-label={`Authorize ${f.title}`} className="mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">{f.title}</p>
                    {st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone={pm.permission === 'connected_authorized' ? 'success' : 'warning'} className="max-w-full whitespace-normal">{PERMISSION_LABEL[pm.permission]}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted">{f.where}</p>
                  {f.channel === 'structured_info' ? (
                    <p className="mt-2 text-[13.5px] text-body">Search-readable information for the centre page, generated from your verified facts. Preview it in Technical details below.</p>
                  ) : f.after ? (
                    <div className="mt-2 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div className="rounded-lg bg-subtle px-3 py-2 text-body">
                        <p className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Now</p>
                        <Clamp text={f.before ?? 'Not stated'} />
                      </div>
                      <ArrowRight className="hidden size-4 self-center text-muted md:block" />
                      <div className="rounded-lg bg-teal-soft/60 px-3 py-2 text-ink">
                        <p className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-teal-ink">{f.channel === 'external_request' ? 'We’ll request' : 'After'}</p>
                        <Clamp text={f.after} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13.5px] text-body">No wording change — a check for the site owner to confirm.</p>
                  )}
                  {f.facts && f.facts.length > 0 && <p className="mt-1.5 text-[12px] text-muted">Uses your verified facts: {f.facts.join(' · ')}</p>}
                  {f.note && <p className="mt-1 text-[12px] text-warning">{f.note}</p>}
                  {last && <p className="mt-1.5 text-[12.5px] text-body">{last.detail}</p>}
                  {last?.state === 'failed' && t && (
                    <Button size="sm" className="mt-2" onClick={() => { retryPublication(t.id); toast.success('ProManage retried within the same approval (simulated)') }}>
                      <RotateCcw />
                      ProManage follow-up: retry
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {approved && (
        <div className="flex flex-wrap items-center gap-3 border-t border-brand-line px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[12.5px] text-muted">Recorded AI answers are unchanged. A source update doesn’t mean any AI answer has changed — that’s measured in 03 Measure.</p>
          <Button size="sm" asChild>
            <Link to="/measure">
              See what changed
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
      <Dialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === 'approve' ? 'Here is exactly what will change' : dlg === 'request_changes' ? 'Request changes' : 'Decline these changes?'}
        description={dlg === 'approve' ? `You authorize ${picked.length} selected fix${picked.length === 1 ? '' : 'es'} for this version. ProManage applies them to connected sources it’s permitted to update (simulated); anything else becomes a follow-up.` : dlg === 'request_changes' ? 'Nothing is published. ProManage revises and asks for a new authorization.' : 'Nothing is published.'}
        footer={
          <>
            <Button onClick={() => setDlg(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (dlg !== 'approve' && !text.trim()) return setErr('Please add a short note.')
                if (dlg === 'approve') {
                  authorizeProposal(proposalKey, picked, text.trim() || undefined)
                  onApproved()
                } else {
                  rejectProposal(proposalKey, dlg!, text.trim())
                  toast.success(dlg === 'decline' ? 'Declined — nothing was published' : 'Changes requested — nothing was published')
                }
                setDlg(null)
              }}
            >
              {dlg === 'approve' ? 'Authorize selected targets' : dlg === 'request_changes' ? 'Send request' : 'Decline'}
            </Button>
          </>
        }
      >
        {dlg === 'approve' ? (
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink">
            {fixes
              .filter((f) => picked.includes(f.id))
              .map((f) => (
                <li key={f.id}>
                  {f.title} <span className="text-muted">· {f.where}</span>
                </li>
              ))}
          </ul>
        ) : (
          <>
            <Textarea value={text} onChange={(e) => { setText(e.target.value); setErr(undefined) }} placeholder={dlg === 'request_changes' ? 'e.g. Please don’t mention the daycare hours on this page.' : 'Reason'} aria-label="Comment" />
            <FieldError>{err}</FieldError>
          </>
        )}
      </Dialog>
    </div>
  )
}

const planStatus = (s: string) => (s === 'awaiting_brand_approval' ? 'Awaiting your authorization' : s === 'approved' ? 'Authorized' : s === 'changes_requested' ? 'Changes requested' : s === 'declined' ? 'Declined' : 'Draft')

function FindingLine({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-subtle/60 px-4 py-3 text-[14px] text-ink">{children}</div>
}

function DiscoveryProposal({ oppId }: { oppId: string }) {
  const { byId, record, findingsFor, observationsOf } = useDiscovery()
  const { factEdits } = useStore()
  const [applying, setApplying] = useState(false)
  const opp = byId[oppId]
  const plan = record(oppId)?.plan
  if (!opp || !plan) return null
  const loc = LOCATION_BY_ID[opp.locationId]
  const missed = observationsOf(opp).filter((o) => opp.targetPromptIds.includes(o.promptId))
  const findings = findingsFor(opp)
  const facts = buildFacts(opp.locationId, factEdits)
  const targets: Target[] = plan.recommendations.map((r) => ({ id: r.id, label: r.brandTitle, where: r.controlledSource, channel: r.channel }))
  const fixes: Fix[] = plan.recommendations.map((r) => ({ id: r.id, title: r.brandTitle, where: r.controlledSource, channel: r.channel, before: r.currentText, after: r.proposedText, facts: r.businessFactIds.map((id) => facts.find((f) => f.id === id)?.label).filter(Boolean) as string[], note: r.dependency }))
  return (
    <ProposalShell id={`disc:${oppId}`} type="disc" title={`${loc.name} — help parents find your centre`} status={planStatus(plan.status)} round={plan.round}>
      <FindingLine>
        <span className="font-semibold">What we found:</span> not mentioned in {missed.length} relevant sampled recommendation{missed.length === 1 ? '' : 's'} — {missed.map((o) => `“${o.query}”`).join(', ')}. A discovery opportunity, not an AI error.
      </FindingLine>
      {applying ? <Applying onDone={() => setApplying(false)} /> : <FixPanel proposalKey={`disc:${oppId}`} kind="disc" locationId={opp.locationId} fixes={fixes} status={plan.status} taskIds={plan.taskIds} onApproved={() => setApplying(true)} />}
      <div className="space-y-2">
        <Disclosure title="Why ProManage recommends this">
          <p className="whitespace-pre-line text-[13.5px] text-ink">{plan.summary}</p>
          <p className="text-[13.5px] text-body"><span className="font-medium text-ink">Expected benefit (not guaranteed):</span> clearer, consistent information about the verified Montessori programme and services on sources you control. It can’t guarantee any AI assistant will mention the centre.</p>
        </Disclosure>
        <Disclosure title={`What ProManage checked · ${findings.filter((f) => f.certainty === 'confirmed_gap').length} confirmed gaps`}>
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.id} className="text-[13.5px]">
                <span className="font-medium text-ink">{f.surfaceLabel}</span> <span className="text-muted">({CATEGORY_LABEL[f.category]}, snapshot 14 Oct 2026)</span>: <span className="text-body">{f.observation}</span>{' '}
                <Badge tone={f.certainty === 'confirmed_gap' ? 'warning' : f.certainty === 'no_gap' ? 'success' : 'neutral'}>{f.certainty === 'confirmed_gap' ? 'Confirmed information gap' : f.certainty === 'no_gap' ? 'No gap' : f.certainty === 'potential_gap' ? 'Possible gap' : 'Couldn’t check'}</Badge>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">
            <span className="font-medium">Confirmed gaps vs. AI impact:</span> these gaps are real in the sources we inspected. Whether they caused the AI to leave you out is a hypothesis — we can’t prove it.
          </p>
        </Disclosure>
        <TechnicalDetails locationId={opp.locationId} targets={targets} contentDiffs={plan.recommendations.filter((r) => r.channel !== 'structured_info').map((r) => ({ title: r.brandTitle, before: r.currentText, after: r.proposedText }))} />
      </div>
    </ProposalShell>
  )
}


function ProposalShell({ id, type, title, status, round, children }: { id: string; type: 'disc' | 'acc'; title: string; status: string; round: number; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <Badge tone={type === 'disc' ? 'teal' : 'blue'}>{type === 'disc' ? 'Discoverability' : 'Accuracy'}</Badge>
          <h2 className="min-w-0 flex-1 text-[16px] font-semibold text-ink">{title}</h2>
          <Badge tone={status === 'Awaiting your authorization' ? 'warning' : status.startsWith('Authorized') ? 'success' : 'neutral'}>{status}</Badge>
          <span className="text-[12px] text-muted">v{round}</span>
        </div>
        <div className="space-y-5 px-5 py-4">{children}</div>
      </Card>
    </div>
  )
}

function Applying({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(10)
  useEffect(() => {
    const t1 = setTimeout(() => setPct(60), 350)
    const t2 = setTimeout(() => setPct(100), 800)
    const t3 = setTimeout(onDone, 1150)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [onDone])
  return (
    <div className="rounded-xl border border-brand-line bg-brand-soft px-4 py-3">
      <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
        <Loader2 className="size-4 animate-spin text-brand" />
        Applying your approved changes <Badge tone="neutral">Simulated</Badge>
      </p>
      <Progress value={pct} className="mt-2 h-1.5" />
    </div>
  )
}

function AccuracyProposal({ issue }: { issue: Issue }) {
  const { plans, sourcesFor, factEdits, observationsFor, publications, tasks } = useStore()
  const [applying, setApplying] = useState(false)
  const plan = plans[issue.id]
  if (!plan) return null
  const loc = LOCATION_BY_ID[issue.locationId]
  const obs = observationsFor(issue.auditId).find((o) => o.id === issue.observationId)
  const claim = obs?.extractedClaims.find((c) => c.id === issue.claimId)
  const verified = issue.field ? effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value : null
  const phrase = issue.field ? (FIELD_PHRASE[issue.field] ?? issue.field) : 'information'
  const sources = sourcesFor(issue.locationId)
  // Before = the value seen when it was published; otherwise today's snapshot.
  const valueOf = (taskChannel: string, sourceChannel: string) => {
    const task = tasks.find((t) => plan.taskIds.includes(t.id) && t.channel === taskChannel)
    const pub = task && publications.find((a) => a.taskId === task.id && a.before !== undefined)
    if (pub) return pub.before
    return issue.field ? (sources.find((s) => s.channel === sourceChannel)?.values[issue.field] ?? null) : null
  }
  const targets: Target[] = plan.items.map((it) => ({
    id: it.id,
    label: it.title,
    where: it.detail,
    channel: it.kind,
    before: it.kind === 'owned_website' ? valueOf('owned_website', 'owned_website') : it.kind === 'managed_listing' ? valueOf('managed_listing', 'managed_listing') : it.kind === 'external_request' ? valueOf('external_request', 'external_directory') : null,
    after: it.kind === 'structured_info' ? null : verified,
  }))
  const fixes: Fix[] = targets.map((t) => ({ id: t.id, title: t.channel === 'structured_info' ? 'Technical information prepared by ProManage' : t.label, where: t.where, channel: t.channel, before: t.before, after: t.after, facts: issue.field && t.channel !== 'structured_info' ? [phrase] : undefined }))
  return (
    <ProposalShell id={`acc:${issue.id}`} type="acc" title={`${loc.name} — correct ${phrase}`} status={planStatus(plan.status)} round={plan.round}>
      <FindingLine>
        <span className="font-semibold">What we found:</span> “{obs?.query}” — AI said <span className="font-semibold">“{claim?.value}”</span>; your verified record says <span className="font-semibold">“{verified ?? 'not verified'}”</span>.
      </FindingLine>
      {applying ? <Applying onDone={() => setApplying(false)} /> : <FixPanel proposalKey={`acc:${issue.id}`} kind="acc" locationId={issue.locationId} fixes={fixes} status={plan.status} taskIds={plan.taskIds} onApproved={() => setApplying(true)} />}
      <div className="space-y-2">
        <Disclosure title="Why ProManage recommends this">
          <FactComparison ai={claim?.value ?? '—'} record={verified ?? 'Not verified'} recordNote="Independently verified centre information" />
          <p className="text-[13.5px] text-ink">{plan.why}</p>
          <p className="text-[13.5px] text-body"><span className="font-medium text-ink">Expected benefit (not guaranteed):</span> sources you control will state the verified {phrase}. It can’t guarantee the next AI answer changes.</p>
        </Disclosure>
        <Disclosure title={`What ProManage checked · ${sources.filter((s) => issue.field && !s.inaccessible && s.values[issue.field] != null && s.values[issue.field] !== verified).length} outdated sources`}>
          <ul className="space-y-1 text-[13.5px]">
            {sources.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-ink">{s.label}</span> <span className="text-muted">({s.managedByCustomer ? 'connected' : 'independent'}, checked {fmtDate(s.observedAt)})</span>:{' '}
                {s.inaccessible ? 'couldn’t be captured' : issue.field && s.values[issue.field] != null ? `shows “${s.values[issue.field]}”` : 'doesn’t state it'}
                {issue.field && s.values[issue.field] != null && s.values[issue.field] !== verified && !s.inaccessible && <Badge tone="warning" className="ml-1.5">Outdated</Badge>}
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">Outdated sources are confirmed; that they caused the AI answer is a hypothesis. This answer {obs?.citations.length ? `cited ${obs.citations.map((c) => c.title).join(', ')}` : 'cited no source'}.</p>
        </Disclosure>
        <TechnicalDetails locationId={issue.locationId} targets={targets} contentDiffs={targets.filter((t) => t.channel !== 'structured_info').map((t) => ({ title: t.label, before: t.before ?? undefined, after: t.after ?? undefined }))} />
      </div>
    </ProposalShell>
  )
}


export default function ImprovePage() {
  const { latestAudit, openChapter, release, autoPrepared, prepareImprovements, issues, plans, investigations, approvals, selectedGoalId, goals, selectGoal, publications } = useStore()
  const disc = useDiscovery()
  const { hash } = useLocation()
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'authorized' | 'closed'>('all')
  useEffect(() => {
    if (hash) {
      setSel(decodeURIComponent(hash.slice(1)))
      setFilter('all')
      setTimeout(() => document.getElementById('proposal-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [hash])
  const first = useRef(release === 'MVP')
  useEffect(() => {
    if (first.current) toast.success('V1 unlocked: recommendations and approvals are now available')
    openChapter(2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (latestAudit && !autoPrepared[latestAudit.id] && release !== 'MVP') prepareImprovements(latestAudit.id)
  }, [latestAudit, autoPrepared, release, prepareImprovements])

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Improve" subtitle="ProManage prepares improvements from your latest AI Visibility Check." />
        <EmptyState icon={<ScanSearch />} title="Run the AI Visibility Check first" description="Improvements are prepared from the findings of your standard check." action={<Button variant="primary" asChild><Link to="/detect">Go to 01 Detect</Link></Button>} />
      </div>
    )
  }
  const goal = goals.find((g) => g.id === selectedGoalId)
  const inScope = (locId: string) => !goal || goal.locationIds.includes(locId)
  const discPlans = disc.latest.filter((o) => disc.record(o.id)?.plan && inScope(o.locationId))
  const noGap = disc.latest.filter((o) => o.status === 'no_gap' && inScope(o.locationId))
  const accIssues = issues.filter((i) => i.auditId === latestAudit.id && plans[i.id] && inScope(i.locationId))
  const accNoSource = issues.filter((i) => i.auditId === latestAudit.id && i.category === 'factual_mismatch' && investigations[i.id]?.status === 'completed' && !plans[i.id] && inScope(i.locationId))
  const needsConfirm = disc.latest.filter((o) => o.status === 'eligibility_review' && inScope(o.locationId))
  const awaiting = discPlans.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length + accIssues.filter((i) => plans[i.id].status === 'awaiting_brand_approval').length
  const locs = [...new Set([...discPlans.map((o) => o.locationId), ...accIssues.map((i) => i.locationId)])].sort((a, b) => (a === 'whitefield' ? -1 : b === 'whitefield' ? 1 : a.localeCompare(b)))
  const items = locs.flatMap((locId) => [
    ...discPlans
      .filter((o) => o.locationId === locId)
      .map((o) => ({ key: `disc:${o.id}`, type: 'disc' as const, title: `${LOCATION_BY_ID[locId].name} — help parents find your centre`, status: disc.record(o.id)!.plan!.status as string, node: <DiscoveryProposal key={o.id} oppId={o.id} /> })),
    ...accIssues
      .filter((i) => i.locationId === locId)
      .map((i) => ({ key: `acc:${i.id}`, type: 'acc' as const, title: `${LOCATION_BY_ID[locId].name} — correct ${i.field ? (FIELD_PHRASE[i.field] ?? i.field) : 'information'}`, status: plans[i.id].status as string, node: <AccuracyProposal key={i.id} issue={i} /> })),
  ])
  const current = items.find((i) => i.key === sel) ?? items.find((i) => i.status === 'awaiting_brand_approval') ?? items[0]
  // Keep the proposal you're looking at selected, even after its status changes.
  if (!sel && current) queueMicrotask(() => setSel(current.key))
  const taskKeys = new Set(items.map((i) => i.key))
  const latestByTask = Object.values(Object.fromEntries(publications.filter((p) => taskKeys.has(p.proposalKey)).map((p) => [p.taskId, p])))

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="ProManage has prepared improvements"
        subtitle="From your latest standard check. ProManage checked the business information, listings, genuine reviews, location data and local content it manages — you review and authorize."
        actions={
          <Button asChild>
            <Link to="/detect">
              <ArrowLeft />
              Back to findings
            </Link>
          </Button>
        }
      />
      {goal && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-[13.5px] text-ink">
          Focused on “{goal.anchorQuestion}” · {LOCATION_BY_ID[goal.locationIds[0]]?.name}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => selectGoal(null)}>
            Back to standard check
          </Button>
        </div>
      )}
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Sparkles className="size-4 text-teal-ink" />
        Prepared automatically by ProManage (simulated) on {fmtDateTime(autoPrepared[latestAudit.id] ?? new Date().toISOString())}. Opening this tab doesn’t approve or publish anything.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Proposals prepared" value={items.length} icon={<Sparkles />} tone="blue" definition="Evidence-backed proposals ProManage prepared from your standard check (simulated)." footer={`${items.filter((i) => i.type === 'disc').length} discoverability · ${items.filter((i) => i.type === 'acc').length} accuracy`} />
        <KpiCard label="Awaiting your authorization" value={awaiting} icon={<ShieldCheck />} tone="warning" definition="Proposals waiting for your decision. Nothing is published before you authorize it." footer="Approve, request changes or decline" />
        <KpiCard label="Sources updated" value={latestByTask.filter((p) => p.state === 'success').length} detail={`of ${latestByTask.length} targets`} icon={<CheckCircle2 />} tone="teal" definition="Connected, write-authorized targets updated after your authorization. Demo: simulated publication." footer="AI answers are unchanged until rechecked" />
        <KpiCard label="Needs follow-up" value={latestByTask.filter((p) => p.state !== 'success').length} icon={<RotateCcw />} tone="neutral" definition="Targets that need ProManage, a site admin or an external owner — never marked updated." footer="Handoffs, access or failed attempts" />
      </div>
      {latestByTask.length > 0 && (
        <NextStep
          chapter="03 Measure"
          title="See what changed after your approvals"
          description={`${latestByTask.filter((p) => p.state === 'success').length} source${latestByTask.filter((p) => p.state === 'success').length === 1 ? '' : 's'} updated so far. ProManage runs a matched follow-up check with the same questions and centres.${awaiting ? ` ${awaiting} proposal${awaiting === 1 ? '' : 's'} still await your decision.` : ''}`}
          to="/measure"
          cta="See before and after"
        />
      )}
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles />} title="No proposals yet" description="ProManage prepares proposals when your standard check has confirmed, controllable gaps." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="scrollbar-thin self-start xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto">
            <CardHeader title="Proposals" description="Grouped by location · one queue for both finding types" />
            <div className="border-b border-line px-4 py-2.5">
              <Segmented
                ariaLabel="Proposal status"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All · ${items.length}` },
                  { value: 'awaiting', label: 'Awaiting' },
                  { value: 'authorized', label: 'Authorized' },
                  { value: 'closed', label: 'Other' },
                ]}
              />
            </div>
            <ul className="divide-y divide-line">
              {items
                .filter((i) => filter === 'all' || (filter === 'awaiting' ? i.status === 'awaiting_brand_approval' : filter === 'authorized' ? i.status === 'approved' : !['awaiting_brand_approval', 'approved'].includes(i.status)))
                .map((i) => (
                  <li key={i.key}>
                    <button onClick={() => setSel(i.key)} aria-current={current?.key === i.key} className={cn('flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-subtle', current?.key === i.key && 'bg-brand-soft/50')}>
                      <span className="flex items-center gap-2">
                        <Badge tone={i.type === 'disc' ? 'teal' : 'blue'}>{i.type === 'disc' ? 'Discoverability' : 'Accuracy'}</Badge>
                        <Badge tone={i.status === 'awaiting_brand_approval' ? 'warning' : i.status === 'approved' ? 'success' : 'neutral'}>{planStatus(i.status)}</Badge>
                      </span>
                      <span className="text-[14px] font-medium text-ink">{i.title}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
          <div id="proposal-detail" className="min-w-0 scroll-mt-24">
            {current?.node}
          </div>
        </div>
      )}
      {(noGap.length > 0 || accNoSource.length > 0) && (
        <Card>
          <CardHeader title="No confirmed, controllable gap found" description="No supported change recommended yet — ProManage keeps monitoring these" />
          <ul className="divide-y divide-line">
            {noGap.map((o) => (
              <li key={o.id} className="px-5 py-3 text-[13.5px]">
                <p className="font-medium text-ink">{LOCATION_BY_ID[o.locationId].name} · Discoverability</p>
                <p className="text-body">What we checked: {disc.findingsFor(o).map((f) => f.surfaceLabel).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'centre page and managed listing'}. Your published information looks complete in the sources we checked. AI engines choose their own recommendations.</p>
              </li>
            ))}
            {accNoSource.map((i) => (
              <li key={i.id} className="px-5 py-3 text-[13.5px]">
                <p className="font-medium text-ink">{LOCATION_BY_ID[i.locationId].name} · Accuracy — {i.title.toLowerCase()}</p>
                <p className="text-body">What we checked: your centre page, managed listing and known directories match your verified information. The incorrect answer has no source we can correct; we’ll keep monitoring.</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {needsConfirm.length > 0 && (
        <Card>
          <CardHeader title="Needs your confirmation first" description="ProManage won’t propose changes until relevance or facts are confirmed" />
          <ul className="divide-y divide-line">
            {needsConfirm.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                <span className="min-w-0 flex-1 text-ink">{LOCATION_BY_ID[o.locationId].name} · {o.intentCategory}</span>
                <Button size="sm" asChild>
                  <Link to={`/attention/discovery/${o.id}`}>Confirm relevance</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card id="history" className="scroll-mt-24">
        <CardHeader title="Approval history" description="Every authorization, change request and decline — versioned and scoped" />
        {approvals.length === 0 ? (
          <p className="px-5 py-4 text-[13.5px] text-body">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...approvals].reverse().map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-[13px]">
                <span className="font-medium text-ink">{a.action === 'approve' ? 'Authorized' : a.action === 'decline' ? 'Declined' : 'Requested changes'}</span> · {a.proposalKey.startsWith('disc') ? 'Discoverability' : 'Accuracy'} · {LOCATION_BY_ID[a.proposalKey.startsWith('disc') ? parseOpp(a.proposalKey.slice(5)).locationId : (issues.find((i) => `acc:${i.id}` === a.proposalKey)?.locationId ?? '')]?.name} · version {a.approvedVersion}
                {a.approvedTargetIds.length ? ` · ${a.approvedTargetIds.length} target${a.approvedTargetIds.length === 1 ? '' : 's'}` : ''} · {a.approverName} · {fmtDateTime(a.at)}
                {a.comment ? ` · “${a.comment}”` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
