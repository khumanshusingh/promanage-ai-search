import { useState } from 'react'
import { Archive, Crosshair, Pause, Play, RotateCcw, Target } from 'lucide-react'
import { toast } from 'sonner'
import type { PrioritySearchGoal } from '@/data/types'
import { LOCATION_BY_ID, PILOT_IDS } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { isUnbranded } from '@/lib/discovery'
import { Card, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { FieldError, Input, Label, Select } from './ui/input'
import { EvidenceDisclosure } from './brand'
import { fmtDate } from '@/lib/utils'

/** What we can honestly say about a goal: linked seeded evidence for the exact question, or awaiting a first check. */
export function useGoalEvidence(goal: PrioritySearchGoal | undefined) {
  const { latestAudit, observationsFor, promptsById, rechecksFor, hasRelease } = useStore()
  const { eligibility } = useDiscovery()
  if (!goal || !latestAudit) return null
  const loc = goal.locationIds[0]
  const inScope = latestAudit.locationIds.includes(loc) && !!goal.promptId && latestAudit.promptIds.includes(goal.promptId)
  if (!inScope) return { exact: null, variants: [], accuracy: [], waves: [] as { wave: number; mentioned: boolean }[] }
  const base = observationsFor(latestAudit.id, 0).filter((o) => o.locationId === loc)
  const exact = base.find((o) => o.promptId === goal.promptId)!
  const waves = hasRelease('V2') ? rechecksFor(latestAudit.id).map((r) => ({ wave: r.wave, mentioned: !!observationsFor(latestAudit.id, r.wave).find((o) => o.locationId === loc && o.promptId === goal.promptId)?.mentioned })) : []
  return {
    exact,
    eligibility: eligibility(loc, goal.promptId!),
    // Related variants and accuracy checks are kept separate — never blended into the exact-question count.
    variants: base.filter((o) => o.promptId !== goal.promptId && isUnbranded(o, promptsById)),
    accuracy: base.filter((o) => !isUnbranded(o, promptsById)),
    waves,
  }
}

function GoalDetail({ goal }: { goal: PrioritySearchGoal }) {
  const ev = useGoalEvidence(goal)
  const { updateGoal } = useStore()
  const loc = LOCATION_BY_ID[goal.locationIds[0]]
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold text-ink">“{goal.anchorQuestion}”</p>
        <Badge tone="outline">{loc?.name}</Badge>
        <Badge tone={goal.status === 'active' ? 'teal' : 'neutral'}>{goal.status === 'active' ? 'Active' : goal.status === 'paused' ? 'Paused' : 'Archived'}</Badge>
        <span className="text-[12px] text-muted">Version {goal.goalVersion}</span>
      </div>
      {!ev?.exact ? (
        <div className="rounded-lg border border-line bg-subtle px-4 py-3">
          <p className="text-[14px] font-medium text-ink">Awaiting first check — no demo sample for this question</p>
          <p className="mt-0.5 text-[13px] text-body">ProManage will include this exact question in the next check for {loc?.name}. Until a sampled answer exists, there’s no visibility result and no suggested change — nothing is invented.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-line bg-subtle px-4 py-3 text-[13.5px]">
            <p className="font-medium text-ink">Exact question · {ev.exact.mentioned ? 'mentioned' : 'not mentioned'} in the standard check ({fmtDate(ev.exact.sampledAt)})</p>
            <p className="text-body">
              Exact-question sample: {ev.exact.mentioned ? 1 : 0}/1 baseline
              {ev.waves.map((w) => ` · follow-up ${w.wave}: ${w.mentioned ? 1 : 0}/1`)} · relevance: {ev.eligibility?.status === 'eligible' ? 'matches what the centre offers' : ev.eligibility?.status === 'not_relevant' ? 'not relevant' : 'needs confirmation'}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              Kept separate: {ev.variants.length} related general questions ({ev.variants.filter((o) => o.mentioned).length} mentioned) and {ev.accuracy.length} factual accuracy checks for this centre. One answer per question — a small sample, never a guarantee.
            </p>
          </div>
          <EvidenceDisclosure obs={ev.exact} title="View original AI answer for this question" />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {goal.status === 'active' && (
          <Button size="sm" onClick={() => { updateGoal(goal.id, { status: 'paused' }); toast.success('Goal paused') }}>
            <Pause />
            Pause
          </Button>
        )}
        {goal.status !== 'active' && (
          <Button size="sm" onClick={() => { updateGoal(goal.id, { status: 'active' }); toast.success('Goal restored') }}>
            <Play />
            Restore
          </Button>
        )}
        {goal.status !== 'archived' && (
          <Button size="sm" variant="ghost" onClick={() => { updateGoal(goal.id, { status: 'archived' }); toast.success('Goal archived — history kept') }}>
            <Archive />
            Archive
          </Button>
        )}
      </div>
    </div>
  )
}

export function TargetQuestionDialog({ open, onOpenChange, defaultLocationId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultLocationId?: string }) {
  const { saveGoal, latestAudit } = useStore()
  const [locationId, setLocationId] = useState(defaultLocationId ?? 'whitefield')
  const [question, setQuestion] = useState('')
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string>()
  const ids = latestAudit?.locationIds ?? PILOT_IDS
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Target a specific question"
      description="Optional. Choose one centre and the exact question you care about. ProManage uses the same check → improve → measure workflow."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (question.trim().length < 8) return setErr('Write the question as a parent would ask it.')
              const g = saveGoal({ question, locationId, label: label.trim() || undefined })
              toast.success('Visibility goal saved', { description: g.promptId ? 'Linked to the matching question in your standard check.' : 'Awaiting first check — no demo sample for this question yet.' })
              setQuestion('')
              setLabel('')
              onOpenChange(false)
            }}
          >
            Save visibility goal
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="goal-loc">Centre</Label>
          <Select id="goal-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {LOCATION_BY_ID[id].name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="goal-q">Customer question</Label>
          <Input id="goal-q" value={question} onChange={(e) => { setQuestion(e.target.value); setErr(undefined) }} placeholder="e.g. Best preschools in Whitefield for three-year-olds?" />
          <FieldError>{err}</FieldError>
        </div>
        <div>
          <Label htmlFor="goal-label" hint="Optional">
            Label
          </Label>
          <Input id="goal-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Whitefield toddler admissions" />
        </div>
        <p className="text-[12.5px] text-muted">We can’t make AI assistants recommend a centre every time. We’ll check this question, suggest truthful improvements if we find a real gap, and measure it separately.</p>
      </div>
    </Dialog>
  )
}

