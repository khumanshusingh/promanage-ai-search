import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, MapPin, Search } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, LOCATIONS, ORG } from '@/data/seed'
import { isDiscovery, mentionRate } from '@/lib/metrics'
import { STAGE, useBrandViews, type BrandView } from '@/lib/brandStatus'
import { EvidenceDisclosure, StageBadge } from '@/components/brand'
import { PageHeader } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { DiscoveryStageBadge, NotAnErrorNote, QueryRow } from '@/components/discovery'
import { DISCOVERY_STAGE, discoveryId } from '@/lib/discovery'
import { useDiscovery } from '@/lib/useDiscovery'

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/** Shared "Location | What we found | Your next action | Status" rows. */
export function useLocationFindings(auditId: string | undefined) {
  const { observationsFor, promptsById } = useStore()
  const { views } = useBrandViews()
  return useMemo(() => {
    if (!auditId) return []
    const obs = observationsFor(auditId)
    const ids = [...new Set(obs.map((o) => o.locationId))]
    return ids.map((id) => {
      const mine = views.filter((v) => v.issue.locationId === id && v.issue.auditId === auditId && v.stage !== 'discovery').sort((a, b) => RANK[a.issue.severity] - RANK[b.issue.severity])
      const open = mine.filter((v) => !['not_an_issue', 'closed', 'looks_correct'].includes(v.stage))
      const top: BrandView | undefined = open.find((v) => STAGE[v.stage].needsBrand) ?? open[0]
      const rate = mentionRate(obs.filter((o) => o.locationId === id), promptsById)
      const found = open.length
        ? open.length === 1
          ? top!.title.split(' — ')[1]
          : `${open.length} pieces of information need checking`
        : 'No information problems in this sample'
      return { id, top, open, rate, found }
    })
  }, [auditId, observationsFor, promptsById, views])
}

export default function BrandLocations() {
  const { latestAudit } = useStore()
  const rows = useLocationFindings(latestAudit?.id)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const shown = rows.filter((r) => LOCATION_BY_ID[r.id].name.toLowerCase().includes(q.toLowerCase()))
  const notChecked = LOCATIONS.length - rows.length

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Locations" subtitle="What sampled AI answers say about each of your centres." />
      <Card>
        {!latestAudit ? (
          <EmptyState icon={<MapPin />} title="No AI visibility check has been run yet." description="Your locations will appear here after the first check." action={<Button variant="primary" asChild><Link to="/overview">Request first check</Link></Button>} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a centre" className="pl-9" aria-label="Find a centre" />
              </div>
              <span className="ml-auto text-[13px] text-body">
                {rows.length} of {ORG.totalLocationCount} centres checked · {notChecked} not checked yet
              </span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th>What we found</Th>
                  <Th>Appeared in searches</Th>
                  <Th>Your next action</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Tr key={r.id} onClick={() => navigate(`/locations/${r.id}/answers`)}>
                    <Td className="whitespace-nowrap font-medium text-ink">{LOCATION_BY_ID[r.id].name}</Td>
                    <Td className="text-[14px] text-ink">
                      {r.found}
                      {r.top && (
                        <div className="mt-1">
                          <StageBadge stage={r.top.stage} />
                        </div>
                      )}
                    </Td>
                    <Td className="tabular whitespace-nowrap text-[14px] text-body">
                      {r.rate.num} of {r.rate.den}
                    </Td>
                    <Td>
                      {r.top ? (
                        <Button size="sm" variant={STAGE[r.top.stage].needsBrand ? 'primary' : 'secondary'} onClick={(e) => { e.stopPropagation(); navigate(`/attention/${r.top!.issue.id}`) }}>
                          {STAGE[r.top.stage].cta}
                        </Button>
                      ) : (
                        <span className="text-[13.5px] text-muted">Nothing to do</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>
    </div>
  )
}

/** "Being found in AI search": separate from accuracy; exactly one dominant CTA per state. */
function BeingFound({ locationId, auditId }: { locationId: string; auditId: string }) {
  const { observationsFor, promptsById } = useStore()
  const { byId, eligibility, recheckFor } = useDiscovery()
  const navigate = useNavigate()
  const disc = observationsFor(auditId).filter((o) => o.locationId === locationId && isDiscovery(o, promptsById))
  const opp = byId[discoveryId(auditId, locationId)]
  return (
    <Card>
      <CardHeader
        title="Being found in AI search"
        description={`Mentioned in ${disc.filter((o) => o.mentioned).length} of ${disc.length} selected general searches`}
        actions={opp && <DiscoveryStageBadge opp={opp} recheck={recheckFor(opp)} />}
      />
      <ul className="divide-y divide-line">
        {disc.map((o) => (
          <QueryRow key={o.id} o={o} el={eligibility(o.locationId, o.promptId)} controls={!opp || ['observed', 'eligibility_review', 'qualified', 'not_relevant'].includes(opp.status)} />
        ))}
      </ul>
      <div className="space-y-3 border-t border-line px-5 py-3">
        <NotAnErrorNote />
        {opp && (
          <Button variant={opp.status === 'awaiting_approval' ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/discovery/${opp.id}`)}>
            {opp.status === 'observed' || opp.status === 'eligibility_review' ? 'Review and decide' : DISCOVERY_STAGE[opp.status].cta}
            <ArrowRight />
          </Button>
        )}
        {disc[0] && <EvidenceDisclosure obs={disc.find((o) => !o.mentioned) ?? disc[0]} title="See an example AI answer" />}
      </div>
    </Card>
  )
}

export function BrandLocationDetail() {
  const { id = '' } = useParams()
  const { latestAudit, audits, hasRelease } = useStore()
  const { views } = useBrandViews()
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[id]
  const audit = [...audits].reverse().find((a) => a.locationIds.includes(id)) ?? latestAudit
  if (!loc) return <EmptyState icon={<MapPin />} title="Location not found" action={<Button asChild><Link to="/locations">My Locations</Link></Button>} />
  if (!audit || !audit.locationIds.includes(id)) {
    return <EmptyState icon={<MapPin />} title={`${loc.name} hasn’t been checked yet`} description="Ask ProManage to include it in the next check." action={<Button asChild><Link to="/locations">My Locations</Link></Button>} />
  }
  const mine = views.filter((v) => v.issue.locationId === id && v.issue.auditId === audit.id && v.stage !== 'discovery')
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/locations" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            My Locations
          </Link>
        }
        title={loc.name}
        subtitle={`${loc.city} · checked ${new Date(audit.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
        actions={
          hasRelease('V1') && (
            <Button asChild>
              <Link to={`/geo-readiness/${id}`}>Business information</Link>
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Information accuracy" description="What AI answers said about this centre’s details" />
          {mine.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-4 text-[14px] text-success">
              <BadgeCheck className="size-4" />
              No information problems in this sample.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((v) => (
                <li key={v.issue.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">{v.title.split(' — ')[1]}</p>
                    <div className="mt-1">
                      <StageBadge stage={v.stage} />
                    </div>
                  </div>
                  <Button size="sm" variant={STAGE[v.stage].needsBrand ? 'primary' : 'secondary'} onClick={() => navigate(`/attention/${v.issue.id}`)}>
                    {STAGE[v.stage].cta}
                    <ArrowRight />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <BeingFound locationId={id} auditId={audit.id} />
      </div>
    </div>
  )
}
