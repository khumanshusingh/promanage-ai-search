import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, ChevronDown, ClipboardList, Code2, ExternalLink, FileSearch, MapPin, RadioTower, RefreshCw, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { DiscoveryOpportunity, OptimizationRecommendation } from '@/data/types'
import { LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import { CATEGORY_LABEL, competitorsIn, DISCOVERY_STAGE, type FindingWithDraft } from '@/lib/discovery'
import { useDiscovery } from '@/lib/useDiscovery'
import { buildFacts } from '@/lib/facts'
import { useStore, taskStatusLabel } from '@/store/AppStore'
import { DiscoveryStageBadge, RecheckResult, RecommendationCard, RelevanceControls } from '@/components/discovery'
import { AnswerText, PageHeader, PermButton, SampleBadge, TaskStatusBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError, Label, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

const CERTAINTY: Record<FindingWithDraft['certainty'], { label: string; tone: 'danger' | 'warning' | 'success' | 'neutral' }> = {
  confirmed_gap: { label: 'Confirmed information gap', tone: 'danger' },
  potential_gap: { label: 'Potential gap', tone: 'warning' },
  no_gap: { label: 'No gap', tone: 'success' },
  unknown: { label: 'Couldn’t evaluate', tone: 'neutral' },
}

const OWNER: Record<FindingWithDraft['sourceOwner'], string> = { brand: 'Brand-controlled', promanage_managed: 'Managed in ProManage', third_party: 'Third party — request only', unknown: 'Uncontrolled / user-generated' }

/** Discoverability sub-tab of Investigations: one row per centre with sampled non-mentions. */
export function DiscoveryList() {
  const { latestAudit } = useStore()
  const { latest, metricsFor, eligibility, recheckFor } = useDiscovery()
  const navigate = useNavigate()
  const [status, setStatus] = useState('all')
  if (!latestAudit) return <EmptyState icon={<FileSearch />} title="Run an audit to see discovery opportunities" />
  const m = metricsFor(latestAudit.id)
  const rows = latest.filter((o) => status === 'all' || o.status === status)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 lg:grid-cols-4">
        {[
          ['Eligible outlet mention rate', `${m.eligibleMentioned} / ${m.eligible}`, 'Eligible unbranded observations naming the correct outlet'],
          ['Awaiting relevance review', String(m.awaitingReview), 'Not in eligible denominator until reviewed'],
          ['Not relevant', String(m.notRelevant), 'Excluded; evidence retained'],
          ['Brand-only mentions', String(m.brandOnly), 'Another BrightNest branch named — not this outlet'],
        ].map(([k, v, d]) => (
          <div key={k} className="rounded-lg border border-line bg-subtle px-3 py-2.5">
            <p className="text-[12.5px] font-medium text-body">{k}</p>
            <p className="tabular text-[20px] font-semibold text-ink">{v}</p>
            <p className="text-[11.5px] text-muted">{d}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-60" aria-label="Status">
          <option value="all">All statuses</option>
          {Object.entries(DISCOVERY_STAGE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.pmLabel}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-[12.5px] text-muted">
          {m.total} unbranded observations · {latestAudit.locationIds.length} centres · Surface A · non-mentions are observations, not errors
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<FileSearch />} title="No opportunities match" className="py-8" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Centre</Th>
              <Th>Not mentioned in</Th>
              <Th>Eligibility</Th>
              <Th>Intent</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const el = o.missedPromptIds.map((p) => eligibility(o.locationId, p).status)
              return (
                <Tr key={o.id} onClick={() => navigate(`/discovery/${o.id}`)}>
                  <Td className="whitespace-nowrap font-medium text-ink">{LOCATION_BY_ID[o.locationId].name}</Td>
                  <Td className="tabular whitespace-nowrap text-[13.5px]">
                    {o.missedPromptIds.length} of {o.observationIds.length} unbranded
                  </Td>
                  <Td className="text-[12.5px] text-body">
                    {el.filter((x) => x === 'eligible').length} eligible · {el.filter((x) => x === 'unknown').length} unknown · {el.filter((x) => x === 'not_relevant').length} not relevant
                  </Td>
                  <Td className="text-[13px] text-body">{o.intentCategory}</Td>
                  <Td>
                    <DiscoveryStageBadge opp={o} recheck={recheckFor(o)} pm />
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </>
  )
}

/** Monitoring: matched before/after per discovery opportunity — same centre, prompts, surface and rules, or Inconclusive. */
export function DiscoveryCohortPanel({ auditId }: { auditId: string }) {
  const { opportunities, recheckFor, record, tasksFor } = useDiscovery()
  const navigate = useNavigate()
  const rows = opportunities.filter((o) => o.auditId === auditId && (record(o.id)?.plan?.status === 'approved' || o.status === 'no_gap'))
  return (
    <Card className="mt-4">
      <CardHeader title="Discovery cohort · matched rechecks" description="Opportunities with approved improvements or monitor-only status · eligible unbranded prompts per centre · Surface A" />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-[13.5px] text-body">No discovery opportunities are being tracked yet. They appear here once a plan is approved or a query is set to monitor only.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Centre</Th>
              <Th>Intent</Th>
              <Th>Source updates</Th>
              <Th>Baseline → latest</Th>
              <Th>Outcome</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const rc = recheckFor(o)
              const t = tasksFor(o)
              return (
                <Tr key={o.id} onClick={() => navigate(`/discovery/${o.id}`)}>
                  <Td className="whitespace-nowrap font-medium text-ink">{LOCATION_BY_ID[o.locationId].name}</Td>
                  <Td className="text-[13px] text-body">{o.intentCategory}</Td>
                  <Td className="text-[13px] text-body">{o.status === 'no_gap' ? 'Monitor only' : `${t.filter((x) => ['awaiting_recheck', 'closed', 'source_updated'].includes(x.status)).length}/${t.length} recorded`}</Td>
                  <Td className="tabular whitespace-nowrap text-[13px]">{rc ? (rc.comparable ? `${rc.baselineMentionCount}/${rc.baselineEligibleCount} → ${rc.recheckMentionCount}/${rc.recheckEligibleCount}` : 'Not comparable') : 'No recheck'}</Td>
                  <Td>{rc ? <Badge tone={rc.outcome === 'mention_observed' ? 'success' : rc.outcome === 'inconclusive' ? 'warning' : 'neutral'}>{rc.outcome.replace('_', ' ')}{rc.afterUpdates ? '' : ' · before updates'}</Badge> : <span className="text-[12.5px] text-muted">—</span>}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">One sampled answer per prompt, so N is small. Observed changes are not causal attribution; accuracy outcomes are tracked separately.</p>
    </Card>
  )
}

/** Internal report: separate denominators for discovery — never merged with accuracy metrics. */
export function DiscoveryReportBody({ auditId }: { auditId: string }) {
  const { latest, metricsFor, recheckFor, findingsFor, record, tasksFor } = useDiscovery()
  const m = metricsFor(auditId)
  const mine = latest.filter((o) => o.auditId === auditId)
  const confirmed = mine.reduce((n, o) => n + findingsFor(o).filter((f) => record(o.id)?.investigation?.findingReviews[f.id] === 'confirmed').length, 0)
  const approvedRecs = mine.flatMap((o) => (record(o.id)?.plan?.status === 'approved' ? record(o.id)!.plan!.recommendations.map((r) => ({ o, r })) : []))
  const implemented = approvedRecs.filter(({ o, r }) => tasksFor(o).some((t) => t.recommendationId === r.id && ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status))).length
  const rcs = mine.map((o) => recheckFor(o)).filter((x): x is NonNullable<typeof x> => !!x && !!record(x.opportunityId)?.plan)
  return (
    <div className="space-y-2 text-[13px] text-body">
      <p>
        Eligible unbranded outlet mention rate: <span className="font-semibold text-ink">{m.eligibleMentioned}/{m.eligible}</span> (correct outlet only; {m.brandOnly} brand-only mentions excluded). {m.awaitingReview} observations awaiting relevance review, {m.notRelevant} not relevant (excluded, evidence retained). Raw: {m.mentioned}/{m.total}.
      </p>
      <p>
        Discovery opportunities qualified: <span className="font-semibold text-ink">{mine.filter((o) => !['observed', 'eligibility_review', 'not_relevant', 'archived'].includes(o.status)).length}</span> of {mine.length} centres with non-mentions · confirmed controllable gaps: <span className="font-semibold text-ink">{confirmed}</span> · approved recommendations implemented: <span className="font-semibold text-ink">{implemented}/{approvedRecs.length}</span> (not an AI success metric) · monitor-only: {mine.filter((o) => o.status === 'no_gap').length}.
      </p>
      {rcs.length > 0 && (
        <ul className="list-disc pl-5">
          {rcs.map((rc) => (
            <li key={rc.id}>
              {LOCATION_BY_ID[rc.locationId].name} · follow-up {rc.recheckWave}: {rc.comparable ? `${rc.baselineMentionCount}/${rc.baselineEligibleCount} → ${rc.recheckMentionCount}/${rc.recheckEligibleCount} (${rc.outcome.replace('_', ' ')})` : `inconclusive — ${rc.nonComparabilityReason}`}
              {rc.afterUpdates ? '' : ' · sampled before updates were recorded'}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12.5px] text-muted">No ranking score, market share, real-user visibility or sales attribution is estimated. Cause of each original non-mention remains unknown.</p>
    </div>
  )
}

function Composer({ opp, findings, onDone }: { opp: DiscoveryOpportunity; findings: FindingWithDraft[]; onDone: () => void }) {
  const { saveDiscoveryPlan, factEdits } = useStore()
  const { record } = useDiscovery()
  const rec = record(opp.id)
  const existing = rec?.plan && rec.plan.status !== 'declined' ? rec.plan : undefined
  const reviews = rec?.investigation?.findingReviews ?? {}
  const confirmed = findings.filter((f) => reviews[f.id] === 'confirmed' && f.draft)
  const [items, setItems] = useState<OptimizationRecommendation[]>([])
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState('')
  const [err, setErr] = useState<string>()
  const loc = LOCATION_BY_ID[opp.locationId]
  useEffect(() => {
    const prev = new Map(existing?.recommendations.map((r) => [r.id, r]))
    setItems(confirmed.map((f) => prev.get(f.draft!.id) ?? f.draft!))
    setIncluded(new Set(confirmed.map((f) => f.draft!.id).filter((id) => !prev.size || prev.has(id))))
    setSummary(existing?.summary ?? `${loc.name} wasn’t mentioned in ${opp.targetPromptIds.length} relevant sampled search${opp.targetPromptIds.length === 1 ? '' : 'es'} (${opp.intentCategory}). We found specific, verifiable information gaps on sources BrightNest controls. These updates make accurate information easier to find; they can’t guarantee any AI answer changes.`)
    setErr(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.id, rec?.plan?.updatedAt, confirmed.length])

  const facts = buildFacts(opp.locationId, factEdits)
  const send = (asDraft: boolean) => {
    const chosen = items.filter((i) => included.has(i.id))
    if (!chosen.length) return setErr('Include at least one evidence-backed recommendation.')
    const unverified = chosen.flatMap((i) => i.businessFactIds).filter((id) => facts.find((f) => f.id === id)?.verificationStatus !== 'verified')
    if (!asDraft && unverified.length) return setErr(`Every business claim must be a verified fact before sending. Ask the Brand to confirm: ${[...new Set(unverified)].join(', ')}`)
    if (chosen.some((i) => i.channel !== 'structured_info' && i.proposedText !== undefined && !i.proposedText.trim())) return setErr('Proposed text can’t be empty.')
    if (summary.trim().length < 20) return setErr('Add a short plain-language summary for the Brand.')
    saveDiscoveryPlan(opp.id, { summary: summary.trim(), recommendations: chosen }, !asDraft)
    toast.success(asDraft ? 'Plan saved as draft' : 'Sent to Brand for approval', { description: asDraft ? undefined : 'The Brand approves every business claim before anything is published.' })
    onDone()
  }

  return (
    <Card>
      <CardHeader title="Recommendation composer" description="Only confirmed, controllable gaps · generated copy is editable · every claim must be a verified business fact" />
      <div className="space-y-4 px-5 py-4">
        {rec?.plan?.status === 'changes_requested' && <p className="rounded-lg border border-[#f1dcb2] bg-warning-soft px-3 py-2 text-[13px] text-ink">Brand asked: “{rec.plan.comments.filter((c) => c.kind === 'changes').pop()?.text}”</p>}
        {items.length === 0 && <p className="text-[13.5px] text-body">Confirm at least one gap in the readiness checks to compose recommendations.</p>}
        {items.map((it, idx) => (
          <div key={it.id} className={cn('rounded-xl border px-4 py-3', included.has(it.id) ? 'border-brand-line' : 'border-line opacity-70')}>
            <label className="flex items-start gap-2.5">
              <Checkbox checked={included.has(it.id)} onCheckedChange={(v) => setIncluded((cur) => { const n = new Set(cur); if (v) n.add(it.id); else n.delete(it.id); return n })} aria-label={`Include ${it.title}`} />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{it.title}</span>
                <span className="block text-[12.5px] text-muted">
                  {it.controlledSource} · {it.gapConfidence} · AI impact uncertain
                </span>
              </span>
            </label>
            {included.has(it.id) && (
              <div className="mt-3 space-y-3 pl-7">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`own-${it.id}`}>Owner</Label>
                    <Select id={`own-${it.id}`} value={it.owner} onChange={(e) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, owner: e.target.value } : x)))}>
                      {['BrightNest website team', 'ProManage', 'Regional operations'].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`eff-${it.id}`}>Effort</Label>
                    <Select id={`eff-${it.id}`} value={it.effort} onChange={(e) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, effort: e.target.value as OptimizationRecommendation['effort'] } : x)))}>
                      {['Small', 'Medium', 'Large'].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                {it.channel === 'structured_info' ? (
                  <p className="flex items-center gap-2 text-[13px] text-body">
                    <Code2 className="size-4 text-muted" />
                    JSON-LD comes from GEO Readiness (verified facts only).{' '}
                    <Link className="font-medium text-brand hover:underline" to={`/geo-readiness/${opp.locationId}?tab=jsonld`}>
                      Preview
                    </Link>
                  </p>
                ) : it.proposedText !== undefined ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[12.5px] font-medium text-body">Current (simulated snapshot)</p>
                      <p className="whitespace-pre-line rounded-lg border border-line bg-subtle px-3 py-2 text-[13px] text-body">{it.currentText ?? 'Not stated'}</p>
                    </div>
                    <div>
                      <Label htmlFor={`txt-${it.id}`} hint="Editable · length is flexible">
                        Proposed
                      </Label>
                      <Textarea id={`txt-${it.id}`} value={it.proposedText} onChange={(e) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, proposedText: e.target.value } : x)))} className="min-h-[120px] text-[13px]" />
                    </div>
                  </div>
                ) : null}
                {it.businessFactIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {it.businessFactIds.map((id) => {
                      const f = facts.find((x) => x.id === id)
                      return (
                        <Badge key={id} tone={f?.verificationStatus === 'verified' ? 'outline' : 'warning'}>
                          {f?.label}: {f?.verificationStatus === 'verified' ? 'verified' : 'not verified'}
                        </Badge>
                      )
                    })}
                  </div>
                )}
                {it.dependency && <p className="text-[12.5px] text-warning">{it.dependency}</p>}
              </div>
            )}
          </div>
        ))}
        <div>
          <Label htmlFor="plan-summary">Plain-language summary for the Brand</Label>
          <Textarea id="plan-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-[70px]" />
        </div>
        <p className="text-[12.5px] text-muted">Never invent services, prices, reviews, statistics or citations. A 40–60 word opening is an optional editorial test, not a rule.</p>
        <FieldError>{err}</FieldError>
        <div className="flex flex-wrap justify-end gap-2">
          <PermButton perm="draftPlan" onClick={() => send(true)}>
            Save draft
          </PermButton>
          <PermButton perm="draftPlan" variant="primary" onClick={() => send(false)}>
            <Send />
            Send to Brand for approval
          </PermButton>
        </div>
      </div>
    </Card>
  )
}

