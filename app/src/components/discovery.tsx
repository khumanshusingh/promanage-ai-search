import { useState } from 'react'
import { BadgeCheck, Check, CircleDashed, CircleHelp, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { DiscoveryOpportunity, DiscoveryRecheck, NotRelevantReason, Observation, OptimizationRecommendation } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { competitorsIn, DISCOVERY_STAGE, NOT_RELEVANT_REASONS, RECHECK_OUTCOME, type EligibilityView } from '@/lib/discovery'
import { useStore } from '@/store/AppStore'
import { buildFacts } from '@/lib/facts'
import { cn, fmtDate } from '@/lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Label, Select, Textarea } from './ui/input'
import { PermButton } from './domain'

export function DiscoveryStageBadge({ opp, recheck, pm }: { opp: DiscoveryOpportunity; recheck?: DiscoveryRecheck | null; pm?: boolean }) {
  if (opp.status === 'rechecked' && recheck) {
    const o = RECHECK_OUTCOME[recheck.outcome]
    return <Badge tone={o.tone}>{pm ? `Rechecked · ${o.label}` : o.brand}</Badge>
  }
  const s = DISCOVERY_STAGE[opp.status]
  return <Badge tone={s.tone}>{pm ? s.pmLabel : s.label}</Badge>
}

export function TrackTag({ kind }: { kind: 'accuracy' | 'discovery' }) {
  return <Badge tone={kind === 'accuracy' ? 'outline' : 'teal'}>{kind === 'accuracy' ? 'Accuracy' : 'Discovery'}</Badge>
}

/** "Does this search match what your centre offers?" — Yes / Not relevant (with reason) / Confirm our services. */
export function RelevanceControls({ locationId, promptId, el, compact }: { locationId: string; promptId: string; el: EligibilityView; compact?: boolean }) {
  const { setEligibility, confirmService, role, can } = useStore()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<NotRelevantReason>(el.suggestion === 'mark_not_relevant' ? 'service_mismatch' : 'other')
  const [note, setNote] = useState('')
  const reviewed = el.source === 'review'
  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
      {el.candidate && el.status === 'unknown' && (
        role === 'brand' ? (
          <PermButton
            perm="confirmService"
            size="sm"
            variant="primary"
            onClick={() => {
              confirmService(locationId, el.candidate!.service)
              toast.success('Service confirmed', { description: `${el.candidate!.service} is now part of the approved record for ${LOCATION_BY_ID[locationId].name}.` })
            }}
          >
            <BadgeCheck />
            Confirm: we offer {el.candidate.service.replace(/ \(.*\)/, '')}
          </PermButton>
        ) : null
      )}
      {el.status !== 'eligible' && !el.candidate && (
        <PermButton
          perm="qualifyDiscovery"
          size="sm"
          onClick={() => {
            setEligibility(locationId, promptId, 'eligible', undefined, role === 'brand' ? 'The centre offers this — confirmed by the Brand' : 'Matches approved facts — confirmed by ProManage')
            toast.success('Marked as a good match')
          }}
        >
          <Check />
          Yes, it’s a good match
        </PermButton>
      )}
      {el.status !== 'not_relevant' ? (
        <PermButton perm="qualifyDiscovery" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Not relevant to this search
        </PermButton>
      ) : (
        reviewed && can('qualifyDiscovery') && (
          <Button size="sm" variant="ghost" onClick={() => { setEligibility(locationId, promptId, null); toast.success('Relevance decision cleared') }}>
            Undo
          </Button>
        )
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Not relevant to this search?"
        description="It will be excluded from the eligible mention rate. The sampled answer is kept as evidence."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setEligibility(locationId, promptId, 'not_relevant', reason, note.trim() || undefined)
                setOpen(false)
                setNote('')
                toast.success('Marked not relevant', { description: 'Excluded from the eligible mention rate. Evidence kept.' })
              }}
            >
              Mark not relevant
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="nr-reason">Reason</Label>
            <Select id="nr-reason" value={reason} onChange={(e) => setReason(e.target.value as NotRelevantReason)}>
              {Object.entries(NOT_RELEVANT_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nr-note" hint="Optional">
              Note
            </Label>
            <Textarea id="nr-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[60px]" />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

/** One sampled unbranded question for a centre: mention state, relevance and (optionally) controls. */
export function QueryRow({ o, el, controls = true, showCompetitors = true }: { o: Observation; el: EligibilityView; controls?: boolean; showCompetitors?: boolean }) {
  const comps = competitorsIn(o)
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        {o.mentioned ? <BadgeCheck className="mt-0.5 size-4 shrink-0 text-teal-ink" /> : <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted" />}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-ink">“{o.query}”</p>
          <p className="mt-0.5 text-[13px] text-body">
            {o.mentioned ? 'Your centre was mentioned in this selected AI answer.' : o.otherBranchName ? `Your centre wasn’t mentioned — ${o.otherBranchName.replace('BrightNest Preschool – ', 'BrightNest ')} was named instead.` : 'Your centre wasn’t mentioned in this selected AI answer.'}
          </p>
          {!o.mentioned && showCompetitors && comps.length > 0 && <p className="mt-0.5 text-[12.5px] text-muted">Named in this answer: {comps.join(', ')}</p>}
          <p className="mt-1 text-[12.5px] text-muted">
            <span className={cn('font-medium', el.status === 'eligible' ? 'text-teal-ink' : el.status === 'not_relevant' ? 'text-body' : 'text-warning')}>
              {el.status === 'eligible' ? 'Matches what the centre offers' : el.status === 'not_relevant' ? 'Not relevant' : 'Does this search match what your centre offers?'}
            </span>
            {' · '}
            {el.basis}
            {el.source === 'review' ? ` · ${el.reviewer}` : ''}
          </p>
        </div>
        <Badge tone={o.mentioned ? 'teal' : 'neutral'}>{o.mentioned ? 'Mentioned' : 'Not mentioned'}</Badge>
      </div>
      {controls && !o.mentioned && el.status !== 'eligible' && (
        <div className="mt-2 pl-7">
          <RelevanceControls locationId={o.locationId} promptId={o.promptId} el={el} />
        </div>
      )}
    </li>
  )
}

export function NotAnErrorNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-[13px] text-body', className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-muted" />
      Not mentioned isn’t necessarily an error. These are sampled responses, not every customer’s AI search, and AI tools choose their own recommendations.
    </p>
  )
}

/** Plain-language current vs proposed information. Technical items never show code to the Brand. */
export function RecommendationCard({ rec, locationId, brand, published }: { rec: OptimizationRecommendation; locationId: string; brand?: boolean; published?: boolean }) {
  const { factEdits } = useStore()
  const facts = buildFacts(locationId, factEdits)
  const claims = rec.businessFactIds.map((id) => facts.find((f) => f.id === id)).filter(Boolean)
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{brand ? rec.brandTitle : rec.title}</p>
          <p className="text-[12.5px] text-muted">
            {rec.controlledSource} · Owner: {rec.owner}
            {!brand && ` · Effort: ${rec.effort} · ${rec.gapConfidence}`}
          </p>
        </div>
        {published && <Badge tone="success">Update recorded (simulated)</Badge>}
      </div>
      <div className="space-y-3 px-4 py-3">
        {rec.channel === 'structured_info' ? (
          <p className="text-[13.5px] text-body">
            {brand ? 'ProManage prepares search-readable technical information from your approved facts. It contains only the facts listed below.' : 'JSON-LD generated in GEO Readiness from verified facts only — reviewed there, attached to the website task on approval.'}
          </p>
        ) : rec.proposedText ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-subtle px-3 py-2.5">
              <p className="text-[12px] font-medium text-muted">{brand ? 'Current info' : 'Current (snapshot)'}</p>
              <p className="mt-1 whitespace-pre-line text-[13.5px] text-body">{rec.currentText ?? 'Not stated'}</p>
            </div>
            <div className="rounded-lg border border-[#bfeef3] bg-teal-soft/50 px-3 py-2.5">
              <p className="text-[12px] font-medium text-teal-ink">{brand ? 'Proposed info' : 'Proposed'}</p>
              <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{rec.proposedText}</p>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-body">No wording change — this is a check for the {rec.owner.toLowerCase()} to confirm.</p>
        )}
        {claims.length > 0 && (
          <div>
            <p className="text-[12.5px] font-medium text-body">{brand ? 'Business facts this uses (you approve these)' : 'Business claims requiring Brand approval'}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {claims.map((f) => (
                <li key={f!.id}>
                  <Badge tone={f!.verificationStatus === 'verified' ? 'outline' : 'warning'} className="max-w-full whitespace-normal">
                    {f!.label}: {f!.value ?? 'not verified'}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rec.dependency && <p className="text-[12.5px] text-warning">{rec.dependency}</p>}
        <p className="text-[12.5px] text-muted">{rec.aiImpactNote}</p>
      </div>
    </div>
  )
}

/** Before/after counts for the same centre, questions, surface and rules — or an honest Inconclusive. */
export function RecheckResult({ rc, brand }: { rc: DiscoveryRecheck; brand?: boolean }) {
  const o = RECHECK_OUTCOME[rc.outcome]
  return (
    <div className={cn('rounded-xl border px-4 py-3', rc.outcome === 'mention_observed' ? 'border-[#c6e8d8] bg-success-soft' : rc.outcome === 'inconclusive' ? 'border-[#f1dcb2] bg-warning-soft' : 'border-line bg-subtle')}>
      <p className="text-[14px] font-semibold text-ink">{brand ? o.brand : `Follow-up ${rc.recheckWave}: ${o.label}`}</p>
      {rc.comparable ? (
        <>
          <p className="tabular mt-1 text-[14px] text-ink">
            Mentioned in <span className="font-semibold">{rc.baselineMentionCount} of {rc.baselineEligibleCount}</span> matching searches before → <span className="font-semibold">{rc.recheckMentionCount} of {rc.recheckEligibleCount}</span> in follow-up {rc.recheckWave}
          </p>
          <p className="mt-0.5 text-[13px] text-body">
            The searches that missed your centre: {rc.targetMentionedAfter} of {rc.targetCount} now mention it · checked {fmtDate(rc.sampledAt)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-body">{rc.nonComparabilityReason}</p>
      )}
      <p className="mt-1 text-[12.5px] text-muted">
        {rc.afterUpdates ? 'Website or listing updates were recorded before this check. ' : 'No updates had been recorded before this check. '}
        This is an observed change in a small sample (one answer per question), not proof the updates caused it.
      </p>
    </div>
  )
}

const STEPS: { label: string; who: string }[] = [
  { label: 'Searches reviewed', who: 'You' },
  { label: 'Information checked', who: 'ProManage' },
  { label: 'Suggested improvements approved', who: 'You' },
  { label: 'Website or listing updates recorded', who: 'Source owners' },
  { label: 'Latest follow-up AI check', who: 'ProManage' },
]

export function DiscoveryProgress({ opp }: { opp: DiscoveryOpportunity }) {
  const order = ['observed', 'eligibility_review', 'qualified', 'investigating', 'proposal_draft', 'awaiting_approval', 'changes_requested', 'implementing', 'awaiting_recheck', 'rechecked']
  const at = order.indexOf(opp.status)
  const noGap = opp.status === 'no_gap'
  const state = (i: number): 'done' | 'current' | 'todo' | 'skipped' => {
    if (noGap) return i <= 1 ? 'done' : i === 4 ? 'current' : 'skipped'
    if (opp.status === 'declined') return i <= 1 ? 'done' : i === 2 ? 'current' : 'todo'
    const thresholds = [2, 5, 7, 8, 9]
    if (at >= thresholds[i]) return 'done'
    if ((i === 0 && at < 2) || (i === 1 && at >= 2 && at < 5) || (i === 2 && at >= 5 && at < 7) || (i === 3 && at === 7) || (i === 4 && at === 8)) return 'current'
    return 'todo'
  }
  return (
    <ol>
      {STEPS.map((s, i) => {
        const st = state(i)
        return (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < STEPS.length - 1 && <span className={cn('absolute left-[11px] top-7 h-[calc(100%-20px)] w-px', st === 'done' ? 'bg-teal' : 'bg-line')} />}
            <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold', st === 'done' ? 'bg-teal text-white' : st === 'current' ? 'bg-brand-soft text-brand ring-1 ring-brand-line' : 'bg-[#eef2f7] text-muted')}>
              {st === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : st === 'current' ? <CircleDashed className="size-3.5" /> : i + 1}
            </span>
            <div>
              <p className={cn('text-[14px] font-medium', st === 'todo' || st === 'skipped' ? 'text-body' : 'text-ink')}>{s.label}</p>
              <p className="text-[13px] text-muted">
                {s.who}
                {st === 'skipped' ? ' · Not needed — no clear information change to make' : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
