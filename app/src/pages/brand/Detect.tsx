import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, FileText, Loader2, MapPin, MessageSquareText, PlayCircle, Plus, ScanSearch, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import type { Observation } from '@/data/types'
import { CATEGORY_LABELS, LOCATION_BY_ID, LOCATIONS, PILOT_IDS, fillPrompt } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { useBrandViews, type BrandView } from '@/lib/brandStatus'
import { useDiscovery } from '@/lib/useDiscovery'
import { discoveryId, type EligibilityView } from '@/lib/discovery'
import { runSimulatedAudit } from '@/services/mockAuditService'
import { EvidenceDisclosure, FactComparison, StageBadge } from '@/components/brand'
import { NotAnErrorNote, RelevanceControls } from '@/components/discovery'
import { FocusOnQuestion } from '@/components/goals'
import { KpiCard, NextStep, PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, Select } from '@/components/ui/input'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState, Progress, Segmented } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

const STANDARD_PROMPTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

const DISC_IDS = ['p1', 'p2', 'p3', 'p4', 'p5']
const ACC_IDS = ['p6', 'p7', 'p8']

/** Shown after the CTA: defaults are ready; changing questions or locations is optional. */
function ReviewCheckDialog({ open, onOpenChange, onStart, startLabel }: { open: boolean; onOpenChange: (o: boolean) => void; onStart: () => void; startLabel: string }) {
  const { promptsById, customPrompts, saveCustomPrompt, deleteCustomPrompt, detectLocationIds, setDetectLocations, detectPromptIds, setDetectPrompts } = useStore()
  const [newQ, setNewQ] = useState('')
  const [qErr, setQErr] = useState<string>()
  const [locQ, setLocQ] = useState('')
  const locs = detectLocationIds ?? PILOT_IDS
  const prompts = detectPromptIds ?? STANDARD_PROMPTS
  const [edit, setEdit] = useState<null | 'questions' | 'locations'>(null)
  const [tab, setTab] = useState<'disc' | 'acc'>('disc')
  const example = LOCATION_BY_ID.whitefield
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id))
  const discIds = [...DISC_IDS, ...customPrompts.filter((p) => p.includeInDiscoveryMetric).map((p) => p.id)]
  const accIds = [...ACC_IDS, ...customPrompts.filter((p) => !p.includeInDiscoveryMetric).map((p) => p.id)]
  const nDisc = prompts.filter((p) => discIds.includes(p)).length
  const nAcc = prompts.filter((p) => accIds.includes(p)).length
  const nCustom = prompts.filter((p) => customPrompts.some((c) => c.id === p)).length
  const extraLocs = locs.filter((id) => !PILOT_IDS.includes(id))
  const locMatches = locQ.trim().length > 1 ? LOCATIONS.filter((l) => !locs.includes(l.id) && `${l.name} ${l.city}`.toLowerCase().includes(locQ.toLowerCase())).slice(0, 6) : []
  const addQuestion = () => {
    const text = newQ.trim()
    if (text.length < 10) return setQErr('Write the question as a parent would ask it.')
    if (tab === 'acc' && !/brightnest/i.test(text)) return setQErr('Accuracy questions should name BrightNest, e.g. “Does BrightNest Whitefield have parking?”')
    // Asked for every selected centre: the example centre/city become placeholders.
    const template = text.replace(/whitefield/gi, '{neighborhood}').replace(/bengaluru/gi, '{city}')
    const id = `px${Date.now().toString(36)}`
    saveCustomPrompt({ id, text: template, category: tab === 'disc' ? 'discovery' : 'branded', intent: tab === 'disc' ? 'unbranded_discovery' : 'branded_fact', includeInDiscoveryMetric: tab === 'disc', custom: true, provenance: 'Custom · added by the Brand' })
    setDetectPrompts([...prompts, id])
    setNewQ('')
    setQErr(undefined)
    toast.success('Question added', { description: template.includes('{neighborhood}') ? 'It will be asked for every selected centre.' : 'It will be asked as written for every selected centre.' })
  }
  const valid = locs.length > 0 && nDisc > 0 && nAcc > 0
  const row = (title: string, summary: string, key: 'questions' | 'locations') => (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="text-[13px] text-body">{summary}</p>
      </div>
      <Button size="sm" variant={edit === key ? 'secondary' : 'ghost'} onClick={() => setEdit(edit === key ? null : key)} aria-expanded={edit === key}>
        {edit === key ? 'Done' : key === 'questions' ? 'Change questions' : 'Change locations'}
      </Button>
    </div>
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-[720px]"
      title="Your AI Visibility Check"
      description="ProManage has set this up for you. Start now, or change the questions or locations first."
      footer={
        <>
          <span className="mr-auto self-center text-[12.5px] text-muted">
            {locs.length} centres × {prompts.length} questions · simulated
          </span>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={onStart}>
            <ScanSearch />
            {startLabel}
          </Button>
        </>
      }
    >
      <div className="divide-y divide-line rounded-xl border border-line">
        {row('Questions parents may ask', `${nDisc} discoverability (unbranded) · ${nAcc} information accuracy (branded)${nCustom ? ` · ${nCustom} your own` : ''} · curated by ProManage, not search-volume data`, 'questions')}
        {edit === 'questions' && (
          <div className="space-y-2 bg-subtle/60 px-4 py-3">
            <Segmented
              ariaLabel="Question type"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'disc', label: `Being found (Discoverability) · ${nDisc}` },
                { value: 'acc', label: `Information accuracy · ${nAcc}` },
              ]}
            />
            <ul className="space-y-1.5">
              {(tab === 'disc' ? discIds : accIds).map((id) => {
                const p = promptsById[id]
                if (!p) return null
                return (
                  <li key={id} className="flex items-start gap-2">
                    <label className="flex flex-1 items-start gap-2.5 text-[14px] text-ink">
                      <Checkbox checked={prompts.includes(id)} onCheckedChange={(v) => setDetectPrompts(toggle(prompts, id, v))} aria-label={fillPrompt(p.text, example)} />
                      <span>
                        “{fillPrompt(p.text, example)}{p.text.endsWith('?') ? '' : '?'}” <span className="text-[12px] text-muted">· {p.custom ? 'Your question' : tab === 'disc' ? CATEGORY_LABELS[p.category] : 'Branded fact'}</span>
                      </span>
                    </label>
                    {p.custom && (
                      <button className="rounded p-0.5 text-muted hover:bg-subtle hover:text-ink" aria-label={`Remove ${p.text}`} onClick={() => { deleteCustomPrompt(id); setDetectPrompts(prompts.filter((x) => x !== id)) }}>
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-start gap-2 pt-1">
              <Input value={newQ} onChange={(e) => { setNewQ(e.target.value); setQErr(undefined) }} onKeyDown={(e) => e.key === 'Enter' && addQuestion()} placeholder={tab === 'disc' ? 'Add your own question, e.g. Preschools with transport near Whitefield' : 'Add your own question, e.g. Does BrightNest Whitefield have parking?'} aria-label="Add your own question" className="min-w-[240px] flex-1" />
              <Button onClick={addQuestion}>
                <Plus />
                Add question
              </Button>
            </div>
            {qErr && <p className="text-[12.5px] text-danger">{qErr}</p>}
            <p className="text-[12px] text-muted">Shown for Whitefield; each question is asked for every selected centre (“Whitefield” becomes each centre’s area). Your own questions start as “needs relevance confirmation”. Keep at least one question in each group.</p>
          </div>
        )}
        {row('Locations', `${locs.length} of 150 centres · ${locs.length === PILOT_IDS.length && PILOT_IDS.every((x) => locs.includes(x)) ? 'Bengaluru pilot' : 'custom selection'}`, 'locations')}
        {edit === 'locations' && (
          <div id="locations" className="bg-subtle/60 px-4 py-3">
            <div className="mb-2 flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDetectLocations(PILOT_IDS)}>
                All pilot
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDetectLocations([])}>
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {PILOT_IDS.map((id) => (
                <label key={id} className="flex items-center gap-2.5 text-[14px] text-ink">
                  <Checkbox checked={locs.includes(id)} onCheckedChange={(v) => setDetectLocations(toggle(locs, id, v))} aria-label={LOCATION_BY_ID[id].name} />
                  <span className="flex-1">{LOCATION_BY_ID[id].neighborhood}</span>
                  <span className="text-[12px] text-muted">{LOCATION_BY_ID[id].region}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-1.5 text-[13px] font-medium text-ink">Add another of your centres</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input value={locQ} onChange={(e) => setLocQ(e.target.value)} placeholder="Search your 150 centres, e.g. Baner or Pune" className="pl-9" aria-label="Search centres to add" />
              </div>
              {locMatches.length > 0 && (
                <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-surface">
                  {locMatches.map((l) => (
                    <li key={l.id}>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] hover:bg-subtle" onClick={() => { setDetectLocations([...locs, l.id]); setLocQ(''); toast.success(`${l.name} added`) }}>
                        <Plus className="size-4 text-brand" />
                        <span className="flex-1 text-ink">{l.name}</span>
                        <span className="text-[12px] text-muted">{l.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {locQ.trim().length > 1 && locMatches.length === 0 && <p className="mt-1 text-[12.5px] text-muted">No matching centre that isn’t already selected.</p>}
              {extraLocs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extraLocs.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-[12.5px] text-brand">
                      {LOCATION_BY_ID[id].name}
                      <button aria-label={`Remove ${LOCATION_BY_ID[id].name}`} onClick={() => setDetectLocations(locs.filter((x) => x !== id))}>
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {!valid && <p className="mt-2 text-[12.5px] text-danger">Choose at least one location and one question in each group.</p>}
    </Dialog>
  )
}

type Finding =
  | { kind: 'disc'; key: string; locationId: string; obs: Observation; el: EligibilityView; oppId?: string }
  | { kind: 'acc'; key: string; locationId: string; obs?: Observation; v: BrandView; claim?: string }

function FindingDetail({ f, onClose }: { f: Finding; onClose: () => void }) {
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[f.locationId]
  const next = f.kind === 'disc' ? (f.oppId && f.el.status === 'eligible' ? `/improve#disc:${f.oppId}` : null) : `/improve#acc:${f.v.issue.id}`
  return (
    // Pinned beside the table on wide screens, so it scrolls on its own when the AI answer is long.
    <Card className="scrollbar-thin self-start xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto">
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
        {next && (
          <div className="rounded-lg border border-brand-line bg-brand-soft px-3.5 py-3">
            <p className="text-[13px] text-body">ProManage has prepared a fix for this in 02 Improve.</p>
            <Button variant="primary" className="mt-2 w-full sm:w-auto" onClick={() => navigate(next)}>
              See the suggested fix
              <ArrowRight />
            </Button>
          </div>
        )}
        {f.obs && <EvidenceDisclosure obs={f.obs} title="View original AI answer" />}
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
        <Button variant="primary" size="sm" className="ml-auto" asChild>
          <Link to="/improve">
            Review suggested fixes
            <ArrowRight />
          </Link>
        </Button>
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
      <NextStep
        chapter="02 Improve"
        title="ProManage has prepared fixes for these findings"
        description={`${opps} discovery opportunit${opps === 1 ? 'y' : 'ies'} and ${accViews.length} accuracy finding${accViews.length === 1 ? '' : 's'}. Review the exact changes and approve them in one step. Nothing is published until you do.`}
        to="/improve"
        cta="Review and approve fixes"
      />
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
  const { latestAudit, audits, createAudit, detectLocationIds, detectPromptIds, openChapter } = useStore()
  const [running, setRunning] = useState<{ pct: number; label: string; replay: boolean } | null>(null)
  const [review, setReview] = useState(false)
  const locs = detectLocationIds ?? PILOT_IDS
  const prompts = detectPromptIds ?? STANDARD_PROMPTS
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => openChapter(1), [])
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#locations') setReview(true)
  }, [hash])
  const matching = [...audits].reverse().find((a) => sameSet(a.locationIds, locs) && sameSet(a.promptIds, prompts))

  const run = async (replay: boolean) => {
    setReview(false)
    setRunning({ pct: 2, label: 'Checking selected questions…', replay })
    await runSimulatedAudit(locs.length * prompts.length, (p) =>
      setRunning({ pct: p.stage === 'complete' ? 100 : p.stage === 'running' ? 10 + (p.completed / p.total) * 75 : p.stage === 'extracting' ? 92 : 4, label: p.stage === 'extracting' ? 'Checking facts against your verified records…' : p.stage === 'running' ? `Sampling answers · ${p.completed} of ${p.total}` : 'Checking selected questions…', replay }),
    )
    if (!replay) {
      createAudit({ name: 'Standard AI Visibility Check', locationIds: locs, promptIds: prompts, mode: 'self-serve' })
      toast.success('Your AI visibility findings are ready', { description: `${locs.length} centres checked (simulated).` })
    } else toast('Replay finished', { description: 'Showing the same saved check — not a new measurement.' })
    setRunning(null)
    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const start = () => {
    if (matching && matching.id === latestAudit?.id) {
      setReview(false)
      toast('These centres and questions were already checked', { description: 'Showing your latest check. Use Replay demo to rerun the animation — it isn’t a new measurement.' })
      return
    }
    run(false)
  }

  return (
    <div className="animate-fade-in space-y-6">
      {!latestAudit || running ? (
        <Card className="overflow-hidden border-brand-line">
          <div className="grid grid-cols-1 gap-6 bg-gradient-to-br from-[#eef4ff] via-white to-[#ecfbfd] px-6 py-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
            <div>
              <Badge tone="neutral">Simulated prototype</Badge>
              <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Understand how AI search represents your locations.</h1>
              <p className="mt-2 max-w-[620px] text-[15px] text-body">One ready-made check shows where parents may not find your centres in AI answers, and where AI gets your information wrong.</p>
              {running ? (
                <div className="mt-6 max-w-[560px]">
                  <p className="flex items-center gap-2 text-[14px] text-ink">
                    <Loader2 className="size-4 animate-spin text-brand" />
                    {running.label} <Badge tone="neutral">{running.replay ? 'Replay — same saved results' : 'Simulated'}</Badge>
                  </p>
                  <Progress value={running.pct} className="mt-3 h-2" />
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="lg" className="h-12 px-6 text-[15.5px] shadow-pop" onClick={() => setReview(true)}>
                    <ScanSearch />
                    Run AI Visibility Check
                  </Button>
                  <span className="text-[13px] text-muted">
                    {locs.length} pilot centres · {prompts.length} suggested questions · about a minute · simulated demo check
                  </span>
                </div>
              )}
            </div>
            <ol className="grid grid-cols-1 gap-2 self-center">
              {[
                ['Being found', 'Are your centres recommended for general questions parents ask?'],
                ['Information accuracy', 'Are hours, tours and contact details in AI answers correct?'],
                ['No setup', 'ProManage picks the questions and handles sampling — change them if you want.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 rounded-lg border border-line bg-white/80 px-3 py-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">{i + 1}</span>
                  <span>
                    <span className="block text-[13.5px] font-semibold text-ink">{t}</span>
                    <span className="block text-[12.5px] text-body">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : (
        <PageHeader
          title="Understand how AI search represents your locations."
          subtitle={`Latest standard check · ${latestAudit.locationIds.length} centres × ${latestAudit.promptIds.length} questions · ${fmtDate(latestAudit.createdAt)}`}
          actions={
            <>
              <Button onClick={() => setReview(true)}>
                <SlidersHorizontal />
                Change questions or locations
              </Button>
              <Button onClick={() => run(true)}>
                <PlayCircle />
                Replay demo
              </Button>
            </>
          }
        />
      )}
      <ReviewCheckDialog open={review} onOpenChange={setReview} onStart={start} startLabel={matching && matching.id === latestAudit?.id ? 'View latest check' : 'Start check'} />
      {latestAudit && !running && <Results />}
    </div>
  )
}
