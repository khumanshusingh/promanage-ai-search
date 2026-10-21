import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, FileText, Loader2, MapPin, MessageSquareText, PlayCircle, ScanSearch, Search, ShieldCheck, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import type { Observation } from '@/data/types'
import { CATEGORY_LABELS, LOCATION_BY_ID, PILOT_IDS, fillPrompt } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { useBrandViews, type BrandView } from '@/lib/brandStatus'
import { useDiscovery } from '@/lib/useDiscovery'
import { discoveryId, type EligibilityView } from '@/lib/discovery'
import { runSimulatedAudit } from '@/services/mockAuditService'
import { EvidenceDisclosure, FactComparison, StageBadge } from '@/components/brand'
import { NotAnErrorNote, RelevanceControls } from '@/components/discovery'
import { FocusOnQuestion } from '@/components/goals'
import { KpiCard, PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, Select } from '@/components/ui/input'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState, Progress, Segmented } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

const STANDARD_PROMPTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

function Setup({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { promptsById } = useStore()
  const [tab, setTab] = useState<'disc' | 'acc'>('disc')
  const example = LOCATION_BY_ID.whitefield
  const ids = tab === 'disc' ? ['p1', 'p2', 'p3', 'p4', 'p5'] : ['p6', 'p7', 'p8']
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader
          title="Questions parents may ask"
          description="Suggested by ProManage for preschools in your locations — curated examples, not search-volume data. Shown for Whitefield; each is asked for every selected centre."
          actions={
            <Segmented
              ariaLabel="Question type"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'disc', label: 'Being found (Discoverability) · 5' },
                { value: 'acc', label: 'Information accuracy · 3' },
              ]}
            />
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Suggested question</Th>
              <Th>Intent</Th>
              <Th>What it checks</Th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const p = promptsById[id]
              return (
                <Tr key={id}>
                  <Td className="text-[14px] text-ink">“{fillPrompt(p.text, example)}{p.text.endsWith('?') ? '' : '?'}”</Td>
                  <Td>
                    <Badge tone={tab === 'disc' ? 'teal' : 'blue'}>{tab === 'disc' ? 'Unbranded' : 'Branded'}</Badge>
                  </Td>
                  <Td className="text-[13px] text-body">{tab === 'disc' ? `Is the centre recommended? · ${CATEGORY_LABELS[p.category]}` : 'Are the facts right?'}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
        <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-muted">
          {tab === 'disc' ? 'Being found (Discoverability): general questions that don’t name BrightNest.' : 'Information accuracy: questions about your centres, checked against your verified record.'} Switch groups with the tabs above.
        </p>
      </Card>
      <Card id="locations" className="scroll-mt-24 self-start">
        <CardHeader
          title="Choose locations to check"
          description={`${selected.length} of 150 centres · pilot of ${PILOT_IDS.length}`}
          actions={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onChange(PILOT_IDS)}>
                All pilot
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                Clear
              </Button>
            </div>
          }
        />
        <ul className="divide-y divide-line">
          {PILOT_IDS.map((id) => (
            <li key={id}>
              <label className="flex items-center gap-2.5 px-5 py-2 text-[14px] text-ink hover:bg-subtle">
                <Checkbox checked={selected.includes(id)} onCheckedChange={(v) => onChange(v ? [...selected, id] : selected.filter((x) => x !== id))} aria-label={LOCATION_BY_ID[id].name} />
                <span className="flex-1">{LOCATION_BY_ID[id].neighborhood}</span>
                <span className="text-[12px] text-muted">{LOCATION_BY_ID[id].region}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

type Finding =
  | { kind: 'disc'; key: string; locationId: string; obs: Observation; el: EligibilityView; oppId?: string }
  | { kind: 'acc'; key: string; locationId: string; obs?: Observation; v: BrandView; claim?: string }

function FindingDetail({ f, onClose }: { f: Finding; onClose: () => void }) {
  const { hasRelease } = useStore()
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[f.locationId]
  const next = f.kind === 'disc' ? (f.oppId && f.el.status === 'eligible' ? (hasRelease('V1') ? `/improve#disc:${f.oppId}` : `/attention/discovery/${f.oppId}`) : null) : hasRelease('V1') ? `/improve#acc:${f.v.issue.id}` : `/attention/${f.v.issue.id}`
  return (
    <Card className="self-start xl:sticky xl:top-[84px]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-[12px] text-muted">{loc.name}</p>
          <h2 className="text-[16px] font-semibold leading-snug text-ink">“{f.obs?.query}”</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={f.kind === 'disc' ? 'teal' : 'blue'}>{f.kind === 'disc' ? 'Discovery opportunity' : 'Accuracy finding'}</Badge>
            {f.kind === 'acc' && <StageBadge stage={f.v.stage} />}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close finding details">
          <X />
        </Button>
      </div>
      <div className="space-y-4 px-5 py-4">
        {f.kind === 'disc' ? (
          <>
            <p className="text-[14px] text-ink">Not mentioned in sampled recommendations for this question.</p>
            <p className="text-[13px] text-body">
              <span className="font-medium text-ink">Relevance:</span> {f.el.status === 'eligible' ? 'matches what the centre offers' : f.el.status === 'not_relevant' ? 'not relevant' : 'needs confirmation'} · {f.el.basis}
            </p>
            {f.el.status === 'unknown' && <RelevanceControls locationId={f.locationId} promptId={f.obs.promptId} el={f.el} />}
            <NotAnErrorNote />
          </>
        ) : (
          <>
            {f.claim && f.v.issue.field && <FactComparison ai={f.claim} record={f.v.fact?.verificationStatus === 'verified' ? f.v.fact.value : 'Not confirmed yet — verify your information'} recordNote={f.v.fact?.verifiedBy ? `Verified by ${f.v.fact.verifiedBy}` : undefined} />}
            <p className="text-[13px] text-body">An answer without checkable facts isn’t proof that information is correct.</p>
          </>
        )}
        {f.obs && <EvidenceDisclosure obs={f.obs} title="View original AI answer" />}
        {next && (
          <Button variant="primary" onClick={() => navigate(next)}>
            {hasRelease('V1') ? 'See suggested improvement' : 'Review finding'}
            <ArrowRight />
          </Button>
        )}
      </div>
    </Card>
  )
}

function Results() {
  const { latestAudit, observationsFor, promptsById, goals, selectedGoalId, selectGoal } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  const audit = latestAudit!
  const obs = observationsFor(audit.id)
  const m = disc.metricsFor(audit.id)
  const goal = goals.find((g) => g.id === selectedGoalId)
  const [type, setType] = useState<'all' | 'disc' | 'acc'>('all')
  const [loc, setLoc] = useState(goal?.locationIds[0] ?? 'all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => setLoc(goal?.locationIds[0] ?? 'all'), [goal])
  const accViews = useMemo(() => views.filter((v) => v.issue.auditId === audit.id && v.stage !== 'not_an_issue'), [views, audit.id])
  const accClaims = obs.filter((o) => !promptsById[o.promptId]?.includeInDiscoveryMetric).flatMap((o) => o.extractedClaims)

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = []
    for (const locationId of audit.locationIds) {
      for (const o of disc.observationsOf({ auditId: audit.id, locationId }).filter((x) => !x.mentioned)) {
        const el = disc.eligibility(locationId, o.promptId)
        if (el.status === 'not_relevant') continue
        out.push({ kind: 'disc', key: `d:${o.id}`, locationId, obs: o, el, oppId: disc.byId[discoveryId(audit.id, locationId)]?.id })
      }
      for (const v of accViews.filter((x) => x.issue.locationId === locationId)) {
        const o = obs.find((x) => x.id === v.issue.observationId)
        out.push({ kind: 'acc', key: `a:${v.issue.id}`, locationId, obs: o, v, claim: o?.extractedClaims.find((c) => c.id === v.issue.claimId)?.value })
      }
    }
    const rank = (id: string) => (id === 'whitefield' ? 0 : 1)
    return out.sort((a, b) => rank(a.locationId) - rank(b.locationId) || LOCATION_BY_ID[a.locationId].neighborhood.localeCompare(LOCATION_BY_ID[b.locationId].neighborhood) || b.kind.localeCompare(a.kind))
  }, [audit, disc, accViews, obs])

  const shown = findings.filter((f) => (type === 'all' || f.kind === type) && (loc === 'all' || f.locationId === loc) && (!q || `${LOCATION_BY_ID[f.locationId].name} ${f.obs?.query}`.toLowerCase().includes(q.toLowerCase())))
  const current = findings.find((f) => f.key === selected)
  const chart = audit.locationIds.map((id) => {
    const el = disc.observationsOf({ auditId: audit.id, locationId: id }).filter((o) => disc.eligibility(id, o.promptId).status === 'eligible')
    return { name: LOCATION_BY_ID[id].neighborhood, Mentioned: el.filter((o) => o.mentioned).length, 'Not mentioned': el.filter((o) => !o.mentioned).length }
  })
  const opps = findings.filter((f) => f.kind === 'disc' && f.el.status === 'eligible').length

  return (
    <div className="space-y-6" id="results">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#bfeef3] bg-teal-soft/40 px-4 py-3 text-[13.5px] text-ink">
        <span className="font-semibold">Your AI visibility findings are ready</span>
        <span className="text-body">
          · {audit.locationIds.length} centres · {audit.promptIds.length} suggested questions each · {obs.length} sampled answers · demo AI search (Surface A) · {fmtDate(audit.createdAt)} · one answer per question
        </span>
        <Badge tone="neutral">Simulated</Badge>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Locations checked" value={`${audit.locationIds.length}`} detail="of 150" icon={<MapPin />} tone="neutral" definition="Pilot centres included in this standard check." footer={`${obs.length} sampled answers`} />
        <KpiCard label="Eligible mention rate" value={m.eligible ? `${Math.round((m.eligibleMentioned / m.eligible) * 100)}%` : '—'} detail={`${m.eligibleMentioned} of ${m.eligible} eligible`} icon={<Compass />} tone="teal" definition="Unbranded sampled answers that named the right centre, out of those that match what the centre offers. Branded accuracy questions are never counted here." footer={m.awaitingReview ? `${m.awaitingReview} need relevance confirmation` : 'All relevant questions reviewed'} />
        <KpiCard label="Discovery opportunities" value={opps} icon={<Search />} tone="teal" definition="Eligible questions where the centre wasn’t mentioned. An observation, not an error." footer="Not mentioned in sampled recommendations" />
        <KpiCard label="Accuracy findings" value={accViews.length} detail={`${accClaims.filter((c) => c.evaluation === 'match').length}/${accClaims.length} claims matched`} icon={<ShieldCheck />} tone="blue" definition="Answers about your centres that may show incorrect information, checked against your verified record." footer={`${accClaims.filter((c) => c.evaluation === 'cannot_evaluate' || c.evaluation === 'unverifiable').length} claims couldn’t be checked`} />
      </div>
      <Card>
        <CardHeader title="Mentions by centre" description="Eligible unbranded sampled recommendations · mentioned vs not mentioned" />
        <div className="h-[220px] px-3 pb-2 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3eaf1', fontSize: 12.5 }} />
              <Bar dataKey="Mentioned" stackId="a" fill="var(--chart-1)" isAnimationActive={false} />
              <Bar dataKey="Not mentioned" stackId="a" fill="#cfd8e3" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
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
      <div className={cn('grid grid-cols-1 gap-6', current && 'xl:grid-cols-[minmax(0,1fr)_440px]')}>
        <Card className="self-start">
          <CardHeader title="Findings" description="Discovery opportunities and accuracy findings — separate questions, separate evidence" />
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search centre or question" className="pl-9" aria-label="Search findings" />
            </div>
            <Select value={loc} onChange={(e) => setLoc(e.target.value)} className="w-52" aria-label="Location">
              <option value="all">All locations</option>
              {audit.locationIds.map((id) => (
                <option key={id} value={id}>
                  {LOCATION_BY_ID[id].name}
                </option>
              ))}
            </Select>
            <Segmented
              ariaLabel="Finding type"
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: `All · ${findings.length}` },
                { value: 'disc', label: 'Discoverability' },
                { value: 'acc', label: 'Accuracy' },
              ]}
            />
            <span className="ml-auto text-[12.5px] text-muted">{shown.length} shown</span>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<MessageSquareText />} title="No findings match" className="py-8" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th>Type</Th>
                  <Th>Question</Th>
                  <Th>What we found</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => (
                  <Tr key={f.key} onClick={() => setSelected(f.key)} className={cn(selected === f.key && 'bg-brand-soft/40')}>
                    <Td className="whitespace-nowrap font-medium text-ink">{LOCATION_BY_ID[f.locationId].neighborhood}</Td>
                    <Td>
                      <Badge tone={f.kind === 'disc' ? 'teal' : 'blue'}>{f.kind === 'disc' ? 'Discovery opportunity' : 'Accuracy finding'}</Badge>
                    </Td>
                    <Td className="min-w-[220px] text-[13.5px] text-ink">“{f.obs?.query}”</Td>
                    <Td className="text-[13px] text-body">
                      {f.kind === 'disc' ? (
                        <>
                          Not mentioned in sampled recommendations
                          {f.el.status === 'unknown' && <span className="block text-warning">Needs confirmation</span>}
                        </>
                      ) : f.claim && f.v.issue.field ? (
                        <>
                          AI said “{f.claim}” · record: {f.v.fact?.verificationStatus === 'verified' ? f.v.fact.value : 'not verified'}
                        </>
                      ) : (
                        <StageBadge stage={f.v.stage} />
                      )}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(f.key) }}>
                        Details
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="border-t border-line px-5 py-3">
            <NotAnErrorNote />
          </div>
        </Card>
        {current && <FindingDetail f={current} onClose={() => setSelected(null)} />}
      </div>
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
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Understand how AI search represents your locations."
        subtitle="Run a ready-made check: are parents finding your centres in AI answers, and is the information correct?"
        actions={
          latestAudit && !setupOpen ? (
            <Button onClick={() => setSetupOpen(true)}>
              <ScanSearch />
              Questions & locations
            </Button>
          ) : !latestAudit ? (
            <Badge tone="neutral">Simulated prototype</Badge>
          ) : undefined
        }
      />
      {showSetup && (
        <>
          <Setup selected={selected} onChange={setDetectLocations} />
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
                <span className="text-[12.5px] text-muted">
                  {selected.length} centres × {STANDARD_PROMPTS.length} questions · ProManage handles sampling, providers and matching — no setup needed.
                </span>
              </>
            )}
          </Card>
        </>
      )}
      {latestAudit && !running && <Results />}
    </div>
  )
}
