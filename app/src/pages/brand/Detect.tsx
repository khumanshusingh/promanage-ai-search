import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as DM from '@radix-ui/react-dropdown-menu'
import { AlertCircle, ArrowRight, FileDown, CheckCircle2, CircleDashed, Compass, FileSearch, Lightbulb, XCircle, FileText, Loader2, MapPin, MessageSquareText, MoreHorizontal, PlayCircle, Plus, ScanSearch, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import type { Observation } from '@/data/types'
import { CATEGORY_LABELS, LOCATION_BY_ID, LOCATIONS, PILOT_IDS, fillPrompt } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { FIELD_PHRASE, useBrandViews, type BrandView } from '@/lib/brandStatus'
import { useDiscovery } from '@/lib/useDiscovery'
import { discoveryId, type EligibilityView } from '@/lib/discovery'
import { runSimulatedAudit } from '@/services/mockAuditService'
import { EvidenceDisclosure, StageBadge } from '@/components/brand'
import { NotAnErrorNote, RelevanceControls } from '@/components/discovery'
import { FocusOnQuestion } from '@/components/goals'
import { ReportDialog } from '@/components/report'
import { HowItWorks } from '@/components/howItWorks'
import { useReportSnapshot } from '@/lib/useReportSnapshot'
import { formatScore } from '@/lib/reportMetrics'
import { KpiCard, NextStep, PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Dialog, Sheet } from '@/components/ui/dialog'
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
/** asSheet opens the same review as a side drawer from the landing page's preview button. */
function ReviewCheckDialog({ open, onOpenChange, onStart, startLabel, asSheet = false, initialEdit = null }: { open: boolean; onOpenChange: (o: boolean) => void; onStart: () => void; startLabel: string; asSheet?: boolean; initialEdit?: null | 'questions' | 'locations' }) {
  const { promptsById, customPrompts, saveCustomPrompt, deleteCustomPrompt, detectLocationIds, setDetectLocations, detectPromptIds, setDetectPrompts } = useStore()
  const [newQ, setNewQ] = useState('')
  const [qErr, setQErr] = useState<string>()
  const [locQ, setLocQ] = useState('')
  const locs = detectLocationIds ?? PILOT_IDS
  const prompts = detectPromptIds ?? STANDARD_PROMPTS
  const [edit, setEdit] = useState<null | 'questions' | 'locations'>(initialEdit)
  useEffect(() => {
    if (open) setEdit(initialEdit)
  }, [open, initialEdit])
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
  const Wrap = asSheet ? Sheet : Dialog
  return (
    <Wrap
      open={open}
      onOpenChange={onOpenChange}
      {...(asSheet ? {} : { className: 'max-w-[720px]' })}
      title={asSheet ? 'Questions & locations in this check' : 'Your AI Visibility Check'}
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
    </Wrap>
  )
}

type Finding =
  | { kind: 'disc'; key: string; locationId: string; obs: Observation; el: EligibilityView; oppId?: string }
  | { kind: 'acc'; key: string; locationId: string; obs?: Observation; v: BrandView; claim?: string }

/** How an accuracy finding stands against the brand's own record. Only a verified record can confirm an error. */
type AccKind = 'confirmed' | 'verify' | 'confusion' | 'review'
const accKind = (f: Extract<Finding, { kind: 'acc' }>): AccKind =>
  f.v.issue.entityConfusion ? 'confusion' : f.claim && f.v.issue.field ? (f.v.fact?.verificationStatus === 'verified' ? 'confirmed' : 'verify') : 'review'

/** Evidence-based priority tiers (no scores): confirmed errors first, then relevant opportunities, then items needing the brand's input. */
type Tier = 'fix' | 'opportunity' | 'input' | 'monitor'
const TIER: Record<Tier, { label: string; tone: 'danger' | 'teal' | 'warning' | 'neutral'; rank: number }> = {
  fix: { label: 'Fix first', tone: 'danger', rank: 0 },
  opportunity: { label: 'Opportunity', tone: 'teal', rank: 1 },
  input: { label: 'Confirm before fixing', tone: 'warning', rank: 2 },
  monitor: { label: 'Monitoring', tone: 'neutral', rank: 3 },
}
const NO_FIX_NOTE = {
  disc: 'ProManage checked the information it manages for this centre and found nothing it can change. AI tools choose their own recommendations; ProManage keeps monitoring.',
  acc: 'Your centre page, listing and the directories we can inspect already match your verified record, so there’s no source to correct. ProManage keeps monitoring.',
}
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const
/** hasFix: Improve has a proposal for this finding. Without one, a checked finding is monitored rather than ranked as fixable. */
function priorityOf(f: Finding, hasFix: boolean): { tier: Tier; reason: string } {
  if (f.kind === 'acc') {
    const k = accKind(f)
    if (k === 'confirmed') return hasFix ? { tier: 'fix', reason: `Contradicts your verified record${f.v.issue.severity === 'high' ? ' · high impact' : ''}` } : { tier: 'monitor', reason: 'Wrong, but no source we can correct' }
    return { tier: 'input', reason: k === 'verify' ? 'Your record isn’t verified yet' : k === 'confusion' ? `AI may be mixing it up with ${f.v.issue.entityConfusion}` : 'No specific fact to check' }
  }
  if (f.el.status !== 'eligible') return { tier: 'input', reason: 'Confirm the question fits' }
  return hasFix ? { tier: 'opportunity', reason: 'Fits this centre, not mentioned' } : { tier: 'monitor', reason: 'No source ProManage can change' }
}
/** The one next step for a finding, and where it leads. */
function nextActionOf(f: Finding, hasFix: boolean): { label: string; short: string; to?: string; note: string } {
  if (f.kind === 'disc') {
    if (f.el.status !== 'eligible') return { label: 'Confirm relevance', short: 'Confirm', note: 'Confirm whether this question fits the centre. It isn’t counted until you do.' }
    return hasFix && f.oppId ? { label: 'See the suggested fix', short: 'See fix', to: `/improve#disc:${f.oppId}`, note: 'ProManage has prepared a fix for this in 02 Improve.' } : { label: 'Why no fix?', short: 'Why no fix?', note: NO_FIX_NOTE.disc }
  }
  const k = accKind(f)
  if (k === 'confirmed') return hasFix ? { label: 'See the suggested fix', short: 'See fix', to: `/improve#acc:${f.v.issue.id}`, note: 'ProManage has prepared a fix for this in 02 Improve.' } : { label: 'Why no fix?', short: 'Why no fix?', note: NO_FIX_NOTE.acc }
  if (k === 'confusion') return { label: 'Confirm the address', short: 'Review', to: `/attention/${f.v.issue.id}`, note: `The AI answer may be mixing this centre up with BrightNest ${f.v.issue.entityConfusion}. Confirm the address with the centre before treating it as an error; ProManage won’t propose changes until then.` }
  if (k === 'verify') return { label: 'Verify your business information', short: 'Verify', to: `/attention/${f.v.issue.id}`, note: 'Your record for this isn’t verified, so this isn’t a confirmed error yet. Verify it first; ProManage won’t propose changes until then.' }
  return { label: 'Review this answer', short: 'Review', to: `/attention/${f.v.issue.id}`, note: 'The AI answer may be incorrect, but it has no specific fact we can compare with your record.' }
}

/** Plain-language header, status and action for one finding. */
function findingCopy(f: Finding, hasFix: boolean) {
  const phrase = f.kind === 'acc' && f.v.issue.field ? (FIELD_PHRASE[f.v.issue.field] ?? 'information') : 'information'
  if (f.kind === 'disc') {
    return f.el.status === 'eligible'
      ? { title: 'Missing from AI recommendations', status: { tone: 'teal' as const, text: 'Not mentioned in sampled recommendations for a question that fits this centre' }, action: hasFix ? { title: 'ProManage has prepared improvements', body: 'We’ve checked this centre’s listing and page content and prepared updates that make your verified information easier for AI to find.', cta: 'Review suggested improvements' } : { title: 'Why no fix?', body: NO_FIX_NOTE.disc } }
      : { title: 'Missing from AI recommendations', status: { tone: 'warning' as const, text: 'Not mentioned, but we need you to confirm this question fits the centre' }, action: { title: 'Confirm relevance first', body: 'It isn’t counted as an opportunity until you confirm it.' } }
  }
  const k = accKind(f)
  if (k === 'confirmed')
    return { title: `Incorrect ${phrase}`, status: { tone: 'danger' as const, text: 'AI answer conflicts with verified business information' }, action: hasFix ? { title: 'ProManage has prepared a correction', body: 'We’ve checked the business information we manage and prepared suggested updates to help address the discrepancy.', cta: 'Review suggested correction' } : { title: 'Why no fix?', body: NO_FIX_NOTE.acc } }
  if (k === 'verify') return { title: `Unverified ${phrase}`, status: { tone: 'warning' as const, text: 'We can’t confirm an error yet: your business record isn’t verified' }, action: { title: 'Verify your business information first', body: 'ProManage won’t propose changes until your record is verified.', cta: 'Verify information' } }
  if (k === 'confusion') return { title: 'Possible address mix-up', status: { tone: 'warning' as const, text: `AI may be mixing this centre up with BrightNest ${f.v.issue.entityConfusion}` }, action: { title: 'Confirm the address first', body: 'Confirm the address with the centre before treating this as an error. ProManage won’t propose changes until then.', cta: 'Confirm the address' } }
  return { title: 'Possibly incorrect information', status: { tone: 'warning' as const, text: 'The answer may be incorrect, but it has no specific fact we can check' }, action: { title: 'Review this answer', body: 'Read the original answer and tell us whether it’s accurate.', cta: 'Review' } }
}

const STATUS_TONE = { danger: 'text-danger', warning: 'text-warning', teal: 'text-teal-ink' }

function FindingDetail({ f, onClose, hasFix }: { f: Finding; onClose: () => void; hasFix: boolean }) {
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[f.locationId]
  const next = nextActionOf(f, hasFix).to
  const copy = findingCopy(f, hasFix)
  const verified = f.kind === 'acc' && f.v.fact?.verificationStatus === 'verified'
  const label = 'text-[12px] font-medium uppercase tracking-[0.05em] text-muted'
  return (
    // Pinned beside the table on wide screens, so it scrolls on its own when the AI answer is long.
    <Card className="scrollbar-thin self-start xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted">
            {loc.name} · {f.kind === 'disc' ? 'Discoverability' : 'Information accuracy'}
          </p>
          <h2 className="mt-0.5 text-[18px] font-semibold leading-snug text-ink">{copy.title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close finding details">
          <X />
        </Button>
      </div>
      <div className="space-y-4 px-5 pb-5 pt-3">
        <p className={cn('flex items-start gap-2 text-[13.5px] font-medium', STATUS_TONE[copy.status.tone])}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {copy.status.text}
        </p>
        <div>
          <p className={label}>Question parents asked</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">“{f.obs?.query}”</p>
        </div>
        {(f.kind === 'disc' || (f.claim && f.v.issue.field)) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[12.5px] text-body">
                <XCircle className="size-4 text-danger" />
                AI answered
              </p>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{f.kind === 'disc' ? `Recommended other preschools, not ${loc.name}` : f.claim}</p>
            </div>
            <div className="rounded-xl border border-line px-3.5 py-3">
              {f.kind === 'disc' ? (
                <>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-body">
                    {f.el.status === 'eligible' ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4 text-warning" />}
                    {f.el.status === 'eligible' ? 'Why it fits this centre' : 'Relevance'}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{f.el.status === 'eligible' ? f.el.basis : 'Not confirmed yet'}</p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-body">
                    {verified ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4 text-warning" />}
                    {verified ? 'Verified business record' : 'Business record'}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{verified ? f.v.fact!.value : 'Not verified yet'}</p>
                  {verified && f.v.fact?.verifiedBy && <p className="mt-1 text-[12.5px] text-muted">Verified by {f.v.fact.verifiedBy}</p>}
                </>
              )}
            </div>
          </div>
        )}
        {f.kind === 'disc' && <NotAnErrorNote />}
        <div className={cn('rounded-xl border px-4 py-3.5', next ? 'border-brand-line bg-brand-soft' : 'border-line bg-subtle')}>
          <p className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
            <Lightbulb className={cn('size-4', next ? 'text-brand' : 'text-muted')} />
            {copy.action.title}
          </p>
          <p className="mt-1 text-[13px] text-body">{copy.action.body}</p>
          {f.kind === 'disc' && f.el.status === 'unknown' && <RelevanceControls locationId={f.locationId} promptId={f.obs.promptId} el={f.el} />}
          {next && 'cta' in copy.action && (
            <Button variant="primary" className="mt-3 w-full" onClick={() => navigate(next)}>
              {copy.action.cta}
              <ArrowRight />
            </Button>
          )}
        </div>
        {f.obs && (
          <div className="border-t border-line pt-4">
            <EvidenceDisclosure
              obs={f.obs}
              title={
                <span className="flex items-start gap-2.5">
                  <FileSearch className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span>
                    <span className="block">Original AI answer & evidence</span>
                    <span className="block text-[12.5px] font-normal text-muted">Sampled AI answer · expand to see the full response, timestamp and sources</span>
                  </span>
                </span>
              }
            />
          </div>
        )}
      </div>
    </Card>
  )
}

function Results() {
  const { latestAudit, observationsFor, promptsById, goals, selectedGoalId, selectGoal, autoPrepared, prepareImprovements, plans } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  const audit = latestAudit!
  const obs = observationsFor(audit.id)
  const m = disc.metricsFor(audit.id)
  // Shared with the PDF report so dashboard and report always show the same numerators and denominators.
  const snap = useReportSnapshot(audit.id)
  const [reportOpen, setReportOpen] = useState(false)
  const goal = goals.find((g) => g.id === selectedGoalId)
  const [type, setType] = useState<'all' | 'disc' | 'acc'>('all')
  const [loc, setLoc] = useState(goal?.locationIds[0] ?? 'all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sort, setSort] = useState<'priority' | 'location'>('priority')
  const navigate = useNavigate()
  // ProManage prepares proposals automatically after the check (simulated), so each finding can say whether a fix exists.
  useEffect(() => {
    if (!autoPrepared[audit.id]) prepareImprovements(audit.id)
  }, [audit.id, autoPrepared, prepareImprovements])
  const hasFix = (f: Finding) => (f.kind === 'disc' ? !!(f.oppId && disc.record(f.oppId)?.plan) : !!plans[f.v.issue.id])
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

  const filtered = findings.filter((f) => (type === 'all' || f.kind === type) && (loc === 'all' || f.locationId === loc) && (!q || `${LOCATION_BY_ID[f.locationId].name} ${f.obs?.query}`.toLowerCase().includes(q.toLowerCase())))
  const sev = (f: Finding) => (f.kind === 'acc' ? SEVERITY_RANK[f.v.issue.severity] : 1)
  const rank = (f: Finding) => TIER[priorityOf(f, hasFix(f)).tier].rank
  const shown = sort === 'location' ? filtered : [...filtered].sort((a, b) => rank(a) - rank(b) || sev(a) - sev(b) || findings.indexOf(a) - findings.indexOf(b))
  const current = findings.find((f) => f.key === selected)
  const chart = audit.locationIds.map((id) => {
    const el = disc.observationsOf({ auditId: audit.id, locationId: id }).filter((o) => disc.eligibility(id, o.promptId).status === 'eligible')
    return { id, name: LOCATION_BY_ID[id].neighborhood, Mentioned: el.filter((o) => o.mentioned).length, 'Not mentioned': el.filter((o) => !o.mentioned).length }
  })
  const opps = findings.filter((f) => f.kind === 'disc' && f.el.status === 'eligible').length
  const needsRel = findings.filter((f) => f.kind === 'disc' && f.el.status !== 'eligible').length
  const accFindings = findings.filter((f): f is Extract<Finding, { kind: 'acc' }> => f.kind === 'acc')
  const nConfirmed = accFindings.filter((f) => accKind(f) === 'confirmed').length
  const nVerify = accFindings.filter((f) => accKind(f) === 'verify').length
  const nConfusion = accFindings.filter((f) => accKind(f) === 'confusion').length
  const nReview = accFindings.length - nConfirmed - nVerify - nConfusion
  const inputs = [nVerify && `${nVerify} need business verification`, nConfusion && `${nConfusion} possible mix-up with another centre`, nReview && `${nReview} need review`].filter(Boolean).join(', ')
  const nMatched = accClaims.filter((c) => c.evaluation === 'match').length
  const nMismatch = accClaims.filter((c) => c.evaluation === 'mismatch').length
  const nUnchecked = accClaims.filter((c) => c.evaluation === 'cannot_evaluate' || c.evaluation === 'unverifiable').length
  const pickCentre = (id?: string) => {
    if (!id) return
    setLoc(id)
    setSelected(null)
    setTimeout(() => document.getElementById('findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <div className="space-y-6" id="results">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#bfeef3] bg-teal-soft/40 px-4 py-3 text-[13.5px] text-ink">
        <div className="min-w-0 flex-1">
          <p>
            <span className="font-semibold">Your AI visibility report is ready.</span>{' '}
            <span className="text-body">
              {audit.locationIds.length} centres · {audit.promptIds.length} sampled questions per centre · {obs.length} sampled answers · demo AI search (Surface A) · {fmtDate(audit.createdAt)}
            </span>{' '}
            <Badge tone="neutral">Simulated</Badge>
          </p>
          <p className="mt-0.5 text-[13px] text-body">Review the findings here or download a leadership-ready report with centre-level details and original-answer evidence.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => setReportOpen(true)}>
            <FileDown />
            Download AI Visibility Report (PDF)
          </Button>
          <Button size="sm" asChild>
            <Link to="/improve">
              Review suggested improvements
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} auditId={audit.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Locations checked" value={`${audit.locationIds.length}`} detail="of 150" icon={<MapPin />} tone="neutral" definition="Pilot centres included in this standard check." footer={`${obs.length} sampled answers`} />
        <KpiCard label="Eligible mention rate" value={snap ? formatScore(snap.discovery).replace('Not enough verified data', '—') : '—'} detail={snap ? `${snap.discovery.numerator} of ${snap.discovery.denominator} eligible` : ''} icon={<Compass />} tone="teal" definition="Unbranded sampled answers that named the right centre, out of those that match what the centre offers. Branded accuracy questions are never counted here." footer={m.awaitingReview ? `${m.awaitingReview} need relevance confirmation` : 'All relevant questions reviewed'} />
        <KpiCard label="Discovery opportunities" value={opps} icon={<Search />} tone="teal" definition="Questions that fit the centre where it wasn’t mentioned. An observation, not an error. Questions whose relevance you haven’t confirmed are listed separately and not counted here." footer={needsRel ? `Not mentioned · ${needsRel} more need relevance confirmation` : 'Not mentioned in sampled recommendations'} />
        <KpiCard label="Accuracy findings" value={accFindings.length} detail={`${nConfirmed} confirmed errors`} icon={<ShieldCheck />} tone="blue" definition={`AI answers about your centres that may contain incorrect information. One answer can contain several facts, so we also count facts: ${accClaims.length} facts checked, ${nMatched} matched your record, ${nMismatch} didn’t${nConfusion ? ` (${nConfusion} may be a mix-up with another BrightNest centre, so it isn’t counted as confirmed)` : ''}, ${nUnchecked} couldn’t be checked (record not verified, or no specific fact).`} footer={`${inputs} · verified fact match rate ${snap ? formatScore(snap.accuracy) : '—'} (${snap?.accuracy.numerator ?? 0}/${snap?.accuracy.denominator ?? 0})`} />
      </div>
      <Card>
        <CardHeader title="Mentions by centre" description="Eligible unbranded sampled recommendations · click a centre to filter the findings below" />
        <div className="h-[240px] px-3 pb-2 pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3eaf1', fontSize: 12.5 }} />
              <Legend verticalAlign="top" align="right" height={28} iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12.5, color: '#4a5a70' }} />
              <Bar dataKey="Mentioned" stackId="a" fill="var(--chart-1)" isAnimationActive={false} cursor="pointer" onClick={(d: { id?: string; payload?: { id?: string } }) => pickCentre(d.payload?.id ?? d.id)} />
              <Bar dataKey="Not mentioned" stackId="a" fill="#cfd8e3" radius={[3, 3, 0, 0]} isAnimationActive={false} cursor="pointer" onClick={(d: { id?: string; payload?: { id?: string } }) => pickCentre(d.payload?.id ?? d.id)} />
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
        <Card className="scroll-mt-24 self-start" id="findings">
          <CardHeader title="Findings" description={`${findings.length} findings: ${opps} discovery opportunities · ${needsRel} need relevance confirmation · ${accFindings.length} accuracy findings (${nConfirmed} confirmed${inputs ? `, ${inputs}` : ''})`} />
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
            <Segmented
              ariaLabel="Sort findings"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'priority', label: 'Highest priority first' },
                { value: 'location', label: 'By location' },
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
                  <Th>Priority</Th>
                  <Th>Location</Th>
                  <Th>Type</Th>
                  <Th>Question</Th>
                  <Th>What we found</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const pr = priorityOf(f, hasFix(f))
                  const act = nextActionOf(f, hasFix(f))
                  return (
                  <Tr key={f.key} onClick={() => setSelected(f.key)} className={cn(selected === f.key && 'bg-brand-soft/40')}>
                    <Td className="whitespace-nowrap">
                      <Badge tone={TIER[pr.tier].tone}>{TIER[pr.tier].label}</Badge>
                      <span className="mt-1 block max-w-[190px] whitespace-normal text-[11.5px] leading-snug text-muted">{pr.reason}</span>
                    </Td>
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
                        accKind(f) === 'confirmed' ? (
                          <>
                            AI said “{f.claim}” · record: {f.v.fact!.value}
                          </>
                        ) : (
                          <>
                            AI said “{f.claim}”
                            <span className="block text-warning">{accKind(f) === 'confusion' ? `May be mixed up with BrightNest ${f.v.issue.entityConfusion}` : 'Needs business verification'}</span>
                          </>
                        )
                      ) : (
                        <StageBadge stage={f.v.stage} />
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(f.key) }}>
                        Details
                      </Button>
                      <Button size="sm" variant="ghost" className="text-brand" onClick={(e) => { e.stopPropagation(); if (act.to) navigate(act.to); else setSelected(f.key) }}>
                        {act.short}
                        <ArrowRight />
                      </Button>
                    </Td>
                  </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
          <div className="border-t border-line px-5 py-3">
            <NotAnErrorNote />
          </div>
        </Card>
        {current && <FindingDetail f={current} hasFix={hasFix(current)} onClose={() => setSelected(null)} />}
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
            CSV & print exports
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
  const [preview, setPreview] = useState(false)
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
          <div className="bg-gradient-to-br from-[#eef4ff] via-white to-[#ecfbfd] px-6 py-7 lg:px-8">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">Understand how AI search represents your locations.</h1>
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
                <>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button variant="primary" size="lg" className="h-12 px-6 text-[15.5px] shadow-pop" onClick={() => setReview(true)}>
                      <ScanSearch />
                      Run AI Visibility Check
                    </Button>
                    <Button size="lg" className="h-12 px-5" onClick={() => setPreview(true)}>
                      View questions & locations
                    </Button>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
                    <Sparkles className="size-4 shrink-0 text-teal-ink" />
                    {locs.length} pilot centres · {prompts.length} questions suggested from your business data · about a minute
                  </p>
                </>
              )}
            </div>
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
              <DM.Root>
                <DM.Trigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Demo options">
                    <MoreHorizontal />
                  </Button>
                </DM.Trigger>
                <DM.Portal>
                  <DM.Content align="end" sideOffset={6} className="z-50 w-[220px] animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
                    <DM.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Demo options</DM.Label>
                    <DM.Item onSelect={() => run(true)} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-body outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink">
                      <PlayCircle className="size-4" />
                      Replay demo
                    </DM.Item>
                  </DM.Content>
                </DM.Portal>
              </DM.Root>
            </>
          }
        />
      )}
      {!latestAudit && !running && <HowItWorks />}
      <ReviewCheckDialog open={review} onOpenChange={setReview} onStart={start} startLabel={matching && matching.id === latestAudit?.id ? 'View latest check' : 'Start check'} />
      <ReviewCheckDialog asSheet open={preview} initialEdit="questions" onOpenChange={setPreview} onStart={() => { setPreview(false); start() }} startLabel={matching && matching.id === latestAudit?.id ? 'View latest check' : 'Run the check'} />
      {latestAudit && !running && <Results />}
    </div>
  )
}
