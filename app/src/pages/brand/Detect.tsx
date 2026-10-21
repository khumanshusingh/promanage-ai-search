import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Compass, FileText, Loader2, MapPin, PlayCircle, ScanSearch, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { LOCATION_BY_ID, PILOT_IDS, fillPrompt } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { useBrandViews, type BrandView } from '@/lib/brandStatus'
import { useDiscovery } from '@/lib/useDiscovery'
import { discoveryId } from '@/lib/discovery'
import { runSimulatedAudit } from '@/services/mockAuditService'
import { EvidenceDisclosure, FactComparison, StageBadge } from '@/components/brand'
import { NotAnErrorNote, RelevanceControls } from '@/components/discovery'
import { FocusOnQuestion } from '@/components/goals'
import { PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

const STANDARD_PROMPTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

function SuggestedQuestions() {
  const { promptsById } = useStore()
  const example = LOCATION_BY_ID.whitefield
  const group = (ids: string[]) => ids.map((id) => promptsById[id]).filter(Boolean)
  return (
    <Card>
      <CardHeader title="Questions parents may ask" description="Suggested by ProManage for preschools in your locations — curated examples, not search-volume data. Shown here for Whitefield; each is asked for every selected centre." />
      <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
        {[
          { title: 'Being found (Discoverability)', note: 'General questions that don’t name BrightNest — are your centres recommended?', ids: ['p1', 'p2', 'p3', 'p4', 'p5'], tone: 'teal' as const },
          { title: 'Information accuracy', note: 'Questions about your centres — are the facts right?', ids: ['p6', 'p7', 'p8'], tone: 'blue' as const },
        ].map((g) => (
          <div key={g.title} className="rounded-xl border border-line bg-subtle p-4">
            <div className="flex items-center gap-2">
              <Badge tone={g.tone}>{g.title}</Badge>
              <span className="text-[12px] text-muted">{g.ids.length} questions</span>
            </div>
            <p className="mt-1.5 text-[13px] text-body">{g.note}</p>
            <ul className="mt-2 space-y-1.5">
              {group(g.ids).map((p) => (
                <li key={p.id} className="text-[14px] text-ink">
                  “{fillPrompt(p.text, example)}{p.text.endsWith('?') ? '' : '?'}”
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

function LocationPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Card id="locations" className="scroll-mt-24">
      <CardHeader
        title="Choose locations to check"
        description={`${selected.length} of 150 centres selected · pilot of ${PILOT_IDS.length}`}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onChange(PILOT_IDS)}>
              Select pilot
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
        {PILOT_IDS.map((id) => (
          <label key={id} className="flex items-center gap-2 text-[14px] text-ink">
            <Checkbox checked={selected.includes(id)} onCheckedChange={(v) => onChange(v ? [...selected, id] : selected.filter((x) => x !== id))} aria-label={LOCATION_BY_ID[id].name} />
            {LOCATION_BY_ID[id].neighborhood}
          </label>
        ))}
      </div>
    </Card>
  )
}

function AccuracyRow({ v }: { v: BrandView }) {
  const { observationsFor, hasRelease } = useStore()
  const navigate = useNavigate()
  const obs = observationsFor(v.issue.auditId).find((o) => o.id === v.issue.observationId)
  const claim = obs?.extractedClaims.find((c) => c.id === v.issue.claimId)
  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">“{obs?.query}”</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="blue">Accuracy finding</Badge>
            <StageBadge stage={v.stage} />
          </div>
        </div>
        <Button size="sm" variant={hasRelease('V1') ? 'primary' : 'secondary'} onClick={() => navigate(hasRelease('V1') ? `/improve#acc:${v.issue.id}` : `/attention/${v.issue.id}`)}>
          {hasRelease('V1') ? 'See suggested improvement' : 'Review finding'}
          <ArrowRight />
        </Button>
      </div>
      {claim && v.issue.field && <FactComparison ai={claim.value} record={v.fact?.verificationStatus === 'verified' ? v.fact.value : 'Not confirmed yet — verify your information'} recordNote={v.fact?.verifiedBy ? `Verified by ${v.fact.verifiedBy}` : undefined} />}
      {obs && <EvidenceDisclosure obs={obs} title="View original AI answer" />}
    </li>
  )
}

function LocationFindings({ locationId, auditId, defaultOpen }: { locationId: string; auditId: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { hasRelease } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[locationId]
  const opp = disc.byId[discoveryId(auditId, locationId)]
  const obs = disc.observationsOf({ auditId, locationId })
  const eligibleObs = obs.filter((o) => disc.eligibility(locationId, o.promptId).status === 'eligible')
  const missed = obs.filter((o) => !o.mentioned && disc.eligibility(locationId, o.promptId).status !== 'not_relevant')
  const acc = views.filter((v) => v.issue.locationId === locationId && v.issue.auditId === auditId && v.stage !== 'not_an_issue')
  const missedEligible = missed.filter((o) => disc.eligibility(locationId, o.promptId).status === 'eligible').length
  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-subtle">
        <MapPin className="size-4 text-muted" />
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{loc.name}</span>
        <Badge tone={missedEligible ? 'teal' : 'neutral'}>{missedEligible} discovery {missedEligible === 1 ? 'opportunity' : 'opportunities'}</Badge>
        {missed.length > missedEligible && <Badge tone="warning">{missed.length - missedEligible} to confirm</Badge>}
        <Badge tone={acc.length ? 'blue' : 'neutral'}>{acc.length} accuracy {acc.length === 1 ? 'finding' : 'findings'}</Badge>
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-line bg-canvas/40 px-4 py-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Being found (Discoverability)" description={`Mentioned in ${eligibleObs.filter((o) => o.mentioned).length} of ${eligibleObs.length} eligible sampled recommendations`} />
            {missed.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-body">Mentioned in every relevant sampled recommendation.</p>
            ) : (
              <ul className="divide-y divide-line">
                {missed.map((o) => {
                  const el = disc.eligibility(locationId, o.promptId)
                  return (
                    <li key={o.id} className="space-y-2 px-5 py-3.5">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-ink">“{o.query}”</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge tone="teal">Discovery opportunity</Badge>
                            <span className="text-[13px] text-body">Not mentioned in sampled recommendations</span>
                          </div>
                          {el.status === 'unknown' && <p className="mt-1 text-[12.5px] text-warning">Needs confirmation: {el.basis}</p>}
                        </div>
                        {opp && el.status === 'eligible' && (
                          <Button size="sm" variant={hasRelease('V1') ? 'primary' : 'secondary'} onClick={() => navigate(hasRelease('V1') ? `/improve#disc:${opp.id}` : `/attention/discovery/${opp.id}`)}>
                            {hasRelease('V1') ? 'See suggested improvement' : 'Review finding'}
                            <ArrowRight />
                          </Button>
                        )}
                      </div>
                      {el.status === 'unknown' && <RelevanceControls locationId={locationId} promptId={o.promptId} el={el} />}
                      <EvidenceDisclosure obs={o} title="View original AI answer" />
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-line px-5 py-3">
              <NotAnErrorNote />
            </div>
          </Card>
          <Card>
            <CardHeader title="Information accuracy" description="Facts in answers about this centre, checked against your verified record" />
            {acc.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-4 text-[14px] text-success">
                <ShieldCheck className="size-4" />
                No incorrect information found in the checkable claims.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {acc.map((v) => (
                  <AccuracyRow key={v.issue.id} v={v} />
                ))}
              </ul>
            )}
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">An answer without checkable facts isn’t proof that information is correct.</p>
          </Card>
        </div>
      )}
    </li>
  )
}

function Results() {
  const { latestAudit, observationsFor, promptsById, goals, selectedGoalId, selectGoal } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  const audit = latestAudit!
  const obs = observationsFor(audit.id)
  const m = disc.metricsFor(audit.id)
  const acc = views.filter((v) => v.issue.auditId === audit.id && v.stage !== 'not_an_issue')
  const goal = goals.find((g) => g.id === selectedGoalId)
  const accClaims = obs.filter((o) => !promptsById[o.promptId]?.includeInDiscoveryMetric).flatMap((o) => o.extractedClaims)
  const order = useMemo(() => {
    const score = (id: string) => (id === 'whitefield' ? 100 : 0) + disc.latest.filter((o) => o.locationId === id).reduce((n, o) => n + o.targetPromptIds.length, 0) + views.filter((v) => v.issue.locationId === id && v.issue.auditId === audit.id).length
    return [...audit.locationIds].sort((a, b) => score(b) - score(a))
  }, [audit, disc.latest, views])
  const shown = goal ? order.filter((id) => goal.locationIds.includes(id)) : order
  return (
    <div className="space-y-5" id="results">
      <Card className="border-[#bfeef3] p-5">
        <p className="text-[18px] font-semibold text-ink">Your AI visibility findings are ready</p>
        <p className="mt-1 text-[13.5px] text-body">
          {audit.locationIds.length} centres · {audit.promptIds.length} suggested questions each · {obs.length} sampled answers · demo AI search (Surface A) · sampled {fmtDate(audit.createdAt)} · one answer per question, so samples are small. <Badge tone="neutral">Simulated</Badge>
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-teal-ink">
              <Compass className="size-4" />
              Being found (Discoverability)
            </p>
            <p className="tabular mt-1 text-[22px] font-semibold text-ink">
              {m.eligibleMentioned} of {m.eligible}
            </p>
            <p className="text-[13px] text-body">eligible sampled recommendations mentioned the right centre · {disc.latest.filter((o) => o.targetPromptIds.length > 0).length} centres with discovery opportunities{m.awaitingReview ? ` · ${m.awaitingReview} need relevance confirmation` : ''}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-brand">
              <ShieldCheck className="size-4" />
              Information accuracy
            </p>
            <p className="tabular mt-1 text-[22px] font-semibold text-ink">{acc.length}</p>
            <p className="text-[13px] text-body">
              answers may show incorrect information · {accClaims.filter((c) => c.evaluation === 'match').length} of {accClaims.length} checkable claims matched your record · {accClaims.filter((c) => c.evaluation === 'cannot_evaluate' || c.evaluation === 'unverifiable').length} couldn’t be checked
            </p>
          </div>
        </div>
      </Card>
      {goal && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-[13.5px] text-ink">
          Focused on: <span className="font-medium">“{goal.anchorQuestion}”</span> · {LOCATION_BY_ID[goal.locationIds[0]]?.name}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => selectGoal(null)}>
            Back to standard check
          </Button>
        </div>
      )}
      <Card>
        <CardHeader title="Findings by location" description="Discovery opportunities and accuracy findings are separate — each with its own question and evidence" />
        <ul className="divide-y divide-line">
          {shown.map((id) => (
            <LocationFindings key={id} locationId={id} auditId={audit.id} defaultOpen={false} />
          ))}
        </ul>
      </Card>
      <FocusOnQuestion />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/audits/${audit.id}`}>
            <ScanSearch />
            View all evidence
          </Link>
        </Button>
        <Button asChild>
          <Link to="/reports">
            <FileText />
            Download report
          </Link>
        </Button>
        <Button asChild>
          <Link to="/locations">All locations</Link>
        </Button>
      </div>
    </div>
  )
}

export default function DetectPage() {
  const { latestAudit, audits, createAudit, detectLocationIds, setDetectLocations, openChapter } = useStore()
  const [running, setRunning] = useState<{ pct: number; label: string; replay: boolean } | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const selected = detectLocationIds ?? PILOT_IDS
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => openChapter(1), [])
  const matching = [...audits].reverse().find((a) => sameSet(a.locationIds, selected) && sameSet(a.promptIds, STANDARD_PROMPTS))
  const showSetup = !latestAudit || setupOpen

  const run = async (replay: boolean) => {
    setRunning({ pct: 2, label: 'Checking selected questions…', replay })
    await runSimulatedAudit(selected.length * STANDARD_PROMPTS.length, (p) =>
      setRunning({ pct: p.stage === 'complete' ? 100 : p.stage === 'running' ? 10 + (p.completed / p.total) * 75 : p.stage === 'extracting' ? 92 : 4, label: p.stage === 'extracting' ? 'Checking facts against your verified records…' : p.stage === 'running' ? `Sampling answers · ${p.completed} of ${p.total}` : 'Checking selected questions…', replay }),
    )
    if (!replay) {
      createAudit({ name: 'Standard AI Visibility Check', locationIds: selected, promptIds: STANDARD_PROMPTS, mode: 'self-serve' })
      toast.success('Your AI visibility findings are ready', { description: `${selected.length} centres checked (simulated).` })
    } else toast('Replay finished', { description: 'Showing the same saved check — not a new measurement.' })
    setRunning(null)
    setSetupOpen(false)
    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Understand how AI search represents your locations." subtitle="Run a ready-made check: are parents finding your centres in AI answers, and is the information correct?" actions={!latestAudit ? <Badge tone="neutral">Simulated prototype</Badge> : undefined} />
      {latestAudit && !setupOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] text-body shadow-card">
          <span>
            Latest standard check · {latestAudit.locationIds.length} centres · {fmtDate(latestAudit.createdAt)}
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSetupOpen(true)}>
            Suggested questions & locations
          </Button>
        </div>
      )}
      {showSetup && (
        <>
          <SuggestedQuestions />
          <LocationPicker selected={selected} onChange={setDetectLocations} />
          <Card className="flex flex-wrap items-center gap-3 p-5">
            {running ? (
              <div className="w-full">
                <p className="flex items-center gap-2 text-[14px] text-ink">
                  <Loader2 className="size-4 animate-spin text-brand" />
                  {running.label} <Badge tone="neutral">{running.replay ? 'Replay — same saved results' : 'Simulated'}</Badge>
                </p>
                <Progress value={running.pct} className="mt-3 h-2" />
              </div>
            ) : matching ? (
              <>
                <Button variant="primary" size="lg" onClick={() => { setSetupOpen(false); setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>
                  View latest check
                </Button>
                <Button size="lg" onClick={() => run(true)}>
                  <PlayCircle />
                  Replay demo
                </Button>
                <span className="text-[12.5px] text-muted">These centres were already checked on {fmtDate(matching.createdAt)}. A replay shows the same saved answers — it isn’t a new measurement.</span>
              </>
            ) : (
              <>
                <Button variant="primary" size="lg" disabled={!selected.length} onClick={() => run(false)}>
                  <ScanSearch />
                  Run AI Visibility Check
                </Button>
                <Badge tone="neutral">Simulated demo check</Badge>
                <span className="text-[12.5px] text-muted">ProManage handles sampling, providers and matching — no setup needed.</span>
              </>
            )}
          </Card>
        </>
      )}
      {latestAudit && !running && <Results />}
    </div>
  )
}
