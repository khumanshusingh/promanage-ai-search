import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, ChevronDown, Code2, Copy, Download, Loader2, RotateCcw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { ActionDelivery, EvidenceBasis, GeoGroup, GeoPreview, Issue, Task } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { parseOpp, useStore } from '@/store/AppStore'
import { useDiscovery } from '@/lib/useDiscovery'
import { buildFacts, effectiveLocation } from '@/lib/facts'
import { buildFactSheet, buildJsonLd, copyText, downloadText, factSheetText, serializeJsonLd } from '@/lib/geoMarkup'
import { aggregate, AGGREGATE_LABEL, PERMISSION_LABEL, STATE_LABEL, targetPermission } from '@/lib/publishing'
import { CATEGORY_LABEL, discoveryId } from '@/lib/discovery'
import { FIELD_PHRASE, useBrandViews } from '@/lib/brandStatus'
import { FactComparison } from '@/components/brand'
import { KpiCard, NextStep, PageHeader, PermButton } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, Select, Textarea } from '@/components/ui/input'
import { EmptyState, Progress, Segmented } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

interface Target {
  id: string
  label: string
  where: string
  channel: 'owned_website' | 'managed_listing' | 'external_request' | 'structured_info' | 'verification'
  before?: string | null
  after?: string | null
}

function Disclosure({ title, children, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-line">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[14px] font-medium text-ink hover:bg-subtle">
        {title}
        <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-line px-4 py-3">{children}</div>}
    </div>
  )
}

