import { Link } from 'react-router-dom'
import { Download, FileText, FlaskConical, Printer, Sparkles, Wrench, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { DiscoveryReportBody } from './DiscoveryInvestigation'
import { CHANNEL_LABELS, LOCATION_BY_ID, ORG, SURFACE } from '@/data/seed'
import { brandOnlyMentions, confirmedMismatches, factualSummary, fmtPct, issueStatus, locationRows, locationsMentioned, mentionRate } from '@/lib/metrics'
import { buildFacts } from '@/lib/facts'
import { buildJsonLd } from '@/lib/geoMarkup'
import { outcomeForIssue, OUTCOME_TEXT, revisedFacts } from '@/lib/aiStatus'
import { exportAuditCsv } from '@/lib/exports'
import { CATEGORY_LABEL, ISSUE_STATUS, PageHeader, RatioText, SeverityBadge, SimTag, TaskStatusBadge } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line px-6 py-6 sm:px-8">
      <h2 className="flex items-baseline gap-3 text-[15px] font-semibold text-ink">
        <span className="tabular text-[12px] font-semibold text-teal-ink">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="tabular mt-1 text-[22px] font-semibold leading-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  )
}

function Group({ icon, title, description, tone }: { icon: React.ReactNode; title: string; description: string; tone: 'blue' | 'teal' | 'amber' }) {
  const cls = { blue: 'bg-brand-soft text-brand border-brand-line', teal: 'bg-teal-soft text-teal-ink border-[#bfeef3]', amber: 'bg-warning-soft text-warning border-[#f1dcb2]' }[tone]
  return (
    <div className={cn('flex items-start gap-3 border-y px-6 py-3 sm:px-8 [&_svg]:size-4', cls)}>
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">{title}</p>
        <p className="text-[12.5px] opacity-90">{description}</p>
      </div>
    </div>
  )
}

function Locked() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-subtle px-4 py-3 text-[13px] text-muted">
      <Sparkles className="size-4" />
      Coming soon to your account.
    </p>
  )
}

