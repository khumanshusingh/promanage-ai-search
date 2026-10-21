import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardPlus,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Info,
  ListChecks,
  Lock,
  MapPin,
  Pencil,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContentImprovementsTab } from '@/components/ContentImprovements'
import { useStore } from '@/store/AppStore'
import { CHANNEL_HINT, CHANNEL_LABELS, channelTarget, LOCATION_BY_ID, LOCATIONS, PEOPLE, sourceRecordsFor } from '@/data/seed'
import type { AssetKind, BusinessFact, ControlledChannel, FieldKey, Issue, Task } from '@/data/types'
import { buildFacts } from '@/lib/facts'
import { buildFactSheet, buildJsonLd, copyText, downloadText, factSheetHtml, factSheetText, jsonLdSnippet, parseHours, serializeJsonLd, type FactSheetModel } from '@/lib/geoMarkup'
import { issueStatus } from '@/lib/metrics'
import { OUTCOME_TEXT, useAiAnswerStatus } from '@/lib/aiStatus'
import { CATEGORY_LABEL, PageHeader, PermButton, SeverityBadge, TaskStatusBadge, VerificationBadge } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { EmptyState, Progress } from '@/components/ui/misc'
import { Tip } from '@/components/ui/tooltip'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

const TABS = [
  { id: 'facts', label: 'Verified business data', icon: <ListChecks /> },
  { id: 'jsonld', label: 'Structured data (JSON-LD)', icon: <Code2 /> },
  { id: 'factsheet', label: 'AI-readable fact sheet', icon: <FileText /> },
  { id: 'publication', label: 'Publication & checks', icon: <Send /> },
  { id: 'content', label: 'Content improvements', icon: <PenLine /> },
] as const

const FACT_STATUS: Record<BusinessFact['verificationStatus'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'blue' }> = {
  verified: { label: 'Verified', tone: 'success' },
  unverified: { label: 'Unverified', tone: 'warning' },
  missing: { label: 'Missing', tone: 'neutral' },
  pending_approval: { label: 'Awaiting approval', tone: 'blue' },
}

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

/* ---------------- shared hooks ---------------- */

function useLocationGeo(locationId: string) {
  const { factEdits, issues, tasks, reviews, inScope } = useStore()
  const loc = LOCATION_BY_ID[locationId]
  const facts = useMemo(() => buildFacts(locationId, factEdits), [locationId, factEdits])
  const jsonld = useMemo(() => (loc ? buildJsonLd(facts, loc) : null), [facts, loc])
  const sheet = useMemo(() => (loc ? buildFactSheet(facts, loc) : null), [facts, loc])
  const locIssues = issues.filter((i) => i.locationId === locationId && inScope(i.locationId))
  const openIssues = locIssues.filter((i) => !['dismissed', 'closed'].includes(issueStatus(i, reviews, tasks)))
  const locTasks = tasks.filter((t) => t.locationId === locationId)
  return { loc, facts, jsonld, sheet, locIssues, openIssues, locTasks }
}

/** Issue most relevant to source-content work at this location. */
function primaryIssue(issues: Issue[], fromId?: string | null) {
  return (
    issues.find((i) => i.id === fromId) ??
    issues.find((i) => i.category === 'factual_mismatch') ??
    issues.find((i) => i.category === 'source_inconsistency') ??
    issues[0]
  )
}

/* ---------------- task creation from studio ---------------- */

