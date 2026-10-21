import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Issue, PlanItem, SourceRecord } from '@/data/types'
import { channelTarget, LOCATION_BY_ID } from '@/data/seed'
import { effectiveLocation } from '@/lib/facts'
import { FIELD_PHRASE } from '@/lib/brandStatus'
import { useStore } from '@/store/AppStore'
import { fmtDateTime } from '@/lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardHeader } from './ui/card'
import { Dialog } from './ui/dialog'
import { Checkbox } from './ui/checkbox'
import { FieldError, Label, Textarea } from './ui/input'
import { PermButton, TaskStatusBadge } from './domain'

/** Draft a plain-language plan from the source comparison. Owners and limits are explicit. */
export function suggestPlan(issue: Issue, sources: SourceRecord[], factEdits: Parameters<typeof effectiveLocation>[1]) {
  const loc = LOCATION_BY_ID[issue.locationId]
  const verified = issue.field ? effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value : null
  const phrase = issue.field ? (FIELD_PHRASE[issue.field] ?? issue.field) : 'information'
  const bad = (ch: SourceRecord['channel']) => sources.find((s) => s.channel === ch && issue.field && !s.inaccessible && s.values[issue.field] != null && s.values[issue.field] !== verified)
  const items: PlanItem[] = []
  const where: string[] = []
  if (bad('owned_website')) {
    where.push('your official website')
    items.push({ id: 'web', kind: 'owned_website', title: 'Update the official centre page', owner: 'BrightNest website team', detail: channelTarget('owned_website', issue.locationId) })
    items.push({ id: 'struct', kind: 'structured_info', title: 'Prepare search-readable store information', owner: 'ProManage', detail: 'Verified fact sheet and structured data for the centre page' })
  }
  if (bad('managed_listing')) {
    where.push('your Google Business Profile')
    items.push({ id: 'listing', kind: 'managed_listing', title: 'Update your Google Business Profile', owner: 'ProManage Listing Management', detail: channelTarget('managed_listing', issue.locationId) })
  }
  const dir = bad('external_directory')
  if (dir) {
    where.push(`an independent directory (${dir.label})`)
    items.push({ id: 'dir', kind: 'external_request', title: `Request a correction from ${dir.label}`, owner: 'ProManage', detail: channelTarget('external_request', issue.locationId) })
  }
  const why = where.length
    ? `An AI answer gave the wrong ${phrase} for ${loc.name}. We found inconsistent ${phrase} on ${where.join(' and ')}.`
    : `An AI answer gave the wrong ${phrase} for ${loc.name}. The sources we checked match your information.`
  return { items, why }
}