export default function ReportsPage() {
  const { latestAudit, observationsFor, promptsById, reviews, issues, tasks, inScope, hasRelease, rechecksFor, factEdits, assetState, dispositions } = useStore()

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Reports" subtitle="Executive progress summary and exports." />
        <Card>
          <EmptyState icon={<FileText />} title="No audit to report on" description="Run a pilot audit to generate a report." action={<Button variant="primary" asChild><Link to="/audits/new">New audit</Link></Button>} />
        </Card>
      </div>
    )
  }

  const audit = latestAudit
  const obs = observationsFor(audit.id).filter((o) => inScope(o.locationId))
  const rate = mentionRate(obs, promptsById)
  const locM = locationsMentioned(obs, promptsById)
  const facts = factualSummary(obs, promptsById)
  const confirmed = confirmedMismatches(obs, reviews)
  const rows = locationRows(obs, promptsById, reviews)
  const auditIssues = issues.filter((i) => i.auditId === audit.id && inScope(i.locationId))
  const reviewed = auditIssues.filter((i) => reviews[i.reviewKey] && reviews[i.reviewKey].status !== 'unreviewed')
  const auditTasks = tasks.filter((t) => audit.locationIds.includes(t.locationId) && inScope(t.locationId))
  const brandOnly = brandOnlyMentions(obs, promptsById)
  const assisted = audit.mode === 'assisted'
  const locIds = [...new Set(obs.map((o) => o.locationId))]
  const sourceRows = locIds.map((id) => {
    const f = buildFacts(id, factEdits)
    const j = buildJsonLd(f, LOCATION_BY_ID[id])
    return { id, verified: f.filter((x) => x.verificationStatus === 'verified').length, total: f.length, pending: f.filter((x) => x.verificationStatus === 'pending_approval').length, readiness: j.readiness, json: assetState(id, 'jsonld'), sheet: assetState(id, 'factsheet') }
  })
  const factTotals = sourceRows.reduce((a, r) => ({ v: a.v + r.verified, t: a.t + r.total }), { v: 0, t: 0 })
  const sourceUpdated = auditTasks.filter((t) => ['source_updated', 'awaiting_recheck', 'closed'].includes(t.status)).length
  const rechecks = rechecksFor(audit.id)
  const latestWave = rechecks[rechecks.length - 1]?.wave
  const recheckObs = latestWave ? observationsFor(audit.id, latestWave).filter((o) => inScope(o.locationId)) : []

  const exportAll = () => {
    const all = [...obs, ...(hasRelease('V2') ? rechecks.flatMap((r) => observationsFor(audit.id, r.wave).filter((o) => inScope(o.locationId))) : [])]
    exportAuditCsv(audit, all, promptsById, reviews, issues, hasRelease('V1') ? tasks : [], '-report')
    toast.success('Report CSV downloaded', { description: `${all.length} observation rows incl. source verification${hasRelease('V1') ? ' and task status' : ''}` })
  }

  let n = 0
  const recheckSum = latestWave ? factualSummary(recheckObs, promptsById) : null
  const unresolved = auditIssues.filter((i) => i.severity === 'high' && !['dismissed', 'closed'].includes(issueStatus(i, reviews, tasks, dispositions)))
  return (
    <div className="animate-fade-in">
      <div className="no-print">
        <PageHeader
          title="Reports"
          subtitle="Executive summary for marketing leadership — observed results, source actions and hypotheses kept separate."
          actions={
            <>
              <Button onClick={() => window.print()}>
                <Printer />
                Print / Save as PDF
              </Button>
              <Button variant="primary" onClick={exportAll}>
                <Download />
                Export CSV
              </Button>
            </>
          }
        />
      </div>

      <Card className="mx-auto max-w-[960px] overflow-hidden print:border-0 print:shadow-none">
        <header className="bg-gradient-to-br from-[#ecfbfd] to-white px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-teal-ink">ProManage · AI Visibility</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-ink">
                {assisted ? 'Executive AI Visibility Baseline Audit' : `${ORG.name} — AI visibility progress report`}
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                {assisted ? `${ORG.name} · prepared with ProManage Customer Success · ` : ''}
                {audit.name} · baseline {fmtDate(audit.createdAt)}
                {hasRelease('V2') && latestWave ? ` · ${rechecks.length} matched recheck${rechecks.length > 1 ? 's' : ''}` : ''} · generated {fmtDate(new Date().toISOString())}
              </p>
            </div>
            <SimTag />
          </div>
        </header>

        <Group icon={<Eye />} tone="blue" title="Observed AI result" description="What sampled AI answers said. Observations, not causes." />

        <Section n={++n} title="Scope">
          <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
            <div>
              <dt className="text-muted">Centers sampled</dt>
              <dd className="tabular font-medium text-ink">
                {locIds.length} of {ORG.totalLocationCount}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Prompt mix</dt>
              <dd className="tabular font-medium text-ink">
                {audit.promptIds.filter((p) => promptsById[p]?.includeInDiscoveryMetric).length} unbranded · {audit.promptIds.filter((p) => !promptsById[p]?.includeInDiscoveryMetric).length} branded
              </dd>
            </div>
            <div>
              <dt className="text-muted">Surface</dt>
              <dd className="font-medium text-ink">{SURFACE}</dd>
            </div>
            <div>
              <dt className="text-muted">Observations</dt>
              <dd className="tabular font-medium text-ink">{obs.length}</dd>
            </div>
          </dl>
        </Section>

        <Section n={++n} title="Headline findings">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Location mention rate" value={fmtPct(rate)} sub={`${rate.num} of ${rate.den} unbranded responses${brandOnly.num ? ` · +${brandOnly.num} brand-only` : ''}`} />
            <Stat label="Centers mentioned" value={`${locM.num}/${locM.den}`} sub="in ≥1 discovery answer" />
            <Stat label="Claims matching record" value={`${facts.match}/${facts.claims}`} sub={`${facts.cannotEvaluate + facts.unverifiable} could not be verified`} />
            <Stat label="Confirmed mismatches" value={confirmed} sub={`of ${facts.mismatch} rule-flagged`} />
          </div>
        </Section>

        <Section n={++n} title="Location coverage">
          <Table>
            <thead>
              <tr>
                <Th>Center</Th>
                <Th className="text-right">Discovery mentions</Th>
                <Th className="text-right">Flagged</Th>
                <Th className="text-right">Confirmed</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.locationId}>
                  <Td className="h-10 font-medium text-ink">{LOCATION_BY_ID[r.locationId].name}</Td>
                  <Td className="h-10 text-right">
                    <RatioText r={r.rate} />
                  </Td>
                  <Td className="tabular h-10 text-right">{r.flagged}</Td>
                  <Td className="tabular h-10 text-right">{r.confirmed}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section n={++n} title="Key reviewed issues">
          {reviewed.length === 0 ? (
            <p className="text-[13px] text-muted">No issues reviewed yet. {auditIssues.length} findings await review.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {reviewed.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <SeverityBadge severity={i.severity} />
                  <span className="font-medium text-ink">{LOCATION_BY_ID[i.locationId].name}</span>
                  <span className="text-body">{i.title}</span>
                  <span className="ml-auto">
                    <Badge tone="outline">
                      {CATEGORY_LABEL[i.category]} · {reviews[i.reviewKey].status.replace('_', ' ')}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section n={++n} title="Matched recheck observations">
          {!hasRelease('V2') ? (
            <Locked />
          ) : !latestWave || !recheckSum ? (
            <p className="text-[13px] text-muted">
              No rechecks yet.{' '}
              <Link to="/monitoring" className="text-brand hover:underline">
                Run a recheck
              </Link>{' '}
              to compare the same cohort.
            </p>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Measure (same cohort, surface & rules)</Th>
                    <Th className="text-right">Baseline</Th>
                    <Th className="text-right">Recheck {latestWave}</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td className="h-10">Location mention rate</Td>
                    <Td className="h-10 text-right">
                      <RatioText r={rate} />
                    </Td>
                    <Td className="h-10 text-right">
                      <RatioText r={mentionRate(recheckObs, promptsById)} />
                    </Td>
                  </Tr>
                  <Tr>
                    <Td className="h-10">Claim conflicts (automated rules)</Td>
                    <Td className="tabular h-10 text-right">
                      {facts.mismatch} of {facts.claims}
                    </Td>
                    <Td className="tabular h-10 text-right">
                      {recheckSum.mismatch} of {recheckSum.claims}
                    </Td>
                  </Tr>
                </tbody>
              </Table>
              {reviewed.filter((i) => reviews[i.reviewKey].status === 'confirmed').length > 0 && (
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  {reviewed
                    .filter((i) => reviews[i.reviewKey].status === 'confirmed')
                    .map((i) => {
                      const o = outcomeForIssue(i, obs, recheckObs, promptsById, revisedFacts(rechecks[rechecks.length - 1]))
                      return (
                        <li key={i.id} className="flex flex-wrap items-center gap-2">
                          <Badge tone={OUTCOME_TEXT[o].tone}>{OUTCOME_TEXT[o].short}</Badge>
                          <span className="text-ink">{LOCATION_BY_ID[i.locationId].name}</span>
                          <span className="text-muted">{i.title}</span>
                        </li>
                      )
                    })}
                </ul>
              )}
              <p className="mt-3 text-[12.5px] font-medium text-ink">Change observed; causation not established.</p>
            </>
          )}
        </Section>

        <Section n={++n} title="Persistent discrepancies & unresolved risks">
          {unresolved.length === 0 ? (
            <p className="text-[13px] text-muted">No unresolved high-severity issues.</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {unresolved.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={i.severity} />
                  <span className="font-medium text-ink">{LOCATION_BY_ID[i.locationId].name}</span>
                  <span className="text-body">{i.title}</span>
                  <span className="ml-auto text-[12px] text-muted">{ISSUE_STATUS[issueStatus(i, reviews, tasks, dispositions)].label}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Group icon={<Wrench />} tone="teal" title="Verified source action" description="What BrightNest verified, approved and changed on sources it controls." />

        <Section n={++n} title="Source validation & generated content">
          {!hasRelease('V1') ? (
            <Locked />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Facts verified" value={`${factTotals.v}/${factTotals.t}`} sub={`${sourceRows.reduce((a, r) => a + r.pending, 0)} awaiting approval`} />
                <Stat label="JSON-LD approved" value={`${sourceRows.filter((r) => r.json.status === 'approved').length}/${sourceRows.length}`} sub="centers" />
                <Stat label="Fact sheets approved" value={`${sourceRows.filter((r) => r.sheet.status === 'approved').length}/${sourceRows.length}`} sub="centers" />
                <Stat label="Source-correction completion" value={`${sourceUpdated}/${auditTasks.length}`} sub="tasks marked source updated" />
              </div>
              <Table className="mt-4">
                <thead>
                  <tr>
                    <Th>Center</Th>
                    <Th className="text-right">Facts verified</Th>
                    <Th className="text-right">Markup readiness</Th>
                    <Th>JSON-LD</Th>
                    <Th>Fact sheet</Th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="h-10 font-medium text-ink">{LOCATION_BY_ID[r.id].name}</Td>
                      <Td className="tabular h-10 text-right">
                        {r.verified}/{r.total}
                      </Td>
                      <Td className="tabular h-10 text-right">
                        {r.readiness.num}/{r.readiness.den}
                      </Td>
                      <Td className="h-10">
                        <Badge tone={r.json.status === 'approved' ? 'success' : 'neutral'}>{r.json.status === 'approved' ? 'Approved' : 'Draft'}</Badge>
                      </Td>
                      <Td className="h-10">
                        <Badge tone={r.sheet.status === 'approved' ? 'success' : 'neutral'}>{r.sheet.status === 'approved' ? 'Approved' : 'Draft'}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="mt-2 text-[12px] text-muted">Markup readiness = eligible, verified fields represented in valid output. It is not a measure of AI visibility.</p>
            </>
          )}
        </Section>

        <Section n={++n} title="Correction tasks & publication status">
          {!hasRelease('V1') ? (
            <Locked />
          ) : auditTasks.length === 0 ? (
            <p className="text-[13px] text-muted">No correction tasks created yet.</p>
          ) : (
            <>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {auditTasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="text-muted">{t.id}</span>
                    <span className="font-medium text-ink">{t.title}</span>
                    <span className="text-muted">· {CHANNEL_LABELS[t.channel]}</span>
                    {t.approvedBy && <span className="text-muted">· approved by {t.approvedBy}</span>}
                    <span className="ml-auto">
                      <TaskStatusBadge status={t.status} channel={t.channel} />
                    </span>
                    <span className="w-full text-[12px] text-muted">
                      {t.activity
                        .filter((a) => a.kind !== 'comment')
                        .map((a) => `${fmtDate(a.at)} ${a.text.replace(/^Status → /, '→ ')}`)
                        .slice(-4)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] text-muted">Publication is recorded by task owners; nothing was pushed to live sites by ProManage. A completed task does not mean an AI answer changed.</p>
            </>
          )}
        </Section>

        <Section n={++n} title="Discoverability improvement">
          <DiscoveryReportBody auditId={latestAudit.id} />
        </Section>

        <Group icon={<FlaskConical />} tone="amber" title="Hypothesized business value" description="Hypotheses and pilot targets to validate — not results." />

        <Section n={++n} title="Hypotheses & pilot targets">
          <ul className="space-y-2 text-[13px] text-body">
            <li>
              <span className="font-medium text-ink">Hypothesis:</span> correcting materially wrong facts (closure status, tours, contact details) on controlled sources reduces the chance families are misdirected. <span className="text-muted">Validate with matched rechecks and center feedback.</span>
            </li>
            <li>
              <span className="font-medium text-ink">Hypothesis:</span> consistent, verified center information supports discovery over time. <span className="text-muted">No ranking or enrolment effect is claimed.</span>
            </li>
            <li>
              <span className="font-medium text-ink">Pilot target to validate:</span> at least one confirmed issue moved from verified facts → approved content → source updated, without being mistaken for an AI-answer fix.
            </li>
            <li>
              <span className="font-medium text-ink">Pilot target to validate:</span> the team can distinguish persistent verified issues from normal answer variability across rechecks.
            </li>
          </ul>
        </Section>

        <Section n={++n} title="Method & limitations">
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-body">
            <li>One sampled response per center × prompt on {SURFACE}; responses vary between runs and may differ from consumer apps.</li>
            <li>Mention rate counts unbranded discovery prompts only, and only when the specific center is named; brand-only mentions are reported separately.</li>
            <li>Claims are compared with verified records (rules v1). Unverified facts are “Cannot evaluate”, never mismatches; mismatches count only after human confirmation.</li>
            <li>Rechecks compare the same location, prompt, surface and rules. Observed change is not evidence of causal impact.</li>
            <li>ProManage cannot control what AI assistants recommend; it helps correct the sources BrightNest controls. No revenue attribution.</li>
          </ul>
        </Section>
      </Card>
    </div>
  )
}
