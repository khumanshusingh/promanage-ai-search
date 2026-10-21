import { Link } from 'react-router-dom'
import { Download, FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, ORG, PEOPLE } from '@/data/seed'
import { mentionRate } from '@/lib/metrics'
import { downloadCsv } from '@/lib/csv'
import { STAGE, useBrandViews } from '@/lib/brandStatus'
import { DISCOVERY_STAGE } from '@/lib/discovery'
import { useDiscovery } from '@/lib/useDiscovery'
import { PageHeader, SimTag } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate } from '@/lib/utils'

function Q({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line px-6 py-5 sm:px-8">
      <h2 className="text-[16px] font-semibold text-ink">
        {n}. {title}
      </h2>
      <div className="mt-2 text-[14px] text-body">{children}</div>
    </section>
  )
}

/** Executive summary in customer language — the five questions from the Brand brief. */
export default function BrandReports() {
  const { latestAudit, audits, observationsFor, promptsById, tasks, hasRelease, rechecksFor, plans, investigations } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  if (!latestAudit) {
    return <EmptyState icon={<FileText />} title="No AI visibility check has been run yet." action={<Button variant="primary" asChild><Link to="/overview">Go to overview</Link></Button>} />
  }
  const audit = latestAudit
  const obs = observationsFor(audit.id)
  const rate = mentionRate(obs, promptsById)
  const mine = views.filter((v) => v.issue.auditId === audit.id && v.stage !== 'discovery')
  const toVerify = mine.filter((v) => ['verify_fact', 'awaiting_ops', 'answer_question'].includes(v.stage))
  // Confirmed issues still being worked on, including ones awaiting a decision after a follow-up check
  const resolving = mine.filter(
    (v) =>
      ['send_to_promanage', 'investigating', 'proposal_ready', 'changes_requested', 'update_in_progress', 'awaiting_recheck', 'no_source_found'].includes(v.stage) ||
      (['looks_correct', 'still_incorrect', 'inconclusive'].includes(v.stage) && (!!plans[v.issue.id] || !!investigations[v.issue.id])),
  )
  const whoIsOn = (v: (typeof resolving)[number]) => {
    if (v.stage === 'send_to_promanage' || v.stage === 'proposal_ready' || v.stage === 'looks_correct') return 'You'
    if (v.stage === 'update_in_progress') {
      const owners = tasks.filter((t) => t.issueId === v.issue.id && !['awaiting_recheck', 'closed', 'source_updated'].includes(t.status)).map((t) => PEOPLE.find((p) => p.id === t.assigneeId)?.name)
      return [...new Set(owners.filter(Boolean))].join(', ') || 'Source owners'
    }
    return 'ProManage'
  }
  const done = tasks.filter((t) => !t.opportunityId && audit.locationIds.includes(t.locationId) && ['awaiting_recheck', 'closed'].includes(t.status))
  const dm = disc.metricsFor(audit.id)
  const dOpps = disc.latest
  const dDone = tasks.filter((t) => t.opportunityId && ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status))
  const dRechecked = dOpps.map((o) => ({ o, rc: disc.recheckFor(o) })).filter((x) => x.rc && disc.record(x.o.id)?.plan?.status === 'approved')
  const rechecks = rechecksFor(audit.id)
  const followed = mine.filter((v) => v.aiDim !== 'Not rechecked')

  const exportSummary = () => {
    downloadCsv(
      `brightnest-ai-search-summary-${audit.id}.csv`,
      [
        ...mine.map((v) => ({
          category: 'Accuracy',
          location: LOCATION_BY_ID[v.issue.locationId].name,
          finding: v.title.split(' — ')[1],
          status: STAGE[v.stage].label,
          your_information: v.factDim,
          information_updates: v.sourceDim,
          latest_ai_check: v.aiDim,
          note: v.aiDim === 'Looks correct' ? 'Observed in the latest sample; not proof of cause' : '',
        })),
        ...dOpps.map((o) => {
          const rc = disc.recheckFor(o)
          return {
            category: 'Discovery',
            location: LOCATION_BY_ID[o.locationId].name,
            finding: `Not mentioned in ${o.missedPromptIds.length} of ${o.observationIds.length} selected general searches (${o.intentCategory})`,
            status: DISCOVERY_STAGE[o.status].label,
            your_information: o.eligibility === 'eligible' ? 'Relevant' : o.eligibility === 'not_relevant' ? 'Not relevant' : 'Relevance not reviewed',
            information_updates: `${disc.tasksFor(o).filter((t) => ['awaiting_recheck', 'closed', 'source_updated'].includes(t.status)).length} of ${disc.tasksFor(o).length} recorded`,
            latest_ai_check: rc ? (rc.comparable ? `${rc.baselineMentionCount}/${rc.baselineEligibleCount} -> ${rc.recheckMentionCount}/${rc.recheckEligibleCount}` : 'Inconclusive') : 'No follow-up',
            note: 'Sampled observation, not an error; changes are not proof of cause',
          }
        }),
      ],
      [`# ${ORG.name} — AI search summary (${fmtDate(audit.createdAt)})`, '# Demo data from selected AI searches; responses can vary'],
    )
    toast.success('Summary downloaded')
  }

  return (
    <div className="animate-fade-in">
      <div className="no-print">
        <PageHeader
          title="Reports"
          subtitle="A readable summary you can share."
          actions={
            <>
              <Button onClick={() => window.print()}>
                <Printer />
                Print / Save as PDF
              </Button>
              <Button variant="primary" onClick={exportSummary}>
                <Download />
                Download summary
              </Button>
            </>
          }
        />
      </div>
      <Card className="mx-auto max-w-[900px] overflow-hidden print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#ecfbfd] to-white px-6 py-6 sm:px-8">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-teal-ink">AI Visibility summary</p>
            <h1 className="mt-1 text-[22px] font-semibold text-ink">{ORG.name}</h1>
            <p className="mt-1 text-[14px] text-body">Latest check {fmtDate(audit.createdAt)} · generated {fmtDate(new Date().toISOString())}</p>
          </div>
          <SimTag />
        </header>
        <Q n={1} title="What did we check?">
          {audit.locationIds.length} of {ORG.totalLocationCount} centres, with {audit.promptIds.length} common questions parents ask AI assistants. Your centres appeared in {rate.num} of {rate.den} selected general searches. This is a sample, not all customer AI conversations.
        </Q>
        <Q n={2} title="What information needs your verification?">
          {toVerify.length === 0 ? 'Nothing right now.' : (
            <ul className="list-disc pl-5">
              {toVerify.map((v) => (
                <li key={v.issue.id}>{v.title}</li>
              ))}
            </ul>
          )}
        </Q>
        <Q n={3} title="Which confirmed issues are being resolved, and by whom?">
          {!hasRelease('V1') ? 'Correction handling begins in your next phase.' : resolving.length === 0 ? 'None in progress.' : (
            <ul className="list-disc pl-5">
              {resolving.map((v) => (
                <li key={v.issue.id}>
                  {v.title}
                  {/* After a recheck the title already states the outcome */}
                  {!['looks_correct', 'still_incorrect', 'inconclusive'].includes(v.stage) && ` — ${STAGE[v.stage].label}`} · <span className="text-muted">next: {whoIsOn(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </Q>
        <Q n={4} title="What updates were completed?">
          {done.length === 0 ? 'No updates completed yet.' : (
            <ul className="list-disc pl-5">
              {done.map((t) => (
                <li key={t.id}>
                  {t.title} — by {PEOPLE.find((p) => p.id === t.assigneeId)?.name}
                </li>
              ))}
            </ul>
          )}
        </Q>
        <Q n={5} title="What did the latest comparable AI checks show?">
          {!hasRelease('V2') || rechecks.length === 0 ? 'No follow-up check yet.' : (
            <>
              <ul className="list-disc pl-5">
                {followed.map((v) => (
                  <li key={v.issue.id}>
                    {LOCATION_BY_ID[v.issue.locationId].name}: {v.aiDim === 'Looks correct' ? 'looks correct in the latest AI check' : v.aiDim === 'Still incorrect' ? 'still incorrect in the latest AI check' : 'inconclusive — more checks needed'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted">Changes are observed in samples; they don’t prove what caused them or guarantee future answers.</p>
            </>
          )}
        </Q>
        <Q n={6} title="Discoverability checks">
          <p>
            In {fmtDate(audit.createdAt)}’s sample, your centres were not mentioned in {dm.notMentioned} of {dm.total} selected general searches. In searches that match what centres offer, they were mentioned in {dm.eligibleMentioned} of {dm.eligible}. {dm.awaitingReview} still need a relevance check and {dm.notRelevant} were marked not relevant (kept as evidence, excluded from the rate).
          </p>
          <ul className="mt-2 list-disc pl-5">
            {dOpps
              .filter((o) => !['observed', 'eligibility_review', 'not_relevant', 'archived'].includes(o.status))
              .map((o) => (
                <li key={o.id}>
                  {LOCATION_BY_ID[o.locationId].name} ({o.intentCategory}): {DISCOVERY_STAGE[o.status].label.toLowerCase()}
                </li>
              ))}
          </ul>
          {dDone.length > 0 && (
            <>
              <p className="mt-2 font-medium text-ink">Completed website and listing improvements</p>
              <ul className="list-disc pl-5">
                {dDone.map((t) => (
                  <li key={t.id}>
                    {t.title} — by {PEOPLE.find((p) => p.id === t.assigneeId)?.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {hasRelease('V2') && dRechecked.length > 0 && (
            <>
              <p className="mt-2 font-medium text-ink">Latest follow-up AI checks</p>
              <ul className="list-disc pl-5">
                {dRechecked.map(({ o, rc }) => (
                  <li key={o.id}>
                    {LOCATION_BY_ID[o.locationId].name}: {rc!.comparable ? `mentioned in ${rc!.baselineMentionCount} of ${rc!.baselineEligibleCount} matching searches before → ${rc!.recheckMentionCount} of ${rc!.recheckEligibleCount} in follow-up ${rc!.recheckWave} (${fmtDate(rc!.sampledAt)})` : `inconclusive — ${rc!.nonComparabilityReason}`}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-[13px] text-muted">Sampled responses; not every customer’s AI search. Observed changes are not proof that updates caused them, and no change in enquiries is implied.</p>
        </Q>
        <Q n={7} title="Past checks">
          <ul className="list-disc pl-5">
            {[...audits].reverse().map((a) => (
              <li key={a.id}>
                <Link to={`/audits/${a.id}`} className="text-brand hover:underline">
                  {fmtDate(a.createdAt)}
                </Link>{' '}
                — {a.locationIds.length} centres
              </li>
            ))}
          </ul>
        </Q>
      </Card>
    </div>
  )
}
