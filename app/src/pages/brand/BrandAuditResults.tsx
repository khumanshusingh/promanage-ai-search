import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Download, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, ORG } from '@/data/seed'
import { confirmedMismatches, fmtPct, mentionRate } from '@/lib/metrics'
import { exportAuditCsv } from '@/lib/exports'
import { STAGE, useBrandViews } from '@/lib/brandStatus'
import { HowMeasured, StageBadge } from '@/components/brand'
import { PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'
import AuditResultsPage from '../AuditResults'
import { useLocationFindings } from './BrandLocations'

export default function BrandAuditResults() {
  const { id = '' } = useParams()
  const { audits, observationsFor, promptsById, reviews, issues, tasks } = useStore()
  const { views } = useBrandViews()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(false)
  const audit = audits.find((a) => a.id === id)
  const rows = useLocationFindings(audit?.id)
  if (!audit && id === 'demo-001' && audits.length) return <Navigate to={`/audits/${audits[0].id}`} replace />
  if (!audit) return <EmptyState icon={<Search />} title="No AI visibility check has been run yet." action={<Button variant="primary" asChild><Link to="/overview">Go to overview</Link></Button>} />

  const obs = observationsFor(audit.id)
  const mine = views.filter((v) => v.issue.auditId === audit.id)
  const accuracy = mine.filter((v) => v.stage !== 'discovery')
  const flagged = accuracy.filter((v) => ['answer_question', 'verify_fact', 'awaiting_ops'].includes(v.stage)).length
  const needsVerify = accuracy.filter((v) => v.stage === 'verify_fact' || v.stage === 'awaiting_ops').length
  const rate = mentionRate(obs, promptsById)
  const discoveryRows = rows.filter((r) => r.rate.num < r.rate.den)

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/overview" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Overview
          </Link>
        }
        title="Your AI Visibility Check"
        subtitle={`Results from selected locations and questions — not all customer AI conversations. Checked ${fmtDate(audit.createdAt)}.`}
        actions={
          <>
            <Button className="no-print" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                exportAuditCsv(audit, obs, promptsById, reviews, issues, tasks)
                toast.success('Results downloaded')
              }}
            >
              <Download />
              Download results
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Locations checked', `${new Set(obs.map((o) => o.locationId)).size} of ${ORG.totalLocationCount}`],
          ['Information that may be incorrect', String(flagged)],
          ['Information you confirmed as incorrect', String(confirmedMismatches(obs, reviews))],
          ['Locations appearing in selected searches', `${rows.filter((r) => r.rate.num > 0).length} of ${rows.length}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] font-medium text-body">{k}</p>
            <p className="tabular mt-1.5 text-[24px] font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <HowMeasured>
          One sampled answer per question and centre in a demo AI search check. Your locations appeared in {rate.num} of {rate.den} selected general searches ({fmtPct(rate)}). Questions about your centres by name aren’t counted in that figure.
        </HowMeasured>
      </div>

      {needsVerify > 0 && (
        <div className="mt-4 rounded-xl border border-[#f1dcb2] bg-warning-soft px-4 py-3 text-[14px] text-ink">We need to verify some store details before checking their accuracy. ({needsVerify} item{needsVerify > 1 ? 's' : ''})</div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Information accuracy" description="Potential business-information issues in AI answers" />
          {accuracy.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-body">No information problems found in this sample.</p>
          ) : (
            <ul className="divide-y divide-line">
              {accuracy.map((v) => (
                <li key={v.issue.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">{v.title}</p>
                    <div className="mt-1">
                      <StageBadge stage={v.stage} />
                    </div>
                  </div>
                  <Button size="sm" variant={STAGE[v.stage].needsBrand ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/${v.issue.id}`)}>
                    {STAGE[v.stage].cta}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Discovery opportunities" description="Visibility observations — not errors. Reasons are unknown unless investigated." />
          <ul className="divide-y divide-line">
            {discoveryRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-[14px]">
                <span className="min-w-0 flex-1 text-ink">{LOCATION_BY_ID[r.id].name}</span>
                <span className="text-body">{r.rate.num === 0 ? 'Not mentioned in selected searches' : `Mentioned in ${r.rate.num} of ${r.rate.den} selected searches`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="By location" />
        <Table>
          <thead>
            <tr>
              <Th>Location</Th>
              <Th>What we found</Th>
              <Th>Your next action</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id} onClick={() => navigate(`/locations/${r.id}/answers`)}>
                <Td className="whitespace-nowrap font-medium text-ink">{LOCATION_BY_ID[r.id].name}</Td>
                <Td className="text-[14px] text-ink">{r.found}</Td>
                <Td className="text-[14px] text-body">{r.top ? STAGE[r.top.stage].cta : 'Nothing to do'}</Td>
                <Td>{r.top ? <StageBadge stage={r.top.stage} /> : <span className="text-[13px] text-muted">—</span>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="no-print mt-6">
        <button onClick={() => setDetail((d) => !d)} aria-expanded={detail} className="flex items-center gap-2 text-[14px] font-medium text-brand hover:underline">
          <ChevronDown className={cn('size-4 transition-transform', detail && 'rotate-180')} />
          {detail ? 'Hide detailed results' : 'View detailed results'}
        </button>
        {detail && (
          <div className="mt-4 rounded-xl border border-dashed border-line p-4">
            <AuditResultsPage />
          </div>
        )}
      </div>
    </div>
  )
}
