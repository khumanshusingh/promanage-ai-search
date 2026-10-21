import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, CircleDashed, Download, Eye, EyeOff, Inbox, MapPin, Printer, Search, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, SURFACE } from '@/data/seed'
import { brandOnlyMentions, confirmedMismatches, factualSummary, fmtPct, isDiscovery, locationRows, locationsMentioned, mentionRate, outcomeCounts, outcomeOf, type LocationRow, type ObservationOutcome } from '@/lib/metrics'
import { exportAuditCsv } from '@/lib/exports'
import { useSort } from '@/lib/useSort'
import { KpiCard, PageHeader, RatioText, SimTag, SourceBadge } from '@/components/domain'
import { Segmented } from '@/components/ui/misc'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { SortTh, Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { Tip } from '@/components/ui/tooltip'
import { cn, fmtDateTime } from '@/lib/utils'

const OUTCOMES: { key: ObservationOutcome; label: string; hint: string; icon: React.ReactNode; bar: string; text: string }[] = [
  { key: 'omission', label: 'Potential omissions', hint: 'Unbranded discovery answers that did not mention the center. An observation, not an error.', icon: <EyeOff />, bar: 'bg-[#b7c3d3]', text: 'text-body' },
  { key: 'mismatch', label: 'Factual mismatches', hint: 'Claims that conflict with a verified record (rule-flagged; confirm in review).', icon: <ShieldAlert />, bar: 'bg-danger', text: 'text-danger' },
  { key: 'unverifiable', label: 'Unverifiable claims', hint: 'Claims not in the record, or about fields that are not yet verified.', icon: <CircleDashed />, bar: 'bg-[#e0a43a]', text: 'text-warning' },
  { key: 'clear', label: 'No issues found in sample', hint: 'Mentioned in discovery, or branded claims that match the record.', icon: <BadgeCheck />, bar: 'bg-teal', text: 'text-teal-ink' },
]

const STATUS: Record<LocationRow['status'], { label: string; tone: 'warning' | 'danger' | 'neutral' | 'success' }> = {
  flagged: { label: 'Needs review', tone: 'warning' },
  confirmed: { label: 'Confirmed mismatch', tone: 'danger' },
  review: { label: 'Record gaps', tone: 'neutral' },
  clear: { label: 'No issues in sample', tone: 'success' },
}

export default function AuditResultsPage() {
  const { id = '' } = useParams()
  const { audits, observationsFor, promptsById, reviews, inScope, issues, tasks, hasRelease } = useStore()
  const navigate = useNavigate()
  const audit = audits.find((a) => a.id === id)
  const obs = useMemo(() => (audit ? observationsFor(audit.id).filter((o) => inScope(o.locationId)) : []), [audit, observationsFor, inScope])

  const [q, setQ] = useState('')
  const [region, setRegion] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [outcomeF, setOutcomeF] = useState<ObservationOutcome | null>(null)
  const [intent, setIntent] = useState<'all' | 'discovery' | 'branded'>('all')

  const intentObs = useMemo(() => obs.filter((o) => intent === 'all' || (intent === 'discovery') === isDiscovery(o, promptsById)), [obs, intent, promptsById])
  const rows = useMemo(() => locationRows(intentObs, promptsById, reviews), [intentObs, promptsById, reviews])
  const filtered = rows.filter((r) => {
    const loc = LOCATION_BY_ID[r.locationId]
    if (q && !loc.name.toLowerCase().includes(q.toLowerCase())) return false
    if (region !== 'all' && loc.region !== region) return false
    if (statusF !== 'all' && r.status !== statusF) return false
    if (outcomeF && !intentObs.some((o) => o.locationId === r.locationId && outcomeOf(o, promptsById) === outcomeF)) return false
    return true
  })
  const { sorted, sort, onSort } = useSort(filtered, { key: 'rate', dir: 'desc' }, {
    name: (r) => LOCATION_BY_ID[r.locationId].name,
    tested: (r) => r.discoveryTested,
    mentions: (r) => r.mentions,
    rate: (r) => r.rate.pct ?? -1,
    checks: (r) => r.factualChecks,
    flagged: (r) => r.flagged,
    confirmed: (r) => r.confirmed,
    status: (r) => r.status,
  })

  if (!audit && id === 'demo-001' && audits.length) return <Navigate to={`/audits/${audits[0].id}`} replace />
  if (!audit) {
    return (
      <EmptyState
        icon={<Search />}
        title="Audit not found"
        description={audits.length ? `There is no audit with id “${id}”.` : 'No audits have been run yet. Start a new audit to see results here.'}
        action={
          <Button variant="primary" asChild>
            <Link to={audits.length ? '/audits' : '/audits/new'}>{audits.length ? 'View audits' : 'New audit'}</Link>
          </Button>
        }
      />
    )
  }

  const rate = mentionRate(obs, promptsById)
  const locM = locationsMentioned(obs, promptsById)
  const facts = factualSummary(obs, promptsById)
  const confirmed = confirmedMismatches(obs, reviews)
  const brandOnly = brandOnlyMentions(obs, promptsById)
  const assisted = audit.mode === 'assisted'
  const outcomes = outcomeCounts(obs, promptsById)
  const regions = [...new Set(rows.map((r) => LOCATION_BY_ID[r.locationId].region))]
  const anyFilter = q || region !== 'all' || statusF !== 'all' || outcomeF || intent !== 'all'

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <>
            <Link to="/audits" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              Audits
            </Link>
            <span className="text-line">/</span>
            <span>{audit.id}</span>
            {assisted && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">Executive AI Visibility Baseline Audit</span>}
          </>
        }
        title={audit.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Run {fmtDateTime(audit.createdAt)}</span>
            <span className="text-line">•</span>
            <span>Source: {SURFACE}</span>
            <span className="text-line">•</span>
            <span className="tabular">{obs.length} observations</span>
            {assisted && <span>· Assisted{audit.csvImport ? ` · imported from ${audit.csvImport.fileName}` : ''}</span>}
            <SimTag />
          </span>
        }
        actions={
          <>
            {hasRelease('V1') && (
              <Button asChild>
                <Link to="/issues">
                  <Inbox />
                  Issue inbox
                </Link>
              </Button>
            )}
            <Button className="no-print" onClick={() => window.print()}>
              <Printer />
              Print / Save as PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                exportAuditCsv(audit, obs, promptsById, reviews, issues, tasks)
                toast.success('CSV downloaded', { description: `${obs.length} observation rows` })
              }}
            >
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sampled discovery mention rate" icon={<Eye />} tone="teal" value={fmtPct(rate)} detail={`${rate.num} of ${rate.den}`} definition="Unbranded discovery responses mentioning the correct center ÷ all unbranded discovery responses in this audit. A different BrightNest branch being named doesn't count." footer={brandOnly.num ? `+${brandOnly.num} brand-only (another branch named)` : 'Unbranded prompts only'} />
        <KpiCard label="Locations mentioned" icon={<MapPin />} value={locM.num} detail={`of ${locM.den} centers`} definition="Centers mentioned in at least one sampled unbranded discovery response. Not the enterprise branch count." footer="In ≥1 discovery answer" />
        <KpiCard
          label="Factual claims checked"
          icon={<BadgeCheck />}
          value={facts.claims}
          detail="claims"
          definition="Claims extracted from all responses and compared with verified BrightNest records using rules v1."
          footer={
            <span className="tabular">
              {facts.match} match · {facts.mismatch} flagged · {facts.cannotEvaluate + facts.unverifiable} can't verify
            </span>
          }
        />
        <KpiCard label="Confirmed mismatches" icon={<ShieldAlert />} tone="danger" value={confirmed} detail={`of ${facts.mismatch} flagged`} definition="Rule-flagged conflicts that a person has reviewed and confirmed. Flags alone don't count." footer={confirmed < facts.mismatch ? `${facts.mismatch - confirmed} flagged claims awaiting review` : 'All flagged claims reviewed'} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Issue summary" description={`Every observation falls into exactly one bucket · total ${obs.length}. Click to filter the table.`} />
        <div className="px-5 pb-5 pt-4">
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {OUTCOMES.map((o) => (outcomes[o.key] ? <div key={o.key} className={cn(o.bar, 'h-full first:rounded-l-full last:rounded-r-full')} style={{ width: `${(outcomes[o.key] / obs.length) * 100}%` }} /> : null))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {OUTCOMES.map((o) => {
              const active = outcomeF === o.key
              return (
                <button
                  key={o.key}
                  onClick={() => setOutcomeF(active ? null : o.key)}
                  aria-pressed={active}
                  className={cn('flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors', active ? 'border-brand bg-brand-soft' : 'border-line hover:border-[#cdd7e3] hover:bg-subtle')}
                >
                  <span className={cn('mt-0.5 [&_svg]:size-4', o.text)}>{o.icon}</span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="tabular text-[20px] font-semibold leading-none text-ink">{outcomes[o.key]}</span>
                      <span className="text-[13px] font-medium text-ink">{o.label}</span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted">{o.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Locations" description="Select a row to inspect sampled answers and review claims." actions={<span className="no-print"><SourceBadge /></span>} />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search locations" className="pl-9" aria-label="Search locations" />
          </div>
          <Segmented
            ariaLabel="Prompt intent"
            size="sm"
            value={intent}
            onChange={setIntent}
            options={[
              { value: 'all', label: 'All prompts' },
              { value: 'discovery', label: 'Unbranded discovery' },
              { value: 'branded', label: 'Branded facts' },
            ]}
          />
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-44" aria-label="Region">
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-48" aria-label="Status">
            <option value="all">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          {outcomeF && (
            <Badge tone="blue" className="h-7 px-2.5">
              Has: {OUTCOMES.find((o) => o.key === outcomeF)?.label}
              <button onClick={() => setOutcomeF(null)} aria-label="Remove outcome filter">
                <X className="!size-3.5" />
              </button>
            </Badge>
          )}
          {anyFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setRegion('all'); setStatusF('all'); setOutcomeF(null); setIntent('all') }}>
              Clear filters
            </Button>
          )}
          <span className="tabular ml-auto text-[12.5px] text-muted">
            {sorted.length} of {rows.length}
          </span>
        </div>
        {sorted.length === 0 ? (
          <EmptyState icon={<Search />} title="No locations match these filters" action={<Button size="sm" onClick={() => { setQ(''); setRegion('all'); setStatusF('all'); setOutcomeF(null); setIntent('all') }}>Clear filters</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTh label="Location" sortKey="name" sort={sort} onSort={onSort} />
                <SortTh label="Discovery tested" sortKey="tested" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Mentions" sortKey="mentions" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Mention rate" sortKey="rate" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Factual checks" sortKey="checks" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Flagged" sortKey="flagged" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Confirmed" sortKey="confirmed" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <Th className="w-10">
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const loc = LOCATION_BY_ID[r.locationId]
                const s = STATUS[r.status]
                const href = `/locations/${r.locationId}/answers?audit=${audit.id}`
                return (
                  <Tr key={r.locationId} onClick={() => navigate(href)}>
                    <Td className="whitespace-nowrap">
                      <Link to={href} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {loc.name}
                      </Link>
                      <p className="text-[12px] text-muted">{loc.region}</p>
                    </Td>
                    <Td className="tabular text-right">{r.discoveryTested}</Td>
                    <Td className="tabular text-right">{r.mentions}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#e9eef4] md:block" aria-hidden>
                          <div className="h-full rounded-full bg-teal" style={{ width: `${r.rate.pct ?? 0}%` }} />
                        </div>
                        <span className="tabular w-10 text-right font-medium text-ink">{fmtPct(r.rate)}</span>
                      </div>
                    </Td>
                    <Td className="tabular text-right">{r.factualChecks}</Td>
                    <Td className="tabular text-right">{r.flagged ? <span className="font-medium text-danger">{r.flagged}</span> : <span className="text-muted">0</span>}</Td>
                    <Td className="tabular text-right">{r.confirmed || <span className="text-muted">0</span>}</Td>
                    <Td>
                      <Tip content={r.cannotEvaluate ? `${r.cannotEvaluate} claim(s) could not be verified against the record` : undefined}>
                        <span>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </span>
                      </Tip>
                    </Td>
                    <Td>
                      <ArrowRight className="size-4 text-muted" />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <span>
            Totals: <RatioText r={mentionRate(obs.filter((o) => sorted.some((r) => r.locationId === o.locationId)), promptsById)} /> mention rate for shown locations
          </span>
          <span>Mention rate excludes branded prompts.</span>
        </div>
      </Card>
      <Card className="mt-6 break-inside-avoid p-5">
        <p className="text-[14px] font-semibold text-ink">Methodology & limitations</p>
        <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12.5px] leading-snug text-body md:grid-cols-2">
          <p>Scope: {audit.locationIds.length} centers × {audit.promptIds.length} prompts × 1 surface ({SURFACE}) = {obs.length} observations, one sampled response each.</p>
          <p>Mention rate counts unbranded discovery prompts only, and only when the specific center is named.</p>
          <p>Claims are compared with verified records (rules v1). Unverified facts are “Cannot evaluate”, never mismatches.</p>
          <p>Mismatches count only after human confirmation. Non-mentions are observations, not errors.</p>
          <p>AI output varies between runs and may differ from consumer apps; this is not a view of users' conversations.</p>
          <p>No relationship to enquiries, enrolment or revenue is claimed.</p>
        </div>
      </Card>
    </div>
  )
}