export default function DiscoveryInvestigationPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const { hasRelease, runReadinessCheck, reviewFinding, markNoControllableGap, startDiscoveryInvestigation, requestServiceConfirmation, reopenDiscovery, archiveDiscovery, runRecheck, setDiscoveryDecision, can } = store
  const { byId, observationsOf, eligibility, findingsFor, tasksFor, recheckFor, record } = useDiscovery()
  const opp = byId[id]
  const [openObs, setOpenObs] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [noGap, setNoGap] = useState(false)
  const [note, setNote] = useState('')
  const findings = useMemo(() => (opp ? findingsFor(opp) : []), [opp, findingsFor])
  if (!opp) return <EmptyState icon={<FileSearch />} title="Discovery opportunity not found" action={<Button asChild><Link to="/issues?tab=discovery">All opportunities</Link></Button>} />
  const loc = LOCATION_BY_ID[opp.locationId]
  const rec = record(opp.id)
  const inv = rec?.investigation
  const obs = observationsOf(opp)
  const reviews = inv?.findingReviews ?? {}
  const confirmedCount = findings.filter((f) => reviews[f.id] === 'confirmed').length
  const plan = rec?.plan
  const tasks = tasksFor(opp)
  const rc = recheckFor(opp)
  const later = rc ? observationsOf(opp, rc.recheckWave) : []
  const missedComps = [...new Set(obs.filter((o) => !o.mentioned).flatMap(competitorsIn))]
  const canCompose = !plan || plan.status === 'draft' || plan.status === 'changes_requested' || plan.status === 'declined'
  const showComposer = hasRelease('V1') && inv?.checkedAt && confirmedCount > 0 && canCompose && (composing || plan?.status === 'draft' || plan?.status === 'changes_requested')

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/issues?tab=discovery" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Investigations · Discoverability
          </Link>
        }
        title={`${loc.name} · discoverability`}
        subtitle={`Discovery opportunity · ${opp.intentCategory}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DiscoveryStageBadge opp={opp} recheck={rc} pm />
            {hasRelease('V1') && (
              <>
                <Button size="sm" asChild>
                  <Link to={`/geo-readiness/${opp.locationId}?tab=content`}>
                    <Sparkles />
                    GEO Readiness
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to={`/listings/${opp.locationId}`}>
                    <MapPin />
                    Listing
                  </Link>
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Observed AI result', `${obs.filter((o) => !o.mentioned).length} of ${obs.length} not mentioned`, 'Sampled unbranded answers'],
              ['Eligibility', `${opp.targetPromptIds.filter((p) => eligibility(opp.locationId, p).status === 'eligible').length} eligible · ${opp.targetPromptIds.filter((p) => eligibility(opp.locationId, p).status === 'unknown').length} unknown`, 'Of the missed questions'],
              ['Verified gap', !inv?.checkedAt ? 'Not checked' : `${confirmedCount} confirmed`, 'Readiness findings with evidence'],
              ['Cause of non-mention', 'Unknown', 'No direct evidence links a gap to the answer'],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
                <p className="text-[12.5px] font-medium text-body">{k}</p>
                <p className="mt-1 text-[15px] font-semibold text-ink">{v}</p>
                <p className="text-[11.5px] text-muted">{d}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader title="Observed AI results & eligibility" description={`Unbranded questions · ${obs[0] ? fmtDateTime(obs[0].sampledAt) : ''} · AI search · Surface A · simulated`} />
            <ul className="divide-y divide-line">
              {obs.map((o) => {
                const el = eligibility(o.locationId, o.promptId)
                const candidate = el.candidate
                return (
                  <li key={o.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] text-ink">“{o.query}”</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                          <Badge tone={o.mentioned ? 'teal' : o.mentionedBrand ? 'blue' : 'neutral'}>{o.mentioned ? 'Mentioned' : o.mentionedBrand ? 'Brand-only mention' : 'Not mentioned'}</Badge>
                          <Badge tone={el.status === 'eligible' ? 'success' : el.status === 'not_relevant' ? 'neutral' : 'warning'}>{el.status === 'eligible' ? 'Eligible' : el.status === 'not_relevant' ? 'Not relevant' : 'Eligibility unknown'}</Badge>
                          <span className="text-muted">
                            {el.basis} · {el.reviewer}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setOpenObs(openObs === o.id ? null : o.id)} aria-expanded={openObs === o.id}>
                        Raw answer
                        <ChevronDown className={cn('transition-transform', openObs === o.id && 'rotate-180')} />
                      </Button>
                    </div>
                    {!o.mentioned && ['observed', 'eligibility_review', 'qualified', 'not_relevant', 'investigating'].includes(opp.status) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RelevanceControls locationId={o.locationId} promptId={o.promptId} el={el} compact />
                        {candidate && el.status === 'unknown' && (
                          <PermButton perm="requestVerification" size="sm" onClick={() => { requestServiceConfirmation(opp.id, candidate.service); toast.success('Asked the Brand to confirm', { description: `${candidate.service} — ProManage can’t approve business facts.` }) }} disabled={!!rec?.confirmRequested}>
                            {rec?.confirmRequested ? 'Brand confirmation requested' : `Ask Brand to confirm ${candidate.service.replace(/ \(.*\)/, '')}`}
                          </PermButton>
                        )}
                      </div>
                    )}
                    {openObs === o.id && (
                      <div className="mt-3 rounded-lg border border-line bg-subtle px-4 py-3">
                        <div className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
                          <SampleBadge /> {fmtDateTime(o.sampledAt)} · original evidence (never rewritten)
                        </div>
                        <AnswerText text={o.answerText} claims={o.extractedClaims} brandName={`BrightNest Preschool – ${loc.neighborhood}`} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {missedComps.length > 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-body">Named in the answers that missed this centre: {missedComps.join(', ')}. Context for investigating content differences — not causal proof or market share.</p>}
          </Card>

          {!hasRelease('V1') ? (
            <Card className="p-5 text-[14px] text-body">
              <p className="font-semibold text-ink">MVP scope</p>
              Readiness checks, improvement plans and implementation arrive in V1. In MVP, mark relevance and whether the opportunity is worth investigating.
              <div className="mt-3 flex gap-2">
                <PermButton perm="qualifyDiscovery" variant="primary" disabled={opp.eligibility !== 'eligible' || rec?.decision?.kind === 'worth_investigating'} onClick={() => { setDiscoveryDecision(opp.id, 'worth_investigating'); toast.success('Saved as worth investigating') }}>
                  {rec?.decision?.kind === 'worth_investigating' ? 'Saved as worth investigating' : 'Worth investigating'}
                </PermButton>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Discoverability readiness checks"
                description={inv?.checkedAt ? `Seeded source snapshots captured 14 Oct 2026 · reviewed ${fmtDateTime(inv.checkedAt)} · simulated` : 'Official page, connected listing, structured data, freshness and off-site sources — simulated snapshots'}
                actions={
                  !inv?.checkedAt ? (
                    <PermButton perm="investigate" variant="primary" disabled={opp.status === 'not_relevant'} onClick={() => { if (!inv) startDiscoveryInvestigation(opp.id); runReadinessCheck(opp.id); toast.success('Readiness check complete', { description: 'Review each finding before composing a plan.' }) }}>
                      <ShieldCheck />
                      Run readiness check
                    </PermButton>
                  ) : undefined
                }
              />
              {!inv?.checkedAt ? (
                <p className="px-5 py-4 text-[13.5px] text-body">{opp.status === 'not_relevant' ? 'All missed questions are marked not relevant — nothing to investigate.' : 'Run the check to inspect the sources BrightNest can see. A gap is evidence about the source, never proof it caused the AI omission.'}</p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {findings.map((f) => {
                      const v = reviews[f.id]
                      const reviewable = f.certainty === 'confirmed_gap' || f.certainty === 'potential_gap'
                      return (
                        <li key={f.id} className="px-5 py-3.5">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-semibold text-ink">{CATEGORY_LABEL[f.category]}</p>
                                <Badge tone={CERTAINTY[f.certainty].tone}>{CERTAINTY[f.certainty].label}</Badge>
                                {f.needsSiteOwner && <Badge tone="warning">Needs site-owner confirmation</Badge>}
                                {f.linkedAccuracyField && <Badge tone="outline">Linked accuracy item · {f.linkedAccuracyField}</Badge>}
                              </div>
                              <p className="mt-0.5 text-[12.5px] text-muted">
                                {f.surfaceLabel} · {OWNER[f.sourceOwner]} · {f.evidenceType.replace(/_/g, ' ')}
                                {f.url && (
                                  <>
                                    {' · '}
                                    <span className="inline-flex items-center gap-0.5">
                                      {f.url.replace('https://', '')}
                                      <ExternalLink className="size-3" />
                                    </span>
                                  </>
                                )}
                              </p>
                              <p className="mt-1 text-[13.5px] text-ink">{f.observation}</p>
                              {f.snapshot && <p className="mt-1 rounded-md bg-subtle px-2.5 py-1.5 font-mono text-[12px] text-body">{f.snapshot}</p>}
                              {f.blockedReason && <p className="mt-1 text-[12.5px] text-warning">{f.blockedReason}</p>}
                            </div>
                            {reviewable && (
                              <div className="flex shrink-0 gap-1.5">
                                <PermButton perm="investigate" size="sm" variant={v === 'confirmed' ? 'primary' : 'secondary'} disabled={!!f.blockedReason || !f.draft || !canCompose} onClick={() => reviewFinding(opp.id, f.id, v === 'confirmed' ? null : 'confirmed')} title={!f.draft ? 'No controllable action for this finding' : undefined}>
                                  {v === 'confirmed' ? 'Gap confirmed' : 'Confirm gap'}
                                </PermButton>
                                <PermButton perm="investigate" size="sm" variant={v === 'not_gap' ? 'primary' : 'ghost'} disabled={!canCompose} onClick={() => reviewFinding(opp.id, f.id, v === 'not_gap' ? null : 'not_gap')}>
                                  Not a gap
                                </PermButton>
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {canCompose && opp.status !== 'no_gap' && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
                      <span className="mr-auto text-[12.5px] text-muted">Cause of the original non-mention stays “unknown” either way.</span>
                      <PermButton perm="investigate" disabled={confirmedCount > 0} onClick={() => setNoGap(true)}>
                        No controllable gap — monitor only
                      </PermButton>
                      <PermButton perm="draftPlan" variant="primary" disabled={confirmedCount === 0} onClick={() => setComposing(true)}>
                        <ClipboardList />
                        Prepare improvement plan
                      </PermButton>
                    </div>
                  )}
                  {opp.status === 'no_gap' && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-[13px] text-body">
                      No controllable information gap found — monitoring this query. {rec?.monitorOnly?.note}
                      <PermButton perm="investigate" size="sm" className="ml-auto" onClick={() => { reopenDiscovery(opp.id, 'Re-inspect sources'); toast.success('New investigation round started') }}>
                        Re-inspect sources
                      </PermButton>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {showComposer && <Composer opp={opp} findings={findings} onDone={() => setComposing(false)} />}

          {hasRelease('V1') && plan && plan.status !== 'draft' && !(showComposer && plan.status === 'changes_requested') && (
            <Card>
              <CardHeader
                title={`Improvement plan · round ${plan.round}`}
                description={plan.status === 'approved' ? `Approved by ${plan.brandApprovalBy} (Brand) · ${fmtDateTime(plan.brandApprovalAt!)}` : plan.status === 'awaiting_brand_approval' ? 'Waiting for Brand approval — ProManage cannot approve business facts' : plan.status === 'declined' ? 'Declined by Brand — nothing will be implemented' : 'Changes requested by Brand'}
                actions={plan.status === 'declined' ? <PermButton perm="draftPlan" size="sm" onClick={() => setComposing(true)}>Compose a new plan</PermButton> : undefined}
              />
              <div className="space-y-3 px-5 py-4">
                <p className="text-[13.5px] text-ink">{plan.summary}</p>
                {plan.recommendations.map((r) => (
                  <RecommendationCard key={r.id} rec={r} locationId={opp.locationId} published={tasks.some((t) => t.recommendationId === r.id && ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status))} />
                ))}
                {plan.comments.length > 0 && (
                  <ul className="space-y-1 text-[12.5px] text-body">
                    {plan.comments.map((c, i) => (
                      <li key={i}>
                        {fmtDateTime(c.at)} · {c.by === 'brand' ? 'Brand' : 'ProManage'} · {c.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {tasks.length > 0 && (
                <div className="border-t border-line">
                  <p className="px-5 pt-3 text-[13px] font-semibold text-ink">Implementation handoff (existing task workflow)</p>
                  <ul className="divide-y divide-line">
                    {tasks.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-ink">{t.title}</p>
                          <p className="text-[12px] text-muted">
                            {t.id} · {PEOPLE.find((p) => p.id === t.assigneeId)?.name} · {taskStatusLabel(t.status, t.channel)}
                          </p>
                        </div>
                        <TaskStatusBadge status={t.status} channel={t.channel} />
                        <Button size="sm" onClick={() => navigate(`/tasks/${t.id}`)}>
                          Open task
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {hasRelease('V2') && plan?.status === 'approved' && (
            <Card>
              <CardHeader title="Matched discovery recheck" description="Same centre · same normalized unbranded prompts · Surface A · en-IN · evaluation rules v1" />
              <div className="space-y-3 px-5 py-4">
                {rc ? (
                  <>
                    <RecheckResult rc={rc} />
                    {rc.comparable && (
                      <Table>
                        <thead>
                          <tr>
                            <Th>Eligible question</Th>
                            <Th>Baseline</Th>
                            <Th>Follow-up {rc.recheckWave}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {obs
                            .filter((o) => eligibility(o.locationId, o.promptId).status === 'eligible')
                            .map((o) => {
                              const l = later.find((x) => x.promptId === o.promptId)
                              return (
                                <tr key={o.id} className="border-b border-line last:border-0">
                                  <Td className="text-[13px]">“{o.query}”</Td>
                                  <Td>
                                    <Badge tone={o.mentioned ? 'teal' : 'neutral'}>{o.mentioned ? 'Mentioned' : 'Not mentioned'}</Badge>
                                  </Td>
                                  <Td>
                                    <Badge tone={l?.mentioned ? 'teal' : 'neutral'}>{l?.mentioned ? 'Mentioned' : 'Not mentioned'}</Badge>
                                  </Td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </Table>
                    )}
                    {(rc.outcome === 'still_absent' || rc.outcome === 'mixed') && (
                      <div className="flex flex-wrap gap-2">
                        <PermButton perm="investigate" onClick={() => { reopenDiscovery(opp.id, `Follow-up ${rc.recheckWave}: ${rc.outcome.replace('_', ' ')}`); toast.success('New investigation round started', { description: 'Any new plan needs separate Brand approval.' }) }}>
                          <RefreshCw />
                          Start new investigation round
                        </PermButton>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[13.5px] text-body">No follow-up yet. Rechecks reuse the original cohort so before/after counts are comparable.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <PermButton perm="runRecheck" onClick={() => { const r = runRecheck(opp.auditId); toast.success(`Follow-up ${r.wave} sampled`, { description: 'Original observations are unchanged.' }) }}>
                    <RadioTower />
                    Run follow-up check
                  </PermButton>
                  <Button variant="ghost" asChild>
                    <Link to="/monitoring">Open Monitoring</Link>
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[15px] font-semibold text-ink">Status</p>
            <p className="mt-1 text-[13.5px] text-body">{DISCOVERY_STAGE[opp.status].pmLabel}. Business facts and the plan are approved only by the Brand.</p>
            {opp.status === 'awaiting_approval' && <p className="mt-2 text-[13px] text-warning">Waiting on the Brand. Nothing can be implemented until the plan is approved.</p>}
          </Card>
          <Card>
            <CardHeader title="History" />
            {rec?.history.length ? (
              <ol className="space-y-2.5 px-5 py-4">
                {[...rec.history].reverse().map((h, i) => (
                  <li key={i} className="text-[13px]">
                    <p className="text-ink">{h.text}</p>
                    <p className="text-[11.5px] text-muted">
                      {h.by} · {fmtDateTime(h.at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-4 text-[13px] text-body">No decisions yet.</p>
            )}
          </Card>
          {can('investigate') && opp.status !== 'archived' && (
            <Button variant="ghost" onClick={() => { archiveDiscovery(opp.id); toast.success('Archived') }}>
              <Archive />
              Archive opportunity
            </Button>
          )}
          <p className="px-1 text-[12px] text-muted">Checked {fmtDate(opp.createdAt)} · fictional BrightNest data · all snapshots, updates and AI answers are simulated.</p>
        </div>
      </div>

      <Dialog
        open={noGap}
        onOpenChange={setNoGap}
        title="No controllable information gap?"
        description="Records an honest no-op: the sources we inspected look complete. The query stays monitored; no work is created."
        footer={
          <>
            <Button onClick={() => setNoGap(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { markNoControllableGap(opp.id, note.trim() || undefined); setNoGap(false); setNote(''); toast.success('Marked monitor only') }}>
              Monitor this query
            </Button>
          </>
        }
      >
        <Label htmlFor="ng-note" hint="Optional">
          Note
        </Label>
        <Textarea id="ng-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Page, listing and structured data complete and consistent." />
      </Dialog>
    </div>
  )
}
