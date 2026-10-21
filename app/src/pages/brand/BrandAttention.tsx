import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CheckCircle2, CircleHelp, Clock, ExternalLink, Globe, Inbox, MapPin, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/AppStore'
import { LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import type { FieldKey } from '@/data/types'
import { factId } from '@/lib/facts'
import { evidenceFor } from '@/lib/issueActions'
import { FIELD_PHRASE, STAGE, useBrandViews, type BrandView } from '@/lib/brandStatus'
import { DimensionChips, EvidenceDisclosure, FactComparison, ProgressTracker, StageBadge } from '@/components/brand'
import { PageHeader, PermButton } from '@/components/domain'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'
import { IssueRow } from './BrandOverview'
import { BrandDiscoveryRows } from './BrandDiscovery'
import { brandNeedsAction, useDiscovery } from '@/lib/useDiscovery'

const norm = (s: string) => s.toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim()
const SEV = { high: 0, medium: 1, low: 2 }

export function BrandAttentionList() {
  const { latestAudit } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  const [params] = useSearchParams()
  const discNeeds = disc.latest.filter((o) => brandNeedsAction(o, !!disc.record(o.id)?.confirmRequested))
  const discOther = disc.latest.filter((o) => !discNeeds.includes(o) && o.status !== 'archived')
  useEffect(() => {
    if (params.get('type') === 'discovery') document.getElementById('discovery')?.scrollIntoView({ behavior: 'smooth' })
  }, [params])
  const mine = views.filter((v) => STAGE[v.stage].needsBrand).sort((a, b) => SEV[a.issue.severity] - SEV[b.issue.severity])
  const other = views.filter((v) => !STAGE[v.stage].needsBrand && v.stage !== 'discovery')
  return (
    <div className="animate-fade-in">
      <PageHeader title="Needs My Attention" subtitle="Business information to confirm and updates to approve." />
      {!latestAudit ? (
        <Card>
          <EmptyState icon={<Inbox />} title="No AI visibility check has been run yet." action={<Button variant="primary" asChild><Link to="/overview">Go to overview</Link></Button>} />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Waiting for you" description={`${mine.length + discNeeds.length} item${mine.length + discNeeds.length === 1 ? '' : 's'}`} />
            {mine.length + discNeeds.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title="You’re all caught up" className="py-8" />
            ) : (
              <>
                {discNeeds.length > 0 && <BrandDiscoveryRows opps={discNeeds} />}
                <ul className={cn('divide-y divide-line', discNeeds.length > 0 && mine.length > 0 && 'border-t border-line')}>
                  {mine.map((v) => (
                    <IssueRow key={v.issue.id} v={v} />
                  ))}
                </ul>
              </>
            )}
          </Card>
          {discOther.length > 0 && (
            <Card id="discovery" className="scroll-mt-24">
              <CardHeader title="Being found in AI search" description="Opportunities to improve how your centres are found — not errors. Sampled responses; not every customer’s AI search." />
              <BrandDiscoveryRows opps={discOther} />
            </Card>
          )}
          {other.length > 0 && (
            <Card>
              <CardHeader title="Already handled or in progress" />
              <ul className="divide-y divide-line">
                {other.map((v) => (
                  <IssueRow key={v.issue.id} v={v} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function SourceSummary({ v }: { v: BrandView }) {
  const { sourcesFor, investigations, plans } = useStore()
  const inv = investigations[v.issue.id]
  // Shown once ProManage has finished checking (or proposed updates), never mid-investigation.
  if (!v.issue.field || !inv || (inv.status === 'in_progress' && !plans[v.issue.id])) return null
  const verified = v.fact?.verificationStatus === 'verified' ? v.fact.value : null
  const field = v.issue.field as FieldKey
  const rows = sourcesFor(v.issue.locationId).map((s) => {
    const val = s.values[field]
    const control = s.channel === 'owned_website' ? 'You control this' : s.channel === 'managed_listing' ? 'Managed by ProManage for you' : 'Independent site — we can only request a correction'
    const state = s.inaccessible ? 'Couldn’t be checked' : val == null ? 'Doesn’t mention it' : val === verified ? 'Matches your information' : `Shows “${val}”`
    const bad = !s.inaccessible && val != null && val !== verified
    return { s, control, state, bad }
  })
  return (
    <Card>
      <CardHeader title="Where information may be outdated" description="What ProManage found in the sources it checked" />
      <ul className="divide-y divide-line">
        {rows.map(({ s, control, state, bad }) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {s.channel === 'owned_website' ? <Globe className="size-4 text-muted" /> : s.channel === 'managed_listing' ? <MapPin className="size-4 text-muted" /> : <ExternalLink className="size-4 text-muted" />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{s.channel === 'owned_website' ? 'Your official centre page' : s.channel === 'managed_listing' ? 'Your Google Business Profile' : s.label}</p>
              <p className="text-[13px] text-muted">{control}</p>
            </div>
            <Badge tone={bad ? 'danger' : state.startsWith('Matches') ? 'success' : 'neutral'}>{state}</Badge>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-[13px] text-body">
        {v.issue.possibleSourceIds.length ? 'Outdated sources are a likely place to start, but we can’t prove they caused the AI answer.' : 'This sampled answer did not cite a source, so the cause is unknown.'}
      </p>
    </Card>
  )
}

function ProposalCard({ v }: { v: BrandView }) {
  const { plans, approvePlan, requestPlanChanges, declinePlan } = useStore()
  const plan = plans[v.issue.id]
  const [dlg, setDlg] = useState<null | 'approve' | 'changes' | 'decline'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string>()
  if (!plan) return null
  const loc = LOCATION_BY_ID[v.issue.locationId]
  return (
    <Card>
      <CardHeader title={`Suggested information updates — ${loc.name}`} description={`Prepared by ProManage · ${fmtDate(plan.updatedAt)}`} />
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-[13px] font-medium text-body">Why we’re recommending this</p>
          <p className="mt-0.5 text-[14px] text-ink">{plan.why}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-body">Recommended updates</p>
          <ul className="mt-1.5 space-y-2">
            {plan.items.map((it) => (
              <li key={it.id} className="flex gap-2.5 text-[14px]">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-teal-ink" />
                <span>
                  <span className="font-medium text-ink">{it.title}</span> <span className="text-body">— Owner: {it.owner}</span>
                  {it.kind === 'external_request' && <span className="block text-[13px] text-muted">An independent site decides whether to change its page.</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-success-soft px-3 py-2.5 text-[13.5px] text-ink">
            <span className="font-medium">What this can do:</span> Make published information about your centre more consistent.
          </div>
          <div className="rounded-lg bg-warning-soft px-3 py-2.5 text-[13.5px] text-ink">
            <span className="font-medium">What it can’t guarantee:</span> That an AI assistant will change its answer.
          </div>
        </div>
        {plan.comments.filter((c) => c.kind === 'changes').length > 0 && (
          <p className="text-[13px] text-muted">Your earlier feedback: “{plan.comments.filter((c) => c.kind === 'changes').pop()!.text}”</p>
        )}
        {plan.status === 'awaiting_brand_approval' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <PermButton perm="approvePlan" variant="primary" onClick={() => { setText(''); setErr(undefined); setDlg('approve') }}>
              Approve proposed updates
            </PermButton>
            <PermButton perm="approvePlan" onClick={() => { setText(''); setErr(undefined); setDlg('changes') }}>
              Request changes
            </PermButton>
            <PermButton perm="approvePlan" variant="ghost" onClick={() => { setText(''); setErr(undefined); setDlg('decline') }}>
              Decline
            </PermButton>
          </div>
        )}
      </div>
      <Dialog
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === 'approve' ? 'Approve these updates?' : dlg === 'changes' ? 'Request changes' : 'Decline this plan?'}
        description={dlg === 'approve' ? 'Owners will update the listed sources. This doesn’t change any AI answer directly.' : dlg === 'changes' ? 'ProManage will revise the plan and send it back.' : 'Nothing will be changed. You can ask ProManage to look again later.'}
        footer={
          <>
            <Button onClick={() => setDlg(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (dlg !== 'approve' && text.trim().length < 4) return setErr('Please add a short note for ProManage.')
                if (dlg === 'approve') approvePlan(v.issue.id, text.trim() || undefined)
                if (dlg === 'changes') requestPlanChanges(v.issue.id, text.trim())
                if (dlg === 'decline') declinePlan(v.issue.id, text.trim())
                toast.success(dlg === 'approve' ? 'Updates approved' : dlg === 'changes' ? 'Changes requested' : 'Plan declined', { description: dlg === 'approve' ? 'We’ll track each update for you.' : 'ProManage has been notified.' })
                setDlg(null)
              }}
            >
              {dlg === 'approve' ? 'Approve' : dlg === 'changes' ? 'Send to ProManage' : 'Decline plan'}
            </Button>
          </>
        }
      >
        <Label htmlFor="plan-note" hint={dlg === 'approve' ? 'Optional' : 'Required'}>
          {dlg === 'approve' ? 'Note' : dlg === 'changes' ? 'What should change?' : 'Reason'}
        </Label>
        <Textarea id="plan-note" value={text} onChange={(e) => { setText(e.target.value); setErr(undefined) }} invalid={!!err} />
        <FieldError>{err}</FieldError>
      </Dialog>
    </Card>
  )
}

function UpdatesCard({ v }: { v: BrandView }) {
  const { plans, tasks, setTaskStatus, approveTask, role } = useStore()
  const plan = plans[v.issue.id]
  const list = plan?.status === 'approved' ? tasks.filter((t) => plan.taskIds.includes(t.id)) : tasks.filter((t) => t.issueId === v.issue.id && t.channel !== 'verification')
  const [recordFor, setRecordFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string>()
  if (!list.length) return null
  const plain = (st: string, ch: string) =>
    st === 'awaiting_recheck' || st === 'closed' ? 'Completed' : ch === 'external_request' && st === 'source_updated' ? 'Correction requested' : st === 'prepared' ? 'Waiting for your approval' : st === 'approved' ? 'Not started' : 'In progress'
  return (
    <Card>
      <CardHeader title="Update progress" description="Who is updating what" />
      <ul className="divide-y divide-line">
        {list.map((t) => {
          const p = plain(t.status, t.channel)
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{t.title}</p>
                <p className="text-[13px] text-muted">Owner: {PEOPLE.find((x) => x.id === t.assigneeId)?.name} · {t.channel === 'owned_website' ? 'Your website team' : t.channel === 'external_request' ? 'ProManage (request to an external site)' : 'ProManage'}</p>
              </div>
              <Badge tone={p === 'Completed' ? 'success' : p === 'Correction requested' || p === 'Waiting for your approval' ? 'warning' : 'blue'}>{p}</Badge>
              {t.status === 'prepared' && (
                <PermButton perm="approveSource" size="sm" variant="primary" onClick={() => { approveTask(t.id); toast.success('Update approved') }}>
                  Approve update
                </PermButton>
              )}
              {role === 'brand' && t.channel === 'owned_website' && !['awaiting_recheck', 'closed', 'source_updated'].includes(t.status) && (
                <Button size="sm" onClick={() => { setNote(''); setErr(undefined); setRecordFor(t.id) }}>
                  Record website update
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Dialog
        open={!!recordFor}
        onOpenChange={(o) => !o && setRecordFor(null)}
        title="Record the website update"
        description="Confirm your website team has published the approved information."
        footer={
          <>
            <Button onClick={() => setRecordFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (note.trim().length < 6) return setErr('Add a short note as evidence, e.g. the page and date.')
                setTaskStatus(recordFor!, 'source_updated', `Website team: ${note.trim()}`)
                setRecordFor(null)
                toast.success('Update recorded', { description: 'Waiting for a follow-up AI check.' })
              }}
            >
              Record update
            </Button>
          </>
        }
      >
        <Label htmlFor="evidence">Evidence</Label>
        <Textarea id="evidence" value={note} onChange={(e) => { setNote(e.target.value); setErr(undefined) }} invalid={!!err} placeholder="e.g. Hours updated on the centre page on 22 Oct by the web team." />
        <FieldError>{err}</FieldError>
      </Dialog>
    </Card>
  )
}

function DecisionCard({ v }: { v: BrandView }) {
  const { observationsFor, setReview, verifyFact, requestVerification, requestInvestigation, setDisposition, hasRelease, can, plans, investigations } = useStore()
  const navigate = useNavigate()
  const obs = observationsFor(v.issue.auditId, 0).find((o) => o.id === v.issue.observationId)!
  const claim = obs.extractedClaims.find((c) => c.id === v.issue.claimId)
  const phrase = v.issue.field ? (FIELD_PHRASE[v.issue.field] ?? 'information') : 'claim'
  const [choice, setChoice] = useState<'yes' | 'no' | 'unsure' | null>(null)
  const [value, setValue] = useState('')
  const [err, setErr] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const [dismiss, setDismiss] = useState(false)
  const [reason, setReason] = useState('')
  useEffect(() => {
    setChoice(null)
    setValue('')
    setErr(undefined)
  }, [v.issue.id, v.stage])

  const ev = evidenceFor(obs, v.issue.claimId)
  const loc = LOCATION_BY_ID[v.issue.locationId]
  const fid = v.issue.field ? factId(v.issue.locationId, v.issue.field) : null
  const sendOn = hasRelease('V1')
  const confirmIncorrect = (note?: string) => {
    setReview(v.issue.reviewKey, 'confirmed', note, loc.name, ev)
    if (sendOn) requestInvestigation(v.issue.id, 'Brand confirmed the business information')
    toast.success('Information confirmed', { description: sendOn ? 'Sent to ProManage to check where it may be outdated.' : 'Included in your report.' })
  }
  const notSure = () => {
    if (fid) requestVerification(fid)
    setReview(v.issue.reviewKey, 'investigating', 'Needs more information — asked operations team', loc.name, ev)
    toast.success('Verification requested', { description: 'Your operations team has been asked to confirm.' })
  }

  const s = v.stage
  if (s === 'verify_fact' || (s === 'awaiting_ops' && choice === 'no')) {
    return (
      <Card className="p-5">
        <p className="text-[16px] font-semibold text-ink">Please confirm the actual {phrase}</p>
        <p className="mt-1 text-[14px] text-body">We can’t say whether the AI answer is wrong until your team confirms the correct information. Nothing is counted as an error yet.</p>
        <div className="mt-4 max-w-md">
          <Label htmlFor="fact-input">Correct {phrase}</Label>
          <Input id="fact-input" value={value} onChange={(e) => { setValue(e.target.value); setErr(undefined) }} invalid={!!err} placeholder={claim?.value} />
          <FieldError>{err}</FieldError>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PermButton
            perm="verifyFact"
            variant="primary"
            onClick={() => {
              if (value.trim().length < 3) return setErr(`Enter the ${phrase} your team has confirmed.`)
              if (fid) verifyFact(fid, value.trim())
              toast.success('Business information confirmed', { description: 'We’ll compare it with the AI answer.' })
            }}
          >
            Confirm {phrase}
          </PermButton>
          {s === 'verify_fact' && (
            <Button onClick={notSure}>Ask my operations team</Button>
          )}
        </div>
      </Card>
    )
  }
  if (s === 'awaiting_ops') {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-[16px] font-semibold text-ink">
          <Clock className="size-4 text-warning" />
          Waiting for your operations team
        </p>
        <p className="mt-1 text-[14px] text-body">We’ve asked your team to confirm the correct {phrase}. No error has been confirmed.</p>
        <Button className="mt-3" onClick={() => setChoice('no')}>
          I have the answer now
        </Button>
      </Card>
    )
  }
  if (s === 'answer_question') {
    const matches = claim && v.fact?.value && norm(claim.value) === norm(v.fact.value)
    if (matches) {
      return (
        <Card className="p-5">
          <p className="text-[16px] font-semibold text-ink">The AI answer matches the information you confirmed</p>
          <p className="mt-1 text-[14px] text-body">No correction is needed for this answer.</p>
          <PermButton perm="reviewDecision" variant="primary" className="mt-3" onClick={() => { setReview(v.issue.reviewKey, 'not_issue', 'AI answer matches confirmed business information', loc.name, ev); toast.success('Marked as not an issue') }}>
            Close — no problem
          </PermButton>
        </Card>
      )
    }
    const question = !v.issue.field ? 'Is this claim about your centre true?' : v.issue.entityConfusion ? 'Is the address in your business record correct?' : `Are the ${phrase} in your business record correct?`
    const options = !v.issue.field
      ? ([['no', 'No, it isn’t true'], ['yes', 'Yes, it’s true'], ['unsure', 'I’m not sure']] as const)
      : ([['yes', 'Yes, these are correct'], ['no', 'No, our business information needs changing'], ['unsure', 'I’m not sure']] as const)
    const cta = choice === 'yes' ? (v.issue.field ? `Confirm ${phrase}` : 'Confirm it’s true') : choice === 'no' ? (v.issue.field ? 'Save corrected information' : 'Confirm it’s not true') : choice === 'unsure' ? 'Request verification' : 'Continue'
    return (
      <Card className="p-5">
        <p className="text-[16px] font-semibold text-ink">{question}</p>
        <div role="radiogroup" aria-label={question} className="mt-3 space-y-2">
          {options.map(([k, label]) => (
            <label key={k} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition-colors', choice === k ? 'border-brand bg-brand-soft text-ink' : 'border-line hover:bg-subtle')}>
              <input type="radio" name="decision" className="size-4 accent-[var(--brand-blue)]" checked={choice === k} onChange={() => setChoice(k)} />
              {label}
            </label>
          ))}
        </div>
        {choice === 'no' && v.issue.field && (
          <div className="mt-3 max-w-md">
            <Label htmlFor="corrected">Correct {phrase}</Label>
            <Input id="corrected" value={value} onChange={(e) => { setValue(e.target.value); setErr(undefined) }} invalid={!!err} />
            <FieldError>{err}</FieldError>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PermButton
            perm="reviewDecision"
            variant="primary"
            disabled={!choice}
            onClick={() => {
              if (choice === 'unsure') return notSure()
              if (choice === 'no' && v.issue.field && value.trim().length < 3) return setErr(`Enter the correct ${phrase}.`)
              setConfirm(true)
            }}
          >
            {cta}
          </PermButton>
          <button className="text-[13.5px] font-medium text-body underline-offset-4 hover:text-ink hover:underline" onClick={() => { setReason(''); setDismiss(true) }}>
            This isn’t a problem
          </button>
        </div>
        {!can('reviewDecision') && <p className="mt-2 text-[13px] text-brand">The Brand confirms business information.</p>}
        <Dialog
          open={confirm}
          onOpenChange={setConfirm}
          title={choice === 'no' && v.issue.field ? 'Update your approved business record?' : 'Confirm your answer?'}
          description={
            choice === 'yes' && v.issue.field
              ? `Your record (“${v.fact?.value}”) is correct, so the AI answer is incorrect.${sendOn ? ' ProManage will check where the wrong information may come from.' : ''}`
              : choice === 'no' && v.issue.field
                ? `Your approved ${phrase} becomes “${value.trim()}”.`
                : choice === 'no'
                  ? 'The claim will be recorded as incorrect.'
                  : 'The claim will be recorded as accurate.'
          }
          footer={
            <>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirm(false)
                  if (!v.issue.field) {
                    if (choice === 'yes') {
                      setReview(v.issue.reviewKey, 'not_issue', 'Brand confirms the claim is true', loc.name, ev)
                      toast.success('Recorded as accurate')
                    } else confirmIncorrect('Brand confirms the claim is not true')
                    return
                  }
                  if (choice === 'yes') return confirmIncorrect()
                  if (fid) verifyFact(fid, value.trim())
                  if (claim && norm(claim.value) === norm(value.trim())) {
                    setReview(v.issue.reviewKey, 'not_issue', 'Business record corrected; the AI answer matches it', loc.name, ev)
                    toast.success('Business record updated', { description: 'The AI answer matches your corrected information.' })
                  } else confirmIncorrect('Business record corrected by Brand; AI answer still differs')
                }}
              >
                Confirm
              </Button>
            </>
          }
        />
        <Dialog
          open={dismiss}
          onOpenChange={setDismiss}
          title="Mark as not a problem?"
          description="Tell us briefly why (optional)."
          footer={
            <>
              <Button onClick={() => setDismiss(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { setReview(v.issue.reviewKey, 'not_issue', reason.trim() || undefined, loc.name, ev); setDismiss(false); toast.success('Marked as not an issue') }}>
                Mark not a problem
              </Button>
            </>
          }
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        </Dialog>
      </Card>
    )
  }
  if (s === 'confirmed') {
    return (
      <Card className="p-5">
        <p className="text-[16px] font-semibold text-ink">Information confirmed as incorrect</p>
        <p className="mt-1 text-[14px] text-body">It’s included in your report. Working with ProManage on corrections becomes available in your next phase.</p>
      </Card>
    )
  }
  if (s === 'send_to_promanage') {
    return (
      <Card className="p-5">
        <p className="text-[16px] font-semibold text-ink">Information confirmed</p>
        <p className="mt-1 text-[14px] text-body">Send it to ProManage to check where the incorrect information may come from.</p>
        <PermButton perm="reviewDecision" variant="primary" className="mt-3" onClick={() => { requestInvestigation(v.issue.id); toast.success('Sent to ProManage for review') }}>
          Send to ProManage for review
        </PermButton>
      </Card>
    )
  }
  const plan = plans[v.issue.id]
  const inv = investigations[v.issue.id]
  const box = (icon: React.ReactNode, title: string, body: React.ReactNode, actions?: React.ReactNode) => (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[16px] font-semibold text-ink [&_svg]:size-4">
        {icon}
        {title}
      </p>
      <div className="mt-1 text-[14px] text-body">{body}</div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  )
  if (s === 'proposal_ready' && plan) return null
  if (s === 'proposal_ready') return box(<Clock className="text-warning" />, 'An update is ready for your approval', 'Review what would change and who will do it below. Approving doesn’t change any AI answer directly.')
  if (s === 'investigating') return box(<Search className="text-brand" />, 'ProManage is checking where this information may be outdated.', `Started ${fmtDate(inv?.requestedAt ?? new Date().toISOString())}. You’ll be asked to approve any proposed updates.`)
  if (s === 'changes_requested') return box(<RefreshCw className="text-brand" />, 'ProManage is revising the proposed updates', plan?.comments.filter((c) => c.kind === 'changes').pop() ? `You asked: “${plan.comments.filter((c) => c.kind === 'changes').pop()!.text}”` : 'A revised plan will be sent to you.')
  if (s === 'declined')
    return box(<CircleHelp className="text-muted" />, 'You declined the proposed updates', `Nothing will be changed. ${plan?.comments.filter((c) => c.kind === 'decline').pop()?.text ? `Your reason: “${plan.comments.filter((c) => c.kind === 'decline').pop()!.text}”` : ''}`, (
      <Button onClick={() => { requestInvestigation(v.issue.id, 'Brand asked ProManage to look again'); toast.success('Asked ProManage to look again') }}>Ask ProManage to look again</Button>
    ))
  if (s === 'no_source_found') return box(<BadgeCheck className="text-success" />, 'Information is accurate in the sources we checked.', `We’ll continue monitoring this AI answer. ${inv?.finding ? `ProManage note: ${inv.finding}` : ''}`)
  if (s === 'update_in_progress') return box(<Clock className="text-brand" />, 'Information update in progress', 'Your approved updates are being made. See who is doing what below.')
  if (s === 'awaiting_recheck') return box(<Clock className="text-warning" />, 'Information update completed — waiting for a follow-up AI check', 'Updating a source doesn’t change AI answers directly. The next follow-up check will show what the AI says now.')
  if (s === 'looks_correct')
    return box(<CheckCircle2 className="text-success" />, 'Looks correct in the latest AI check', 'The latest sampled answer no longer shows the incorrect information. This is one sample — it doesn’t prove the update caused the change or that future answers will stay correct.', (
      <>
        <PermButton perm="reviewDecision" variant="primary" onClick={() => { setDisposition(v.issue.id, 'closed', 'Brand marked resolved after follow-up check'); toast.success('Marked as resolved') }}>
          Mark as resolved
        </PermButton>
        <Button onClick={() => { setDisposition(v.issue.id, 'monitoring', 'Keep monitoring'); toast.success('We’ll keep monitoring') }}>Keep monitoring</Button>
      </>
    ))
  if (s === 'still_incorrect')
    return box(<ShieldAlert className="text-danger" />, 'Still incorrect in the latest AI check', `${v.sourceDim === 'Completed' ? 'Your information update is complete, but ' : ''}the latest sampled answer still shows the incorrect information.`, (
      <>
        <PermButton perm="reviewDecision" variant="primary" onClick={() => { requestInvestigation(v.issue.id, `Still incorrect in follow-up check ${v.recheckWave}`); toast.success('Further investigation requested') }}>
          Request further investigation
        </PermButton>
        <Button onClick={() => { setDisposition(v.issue.id, 'monitoring', 'Keep monitoring'); toast.success('We’ll keep monitoring') }}>Keep monitoring</Button>
      </>
    ))
  if (s === 'inconclusive') return box(<CircleHelp className="text-warning" />, 'Inconclusive — more checks needed', 'The latest answer didn’t clearly state this information, so we can’t tell if it changed. We’ll keep checking.')
  if (s === 'not_an_issue') return box(<BadgeCheck className="text-muted" />, 'Marked as not an issue', 'No further action.', <Button onClick={() => navigate('/attention')}>Back to Needs My Attention</Button>)
  return box(<CheckCircle2 className="text-success" />, 'Resolved', 'You marked this as resolved. Future checks can still show changes.')
}

export default function BrandIssuePage() {
  const { id = '' } = useParams()
  const { issueById, observationsFor, rechecksFor, hasRelease } = useStore()
  const { view } = useBrandViews()
  const issue = issueById[id]
  const v = useMemo(() => (issue ? view(issue) : null), [issue, view])
  if (!issue || !v) {
    return <EmptyState icon={<Inbox />} title="This item isn’t available" description="It may belong to an earlier check." action={<Button asChild><Link to="/attention">Needs My Attention</Link></Button>} />
  }
  const obs = observationsFor(issue.auditId, 0).find((o) => o.id === issue.observationId)!
  const claim = obs.extractedClaims.find((c) => c.id === issue.claimId)
  const rechecks = rechecksFor(issue.auditId)
  const later = rechecks.length ? observationsFor(issue.auditId, rechecks[rechecks.length - 1].wave).find((o) => o.locationId === issue.locationId && o.promptId === issue.promptId) : undefined
  const laterClaim = later?.extractedClaims.find((c) => c.field === issue.field)
  const pastAnswer = !['answer_question', 'verify_fact', 'awaiting_ops', 'discovery', 'not_an_issue'].includes(v.stage)

  if (v.stage === 'discovery') {
    const disc = observationsFor(issue.auditId, 0).filter((o) => o.locationId === issue.locationId && o.answerText && !o.extractedClaims.some((c) => c.field === 'phone'))
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow={<Link to="/attention" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" />Back</Link>} title={v.title} subtitle={v.explanation} />
        <Card className="p-5">
          <p className="text-[14px] text-body">Not mentioned in {disc.length ? 'the selected AI answers' : 'this selected AI answer'}. Reasons are unknown unless investigated, and this isn’t counted as incorrect information.</p>
          <EvidenceDisclosure obs={obs} />
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/attention" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Needs My Attention
          </Link>
        }
        title={v.title}
        subtitle={v.explanation}
        actions={<StageBadge stage={v.stage} />}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <FactComparison
            ai={claim ? claim.value : '—'}
            record={!issue.field ? 'Not in your approved information' : v.fact?.verificationStatus === 'verified' ? v.fact.value : 'Not confirmed yet'}
            recordNote={v.fact?.verificationStatus === 'verified' && v.fact.verifiedAt ? `Last confirmed by ${v.fact.verifiedBy} on ${fmtDate(v.fact.verifiedAt)}` : undefined}
          />
          {issue.field === 'saturdayTours' && <p className="text-[13px] text-body">Saturday tours are appointment slots — they’re kept separate from your centre’s normal opening hours.</p>}
          {later && laterClaim && pastAnswer && v.aiDim !== 'Not rechecked' && (
            <div className="rounded-xl border border-line bg-surface px-5 py-3 text-[14px]">
              <span className="text-body">Latest AI check said: </span>
              <span className="font-semibold text-ink">{laterClaim.value}</span>
            </div>
          )}
          <DecisionCard v={v} />
          {v.stage === 'proposal_ready' && <ProposalCard v={v} />}
          <UpdatesCard v={v} />
          <SourceSummary v={v} />
          <EvidenceDisclosure obs={obs} later={hasRelease('V2') ? later : undefined} />
        </div>
        <div className="space-y-4">
          {hasRelease('V1') && pastAnswer && v.stage !== 'confirmed' && (
            <Card className="p-5">
              <p className="mb-3 text-[15px] font-semibold text-ink">Progress</p>
              <ProgressTracker v={v} />
            </Card>
          )}
          {pastAnswer && (
            <Card className="p-5">
              <p className="mb-2 text-[15px] font-semibold text-ink">Status</p>
              <DimensionChips v={v} />
            </Card>
          )}
          <Card className="p-5 text-[13.5px] text-body">
            <p className="font-medium text-ink">About this finding</p>
            <p className="mt-1">These findings come from selected AI searches. AI responses can vary.</p>
            {!obs.citations.length && <p className="mt-1">This sampled answer did not cite a source.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}
