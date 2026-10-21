import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Code2, Copy, Download, Loader2, RotateCcw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Issue } from '@/data/types'
import { LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import { parseOpp, useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { buildFacts, effectiveLocation } from '@/lib/facts'
import { buildFactSheet, buildJsonLd, copyText, downloadText, factSheetText, serializeJsonLd } from '@/lib/geoMarkup'
import { aggregate, AGGREGATE_LABEL, PERMISSION_LABEL, STATE_LABEL, targetPermission } from '@/lib/publishing'
import { CATEGORY_LABEL } from '@/lib/discovery'
import { FIELD_PHRASE } from '@/lib/brandStatus'
import { FactComparison } from '@/components/brand'
import { RecommendationCard } from '@/components/discovery'
import { KpiCard, PageHeader, PermButton } from '@/components/domain'
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

function Execution({ proposalKey, taskIds }: { proposalKey: string; taskIds: string[] }) {
  const { tasks, publications, retryPublication } = useStore()
  const agg = aggregate(publications, taskIds)
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
        {AGGREGATE_LABEL[agg]}
        <Badge tone="neutral">Demo: simulated publication</Badge>
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {taskIds.map((id) => {
          const t = tasks.find((x) => x.id === id)
          const last = publications.filter((a) => a.taskId === id).pop()
          if (!t) return null
          const st = last ? STATE_LABEL[last.state] : { label: 'Waiting', tone: 'neutral' as const }
          return (
            <li key={id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{t.title}</p>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <p className="text-[12.5px] text-muted">
                {t.target} · owner {PEOPLE.find((p) => p.id === t.assigneeId)?.name}
              </p>
              {last && <p className="text-[12.5px] text-body">{last.detail}</p>}
              {last && last.state === 'success' && (last.before || last.after) && (
                <p className="text-[12px] text-body">
                  <span className="text-muted">Source snapshot:</span> “{(last.before ?? 'not stated').slice(0, 80)}” → “{(last.after ?? '').slice(0, 80)}{(last.after ?? '').length > 80 ? '…' : ''}”
                </p>
              )}
              {last?.state === 'failed' && (
                <Button size="sm" onClick={() => { retryPublication(id); toast.success('ProManage retried within the same approval (simulated)') }}>
                  <RotateCcw />
                  ProManage follow-up: retry
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-[12.5px] text-muted">Recorded AI answers are unchanged. A source update is a completed action — it doesn’t mean any AI answer has changed yet. {proposalKey.startsWith('acc') ? 'Accuracy' : 'Discovery'} outcome is measured separately in 03 Measure.</p>
    </div>
  )
}

function DecisionBar({ proposalKey, targets, locationId, onApproved }: { proposalKey: string; targets: Target[]; locationId: string; onApproved: () => void }) {
  const { authorizeProposal, rejectProposal } = useStore()
  const selectable = targets.filter((t) => t.channel !== 'verification')
  const [picked, setPicked] = useState<string[]>(selectable.map((t) => t.id))
  const [dlg, setDlg] = useState<null | 'approve' | 'request_changes' | 'decline'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string>()
  return (
    <>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink">Which sources will be changed</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {selectable.map((t) => {
            const perm = targetPermission({ channel: t.channel === 'structured_info' ? 'owned_website' : (t.channel as never), recommendationId: t.id, locationId })
            return (
              <li key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-2.5">
                <Checkbox checked={picked.includes(t.id)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, t.id] : p.filter((x) => x !== t.id)))} aria-label={`Authorize ${t.label}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{t.label}</p>
                  <p className="text-[12.5px] text-muted">{t.where}</p>
                </div>
                <Badge tone={perm.permission === 'connected_authorized' ? 'success' : 'warning'} className="max-w-full whitespace-normal">{PERMISSION_LABEL[perm.permission]}</Badge>
              </li>
            )
          })}
        </ul>
      </div>
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
      <Dialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === 'approve' ? 'Here is exactly what will change' : dlg === 'request_changes' ? 'Request changes' : 'Decline these changes?'}
        description={dlg === 'approve' ? `You authorize ${picked.length} selected target${picked.length === 1 ? '' : 's'} for this version. ProManage then applies them to connected sources it’s permitted to update (simulated); anything else becomes a follow-up.` : dlg === 'request_changes' ? 'Nothing is published. ProManage revises and asks for a new authorization.' : 'Nothing is published.'}
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
            {selectable
              .filter((t) => picked.includes(t.id))
              .map((t) => (
                <li key={t.id}>
                  {t.label} <span className="text-muted">· {t.where}</span>
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
    </>
  )
}

/** Detail pane for the selected proposal (ProManage-style master/detail). */
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

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        {n}. {title}
      </p>
      {children}
    </div>
  )
}

const planStatus = (s: string) => (s === 'awaiting_brand_approval' ? 'Awaiting your authorization' : s === 'approved' ? 'Authorized' : s === 'changes_requested' ? 'Changes requested' : s === 'declined' ? 'Declined' : 'Draft')

function Outcome({ status, proposalKey, taskIds }: { status: string; proposalKey: string; taskIds: string[] }) {
  const { reviseProposal } = useStore()
  if (status === 'approved') return <Execution proposalKey={proposalKey} taskIds={taskIds} />
  if (status === 'changes_requested')
    return (
      <div className="rounded-lg border border-brand-line bg-brand-soft px-4 py-3 text-[13.5px] text-ink">
        ProManage is revising this proposal. Nothing was published.
        <Button size="sm" className="ml-3" onClick={() => { reviseProposal(proposalKey); toast.success('Revised version ready for authorization (simulated)') }}>
          See revised version
        </Button>
      </div>
    )
  if (status === 'declined') return <p className="rounded-lg border border-line bg-subtle px-4 py-3 text-[13.5px] text-body">You declined this proposal. Nothing was published.</p>
  return null
}

function DiscoveryProposal({ oppId }: { oppId: string }) {
  const { byId, record, findingsFor, observationsOf } = useDiscovery()
  const [applying, setApplying] = useState(false)
  const opp = byId[oppId]
  const plan = record(oppId)?.plan
  if (!opp || !plan) return null
  const loc = LOCATION_BY_ID[opp.locationId]
  const missed = observationsOf(opp).filter((o) => opp.targetPromptIds.includes(o.promptId))
  const findings = findingsFor(opp)
  const targets: Target[] = plan.recommendations.map((r) => ({ id: r.id, label: r.brandTitle, where: r.controlledSource, channel: r.channel }))
  return (
    <ProposalShell id={`disc:${oppId}`} type="disc" title={`${loc.name} — help parents find your centre`} status={planStatus(plan.status)} round={plan.round}>
      <Section n={1} title="What we found">
        <p className="text-[14px] text-ink">
          Not mentioned in {missed.length} relevant sampled recommendation{missed.length === 1 ? '' : 's'}: {missed.map((o) => `“${o.query}”`).join(', ')}. A discovery opportunity — not an AI error.
        </p>
      </Section>
      <Section n={2} title="What ProManage checked">
        <ul className="space-y-1.5">
          {findings.map((f) => (
            <li key={f.id} className="text-[13.5px]">
              <span className="font-medium text-ink">{f.surfaceLabel}</span> <span className="text-muted">({CATEGORY_LABEL[f.category]}, snapshot 14 Oct 2026)</span>: <span className="text-body">{f.observation}</span>{' '}
              <Badge tone={f.certainty === 'confirmed_gap' ? 'warning' : f.certainty === 'no_gap' ? 'success' : 'neutral'}>{f.certainty === 'confirmed_gap' ? 'Confirmed information gap' : f.certainty === 'no_gap' ? 'No gap' : f.certainty === 'potential_gap' ? 'Possible gap' : 'Couldn’t check'}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">
          <span className="font-medium">Confirmed gaps vs. AI impact:</span> these gaps are real in the sources we inspected. Whether they caused the AI to leave you out is a hypothesis — we can’t prove it.
        </p>
      </Section>
      <Section n={3} title="What we recommend · what will change">
        <p className="mb-2 whitespace-pre-line text-[14px] text-ink">{plan.summary}</p>
        <div className="space-y-3">
          {plan.recommendations.map((r) => (
            <RecommendationCard key={r.id} rec={r} locationId={opp.locationId} brand />
          ))}
        </div>
      </Section>
      <Section n={4} title="Expected benefit (not guaranteed)">
        <p className="text-[13.5px] text-body">Clearer, consistent information about the verified Montessori programme and services on sources you control. It can’t guarantee any AI assistant will mention the centre.</p>
      </Section>
      <TechnicalDetails locationId={opp.locationId} targets={targets} contentDiffs={plan.recommendations.filter((r) => r.channel !== 'structured_info').map((r) => ({ title: r.brandTitle, before: r.currentText, after: r.proposedText }))} />
      {applying && <Applying onDone={() => setApplying(false)} />}
      {plan.status === 'awaiting_brand_approval' ? <DecisionBar proposalKey={`disc:${oppId}`} targets={targets} locationId={opp.locationId} onApproved={() => setApplying(true)} /> : !applying && <Outcome status={plan.status} proposalKey={`disc:${oppId}`} taskIds={plan.taskIds} />}
    </ProposalShell>
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
  // Before = the value seen at approval time when published; otherwise today's snapshot.
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
  return (
    <ProposalShell id={`acc:${issue.id}`} type="acc" title={`${loc.name} — correct ${phrase}`} status={planStatus(plan.status)} round={plan.round}>
      <Section n={1} title="What we found">
        <p className="mb-2 text-[14px] text-ink">A different AI answer — “{obs?.query}” — gave {phrase} that don’t match your verified record.</p>
        <FactComparison ai={claim?.value ?? '—'} record={verified ?? 'Not verified'} recordNote="Independently verified centre information" />
      </Section>
      <Section n={2} title="What ProManage checked">
        <ul className="space-y-1 text-[13.5px]">
          {sources.map((s) => (
            <li key={s.id}>
              <span className="font-medium text-ink">{s.label}</span> <span className="text-muted">({s.managedByCustomer ? 'connected' : 'independent'}, checked {fmtDate(s.observedAt)})</span>:{' '}
              {s.inaccessible ? 'couldn’t be captured' : issue.field && s.values[issue.field] != null ? `shows “${s.values[issue.field]}”` : 'doesn’t state it'}
              {issue.field && s.values[issue.field] != null && s.values[issue.field] !== verified && !s.inaccessible && <Badge tone="warning" className="ml-1.5">Outdated</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">Outdated sources are confirmed; that they caused the AI answer is a hypothesis. This answer {obs?.citations.length ? `cited ${obs.citations.map((c) => c.title).join(', ')}` : 'cited no source'}.</p>
      </Section>
      <Section n={3} title="What we recommend · what will change">
        <p className="mb-2 text-[14px] text-ink">{plan.why}</p>
        <ul className="space-y-2">
          {targets.map((t) => (
            <li key={t.id} className="rounded-xl border border-line px-4 py-3">
              <p className="text-[14px] font-semibold text-ink">{t.channel === 'structured_info' ? 'Technical information prepared by ProManage' : t.label}</p>
              <p className="text-[12.5px] text-muted">{t.where}</p>
              {t.channel === 'structured_info' ? (
                <p className="mt-1 text-[13.5px] text-body">Search-readable information for the centre page, generated from your verified facts only.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-[13.5px]">
                    <p className="text-[12px] font-medium text-muted">Now</p>
                    {t.before ?? 'Not stated'}
                  </div>
                  <div className="rounded-lg border border-[#bfeef3] bg-teal-soft/50 px-3 py-2 text-[13.5px] text-ink">
                    <p className="text-[12px] font-medium text-teal-ink">{t.channel === 'external_request' ? 'We’ll request' : 'After'}</p>
                    {t.after}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section n={4} title="Expected benefit (not guaranteed)">
        <p className="text-[13.5px] text-body">Sources you control will state the verified {phrase}. It can’t guarantee the next AI answer changes.</p>
      </Section>
      <TechnicalDetails locationId={issue.locationId} targets={targets} contentDiffs={targets.filter((t) => t.channel !== 'structured_info').map((t) => ({ title: t.label, before: t.before ?? undefined, after: t.after ?? undefined }))} />
      {applying && <Applying onDone={() => setApplying(false)} />}
      {plan.status === 'awaiting_brand_approval' ? <DecisionBar proposalKey={`acc:${issue.id}`} targets={targets} locationId={issue.locationId} onApproved={() => setApplying(true)} /> : !applying && <Outcome status={plan.status} proposalKey={`acc:${issue.id}`} taskIds={plan.taskIds} />}
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
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles />} title="No proposals yet" description="ProManage prepares proposals when your standard check has confirmed, controllable gaps." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="self-start xl:sticky xl:top-[84px]">
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
