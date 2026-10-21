import { Link, useNavigate } from 'react-router-dom'
import { Plus, ScanSearch } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { mentionRate, factualSummary } from '@/lib/metrics'
import { PageHeader, PermButton, RatioText } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { fmtDateTime } from '@/lib/utils'

export default function AuditsPage() {
  const { audits, observationsFor, promptsById, inScope, rechecksFor, role } = useStore()
  const navigate = useNavigate()
  return (
    <div className="animate-fade-in">
      <PageHeader
        title={role === 'brand' ? 'Past checks' : 'Audit Operations'}
        subtitle={role === 'brand' ? 'Every AI visibility check run for your centres.' : 'Each audit samples a fixed scope of centers and prompts on one AI search surface.'}
        actions={
          <PermButton perm="runAudit" variant="primary" onClick={() => navigate('/audits/new')}>
            <Plus />
            New audit
          </PermButton>
        }
      />
      <Card>
        {audits.length === 0 ? (
          <EmptyState
            icon={<ScanSearch />}
            title="No audits yet"
            description="Create a pilot audit to sample how AI answers describe your centers."
            action={
              <PermButton perm="runAudit" variant="primary" onClick={() => navigate('/audits/new')}>
                <Plus />
                New audit
              </PermButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Audit</Th>
                <Th>Run</Th>
                <Th className="text-right">Scope</Th>
                <Th className="text-right">Observations</Th>
                <Th className="text-right">Mention rate</Th>
                <Th className="text-right">Flagged claims</Th>
                <Th>Rechecks</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {[...audits].reverse().map((a) => {
                const obs = observationsFor(a.id).filter((o) => inScope(o.locationId))
                const f = factualSummary(obs, promptsById)
                return (
                  <Tr key={a.id} onClick={() => navigate(`/audits/${a.id}`)}>
                    <Td>
                      <Link to={`/audits/${a.id}`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {a.name}
                      </Link>
                      <p className="text-[12px] text-muted">{a.id}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-body">{fmtDateTime(a.createdAt)}</Td>
                    <Td className="tabular whitespace-nowrap text-right">
                      {a.locationIds.length} × {a.promptIds.length}
                    </Td>
                    <Td className="tabular text-right">{obs.length}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <RatioText r={mentionRate(obs, promptsById)} />
                    </Td>
                    <Td className="tabular text-right">{f.mismatch}</Td>
                    <Td className="tabular">{rechecksFor(a.id).length}</Td>
                    <Td>
                      <Badge tone="success">Complete</Badge>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
