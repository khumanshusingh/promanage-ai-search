import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, CircleDashed, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Observation } from '@/data/types'
import { LOCATION_BY_ID, PILOT_IDS } from '@/data/seed'
import { STAGE, type BrandStage, type BrandView } from '@/lib/brandStatus'
import { runSimulatedAudit } from '@/services/mockAuditService'
import { useStore } from '@/store/AppStore'
import { cn, fmtDateTime } from '@/lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Textarea, Label } from './ui/input'
import { Progress } from './ui/misc'
import { Tip } from './ui/tooltip'
import { AnswerText, SampleBadge } from './domain'

export function StageBadge({ stage }: { stage: BrandStage }) {
  const s = STAGE[stage]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

/** Five Brand-readable steps aggregated from existing review, investigation, plan, task and recheck records. */
export function ProgressTracker({ v }: { v: BrandView }) {
  const { stage, sourceDim, aiDim } = v
  const order: BrandStage[] = ['send_to_promanage', 'investigating', 'proposal_ready', 'changes_requested', 'update_in_progress', 'awaiting_recheck', 'looks_correct', 'still_incorrect', 'inconclusive']
  const at = order.indexOf(stage)
  const monitoringOnly = stage === 'no_source_found' || sourceDim === 'Not controllable'
  const steps: { label: string; who: string; state: 'done' | 'current' | 'todo' | 'skipped'; note?: string }[] = [
    { label: 'Information confirmed', who: 'You', state: v.factDim === 'Verified' && ['send_to_promanage', ...order].includes(stage) || monitoringOnly ? 'done' : 'current' },
    { label: 'Sources investigated', who: 'ProManage', state: monitoringOnly || at >= 2 ? 'done' : stage === 'investigating' ? 'current' : 'todo' },
    { label: 'Plan approved', who: 'You', state: monitoringOnly ? 'skipped' : at >= 4 ? 'done' : stage === 'proposal_ready' || stage === 'changes_requested' ? 'current' : 'todo', note: monitoringOnly ? 'Not needed — no source to correct' : undefined },
    { label: 'Information updates completed', who: 'Source owners', state: monitoringOnly ? 'skipped' : at >= 5 ? 'done' : stage === 'update_in_progress' ? 'current' : 'todo', note: monitoringOnly ? 'Not needed' : sourceDim === 'Correction requested' ? 'Correction requested from an external site' : undefined },
    { label: 'Latest AI check reviewed', who: 'ProManage', state: v.aiDim !== 'Not rechecked' ? 'done' : stage === 'awaiting_recheck' || monitoringOnly ? 'current' : 'todo', note: aiDim !== 'Not rechecked' ? STAGE[stage].label : undefined },
  ]
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className={cn('absolute left-[11px] top-7 h-[calc(100%-20px)] w-px', s.state === 'done' ? 'bg-teal' : 'bg-line')} />}
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
              s.state === 'done' ? 'bg-teal text-white' : s.state === 'current' ? 'bg-brand-soft text-brand ring-1 ring-brand-line' : s.state === 'skipped' ? 'bg-subtle text-muted ring-1 ring-line' : 'bg-[#eef2f7] text-muted',
            )}
          >
            {s.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : s.state === 'current' ? <CircleDashed className="size-3.5" /> : i + 1}
          </span>
          <div>
            <p className={cn('text-[14px] font-medium', s.state === 'todo' || s.state === 'skipped' ? 'text-body' : 'text-ink')}>{s.label}</p>
            <p className="text-[13px] text-muted">
              {s.who}
              {s.note ? ` · ${s.note}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Three independent dimensions — a completed update never implies the AI answer changed. */
export function DimensionChips({ v }: { v: BrandView }) {
  const tone = (x: string) =>
    ['Verified', 'Completed', 'Looks correct'].includes(x) ? 'success' : ['Still incorrect'].includes(x) ? 'danger' : ['Needs verification', 'Inconclusive', 'Correction requested'].includes(x) ? 'warning' : 'neutral'
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {[
        ['Your information', v.factDim],
        ['Information updates', v.sourceDim],
        ['Latest AI check', v.aiDim],
      ].map(([k, val]) => (
        <div key={k} className="rounded-lg border border-line bg-subtle px-3 py-2">
          <p className="text-[12px] font-medium text-body">{k}</p>
          <Badge tone={tone(val) as never} className="mt-1">
            {val}
          </Badge>
        </div>
      ))}
    </div>
  )
}

export function FactComparison({ ai, record, recordNote }: { ai: ReactNode; record: ReactNode; recordNote?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-line sm:grid-cols-2">
      <div className="bg-warning-soft/50 p-5">
        <p className="text-[13px] font-medium text-body">AI answer said</p>
        <p className="mt-1 text-[20px] font-semibold leading-snug text-ink">{ai}</p>
      </div>
      <div className="border-t border-line bg-white p-5 sm:border-l sm:border-t-0">
        <p className="text-[13px] font-medium text-body">Your business record says</p>
        <p className="mt-1 text-[20px] font-semibold leading-snug text-ink">{record}</p>
        {recordNote && <p className="mt-1 text-[13px] text-muted">{recordNote}</p>}
      </div>
    </div>
  )
}

/** Progressive disclosure for the full sampled answer — keeps evidence, timestamp and limits close to the answer. */
export function EvidenceDisclosure({ obs, title = 'See original AI answer & evidence', later }: { obs: Observation; title?: string; later?: Observation }) {
  const [open, setOpen] = useState(false)
  const loc = LOCATION_BY_ID[obs.locationId]
  const brandName = `BrightNest Preschool – ${loc.neighborhood}`
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[14px] font-medium text-ink hover:bg-subtle">
        {title}
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-5 py-4">
          {[obs, ...(later ? [later] : [])].map((o) => (
            <div key={o.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-body">
                <span className="font-medium text-ink">{o.wave === 0 ? 'Original check' : `Follow-up check ${o.wave}`}</span>
                <span>· {fmtDateTime(o.sampledAt)}</span>
                <span>· Demo AI search check</span>
                <SampleBadge />
              </div>
              <p className="mb-2 text-[13px] text-body">Question asked: “{o.query}”</p>
              <div className="rounded-lg border border-line bg-subtle px-4 py-3">
                <AnswerText text={o.answerText} claims={o.extractedClaims} brandName={brandName} />
              </div>
              <p className="mt-2 text-[13px] text-body">{o.citations.length ? `Sources cited: ${o.citations.map((c) => c.title).join(', ')}` : 'This sampled answer did not cite a source.'}</p>
            </div>
          ))}
          <p className="text-[13px] text-muted">These findings come from selected AI searches. AI responses can vary between checks.</p>
        </div>
      )}
    </div>
  )
}

export function HowMeasured({ children }: { children: ReactNode }) {
  return (
    <Tip content={children}>
      <button className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline" aria-label="How measured">
        <Info className="size-3.5" />
        How measured
      </button>
    </Tip>
  )
}

/** First-run: ask ProManage to set up a check, or run the standard pilot check now (simulated). */
export function RequestCheckDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { requestCheck, createAudit, can } = useStore()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [running, setRunning] = useState<number | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => running === null && onOpenChange(o)}
      title="Request your first visibility check"
      description="ProManage can set up the first check using your existing location information."
      footer={
        running === null ? (
          <>
            <Button
              onClick={async () => {
                setRunning(0)
                await runSimulatedAudit(80, (p) => setRunning(p.stage === 'complete' ? 100 : p.stage === 'running' ? 10 + (p.completed / p.total) * 75 : p.stage === 'extracting' ? 92 : 4))
                const a = createAudit({ name: 'Bengaluru pilot — first check', locationIds: PILOT_IDS, promptIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], mode: 'self-serve' })
                setRunning(null)
                onOpenChange(false)
                toast.success('Your first check is ready', { description: '10 pilot centres checked.' })
                navigate(`/audits/${a.id}`)
              }}
              disabled={!can('runAudit')}
            >
              Run the standard check now
            </Button>
            <Button
              variant="primary"
              disabled={!can('requestCheck')}
              onClick={() => {
                requestCheck(note.trim() || undefined)
                onOpenChange(false)
                setNote('')
                toast.success('Request sent to ProManage', { description: 'They’ll set up the check and the results will appear here.' })
              }}
            >
              Ask ProManage to set it up
            </Button>
          </>
        ) : undefined
      }
    >
      {running === null ? (
        <div className="space-y-3 text-[14px] text-body">
          <p>
            We’ll check your <span className="font-medium text-ink">10 Bengaluru pilot centres</span> with 8 common questions parents ask AI assistants — 5 general searches and 3 about your centres’ details.
          </p>
          <div>
            <Label htmlFor="req-note" hint="Optional">
              Anything ProManage should know?
            </Label>
            <Textarea id="req-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please include our newest centres." className="min-h-[60px]" />
          </div>
        </div>
      ) : (
        <div className="py-2">
          <p className="flex items-center gap-2 text-[14px] text-ink">
            <Loader2 className="size-4 animate-spin text-brand" />
            Checking your centres…
          </p>
          <Progress value={running} className="mt-3 h-2" />
        </div>
      )}
    </Dialog>
  )
}
