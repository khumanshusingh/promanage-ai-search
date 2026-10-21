import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Lock, MapPin } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { FIELD_LABELS, LOCATION_BY_ID } from '@/data/seed'
import type { FieldKey } from '@/data/types'
import { effectiveLocation } from '@/lib/facts'
import { PageHeader, PermButton, SimTag, TaskStatusBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'
import { CreateTaskDialog } from './Issues'

/*
  Read-only record standing in for ProManage Listing Management. GEO deep-links here
  instead of building a second Google Business Profile editor.
*/
export default function ListingRecordPage() {
  const { locationId = '' } = useParams()
  const [params] = useSearchParams()
  const { sourcesFor, factEdits, issueById, tasks, inScope } = useStore()
  const [open, setOpen] = useState(false)
  const loc = LOCATION_BY_ID[locationId]
  if (!loc) return <EmptyState icon={<MapPin />} title="Listing not found" action={<Button asChild><Link to="/locations">Locations</Link></Button>} />
  if (!inScope(locationId)) return <EmptyState icon={<Lock />} title="Outside your assigned region" />
  const listing = sourcesFor(locationId).find((s) => s.channel === 'managed_listing')!
  const rec = effectiveLocation(locationId, factEdits)
  const focus = params.get('field') as FieldKey | null
  const issue = params.get('from') ? issueById[params.get('from')!] : undefined
  const task = issue ? tasks.find((t) => t.issueId === issue.id && t.channel === 'managed_listing') : undefined
  const fields = Object.keys(listing.values) as FieldKey[]
  const diffs = fields.filter((k) => rec.verifiedFields[k].status === 'verified' && listing.values[k] != null && listing.values[k] !== rec.verifiedFields[k].value)

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          issue ? (
            <Link to={`/issues/${issue.id}/sources`} className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              Back to source comparison
            </Link>
          ) : (
            <span>Listing Management</span>
          )
        }
        title={`Google Business Profile · ${loc.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="teal">Managed in ProManage Listing Management</Badge>
            <span>Last synced {fmtDate(listing.observedAt)}</span>
            <SimTag />
          </span>
        }
        actions={
          issue &&
          (task ? (
            <Button asChild>
              <Link to={`/tasks/${task.id}`} className="inline-flex items-center gap-2">
                {task.id} <TaskStatusBadge status={task.status} channel="managed_listing" />
              </Link>
            </Button>
          ) : (
            <PermButton perm="createTask" variant="primary" disabled={!diffs.length} onClick={() => setOpen(true)}>
              Create listing update task
            </PermButton>
          ))
        }
      />
      <Card>
        <CardHeader title="Listing fields" description="Read-only here. Edits are made and published by the listing owner in Listing Management, after business approval." />
        <Table>
          <thead>
            <tr>
              <Th>Field</Th>
              <Th>Listing shows</Th>
              <Th>Verified record</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {fields.map((k) => {
              const v = listing.values[k]
              const r = rec.verifiedFields[k]
              const differs = diffs.includes(k)
              return (
                <Tr key={k} className={cn(focus === k && 'shadow-[inset_3px_0_0_var(--brand-blue)]', differs && 'bg-danger-soft/40')}>
                  <Td className="font-medium text-ink">{FIELD_LABELS[k]}</Td>
                  <Td className={cn(v == null && 'italic text-muted')}>{v ?? 'Not stated'}</Td>
                  <Td className={cn(r.status !== 'verified' && 'italic text-muted')}>{r.status === 'verified' ? r.value : 'Not verified'}</Td>
                  <Td>
                    {differs ? (
                      <Badge tone="danger">
                        <AlertTriangle />
                        Differs
                      </Badge>
                    ) : r.status !== 'verified' ? (
                      <Badge tone="warning">Cannot compare</Badge>
                    ) : (
                      <Badge tone="success">
                        <Check />
                        Matches
                      </Badge>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      {issue && <CreateTaskDialog open={open} onOpenChange={setOpen} issue={issue} channel="managed_listing" />}
    </div>
  )
}
