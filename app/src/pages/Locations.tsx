import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { LOCATIONS, ORG } from '@/data/seed'
import { mentionRate } from '@/lib/metrics'
import { useSort } from '@/lib/useSort'
import { PageHeader, RatioText, VerificationBadge } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { SortTh, Table, Td, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate } from '@/lib/utils'

const PAGE = 15

export default function LocationsPage() {
  const { inScope, latestAudit, observationsFor, promptsById } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [city, setCity] = useState('all')
  const [status, setStatus] = useState('all')
  const [audited, setAudited] = useState('all')
  const [page, setPage] = useState(0)

  const obs = useMemo(() => (latestAudit ? observationsFor(latestAudit.id) : []), [latestAudit, observationsFor])
  const auditedIds = new Set(latestAudit?.locationIds ?? [])
  const scoped = LOCATIONS.filter((l) => inScope(l.id))
  const cities = [...new Set(scoped.map((l) => l.city))]
  const filtered = scoped.filter(
    (l) =>
      (city === 'all' || l.city === city) &&
      (status === 'all' || l.verificationStatus === status) &&
      (audited === 'all' || (audited === 'yes') === auditedIds.has(l.id)) &&
      (!q || `${l.name} ${l.city} ${l.region}`.toLowerCase().includes(q.toLowerCase())),
  )
  const { sorted, sort, onSort } = useSort(filtered, { key: 'pilot', dir: 'desc' }, {
    pilot: (l) => (auditedIds.has(l.id) ? 1 : 0) * 1000 - LOCATIONS.indexOf(l),
    name: (l) => l.name,
    city: (l) => l.city,
    region: (l) => l.region,
    status: (l) => l.verificationStatus,
    verified: (l) => new Date(l.lastVerifiedAt).getTime(),
  })
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const current = Math.min(page, pages - 1)
  const pageRows = sorted.slice(current * PAGE, current * PAGE + PAGE)
  const reset = () => {
    setQ('')
    setCity('all')
    setStatus('all')
    setAudited('all')
    setPage(0)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Data Sources & Listings" subtitle={`${scoped.length === LOCATIONS.length ? ORG.totalLocationCount : scoped.length} BrightNest centers${scoped.length < LOCATIONS.length ? ' in your region' : ''} · verified-record status from ProManage listings`} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search centers" className="pl-9" aria-label="Search centers" />
          </div>
          <Select value={city} onChange={(e) => { setCity(e.target.value); setPage(0) }} className="w-40" aria-label="City">
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="w-48" aria-label="Record status">
            <option value="all">All record statuses</option>
            <option value="verified">Verified</option>
            <option value="needs_verification">Needs verification</option>
            <option value="unknown">Unknown</option>
          </Select>
          <Select value={audited} onChange={(e) => { setAudited(e.target.value); setPage(0) }} className="w-44" aria-label="Audit coverage">
            <option value="all">Any audit coverage</option>
            <option value="yes">In latest audit</option>
            <option value="no">Not yet audited</option>
          </Select>
          <span className="tabular ml-auto text-[12.5px] text-muted">{filtered.length} centers</span>
        </div>
        {pageRows.length === 0 ? (
          <EmptyState icon={<Search />} title="No centers match" action={<Button size="sm" onClick={reset}>Clear filters</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTh label="Center" sortKey="name" sort={sort} onSort={onSort} />
                <SortTh label="City" sortKey="city" sort={sort} onSort={onSort} />
                <SortTh label="Region" sortKey="region" sort={sort} onSort={onSort} />
                <SortTh label="Record" sortKey="status" sort={sort} onSort={onSort} />
                <SortTh label="Last verified" sortKey="verified" sort={sort} onSort={onSort} />
                <SortTh label="Latest audit" sortKey="pilot" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => {
                const inAudit = auditedIds.has(l.id)
                return (
                  <Tr key={l.id} onClick={() => navigate(`/locations/${l.id}/answers`)}>
                    <Td className="whitespace-nowrap">
                      <Link to={`/locations/${l.id}/answers`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {l.name}
                      </Link>
                      {l.isPilot && (
                        <Badge tone="teal" className="ml-2">
                          Pilot
                        </Badge>
                      )}
                    </Td>
                    <Td>{l.city}</Td>
                    <Td className="text-body">{l.region}</Td>
                    <Td>
                      <VerificationBadge status={l.verificationStatus} />
                    </Td>
                    <Td className="tabular whitespace-nowrap text-body">{fmtDate(l.lastVerifiedAt)}</Td>
                    <Td className="whitespace-nowrap">{inAudit ? <RatioText r={mentionRate(obs.filter((o) => o.locationId === l.id), promptsById)} /> : <span className="text-muted">Not audited</span>}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <span className="tabular">
            {sorted.length ? current * PAGE + 1 : 0}–{Math.min(sorted.length, (current + 1) * PAGE)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular px-2">
              Page {current + 1} of {pages}
            </span>
            <Button variant="ghost" size="icon" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
