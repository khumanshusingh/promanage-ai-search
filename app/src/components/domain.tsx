import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, CircleDashed, CircleHelp, Info, ScanSearch, ShieldAlert, Sparkles } from 'lucide-react'
import type { ClaimEvaluation, ControlledChannel, ExtractedClaim, IssueCategory, Observation, Severity, TaskStatus, VerificationStatus } from '@/data/types'
import type { IssueStatus, Ratio } from '@/lib/metrics'
import { Badge } from './ui/badge'
import { Button, type ButtonProps } from './ui/button'
import { Tip } from './ui/tooltip'
import { cn } from '@/lib/utils'
import { useStore, PERMISSION_HINT, type Permission, taskStatusLabel } from '@/store/AppStore'
import { fmtDateTime } from '@/lib/utils'

export function SampleBadge({ label = 'Sampled answer', className }: { label?: string; className?: string }) {
  const { showSimLabels } = useStore()
  return (
    <Tip content={showSimLabels ? 'Simulated answer from a deterministic demo dataset. Not a real AI response or a view of users’ conversations.' : "One answer sampled for this prompt. AI output varies between runs and is not a view of individual users' conversations."}>
      <span tabIndex={0} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium', showSimLabels ? 'border-dashed border-[#b9c6d6] bg-white text-muted' : 'border-line bg-subtle text-muted', className)}>
        <ScanSearch className="size-3" />
        {showSimLabels ? label.replace('Sampled', 'Simulated') : label}
      </span>
    </Tip>
  )
}

/** Shown only when simulation labels are switched on in presenter controls. */
export function SimTag({ className }: { className?: string }) {
  const { showSimLabels } = useStore()
  if (!showSimLabels) return null
  return <span className={cn('inline-flex items-center rounded-full border border-dashed border-[#b9c6d6] bg-white px-2 py-0.5 text-[11.5px] font-medium text-muted', className)}>Simulated</span>
}

export function SourceBadge() {
  const { showSimLabels } = useStore()
  return (
    <Tip content="Answers sampled from AI search for a fixed set of prompts. Not a view of individual users' conversations; output varies and may differ from consumer app screens.">
      <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-full border border-[#bfeef3] bg-teal-soft px-2.5 py-1 text-[12px] font-medium text-teal-ink">
        <Sparkles className="size-3.5" />
        {showSimLabels ? 'Simulated AI-search observations' : 'Sampled AI search answers'}
        <Info className="size-3 opacity-70" />
      </span>
    </Tip>
  )
}

const VERIFY: Record<VerificationStatus, { label: string; tone: 'success' | 'warning' | 'neutral'; icon: ReactNode }> = {
  verified: { label: 'Verified', tone: 'success', icon: <BadgeCheck /> },
  needs_verification: { label: 'Needs verification', tone: 'warning', icon: <AlertTriangle /> },
  unknown: { label: 'Unknown', tone: 'neutral', icon: <CircleHelp /> },
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFY[status]
  return (
    <Badge tone={v.tone}>
      {v.icon}
      {v.label}
    </Badge>
  )
}

const SEV: Record<Severity, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity]
  return (
    <Badge tone={s.tone}>
      <span className={cn('inline-block size-1.5 rounded-full', severity === 'high' ? 'bg-danger' : severity === 'medium' ? 'bg-warning' : 'bg-[#94a3b8]')} />
      {s.label}
    </Badge>
  )
}

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  factual_mismatch: 'Factual mismatch',
  discovery_gap: 'Potential discovery gap',
  unsupported_claim: 'Unsupported claim',
  source_inconsistency: 'Inconsistent source content',
  unknown_fact: 'Unknown fact',
}

