import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, RadioTower, ScanSearch, ShieldCheck, TrendingUp } from 'lucide-react'
import { hasMismatch, isDiscovery } from '@/lib/metrics'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import type { Issue } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { parseOpp, useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { outcomeForIssue, revisedFacts } from '@/lib/aiStatus'
import { STATE_LABEL } from '@/lib/publishing'
import { FIELD_PHRASE } from '@/lib/brandStatus'
import { RecheckResult } from '@/components/discovery'
import { EvidenceDisclosure } from '@/components/brand'
import { KpiCard, NextStep, PageHeader, PermButton } from '@/components/domain'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate, fmtDateTime } from '@/lib/utils'

const ACC_OUTCOME = {
  changed: { label: 'No mismatch in latest sampled check', tone: 'success' as const },
  unchanged: { label: 'Incorrect statement still appears', tone: 'danger' as const },
  uncertain: { label: 'Inconclusive — the latest answer didn’t state it', tone: 'warning' as const },
  not_comparable: { label: 'We cannot reliably compare these checks', tone: 'warning' as const },
}

function AccuracyOutcome({ issue, wave }: { issue: Issue; wave: number | null }) {
  const { observationsFor, promptsById, rechecksFor } = useStore()
  const base = observationsFor(issue.auditId, 0)
  const before = base.find((o) => o.id === issue.observationId)
  const beforeClaim = before?.extractedClaims.find((c) => c.id === issue.claimId)
  const loc = LOCATION_BY_ID[issue.locationId]
  const phrase = issue.field ? (FIELD_PHRASE[issue.field] ?? issue.field) : 'information'
  if (!wave) {
    return (
      <li className="px-5 py-3.5">
        <p className="text-[14px] font-medium text-ink">{loc.name} · {phrase}</p>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-body">
          <Clock className="size-4 text-muted" />
          Not rechecked yet — awaiting the follow-up AI check.
        </p>
      </li>
    )
  }
  const recheck = rechecksFor(issue.auditId).find((r) => r.wave === wave)
  const later = observationsFor(issue.auditId, wave)
  const after = later.find((o) => o.locationId === issue.locationId && o.promptId === issue.promptId)
  const afterClaim = after?.extractedClaims.find((c) => c.field === issue.field)
  const outcome = outcomeForIssue(issue, base, later, promptsById, revisedFacts(recheck))
  const o = ACC_OUTCOME[outcome]
  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[14px] font-medium text-ink">{loc.name} · {phrase}</p>
        <Badge tone={o.tone}>{o.label}</Badge>
      </div>
      <p className="text-[13px] text-body">Question: “{before?.query}”</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-[13.5px]">
          <p className="text-[12px] font-medium text-muted">Original check · {before ? fmtDate(before.sampledAt) : ''}</p>
          AI said “{beforeClaim?.value}”
        </div>
        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px]">
          <p className="text-[12px] font-medium text-muted">Follow-up {wave} · {after ? fmtDate(after.sampledAt) : ''}</p>
          {afterClaim ? `AI said “${afterClaim.value}”` : 'The answer didn’t state it'}
        </div>
      </div>
      {after && <EvidenceDisclosure obs={before!} later={after} title="View AI answers (original and follow-up)" />}
    </li>
  )
}

