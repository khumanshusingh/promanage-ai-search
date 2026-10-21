import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Clock, Compass, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { DiscoveryOpportunity } from '@/data/types'
import { LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import { CATEGORY_LABEL, DISCOVERY_STAGE } from '@/lib/discovery'
import { brandNeedsAction, useDiscovery } from '@/lib/useDiscovery'
import { useStore, taskStatusLabel } from '@/store/AppStore'
import { DiscoveryProgress, DiscoveryStageBadge, NotAnErrorNote, QueryRow, RecheckResult, RecommendationCard } from '@/components/discovery'
import { EvidenceDisclosure } from '@/components/brand'
import { PageHeader, PermButton } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

/** Compact list of discovery opportunities for Brand destinations (Overview, Attention, Locations, Progress). */
export function BrandDiscoveryRows({ opps }: { opps: DiscoveryOpportunity[] }) {
  const navigate = useNavigate()
  const { record, recheckFor } = useDiscovery()
  return (
    <ul className="divide-y divide-line">
      {opps.map((o) => {
        const needs = brandNeedsAction(o, !!record(o.id)?.confirmRequested)
        const cta = record(o.id)?.confirmRequested && o.status !== 'awaiting_approval' ? 'Confirm your services' : DISCOVERY_STAGE[o.status].cta
        return (
          <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">
                {LOCATION_BY_ID[o.locationId].name} — {o.targetPromptIds.length ? `not mentioned in ${o.targetPromptIds.length} selected search${o.targetPromptIds.length === 1 ? '' : 'es'}` : 'searches reviewed'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <DiscoveryStageBadge opp={o} recheck={recheckFor(o)} />
                <span className="text-[12.5px] text-muted">{o.intentCategory}</span>
              </div>
            </div>
            <Button size="sm" variant={needs ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/discovery/${o.id}`)}>
              {cta}
              <ArrowRight />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function WhyItMatters() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-3 text-left text-[13.5px] font-medium text-ink hover:bg-subtle">
        Why this might matter
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="px-5 pb-4 text-[13.5px] text-body">Parents nearby who ask an AI assistant this kind of question might not see your centre in that answer. We can’t tell how many real parents ask it, or whether any enquiries were lost — this is a sample, not a measure of customer impact.</p>}
    </div>
  )
}

function DecisionCard({ opp }: { opp: DiscoveryOpportunity }) {
  const { hasRelease, setDiscoveryDecision, startDiscoveryInvestigation, reopenDiscovery } = useStore()
  const { record, tasksFor, recheckFor } = useDiscovery()
  const rec = record(opp.id)
  const box = (title: React.ReactNode, body: React.ReactNode, actions?: React.ReactNode, tone: 'blue' | 'neutral' | 'warning' = 'neutral') => (
    <Card className={cn('p-5', tone === 'blue' && 'border-brand-line', tone === 'warning' && 'border-[#f1dcb2]')}>
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      <div className="mt-1 text-[14px] text-body">{body}</div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  )
  const hasEligible = opp.eligibility === 'eligible'
  if (opp.status === 'observed' || opp.status === 'eligibility_review') {
    return box(
      'Is this worth looking into?',
      opp.status === 'eligibility_review' && !hasEligible
        ? 'First tell us whether these searches match what your centre offers — use the options next to each search above.'
        : hasRelease('V1')
          ? 'ProManage can check the information available about this centre and suggest truthful improvements. Nothing changes without your approval.'
          : 'Mark it worth investigating and ProManage will review it. Improvement plans become available in your next phase.',
      <>
        {hasRelease('V1') ? (
          <PermButton perm="qualifyDiscovery" variant="primary" disabled={!hasEligible} onClick={() => { startDiscoveryInvestigation(opp.id); toast.success('Sent to ProManage', { description: 'They’ll check the information available about this centre.' }) }}>
            <Search />
            Ask ProManage to investigate
          </PermButton>
        ) : (
          <PermButton perm="qualifyDiscovery" variant="primary" disabled={!hasEligible} onClick={() => { setDiscoveryDecision(opp.id, 'worth_investigating'); toast.success('Saved as worth investigating') }}>
            Worth investigating
          </PermButton>
        )}
        <PermButton perm="qualifyDiscovery" variant="ghost" onClick={() => { setDiscoveryDecision(opp.id, 'dismissed', 'Not relevant to these searches'); toast.success('Marked not relevant') }}>
          Not relevant to these searches
        </PermButton>
      </>,
      'blue',
    )
  }
  if (opp.status === 'qualified') {
    return box(
      hasRelease('V1') ? 'Worth investigating' : 'Saved for review',
      hasRelease('V1') ? 'You marked this worth investigating. Ask ProManage to check the information available about this centre.' : 'ProManage will review it. Suggested improvements become available in your next phase.',
      hasRelease('V1') ? (
        <PermButton perm="qualifyDiscovery" variant="primary" onClick={() => { startDiscoveryInvestigation(opp.id); toast.success('Sent to ProManage') }}>
          <Search />
          Ask ProManage to investigate
        </PermButton>
      ) : undefined,
      'blue',
    )
  }
  if (opp.status === 'not_relevant') return box('Not relevant to these searches', 'These searches don’t match what this centre offers, so they’re excluded from your discovery numbers. The sampled answers are kept as evidence.')
  if (opp.status === 'investigating' || opp.status === 'proposal_draft') return box(<span className="flex items-center gap-2"><Clock className="size-4 text-brand" />We’re checking the information available about this centre</span>, `Started ${fmtDate(rec?.investigation?.requestedAt ?? new Date().toISOString())}. You’ll be asked to approve any suggested improvements.`, undefined, 'blue')
  if (opp.status === 'no_gap') return box('We didn’t find a clear information change to make', 'Your published information looks complete in the sources we checked. AI engines choose their own recommendations, so we’ll keep tracking these searches.')
  if (opp.status === 'changes_requested') return box('ProManage is revising the suggestions', `You asked: “${rec?.plan?.comments.filter((c) => c.kind === 'changes').pop()?.text ?? ''}”`, undefined, 'blue')
  if (opp.status === 'declined')
    return box('You declined the suggested improvements', `Nothing will be changed.${rec?.plan?.comments.filter((c) => c.kind === 'decline').pop()?.text ? ` Your reason: “${rec.plan.comments.filter((c) => c.kind === 'decline').pop()!.text}”` : ''}`, (
      <Button onClick={() => { reopenDiscovery(opp.id, 'Brand asked ProManage to look again'); toast.success('Asked ProManage to look again') }}>Ask ProManage to look again</Button>
    ))
  if (opp.status === 'implementing' || opp.status === 'awaiting_recheck') {
    const tasks = tasksFor(opp)
    return (
      <Card>
        <CardHeader title={opp.status === 'implementing' ? 'Update in progress' : 'Website or listing update recorded'} description={opp.status === 'implementing' ? 'Who is updating what' : 'Waiting for the next follow-up AI check. Updating a source doesn’t change AI answers directly.'} />
        <ul className="divide-y divide-line">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{t.title}</p>
                <p className="text-[13px] text-muted">Owner: {PEOPLE.find((p) => p.id === t.assigneeId)?.name}</p>
              </div>
              <Badge tone={['awaiting_recheck', 'closed'].includes(t.status) ? 'success' : t.status === 'source_updated' ? 'warning' : 'blue'}>{['awaiting_recheck', 'closed'].includes(t.status) ? 'Update recorded' : t.status === 'source_updated' ? 'Correction requested' : taskStatusLabel(t.status, t.channel)}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    )
  }
  if (opp.status === 'rechecked') {
    const rc = recheckFor(opp)
    return (
      <Card className="space-y-3 p-5">
        <p className="text-[16px] font-semibold text-ink">Latest follow-up AI check</p>
        {rc && <RecheckResult rc={rc} brand />}
        {rc && (rc.outcome === 'still_absent' || rc.outcome === 'mixed') && <p className="text-[13.5px] text-body">ProManage is reviewing next steps. Your earlier plan and the original answers stay on record.</p>}
      </Card>
    )
  }
  return null
}

function PlanCard({ opp }: { opp: DiscoveryOpportunity }) {
  const { approveDiscoveryPlan, requestDiscoveryPlanChanges, declineDiscoveryPlan } = useStore()
  const { record, findingsFor, tasksFor } = useDiscovery()
  const rec = record(opp.id)
  const plan = rec?.plan
  const [dlg, setDlg] = useState<null | 'approve' | 'changes' | 'decline'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string>()
  if (!plan || plan.status === 'draft') return null
  const findings = findingsFor(opp).filter((f) => rec?.investigation?.findingReviews[f.id] === 'confirmed' || plan.recommendations.some((r) => r.findingId === f.id))
  const done = new Set(tasksFor(opp).filter((t) => ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status)).map((t) => t.recommendationId))
  return (
    <>
      <Card>
        <CardHeader title="What we found" description="We checked the information available about this centre" />
        <ul className="divide-y divide-line">
          {findings.map((f) => (
            <li key={f.id} className="px-5 py-3">
              <p className="text-[14px] font-medium text-ink">{f.surfaceLabel}</p>
              <p className="text-[13.5px] text-body">{f.observation}</p>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-[13px] text-body">These gaps are real, but we can’t prove they caused the AI answers. Making accurate information easier to find is the part we can control.</p>
      </Card>
      <Card>
        <CardHeader title="What we recommend" description={`Suggested improvements · prepared by ProManage · ${fmtDate(plan.updatedAt)}`} />
        <div className="space-y-3 px-5 py-4">
          <p className="text-[14px] text-ink">{plan.summary}</p>
          {plan.recommendations.map((r) => (
            <RecommendationCard key={r.id} rec={r} locationId={opp.locationId} brand published={done.has(r.id)} />
          ))}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-success-soft px-3 py-2.5 text-[13.5px] text-ink">
              <span className="font-medium">What this can do:</span> Make accurate information about your centre more complete and easier to find.
            </div>
            <div className="rounded-lg bg-warning-soft px-3 py-2.5 text-[13.5px] text-ink">
              <span className="font-medium">What it can’t guarantee:</span> That any AI assistant will mention your centre, or any change in enquiries.
            </div>
          </div>
        </div>
      </Card>
      {plan.status === 'awaiting_brand_approval' && (
        <Card className="border-[#f1dcb2] p-5">
          <p className="text-[16px] font-semibold text-ink">What we need from you</p>
          <p className="mt-1 text-[14px] text-body">Check that every business fact above is correct, then approve. ProManage only publishes or requests changes after your approval.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PermButton perm="approvePlan" variant="primary" onClick={() => { setText(''); setDlg('approve') }}>
              Approve plan
            </PermButton>
            <PermButton perm="approvePlan" onClick={() => { setText(''); setErr(undefined); setDlg('changes') }}>
              Request changes
            </PermButton>
            <PermButton perm="approvePlan" variant="ghost" onClick={() => { setText(''); setErr(undefined); setDlg('decline') }}>
              Decline
            </PermButton>
          </div>
        </Card>
      )}
      <Dialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === 'approve' ? 'Approve these improvements?' : dlg === 'changes' ? 'Request changes' : 'Decline the suggestions?'}
        description={dlg === 'approve' ? 'You confirm the business facts and wording are correct. ProManage then coordinates the updates with each owner.' : dlg === 'changes' ? 'Tell ProManage what to change.' : 'Nothing will be changed. You can ask ProManage to look again later.'}
        footer={
          <>
            <Button onClick={() => setDlg(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (dlg !== 'approve' && !text.trim()) return setErr('Please add a short note.')
                if (dlg === 'approve') { approveDiscoveryPlan(opp.id, text.trim() || undefined); toast.success('Plan approved', { description: 'ProManage will coordinate the updates.' }) }
                if (dlg === 'changes') { requestDiscoveryPlanChanges(opp.id, text.trim()); toast.success('Changes requested') }
                if (dlg === 'decline') { declineDiscoveryPlan(opp.id, text.trim()); toast.success('Suggestions declined') }
                setDlg(null)
              }}
            >
              {dlg === 'approve' ? 'Approve' : dlg === 'changes' ? 'Send request' : 'Decline'}
            </Button>
          </>
        }
      >
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setErr(undefined) }} placeholder={dlg === 'approve' ? 'Optional comment' : dlg === 'changes' ? 'e.g. Please mention the toddler playgroup too.' : 'Reason'} aria-label="Comment" />
        <FieldError>{err}</FieldError>
      </Dialog>
    </>
  )
}

export default function BrandDiscoveryPage() {
  const { id = '' } = useParams()
  const { byId, observationsOf, eligibility, recheckFor, record } = useDiscovery()
  const { hasRelease } = useStore()
  const opp = byId[id]
  if (!opp) return <EmptyState icon={<Compass />} title="This item isn’t available" description="It may belong to an earlier check." action={<Button asChild><Link to="/attention">Needs My Attention</Link></Button>} />
  const loc = LOCATION_BY_ID[opp.locationId]
  const obs = observationsOf(opp)
  const missed = obs.filter((o) => !o.mentioned)
  const rc = recheckFor(opp)
  const ask = record(opp.id)?.confirmRequested
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/attention" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Needs My Attention
          </Link>
        }
        title={`${loc.name} — being found in AI search`}
        subtitle="Opportunity to improve how your centre is found"
        actions={<DiscoveryStageBadge opp={opp} recheck={rc} />}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {ask && opp.status !== 'awaiting_approval' && (
            <div className="rounded-xl border border-[#f1dcb2] bg-warning-soft px-5 py-3 text-[14px] text-ink">
              <span className="font-medium">ProManage asked you to confirm:</span> does {loc.name} offer a {ask.service}? Use the button next to the search below.
            </div>
          )}
          <Card>
            <CardHeader title="What we noticed" description={`Selected general searches about ${loc.neighborhood} · ${obs[0] ? fmtDate(obs[0].sampledAt) : ''} · demo AI search check`} />
            <ul className="divide-y divide-line">
              {obs.map((o) => (
                <QueryRow key={o.id} o={o} el={eligibility(o.locationId, o.promptId)} controls={['observed', 'eligibility_review', 'qualified', 'not_relevant'].includes(opp.status)} />
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <NotAnErrorNote />
            </div>
            <WhyItMatters />
          </Card>
          {missed[0] && <EvidenceDisclosure obs={missed.find((o) => opp.targetPromptIds.includes(o.promptId)) ?? missed[0]} title="See a recorded AI answer" />}
          <DecisionCard opp={opp} />
          {hasRelease('V1') && <PlanCard opp={opp} />}
        </div>
        <div className="space-y-4">
          {hasRelease('V1') && !['observed', 'eligibility_review', 'not_relevant'].includes(opp.status) && (
            <Card className="p-5">
              <p className="mb-3 text-[15px] font-semibold text-ink">Progress</p>
              <DiscoveryProgress opp={opp} />
            </Card>
          )}
          {rc && opp.status !== 'rechecked' && (
            <Card className="space-y-2 p-5">
              <p className="text-[15px] font-semibold text-ink">Latest follow-up AI check</p>
              <RecheckResult rc={rc} brand />
            </Card>
          )}
          <Card className="p-5">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Sparkles className="size-4 text-teal-ink" />
              About these checks
            </p>
            <p className="mt-1 text-[13.5px] text-body">One sampled answer for each selected question, in a demo AI search check. Sampled responses — not every customer’s AI search. This is separate from information accuracy: a centre can be described correctly and still not be mentioned.</p>
            <p className="mt-2 text-[12.5px] text-muted">Areas we look at: {Object.values(CATEGORY_LABEL).slice(0, 4).join(' · ')}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