export const ISSUE_STATUS: Record<IssueStatus, { label: string; tone: 'warning' | 'blue' | 'danger' | 'neutral' | 'teal' | 'success' }> = {
  needs_review: { label: 'Potential', tone: 'warning' },
  needs_verification: { label: 'Needs verification', tone: 'warning' },
  investigating: { label: 'Investigating', tone: 'blue' },
  confirmed: { label: 'Confirmed · unactioned', tone: 'danger' },
  dismissed: { label: 'Not an issue', tone: 'neutral' },
  in_task: { label: 'Source action in progress', tone: 'blue' },
  external_pending: { label: 'External correction pending', tone: 'warning' },
  awaiting_recheck: { label: 'Awaiting AI recheck', tone: 'warning' },
  monitoring: { label: 'Unresolved externally · monitoring', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'success' },
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const s = ISSUE_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const TASK_TONE: Record<TaskStatus, 'neutral' | 'blue' | 'teal' | 'success' | 'warning'> = {
  open: 'neutral',
  in_progress: 'blue',
  prepared: 'blue',
  approved: 'teal',
  source_updated: 'success',
  awaiting_recheck: 'warning',
  closed: 'success',
}

export function TaskStatusBadge({ status, channel = 'owned_website' }: { status: TaskStatus; channel?: ControlledChannel }) {
  const { showSimLabels } = useStore()
  const tone = channel === 'external_request' && status === 'source_updated' ? 'warning' : TASK_TONE[status]
  let label = taskStatusLabel(status, channel)
  if (!showSimLabels) label = label.replace(' (simulated)', '')
  return <Badge tone={tone}>{label}</Badge>
}

/** Original and recheck answers side by side. The original is never modified. */
export function AnswerCompare({ before, after, brandName, outcome }: { before: Observation; after: Observation; brandName: string; outcome?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[
        { o: before, title: 'Original sample', tone: 'border-line' },
        { o: after, title: `Recheck ${after.wave}`, tone: 'border-brand-line' },
      ].map(({ o, title, tone }) => (
        <div key={o.id} className={cn('rounded-lg border bg-white', tone)}>
          <div className="flex items-center justify-between gap-2 border-b border-line bg-subtle px-3.5 py-2">
            <p className="text-[12.5px] font-semibold text-ink">{title}</p>
            <p className="text-[11.5px] text-muted">{fmtDateTime(o.sampledAt)}</p>
          </div>
          <div className="px-3.5 py-3">
            <AnswerText text={o.answerText} claims={o.extractedClaims} brandName={brandName} />
            <p className="mt-2 text-[11.5px] text-muted">{o.citations.length ? `Cites ${o.citations.map((c) => c.url).join(', ')}` : 'No citations — source unknown'}</p>
          </div>
        </div>
      ))}
      {outcome && <div className="md:col-span-2">{outcome}</div>}
    </div>
  )
}

const EVAL: Record<ClaimEvaluation, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral'; icon: ReactNode }> = {
  match: { label: 'Matches verified record', tone: 'success', icon: <BadgeCheck /> },
  mismatch: { label: 'Potential mismatch', tone: 'danger', icon: <ShieldAlert /> },
  cannot_evaluate: { label: 'Cannot evaluate', tone: 'warning', icon: <CircleDashed /> },
  unverifiable: { label: 'Not in record', tone: 'warning', icon: <CircleHelp /> },
}

export function EvaluationBadge({ evaluation }: { evaluation: ClaimEvaluation }) {
  const e = EVAL[evaluation]
  return (
    <Badge tone={e.tone}>
      {e.icon}
      {e.label}
    </Badge>
  )
}