/** Secondary, after the standard check: focus on one customer question. Never the main onboarding path. */
export function FocusOnQuestion() {
  const { goals, selectedGoalId, selectGoal } = useStore()
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const selected = goals.find((g) => g.id === selectedGoalId)
  const list = goals.filter((g) => showArchived || g.status !== 'archived')
  return (
    <Card id="focus">
      <CardHeader
        title={<span className="flex items-center gap-2"><Crosshair className="size-4 text-teal-ink" />Want to focus on one particular AI question?</span>}
        description="Optional — after the standard check. Same workflow, measured separately."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Target />
            Target a specific question
          </Button>
        }
      />
      {list.length > 0 && (
        <ul className="divide-y divide-line">
          {list.map((g) => (
            <li key={g.id}>
              <button onClick={() => selectGoal(selectedGoalId === g.id ? null : g.id)} aria-expanded={selectedGoalId === g.id} className="flex w-full flex-wrap items-center gap-2 px-5 py-3 text-left hover:bg-subtle">
                <span className="min-w-0 flex-1 text-[14px] text-ink">{g.label ? `${g.label} · ` : ''}“{g.anchorQuestion}”</span>
                <Badge tone="outline">{LOCATION_BY_ID[g.locationIds[0]]?.neighborhood}</Badge>
                <Badge tone={g.promptId ? 'teal' : 'neutral'}>{g.promptId ? 'Linked to standard check' : 'Awaiting first check'}</Badge>
                {g.status !== 'active' && <Badge tone="neutral">{g.status}</Badge>}
              </button>
              {selected?.id === g.id && <GoalDetail goal={g} />}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-2.5 text-[12.5px] text-muted">
        <button className="inline-flex items-center gap-1 font-medium text-brand hover:underline" onClick={() => setShowArchived((v) => !v)}>
          <RotateCcw className="size-3.5" />
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
        Goals don’t change your standard check — it stays the default view.
      </div>
      <TargetQuestionDialog open={open} onOpenChange={setOpen} />
    </Card>
  )
}
