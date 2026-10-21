import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardList, Eye, History, MapPin, Plus, RadioTower, ScanSearch, SearchCheck, ShieldAlert, Wrench } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, ORG } from '@/data/seed'
import { confirmedMismatches, factualSummary, fmtPct, issueStatus, locationRows, locationsMentioned, mentionRate } from '@/lib/metrics'
import { ClientRequests } from '@/components/ClientRequests'
import { KpiCard, PageHeader, PermButton, RatioText, SourceBadge, VerificationBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { fmtDateTime, fmtRelative } from '@/lib/utils'

const STEPS = [
  { icon: <ScanSearch />, title: 'Audit', text: 'Sample AI answers for chosen centers and prompts.' },
  { icon: <SearchCheck />, title: 'Review', text: 'Compare claims with verified BrightNest records.' },
  { icon: <Wrench />, title: 'Act', text: 'Correct the sources you control, with approval.' },
  { icon: <RadioTower />, title: 'Recheck', text: 'Re-sample the same cohort and compare honestly.' },
]

export default function OverviewPage() {
  const store = useStore()
  const { latestAudit, observationsFor, promptsById, reviews, inScope, issues, tasks, activity, hasRelease, can } = store
  const navigate = useNavigate()

  const obs = useMemo(() => (latestAudit ? observationsFor(latestAudit.id).filter((o) => inScope(o.locationId)) : []), [latestAudit, observationsFor, inScope])
  const rate = mentionRate(obs, promptsById)
  const locMentioned = locationsMentioned(obs, promptsById)
  const facts = factualSummary(obs, promptsById)
  const confirmed = confirmedMismatches(obs, reviews)
  const auditIssues = issues.filter((i) => i.auditId === latestAudit?.id && inScope(i.locationId))
  const awaiting = auditIssues.filter((i) => issueStatus(i, reviews, tasks) === 'needs_review').length
  const rows = locationRows(obs, promptsById, reviews)

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<SourceBadge />}
        title="Client Overview"
        subtitle="BrightNest Preschools · AI visibility operations"
        actions={
          <PermButton perm="runAudit" variant="primary" onClick={() => navigate('/audits/new')}>
            <Plus />
            New audit
          </PermButton>
        }
      />

      <ClientRequests />

      {!latestAudit && !store.onboardingDismissed && (
        <div className="relative mb-6 overflow-hidden rounded-xl border border-[#cdeff3] bg-gradient-to-br from-[#ecfbfd] via-white to-[#f1f5ff] p-6 shadow-card">
          <div className="grid grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,1fr)_500px]">
            <div className="max-w-xl">
              <Badge tone="teal">Pilot setup · {ORG.name}</Badge>
              <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.01em] text-ink">See how sampled AI answers describe your centers</h2>
              <p className="mt-1.5 text-[14px] text-body">
                Start with 10 Bengaluru pilot centers and 8 prompts. You'll get 80 sampled answers to review — mentions in discovery answers, and branded facts checked against your verified records.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <PermButton perm="runAudit" variant="primary" size="lg" onClick={() => navigate('/audits/new')}>
                  Create pilot audit
                  <ArrowRight />
                </PermButton>
                <Button variant="ghost" size="lg" onClick={store.dismissOnboarding}>
                  Dismiss
                </Button>
              </div>
            </div>
            <ol className="grid w-full grid-cols-2 gap-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-line bg-white/80 p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-teal-soft text-teal-ink [&_svg]:size-4">{s.icon}</span>
                    <span className="text-[13px] font-semibold text-ink">
                      {i + 1}. {s.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sampled unbranded discovery mention rate"
          icon={<Eye />}
          tone="teal"
          value={latestAudit ? fmtPct(rate) : '—'}
          detail={latestAudit ? `${rate.num} of ${rate.den}` : undefined}
          definition="Unbranded discovery responses that mention the correct BrightNest center ÷ all sampled unbranded discovery responses. Branded prompts are excluded."
          footer={latestAudit ? `${locMentioned.num} of ${locMentioned.den} centers mentioned at least once` : 'Run an audit to populate'}
        />
        <KpiCard
          label="Pilot locations tested"
          icon={<MapPin />}
          value={latestAudit ? new Set(obs.map((o) => o.locationId)).size : 0}
          detail={`of ${ORG.totalLocationCount}`}
          definition="Centers in the latest audit scope. Not a claim about the whole enterprise footprint."
          footer={latestAudit ? `${latestAudit.id} · run ${fmtDateTime(latestAudit.createdAt)}` : 'No audit yet'}
        />
        <KpiCard
          label="Confirmed factual mismatches"
          icon={<ShieldAlert />}
          tone="danger"
          value={latestAudit ? confirmed : '—'}
          detail={latestAudit ? `of ${facts.mismatch} flagged` : undefined}
          definition="Claims a person has confirmed conflict with an independently verified BrightNest record. Unverified records can only produce “Cannot evaluate”."
          footer={latestAudit ? `${facts.claims} claims checked · ${facts.cannotEvaluate} cannot be evaluated` : 'Run an audit to populate'}
        />
        <KpiCard
          label="Items needing review"
          icon={<ClipboardList />}
          tone="warning"
          value={latestAudit ? awaiting : '—'}
          detail={latestAudit ? `of ${auditIssues.length}` : undefined}
          definition="Mismatches, unverifiable claims, record gaps and possible discovery gaps without a human decision yet."
          footer={
            latestAudit ? (
              hasRelease('V1') ? (
                <Link to="/issues" className="font-medium text-brand hover:underline">
                  Open issue inbox →
                </Link>
              ) : (
                <Link to={`/audits/${latestAudit.id}`} className="font-medium text-brand hover:underline">
                  Review in audit results →
                </Link>
              )
            ) : (
              'Run an audit to populate'
            )
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Location performance"
            description={latestAudit ? `${latestAudit.name} · discovery mentions and branded factual checks` : 'Pilot centers'}
            actions={
              latestAudit && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/audits/${latestAudit.id}`}>
                    Full results <ArrowRight />
                  </Link>
                </Button>
              )
            }
          />
          {latestAudit ? (
            <Table>
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th className="text-right">Discovery mentions</Th>
                  <Th className="text-right">Factual checks</Th>
                  <Th className="text-right">Flagged</Th>
                  <Th>Record</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const loc = LOCATION_BY_ID[r.locationId]
                  return (
                    <Tr key={r.locationId} onClick={() => navigate(`/locations/${r.locationId}/answers`)}>
                      <Td className="whitespace-nowrap">
                        <Link to={`/locations/${r.locationId}/answers`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                          {loc.name}
                        </Link>
                        <p className="text-[12px] text-muted">{loc.region}</p>
                      </Td>
                      <Td className="text-right">
                        <RatioText r={r.rate} />
                      </Td>
                      <Td className="tabular text-right">{r.factualChecks}</Td>
                      <Td className="tabular text-right">
                        {r.flagged > 0 ? (
                          <span className="font-medium text-danger">{r.flagged}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </Td>
                      <Td>
                        <VerificationBadge status={loc.verificationStatus} />
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<ScanSearch />}
              title="No audit results yet"
              description="Run a pilot audit to see how sampled AI answers represent each center."
              action={
                <PermButton perm="runAudit" variant="soft" onClick={() => navigate('/audits/new')}>
                  <Plus />
                  New audit
                </PermButton>
              }
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent activity" />
            {activity.length === 0 ? (
              <EmptyState icon={<History />} title="Nothing yet" description="Audit runs, reviews and task updates will appear here." className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {activity.slice(0, 7).map((a) => (
                  <li key={a.id} className="flex gap-3 px-5 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-ink" />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-ink">{a.text}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {a.actor} · {fmtRelative(a.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink">How to read these numbers</p>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-muted">
              <li>Discovery mention rate uses unbranded prompts only.</li>
              <li>Not being mentioned in one sample is an observation, not an error.</li>
              <li>Only human-confirmed conflicts with verified records count as mismatches.</li>
              {!can('reviewDecision') && <li className="text-brand">Your role can view results but not make factual decisions.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
