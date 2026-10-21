import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { LOCATION_BY_ID } from '@/data/seed'
import { useDiscovery } from '@/lib/useDiscovery'
import { RecommendationCard } from './discovery'
import { Card, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/misc'
import { fmtDateTime } from '@/lib/utils'

const PLAN_STATE = {
  draft: { label: 'Draft', tone: 'neutral' },
  awaiting_brand_approval: { label: 'Awaiting Brand approval', tone: 'warning' },
  approved: { label: 'Approved by Brand', tone: 'success' },
  changes_requested: { label: 'Changes requested', tone: 'blue' },
  declined: { label: 'Declined', tone: 'neutral' },
} as const

/** GEO Readiness → Content improvements: answer text and FAQs from discovery plans, with diffs. JSON-LD stays in its own tab. */
export function ContentImprovementsTab({ locationId }: { locationId: string }) {
  const { opportunities, record, tasksFor } = useDiscovery()
  const mine = opportunities.filter((o) => o.locationId === locationId)
  const plans = mine.flatMap((o) => {
    const r = record(o.id)
    return [...(r?.previousPlans ?? []), ...(r?.plan ? [r.plan] : [])].map((p) => ({ o, p }))
  })
  if (!plans.length) {
    return (
      <Card>
        <EmptyState
          icon={<PenLine />}
          title="No content improvements yet"
          description="Content improvements come from evidence-backed discoverability investigations. Every factual claim is approved by the Brand before publication."
          action={
            mine[0] ? (
              <Button variant="primary" asChild>
                <Link to={`/discovery/${mine[0].id}`}>Open discoverability investigation</Link>
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }
  return (
    <div className="space-y-5">
      {plans.map(({ o, p }) => {
        const done = new Set(tasksFor(o).filter((t) => ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status)).map((t) => t.recommendationId))
        const s = PLAN_STATE[p.status]
        return (
          <Card key={p.id}>
            <CardHeader
              title={`Improvement plan · round ${p.round}`}
              description={`${LOCATION_BY_ID[locationId].name} · ${o.intentCategory} · updated ${fmtDateTime(p.updatedAt)}`}
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <Button size="sm" asChild>
                    <Link to={`/discovery/${o.id}`}>Investigation</Link>
                  </Button>
                </div>
              }
            />
            <div className="space-y-3 px-5 py-4">
              {p.recommendations
                .filter((r) => r.channel !== 'structured_info')
                .map((r) => (
                  <RecommendationCard key={r.id} rec={r} locationId={locationId} published={done.has(r.id)} />
                ))}
              {p.recommendations.some((r) => r.channel === 'structured_info') && (
                <p className="text-[13px] text-body">
                  Structured data for this plan uses the existing{' '}
                  <Link className="font-medium text-brand hover:underline" to={`/geo-readiness/${locationId}?tab=jsonld`}>
                    JSON-LD
                  </Link>{' '}
                  output — no second schema generator.
                </p>
              )}
              <p className="text-[12px] text-muted">Simulated. Proposed text only reaches a source after Brand approval and a recorded handoff; nothing is published automatically.</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
