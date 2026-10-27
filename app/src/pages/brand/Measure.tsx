import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Clock, Loader2, RadioTower, ScanSearch, ShieldCheck, TrendingUp } from 'lucide-react'
import { hasMismatch, isDiscovery } from '@/lib/metrics'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import type { Issue, PublicationAttempt, Task } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { parseOpp, useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { outcomeForIssue, revisedFacts } from '@/lib/aiStatus'
import { STATE_LABEL } from '@/lib/publishing'
import { FIELD_PHRASE } from '@/lib/brandStatus'
import { RecheckResult } from '@/components/discovery'
import { EvidenceDisclosure } from '@/components/brand'
import { KpiCard, NextStep, PageHeader } from '@/components/domain'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, Progress } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

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

/** Steps shown while the simulated follow-up runs (the same deterministic evaluation as the original check). */
const RUN_STEPS = ['Preparing your previous questions', 'Checking sampled AI answers (simulated)', 'Comparing discoverability', 'Checking information accuracy', 'Preparing your results']

/** One row per published or handed-off source change, expandable to show what changed and when. */
function ChangesTable({ rows: all, tasks }: { rows: PublicationAttempt[]; tasks: Task[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  // Changes that need attention first, then published; long lists start collapsed.
  const sorted = [...all].sort((a, b) => Number(a.state === 'success') - Number(b.state === 'success'))
  const rows = showAll ? sorted : sorted.slice(0, 5)
  if (!rows.length) return <p className="px-5 py-4 text-[13.5px] text-body">No source changes have been recorded yet.</p>
  return (
    <Table>
      <thead>
        <tr>
          <Th>Proposed improvement</Th>
          <Th>Location</Th>
          <Th>Status</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const t = tasks.find((x) => x.id === p.taskId)
          const st = STATE_LABEL[p.state]
          const loc = t ? LOCATION_BY_ID[t.locationId] : undefined
          const title = (t?.title ?? '').replace(new RegExp(` — ${loc?.neighborhood ?? '$^'}$`), '')
          const before = p.before ?? t?.evidence.find((e) => e.label === 'Current text (snapshot)')?.value
          const after = p.after ?? t?.evidence.find((e) => e.label === 'Approved text')?.value
          const isOpen = open === p.id
          return (
            <Fragment key={p.id}>
              <Tr onClick={() => setOpen(isOpen ? null : p.id)} className="cursor-pointer">
                <Td className="min-w-[240px] text-[13.5px] text-ink">
                  <Badge tone={p.proposalKey.startsWith('disc') ? 'teal' : 'blue'} className="mr-2">{p.proposalKey.startsWith('disc') ? 'Discoverability' : 'Accuracy'}</Badge>
                  {title}
                </Td>
                <Td className="whitespace-nowrap text-[13.5px] text-body">{loc?.neighborhood}</Td>
                <Td>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${title}`}>
                    <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
                  </Button>
                </Td>
              </Tr>
              {isOpen && (
                <tr>
                  <td colSpan={4} className="border-b border-line bg-subtle/60 px-5 py-3 text-[13px]">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-line bg-surface px-3 py-2">
                        <p className="text-[12px] font-medium text-muted">Before</p>
                        <p className="whitespace-pre-line text-body">{before ?? 'Not stated'}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface px-3 py-2">
                        <p className="text-[12px] font-medium text-muted">{p.state === 'success' ? 'After (published)' : 'Proposed (not published)'}</p>
                        <p className="whitespace-pre-line text-ink">{after ?? '—'}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-body">
                      {p.detail} · {t?.target} · approved version {p.approvedVersion} · recorded {fmtDateTime(p.recordedAt)}
                    </p>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
      {all.length > 5 && (
        <tfoot>
          <tr>
            <td colSpan={4} className="px-5 py-2.5">
              <button className="text-[13px] font-medium text-brand hover:underline" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show all ${all.length} changes`}
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </Table>
  )
}

export default function MeasurePage() {
  const { latestAudit, openChapter, release, autoPrepared, optimizeChecked, prepareImprovements, approvals, publications, tasks, issues, plans, rechecksFor, runRecheck, selectedGoalId, goals, selectGoal, observationsFor, promptsById } = useStore()
  const disc = useDiscovery()
  const first = useRef(release !== 'V2')
  const [running, setRunning] = useState<number | null>(null)
  const [selWave, setSelWave] = useState<number | null>(null)
  useEffect(() => {
    if (first.current) toast.success('V2 unlocked: you can now run follow-up checks')
    openChapter(3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Opening Measure also makes V1 capability available: preparing proposals only. Nothing is approved, published or rechecked.
    if (latestAudit && (!autoPrepared[latestAudit.id] || !optimizeChecked?.[latestAudit.id]) && release === 'V2') prepareImprovements(latestAudit.id)
  }, [latestAudit, autoPrepared, optimizeChecked, release, prepareImprovements])

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Measure your improvements" subtitle="Compare later sampled AI answers with your standard check." />
        <EmptyState icon={<ScanSearch />} title="Run the AI Visibility Check first" action={<Button variant="primary" asChild><Link to="/detect">Go to 01 Detect</Link></Button>} />
      </div>
    )
  }

  const auditId = latestAudit.id
  const rechecks = rechecksFor(auditId)
  const mine = publications.filter((p) => {
    if (p.proposalKey.startsWith('disc')) return parseOpp(p.proposalKey.slice(5)).auditId === auditId
    return issues.find((i) => `acc:${i.id}` === p.proposalKey)?.auditId === auditId
  })
  const latestByTask = Object.values(Object.fromEntries(mine.map((p) => [p.taskId, p]))) as PublicationAttempt[]
  const successes = latestByTask.filter((p) => p.state === 'success')
  const attention = latestByTask.filter((p) => p.state !== 'success')
  const latestSuccess = mine.filter((p) => p.state === 'success').map((p) => p.recordedAt).sort().pop()
  const awaitingProposals = disc.latest.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length + issues.filter((i) => i.auditId === auditId && plans[i.id]?.status === 'awaiting_brand_approval').length
  const awaitingChanges =
    disc.latest.reduce((n, o) => { const pl = disc.record(o.id)?.plan; return n + (pl?.status === 'awaiting_brand_approval' ? pl.recommendations.filter((r) => r.delivery !== 'advisory_only').length : 0) }, 0) +
    issues.filter((i) => i.auditId === auditId && plans[i.id]?.status === 'awaiting_brand_approval').reduce((n, i) => n + plans[i.id].items.length, 0)

  const goal = goals.find((g) => g.id === selectedGoalId)
  const inScope = (locId: string) => !goal || goal.locationIds.includes(locId)
  const approvedKeys = new Set(approvals.filter((a) => a.action === 'approve').map((a) => a.proposalKey))
  const discApproved = disc.latest.filter((o) => approvedKeys.has(`disc:${o.id}`) && inScope(o.locationId))
  const accApproved = issues.filter((i) => i.auditId === auditId && approvedKeys.has(`acc:${i.id}`) && inScope(i.locationId))

  // A follow-up exists only when the Brand ran one. Default to the latest; any earlier one can be selected.
  const wave = rechecks.length ? (selWave && rechecks.some((r) => r.wave === selWave) ? selWave : rechecks[rechecks.length - 1].wave) : null
  const recheck = wave ? rechecks.find((r) => r.wave === wave)! : null
  const comparable = !recheck || recheck.cohortFingerprint === `${latestAudit.locationIds.length}L×${latestAudit.promptIds.length}P · ${latestAudit.surface} · rules v1`
  const publishedBefore = recheck ? successes.filter((p) => p.recordedAt <= recheck.createdAt).length : 0
  const publishedAfter = recheck && latestSuccess && latestSuccess > recheck.createdAt
  const before = disc.metricsFor(auditId, 0)
  const after = wave ? disc.metricsFor(auditId, wave) : null
  const accNoMismatch = wave ? accApproved.filter((i) => outcomeForIssue(i, observationsFor(auditId, 0), observationsFor(auditId, wave), promptsById, revisedFacts(recheck ?? undefined)) === 'changed').length : 0
  const waves = [0, ...rechecks.filter((r) => !wave || r.wave <= wave).map((r) => r.wave)]
  const label = (w: number) => (w === 0 ? 'Original' : `Follow-up ${w}`)
  const discSeries = waves.map((w) => {
    const mm = disc.metricsFor(auditId, w)
    return { label: label(w), value: mm.eligibleMentioned, of: mm.eligible }
  })
  const incorrect = (w: number) => observationsFor(auditId, w).filter((o) => !isDiscovery(o, promptsById) && hasMismatch(o)).length
  const incorrectSeries = waves.map((w) => ({ label: label(w), value: incorrect(w) }))
  const chart = latestAudit.locationIds.map((id) => {
    const el = (w: number) => disc.observationsOf({ auditId, locationId: id }, w).filter((o) => disc.eligibility(id, o.promptId).status === 'eligible' && o.mentioned).length
    return { name: LOCATION_BY_ID[id].neighborhood, Original: el(0), ...(wave ? { [`Follow-up ${wave}`]: el(wave) } : {}) }
  })
  const pct = (m: { eligibleMentioned: number; eligible: number }) => (m.eligible ? Math.round((m.eligibleMentioned / m.eligible) * 100) : 0)

  const runFollowUp = () => {
    if (running !== null) return // one check at a time; repeated clicks don't create duplicates
    setRunning(0)
    setTimeout(() => document.querySelector('[data-run-panel]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    RUN_STEPS.forEach((_, i) => setTimeout(() => setRunning(i), i * 900))
    setTimeout(() => {
      const r = runRecheck(auditId)
      setSelWave(r.wave)
      setRunning(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success(`Follow-up check ${r.wave} complete (simulated)`, { description: 'Same questions, centres and AI search surface. Your original answers are unchanged.' })
    }, RUN_STEPS.length * 900)
  }

  const scope = (
    <div className="text-[13px] text-body">
      <p>
        {latestAudit.locationIds.length} centres · the same {latestAudit.promptIds.length} questions per centre ({latestAudit.locationIds.length * latestAudit.promptIds.length} sampled answers) · demo AI search (Surface A) · original check {fmtDateTime(latestAudit.createdAt)}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer text-[12.5px] font-medium text-brand">Which centres?</summary>
        <p className="mt-1 text-[12.5px]">{latestAudit.locationIds.map((id) => LOCATION_BY_ID[id].neighborhood).join(', ')}</p>
      </details>
      <p className="mt-1 text-[12px] text-muted">Results are simulated in this prototype; no real AI service is queried.</p>
    </div>
  )

  const runPanel = (again: boolean) => (
    <Card className="border-2 border-brand-line bg-brand-soft/40 p-5" data-run-panel>
      {running !== null ? (
        <div aria-live="polite">
          <p className="flex items-center gap-2 text-[17px] font-semibold text-ink">
            <Loader2 className="size-5 animate-spin text-brand" />
            Checking your AI visibility…
          </p>
          <Progress value={((running + 1) / RUN_STEPS.length) * 100} className="mt-3 h-2" />
          <ol className="mt-3 space-y-1 text-[13.5px]">
            {RUN_STEPS.map((st, i) => (
              <li key={st} className={cn('flex items-center gap-2', i < running ? 'text-ink' : i === running ? 'font-medium text-ink' : 'text-muted')}>
                {i < running ? <CheckCircle2 className="size-4 text-success" /> : i === running ? <Loader2 className="size-4 animate-spin text-brand" /> : <span className="mx-[3px] size-2.5 rounded-full border border-muted" />}
                {st}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold text-ink">{again ? 'Run another follow-up check' : 'Ready to see if your AI visibility has improved?'}</p>
          <p className="mt-1 text-[14px] text-body">We’ll repeat your previous AI search questions for the same locations and compare the new results with your original check.</p>
          {(attention.length > 0 || awaitingChanges > 0) && (
            <p className="mt-2 flex items-start gap-2 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              This check reflects only the {successes.length} change{successes.length === 1 ? '' : 's'} published so far. {attention.length ? `${attention.length} need attention` : ''}{attention.length && awaitingChanges ? ' and ' : ''}{awaitingChanges ? `${awaitingChanges} still await your authorization` : ''}.
            </p>
          )}
          <div className="mt-3">{scope}</div>
          </div>
          <Button variant="primary" size="lg" className="h-12 shrink-0 self-start px-6 text-[15px] shadow-pop lg:self-center" onClick={runFollowUp}>
            <RadioTower />
            {again ? 'Run another follow-up check' : 'Run Follow-up AI Visibility Check'}
          </Button>
        </div>
      )}
    </Card>
  )

  const changesCard = (
    <Card>
      <CardHeader title="What has changed?" description="Source changes from your authorizations · click a row to see what changed and when · demo: simulated publication" />
      <ChangesTable rows={latestByTask} tasks={tasks} />
    </Card>
  )

  const progressCards = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard label="Sources successfully updated" value={successes.length} icon={<CheckCircle2 />} tone="teal" definition="Connected, write-authorized sources published after your approval (simulated). A source update doesn’t mean any AI answer has changed." footer="Published (simulated)" />
      <KpiCard label="Updates requiring attention" value={attention.length} icon={<Clock />} tone="warning" definition="Failed attempts, changes your site admin must make, and requests prepared for independent sites. Never marked updated." footer={attention.length ? [...new Set(attention.map((p) => STATE_LABEL[p.state].label))].join(' · ') : 'None'} />
      <KpiCard label="Awaiting authorization" value={awaitingChanges} icon={<ShieldCheck />} tone="neutral" definition="Recommended changes in proposals you haven’t approved, declined or sent back yet." footer={awaitingProposals ? `${awaitingProposals} proposal${awaitingProposals === 1 ? '' : 's'} in Improve` : 'Nothing waiting'} />
    </div>
  )

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Measure your improvements"
        subtitle="Review what ProManage updated, then run another AI visibility check to see whether the answers have changed."
        actions={
          <>
            <Button asChild>
              <Link to="/improve">
                <ArrowLeft />
                Back to fixes
              </Link>
            </Button>
            {wave && running === null && (
              <Button variant="primary" onClick={runFollowUp}>
                <RadioTower />
                Run another follow-up check
              </Button>
            )}
          </>
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

      {approvedKeys.size === 0 && !rechecks.length ? (
        <Card className="p-6">
          <p className="text-[17px] font-semibold text-ink">No improvements have been published yet.</p>
          <p className="mt-1 text-[14px] text-body">Nothing has been authorized or published, so there’s nothing new to measure. Your standard check is the baseline: mentioned in {before.eligibleMentioned} of {before.eligible} eligible sampled recommendations.</p>
          <Button variant="primary" className="mt-3" asChild>
            <Link to="/improve">Review suggested improvements</Link>
          </Button>
        </Card>
      ) : !wave ? (
        <>
          {runPanel(false)}
          {progressCards}
          {changesCard}
        </>
      ) : (
        <>
          {running !== null && runPanel(true)}
          <Card className="border-brand-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
              <p className="text-[16px] font-semibold text-ink">Before and after your changes</p>
              <span className="text-[13px] text-body">
                Original check {fmtDateTime(latestAudit.createdAt)} → follow-up {wave} run {fmtDateTime(recheck!.sampledAt)}, after {publishedBefore} source update{publishedBefore === 1 ? '' : 's'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {rechecks.length > 1 && (
                  <select className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]" aria-label="Follow-up check" value={wave} onChange={(e) => setSelWave(Number(e.target.value))}>
                    {rechecks.map((r) => (
                      <option key={r.wave} value={r.wave}>
                        Follow-up {r.wave} · {fmtDateTime(r.sampledAt)}
                      </option>
                    ))}
                  </select>
                )}
                <Badge tone="neutral">Same questions & centres · simulated</Badge>
              </div>
            </div>
            {!comparable ? (
              <p className="px-5 py-4 text-[13.5px] text-body">
                <span className="font-semibold text-warning">Inconclusive.</span> This follow-up used a different set of centres, questions or AI surface from the original check, so the results can’t be compared reliably.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                <DeltaCard title="Discoverability" subtitle={`Eligible sampled recommendations that mention your centre · ${pct(before)}% → ${pct(after!)}% · higher is better`} series={discSeries} betterWhen="up" unit="mentions" icon={<TrendingUp className="size-4 text-teal-ink" />} color="#0e9aa7" />
                <DeltaCard title="Information accuracy" subtitle="Answers about your centres with incorrect information · lower is better" series={incorrectSeries} betterWhen="down" unit="incorrect answers" icon={<ShieldCheck className="size-4 text-brand" />} color="var(--chart-1)" />
              </div>
            )}
            {publishedAfter && <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-warning">Some updates were published after this follow-up ran. Run another follow-up check to include them.</p>}
            <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-muted">One sampled answer per question. These are observed changes after your updates, not proof the updates caused them; future answers can differ. Issues aren’t marked resolved automatically.</p>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Sources updated" value={successes.length} detail={`of ${latestByTask.length} targets`} icon={<CheckCircle2 />} tone="teal" definition="Connected, write-authorized targets updated after your authorization. Demo: simulated publication." footer="Source change ≠ AI answer change" />
            <KpiCard label="Needs follow-up" value={attention.length} icon={<Clock />} tone="warning" definition="Targets that need ProManage, a site admin or an external owner. Never marked updated." footer="Handoffs, access or failed attempts" />
            <KpiCard label="Eligible mention rate" value={after ? `${after.eligibleMentioned}/${after.eligible}` : '—'} detail={`was ${before.eligibleMentioned}/${before.eligible}`} icon={<TrendingUp />} tone="blue" definition="Unbranded sampled recommendations naming the right centre, across all checked centres. Same questions and centres; one answer per question." footer={`Follow-up ${wave} vs original check`} />
            <KpiCard label="Accuracy corrections" value={`${accNoMismatch}/${accApproved.length}`} icon={<ShieldCheck />} tone="neutral" definition="Authorized accuracy corrections whose latest sampled answer no longer shows the incorrect statement." footer="No mismatch in latest sampled check" />
          </div>

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

          {changesCard}


          <Card>
            <CardHeader title="Check history" description="Every check is kept; nothing is overwritten" />
            <Table>
              <thead>
                <tr>
                  <Th>Check</Th>
                  <Th>Run</Th>
                  <Th>Scope</Th>
                  <Th>Mentions</Th>
                  <Th>Incorrect answers</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {[0, ...rechecks.map((r) => r.wave)].map((w) => {
                  const m = disc.metricsFor(auditId, w)
                  const r = rechecks.find((x) => x.wave === w)
                  return (
                    <Tr key={w} className={cn(w === wave && 'bg-brand-soft/40')}>
                      <Td className="font-medium text-ink">{w === 0 ? 'Original check (baseline)' : `Follow-up ${w}`}</Td>
                      <Td className="whitespace-nowrap text-[13px] text-body">{fmtDateTime(w === 0 ? latestAudit.createdAt : r!.sampledAt)}</Td>
                      <Td className="text-[13px] text-body">{latestAudit.locationIds.length} centres × {latestAudit.promptIds.length} questions · Surface A</Td>
                      <Td className="tabular text-[13px] text-ink">{m.eligibleMentioned}/{m.eligible}</Td>
                      <Td className="tabular text-[13px] text-ink">{incorrect(w)}</Td>
                      <Td className="text-right">{w > 0 && w !== wave && <Button size="sm" variant="ghost" onClick={() => setSelWave(w)}>View</Button>}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>

        </>
      )}


      {approvedKeys.size > 0 && awaitingProposals > 0 && (
        <NextStep chapter="02 Improve" title={`${awaitingProposals} more proposal${awaitingProposals === 1 ? '' : 's'} still need your decision`} description="Approve the remaining fixes, then run another follow-up check to include them." to="/improve" cta="Review remaining fixes" />
      )}
    </div>
  )
}
