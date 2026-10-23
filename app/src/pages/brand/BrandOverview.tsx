import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, Compass, HelpCircle, ScanSearch } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, ORG } from '@/data/seed'
import { confirmedMismatches, fmtPct, mentionRate } from '@/lib/metrics'
import { STAGE, useBrandViews, type BrandView } from '@/lib/brandStatus'
import { HowMeasured, RequestCheckDialog, StageBadge } from '@/components/brand'
import { PageHeader, SeverityBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate, fmtRelative } from '@/lib/utils'
import { brandNeedsAction, useDiscovery } from '@/lib/useDiscovery'
import { BrandDiscoveryRows } from './BrandDiscovery'

const SEV = { high: 0, medium: 1, low: 2 }

export function IssueRow({ v, cta }: { v: BrandView; cta?: string }) {
  const navigate = useNavigate()
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{v.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {v.issue.severity === 'high' && v.stage !== 'answer_question' && v.stage !== 'verify_fact' ? <SeverityBadge severity="high" /> : null}
          <StageBadge stage={v.stage} />
        </div>
      </div>
      <Button size="sm" variant={STAGE[v.stage].needsBrand ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/${v.issue.id}`)}>
        {cta ?? STAGE[v.stage].cta}
        <ArrowRight />
      </Button>
    </li>
  )
}

export default function BrandOverview() {
  const { latestAudit, audits, observationsFor, promptsById, reviews, activity, checkRequests, hasRelease } = useStore()
  const { views } = useBrandViews()
  const [params] = useSearchParams()
  const [requestOpen, setRequestOpen] = useState(params.get('request') === '1')
  const navigate = useNavigate()

  const obs = useMemo(() => (latestAudit ? observationsFor(latestAudit.id) : []), [latestAudit, observationsFor])
  const latest = views.filter((v) => v.issue.auditId === latestAudit?.id)
  const attention = latest.filter((v) => STAGE[v.stage].needsBrand).sort((a, b) => SEV[a.issue.severity] - SEV[b.issue.severity])
  const handled = latest.filter((v) => ['investigating', 'changes_requested', 'update_in_progress', 'awaiting_recheck', 'no_source_found'].includes(v.stage))
  const toReview = latest.filter((v) => v.stage !== 'discovery' && ['answer_question', 'verify_fact', 'awaiting_ops'].includes(v.stage)).length
  const confirmed = confirmedMismatches(obs, reviews)
  const rate = mentionRate(obs, promptsById)
  const pending = checkRequests.find((r) => r.status === 'requested')
  const disc = useDiscovery()
  const discNeeds = disc.latest.filter((o) => brandNeedsAction(o, !!disc.record(o.id)?.confirmRequested))

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Your AI Visibility Overview" subtitle="See how your locations appear in sampled AI answers and what needs your attention." />
        <Card className="p-8">
          <div className="max-w-xl">
            <h2 className="text-[20px] font-semibold text-ink">No AI visibility check has been run yet.</h2>
            <p className="mt-2 text-[15px] text-body">ProManage can help set up the first check using your existing location information. You’ll see what AI answers say about your centres and what needs your attention.</p>
            {pending ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft px-4 py-3">
                <Clock className="mt-0.5 size-4 text-brand" />
                <div>
                  <p className="text-[14px] font-medium text-ink">Request sent to ProManage · {fmtDate(pending.at)}</p>
                  <p className="text-[13px] text-body">ProManage is setting up your first check. Results will appear here.</p>
                </div>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" onClick={() => setRequestOpen(true)}>
                {pending ? 'Run the check myself' : 'Request first visibility check'}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                <HelpCircle />
                How this works
              </Button>
            </div>
          </div>
          <ol id="how-it-works" className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ['Check', 'We ask AI assistants common questions about your centres.'],
              ['Confirm', 'You confirm whether the information they gave is correct.'],
              ['Fix', 'ProManage proposes updates to sources you control; you approve them.'],
              ['Follow up', 'We check again later and show what changed — without promising results.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-line bg-subtle p-4">
                <p className="text-[14px] font-semibold text-ink">
                  {i + 1}. {t}
                </p>
                <p className="mt-1 text-[13px] text-body">{d}</p>
              </li>
            ))}
          </ol>
        </Card>
        <RequestCheckDialog open={requestOpen} onOpenChange={setRequestOpen} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Your AI Visibility Overview"
        subtitle="See how your locations appear in sampled AI answers and what needs your attention."
        actions={
          <Button asChild>
            <Link to={`/audits/${latestAudit.id}`}>
              <ScanSearch />
              See latest check
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="What needs your attention"
              description={attention.length + discNeeds.length ? `${attention.length + discNeeds.length} item${attention.length + discNeeds.length > 1 ? 's' : ''} waiting for you` : undefined}
              actions={
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/attention">View all</Link>
                </Button>
              }
            />
            {attention.length + discNeeds.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title="Nothing needs you right now" description="We’ll list anything that needs your confirmation or approval here." className="py-8" />
            ) : (
              <>
                {discNeeds.length > 0 && <BrandDiscoveryRows opps={discNeeds} />}
                {attention.length > 0 && (
                  <ul className={discNeeds.length ? 'divide-y divide-line border-t border-line' : 'divide-y divide-line'}>
                    {attention.slice(0, 6).map((v) => (
                      <IssueRow key={v.issue.id} v={v} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="What's being handled" description="ProManage and your source owners are working on these" />
            {!hasRelease('V1') ? (
              <p className="px-5 py-4 text-[14px] text-body">Correction handling with ProManage becomes available in your next phase. For now, confirmed issues appear in your reports.</p>
            ) : handled.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-body">Nothing in progress yet. When you confirm an issue and send it to ProManage, it appears here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {handled.map((v) => (
                  <IssueRow key={v.issue.id} v={v} />
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Locations checked', value: `${new Set(obs.map((o) => o.locationId)).size} of ${ORG.totalLocationCount}`, note: 'Pilot centres' },
              { label: 'Information to review', value: String(toReview), note: 'Flagged, not yet confirmed' },
              { label: 'Confirmed information problems', value: String(confirmed), note: 'Confirmed by your team' },
              { label: 'How often your locations appeared', value: fmtPct(rate), note: `${rate.num} of ${rate.den} selected searches` },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <p className="text-[13px] font-medium text-body">{m.label}</p>
                <p className="tabular mt-1.5 text-[24px] font-semibold text-ink">{m.value}</p>
                <p className="text-[13px] text-muted">{m.note}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <HowMeasured>Based on one sampled answer for each selected question and centre in a demo AI search check — not all customer AI conversations. AI responses can vary.</HowMeasured>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent progress" />
            {activity.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-body">Updates will appear here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="text-[13.5px] text-ink">{plainActivity(a.text)}</p>
                    <p className="text-[12.5px] text-muted">{fmtRelative(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Past checks" />
            <ul className="divide-y divide-line">
              {[...audits].reverse().map((a) => (
                <li key={a.id}>
                  <button onClick={() => navigate(`/audits/${a.id}`)} className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-subtle">
                    <span>
                      <span className="block text-[13.5px] font-medium text-ink">{fmtDate(a.createdAt)}</span>
                      <span className="block text-[12.5px] text-muted">{a.locationIds.length} centres · {a.locationIds.slice(0, 3).map((id) => LOCATION_BY_ID[id].neighborhood).join(', ')}…</span>
                    </span>
                    <ArrowRight className="size-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <DiscoveryCard />
        </div>
      </div>
    </div>
  )
}

/** Discovery opportunities — kept separate from information problems; observations, not errors. */
function DiscoveryCard() {
  const { latestAudit, hasRelease } = useStore()
  const { latest, metricsFor, record } = useDiscovery()
  const navigate = useNavigate()
  if (!latestAudit) return null
  const m = metricsFor(latestAudit.id)
  const worth = latest.filter((o) => !['observed', 'eligibility_review', 'not_relevant', 'archived'].includes(o.status))
  const awaiting = latest.filter((o) => o.status === 'awaiting_approval')
  const handling = latest.filter((o) => ['investigating', 'proposal_draft', 'changes_requested', 'implementing', 'awaiting_recheck'].includes(o.status))
  const toReview = latest.filter((o) => o.status === 'observed' || o.status === 'eligibility_review')
  const cta = awaiting[0]
    ? { label: 'Review suggested improvements', to: `/attention/discovery/${awaiting[0].id}`, primary: true }
    : toReview[0]
      ? { label: hasRelease('V1') ? 'Ask ProManage to investigate' : 'Review searches', to: `/attention/discovery/${(toReview.find((o) => o.eligibility === 'eligible') ?? toReview[0]).id}`, primary: !!latest.find((o) => record(o.id)?.confirmRequested) }
      : { label: 'See discovery opportunities', to: '/attention?type=discovery', primary: false }
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Compass className="size-4 text-teal-ink" />Being found in AI search</span>} description="Opportunities — separate from information problems" />
      <dl className="divide-y divide-line text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
          <dt className="text-body">Selected searches where your centres weren’t mentioned</dt>
          <dd className="tabular whitespace-nowrap font-semibold text-ink">{m.notMentioned} of {m.total}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
          <dt className="text-body">Mentioned in searches that match what centres offer</dt>
          <dd className="tabular whitespace-nowrap font-semibold text-ink">{m.eligibleMentioned} of {m.eligible}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
          <dt className="text-body">Locations worth reviewing</dt>
          <dd className="tabular font-semibold text-ink">{worth.length}</dd>
        </div>
        {hasRelease('V1') && (
          <>
            <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
              <dt className="text-body">Improvements awaiting your approval</dt>
              <dd className="tabular font-semibold text-ink">{awaiting.length}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
              <dt className="text-body">Updates being handled</dt>
              <dd className="tabular font-semibold text-ink">{handling.length}</dd>
            </div>
          </>
        )}
      </dl>
      <div className="space-y-2 border-t border-line px-5 py-3">
        <p className="text-[12.5px] text-muted">
          Sampled responses; not every customer’s AI search. {m.awaitingReview} search{m.awaitingReview === 1 ? '' : 'es'} need a relevance check · {m.notRelevant} marked not relevant.
        </p>
        <Button size="sm" variant={cta.primary ? 'primary' : 'secondary'} onClick={() => navigate(cta.to)}>
          {cta.label}
          <ArrowRight />
        </Button>
      </div>
    </Card>
  )
}

/** Activity entries are written for operators; show plain-language versions to the Brand. */
export function plainActivity(text: string) {
  return text
    .replace(/^Ran audit (aud-\d+).*/, 'AI visibility check completed')
    .replace(/^Ran recheck (\d+) for .*/, 'Follow-up AI check completed')
    .replace(/^task-\d+ moved to Awaiting AI recheck/, 'Information update completed — waiting for a follow-up AI check')
    .replace(/^(task-\d+) moved to (.*)/, 'Update $1: $2')
    .replace(/^Confirmed discrepancy · (.*)/, 'Information confirmed as incorrect · $1')
    .replace(/^Correction plan sent to Brand · .*/, 'ProManage proposed information updates')
    .replace(/^Sent to ProManage for review.*/, 'Sent to ProManage for review')
    .replace(/^Discovery improvement plan sent to Brand · (.*)/, 'ProManage suggested improvements · $1')
    .replace(/ · discovery · /, ' · ')
    .replace(/ · (iss-|issue-)[\w-]+$/, '')
}
