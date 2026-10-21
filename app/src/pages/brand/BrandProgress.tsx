import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ListChecks } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { mentionRate } from '@/lib/metrics'
import { STAGE, useBrandViews } from '@/lib/brandStatus'
import { DimensionChips, HowMeasured, StageBadge } from '@/components/brand'
import { PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DiscoveryStageBadge, TrackTag } from '@/components/discovery'
import { RECHECK_OUTCOME } from '@/lib/discovery'
import { useDiscovery } from '@/lib/useDiscovery'
import { LOCATION_BY_ID } from '@/data/seed'

export default function BrandProgress() {
  const { hasRelease, latestAudit, audits, monitoring, rechecksFor, observationsFor, promptsById } = useStore()
  const { views } = useBrandViews()
  const navigate = useNavigate()
  const cohort = audits.find((a) => a.id === monitoring.cohortAuditId) ?? latestAudit
  const rechecks = cohort ? rechecksFor(cohort.id) : []
  const series = useMemo(
    () => (cohort ? [0, ...rechecks.map((r) => r.wave)].map((w) => ({ w, date: w === 0 ? cohort.createdAt : rechecks.find((r) => r.wave === w)!.sampledAt, r: mentionRate(observationsFor(cohort.id, w), promptsById) })) : []),
    [cohort, rechecks, observationsFor, promptsById],
  )
  const tracked = views.filter((v) => !['discovery', 'answer_question', 'verify_fact', 'awaiting_ops', 'not_an_issue'].includes(v.stage))
  const disc = useDiscovery()
  const discTracked = disc.latest.filter((o) => !['observed', 'eligibility_review', 'not_relevant', 'archived'].includes(o.status))

  if (!hasRelease('V1')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Progress" subtitle="Follow changes being handled for your locations." />
        <Card className="p-6">
          <p className="text-[15px] font-semibold text-ink">Progress tracking starts in your next phase</p>
          <p className="mt-1 text-[14px] text-body">Right now you can confirm business information and see it in your reports. Once corrections with ProManage are available, each change will be tracked here — from your approval to the follow-up AI check.</p>
          <Button className="mt-4" asChild>
            <Link to="/attention">Go to Needs My Attention</Link>
          </Button>
        </Card>
      </div>
    )
  }

  // Counted from the latest AI check, independent of where the issue is in the workflow.
  const still = views.filter((v) => v.aiDim === 'Still incorrect' && v.stage !== 'not_an_issue')
  const correct = views.filter((v) => v.aiDim === 'Looks correct' && v.stage !== 'not_an_issue')
  const needReview = new Set(views.filter((v) => STAGE[v.stage].needsBrand).map((v) => v.issue.locationId)).size

  return (
    <div className="animate-fade-in">
      <PageHeader title="Progress" subtitle="What’s being handled, who’s doing it, and what the latest AI check showed." />

      {hasRelease('V2') && cohort && (
        <Card className="mb-6">
          <CardHeader title="How your AI information is changing" description="Comparable follow-up checks for your selected locations" actions={<HowMeasured>Each follow-up asks the same questions about the same centres in the same demo AI search check and compares the answers. One sample per question — answers can vary between checks.</HowMeasured>} />
          {rechecks.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-body">No follow-up check yet. ProManage runs follow-up checks after information updates are completed.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 px-5 py-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Looks correct now', correct.length],
                  ['Still incorrect', still.length],
                  ['Locations needing review', needReview],
                ].map(([k, n]) => (
                  <div key={k} className="rounded-lg border border-line bg-subtle p-3">
                    <p className="text-[13px] text-body">{k}</p>
                    <p className="tabular text-[24px] font-semibold text-ink">{n}</p>
                  </div>
                ))}
                <p className="col-span-3 text-[13px] text-muted">Latest follow-up: {fmtDate(rechecks[rechecks.length - 1].sampledAt)} · {cohort.locationIds.length} locations checked</p>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-body">How often your locations appeared in selected searches</p>
                <ul className="space-y-2">
                  {series.map((s) => (
                    <li key={s.w} className="flex items-center gap-3 text-[13.5px]">
                      <span className="w-28 shrink-0 text-body">{s.w === 0 ? 'First check' : `Follow-up ${s.w}`}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e9eef4]">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${s.r.pct ?? 0}%` }} />
                      </div>
                      <span className="tabular w-24 text-right text-ink">
                        {s.r.num} of {s.r.den}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Changes being handled" description="Your information, the updates, and the latest AI check are tracked separately" />
        {tracked.length + discTracked.length === 0 ? (
          <EmptyState icon={<ListChecks />} title="Nothing being handled yet" description="When you confirm an issue and send it to ProManage, you can follow it here." action={<Button asChild><Link to="/attention">Needs My Attention</Link></Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {tracked.map((v) => (
              <li key={v.issue.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium text-ink">{v.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <TrackTag kind="accuracy" />
                      <StageBadge stage={v.stage} />
                    </div>
                  </div>
                  <Button size="sm" variant={STAGE[v.stage].needsBrand ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/${v.issue.id}`)}>
                    {STAGE[v.stage].cta}
                    <ArrowRight />
                  </Button>
                </div>
                <div className="mt-3">
                  <DimensionChips v={v} />
                </div>
              </li>
            ))}
            {discTracked.map((o) => {
              const own = disc.tasksFor(o)
              const done = own.filter((t) => ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status)).length
              const rc = disc.recheckFor(o)
              const updates = o.status === 'no_gap' ? 'Not needed' : !own.length ? (o.status === 'awaiting_approval' ? 'Waiting for your approval' : 'Not started') : done === own.length ? 'Recorded' : `${done} of ${own.length} recorded`
              const ai = rc ? RECHECK_OUTCOME[rc.outcome].brand : 'No follow-up check yet'
              return (
                <li key={o.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-ink">{LOCATION_BY_ID[o.locationId].name} — being found in AI search</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <TrackTag kind="discovery" />
                        <DiscoveryStageBadge opp={o} recheck={rc} />
                      </div>
                    </div>
                    <Button size="sm" variant={o.status === 'awaiting_approval' ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/discovery/${o.id}`)}>
                      View
                      <ArrowRight />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      ['Website & listing updates', updates],
                      ['Latest AI check', ai],
                    ].map(([k, val]) => (
                      <div key={k} className="rounded-lg border border-line bg-subtle px-3 py-2">
                        <p className="text-[12px] font-medium text-body">{k}</p>
                        <Badge tone={val === 'Recorded' || val.startsWith('Mentioned in the latest') ? 'success' : 'neutral'} className="mt-1">
                          {val}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
