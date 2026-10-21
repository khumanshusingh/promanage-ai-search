import { Link } from 'react-router-dom'
import { ArrowRight, Inbox } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID } from '@/data/seed'
import { Card, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { fmtRelative } from '@/lib/utils'

/** ProManage queue of work the Brand has handed over: check requests, investigations and returned plans. */
export function ClientRequests() {
  const { checkRequests, investigations, plans, issueById } = useStore()
  const rows: { key: string; label: string; detail: string; at: string; to: string; cta: string; tone: 'blue' | 'warning' | 'neutral' }[] = []
  for (const r of checkRequests.filter((x) => x.status === 'requested')) {
    rows.push({ key: r.id, label: 'First visibility check requested', detail: r.note ?? 'Set up using the pilot locations', at: r.at, to: `/audits/new?request=${r.id}`, cta: 'Configure & run', tone: 'blue' })
  }
  for (const [id, inv] of Object.entries(investigations)) {
    const issue = issueById[id]
    if (!issue) continue
    const plan = plans[id]
    const loc = LOCATION_BY_ID[issue.locationId].name
    if (plan && plan.round === inv.round && plan.status === 'changes_requested') {
      rows.push({ key: id + 'c', label: `Brand requested plan changes · ${loc}`, detail: plan.comments.filter((c) => c.kind === 'changes').pop()?.text ?? '', at: plan.updatedAt, to: `/issues/${id}`, cta: 'Revise plan', tone: 'warning' })
    } else if (plan && plan.round === inv.round && plan.status === 'declined') {
      rows.push({ key: id + 'd', label: `Brand declined plan · ${loc}`, detail: plan.comments.filter((c) => c.kind === 'decline').pop()?.text ?? '', at: plan.updatedAt, to: `/issues/${id}`, cta: 'Review', tone: 'neutral' })
    } else if (inv.status === 'in_progress' && (!plan || plan.round !== inv.round)) {
      rows.push({ key: id, label: `${inv.round > 1 ? 'Further investigation' : 'Investigate'} · ${loc}`, detail: issue.title, at: inv.updatedAt, to: `/issues/${id}`, cta: 'Investigate', tone: 'blue' })
    }
  }
  rows.sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card className="mb-6">
      <CardHeader title="Client requests" description="Work handed over by BrightNest" actions={<Badge tone={rows.length ? 'blue' : 'neutral'}>{rows.length} open</Badge>} />
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-[14px] text-body">
          <Inbox className="size-4 text-muted" />
          No open requests from the Brand.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{r.label}</p>
                <p className="truncate text-[13px] text-muted">
                  {r.detail} · {fmtRelative(r.at)}
                </p>
              </div>
              <Button size="sm" variant="primary" asChild>
                <Link to={r.to}>
                  {r.cta}
                  <ArrowRight />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
