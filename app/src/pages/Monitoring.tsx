import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { downloadCsv } from '@/lib/csv'
import { useIssueActions } from '@/lib/issueActions'
import { issueStatus } from '@/lib/metrics'
import { Bell, BellOff, CalendarClock, Check, Download, Fingerprint, Info, Loader2, Minus, RadioTower, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { taskStatusLabel, useStore } from '@/store/AppStore'
import { COMPETITORS, LOCATION_BY_ID, SURFACES } from '@/data/seed'
import type { Observation, SurfaceId } from '@/data/types'
import { factualSummary, fmtPct, hasMismatch, isDiscovery, locationsMentioned, mentionRate, type RecheckOutcome } from '@/lib/metrics'
import { OUTCOME_TEXT, outcomeForIssue, revisedFacts } from '@/lib/aiStatus'
import { Tip } from '@/components/ui/tooltip'
import { CATEGORY_LABEL, PageHeader, PermButton, RatioText, SeverityBadge, TaskStatusBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label, Select } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { DiscoveryCohortPanel } from './DiscoveryInvestigation'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const OUTCOME: Record<RecheckOutcome, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = Object.fromEntries(Object.entries(OUTCOME_TEXT).map(([k, v]) => [k, { label: v.short, tone: v.tone }])) as never

function nextWeekday(day: string) {
  const target = DAYS.indexOf(day) + 1
  const d = new Date()
  const diff = (target - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toISOString()
}

function ChartTip({ active, payload, label, kind }: { active?: boolean; payload?: { payload: Record<string, number | string> }[]; label?: string; kind: 'rate' | 'conflicts' }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] shadow-pop">
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-muted">{p.date}</p>
      {kind === 'rate' ? (
        <p className="tabular mt-1 text-ink">
          {Number(p.rate).toFixed(0)}% <span className="text-muted">({p.num} of {p.den} discovery responses)</span>
        </p>
      ) : (
        <p className="tabular mt-1 text-ink">
          {p.conflicts} conflicts <span className="text-muted">of {p.claims} claims checked</span>
        </p>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const navigate = useNavigate()
  const { assignVerification } = useIssueActions()
  const { dispositions, createAudit, reviews, audits, monitoring, setMonitoring, runRecheck, rechecksFor, observationsFor, promptsById, issues, tasks, inScope, ackedAlerts, ackAlert, can } = useStore()
  const cohortId = monitoring.cohortAuditId && audits.some((a) => a.id === monitoring.cohortAuditId) ? monitoring.cohortAuditId : audits[audits.length - 1]?.id
  const audit = audits.find((a) => a.id === cohortId)
  const [region, setRegion] = useState('all')
  const [locFilter, setLocFilter] = useState('all')
  const [running, setRunning] = useState(false)
  const [draft, setDraft] = useState({ enabled: monitoring.enabled, day: monitoring.day })
  const [alertView, setAlertView] = useState<'open' | 'acked'>('open')
  const [surface, setSurface] = useState<SurfaceId>('A')

  const rechecks = audit ? rechecksFor(audit.id) : []
  const waves = [0, ...rechecks.map((r) => r.wave)]
  const latestWave = waves[waves.length - 1]

  const filterObs = (list: Observation[]) =>
    list.filter((o) => inScope(o.locationId) && (region === 'all' || LOCATION_BY_ID[o.locationId].region === region) && (locFilter === 'all' || o.locationId === locFilter))

  const series = useMemo(
    () =>
      audit
        ? waves.map((w) => {
            const obs = filterObs(observationsFor(audit.id, w, surface))
            const r = mentionRate(obs, promptsById)
            const f = factualSummary(obs, promptsById)
            const date = w === 0 ? audit.createdAt : rechecks.find((x) => x.wave === w)!.sampledAt
            return { label: w === 0 ? 'Baseline' : `Recheck ${w}`, date: fmtDate(date), wave: w, rate: r.pct ?? 0, num: r.num, den: r.den, conflicts: f.mismatch, claims: f.claims, obs }
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audit, rechecks.length, region, locFilter, observationsFor, promptsById, inScope, surface],
  )

  if (!audit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Monitoring" subtitle="Matched-cohort rechecks over time." />
        <Card>
          <EmptyState icon={<RadioTower />} title="Run a baseline audit first" description="Monitoring rechecks the same centers, prompts, surface and rules as a baseline audit." action={<Button variant="primary" asChild><Link to="/audits/new">New audit</Link></Button>} />
        </Card>
      </div>
    )
  }

  const base = series[0]
  const latest = series[series.length - 1]
  const baseLoc = locationsMentioned(base.obs, promptsById)
  const latestLoc = locationsMentioned(latest.obs, promptsById)
  const delta = latest.rate - base.rate
  const regions = [...new Set(audit.locationIds.map((id) => LOCATION_BY_ID[id].region))]
  const locOptions = audit.locationIds.filter((id) => inScope(id) && (region === 'all' || LOCATION_BY_ID[id].region === region))

  const doRecheck = async () => {
    setRunning(true)
    await new Promise((r) => setTimeout(r, 1300))
    const r = runRecheck(audit.id)
    setRunning(false)
    toast.success(`Recheck ${r.wave} sampled`, { description: `${audit.locationIds.length * audit.promptIds.length} observations · same cohort and rules` })
  }

  // Issue outcomes: baseline issue vs. same location + prompt + field in the latest wave (same surface and rules).
  const auditIssues = issues.filter((i) => i.auditId === audit.id && inScope(i.locationId) && (region === 'all' || LOCATION_BY_ID[i.locationId].region === region) && (locFilter === 'all' || i.locationId === locFilter))
  const latestRecheck = rechecks[rechecks.length - 1]
  const revised = revisedFacts(latestRecheck)
  const outcomes = auditIssues.map((i) => ({ issue: i, outcome: outcomeForIssue(i, base.obs, latest.obs, promptsById, revised) as RecheckOutcome, task: tasks.find((t) => t.issueId === i.id && t.channel !== 'verification') }))
  const notComparable = [...new Set(outcomes.filter((o) => o.outcome === 'not_comparable').map((o) => o.issue.locationId))]
  const awaiting = auditIssues.filter((i) => ['awaiting_recheck', 'external_pending'].includes(issueStatus(i, reviews, tasks, dispositions)))
  const unconfirmedCritical = rechecks.length
    ? auditIssues.filter((i) => i.category === 'factual_mismatch' && i.severity === 'high' && reviews[i.reviewKey]?.status !== 'confirmed' && reviews[i.reviewKey]?.status !== 'not_issue' && outcomeForIssue(i, base.obs, latest.obs, promptsById, revised) === 'unchanged')
    : []
  const startNewBaseline = () => {
    const a = createAudit({ name: `${audit.name} — new baseline`, locationIds: audit.locationIds, promptIds: audit.promptIds, mode: audit.mode })
    setMonitoring({ cohortAuditId: a.id })
    toast.success('New baseline sampled', { description: `${a.id} uses the revised verified facts. Earlier comparisons are kept as history.` })
    navigate(`/audits/${a.id}`)
  }
  const exportComparison = () => {
    downloadCsv(
      `brightnest-matched-comparison-${audit.id}-recheck-${latestWave}.csv`,
      outcomes.map(({ issue, outcome, task }) => {
        const b = base.obs.find((o) => o.id === issue.observationId)
        const l = latest.obs.find((o) => o.locationId === issue.locationId && o.promptId === issue.promptId)
        const bc = b?.extractedClaims.find((c) => c.field === issue.field)
        const lc = l?.extractedClaims.find((c) => c.field === issue.field)
        return {
          issue_id: issue.id,
          location: LOCATION_BY_ID[issue.locationId].name,
          issue: issue.title,
          surface: SURFACES[surface].label,
          prompt: b?.query ?? '',
          baseline_sampled_at: b?.sampledAt ?? '',
          baseline_claim: bc?.value ?? '',
          recheck_sampled_at: l?.sampledAt ?? '',
          recheck_claim: lc?.value ?? '',
          outcome: OUTCOME_TEXT[outcome].short,
          source_action: task ? `${task.id} · ${taskStatusLabel(task.status, task.channel)}` : 'none',
          source_action_timeline: task ? task.activity.map((a) => `${a.at} ${a.text}`).join(' | ') : '',
          note: 'Observed change; causation not established',
          simulated: 'true',
        }
      }),
      [`# Matched comparison — ${audit.id} baseline vs ${latest.label} (same prompts, locations, surface, rules v1)`, '# SIMULATED DEMO DATA'],
    )
    toast.success('Comparison exported')
  }

  // Critical alert digest: only human-confirmed, high-severity factual mismatches that persist. One alert per issue.
  const critical = auditIssues
    .filter((i) => i.category === 'factual_mismatch' && i.severity === 'high' && reviews[i.reviewKey]?.status === 'confirmed')
    .map((i) => {
      const persistedIn = series.slice(1).filter((s) => outcomeForIssue(i, base.obs, s.obs, promptsById, revised) === 'unchanged')
      const stillPresent = rechecks.length > 0 && outcomeForIssue(i, base.obs, latest.obs, promptsById, revised) === 'unchanged'
      return { key: `critical:${i.id}`, issue: i, seen: persistedIn.length + 1, of: series.length, stillPresent }
    })
    .filter((a) => a.stillPresent)
  const openAlerts = critical.filter((a) => !ackedAlerts.includes(a.key))
  const shownAlerts = alertView === 'open' ? openAlerts : critical.filter((a) => ackedAlerts.includes(a.key))

  // Other changes worth a look — observations, not alerts (unconfirmed or discovery fluctuations).
  const otherChanges: { key: string; locationId: string; text: string; tone: 'neutral' | 'warning' }[] = []
  if (rechecks.length) {
    latest.obs.forEach((o) => {
      const before = series[series.length - 2].obs.find((b) => b.locationId === o.locationId && b.promptId === o.promptId)
      if (isDiscovery(o, promptsById) && before && before.mentioned !== o.mentioned) {
        otherChanges.push({ key: o.id, locationId: o.locationId, text: `${o.mentioned ? 'Now mentioned' : 'No longer mentioned'} for “${o.query}”`, tone: 'neutral' })
      }
      if (hasMismatch(o) && before && !hasMismatch(before)) {
        otherChanges.push({ key: o.id + ':c', locationId: o.locationId, text: `New unconfirmed claim conflict on “${o.query}”`, tone: 'warning' })
      }
    })
  }

  // Competitor co-mentions within the sampled discovery answers only.
  const discoveryOf = (list: Observation[]) => list.filter((o) => isDiscovery(o, promptsById))
  const competitorRows = COMPETITORS.map((name) => {
    const b = discoveryOf(base.obs)
    const l = discoveryOf(latest.obs)
    return { name, base: b.filter((o) => o.answerText.includes(name)).length, baseDen: b.length, latest: l.filter((o) => o.answerText.includes(name)).length, latestDen: l.length }
  })
    .filter((r) => r.base || r.latest)
    .sort((a, b) => b.latest - a.latest)
  const brandRow = { base: discoveryOf(base.obs).filter((o) => o.mentioned).length, latest: discoveryOf(latest.obs).filter((o) => o.mentioned).length }

  // Location trend rows.
  const trendRows = [...new Set(base.obs.map((o) => o.locationId))].map((id) => {
    const b = base.obs.filter((o) => o.locationId === id)
    const l = latest.obs.filter((o) => o.locationId === id)
    return { id, baseRate: mentionRate(b, promptsById), latestRate: mentionRate(l, promptsById), baseConf: factualSummary(b, promptsById).mismatch, latestConf: factualSummary(l, promptsById).mismatch }
  })

  // Source-change annotations: controlled sources marked updated between samples.
  const annotations = tasks
    .filter((t) => audit.locationIds.includes(t.locationId) && inScope(t.locationId))
    .flatMap((t) => t.activity.filter((a) => a.kind === 'status' && a.text.includes('Source updated')).map((a) => ({ task: t, at: a.at })))
    .map((x) => {
      const before = rechecks.find((r) => new Date(r.createdAt) > new Date(x.at))
      return { ...x, label: before ? `before Recheck ${before.wave}` : 'after latest sample' }
    })

  const changed = outcomes.filter((o) => o.outcome === 'changed').length
  const unchanged = outcomes.filter((o) => o.outcome === 'unchanged').length
  const nc = outcomes.filter((o) => o.outcome === 'not_comparable').length
  const uncertain = outcomes.length - changed - unchanged - nc

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Monitoring"
        subtitle="Compare the same matched cohort over time. Observed change; causation not established."
        actions={
          <>
            {audits.length > 1 && (
              <Select value={audit.id} onChange={(e) => setMonitoring({ cohortAuditId: e.target.value })} className="w-60" aria-label="Cohort">
                {audits.map((a) => (
                  <option key={a.id} value={a.id}>
                    Cohort: {a.id} · {a.name}
                  </option>
                ))}
              </Select>
            )}
            <Tip content={SURFACES.B.note}>
              <span>
                <Segmented ariaLabel="Measurement surface" size="sm" value={surface} onChange={setSurface} options={[{ value: 'A' as SurfaceId, label: 'Surface A' }, { value: 'B' as SurfaceId, label: 'Surface B · conceptual' }]} />
              </span>
            </Tip>
            {rechecks.length > 0 && (
              <Button onClick={exportComparison}>
                <Download />
                Export comparison
              </Button>
            )}
            <PermButton perm="runRecheck" variant="primary" onClick={doRecheck} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {running ? 'Sampling…' : 'Run matched recheck'}
            </PermButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <CalendarClock className="size-4 text-brand" />
                Weekly monitoring
              </p>
              <p className="mt-1 text-[12.5px] text-muted">Recheck this cohort automatically every week. You can also run a recheck on demand.</p>
            </div>
            <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} disabled={!can('configureMonitoring')} aria-label="Enable weekly schedule" />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Label htmlFor="mon-day">Run on</Label>
              <Select id="mon-day" value={draft.day} disabled={!draft.enabled || !can('configureMonitoring')} onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}>
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
            <PermButton
              perm="configureMonitoring"
              disabled={draft.enabled === monitoring.enabled && draft.day === monitoring.day}
              onClick={() => {
                setMonitoring({ ...draft, cohortAuditId: audit.id })
                toast.success(draft.enabled ? 'Weekly schedule saved' : 'Weekly schedule turned off', { description: draft.enabled ? `Every ${draft.day} for ${audit.id}` : undefined })
              }}
            >
              Save preference
            </PermButton>
          </div>
          <p className="mt-3 text-[12.5px] text-body">
            {monitoring.enabled ? (
              <>
                <Badge tone="teal">On</Badge> Every {monitoring.day} · next run {fmtDate(nextWeekday(monitoring.day), { weekday: 'short', day: 'numeric', month: 'short' })}
                {monitoring.savedAt && <span className="text-muted"> · saved {fmtDateTime(monitoring.savedAt)}</span>}
              </>
            ) : (
              <>
                <Badge tone="neutral">Off</Badge> <span className="text-muted">No weekly schedule saved.</span>
              </>
            )}
          </p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Fingerprint className="size-4 text-teal-ink" />
            Matched sample cohort
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <div>
              <dt className="text-[12px] text-muted">Locations</dt>
              <dd className="tabular font-medium text-ink">{audit.locationIds.length} (fixed)</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Prompts</dt>
              <dd className="tabular font-medium text-ink">{audit.promptIds.length} normalized (fixed)</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Surface / proxy</dt>
              <dd className="font-medium text-ink">{SURFACES[surface].label}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Analysis rules</dt>
              <dd className="font-medium text-ink">Rules v1 (unchanged)</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-muted">
            {rechecks.length} recheck{rechecks.length === 1 ? '' : 's'} sampled · weekly cadence from {fmtDate(audit.createdAt)}
          </p>
        </Card>
      </div>

      {surface === 'B' && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#f1dcb2] bg-warning-soft px-4 py-3 text-[13px] text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">Surface B — conceptual multi-engine expansion.</span> Its own matched sample, compared only with itself. Figures here are never combined with Surface A, and this is not a production integration.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={region} onChange={(e) => { setRegion(e.target.value); setLocFilter('all') }} className="w-48" aria-label="Region">
          <option value="all">All regions</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="w-56" aria-label="Location">
          <option value="all">All cohort locations</option>
          {locOptions.map((id) => (
            <option key={id} value={id}>
              {LOCATION_BY_ID[id].name}
            </option>
          ))}
        </Select>
        {(region !== 'all' || locFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setRegion('all'); setLocFilter('all') }}>
            Clear
          </Button>
        )}
      </div>

      {awaiting.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Awaiting AI recheck"
            description="Source actions completed or requested — the AI answer hasn't been observed since"
            actions={
              <PermButton perm="runRecheck" size="sm" variant="primary" onClick={doRecheck} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Run matched recheck
              </PermButton>
            }
          />
          <ul className="divide-y divide-line">
            {awaiting.map((i) => {
              const t = tasks.find((x) => x.issueId === i.id && x.channel !== 'verification')
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/issues/${i.id}`} className="text-[13px] font-medium text-ink hover:text-brand">
                      {LOCATION_BY_ID[i.locationId].name} · {i.title}
                    </Link>
                    <p className="text-[12px] text-muted">Same prompt, location, surface and rules will be resampled</p>
                  </div>
                  {t && <TaskStatusBadge status={t.status} channel={t.channel} />}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {notComparable.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <Info className="size-4 text-brand" />
          <p className="min-w-0 flex-1 text-[13px] text-ink">
            <span className="font-medium">New baseline required for {notComparable.map((id) => LOCATION_BY_ID[id].neighborhood).join(', ')}.</span> Verified facts changed after the baseline, so those comparisons aren't valid and aren't plotted as improvements.
          </p>
          <PermButton perm="runAudit" size="sm" onClick={startNewBaseline}>
            Start new baseline
          </PermButton>
        </div>
      )}

      {rechecks.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<RefreshCw />}
            title="No rechecks yet"
            description={`Baseline: ${base.num} of ${base.den} discovery responses mentioned a center (${base.rate.toFixed(0)}%). Run a recheck to compare the same cohort.`}
            action={
              <PermButton perm="runRecheck" variant="primary" onClick={doRecheck} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Run matched recheck
              </PermButton>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                label: 'Sampled discovery mention rate',
                base: <RatioText r={mentionRate(base.obs, promptsById)} />,
                latest: <RatioText r={mentionRate(latest.obs, promptsById)} />,
                change: delta,
                unit: 'pts',
                goodUp: true,
              },
              {
                label: 'Locations mentioned (≥1 discovery answer)',
                base: <RatioText r={baseLoc} />,
                latest: <RatioText r={latestLoc} />,
                change: latestLoc.num - baseLoc.num,
                unit: '',
                goodUp: true,
              },
              {
                label: 'Claim conflicts vs. verified records',
                base: (
                  <span className="tabular">
                    {base.conflicts} <span className="text-muted">of {base.claims} claims</span>
                  </span>
                ),
                latest: (
                  <span className="tabular">
                    {latest.conflicts} <span className="text-muted">of {latest.claims} claims</span>
                  </span>
                ),
                change: latest.conflicts - base.conflicts,
                unit: '',
                goodUp: false,
              },
            ].map((k) => {
              const Icon = k.change === 0 ? Minus : k.change > 0 ? TrendingUp : TrendingDown
              const good = k.change === 0 ? null : (k.change > 0) === k.goodUp
              return (
                <Card key={k.label} className="p-4">
                  <p className="text-[13px] font-medium text-body">{k.label}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-[11.5px] uppercase tracking-[0.04em] text-muted">Baseline</p>
                      <p className="mt-0.5 font-medium text-ink">{k.base}</p>
                    </div>
                    <div>
                      <p className="text-[11.5px] uppercase tracking-[0.04em] text-muted">{latest.label}</p>
                      <p className="mt-0.5 font-medium text-ink">{k.latest}</p>
                    </div>
                  </div>
                  <p className={cn('mt-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium', good === null ? 'bg-subtle text-muted' : good ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                    <Icon className="size-3.5" />
                    {k.change > 0 ? '+' : ''}
                    {k.unit === 'pts' ? k.change.toFixed(0) : k.change} {k.unit} observed change
                  </p>
                </Card>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Sampled discovery mention rate" description="Same locations × unbranded prompts each wave" />
              <div className="h-[240px] px-3 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 16, right: 20, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="label" padding={{ left: 32, right: 32 }} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip kind="rate" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                    <Line type="linear" dataKey="rate" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                      <LabelList dataKey="rate" position="top" offset={10} formatter={(v: number) => `${v.toFixed(0)}%`} style={{ fontSize: 11.5, fill: '#45546b' }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">Sampled observations. AI results fluctuate between runs; changes are not evidence of causal impact.</p>
              {annotations.length > 0 && (
                <ul className="space-y-1 border-t border-line px-5 py-2.5 text-[12px]">
                  {annotations.map((a) => (
                    <li key={a.task.id + a.at} className="flex items-center gap-2 text-body">
                      <span className="size-1.5 rounded-full bg-teal" />
                      Source change: {a.task.id} · {LOCATION_BY_ID[a.task.locationId].neighborhood} {a.task.channel === 'owned_website' ? 'website' : a.task.channel === 'managed_listing' ? 'listing' : 'directory request'} updated {fmtDate(a.at)} ({a.label})
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Claim conflicts vs. verified records" description="Automated rules v1 · same prompts and fields each wave" />
              <div className="h-[240px] px-3 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 16, right: 20, left: -20, bottom: 0 }} barCategoryGap="38%">
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={{ stroke: '#e3eaf1' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7a90' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip kind="conflicts" />} cursor={{ fill: '#f1f5fb' }} />
                    <Bar dataKey="conflicts" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                      <LabelList dataKey="conflicts" position="top" style={{ fontSize: 11.5, fill: '#45546b' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">Sampled observations. AI results fluctuate between runs; changes are not evidence of causal impact.</p>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader
                title={`Issue outcomes · baseline → ${latest.label}`}
                description="Same location + prompt + field, compared with identical rules"
                actions={
                  <div className="flex gap-1.5">
                    <Badge tone="success">{changed} no mismatch</Badge>
                    <Badge tone="danger">{unchanged} still observed</Badge>
                    <Badge tone="warning">{uncertain} inconclusive</Badge>
                    {nc > 0 && <Badge tone="neutral">{nc} new baseline</Badge>}
                  </div>
                }
              />
              {outcomes.length === 0 ? (
                <EmptyState icon={<Check />} title="No baseline issues in this filter" className="py-8" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Issue</Th>
                      <Th>Severity</Th>
                      <Th>Outcome</Th>
                      <Th>Correction task</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.map(({ issue, outcome, task }) => (
                      <Tr key={issue.id}>
                        <Td className="max-w-[320px]">
                          <Link to={`/locations/${issue.locationId}/answers?audit=${audit.id}&prompt=${issue.promptId}&wave=${latestWave}`} className="font-medium text-ink hover:text-brand">
                            {LOCATION_BY_ID[issue.locationId].name}
                          </Link>
                          <p className="truncate text-[12px] text-muted">
                            {CATEGORY_LABEL[issue.category]} · {issue.title}
                          </p>
                        </Td>
                        <Td>
                          <SeverityBadge severity={issue.severity} />
                        </Td>
                        <Td>
                          <Badge tone={OUTCOME[outcome].tone}>{OUTCOME[outcome].label}</Badge>
                        </Td>
                        <Td>{task ? <Link to={`/tasks/${task.id}`}><TaskStatusBadge status={task.status} /></Link> : <span className="text-[12.5px] text-muted">None</span>}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">“No mismatch in latest sample” after a source update is an observed change, not proof the update caused it.</p>
            </Card>

            <div className="space-y-4 self-start">
              <Card>
                <CardHeader
                  title="Critical findings requiring review"
                  description="Confirmed high-severity mismatches still observed · one alert per issue"
                  actions={<Segmented ariaLabel="Alert view" size="sm" value={alertView} onChange={setAlertView} options={[{ value: 'open', label: `Open (${openAlerts.length})` }, { value: 'acked', label: 'Acknowledged' }]} />}
                />
                {shownAlerts.length === 0 ? (
                  <EmptyState icon={alertView === 'open' ? <Bell /> : <BellOff />} title={alertView === 'open' ? 'No critical alerts' : 'Nothing acknowledged yet'} description={alertView === 'open' ? 'Alerts only fire for human-confirmed, materially wrong claims that persist in a recheck.' : undefined} className="py-8" />
                ) : (
                  <ul className="divide-y divide-line">
                    {shownAlerts.map((a) => (
                      <li key={a.key} className="flex gap-3 px-5 py-3">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                        <div className="min-w-0 flex-1">
                          <Link to={`/issues/${a.issue.id}`} className="text-[13px] font-medium text-ink hover:text-brand">
                            {LOCATION_BY_ID[a.issue.locationId].name}
                          </Link>
                          <p className="text-[12.5px] text-body">{a.issue.summary}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            Present in {a.seen} of {a.of} samples · {latest.label}
                          </p>
                        </div>
                        {alertView === 'open' && (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <PermButton perm="requestVerification" size="sm" onClick={() => assignVerification(a.issue)}>
                              Assign urgent verification
                            </PermButton>
                            <Button variant="ghost" size="sm" onClick={() => { ackAlert(a.key); toast('Alert acknowledged') }}>
                              Acknowledge
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {unconfirmedCritical.length > 0 && (
                <Card>
                  <CardHeader title="Needs review before escalation" description="High-severity claims still observed but not yet confirmed by a person" />
                  <ul className="divide-y divide-line">
                    {unconfirmedCritical.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink">{LOCATION_BY_ID[i.locationId].name}</p>
                          <p className="truncate text-[12px] text-body">{i.title}</p>
                        </div>
                        <Button size="sm" asChild>
                          <Link to={`/issues/${i.id}`}>Review</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card>
                <CardHeader title="Other changes" description={`Observations since the previous sample — not alerts`} />
                {otherChanges.length === 0 ? (
                  <p className="px-5 py-4 text-[12.5px] text-muted">No changes in this filter.</p>
                ) : (
                  <ul className="scrollbar-thin max-h-[260px] divide-y divide-line overflow-y-auto">
                    {otherChanges.map((c) => (
                      <li key={c.key} className="flex gap-3 px-5 py-2.5">
                        <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', c.tone === 'warning' ? 'bg-warning' : 'bg-[#94a3b8]')} />
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-ink">{LOCATION_BY_ID[c.locationId].name}</p>
                          <p className="text-[12px] text-body">{c.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader title={`Location trends · baseline → ${latest.label}`} description={`${SURFACES[surface].short} · discovery mentions and claim conflicts per center`} />
              <Table>
                <thead>
                  <tr>
                    <Th>Location</Th>
                    <Th className="text-right">Baseline mentions</Th>
                    <Th className="text-right">{latest.label}</Th>
                    <Th className="text-right">Conflicts</Th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.map((r) => {
                    const d = r.latestRate.num - r.baseRate.num
                    return (
                      <Tr key={r.id}>
                        <Td className="whitespace-nowrap">
                          <Link to={`/locations/${r.id}/answers?audit=${audit.id}&wave=${latestWave}`} className="font-medium text-ink hover:text-brand">
                            {LOCATION_BY_ID[r.id].name}
                          </Link>
                          <p className="text-[12px] text-muted">{LOCATION_BY_ID[r.id].region}</p>
                        </Td>
                        <Td className="tabular text-right">
                          {r.baseRate.num}/{r.baseRate.den}
                        </Td>
                        <Td className="tabular text-right">
                          {r.latestRate.num}/{r.latestRate.den}
                          {d !== 0 && <span className={cn('ml-1.5 text-[12px]', d > 0 ? 'text-success' : 'text-warning')}>{d > 0 ? `+${d}` : d}</span>}
                        </Td>
                        <Td className="tabular text-right">
                          {r.baseConf} → {r.latestConf}
                          {r.latestRate.num === 0 && r.latestRate.den > 0 && (
                            <Link to={`/geo-readiness/${r.id}`} className="ml-2 inline-flex">
                              <Badge tone="warning">Investigate content</Badge>
                            </Link>
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card>
            <Card className="self-start">
              <CardHeader title="Competitor co-mentions" description="Within sampled discovery answers only — not market share or reach" />
              <Table>
                <thead>
                  <tr>
                    <Th>Named in answer</Th>
                    <Th className="text-right">Baseline</Th>
                    <Th className="text-right">{latest.label}</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td className="font-medium text-ink">BrightNest (correct center)</Td>
                    <Td className="tabular text-right">
                      {brandRow.base}/{discoveryOf(base.obs).length}
                    </Td>
                    <Td className="tabular text-right">
                      {brandRow.latest}/{discoveryOf(latest.obs).length}
                    </Td>
                  </Tr>
                  {competitorRows.map((r) => (
                    <Tr key={r.name}>
                      <Td>{r.name}</Td>
                      <Td className="tabular text-right">
                        {r.base}/{r.baseDen}
                      </Td>
                      <Td className="tabular text-right">
                        {r.latest}/{r.latestDen}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">Counts of answers naming each school ({fmtPct(mentionRate(latest.obs, promptsById))} BrightNest location rate in {latest.label}). Competitor names are fictional.</p>
            </Card>
          </div>
          {audit && <DiscoveryCohortPanel auditId={audit.id} />}
        </>
      )}
    </div>
  )
}