export function PlanDialog({ issue, open, onOpenChange }: { issue: Issue; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { sourcesFor, factEdits, plans, savePlan } = useStore()
  const suggested = suggestPlan(issue, sourcesFor(issue.locationId), factEdits)
  const existing = plans[issue.id]
  const [why, setWhy] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [err, setErr] = useState<string>()
  const all = [...suggested.items, ...(existing?.items.filter((x) => !suggested.items.some((s) => s.id === x.id)) ?? [])]
  useEffect(() => {
    if (!open) return
    setWhy(existing?.why ?? suggested.why)
    setPicked(existing?.items.map((i) => i.id) ?? suggested.items.map((i) => i.id))
    setErr(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const submit = (send: boolean) => {
    const items = all.filter((i) => picked.includes(i.id))
    if (!items.length) return setErr('Choose at least one update, or record that no source discrepancy was found.')
    if (why.trim().length < 10) return setErr('Explain in a sentence why this is recommended.')
    savePlan(issue.id, { why: why.trim(), items }, send)
    onOpenChange(false)
    toast.success(send ? 'Plan sent to Brand for approval' : 'Plan saved as draft')
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Correction plan"
      description="Written for the Brand: what would change, where, who does it, and what can't be guaranteed."
      className="max-w-[600px]"
      footer={
        <>
          <Button onClick={() => submit(false)}>Save draft</Button>
          <Button variant="primary" onClick={() => submit(true)}>
            <Send />
            Send to Brand for approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="plan-why">Why we're recommending this</Label>
          <Textarea id="plan-why" value={why} onChange={(e) => setWhy(e.target.value)} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink">Recommended updates</p>
          {all.length === 0 ? (
            <p className="rounded-lg border border-line bg-subtle px-3 py-2.5 text-[13px] text-body">No controllable source differs from the verified record. Record “No confirmed source discrepancy found” instead of sending a plan.</p>
          ) : (
            <ul className="space-y-2">
              {all.map((it) => (
                <li key={it.id} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
                  <Checkbox checked={picked.includes(it.id)} onCheckedChange={(c) => setPicked((p) => (c ? [...p, it.id] : p.filter((x) => x !== it.id)))} aria-label={it.title} className="mt-0.5" />
                  <div className="text-[13.5px]">
                    <p className="font-medium text-ink">{it.title}</p>
                    <p className="text-muted">
                      Owner: {it.owner} · {it.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[12.5px] text-muted">Shown to the Brand with: “What this can do: make published information more consistent. What it can’t guarantee: that an AI assistant will change its answer.”</p>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  )
}

/** ProManage workspace for the Brand-facing flow on an issue. */
export function InvestigationPanel({ issue }: { issue: Issue }) {
  const { investigations, plans, tasks, requestInvestigation, completeInvestigation, hasRelease, reviews } = useStore()
  const [planOpen, setPlanOpen] = useState(false)
  if (!hasRelease('V1') || issue.category === 'source_inconsistency') return null
  const inv = investigations[issue.id]
  const plan = plans[issue.id] && plans[issue.id].round === (inv?.round ?? 1) ? plans[issue.id] : undefined
  const planTasks = tasks.filter((t) => plan?.taskIds.includes(t.id))
  const confirmed = reviews[issue.reviewKey]?.status === 'confirmed'
  const lastBrand = plan?.comments.filter((c) => c.by === 'brand' && c.kind !== 'approve').pop()

  return (
    <Card className="mb-6">
      <CardHeader
        title="Investigation & correction plan"
        description="What the Brand sees as “ProManage is investigating” and “Proposed updates”"
        actions={
          <Badge tone={!inv ? 'neutral' : inv.status === 'in_progress' ? 'blue' : inv.status === 'inconclusive' ? 'warning' : 'success'}>
            {!inv ? 'Not requested' : inv.status === 'in_progress' ? `Investigating${inv.round > 1 ? ` · round ${inv.round}` : ''}` : inv.status === 'completed' ? 'Investigation completed' : 'Inconclusive'}
          </Badge>
        }
      />
      <div className="space-y-3 px-5 py-4 text-[13.5px]">
        {!inv ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-body">{confirmed ? 'The Brand confirmed this but hasn’t sent it for review yet.' : 'Waiting for the Brand to confirm the business information.'}</p>
            <PermButton perm="investigate" size="sm" disabled={!confirmed} onClick={() => { requestInvestigation(issue.id, 'Started by ProManage'); toast.success('Investigation started') }}>
              <Search />
              Start investigation
            </PermButton>
          </div>
        ) : (
          <>
            <p className="text-body">
              {inv.history[inv.history.length - 1]?.text} · {fmtDateTime(inv.updatedAt)}
              {inv.finding ? ` · ${inv.finding}` : ''}
            </p>
            {plan && (
              <div className="rounded-lg border border-line bg-subtle px-3 py-2.5">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <ClipboardList className="size-4 text-muted" />
                  Plan · {plan.status === 'awaiting_brand_approval' ? 'Waiting for Brand approval' : plan.status === 'changes_requested' ? 'Brand requested changes' : plan.status === 'declined' ? 'Declined by Brand' : plan.status === 'approved' ? 'Approved by Brand' : 'Draft'}
                </p>
                <ul className="mt-1 list-disc pl-5 text-body">
                  {plan.items.map((it) => (
                    <li key={it.id}>
                      {it.title} — {it.owner}
                    </li>
                  ))}
                </ul>
                {lastBrand && <p className="mt-1.5 text-warning">Brand: “{lastBrand.text}”</p>}
              </div>
            )}
            {planTasks.length > 0 && (
              <ul className="space-y-1">
                {planTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Link to={`/tasks/${t.id}`} className="text-brand hover:underline">
                      {t.id}
                    </Link>
                    <span className="text-body">{t.title}</span>
                    <TaskStatusBadge status={t.status} channel={t.channel} />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to={`/issues/${issue.id}/sources`}>Open source comparison</Link>
              </Button>
              {(!plan || plan.status === 'draft' || plan.status === 'changes_requested') && (
                <PermButton perm="draftPlan" size="sm" variant="primary" onClick={() => setPlanOpen(true)}>
                  {plan ? 'Revise plan' : 'Draft correction plan'}
                </PermButton>
              )}
              {inv.status === 'in_progress' && !plan && (
                <>
                  <PermButton perm="investigate" size="sm" onClick={() => { completeInvestigation(issue.id, 'completed', 'No confirmed source discrepancy found; cause unknown (no citation)'); toast.success('Recorded: no source discrepancy') }}>
                    No source discrepancy found
                  </PermButton>
                  <PermButton perm="investigate" size="sm" variant="ghost" onClick={() => { completeInvestigation(issue.id, 'inconclusive', 'Some sources could not be inspected'); toast('Marked inconclusive') }}>
                    Inconclusive
                  </PermButton>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <PlanDialog issue={issue} open={planOpen} onOpenChange={setPlanOpen} />
    </Card>
  )
}