/** Before → after for one lens: big delta, direction-aware colour, and a bar per check. */
function DeltaCard({ title, subtitle, series, betterWhen, unit, icon, color }: { title: string; subtitle: string; series: { label: string; value: number; of?: number }[]; betterWhen: 'up' | 'down'; unit: string; icon: React.ReactNode; color: string }) {
  const first = series[0]
  const last = series[series.length - 1]
  const delta = last.value - first.value
  const good = delta === 0 ? null : betterWhen === 'up' ? delta > 0 : delta < 0
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            {icon}
            {title}
          </p>
          <p className="text-[12.5px] text-muted">{subtitle}</p>
        </div>
        <Badge tone={good === null ? 'neutral' : good ? 'success' : 'danger'} className="text-[13px]">
          {delta > 0 ? '+' : ''}
          {delta} {unit}
        </Badge>
      </div>
      <div className="flex items-baseline gap-3 px-5 pt-3">
        <span className="tabular text-[30px] font-semibold leading-none text-muted">{first.value}</span>
        <ArrowRight className="size-5 self-center text-muted" />
        <span className="tabular text-[30px] font-semibold leading-none text-ink">{last.value}</span>
        <span className="text-[13px] text-body">
          {first.of !== undefined ? `of ${last.of} ` : ''}
          {unit}
        </span>
      </div>
      <div className="h-[170px] px-3 pb-1 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 18, right: 12, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3eaf1', fontSize: 12.5 }} formatter={(v: number) => [`${v} ${unit}`, title]} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {series.map((d, i) => (
                <Cell key={d.label} fill={i === 0 ? '#cfd8e3' : color} />
              ))}
              <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#45546b' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export default function MeasurePage() {
  const { latestAudit, openChapter, release, autoPrepared, prepareImprovements, approvals, publications, tasks, issues, plans, rechecksFor, runRecheck, selectedGoalId, goals, selectGoal, observationsFor, promptsById } = useStore()
  const disc = useDiscovery()
  const first = useRef(release !== 'V2')
  const ran = useRef(false)
  useEffect(() => {
    if (first.current) toast.success('V2 unlocked: follow-up checks and outcomes are now available')
    openChapter(3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Opening Measure also makes V1 capability available — preparing proposals only; nothing is approved or published.
    if (latestAudit && !autoPrepared[latestAudit.id] && release === 'V2') prepareImprovements(latestAudit.id)
  }, [latestAudit, autoPrepared, release, prepareImprovements])

  const auditId = latestAudit?.id
  const rechecks = auditId ? rechecksFor(auditId) : []
  const lastRecheck = rechecks[rechecks.length - 1]
  const mine = publications.filter((p) => {
    if (!auditId) return false
    if (p.proposalKey.startsWith('disc')) return parseOpp(p.proposalKey.slice(5)).auditId === auditId
    return issues.find((i) => `acc:${i.id}` === p.proposalKey)?.auditId === auditId
  })
  const successes = mine.filter((p) => p.state === 'success')
  const latestSuccess = successes.map((p) => p.recordedAt).sort().pop()
  const awaiting = auditId ? disc.latest.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length + issues.filter((i) => i.auditId === auditId && plans[i.id]?.status === 'awaiting_brand_approval').length : 0
  const needsRecheck = !!latestSuccess && (!lastRecheck || lastRecheck.createdAt < latestSuccess)

  useEffect(() => {
    // ProManage runs the matched follow-up after published updates (simulated). Never before approval.
    if (latestAudit && needsRecheck && release === 'V2' && !ran.current) {
      ran.current = true
      const r = runRecheck(latestAudit.id)
      toast.success(`ProManage ran follow-up check ${r.wave} (simulated)`, { description: 'Same questions, centres and AI search surface. Original answers are unchanged.' })
    }
  }, [latestAudit, needsRecheck, release, runRecheck])

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Measure" subtitle="Compare later sampled AI answers with your standard check." />
        <EmptyState icon={<ScanSearch />} title="Run the AI Visibility Check first" action={<Button variant="primary" asChild><Link to="/detect">Go to 01 Detect</Link></Button>} />
      </div>
    )
  }

  const goal = goals.find((g) => g.id === selectedGoalId)
  const inScope = (locId: string) => !goal || goal.locationIds.includes(locId)
  const approvedKeys = new Set(approvals.filter((a) => a.action === 'approve').map((a) => a.proposalKey))
  const discApproved = disc.latest.filter((o) => approvedKeys.has(`disc:${o.id}`) && inScope(o.locationId))
  const accApproved = issues.filter((i) => i.auditId === auditId && approvedKeys.has(`acc:${i.id}`) && inScope(i.locationId))
  // Only a check sampled after the latest published update counts as the post-update measurement.
  const wave = lastRecheck && latestSuccess && lastRecheck.createdAt >= latestSuccess ? lastRecheck.wave : null
  const before = disc.metricsFor(latestAudit.id, 0)
  const after = wave ? disc.metricsFor(latestAudit.id, wave) : null
  const unresolved = mine.filter((p) => p.state !== 'success' && !mine.some((q) => q.taskId === p.taskId && q.state === 'success'))
  const latestByTask = Object.values(Object.fromEntries(mine.map((p) => [p.taskId, p])))
  const accNoMismatch = wave ? accApproved.filter((i) => outcomeForIssue(i, observationsFor(latestAudit.id, 0), observationsFor(latestAudit.id, wave), promptsById, revisedFacts(rechecks.find((r) => r.wave === wave))) === 'changed').length : 0
  const waves = [0, ...rechecks.filter((r) => !wave || r.wave <= wave).map((r) => r.wave)]
  const label = (w: number) => (w === 0 ? 'Original' : `Follow-up ${w}`)
  const discSeries = waves.map((w) => {
    const mm = disc.metricsFor(latestAudit.id, w)
    return { label: label(w), value: mm.eligibleMentioned, of: mm.eligible }
  })
  const incorrectSeries = waves.map((w) => ({ label: label(w), value: observationsFor(latestAudit.id, w).filter((o) => !isDiscovery(o, promptsById) && hasMismatch(o)).length }))
  const updatesAt = latestSuccess
  const chart = latestAudit.locationIds.map((id) => {
    const el = (w: number) => disc.observationsOf({ auditId: latestAudit.id, locationId: id }, w).filter((o) => disc.eligibility(id, o.promptId).status === 'eligible' && o.mentioned).length
    return { name: LOCATION_BY_ID[id].neighborhood, Original: el(0), ...(wave ? { [`Follow-up ${wave}`]: el(wave) } : {}) }
  })

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="What changed, and what AI said afterward"
        subtitle="Source updates are shown separately from later sampled AI answers. Improvement in a sample isn’t proof the updates caused it."
        actions={
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/improve">
                <ArrowLeft />
                Back to fixes
              </Link>
            </Button>
            <PermButton perm="requestCheck" onClick={() => { const r = runRecheck(latestAudit.id); toast.success(`Follow-up check ${r.wave} sampled (simulated)`) }} disabled={!successes.length}>
              <RadioTower />
              Request a new follow-up check
            </PermButton>
          </div>
        }
      />
      {goal && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-[13.5px] text-ink">
          Focused on “{goal.anchorQuestion}” · {LOCATION_BY_ID[goal.locationIds[0]]?.name}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => selectGoal(null)}>
            Back to standard check
          </Button>
        </div>
      )}

      {approvedKeys.size === 0 ? (
        <Card className="p-6">
          <p className="text-[17px] font-semibold text-ink">No approved changes to measure yet</p>
          <p className="mt-1 text-[14px] text-body">Nothing has been authorized or published, so there’s no before/after to show. Your standard check is the baseline: mentioned in {before.eligibleMentioned} of {before.eligible} eligible sampled recommendations.</p>
          <Button variant="primary" className="mt-3" asChild>
            <Link to="/improve">Go to 02 Improve</Link>
          </Button>
        </Card>
      ) : (
        <>
          {wave && (
            <Card className="border-brand-line">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
                <p className="text-[16px] font-semibold text-ink">Before and after your changes</p>
                <span className="text-[13px] text-body">
                  Original check {fmtDate(latestAudit.createdAt)} → follow-up {wave} sampled {fmtDate(rechecks.find((r) => r.wave === wave)!.sampledAt)}, after {successes.length} source update{successes.length === 1 ? '' : 's'}
                  {updatesAt ? ` on ${fmtDate(updatesAt)}` : ''}
                </span>
                <Badge tone="neutral" className="ml-auto">Same questions & centres · simulated</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                <DeltaCard title="Discoverability" subtitle="Eligible sampled recommendations that mention your centre — higher is better" series={discSeries} betterWhen="up" unit="mentions" icon={<TrendingUp className="size-4 text-teal-ink" />} color="#0e9aa7" />
                <DeltaCard title="Information accuracy" subtitle="Answers about your centres with incorrect information — lower is better" series={incorrectSeries} betterWhen="down" unit="incorrect answers" icon={<ShieldCheck className="size-4 text-brand" />} color="var(--chart-1)" />
              </div>
              <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-muted">One sampled answer per question. These are observed changes after your updates — not proof the updates caused them, and future answers can differ.</p>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Sources updated" value={latestByTask.filter((p) => p.state === 'success').length} detail={`of ${latestByTask.length} targets`} icon={<CheckCircle2 />} tone="teal" definition="Connected, write-authorized targets updated after your authorization. Demo: simulated publication." footer="Source change ≠ AI answer change" />
            <KpiCard label="Needs follow-up" value={unresolved.length} icon={<Clock />} tone="warning" definition="Targets that need ProManage, a site admin or an external owner. Never marked updated." footer="Handoffs, access or failed attempts" />
            <KpiCard label="Eligible mention rate" value={after ? `${after.eligibleMentioned}/${after.eligible}` : '—'} detail={`was ${before.eligibleMentioned}/${before.eligible}`} icon={<TrendingUp />} tone="blue" definition="Unbranded sampled recommendations naming the right centre, across all checked centres. Same questions and centres; one answer per question." footer={after ? `Follow-up ${wave} vs original check` : 'Awaiting follow-up check'} />
            <KpiCard label="Accuracy corrections" value={wave ? `${accNoMismatch}/${accApproved.length}` : '—'} icon={<ShieldCheck />} tone="neutral" definition="Authorized accuracy corrections whose latest sampled answer no longer shows the incorrect statement." footer={wave ? 'No mismatch in latest sampled check' : 'Awaiting follow-up check'} />
          </div>

          {wave && (
            <Card>
              <CardHeader title="Mentions by centre · original vs follow-up" description={`Eligible unbranded sampled recommendations · follow-up ${wave} · Surface A · simulated`} />
              <div className="h-[230px] px-3 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e3eaf1', fontSize: 12.5 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Original" fill="#cfd8e3" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey={`Follow-up ${wave}`} fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">Sampled observations. Answers vary between samples; a change isn’t proof the updates caused it.</p>
            </Card>
          )}

          <Card>
            <CardHeader title="What changed on your sources" description="Per-target results of your authorizations · Demo: simulated publication" />
            <Table>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th>Target</Th>
                  <Th>Result</Th>
                  <Th>Recorded</Th>
                </tr>
              </thead>
              <tbody>
                {mine.map((p) => {
                  const t = tasks.find((x) => x.id === p.taskId)
                  const st = STATE_LABEL[p.state]
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <Badge tone={p.proposalKey.startsWith('disc') ? 'teal' : 'blue'}>{p.proposalKey.startsWith('disc') ? 'Discoverability' : 'Accuracy'}</Badge>
                      </Td>
                      <Td className="text-[13.5px] text-ink">{t?.title}</Td>
                      <Td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-[12.5px] text-muted">{fmtDateTime(p.recordedAt)}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>

          {!wave && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Clock className="size-4 text-warning" />
                {successes.length ? 'Connected sources updated; AI check pending' : 'Awaiting approved update'}
              </p>
              <p className="mt-1 text-[13.5px] text-body">{successes.length ? 'ProManage runs the matched follow-up check after updates are published.' : 'No source has been updated yet (handoffs or failures only), so a follow-up wouldn’t measure anything new.'}</p>
            </Card>
          )}

          {wave && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader title="Discoverability" description={`Matched unbranded questions · original check → follow-up ${wave} · Surface A`} />
                <div className="space-y-3 px-5 py-4">
                  {discApproved.map((o) => {
                    const rc = disc.recheckFor(o)
                    return (
                      <div key={o.id}>
                        <p className="mb-1 text-[14px] font-medium text-ink">{LOCATION_BY_ID[o.locationId].name}</p>
                        {rc ? <RecheckResult rc={rc} brand /> : <p className="text-[13px] text-body">Not rechecked yet.</p>}
                      </div>
                    )
                  })}
                  {discApproved.length === 0 && <p className="text-[13.5px] text-body">No discoverability changes were authorized.</p>}
                  {after && (
                    <p className="rounded-lg border border-line bg-subtle px-3 py-2 text-[13px] text-body">
                      Across all {latestAudit.locationIds.length} centres: mentioned in <span className="tabular font-semibold text-ink">{before.eligibleMentioned} of {before.eligible}</span> eligible sampled recommendations before → <span className="tabular font-semibold text-ink">{after.eligibleMentioned} of {after.eligible}</span> in follow-up {wave}. Answers vary between samples.
                    </p>
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title="Information accuracy" description={`Same branded questions · original check → follow-up ${wave}`} />
                {accApproved.length === 0 ? (
                  <p className="px-5 py-4 text-[13.5px] text-body">No accuracy corrections were authorized.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {accApproved.map((i) => (
                      <AccuracyOutcome key={i.id} issue={i} wave={wave} />
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {unresolved.length > 0 && (
            <Card>
              <CardHeader title="Still open" description="Not marked updated — ProManage or an external owner has the next step" />
              <ul className="divide-y divide-line">
                {unresolved.map((p) => (
                  <li key={p.id} className="px-5 py-2.5 text-[13.5px]">
                    <span className="font-medium text-ink">{tasks.find((t) => t.id === p.taskId)?.title}</span> · <span className="text-body">{p.detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline" description="Standard check → findings → ProManage diagnosis → proposals → your authorization → publication → follow-up check" />
            <ol className="space-y-2 px-5 py-4 text-[13.5px]">
              {[
                { at: latestAudit.createdAt, text: `Standard AI Visibility Check · ${latestAudit.locationIds.length} centres (simulated)` },
                { at: autoPrepared[latestAudit.id], text: 'ProManage investigated managed sources and prepared proposals (simulated)' },
                ...approvals.filter((a) => a.action === 'approve').map((a) => ({ at: a.at, text: `You authorized ${a.approvedTargetIds.length} target${a.approvedTargetIds.length === 1 ? '' : 's'} · ${a.proposalKey.startsWith('disc') ? 'Discoverability' : 'Accuracy'} · ${a.proposalKey.startsWith('disc') ? LOCATION_BY_ID[parseOpp(a.proposalKey.slice(5)).locationId]?.name : LOCATION_BY_ID[issues.find((i) => `acc:${i.id}` === a.proposalKey)?.locationId ?? '']?.name} · version ${a.approvedVersion}` })),
                ...successes.map((p) => ({ at: p.recordedAt, text: `Source updated (simulated): ${tasks.find((t) => t.id === p.taskId)?.title}` })),
                ...rechecks.map((r) => ({ at: r.createdAt, text: `Follow-up check ${r.wave} sampled (simulated) · same questions and centres` })),
              ]
                .filter((e) => e.at)
                .sort((a, b) => a.at!.localeCompare(b.at!))
                .map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-ink" />
                    <span className="text-ink">
                      {e.text} <span className="text-muted">· {fmtDateTime(e.at!)}</span>
                    </span>
                  </li>
                ))}
            </ol>
          </Card>
        </>
      )}

      {approvedKeys.size > 0 &&
        (awaiting > 0 ? (
          <NextStep
            chapter="02 Improve"
            title={`${awaiting} more proposal${awaiting === 1 ? '' : 's'} still need your decision`}
            description="Approve the remaining fixes, then come back here after the next follow-up check."
            to="/improve"
            cta="Review remaining fixes"
          />
        ) : (
          <NextStep
            chapter="01 Detect"
            title="Every proposal has a decision"
            description="Run a fresh standard check to set a new baseline, or add more of your centres."
            to="/detect"
            cta="Go to Detect"
          />
        ))}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/reports">
            <FileText />
            Download report
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/audits/${latestAudit.id}`}>
            <ScanSearch />
            View original evidence
          </Link>
        </Button>
        <p className="self-center text-[12.5px] text-muted">We can’t promise future recommendations or prove what caused an AI answer to change.</p>
      </div>
    </div>
  )
}