/** Read-only evidence for informed consent. Only artifacts actually involved in this proposal are shown. */
function TechnicalDetails({ locationId, targets, contentDiffs }: { locationId: string; targets: Target[]; contentDiffs: { title: string; before?: string; after?: string }[] }) {
  const { factEdits } = useStore()
  const facts = buildFacts(locationId, factEdits)
  const loc = LOCATION_BY_ID[locationId]
  const withSchema = targets.some((t) => t.channel === 'structured_info')
  const jsonld = withSchema ? serializeJsonLd(buildJsonLd(facts, loc).data) : null
  const sheet = withSchema ? factSheetText(buildFactSheet(facts, loc)) : null
  const manual = targets.filter((t) => ['third_party_unmanaged', 'requires_site_admin'].includes(targetPermission({ channel: t.channel === 'structured_info' ? 'owned_website' : (t.channel as never), recommendationId: t.id, locationId }).permission))
  return (
    <Disclosure title={<span className="flex items-center gap-2"><Code2 className="size-4 text-muted" />Technical details prepared by ProManage</span>}>
      <p className="text-[12.5px] text-muted">Read-only. Generated from verified facts and the same source snapshots ProManage inspected. You don’t need to edit any of it.</p>
      {contentDiffs.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">Content and listing changes</p>
          <ul className="space-y-2">
            {contentDiffs.map((d) => (
              <li key={d.title} className="rounded-lg border border-line bg-subtle px-3 py-2 font-mono text-[12px]">
                <p className="font-sans text-[12.5px] font-medium text-ink">{d.title}</p>
                <p className="whitespace-pre-line text-danger">- {d.before ?? '(not stated)'}</p>
                <p className="whitespace-pre-line text-success">+ {d.after ?? '(no wording change)'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {jsonld && (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-ink">LocalBusiness structured data (JSON-LD)</p>
            <Badge tone="success">Validated against verified facts</Badge>
            <Button size="sm" variant="ghost" onClick={async () => { await copyText(jsonld); toast.success('JSON-LD copied') }}>
              <Copy />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadText(`${locationId}-jsonld.json`, jsonld, 'application/json')}>
              <Download />
              Download
            </Button>
          </div>
          <pre className="scrollbar-thin max-h-64 overflow-auto rounded-lg border border-line bg-[#0f1b2d] px-3 py-2 text-[11.5px] leading-relaxed text-[#d7e3f4]" aria-label="JSON-LD preview" tabIndex={0}>
            {jsonld}
          </pre>
          <p className="mt-1 text-[12px] text-muted">Correct markup helps supported systems read the facts. It doesn’t guarantee AI uptake.</p>
        </div>
      )}
      {sheet && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">AI-readable fact sheet</p>
          <pre className="scrollbar-thin max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-subtle px-3 py-2 text-[12px] text-body">{sheet}</pre>
        </div>
      )}
      <div>
        <p className="mb-1 text-[13px] font-semibold text-ink">Fact provenance</p>
        <ul className="text-[12.5px] text-body">
          {facts
            .filter((f) => f.verificationStatus === 'verified' && ['programs', 'hours', 'saturdayTours', 'phone', 'address', 'operatingStatus'].includes(f.key))
            .map((f) => (
              <li key={f.id}>
                {f.label}: {f.value} · verified by {f.verifiedBy}
                {f.verifiedAt ? ` on ${fmtDate(f.verifiedAt)}` : ''}
              </li>
            ))}
        </ul>
      </div>
      {manual.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink">What we cannot change automatically</p>
          <ul className="list-disc pl-5 text-[12.5px] text-body">
            {manual.map((t) => (
              <li key={t.id}>
                {t.label} — {targetPermission({ channel: t.channel as never, recommendationId: t.id, locationId }).reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[12px] text-muted">No crawler or security settings are changed automatically. Simulated: no real API, CMS or listing write happens in this prototype.</p>
    </Disclosure>
  )
}

interface Fix {
  id: string
  title: string
  where: string
  channel: Target['channel']
  before?: string | null
  after?: string | null
  facts?: string[]
  note?: string
  group?: GeoGroup
  technique?: string
  why?: string
  basedOn?: string[]
  preview?: GeoPreview
  evidence?: EvidenceBasis
  evidenceText?: string
  priority?: 'high' | 'medium' | 'low'
  priorityReason?: string
  delivery?: ActionDelivery
  limitation?: string
}

const EVIDENCE_LABEL: Record<EvidenceBasis, { label: string; tone: 'warning' | 'danger' | 'neutral' }> = {
  confirmed_gap: { label: 'Confirmed missing information', tone: 'warning' },
  confirmed_conflict: { label: 'Confirmed source mismatch', tone: 'danger' },
  hypothesis_to_test: { label: 'Possible factor to test', tone: 'neutral' },
}
const PRIORITY_LABEL = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' } as const
const DELIVERY_LABEL: Record<ActionDelivery, string> = {
  connected_publish: 'Published by ProManage to this source after your approval',
  site_admin_handoff: 'Handed to your site admin; ProManage never changes it automatically',
  external_request_draft: 'Request draft for an independent site; nothing is sent from this prototype',
  advisory_only: 'Advice only: a draft for later, not published by this proposal',
}

/** How fixes are grouped for the Brand, in the order they're shown. */
const GEO_GROUPS: { key: GeoGroup; label: string; hint: string }[] = [
  { key: 'information', label: 'Fix missing or outdated information', hint: 'Every source ProManage manages states the same verified facts.' },
  { key: 'content', label: 'Write content AI can quote', hint: 'Answer parents’ questions directly, in the words they use with AI assistants.' },
  { key: 'trust', label: 'Add trust signals', hint: 'Show the information is current, sourced and genuine.' },
  { key: 'technical', label: 'Strengthen the technical foundation', hint: 'Help AI systems find, read and understand the page.' },
  { key: 'offsite', label: 'Ask other sites to update', hint: 'ProManage drafts a request with the verified facts. You approve the draft; nothing is sent automatically.' },
]
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const
const groupOf = (f: Fix): GeoGroup => f.group ?? (f.channel === 'external_request' ? 'offsite' : f.channel === 'structured_info' ? 'technical' : 'information')
const INTENT_TONE = { Learn: 'neutral', Compare: 'blue', Decide: 'teal' } as const

/** Rich, read-only preview of a GEO draft. */
function GeoPreviewView({ preview, sent }: { preview: GeoPreview; sent?: boolean }) {
  const [all, setAll] = useState(false)
  if (preview.kind === 'qa') {
    const shown = all ? preview.items : preview.items.slice(0, 3)
    return (
      <div className="mt-2 rounded-lg bg-teal-soft/50 px-3 py-2.5">
        <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-teal-ink">Proposed Q&A · {preview.items.length} questions</p>
        <ul className="space-y-2">
          {shown.map((i) => (
            <li key={i.q}>
              <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                {i.q} <Badge tone={INTENT_TONE[i.intent]}>{i.intent}</Badge>
              </p>
              <p className="text-[13.5px] text-body">{i.a}</p>
            </li>
          ))}
        </ul>
        {preview.items.length > 3 && (
          <button className="mt-1.5 text-[12.5px] font-medium text-brand hover:underline" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show all ${preview.items.length} questions`}
          </button>
        )}
      </div>
    )
  }
  if (preview.kind === 'facts')
    return (
      <div className="mt-2 rounded-lg bg-teal-soft/50 px-3 py-2.5">
        <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-teal-ink">Key facts box</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13.5px]">
          {preview.rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-ink">{k}</dt>
              <dd className="text-body">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  if (preview.kind === 'outline')
    return (
      <div className="mt-2 rounded-lg bg-teal-soft/50 px-3 py-2.5">
        <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-teal-ink">Proposed page outline</p>
        <ul className="space-y-0.5 text-[13.5px]">
          {preview.lines.map((l, i) => (
            <li key={i} className={cn('flex items-baseline gap-2', l.level === 2 && 'pl-4', l.level === 3 && 'pl-8')}>
              <span className="w-6 shrink-0 font-mono text-[11px] text-muted">H{l.level}</span>
              <span className={cn(l.level === 1 ? 'font-semibold text-ink' : l.level === 2 ? 'font-medium text-ink' : 'text-body')}>{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  if (preview.kind === 'code')
    return (
      <div className="mt-2">
        <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">{preview.language} · read-only, generated from verified facts</p>
        <pre className="scrollbar-thin max-h-48 overflow-auto rounded-lg border border-line bg-[#0f1b2d] px-3 py-2 text-[11.5px] leading-relaxed text-[#d7e3f4]" tabIndex={0}>
          {preview.code}
        </pre>
      </div>
    )
  if (preview.kind === 'article')
    return (
      <div className="mt-2 rounded-lg border border-dashed border-line bg-subtle/60 px-3 py-2.5">
        <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Draft guide · not published by this proposal</p>
        <p className="text-[14px] font-semibold text-ink">{preview.title}</p>
        <div className="mt-1.5 space-y-1.5">
          {preview.sections.map((sec) => (
            <div key={sec.heading}>
              <p className="text-[13px] font-medium text-ink">{sec.heading}</p>
              <p className="text-[13px] text-body">{sec.body}</p>
            </div>
          ))}
        </div>
      </div>
    )
  const steps = [
    { text: 'Draft prepared by ProManage', done: true },
    { text: 'Approved by you', done: !!sent },
    { text: 'Handed off to ProManage to confirm the recipient', done: !!sent },
    { text: 'Request sent: only with a real, authorized send integration (not in this prototype)', done: false },
    { text: 'Directory updated: only once ProManage verifies the change', done: false },
  ]
  const full = `To: ${preview.to ?? 'Recipient not yet confirmed'}\nSubject: ${preview.subject}\n\n${preview.body}`
  return (
    <div className="mt-2 rounded-lg border border-line bg-surface">
      <div className="space-y-0.5 border-b border-line px-3 py-2 text-[12.5px]">
        <p>
          <span className="text-muted">To:</span> {preview.to ? <span className="text-ink">{preview.to}</span> : <span className="text-warning">Recipient not yet confirmed. ProManage confirms the directory’s contact before anything is sent; no address is guessed.</span>}
        </p>
        {preview.sourceUrl && (
          <p>
            <span className="text-muted">Listing:</span> <span className="text-ink">{preview.sourceUrl}</span>
          </p>
        )}
        <p>
          <span className="text-muted">Subject:</span> <span className="font-medium text-ink">{preview.subject}</span>
        </p>
      </div>
      <div className="px-3 py-2">
        <Clamp text={preview.body} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={async () => { await copyText(full); toast.success('Request draft copied') }}>
            <Copy />
            Copy email
          </Button>
          <Button size="sm" variant="ghost" onClick={() => downloadText('directory-request-draft.txt', full, 'text/plain')}>
            <Download />
            Download draft
          </Button>
        </div>
      </div>
      <ol className="space-y-1 border-t border-line px-3 py-2 text-[12.5px]">
        {steps.map((st) => (
          <li key={st.text} className="flex items-start gap-2">
            {st.done ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : <span className="mt-[5px] size-2 shrink-0 rounded-full border border-muted" />}
            <span className={st.done ? 'text-ink' : 'text-muted'}>{st.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Which task carries a fix after approval (structured data is published with the website task). */
function taskForFix(fix: Fix, taskIds: string[], tasks: Task[], kind: 'disc' | 'acc') {
  const own = tasks.filter((t) => taskIds.includes(t.id))
  if (fix.channel === 'structured_info') return own.find((t) => t.assetKinds.includes('jsonld')) ?? own.find((t) => t.channel === 'owned_website')
  return kind === 'disc' ? own.find((t) => t.recommendationId === fix.id) : own.find((t) => t.channel === fix.channel)
}

function Clamp({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 160
  return (
    <>
      <p className={cn('whitespace-pre-line text-[13.5px] leading-relaxed', !open && long && 'line-clamp-3')}>{text}</p>
      {long && (
        <button className="mt-1 text-[12.5px] font-medium text-brand hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Show full text'}
        </button>
      )}
    </>
  )
}

/** The actionable heart of a proposal: selectable fix cards + one authorize bar, or per-target results after approval. */
/** Unsaved checkbox selections per proposal, kept while the Brand switches between proposals. */
const PickedCtx = createContext<{ get: (key: string) => string[] | undefined; set: (key: string, ids: string[]) => void } | null>(null)

const deliveryOf = (f: Fix, permission: string): ActionDelivery => f.delivery ?? (permission === 'third_party_unmanaged' ? 'external_request_draft' : permission === 'requires_site_admin' ? 'site_admin_handoff' : 'connected_publish')

function FixPanel({ proposalKey, kind, locationId, fixes, status, taskIds, onApproved, round = 1 }: { proposalKey: string; kind: 'disc' | 'acc'; locationId: string; fixes: Fix[]; status: string; taskIds: string[]; onApproved: () => void; round?: number }) {
  const versionLabel = `r${round}`
  const logPreview = (f: Fix) => logEvent(`action_preview_opened · ${f.title} · ${proposalKey}`)
  const { authorizeProposal, rejectProposal, reviseProposal, tasks, publications, retryPublication, logEvent } = useStore()
  const selectable = (f: Fix) => f.delivery !== 'advisory_only'
  const store = useContext(PickedCtx)
  const [picked, setPickedLocal] = useState<string[]>(() => store?.get(proposalKey) ?? fixes.filter(selectable).map((f) => f.id))
  const setPicked = (fn: (p: string[]) => string[]) =>
    setPickedLocal((p) => {
      const next = fn(p)
      store?.set(proposalKey, next)
      return next
    })
  const [openEvidence, setOpenEvidence] = useState<string | null>(null)
  const { role } = useStore()
  const [dlg, setDlg] = useState<null | 'approve' | 'request_changes' | 'decline'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string>()
  const awaiting = status === 'awaiting_brand_approval'
  const approved = status === 'approved'
  const perm = (f: Fix) => targetPermission({ channel: f.channel === 'structured_info' ? 'owned_website' : (f.channel as never), recommendationId: f.id, locationId })
  const auto = fixes.filter((f) => picked.includes(f.id) && perm(f).permission === 'connected_authorized').length
  const agg = aggregate(publications, taskIds)
  return (
    <div className="rounded-xl border-2 border-brand-line bg-brand-soft/30">
      <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-4 py-3">
        <div className="min-w-0 flex-1">
          {awaiting ? (
            <>
              <p className="text-[15px] font-semibold text-ink">
                {picked.length} of {fixes.filter(selectable).length} changes selected
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-body">
                <span><span className="font-semibold text-success">{auto}</span> can publish through authorized integrations</span>
                <span><span className="font-semibold text-warning">{picked.length - auto}</span> require follow-up</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-ink">
                {fixes.length} recommended change{fixes.length === 1 ? '' : 's'}
              </p>
              <p className="text-[12.5px] text-body">{approved ? AGGREGATE_LABEL[agg] : status === 'declined' ? 'You declined these fixes. Nothing was published.' : 'ProManage is revising these fixes. Nothing was published.'}</p>
            </>
          )}
        </div>
        {awaiting && (
          <div className="flex flex-wrap items-center gap-1">
            <PermButton perm="approvePlan" variant="ghost" size="sm" className="text-body" onClick={() => { setText(''); setErr(undefined); setDlg('request_changes') }}>
              Request changes
            </PermButton>
            <PermButton perm="approvePlan" variant="ghost" size="sm" className="text-muted" onClick={() => { setText(''); setErr(undefined); setDlg('decline') }}>
              Decline
            </PermButton>
            <PermButton perm="approvePlan" variant="primary" size="lg" className="ml-1 h-11 px-5 shadow-pop" disabled={!picked.length} onClick={() => { setText(''); setDlg('approve') }}>
              <ShieldCheck />
              Approve selected ({picked.length})
            </PermButton>
          </div>
        )}
        {status === 'changes_requested' && (
          <Button size="sm" onClick={() => { reviseProposal(proposalKey); toast.success('Revised version ready for authorization (simulated)') }}>
            See revised version
          </Button>
        )}
        {approved && <Badge tone="neutral">Demo: simulated publication</Badge>}
      </div>
      <div className="space-y-4 p-3">
        {GEO_GROUPS.filter((g) => fixes.some((f) => groupOf(f) === g.key)).map((g) => (
          <section key={g.key} aria-label={g.label}>
            {new Set(fixes.map(groupOf)).size > 1 && (
              <div className="mb-2 px-1">
                <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">
                  {g.label} <span className="font-normal normal-case tracking-normal text-muted">· {fixes.filter((f) => groupOf(f) === g.key).length}</span>
                </p>
                <p className="text-[12.5px] text-muted">{g.hint}</p>
              </div>
            )}
      <ul className="space-y-2.5">
        {fixes.filter((f) => groupOf(f) === g.key).sort((a, b) => PRIORITY_RANK[a.priority ?? 'medium'] - PRIORITY_RANK[b.priority ?? 'medium']).map((f) => {
          const pm = perm(f)
          const t = approved ? taskForFix(f, taskIds, tasks, kind) : undefined
          const last = t ? publications.filter((a) => a.taskId === t.id).pop() : undefined
          const st = last ? STATE_LABEL[last.state] : null
          const on = picked.includes(f.id)
          return (
            <li key={f.id} className={cn('rounded-xl border bg-surface px-4 py-3 shadow-card', awaiting && on ? 'border-brand' : 'border-line')}>
              <div className="flex items-start gap-3">
                {awaiting && (selectable(f) ? <Checkbox checked={on} onCheckedChange={(v) => setPicked((p) => (v ? [...p, f.id] : p.filter((x) => x !== f.id)))} aria-label={`Authorize ${f.title}`} className="mt-0.5" /> : <span className="mt-0.5 size-4 shrink-0" aria-hidden />)}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">{f.title}</p>
                    {st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone={pm.permission === 'connected_authorized' ? 'success' : 'warning'} className="max-w-full whitespace-normal">{PERMISSION_LABEL[pm.permission]}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-muted">{f.where}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-body">
                    {f.priority && <Badge tone={f.priority === 'high' ? 'danger' : f.priority === 'medium' ? 'warning' : 'neutral'}>{PRIORITY_LABEL[f.priority]}</Badge>}
                    {f.evidence && <Badge tone={EVIDENCE_LABEL[f.evidence].tone}>{EVIDENCE_LABEL[f.evidence].label}</Badge>}
                    {f.technique && <Badge tone="blue">{f.technique}</Badge>}
                  </p>
                  {f.priorityReason && <p className="mt-1 text-[12px] text-muted">Why first: {f.priorityReason}</p>}
                  {f.basedOn?.length ? <p className="mt-1 text-[12.5px] text-body">Answers: {f.basedOn.map((q) => `“${q}”`).join(' · ')}</p> : null}
                  {f.preview ? (
                    <>
                      {f.before && f.preview.kind !== 'email' && <p className="mt-2 text-[12.5px] text-muted">Now: {f.before}</p>}
                      <GeoPreviewView preview={f.preview} sent={approved && !!last} />
                    </>
                  ) : f.channel === 'structured_info' ? (
                    <p className="mt-2 text-[13.5px] text-body">Search-readable information for the centre page, generated from your verified facts. Preview it in Technical details below.</p>
                  ) : f.after ? (
                    <div className="mt-2 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div className="rounded-lg bg-subtle px-3 py-2 text-body">
                        <p className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">Now</p>
                        <Clamp text={f.before ?? 'Not stated'} />
                      </div>
                      <ArrowRight className="hidden size-4 self-center text-muted md:block" />
                      <div className="rounded-lg bg-teal-soft/60 px-3 py-2 text-ink">
                        <p className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-teal-ink">{f.channel === 'external_request' ? 'We’ll request' : 'After'}</p>
                        <Clamp text={f.after} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13.5px] text-body">No wording change — a check for the site owner to confirm.</p>
                  )}
                  {f.why && (
                    <p className="mt-2 text-[12.5px] text-body">
                      <span className="font-medium text-ink">Why this helps AI:</span> {f.why}
                    </p>
                  )}
                  {f.facts && f.facts.length > 0 && <p className="mt-1.5 text-[12px] text-muted">Uses your verified facts: {f.facts.join(' · ')}</p>}
                  <p className="mt-1 text-[12px] text-muted">
                    <span className="font-medium text-body">Delivery:</span> {DELIVERY_LABEL[deliveryOf(f, pm.permission)]} · Prepared by ProManage
                  </p>
                  {(f.evidenceText || f.limitation) && (
                    <div className="mt-1.5">
                      <button className="text-[12.5px] font-medium text-brand hover:underline" onClick={() => { setOpenEvidence(openEvidence === f.id ? null : f.id); if (openEvidence !== f.id) logPreview(f) }} aria-expanded={openEvidence === f.id}>
                        {openEvidence === f.id ? 'Hide evidence & limitations' : 'Evidence & limitations'}
                      </button>
                      {openEvidence === f.id && (
                        <div className="mt-1 space-y-1 rounded-lg bg-subtle px-3 py-2 text-[12.5px] text-body">
                          {f.evidenceText && <p><span className="font-medium text-ink">Evidence:</span> {f.evidenceText}</p>}
                          {f.limitation && <p><span className="font-medium text-ink">Limitations:</span> {f.limitation}</p>}
                          <p>Possible explanation only; not confirmed as the cause of the AI answer.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {f.note && <p className="mt-1 text-[12px] text-warning">{f.note}</p>}
                  {last && <p className="mt-1.5 text-[12.5px] text-body">{last.detail}</p>}
                  {last?.state === 'failed' && t && (
                    <Button size="sm" className="mt-2" onClick={() => { retryPublication(t.id); toast.success('ProManage retried within the same approval (simulated)') }}>
                      <RotateCcw />
                      ProManage follow-up: retry
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
          </section>
        ))}
      </div>
      {approved && (
        <div className="flex flex-wrap items-center gap-3 border-t border-brand-line px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[12.5px] text-muted">Recorded AI answers are unchanged. A source update doesn’t mean any AI answer has changed — that’s measured in 03 Measure.</p>
          <Button size="sm" asChild>
            <Link to="/measure">
              See what changed
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
      <Dialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === 'approve' ? 'Here is exactly what will change' : dlg === 'request_changes' ? 'Request changes' : 'Decline these changes?'}
        description={dlg === 'approve' ? `You authorize ${picked.length} selected change${picked.length === 1 ? '' : 's'} for this version. ProManage applies them to connected sources it’s permitted to update (simulated); anything else becomes a follow-up.` : dlg === 'request_changes' ? 'Nothing is published. ProManage revises and asks for a new authorization.' : 'Nothing is published.'}
        footer={
          <>
            <Button onClick={() => setDlg(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (dlg !== 'approve' && !text.trim()) return setErr('Please add a short note.')
                if (dlg === 'approve') {
                  authorizeProposal(proposalKey, picked, text.trim() || undefined)
                  onApproved()
                } else {
                  rejectProposal(proposalKey, dlg!, text.trim())
                  toast.success(dlg === 'decline' ? 'Declined — nothing was published' : 'Changes requested — nothing was published')
                }
                setDlg(null)
              }}
            >
              {dlg === 'approve' ? 'Authorize selected targets' : dlg === 'request_changes' ? 'Send request' : 'Decline'}
            </Button>
          </>
        }
      >
        {dlg === 'approve' ? (
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink">
              {fixes
                .filter((f) => picked.includes(f.id))
                .map((f) => (
                  <li key={f.id}>
                    {f.title} <span className="text-muted">· {f.where} · {DELIVERY_LABEL[deliveryOf(f, perm(f).permission)].split(';')[0]}</span>
                  </li>
                ))}
            </ul>
            <p className="rounded-lg bg-subtle px-3 py-2 text-[12.5px] text-body">
              Version {versionLabel} · authorized by {role === 'brand' ? 'Ananya Iyer (Brand)' : 'ProManage on behalf of the Brand'} · {picked.length} selected change{picked.length === 1 ? '' : 's'}
              {fixes.length - picked.length > 0 ? ` · ${fixes.length - picked.length} not selected (not published)` : ''}. You authorize only these exact versions and destinations. Independent sites and site-admin settings are never changed automatically; if a fact or permission changes, a new version needs a new approval.
            </p>
          </div>
        ) : (
          <>
            <Textarea value={text} onChange={(e) => { setText(e.target.value); setErr(undefined) }} placeholder={dlg === 'request_changes' ? 'e.g. Please don’t mention the daycare hours on this page.' : 'Reason'} aria-label="Comment" />
            <FieldError>{err}</FieldError>
          </>
        )}
      </Dialog>
    </div>
  )
}

/* Proposal display titles, derived from what each proposal actually covers (never from a location or the first fix). */
const ACC_TITLE: Partial<Record<string, string>> = {
  saturdayTours: 'Fix Saturday tour details',
  hours: 'Fix incorrect opening hours',
  phone: 'Fix incorrect phone number',
  operatingStatus: 'Correct centre operating status',
  address: 'Fix incorrect address',
  programs: 'Fix programme information',
  website: 'Fix website link',
  name: 'Fix centre name',
}
const accuracyTitle = (field?: string | null) => (field ? (ACC_TITLE[field] ?? `Fix ${FIELD_PHRASE[field as keyof typeof FIELD_PHRASE] ?? field}`) : 'Review possibly incorrect information')

/** Parent-question topics, most specific first; 'overview' is the general "best preschools near…" intent. */
const TOPIC: [string, string][] = [
  ['p5', 'Montessori'],
  ['p2', 'Saturday tour'],
  ['p3', 'daycare'],
  ['p9', 'toddler playgroup'],
  ['p4', 'parent review'],
  ['p1', 'centre overview'],
]
/**
 * Discoverability title from the proposal's own summary: the questions the centre was missed for AND that the
 * proposed changes actually address (via each change's finding). Unaddressed questions are not claimed.
 */
function discoveryTitle(targetPromptIds: string[], coveredPromptIds: string[], groups: (GeoGroup | undefined)[] = []) {
  // Only findability changes (links, sitemap, review links) and no new wording: say so rather than calling it content.
  if (groups.length && !groups.some((g) => g === 'content' || g === 'information' || g === undefined)) return coveredPromptIds.includes('p4') ? 'Make the centre page & reviews easier to find' : 'Make the centre page easier to find'
  const topics = TOPIC.filter(([id]) => targetPromptIds.includes(id) && coveredPromptIds.includes(id)).map(([, label]) => label)
  if (!topics.length) return 'Make centre information easier to find'
  if (topics.length === 1) return `Improve ${topics[0]} content`
  // A specific topic plus the general intent: the changes describe the centre and that topic.
  if (topics.length === 2 && topics[1] === 'centre overview') return `Improve centre overview & ${topics[0]} content`
  return `Strengthen ${topics.slice(0, 2).join(' & ')} information`
}

const planStatus = (s: string) => (s === 'awaiting_brand_approval' ? 'Awaiting your authorization' : s === 'approved' ? 'Authorized' : s === 'changes_requested' ? 'Changes requested' : s === 'declined' ? 'Declined' : 'Draft')

function FindingLine({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-subtle/60 px-4 py-3 text-[14px] text-ink">{children}</div>
}

function DiscoveryProposal({ oppId }: { oppId: string }) {
  const { byId, record, findingsFor, observationsOf, eligibility } = useDiscovery()
  const { factEdits } = useStore()
  const [applying, setApplying] = useState(false)
  const opp = byId[oppId]
  const plan = record(oppId)?.plan
  if (!opp || !plan) return null
  const loc = LOCATION_BY_ID[opp.locationId]
  const missed = observationsOf(opp).filter((o) => opp.targetPromptIds.includes(o.promptId) && eligibility(opp.locationId, o.promptId).status === 'eligible')
  const findings = findingsFor(opp)
  const facts = buildFacts(opp.locationId, factEdits)
  const targets: Target[] = plan.recommendations.map((r) => ({ id: r.id, label: r.brandTitle, where: r.controlledSource, channel: r.channel }))
  const fixes: Fix[] = plan.recommendations.map((r) => ({ id: r.id, title: r.brandTitle, where: r.controlledSource, channel: r.channel, before: r.currentText, after: r.proposedText, facts: r.businessFactIds.map((id) => facts.find((f) => f.id === id)?.label).filter(Boolean) as string[], note: r.dependency, group: r.geoGroup, technique: r.technique, why: r.whyForAI, basedOn: r.basedOnQuestions, preview: r.preview, evidence: r.evidenceBasis ?? (r.gapConfidence === 'Confirmed gap' ? 'confirmed_gap' : 'hypothesis_to_test'), evidenceText: r.evidenceExplanation, priority: r.priority, priorityReason: r.priorityReason, delivery: r.delivery, limitation: r.aiImpactNote }))
  return (
    <ProposalShell id={`disc:${oppId}`} type="disc" title={`${loc.name} — ${discoveryTitle(opp.targetPromptIds, plan.recommendations.flatMap((r) => findings.find((f) => f.id === r.findingId)?.promptIds ?? []), plan.recommendations.filter((r) => r.delivery !== 'advisory_only').map((r) => r.geoGroup))}`} status={planStatus(plan.status)} round={plan.round}>
      <FindingLine>
        <span className="font-semibold">What we found:</span> not mentioned in {missed.length} relevant sampled recommendation{missed.length === 1 ? '' : 's'} — {missed.map((o) => `“${o.query}”`).join(', ')}. A discovery opportunity, not an AI error.
      </FindingLine>
      {applying ? <Applying onDone={() => setApplying(false)} /> : <FixPanel proposalKey={`disc:${oppId}`} kind="disc" locationId={opp.locationId} fixes={fixes} status={plan.status} taskIds={plan.taskIds} round={plan.round} onApproved={() => setApplying(true)} />}
      <div className="space-y-2">
        <Disclosure title="Why ProManage recommends this">
          <p className="whitespace-pre-line text-[13.5px] text-ink">{plan.summary}</p>
          <p className="text-[13.5px] text-body"><span className="font-medium text-ink">Expected benefit (not guaranteed):</span> clearer, consistent information about the verified Montessori programme and services on sources you control. It can’t guarantee any AI assistant will mention the centre.</p>
        </Disclosure>
        <Disclosure title={`What ProManage checked · ${findings.filter((f) => f.certainty === 'confirmed_gap').length} confirmed gaps`}>
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.id} className="text-[13.5px]">
                <span className="font-medium text-ink">{f.surfaceLabel}</span> <span className="text-muted">({CATEGORY_LABEL[f.category]}, snapshot 14 Oct 2026)</span>: <span className="text-body">{f.observation}</span>{' '}
                <Badge tone={f.certainty === 'confirmed_gap' ? 'warning' : f.certainty === 'no_gap' ? 'success' : 'neutral'}>{f.certainty === 'confirmed_gap' ? 'Confirmed missing information' : f.certainty === 'no_gap' ? 'No gap' : f.certainty === 'potential_gap' ? 'Possible factor to test' : 'Couldn’t check'}</Badge>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">
            <span className="font-medium">Confirmed gaps vs. AI impact:</span> these gaps are real in the sources we inspected. Whether they caused the AI to leave you out is a hypothesis — we can’t prove it.
          </p>
        </Disclosure>
        <TechnicalDetails locationId={opp.locationId} targets={targets} contentDiffs={plan.recommendations.filter((r) => r.channel !== 'structured_info').map((r) => ({ title: r.brandTitle, before: r.currentText, after: r.proposedText }))} />
      </div>
    </ProposalShell>
  )
}


function ProposalShell({ id, type, title, status, round, children }: { id: string; type: 'disc' | 'acc'; title: string; status: string; round: number; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <h2 className="min-w-0 flex-1 basis-full text-[16px] font-semibold text-ink sm:basis-auto">
            <span className="block text-[12px] font-medium text-muted">{type === 'disc' ? 'Discoverability' : 'Accuracy'}</span>
            {title}
          </h2>
          <Badge tone={status === 'Awaiting your authorization' ? 'warning' : status.startsWith('Authorized') ? 'success' : 'neutral'}>{status}</Badge>
          <span className="text-[12px] text-muted">v{round}</span>
        </div>
        <div className="space-y-5 px-5 py-4">{children}</div>
      </Card>
    </div>
  )
}

function Applying({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(10)
  useEffect(() => {
    const t1 = setTimeout(() => setPct(60), 350)
    const t2 = setTimeout(() => setPct(100), 800)
    const t3 = setTimeout(onDone, 1150)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [onDone])
  return (
    <div className="rounded-xl border border-brand-line bg-brand-soft px-4 py-3">
      <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
        <Loader2 className="size-4 animate-spin text-brand" />
        Applying your approved changes <Badge tone="neutral">Simulated</Badge>
      </p>
      <Progress value={pct} className="mt-2 h-1.5" />
    </div>
  )
}

function AccuracyProposal({ issue }: { issue: Issue }) {
  const { plans, sourcesFor, factEdits, observationsFor, publications, tasks } = useStore()
  const [applying, setApplying] = useState(false)
  const plan = plans[issue.id]
  if (!plan) return null
  const loc = LOCATION_BY_ID[issue.locationId]
  const obs = observationsFor(issue.auditId).find((o) => o.id === issue.observationId)
  const claim = obs?.extractedClaims.find((c) => c.id === issue.claimId)
  const verified = issue.field ? effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value : null
  const phrase = issue.field ? (FIELD_PHRASE[issue.field] ?? issue.field) : 'information'
  const sources = sourcesFor(issue.locationId)
  // Before = the value seen when it was published; otherwise today's snapshot.
  const valueOf = (taskChannel: string, sourceChannel: string) => {
    const task = tasks.find((t) => plan.taskIds.includes(t.id) && t.channel === taskChannel)
    const pub = task && publications.find((a) => a.taskId === task.id && a.before !== undefined)
    if (pub) return pub.before
    return issue.field ? (sources.find((s) => s.channel === sourceChannel)?.values[issue.field] ?? null) : null
  }
  const targets: Target[] = plan.items.map((it) => ({
    id: it.id,
    label: it.title,
    where: it.detail,
    channel: it.kind,
    before: it.kind === 'owned_website' ? valueOf('owned_website', 'owned_website') : it.kind === 'managed_listing' ? valueOf('managed_listing', 'managed_listing') : it.kind === 'external_request' ? valueOf('external_request', 'external_directory') : null,
    after: it.kind === 'structured_info' ? null : verified,
  }))
  const hours = effectiveLocation(issue.locationId, factEdits).verifiedFields.hours?.value
  const fixes: Fix[] = targets.map((t) => {
    const host = t.where.match(/https?:\/\/([^/\s]+)/)?.[1]
    return {
      id: t.id,
      title: t.channel === 'structured_info' ? 'Technical information prepared by ProManage' : t.label,
      where: t.where,
      channel: t.channel,
      before: t.before,
      after: t.channel === 'owned_website' && issue.field === 'saturdayTours' && verified && hours ? `Campus visits: ${verified}, by booking.\nRegular opening hours stay ${hours} (tour slots are listed separately).` : t.after,
      facts: issue.field && t.channel !== 'structured_info' ? [phrase] : undefined,
      technique: t.channel === 'external_request' ? 'Correction request draft' : t.channel === 'structured_info' ? 'Schema from verified facts' : 'Correct the source',
      evidence: 'confirmed_conflict' as const,
      evidenceText: t.channel === 'structured_info' ? 'Generated from the verified record; mirrors the corrected visible text.' : `Source snapshot shows “${t.before ?? 'not stated'}”; the verified record says “${verified ?? '—'}”.`,
      priority: t.channel === 'external_request' ? ('medium' as const) : t.channel === 'structured_info' ? ('low' as const) : ('high' as const),
      priorityReason: t.channel === 'external_request' ? 'Independent source; ProManage can only request a change' : t.channel === 'structured_info' ? 'Supports the visible correction' : 'A source you control states the wrong fact',
      limitation: 'Correcting the source doesn’t change the recorded AI answer. Whether AI repeats the correct fact is measured in a later check.',
      why: t.channel === 'external_request' ? 'AI assistants read independent directories too. An outdated listing there can keep the wrong answer alive.' : t.channel === 'structured_info' ? undefined : `AI repeats what your own sources say. This source still shows the old ${phrase}.`,
      preview:
        t.channel === 'external_request' && host && verified
          ? {
              kind: 'email' as const,
              sourceUrl: t.where.match(/https?:\/\/\S+/)?.[0],
              subject: `Request to correct BrightNest ${loc.neighborhood} ${phrase}`,
              body: `Hello,\n\nWe noticed that your listing for BrightNest Preschool – ${loc.neighborhood}${t.where.match(/https?:\/\/\S+/) ? ` at ${t.where.match(/https?:\/\/\S+/)![0]}` : ''} shows the ${phrase} as “${t.before ?? 'not stated'}”. Our verified centre information states: ${verified}${issue.field === 'saturdayTours' && hours ? `, separate from regular opening hours (${hours})` : ''}. Could you please update the listing? We can provide confirmation if helpful.\n\nThank you,\n[Authorized BrightNest representative]`,
            }
          : undefined,
    }
  })
  return (
    <ProposalShell id={`acc:${issue.id}`} type="acc" title={`${loc.name} — ${accuracyTitle(issue.field)}`} status={planStatus(plan.status)} round={plan.round}>
      <FindingLine>
        <span className="font-semibold">What we found:</span> “{obs?.query}” — AI said <span className="font-semibold">“{claim?.value}”</span>; your verified record says <span className="font-semibold">“{verified ?? 'not verified'}”</span>.
      </FindingLine>
      {applying ? <Applying onDone={() => setApplying(false)} /> : <FixPanel proposalKey={`acc:${issue.id}`} kind="acc" locationId={issue.locationId} fixes={fixes} status={plan.status} taskIds={plan.taskIds} onApproved={() => setApplying(true)} />}
      <div className="space-y-2">
        <Disclosure title="Why ProManage recommends this">
          <FactComparison ai={claim?.value ?? '—'} record={verified ?? 'Not verified'} recordNote="Independently verified centre information" />
          <p className="text-[13.5px] text-ink">{plan.why}</p>
          <p className="text-[13.5px] text-body"><span className="font-medium text-ink">Expected benefit (not guaranteed):</span> sources you control will state the verified {phrase}. It can’t guarantee the next AI answer changes.</p>
        </Disclosure>
        <Disclosure title={`What ProManage checked · ${sources.filter((s) => issue.field && !s.inaccessible && s.values[issue.field] != null && s.values[issue.field] !== verified).length} outdated sources`}>
          <ul className="space-y-1 text-[13.5px]">
            {sources.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-ink">{s.label}</span> <span className="text-muted">({s.managedByCustomer ? 'connected' : 'independent'}, checked {fmtDate(s.observedAt)})</span>:{' '}
                {s.inaccessible ? 'couldn’t be captured' : issue.field && s.values[issue.field] != null ? `shows “${s.values[issue.field]}”` : 'doesn’t state it'}
                {issue.field && s.values[issue.field] != null && s.values[issue.field] !== verified && !s.inaccessible && <Badge tone="warning" className="ml-1.5">Outdated</Badge>}
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-ink">Outdated sources are confirmed; that they caused the AI answer is a hypothesis. This answer {obs?.citations.length ? `cited ${obs.citations.map((c) => c.title).join(', ')}` : 'cited no source'}.</p>
        </Disclosure>
        <TechnicalDetails locationId={issue.locationId} targets={targets} contentDiffs={targets.filter((t) => t.channel !== 'structured_info').map((t) => ({ title: t.label, before: t.before ?? undefined, after: t.after ?? undefined }))} />
      </div>
    </ProposalShell>
  )
}


export default function ImprovePage() {
  const { latestAudit, openChapter, release, autoPrepared, optimizeChecked, prepareImprovements, issues, plans, investigations, approvals, selectedGoalId, goals, selectGoal, publications } = useStore()
  const disc = useDiscovery()
  const { views } = useBrandViews()
  const { hash } = useLocation()
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'authorized' | 'closed'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'disc' | 'acc'>('all')
  const [locFilter, setLocFilter] = useState('all')
  const navigate = useNavigate()
  const pickedStore = useRef<Record<string, string[]>>({})
  const pickedApi = useRef({ get: (k: string) => pickedStore.current[k], set: (k: string, ids: string[]) => { pickedStore.current[k] = ids } }).current
  // The selected proposal lives in the URL hash, so refresh and back/forward keep it.
  const open = (key: string) => navigate(`/improve#${encodeURIComponent(key)}`)
  useEffect(() => {
    if (hash) {
      setSel(decodeURIComponent(hash.slice(1)))
      setTimeout(() => {
        const el = document.getElementById('proposal-detail')
        if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } else setSel(null)
  }, [hash])
  const first = useRef(release === 'MVP')
  useEffect(() => {
    if (first.current) toast.success('V1 unlocked: recommendations and approvals are now available')
    openChapter(2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (latestAudit && (!autoPrepared[latestAudit.id] || !optimizeChecked?.[latestAudit.id]) && release !== 'MVP') prepareImprovements(latestAudit.id)
  }, [latestAudit, autoPrepared, optimizeChecked, release, prepareImprovements])

  if (!latestAudit) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Improve" subtitle="ProManage prepares improvements from your latest AI Visibility Check." />
        <EmptyState icon={<ScanSearch />} title="Run the AI Visibility Check first" description="Improvements are prepared from the findings of your standard check." action={<Button variant="primary" asChild><Link to="/detect">Go to 01 Detect</Link></Button>} />
      </div>
    )
  }
  const goal = goals.find((g) => g.id === selectedGoalId)
  const inScope = (locId: string) => !goal || goal.locationIds.includes(locId)
  const discPlans = disc.latest.filter((o) => disc.record(o.id)?.plan && inScope(o.locationId))
  const noGap = disc.latest.filter((o) => o.status === 'no_gap' && inScope(o.locationId))
  const accIssues = issues.filter((i) => i.auditId === latestAudit.id && plans[i.id] && inScope(i.locationId))
  const accNoSource = issues.filter((i) => i.auditId === latestAudit.id && i.category === 'factual_mismatch' && investigations[i.id]?.status === 'completed' && !plans[i.id] && inScope(i.locationId))
  const needsConfirm = disc.latest.filter((o) => o.status === 'eligibility_review' && inScope(o.locationId))
  const awaiting = discPlans.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length + accIssues.filter((i) => plans[i.id].status === 'awaiting_brand_approval').length
  const discTitleOf = (oppId: string) => {
    const opp = disc.byId[oppId]
    const plan = disc.record(oppId)?.plan
    if (!opp || !plan) return 'Make centre information easier to find'
    const findings = disc.findingsFor(opp)
    const covered = plan.recommendations.flatMap((r) => findings.find((f) => f.id === r.findingId)?.promptIds ?? [])
    return discoveryTitle(opp.targetPromptIds, covered, plan.recommendations.filter((r) => r.delivery !== 'advisory_only').map((r) => r.geoGroup))
  }
  const locs = [...new Set([...discPlans.map((o) => o.locationId), ...accIssues.map((i) => i.locationId)])].sort((a, b) => (a === 'whitefield' ? -1 : b === 'whitefield' ? 1 : a.localeCompare(b)))
  const items = locs.flatMap((locId) => [
    ...discPlans
      .filter((o) => o.locationId === locId)
      .map((o) => ({ locId, ready: disc.record(o.id)!.plan!.recommendations.filter((r) => r.delivery !== 'advisory_only').length, key: `disc:${o.id}`, type: 'disc' as const, title: `${LOCATION_BY_ID[locId].name} — ${discTitleOf(o.id)}`, short: discTitleOf(o.id), status: disc.record(o.id)!.plan!.status as string, node: <DiscoveryProposal key={o.id} oppId={o.id} /> })),
    ...accIssues
      .filter((i) => i.locationId === locId)
      .map((i) => ({ locId, ready: plans[i.id].items.length, key: `acc:${i.id}`, type: 'acc' as const, title: `${LOCATION_BY_ID[locId].name} — ${accuracyTitle(i.field)}`, short: accuracyTitle(i.field), status: plans[i.id].status as string, node: <AccuracyProposal key={i.id} issue={i} /> })),
  ])
  // The URL hash (stable proposal ID) wins, so refresh and back/forward always show the same proposal.
  const hashKey = hash ? decodeURIComponent(hash.slice(1)) : null
  const current = items.find((i) => i.key === (hashKey ?? sel)) ?? items.find((i) => i.key === sel) ?? items.find((i) => i.status === 'awaiting_brand_approval') ?? items[0]
  // How Detect's findings map onto this page, counted the same way Detect counts them.
  const accViews = views.filter((v) => v.issue.auditId === latestAudit.id && v.stage !== 'not_an_issue' && inScope(v.issue.locationId))
  const noSourceIds = new Set(accNoSource.map((i) => i.id))
  const accNeedsInput = accViews.filter((v) => !plans[v.issue.id] && !noSourceIds.has(v.issue.id))
  let discCovered = 0
  let discNoGap = 0
  let discRelevance = 0
  for (const locId of latestAudit.locationIds.filter(inScope)) {
    const rows = disc.observationsOf({ auditId: latestAudit.id, locationId: locId }).filter((o) => !o.mentioned && disc.eligibility(locId, o.promptId).status !== 'not_relevant')
    const eligible = rows.filter((o) => disc.eligibility(locId, o.promptId).status === 'eligible').length
    discRelevance += rows.length - eligible
    if (disc.record(discoveryId(latestAudit.id, locId))?.plan) discCovered += eligible
    else discNoGap += eligible
  }
  const covered = discCovered + accIssues.length
  const checkedNoChange = discNoGap + accNoSource.length
  const needsInput = discRelevance + accNeedsInput.length
  // Keep the proposal you're looking at selected, even after its status changes (no URL change, so mobile stays on the list).
  if (!sel && current) queueMicrotask(() => setSel(current.key))
  const taskKeys = new Set(items.map((i) => i.key))
  const latestByTask = Object.values(Object.fromEntries(publications.filter((p) => taskKeys.has(p.proposalKey)).map((p) => [p.taskId, p])))

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Recommended improvements"
        subtitle="ProManage has prepared changes from your verified business information: website content, parent Q&As, listings, structured information and requests to independent sites. You review and authorize; nothing is published before you do."
        actions={
          <Button asChild>
            <Link to="/detect">
              <ArrowLeft />
              Back to findings
            </Link>
          </Button>
        }
      />
      {goal && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-[13.5px] text-ink">
          Focused on “{goal.anchorQuestion}” · {LOCATION_BY_ID[goal.locationIds[0]]?.name}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => selectGoal(null)}>
            Back to standard check
          </Button>
        </div>
      )}
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Sparkles className="size-4 text-teal-ink" />
        Prepared automatically by ProManage (simulated) on {fmtDateTime(autoPrepared[latestAudit.id] ?? new Date().toISOString())}. Opening this tab doesn’t approve or publish anything.
      </p>
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] text-body" data-findings-map>
        <span className="font-medium text-ink">From your {covered + checkedNoChange + needsInput} findings in Detect:</span> {items.length} proposal{items.length === 1 ? '' : 's'} cover {covered} of them (one proposal can cover several findings at a centre) · {checkedNoChange} were checked and have nothing ProManage can change, listed below · {needsInput} need confirming before fixing ({discRelevance} relevance confirmations in Detect, {accNeedsInput.length} accuracy item{accNeedsInput.length === 1 ? '' : 's'} listed below).
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Proposals prepared" value={items.length} icon={<Sparkles />} tone="blue" definition="Evidence-backed proposals ProManage prepared from your standard check (simulated)." footer={`${items.filter((i) => i.type === 'disc').length} discoverability · ${items.filter((i) => i.type === 'acc').length} accuracy`} />
        <KpiCard label="Awaiting your authorization" value={awaiting} icon={<ShieldCheck />} tone="warning" definition="Proposals waiting for your decision. Nothing is published before you authorize it." footer="Approve, request changes or decline" />
        <KpiCard label="Sources updated" value={latestByTask.filter((p) => p.state === 'success').length} detail={`of ${latestByTask.length} targets`} icon={<CheckCircle2 />} tone="teal" definition="Connected, write-authorized targets updated after your authorization. Demo: simulated publication." footer="AI answers are unchanged until rechecked" />
        <KpiCard label="Needs follow-up" value={latestByTask.filter((p) => p.state !== 'success').length} icon={<RotateCcw />} tone="neutral" definition="Targets that need ProManage, a site admin or an external owner — never marked updated." footer="Handoffs, access or failed attempts" />
      </div>
      {latestByTask.length > 0 && (
        <NextStep
          chapter="03 Measure"
          title="See what changed after your approvals"
          description={`${latestByTask.filter((p) => p.state === 'success').length} source${latestByTask.filter((p) => p.state === 'success').length === 1 ? '' : 's'} updated so far. When you’re ready, run a follow-up check in Measure with the same questions and centres.${awaiting ? ` ${awaiting} proposal${awaiting === 1 ? '' : 's'} still await your decision.` : ''}`}
          to="/measure"
          cta="See before and after"
        />
      )}
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles />} title="No proposals yet" description="ProManage prepares proposals when your standard check has confirmed, controllable gaps." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className={cn('scrollbar-thin self-start xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto', hash && 'hidden xl:block')}>
            <CardHeader title="Proposals" description="Grouped by location · one queue for both finding types" />
            <div className="border-b border-line px-4 py-2.5">
              <Segmented
                ariaLabel="Proposal status"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All · ${items.length}` },
                  { value: 'awaiting', label: 'Awaiting approval' },
                  { value: 'authorized', label: 'Authorized' },
                  { value: 'closed', label: 'Other' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <Segmented
                ariaLabel="Proposal type"
                size="sm"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'disc', label: 'Discoverability' },
                  { value: 'acc', label: 'Accuracy' },
                ]}
              />
              <Select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="h-8 w-44 text-[13px]" aria-label="Proposal location">
                <option value="all">All locations</option>
                {locs.map((id) => (
                  <option key={id} value={id}>
                    {LOCATION_BY_ID[id].name}
                  </option>
                ))}
              </Select>
            </div>
            {(() => {
              const visible = items.filter(
                (i) =>
                  (filter === 'all' || (filter === 'awaiting' ? i.status === 'awaiting_brand_approval' : filter === 'authorized' ? i.status === 'approved' : !['awaiting_brand_approval', 'approved'].includes(i.status))) &&
                  (typeFilter === 'all' || i.type === typeFilter) &&
                  (locFilter === 'all' || i.locId === locFilter),
              )
              if (!visible.length) return <p className="px-4 py-4 text-[13.5px] text-body">No proposals match these filters.</p>
              return [...new Set(visible.map((i) => i.locId))].map((locId) => {
                const group = visible.filter((i) => i.locId === locId)
                const waiting = group.filter((i) => i.status === 'awaiting_brand_approval').length
                return (
                  <div key={locId} className="border-b border-line last:border-b-0">
                    <p className="flex items-center gap-2 bg-subtle/70 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                      <span className="text-ink">{LOCATION_BY_ID[locId].name}</span>
                      {waiting ? <span className="ml-auto font-medium normal-case tracking-normal text-warning">{waiting} awaiting approval</span> : null}
                    </p>
                    <ul>
                      {group.map((i) => {
                        const active = current?.key === i.key
                        return (
                          <li key={i.key}>
                            <button
                              onClick={() => open(i.key)}
                              aria-current={active ? 'true' : undefined}
                              aria-label={i.title}
                              className={cn('relative flex w-full items-start gap-2.5 px-4 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60', active ? 'bg-brand-soft' : 'hover:bg-subtle')}
                            >
                              {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
                              <span className="min-w-0 flex-1">
                                <span className={cn('block text-[14px]', active ? 'font-semibold text-brand' : 'font-medium text-ink')}>{i.short}</span>
                                <span className="block text-[12px] text-muted">
                                  {i.type === 'disc' ? 'Discoverability' : 'Accuracy'} · {i.ready} change{i.ready === 1 ? '' : 's'}
                                  {i.status !== 'awaiting_brand_approval' && <span className={cn('ml-1 font-medium', i.status === 'approved' ? 'text-success' : 'text-body')}>· {planStatus(i.status)}</span>}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })
            })()}
          </Card>
          <div id="proposal-detail" className={cn('min-w-0 scroll-mt-24', !hash && 'hidden xl:block')}>
            {(() => {
              const order = items.filter((i) => (typeFilter === 'all' || i.type === typeFilter) && (locFilter === 'all' || i.locId === locFilter))
              const idx = order.findIndex((i) => i.key === current?.key)
              const prev = idx > 0 ? order[idx - 1] : null
              const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
              return (
                <div className="mb-3 flex items-center gap-2 text-[13px]">
                  <Button size="sm" variant="ghost" className="xl:hidden" onClick={() => navigate('/improve')}>
                    <ChevronLeft />
                    All proposals
                  </Button>
                  <span className="hidden text-muted xl:inline">{current ? `${LOCATION_BY_ID[current.locId].name} · proposal ${idx + 1} of ${order.length}` : ''}</span>
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" disabled={!prev} onClick={() => prev && open(prev.key)} aria-label="Previous proposal">
                      <ChevronLeft />
                      Previous
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && open(next.key)} aria-label="Next proposal">
                      Next
                      <ChevronRight />
                    </Button>
                  </span>
                </div>
              )
            })()}
            <PickedCtx.Provider value={pickedApi}>{current?.node}</PickedCtx.Provider>
          </div>
        </div>
      )}
      {(noGap.length > 0 || accNoSource.length > 0) && (
        <Card>
          <CardHeader title="No fix identified" description="ProManage checked these and found no justified change yet. They are re-checked whenever you run a follow-up in Measure." />
          <ul className="divide-y divide-line">
            {noGap.map((o) => (
              <li key={o.id} className="px-5 py-3 text-[13.5px]">
                <p className="font-medium text-ink">{LOCATION_BY_ID[o.locationId].name} · Discoverability</p>
                <p className="text-body">What we checked: {disc.findingsFor(o).map((f) => f.surfaceLabel).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'centre page and managed listing'}. Your published information looks complete in the sources we checked. AI engines choose their own recommendations.</p>
              </li>
            ))}
            {accNoSource.map((i) => (
              <li key={i.id} className="px-5 py-3 text-[13.5px]">
                <p className="font-medium text-ink">{LOCATION_BY_ID[i.locationId].name} · Accuracy — {i.title.toLowerCase()}</p>
                <p className="text-body">What we checked: your centre page, managed listing and known directories match your verified information. The incorrect answer has no source we can correct; we’ll keep monitoring.</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(needsConfirm.length > 0 || accNeedsInput.length > 0) && (
        <Card>
          <CardHeader title="Confirm before fixing" description="ProManage won’t propose changes until relevance or facts are confirmed" />
          <ul className="divide-y divide-line">
            {accNeedsInput.map((v) => {
              const unverified = v.issue.field && v.fact?.verificationStatus !== 'verified'
              return (
                <li key={v.issue.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{LOCATION_BY_ID[v.issue.locationId].name} · Accuracy — {v.issue.title.toLowerCase()}</span>
                    <span className="block text-body">
                      {v.issue.entityConfusion
                        ? `The AI answer may be mixing this centre up with BrightNest ${v.issue.entityConfusion}. Confirm the address with the centre first.`
                        : unverified
                          ? 'Your business record for this isn’t verified yet. Verify it first.'
                          : 'The answer has no specific fact we can compare with your record. Review it first.'}
                    </span>
                  </span>
                  <Button size="sm" asChild>
                    <Link to={`/attention/${v.issue.id}`}>{v.issue.entityConfusion ? 'Confirm the address' : unverified ? 'Verify information' : 'Review'}</Link>
                  </Button>
                </li>
              )
            })}
            {needsConfirm.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                <span className="min-w-0 flex-1 text-ink">{LOCATION_BY_ID[o.locationId].name} · {o.intentCategory}</span>
                <Button size="sm" asChild>
                  <Link to={`/attention/discovery/${o.id}`}>Confirm relevance</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card id="history" className="scroll-mt-24">
        <CardHeader title="Approval history" description="Every authorization, change request and decline — versioned and scoped" />
        {approvals.length === 0 ? (
          <p className="px-5 py-4 text-[13.5px] text-body">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...approvals].reverse().map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-[13px]">
                <span className="font-medium text-ink">{a.action === 'approve' ? 'Authorized' : a.action === 'decline' ? 'Declined' : 'Requested changes'}</span> · {a.proposalKey.startsWith('disc') ? 'Discoverability' : 'Accuracy'} · {LOCATION_BY_ID[a.proposalKey.startsWith('disc') ? parseOpp(a.proposalKey.slice(5)).locationId : (issues.find((i) => `acc:${i.id}` === a.proposalKey)?.locationId ?? '')]?.name} · version {a.approvedVersion}
                {a.approvedTargetIds.length ? ` · ${a.approvedTargetIds.length} target${a.approvedTargetIds.length === 1 ? '' : 's'}` : ''} · {a.approverName} · {fmtDateTime(a.at)}
                {a.comment ? ` · “${a.comment}”` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