function ContentTaskDialog({
  open,
  onOpenChange,
  locationId,
  kinds,
  channel: initialChannel,
  issue,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  locationId: string
  kinds: AssetKind[]
  channel: ControlledChannel
  issue?: Issue
}) {
  const { createTask } = useStore()
  const navigate = useNavigate()
  const loc = LOCATION_BY_ID[locationId]
  const [channel, setChannel] = useState(initialChannel)
  const [assigneeId, setAssigneeId] = useState('u-kavya')
  const [dueAt, setDueAt] = useState(plusDays(5))
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string>()

  useEffect(() => {
    if (!open) return
    setChannel(initialChannel)
    const regional = PEOPLE.find((p) => p.role === 'regional' && p.region === loc.region)
    setAssigneeId(initialChannel === 'owned_website' ? 'u-kavya' : (regional?.id ?? 'u-kavya'))
    setDueAt(plusDays(5))
    setTitle(
      kinds.includes('factsheet') && kinds.includes('jsonld')
        ? `Publish verified center facts and markup — ${loc.neighborhood}`
        : kinds.includes('jsonld')
          ? `Add JSON-LD to center page — ${loc.neighborhood}`
          : kinds.includes('factsheet')
            ? `Update center page with verified fact sheet — ${loc.neighborhood}`
            : initialChannel === 'managed_listing'
              ? `Correct managed listing — ${loc.neighborhood}`
              : `Request directory correction — ${loc.neighborhood}`,
    )
    setErr(undefined)
  }, [open, initialChannel, kinds, loc])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={kinds.length ? 'Create publication handoff task' : 'Create source task'}
      description="Hands the approved content to the owner of a controlled source. Nothing is published automatically."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (title.trim().length < 6) return setErr('Title should be at least 6 characters.')
              if (!dueAt || dueAt < new Date().toISOString().slice(0, 10)) return setErr('Choose a due date from today onwards.')
              const t = createTask({
                issueId: issue?.id,
                locationId,
                title: title.trim(),
                assigneeId,
                channel,
                target: channelTarget(channel, locationId),
                dueAt,
                notes: kinds.length ? 'Generated from verified facts in GEO Readiness. Implement exactly as approved.' : '',
                assetKinds: kinds,
                status: kinds.length ? 'prepared' : 'open',
              })
              onOpenChange(false)
              toast.success('Task created', { description: `${t.id} · ${kinds.length ? 'content prepared, awaiting approval' : 'open'}`, action: { label: 'Open', onClick: () => navigate(`/tasks/${t.id}`) } })
            }}
          >
            Create task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="ct-title">Title</Label>
          <Input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {issue && (
          <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-[12.5px]">
            <span className="text-muted">Linked issue · </span>
            <span className="font-medium text-ink">{issue.title}</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ct-channel">Controlled channel</Label>
            <Select id="ct-channel" value={channel} onChange={(e) => setChannel(e.target.value as ControlledChannel)}>
              {(Object.keys(CHANNEL_LABELS) as ControlledChannel[]).map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ct-owner">Owner</Label>
            <Select id="ct-owner" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {PEOPLE.filter((p) => p.role !== 'csm').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-[12px] text-muted">
          {CHANNEL_HINT[channel]} Target: {channelTarget(channel, locationId)}
        </p>
        <div className="max-w-[220px]">
          <Label htmlFor="ct-due">Due date</Label>
          <Input id="ct-due" type="date" value={dueAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        {kinds.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-body">
            Attaching:
            {kinds.map((k) => (
              <Badge key={k} tone="blue">
                {k === 'jsonld' ? 'JSON-LD' : 'Fact sheet'}
              </Badge>
            ))}
          </p>
        )}
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  )
}

/** Create a task, or attach to the open owned-website task for this location if one exists. */
function useContentTaskAction(locationId: string, issue?: Issue) {
  const { tasks, attachAssets, can } = useStore()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<{ open: boolean; kinds: AssetKind[]; channel: ControlledChannel }>({ open: false, kinds: [], channel: 'owned_website' })
  const existing = tasks.find((t) => t.locationId === locationId && t.channel === 'owned_website' && ['open', 'in_progress', 'prepared'].includes(t.status))
  const run = (kinds: AssetKind[]) => {
    if (existing) {
      attachAssets(existing.id, kinds)
      toast.success(`Attached to ${existing.id}`, { description: 'Content prepared — awaiting business approval.', action: { label: 'Open', onClick: () => navigate(`/tasks/${existing.id}`) } })
      return
    }
    setDialog({ open: true, kinds, channel: 'owned_website' })
  }
  const label = existing ? `Attach to ${existing.id}` : null
  const element = <ContentTaskDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} locationId={locationId} kinds={dialog.kinds} channel={dialog.channel} issue={issue} />
  const openFor = (channel: ControlledChannel) => setDialog({ open: true, kinds: [], channel })
  return { run, label, element, openFor, allowed: can('createTask') }
}

/* ---------------- Tab A: verified facts ---------------- */

function VerifyDialog({ fact, open, onOpenChange }: { fact: BusinessFact | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { verifyFact, role } = useStore()
  const [value, setValue] = useState('')
  const [err, setErr] = useState<string>()
  const candidates = useMemo(() => {
    if (!fact || fact.key === 'geo' || fact.key === 'name') return []
    const vals = sourceRecordsFor(fact.locationId)
      .filter((s) => s.managedByCustomer)
      .map((s) => ({ src: s.channel === 'owned_website' ? 'Owned website' : 'Managed listing', v: s.values[fact.key as FieldKey] }))
      .filter((x): x is { src: string; v: string } => !!x.v)
    return vals.filter((x, i) => vals.findIndex((y) => y.v === x.v) === i)
  }, [fact])
  useEffect(() => {
    if (open && fact) {
      setValue(fact.value ?? fact.proposedValue ?? '')
      setErr(undefined)
    }
  }, [open, fact])
  if (!fact) return null
  const direct = role === 'brand'
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${fact.verificationStatus === 'verified' ? (direct ? 'Edit' : 'Reconfirm') : 'Verify'} ${fact.label.toLowerCase()}`}
      description={direct ? 'Confirmed with the center. Saving marks this fact verified and re-opens approval of any generated content that uses it.' : 'Your change will be sent to Marketing for approval before it can be used in generated content.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const v = value.trim()
              if (v.length < 2) return setErr('Enter the confirmed value.')
              if (fact.key === 'hours' && !parseHours(v)) return setErr('Use a format like “Mon–Fri 8:30 AM–6:30 PM” (general opening hours only).')
              if (fact.key === 'phone' && !/^\+\d[\d\s-]{7,}$/.test(v)) return setErr('Use international format, e.g. +91 80 4000 1109.')
              if (fact.key === 'website' && !/^https:\/\//.test(v)) return setErr('Website must start with https://')
              verifyFact(fact.id, v)
              onOpenChange(false)
              toast.success(direct ? 'Fact verified' : 'Sent for approval', { description: `${fact.label}: ${v}` })
            }}
          >
            {direct ? 'Save as verified' : 'Submit for approval'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="fact-value" hint={fact.applicability}>
            {fact.label}
          </Label>
          <Input id="fact-value" value={value} onChange={(e) => { setValue(e.target.value); setErr(undefined) }} invalid={!!err} />
          <FieldError>{err}</FieldError>
        </div>
        {candidates.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] text-muted">Values found on controlled sources (confirm with the center before using):</p>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c) => (
                <button key={c.v} onClick={() => setValue(c.v)} className="rounded-md border border-line px-2 py-1 text-left text-[12.5px] hover:border-brand hover:bg-brand-soft">
                  <span className="text-ink">{c.v}</span> <span className="text-muted">· {c.src}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {fact.key === 'hours' && <p className="text-[12px] text-muted">General opening hours only. Saturday tour slots are a separate fact.</p>}
      </div>
    </Dialog>
  )
}

function SourceCell({ value, verified, captured }: { value: string | null | undefined; verified: string | null; captured: boolean }) {
  if (!captured) return <span className="text-muted">—</span>
  if (value === null || value === undefined) return <span className="italic text-muted">Not stated</span>
  if (!verified) return <span className="text-body">{value}</span>
  const same = value === verified
  return (
    <span className={cn('inline-flex items-start gap-1.5', same ? 'text-body' : 'text-danger')}>
      {same ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
      <span>{same ? 'Matches' : value}</span>
    </span>
  )
}

function FactsTab({ locationId }: { locationId: string }) {
  const { facts } = useLocationGeo(locationId)
  const { can, requestVerification, approveFactEdit, rejectFactEdit, role, inScope, sourcesFor } = useStore()
  const [editing, setEditing] = useState<BusinessFact | null>(null)
  const sources = sourcesFor(locationId).filter((s) => s.managedByCustomer)
  const web = sources.find((s) => s.channel === 'owned_website')!
  const listing = sources.find((s) => s.channel === 'managed_listing')!
  const canVerify = can('verifyFact') && inScope(locationId)
  const verified = facts.filter((f) => f.verificationStatus === 'verified').length

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3 text-[13px] text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          <span className="font-medium">General opening hours and Saturday tour slots are separate facts.</span> Tours are visiting appointments, not operating hours, and are never published as opening hours.
        </p>
      </div>
      <Card>
        <CardHeader
          title="Business facts"
          description={`${verified} of ${facts.length} verified · only verified facts are used in generated content`}
          actions={<Progress value={(verified / facts.length) * 100} tone="teal" className="w-32" />}
        />
        <Table>
          <thead>
            <tr>
              <Th>Fact</Th>
              <Th>Value</Th>
              <Th>Status</Th>
              <Th>Verified by</Th>
              <Th>Used in</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => {
              const st = FACT_STATUS[f.verificationStatus]
              return (
                <Tr key={f.id}>
                  <Td className="min-w-[180px]">
                    <p className="font-medium text-ink">{f.label}</p>
                    <p className="text-[12px] text-muted">{f.applicability}</p>
                  </Td>
                  <Td className="min-w-[200px] max-w-[300px]">
                    {f.verificationStatus === 'pending_approval' ? (
                      <div>
                        <p className="text-muted line-through">{f.value ?? '—'}</p>
                        <p className="font-medium text-ink">{f.proposedValue}</p>
                      </div>
                    ) : (
                      <span className={cn(f.value ? 'text-ink' : 'italic text-muted')}>{f.value ?? f.note ?? 'Not captured'}</span>
                    )}
                    {f.value && f.verificationStatus === 'unverified' && f.note && <p className="text-[12px] text-warning">{f.note}</p>}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={st.tone}>
                        {f.verificationStatus === 'verified' ? <BadgeCheck /> : f.verificationStatus === 'pending_approval' ? <CircleDashed /> : <AlertTriangle />}
                        {st.label}
                      </Badge>
                      {f.requested && <span className="text-[11.5px] text-brand">Verification requested</span>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-[12.5px] text-body">{f.verifiedAt ? <>{f.verifiedBy}<br /><span className="text-muted">{fmtDate(f.verifiedAt)}</span></> : <span className="text-muted">{f.sourceOwner}</span>}</Td>
                  <Td className="text-[12px] text-muted">{f.whereUsed.join(', ')}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1.5">
                      {f.verificationStatus === 'pending_approval' ? (
                        can('approveFact') ? (
                          <>
                            <Button size="sm" onClick={() => { rejectFactEdit(f.id); toast('Change rejected') }}>
                              <X />
                              Reject
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => { approveFactEdit(f.id); toast.success('Fact change approved') }}>
                              <Check />
                              Approve
                            </Button>
                          </>
                        ) : (
                          <span className="text-[12px] text-muted">Awaiting Marketing</span>
                        )
                      ) : f.verificationStatus === 'verified' ? (
                        canVerify && f.key !== 'name' ? (
                          <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                            <Pencil />
                            {role === 'brand' ? 'Edit' : 'Propose change'}
                          </Button>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )
                      ) : (
                        <>
                          {!f.requested && (
                            <PermButton perm="requestVerification" size="sm" onClick={() => { requestVerification(f.id); toast.success('Verification requested', { description: `Sent to ${f.sourceOwner}` }) }}>
                              Request verification
                            </PermButton>
                          )}
                          {canVerify && (
                            <Button size="sm" variant="soft" onClick={() => setEditing(f)}>
                              <ShieldCheck />
                              Verify
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader
          title="Source comparison"
          description={`Controlled sources vs. verified facts · snapshots captured ${fmtDate(web.observedAt)} through connected integrations`}
        />
        <Table>
          <thead>
            <tr>
              <Th>Fact</Th>
              <Th>Verified value</Th>
              <Th>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="size-3.5" />
                  Owned website
                </span>
              </Th>
              <Th>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Managed listing
                </span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {facts
              .filter((f) => f.key !== 'name' && f.key !== 'geo' && f.key !== 'website')
              .map((f) => {
                const key = f.key as FieldKey
                const v = f.verificationStatus === 'verified' ? f.value : null
                return (
                  <Tr key={f.id}>
                    <Td className="font-medium text-ink">{f.label}</Td>
                    <Td className={cn(v ? 'text-ink' : 'italic text-muted')}>{v ?? 'Not verified — cannot compare'}</Td>
                    <Td>
                      <SourceCell value={web.values[key]} verified={v} captured={key in web.values} />
                    </Td>
                    <Td>
                      <SourceCell value={listing.values[key]} verified={v} captured={key in listing.values} />
                    </Td>
                  </Tr>
                )
              })}
          </tbody>
        </Table>
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">
          Snapshots of {web.url} and the managed business listing. Independent websites aren't monitored here; they appear on issues as possible explanations only.
        </p>
      </Card>
      <VerifyDialog fact={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  )
}

/* ---------------- approval header ---------------- */

function ApprovalBar({ locationId, kind, blocked }: { locationId: string; kind: AssetKind; blocked: string | null }) {
  const { assetState, approveAsset } = useStore()
  const st = assetState(locationId, kind)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {st.status === 'approved' ? (
        <Badge tone="success">
          <BadgeCheck />
          v{st.version ?? 1} approved by {st.approvedBy} · {fmtDate(st.approvedAt!)}
        </Badge>
      ) : (
        <Badge tone={st.stale ? 'warning' : 'neutral'}>{st.stale ? 'Facts changed — re-approval needed' : 'Draft · not approved'}</Badge>
      )}
      {st.status !== 'approved' && (
        <Tip content={blocked ?? undefined}>
          <span className="inline-flex">
            <PermButton
              perm="approveSource"
              size="sm"
              disabled={!!blocked}
              onClick={() => {
                approveAsset(locationId, kind)
                toast.success(`${kind === 'jsonld' ? 'JSON-LD' : 'Fact sheet'} approved`, { description: 'Business approval recorded. Export or attach it to an implementation task.' })
              }}
            >
              <ShieldCheck />
              Approve
            </PermButton>
          </span>
        </Tip>
      )}
    </div>
  )
}

/* ---------------- Tab B: JSON-LD ---------------- */

function CodeBlock({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <div className="scrollbar-thin max-h-[520px] overflow-auto rounded-lg border border-[#1e2b40] bg-[#0f1b2d] py-3 font-mono text-[12.5px] leading-[1.6]">
      <pre className="min-w-max">
        {lines.map((l, i) => (
          <div key={i} className="flex">
            <span className="w-10 shrink-0 select-none pr-3 text-right text-[#53627a]">{i + 1}</span>
            <code className="pr-4 text-[#d6e2f0]">
              {l.split(/("(?:[^"\\]|\\.)*")(\s*:)?/g).map((part, j) =>
                part === undefined ? null : /^"/.test(part) ? (
                  <span key={j} className={lines[i].includes(`${part}:`) ? 'text-[#7cc7ff]' : 'text-[#9be3b0]'}>
                    {part}
                  </span>
                ) : (
                  <span key={j}>{part}</span>
                ),
              )}
            </code>
          </div>
        ))}
      </pre>
    </div>
  )
}

function JsonLdTab({ locationId, issue }: { locationId: string; issue?: Issue }) {
  const { jsonld, facts } = useLocationGeo(locationId)
  const { markAssetExported } = useStore()
  const task = useContentTaskAction(locationId, issue)
  if (!jsonld) return null
  const json = serializeJsonLd(jsonld.data)
  const pending = facts.some((f) => f.verificationStatus === 'pending_approval' && f.whereUsed.includes('JSON-LD'))
  const errors = jsonld.checks.filter((c) => !c.pass && c.level === 'error')
  const blocked = pending ? 'A fact used here is awaiting approval.' : errors.length ? 'Fix failing required checks first.' : null
  const pct = Math.round((jsonld.readiness.num / jsonld.readiness.den) * 100)

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0">
        <CardHeader title="JSON-LD preview" description="Generated from verified facts only · schema.org ChildCare + Preschool" actions={<ApprovalBar locationId={locationId} kind="jsonld" blocked={blocked} />} />
        <div className="p-4">
          <CodeBlock code={json} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <Button
            onClick={async () => {
              const ok = await copyText(jsonLdSnippet(jsonld.data))
              markAssetExported(locationId, 'jsonld')
              if (ok) toast.success('JSON-LD copied', { description: 'Includes the <script type="application/ld+json"> wrapper.' })
              else toast.error('Copy failed — use Download instead')
            }}
          >
            <Copy />
            Copy JSON-LD
          </Button>
          <Button
            onClick={() => {
              downloadText(`brightnest-${locationId}.jsonld.json`, json, 'application/ld+json')
              markAssetExported(locationId, 'jsonld')
              toast.success('Downloaded .json')
            }}
          >
            <Download />
            Download .json
          </Button>
          <div className="flex-1" />
          <PermButton perm="createTask" variant="primary" onClick={() => task.run(['jsonld'])}>
            <ClipboardPlus />
            {task.label ?? 'Create publication handoff task'}
          </PermButton>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-ink">Markup readiness</p>
            <p className="tabular text-[13px] text-muted">
              {jsonld.readiness.num} of {jsonld.readiness.den} eligible fields
            </p>
          </div>
          <p className="tabular mt-1 text-[26px] font-semibold text-ink">{pct}%</p>
          <Progress value={pct} tone="teal" className="mt-2" />
          <p className="mt-2 text-[12px] text-muted">Share of eligible, verified fields represented in valid output. Not a measure of AI visibility or ranking.</p>
        </Card>
        <Card>
          <CardHeader title="Rules check" description="Local check — not Google's Rich Results Test or crawler validation" />
          <ul className="divide-y divide-line">
            {jsonld.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 px-5 py-2.5 text-[13px]">
                {c.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', c.level === 'error' ? 'text-danger' : 'text-warning')} />}
                <div>
                  <p className="text-ink">{c.label}</p>
                  <p className="text-[12px] text-muted">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        {jsonld.warnings.length > 0 && (
          <div className="rounded-xl border border-[#f1dcb2] bg-warning-soft p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
              <AlertTriangle className="size-4" />
              Omitted fields
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-body">
              {jsonld.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Card className="xl:col-span-2">
        <CardHeader title="Field mapping" description="Every output property traces to a verified business fact" />
        <Table>
          <thead>
            <tr>
              <Th>Output property</Th>
              <Th>Business fact</Th>
              <Th>Included</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {jsonld.mapping.map((m, i) => (
              <Tr key={i}>
                <Td className="font-mono text-[12.5px] text-ink">{m.path}</Td>
                <Td>{m.factLabel}</Td>
                <Td>{m.included ? <Badge tone="success">Included</Badge> : <Badge tone="neutral">Omitted</Badge>}</Td>
                <Td className="text-[12.5px] text-muted">{m.reason}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {task.element}
    </div>
  )
}

/* ---------------- Tab C: fact sheet ---------------- */

function FactSheetPreview({ m }: { m: FactSheetModel }) {
  return (
    <article className="mx-auto max-w-[620px] px-6 py-8 text-[14px] leading-[1.6] text-ink">
      <h1 className="text-[22px] font-semibold">{m.title}</h1>
      {m.status && (
        <p className="mt-1">
          <strong>Status:</strong> {m.status}
        </p>
      )}
      <dl className="mt-4 space-y-2.5">
        {m.rows.map((r) => (
          <div key={r.label}>
            <dt className="font-semibold">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {m.tours && (
        <>
          <h2 className="mt-6 text-[16px] font-semibold">Visiting and tours</h2>
          <p>{m.tours}. Tour slots are separate from general opening hours.</p>
        </>
      )}
      {m.programs && (
        <>
          <h2 className="mt-6 text-[16px] font-semibold">Programs</h2>
          <p>{m.programs}</p>
        </>
      )}
      {m.faq.length > 0 && (
        <>
          <h2 className="mt-6 text-[16px] font-semibold">Frequently asked questions</h2>
          {m.faq.map((f) => (
            <div key={f.q} className="mt-3">
              <h3 className="font-semibold">{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </>
      )}
      <p className="mt-8 border-t border-line pt-3 text-[12.5px] text-muted">Information verified by BrightNest Preschools. Last verified {fmtDate(m.lastVerified, { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    </article>
  )
}

function FactSheetTab({ locationId, issue }: { locationId: string; issue?: Issue }) {
  const { sheet, jsonld, facts } = useLocationGeo(locationId)
  const { markAssetExported, assetState } = useStore()
  const task = useContentTaskAction(locationId, issue)
  if (!sheet || !jsonld) return null
  const pending = facts.some((f) => f.verificationStatus === 'pending_approval' && f.whereUsed.some((w) => w.startsWith('Fact sheet')))
  const blocked = pending ? 'A fact used here is awaiting approval.' : null
  const embedJsonLd = assetState(locationId, 'jsonld').status === 'approved'

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Fact sheet preview" description="Plain, accessible HTML generated from verified facts" actions={<ApprovalBar locationId={locationId} kind="factsheet" blocked={blocked} />} />
        <div className="border-b border-line bg-subtle px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-muted">
            <Lock className="size-3.5" />
            <span className="truncate">{sheet.url}</span>
            <Badge tone="neutral" className="ml-auto">
              Preview · not published
            </Badge>
          </div>
        </div>
        <div className="scrollbar-thin max-h-[560px] overflow-y-auto bg-white">
          <FactSheetPreview m={sheet} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <Button
            onClick={() => {
              downloadText(`brightnest-${locationId}-facts.html`, factSheetHtml(sheet, embedJsonLd ? jsonld.data : undefined), 'text/html')
              markAssetExported(locationId, 'factsheet')
              toast.success('HTML exported', { description: embedJsonLd ? 'Includes the approved JSON-LD.' : 'JSON-LD not embedded (not yet approved).' })
            }}
          >
            <Download />
            Export HTML
          </Button>
          <Button
            onClick={async () => {
              const ok = await copyText(factSheetText(sheet))
              markAssetExported(locationId, 'factsheet')
              if (ok) toast.success('Content copied')
              else toast.error('Copy failed — use Export HTML instead')
            }}
          >
            <Copy />
            Copy content
          </Button>
          <div className="flex-1" />
          <PermButton perm="createTask" variant="primary" onClick={() => task.run(['factsheet'])}>
            <ClipboardPlus />
            {task.label ?? 'Create CMS update task'}
          </PermButton>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">What this can and can't do</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-body">
            Publishing clear, verified facts on a page you control may improve information clarity for compatible crawlers <strong>if it is published, accessible and discovered</strong>. It does not ensure indexing, and it does not control what any AI assistant recommends.
          </p>
        </Card>
        {sheet.omitted.length > 0 && (
          <div className="rounded-xl border border-[#f1dcb2] bg-warning-soft p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
              <AlertTriangle className="size-4" />
              Not included (unverified)
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-body">
              {sheet.omitted.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">Safety</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-muted">
            <li>Every value is HTML-escaped; the export contains no scripts other than optional JSON-LD.</li>
            <li>Tour slots appear only under “Visiting and tours” and the FAQ — never as opening hours.</li>
          </ul>
        </Card>
      </div>
      {task.element}
    </div>
  )
}

/* ---------------- Tab D: publication ---------------- */

function PublicationTab({ locationId, issue }: { locationId: string; issue?: Issue }) {
  const { facts, locTasks } = useLocationGeo(locationId)
  const { assetState, hasRelease } = useStore()
  const task = useContentTaskAction(locationId, issue)
  const ai = useAiAnswerStatus(issue)
  const used = facts.filter((f) => f.whereUsed.some((w) => w === 'JSON-LD' || w.startsWith('Fact sheet')))
  const factsOk = used.filter((f) => f.verificationStatus === 'verified').length
  const pending = facts.filter((f) => f.verificationStatus === 'pending_approval').length
  const js = assetState(locationId, 'jsonld')
  const fs = assetState(locationId, 'factsheet')
  const implemented = locTasks.find((t) => ['source_updated', 'awaiting_recheck', 'closed'].includes(t.status) && t.channel !== 'external_request')
  const awaiting = locTasks.find((t) => t.status === 'awaiting_recheck' || t.status === 'closed')

  const steps = [
    { label: 'Facts verified', done: pending === 0 && factsOk > 0, detail: `${factsOk} of ${used.length} publishable facts verified${pending ? ` · ${pending} awaiting approval` : ''}` },
    { label: 'Business approval', done: js.status === 'approved' || fs.status === 'approved', detail: [js.status === 'approved' && 'JSON-LD approved', fs.status === 'approved' && 'Fact sheet approved'].filter(Boolean).join(' · ') || 'No content approved yet' },
    { label: 'Snippet / content exported', done: !!(js.exportedAt || fs.exportedAt), detail: js.exportedAt || fs.exportedAt ? `Last export ${fmtDateTime((js.exportedAt ?? fs.exportedAt)!)}` : 'Not exported yet' },
    { label: 'Implemented on owned site / managed listing', done: !!implemented, detail: implemented ? `${implemented.id} · ${CHANNEL_LABELS[implemented.channel]} marked updated` : 'No source marked updated' },
    { label: 'Awaiting independent AI recheck', done: !!awaiting, detail: awaiting ? (ai?.outcome ? `Recheck ${ai.wave}: ${OUTCOME_TEXT[ai.outcome].label}` : 'Queued — waiting for the next matched recheck') : 'Not queued' },
  ]
  const doneCount = steps.slice(0, 4).filter((s) => s.done).length
  const channels: ControlledChannel[] = ['owned_website', 'managed_listing', 'external_request']

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader title="Publication checklist" description="Simulated publication — tasks record what owners did; nothing is pushed to live sites" />
          <ol className="px-5 py-4">
            {steps.map((s, i) => {
              const amber = i === 4 && s.done
              return (
                <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span className={cn('absolute left-[11px] top-7 h-[calc(100%-20px)] w-px', s.done ? 'bg-teal' : 'bg-line')} />}
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold', amber ? 'bg-warning-soft text-warning ring-1 ring-[#f1dcb2]' : s.done ? 'bg-teal text-white' : 'bg-[#eef2f7] text-muted')}>
                    {amber ? <CircleDashed className="size-3.5" /> : s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <div>
                    <p className={cn('text-[13.5px] font-medium', s.done ? 'text-ink' : 'text-body')}>{s.label}</p>
                    <p className="text-[12.5px] text-muted">{s.detail}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Delivery channels" description="Who changes what — and what BrightNest actually controls" />
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th>Task</Th>
                <Th>Owner</Th>
                <Th className="text-right">
                  <span className="sr-only">Action</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const t: Task | undefined = [...locTasks].reverse().find((x) => x.channel === c)
                return (
                  <Tr key={c}>
                    <Td className="max-w-[260px]">
                      <p className="font-medium text-ink">{CHANNEL_LABELS[c]}</p>
                      <p className="truncate text-[12px] text-muted" title={channelTarget(c, locationId)}>
                        {channelTarget(c, locationId)}
                      </p>
                    </Td>
                    <Td>
                      {t ? (
                        <Link to={`/tasks/${t.id}`} className="flex flex-col items-start gap-1">
                          <span className="text-[12.5px] text-brand">{t.id}</span>
                          <TaskStatusBadge status={t.status} />
                        </Link>
                      ) : (
                        <span className="text-[12.5px] text-muted">No task</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px]">
                      {t ? (
                        <>
                          {PEOPLE.find((p) => p.id === t.assigneeId)?.name}
                          <br />
                          <span className="text-muted">{fmtDate(t.activity[t.activity.length - 1].at)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-right">
                      {!t && (
                        <PermButton perm="createTask" size="sm" onClick={() => task.openFor(c)}>
                          Create task
                        </PermButton>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">No GTM injection, reverse-proxy rewrite, API write or forced crawl. Owners implement approved content in their own systems.</p>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Source content readiness</p>
          <p className="tabular mt-1 text-[24px] font-semibold text-ink">
            {doneCount} <span className="text-[14px] font-normal text-muted">of 4 steps</span>
          </p>
          <Progress value={(doneCount / 4) * 100} tone="teal" className="mt-2" />
          <p className="mt-2 text-[12px] text-muted">What BrightNest controls: verified facts, approved content, implemented sources.</p>
        </Card>
        <Card className="p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">AI answer status (observed)</p>
          {!hasRelease('V2') ? (
            <p className="mt-2 text-[13px] text-body">Not measured yet. Matched rechecks come with Monitoring.</p>
          ) : ai?.outcome ? (
            <>
              <Badge tone={OUTCOME_TEXT[ai.outcome].tone} className="mt-2">
                Recheck {ai.wave}
              </Badge>
              <p className="mt-1.5 text-[13.5px] font-medium text-ink">{OUTCOME_TEXT[ai.outcome].label}</p>
              <p className="text-[12px] text-muted">Change observed; causation not established.</p>
            </>
          ) : (
            <>
              <Badge tone="warning" className="mt-2">
                Not rechecked
              </Badge>
              <p className="mt-1.5 text-[12.5px] text-muted">Source readiness doesn't change this. Only a matched recheck can show whether answers differ.</p>
            </>
          )}
          {issue && <p className="mt-3 border-t border-line pt-2 text-[12px] text-muted">Tracking: {issue.title}</p>}
        </Card>
      </div>
      {task.element}
    </div>
  )
}

/* ---------------- index + page ---------------- */

function GeoIndex() {
  const { audits, inScope, factEdits, issues, reviews, tasks, assetState } = useStore()
  const navigate = useNavigate()
  const audited = new Set(audits.flatMap((a) => a.locationIds))
  const list = LOCATIONS.filter((l) => audited.has(l.id) && inScope(l.id))
  return (
    <div className="animate-fade-in">
      <PageHeader title="GEO Readiness" subtitle="Verify facts, prepare structured data and fact sheets, and track publication on sources you control." />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Sparkles />} title="No audited locations yet" description="Run an audit to see readiness for each center." action={<Button variant="primary" asChild><Link to="/audits/new">New audit</Link></Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Location</Th>
                <Th>Facts verified</Th>
                <Th>Markup readiness</Th>
                <Th>Open issues</Th>
                <Th>JSON-LD</Th>
                <Th>Fact sheet</Th>
                <Th>Latest task</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const facts = buildFacts(l.id, factEdits)
                const j = buildJsonLd(facts, l)
                const open = issues.filter((i) => i.locationId === l.id && !['dismissed', 'closed'].includes(issueStatus(i, reviews, tasks)))
                const t = [...tasks].reverse().find((x) => x.locationId === l.id)
                const v = facts.filter((f) => f.verificationStatus === 'verified').length
                const st = (k: AssetKind) => assetState(l.id, k)
                return (
                  <Tr key={l.id} onClick={() => navigate(`/geo-readiness/${l.id}`)}>
                    <Td className="whitespace-nowrap">
                      <Link to={`/geo-readiness/${l.id}`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {l.name}
                      </Link>
                      <p className="text-[12px] text-muted">{l.region}</p>
                    </Td>
                    <Td className="tabular">
                      {v}/{facts.length}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Progress value={(j.readiness.num / j.readiness.den) * 100} tone="teal" className="w-16" />
                        <span className="tabular text-[12.5px]">
                          {j.readiness.num}/{j.readiness.den}
                        </span>
                      </div>
                    </Td>
                    <Td className="tabular">{open.length ? <span className="font-medium text-ink">{open.length}</span> : <span className="text-muted">0</span>}</Td>
                    <Td>
                      <Badge tone={st('jsonld').status === 'approved' ? 'success' : 'neutral'}>{st('jsonld').status === 'approved' ? 'Approved' : 'Draft'}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={st('factsheet').status === 'approved' ? 'success' : 'neutral'}>{st('factsheet').status === 'approved' ? 'Approved' : 'Draft'}</Badge>
                    </Td>
                    <Td>{t ? <TaskStatusBadge status={t.status} /> : <span className="text-[12.5px] text-muted">—</span>}</Td>
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

export default function GeoReadinessPage() {
  const { locationId } = useParams()
  const [params, setParams] = useSearchParams()
  const { inScope } = useStore()
  const geo = useLocationGeo(locationId ?? '')
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'facts'
  const from = params.get('from')

  if (!locationId) return <GeoIndex />
  if (!geo.loc) return <EmptyState icon={<MapPin />} title="Location not found" action={<Button asChild><Link to="/geo-readiness">All locations</Link></Button>} />
  if (!inScope(locationId)) return <EmptyState icon={<Lock />} title="Outside your assigned region" action={<Button asChild><Link to="/geo-readiness">All locations</Link></Button>} />

  const issue = primaryIssue(geo.locIssues, from)
  const fromIssue = geo.locIssues.find((i) => i.id === from)
  const verified = geo.facts.filter((f) => f.verificationStatus === 'verified').length
  const setTab = (t: string) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <>
            <Link to={fromIssue ? `/issues/${fromIssue.id}` : '/geo-readiness'} className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" />
              {fromIssue ? 'Back to issue' : 'GEO Readiness'}
            </Link>
          </>
        }
        title={geo.loc.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {geo.loc.region} · {geo.loc.city}
            </span>
            <VerificationBadge status={geo.loc.verificationStatus} />
          </span>
        }
        actions={
          <Button asChild>
            <Link to={`/locations/${locationId}/answers`}>
              <ExternalLink />
              Sampled answers
            </Link>
          </Button>
        }
      />

      {fromIssue && (
        <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <SeverityBadge severity={fromIssue.severity} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-ink">
              {CATEGORY_LABEL[fromIssue.category]} · {fromIssue.title}
            </p>
            <p className="text-[12.5px] text-muted">{fromIssue.summary}</p>
            <Link to={`/issues/${fromIssue.id}/sources`} className="text-[12.5px] font-medium text-brand hover:underline">
              Source comparison →
            </Link>
            {fromIssue.possibleSourceIds.length > 0 && (
              <p className="mt-1 text-[12.5px] text-body">
                Possible explanation (unconfirmed):{' '}
                {sourceRecordsFor(locationId)
                  .filter((s) => fromIssue.possibleSourceIds.includes(s.id))
                  .map((s) => `${s.label}${fromIssue.field ? ` ${s.values[fromIssue.field] == null ? "doesn't state it" : `says “${s.values[fromIssue.field]}”`}` : ''}`)
                  .join('; ')}
                .
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Facts verified', value: `${verified}/${geo.facts.length}` },
          { label: 'Markup readiness', value: geo.jsonld ? `${geo.jsonld.readiness.num}/${geo.jsonld.readiness.den}` : '—' },
          { label: 'Open issues', value: String(geo.openIssues.length) },
          { label: 'Source tasks', value: String(geo.locTasks.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
            <p className="text-[12px] text-muted">{s.label}</p>
            <p className="tabular text-[20px] font-semibold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="GEO Readiness" className="scrollbar-thin mb-5 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-[13.5px] font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-brand [&_svg]:size-4"
            >
              {t.icon}
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="facts">
          <FactsTab locationId={locationId} />
        </Tabs.Content>
        <Tabs.Content value="jsonld">
          <JsonLdTab locationId={locationId} issue={issue} />
        </Tabs.Content>
        <Tabs.Content value="factsheet">
          <FactSheetTab locationId={locationId} issue={issue} />
        </Tabs.Content>
        <Tabs.Content value="publication">
          <PublicationTab locationId={locationId} issue={issue} />
        </Tabs.Content>
        <Tabs.Content value="content">
          <ContentImprovementsTab locationId={locationId} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