export function MentionBadge({ mentioned, branded, brandOnly }: { mentioned: boolean; branded?: boolean; brandOnly?: boolean }) {
  if (branded) return null
  if (!mentioned && brandOnly)
    return (
      <Tip content="A different BrightNest branch was named. Brand-level only — not counted as a mention of this location.">
        <span tabIndex={0}>
          <Badge tone="warning">Brand only</Badge>
        </span>
      </Tip>
    )
  return mentioned ? (
    <Badge tone="teal">
      <BadgeCheck />
      Mentioned
    </Badge>
  ) : (
    <Badge tone="neutral">Not mentioned</Badge>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">{eyebrow}</div>}
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function KpiCard({ label, value, detail, definition, icon, tone = 'blue', footer }: { label: string; value: ReactNode; detail?: ReactNode; definition: string; icon: ReactNode; tone?: 'blue' | 'teal' | 'danger' | 'warning' | 'neutral'; footer?: ReactNode }) {
  const toneCls = {
    blue: 'bg-brand-soft text-brand',
    teal: 'bg-teal-soft text-teal-ink',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-subtle text-muted',
  }[tone]
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-h-7 min-w-0 items-center gap-1.5">
          <span className="text-[13px] font-medium leading-snug text-body">{label}</span>
          <Tip content={definition}>
            <button className="shrink-0 text-[#9aa6b6] hover:text-muted" aria-label={`Definition: ${label}`}>
              <Info className="size-3.5" />
            </button>
          </Tip>
        </div>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-4', toneCls)}>{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</span>
        {detail && <span className="tabular text-[13px] text-muted">{detail}</span>}
      </div>
      {footer && <div className="mt-3 text-[12.5px] text-muted">{footer}</div>}
    </div>
  )
}

export function RatioText({ r }: { r: Ratio }) {
  return (
    <span className="tabular">
      {r.pct === null ? '—' : `${Math.round(r.pct)}%`} <span className="text-muted">({r.num} of {r.den})</span>
    </span>
  )
}

/** Button that stays visible but disabled (with an explanation) when the current role lacks permission. */
export function PermButton({ perm, children, ...props }: ButtonProps & { perm: Permission }) {
  const { can } = useStore()
  const allowed = can(perm)
  const btn = (
    <Button {...props} disabled={!allowed || props.disabled}>
      {children}
    </Button>
  )
  if (allowed) return btn
  return (
    <Tip content={PERMISSION_HINT[perm]}>
      <span tabIndex={0} className="inline-flex">
        {btn}
      </span>
    </Tip>
  )
}

export function ComingSoon({ title, description, bullets }: { feature?: string; title: string; description: string; bullets: string[] }) {
  return (
    <div className="mx-auto max-w-[640px] py-10">
      <div className="rounded-xl border border-line bg-surface p-8 shadow-card">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Sparkles className="size-5" />
          </span>
          <div>
            <Badge tone="blue">Coming soon</Badge>
            <h2 className="mt-1 text-[18px] font-semibold text-ink">{title}</h2>
          </div>
        </div>
        <p className="text-[14px] text-body">{description}</p>
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2 text-[13.5px] text-body">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[13.5px] text-body">Available in a later phase of this pilot. Your data is kept; nothing here needs action today.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" asChild>
            <Link to="/overview">Back to overview</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Render a sampled answer with brand mentions and extracted claims highlighted. */
export function AnswerText({ text, claims, activeClaimId, brandName, otherBrandName, onClaimClick }: { text: string; claims: ExtractedClaim[]; activeClaimId?: string; brandName?: string; otherBrandName?: string; onClaimClick?: (id: string) => void }) {
  const lines = text.split('\n')
  const markers = [
    ...claims.map((c) => ({ span: c.span, claim: c })),
    ...(brandName ? [{ span: brandName, claim: null as ExtractedClaim | null }] : []),
    ...(otherBrandName ? [{ span: otherBrandName, claim: null as ExtractedClaim | null, other: true }] : []),
  ].filter((m) => m.span) as { span: string; claim: ExtractedClaim | null; other?: boolean }[]

  const renderSegment = (seg: string, key: string): ReactNode[] => {
    const out: ReactNode[] = []
    let rest = seg
    let i = 0
    while (rest.length) {
      let best: { idx: number; m: (typeof markers)[number] } | null = null
      for (const m of markers) {
        const idx = rest.indexOf(m.span)
        if (idx >= 0 && (!best || idx < best.idx)) best = { idx, m }
      }
      if (!best) {
        out.push(rest)
        break
      }
      if (best.idx > 0) out.push(rest.slice(0, best.idx))
      const { m } = best
      if (m.claim) {
        const c = m.claim
        const tone =
          c.evaluation === 'mismatch'
            ? 'bg-danger-soft text-danger ring-1 ring-[#f2c9ce]'
            : c.evaluation === 'match'
              ? 'bg-success-soft text-success ring-1 ring-[#c6e8d8]'
              : 'bg-warning-soft text-warning ring-1 ring-[#f1dcb2]'
        out.push(
          <button
            key={`${key}-${i++}`}
            onClick={() => onClaimClick?.(c.id)}
            className={cn('claim-mark font-medium', tone, activeClaimId === c.id && 'ring-2 ring-brand')}
            title={`${c.label}: ${c.evaluation.replace('_', ' ')}`}
          >
            {m.span}
          </button>,
        )
      } else {
        out.push(
          <mark key={`${key}-${i++}`} className={cn('claim-mark font-semibold', m.other ? 'bg-warning-soft text-warning' : 'bg-teal-soft text-teal-ink')} title={m.other ? 'Different BrightNest branch — brand-level mention' : undefined}>
            {m.span}
          </mark>,
        )
      }
      rest = rest.slice(best.idx + m.span.length)
    }
    return out
  }

  const renderLine = (line: string, li: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return parts.flatMap((p, pi): ReactNode[] => {
      const bold = p.startsWith('**') && p.endsWith('**')
      const inner = bold ? p.slice(2, -2) : p
      const nodes = renderSegment(inner, `${li}-${pi}`)
      return bold ? [<strong key={`b-${li}-${pi}`} className="font-semibold text-ink">{nodes}</strong>] : nodes
    })
  }

  return (
    <div className="space-y-1 text-[14px] leading-[1.7] text-body">
      {lines.map((line, li) => {
        if (!line.trim()) return <div key={li} className="h-2" />
        const m = line.match(/^(\d+)\.\s(.*)$/)
        if (m) {
          return (
            <div key={li} className="flex gap-2.5 pl-1">
              <span className="tabular w-4 shrink-0 text-right text-muted">{m[1]}.</span>
              <span>{renderLine(m[2], li)}</span>
            </div>
          )
        }
        return <p key={li}>{renderLine(line, li)}</p>
      })}
    </div>
  )
}
