import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, CircleDashed, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import type { BusinessFact } from '@/data/types'
import { buildFacts } from '@/lib/facts'
import { STAGE, useBrandViews } from '@/lib/brandStatus'
import { StageBadge } from '@/components/brand'
import { PageHeader, PermButton } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, Input, Label } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { fmtDate } from '@/lib/utils'

/** Brand-facing "Business Information Updates" — no markup, schema or publishing mechanics. */
export default function BrandInfoUpdates() {
  const { locationId = '' } = useParams()
  const { factEdits, verifyFact, approveFactEdit, rejectFactEdit, tasks, sourceUpdates, assetState, hasRelease } = useStore()
  const { views } = useBrandViews()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<BusinessFact | null>(null)
  const [value, setValue] = useState('')
  const [err, setErr] = useState<string>()
  const loc = LOCATION_BY_ID[locationId]
  if (!loc) return <EmptyState icon={<MapPin />} title="Location not found" action={<Button asChild><Link to="/locations">My Locations</Link></Button>} />
  const facts = buildFacts(locationId, factEdits).filter((f) => f.key !== 'geo' && f.key !== 'website')
  const mine = views.filter((v) => v.issue.locationId === locationId && v.stage !== 'discovery')
  const locTasks = tasks.filter((t) => t.locationId === locationId)
  const changes = Object.entries(sourceUpdates).filter(([k]) => k.startsWith(`${locationId}-`))
  const prepared = assetState(locationId, 'jsonld').status === 'approved'

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to={`/locations/${locationId}/answers`} className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            {loc.name}
          </Link>
        }
        title="Business Information Updates"
        subtitle={`${loc.name} · your approved business facts and the updates based on them`}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verified facts" description="Your team owns these. ProManage uses only confirmed facts." />
            <ul className="divide-y divide-line">
              {facts.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-body">{f.label.replace(' (visiting hours)', ' (by appointment)')}</p>
                    <p className={f.value ? 'text-[14.5px] text-ink' : 'text-[14.5px] italic text-muted'}>{f.verificationStatus === 'pending_approval' ? `Proposed: ${f.proposedValue}` : (f.value ?? 'Not confirmed yet')}</p>
                    {f.verifiedAt && f.verificationStatus === 'verified' && (
                      <p className="text-[12.5px] text-muted">
                        Last confirmed by {f.verifiedBy} · {fmtDate(f.verifiedAt)}
                      </p>
                    )}
                  </div>
                  {f.verificationStatus === 'verified' ? (
                    <Badge tone="success">
                      <BadgeCheck />
                      Confirmed
                    </Badge>
                  ) : f.verificationStatus === 'pending_approval' ? (
                    <div className="flex gap-2">
                      <PermButton perm="approveFact" size="sm" variant="primary" onClick={() => { approveFactEdit(f.id); toast.success('Change approved') }}>
                        Approve change
                      </PermButton>
                      <PermButton perm="approveFact" size="sm" onClick={() => { rejectFactEdit(f.id); toast('Change rejected') }}>
                        Reject
                      </PermButton>
                    </div>
                  ) : (
                    <Badge tone="warning">
                      <CircleDashed />
                      Needs confirmation
                    </Badge>
                  )}
                  {f.verificationStatus !== 'pending_approval' && f.key !== 'name' && (
                    <PermButton perm="verifyFact" size="sm" variant={f.verificationStatus === 'verified' ? 'ghost' : 'secondary'} onClick={() => { setEditing(f); setValue(f.value ?? ''); setErr(undefined) }}>
                      {f.verificationStatus === 'verified' ? 'Correct' : 'Confirm'}
                    </PermButton>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-[13px] text-body">Saturday tours are appointment slots and are kept separate from normal opening hours.</p>
          </Card>

          <Card>
            <CardHeader title="Proposed corrections & approvals" />
            {mine.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-body">No information issues for this centre in the latest check.</p>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Progress" />
            {!hasRelease('V1') || locTasks.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-body">No updates in progress.</p>
            ) : (
              <ul className="divide-y divide-line">
                {locTasks.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <p className="text-[14px] text-ink">{t.title}</p>
                    <p className="text-[13px] text-muted">
                      {PEOPLE.find((p) => p.id === t.assigneeId)?.name} · {t.status === 'awaiting_recheck' || t.status === 'closed' ? 'Completed' : t.channel === 'external_request' && t.status === 'source_updated' ? 'Correction requested' : t.status === 'open' ? 'Not started' : 'In progress'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="What was changed?" />
            <div className="space-y-2 px-5 py-4 text-[14px] text-body">
              {changes.length === 0 && !prepared ? (
                <p>Nothing has been changed yet.</p>
              ) : (
                <>
                  {changes.map(([k, u]) => (
                    <p key={k}>
                      {k.includes('-web:') ? 'Official centre page' : k.includes('-listing:') ? 'Google Business Profile' : 'Independent directory'}: now shows “{u.value}” <span className="text-muted">(was “{u.previous ?? 'not stated'}”, {fmtDate(u.at)})</span>
                    </p>
                  ))}
                  {prepared && <p>Technical information prepared by ProManage from your confirmed facts.</p>}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.verificationStatus === 'verified' ? `Correct ${editing?.label.toLowerCase()}` : `Confirm ${editing?.label.toLowerCase()}`}
        description="This updates your approved business record. AI answers won’t change directly."
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (value.trim().length < 2) return setErr('Enter the confirmed value.')
                verifyFact(editing!.id, value.trim())
                setEditing(null)
                toast.success('Business information confirmed')
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Label htmlFor="bf-value">{editing?.label}</Label>
        <Input id="bf-value" value={value} onChange={(e) => { setValue(e.target.value); setErr(undefined) }} invalid={!!err} />
        <FieldError>{err}</FieldError>
      </Dialog>
    </div>
  )
}
