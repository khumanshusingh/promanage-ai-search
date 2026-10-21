import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, Code2, Download, FileText, MessageSquare, PackageCheck, Play, RadioTower, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore, TASK_FLOW, taskStatusLabel } from '@/store/AppStore'
import type { ControlledChannel } from '@/data/types'
import { buildFacts, factId } from '@/lib/facts'
import { CHANNEL_HINT, CHANNEL_LABELS, LOCATION_BY_ID, PEOPLE } from '@/data/seed'
import type { Task, TaskStatus } from '@/data/types'
import { OUTCOME_TEXT, useAiAnswerStatus } from '@/lib/aiStatus'
import { exportTasksCsv } from '@/lib/exports'
import { PageHeader, PermButton, SeverityBadge, TaskStatusBadge } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { cn, fmtDate, fmtDateTime } from '@/lib/utils'

const FLOWS: Record<ControlledChannel, TaskStatus[]> = {
  owned_website: TASK_FLOW,
  managed_listing: TASK_FLOW,
  external_request: TASK_FLOW,
  verification: ['open', 'in_progress', 'source_updated', 'closed'],
}

function FlowStepper({ status, channel }: { status: TaskStatus; channel: ControlledChannel }) {
  const { showSimLabels } = useStore()
  const label = (st: TaskStatus) => (showSimLabels ? taskStatusLabel(st, channel) : taskStatusLabel(st, channel).replace(' (simulated)', ''))
  const flow = FLOWS[channel]
  const idx = flow.indexOf(status)
  return (
    <div>
      <ol className="flex gap-1" aria-label="Task progress">
        {flow.map((s, i) => (
          <li key={s} className="min-w-0 flex-1" title={label(s)}>
            <div className={cn('h-1.5 rounded-full', i <= idx ? (s === 'awaiting_recheck' && i === idx ? 'bg-warning' : s === 'closed' ? 'bg-success' : 'bg-brand') : 'bg-[#e3e9f0]')} />
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-[12px] text-muted">
        Step {idx + 1} of {flow.length} · <span className="font-medium text-ink">{label(status)}</span>
        {idx < flow.length - 1 && <> · next: {label(flow[idx + 1])}</>}
      </p>
    </div>
  )
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { issueById, issues, setTaskStatus, approveTask, addTaskComment, role, hasRelease, assetState, recordExternalChange, factEdits, recordDiscoveryUpdate } = useStore()
  const navigate = useNavigate()
  // Discovery tasks never borrow an accuracy issue: the two journeys keep separate outcomes.
  const issue = task.issueId ? issueById[task.issueId] : task.opportunityId ? undefined : issues.find((i) => i.locationId === task.locationId && i.category === 'factual_mismatch')
  const loc = LOCATION_BY_ID[task.locationId]
  const assignee = PEOPLE.find((p) => p.id === task.assigneeId)
  const ai = useAiAnswerStatus(issue)
  const unapprovedAssets = task.assetKinds.filter((k) => assetState(task.locationId, k).status !== 'approved')
  const [comment, setComment] = useState('')
  const [confirm, setConfirm] = useState<null | 'approve' | 'close' | 'evidence'>(null)
  const [evidence, setEvidence] = useState('')

  const move = (s: TaskStatus, msg: string) => {
    setTaskStatus(task.id, s)
    toast.success(msg, { description: `${task.id} · ${taskStatusLabel(s, task.channel)}` })
  }

  const factVerified = task.field ? buildFacts(task.locationId, factEdits).find((f) => f.id === factId(task.locationId, task.field!))?.verificationStatus === 'verified' : true
  let primary: React.ReactNode = null
  if (task.opportunityId && (task.status === 'approved' || task.status === 'in_progress')) {
    primary = (
      <PermButton perm="updateTask" variant="primary" onClick={() => { setEvidence(''); setConfirm('evidence') }}>
        <Upload />
        {task.channel === 'external_request' ? 'Record request sent' : 'Record update (simulated)'}
      </PermButton>
    )
  } else if (task.status === 'open') {
    primary = (
      <PermButton perm="updateTask" variant="primary" onClick={() => move('in_progress', 'Work started')}>
        <Play />
        Start work
      </PermButton>
    )
  } else if (task.channel === 'verification') {
    if (task.status === 'in_progress') {
      primary = (
        <>
          <Button onClick={() => navigate(`/geo-readiness/${task.locationId}?tab=facts`)}>
            <Sparkles />
            Verify in GEO Readiness
          </Button>
          <PermButton perm="updateTask" variant="primary" disabled={!factVerified} title={!factVerified ? 'Verify and approve the value in GEO Readiness first' : undefined} onClick={() => move('source_updated', 'Fact verified')}>
            <ShieldCheck />
            Mark fact verified
          </PermButton>
        </>
      )
    } else if (task.status === 'source_updated') {
      primary = (
        <PermButton perm="updateTask" variant="primary" onClick={() => move('closed', 'Verification complete')}>
          <CheckCircle2 />
          Close verification
        </PermButton>
      )
    }
  } else if (task.status === 'in_progress') {
    primary = (
      <>
        {hasRelease('V1') && task.channel === 'owned_website' && (
          <Button onClick={() => navigate(`/geo-readiness/${task.locationId}?tab=jsonld`)}>
            <Sparkles />
            Prepare in GEO Readiness
          </Button>
        )}
        <PermButton perm="updateTask" variant="primary" onClick={() => move('prepared', task.channel === 'external_request' ? 'Request drafted' : 'Content prepared')}>
          <PackageCheck />
          {task.channel === 'external_request' ? 'Mark request drafted' : 'Mark content prepared'}
        </PermButton>
      </>
    )
  } else if (task.status === 'prepared') {
    primary = (
      <PermButton perm="approveSource" variant="primary" onClick={() => setConfirm('approve')}>
        <ShieldCheck />
        Give business approval
      </PermButton>
    )
  } else if (task.status === 'approved') {
    primary = (
      <PermButton perm="updateTask" variant="primary" onClick={() => move('source_updated', task.channel === 'external_request' ? 'Request sent' : 'Source updated — awaiting AI recheck')}>
        <Upload />
        {task.channel === 'external_request' ? 'Mark request sent' : 'Mark source updated'}
      </PermButton>
    )
  } else if (task.status === 'source_updated' && task.channel === 'external_request') {
    primary = (
      <PermButton
        perm="updateTask"
        variant="primary"
        onClick={() => {
          recordExternalChange(task.id)
          toast.success('Change evidenced', { description: 'Directory snapshot updated. Awaiting AI recheck.' })
        }}
      >
        <Check />
        Record evidence of change
      </PermButton>
    )
  } else if (task.status === 'awaiting_recheck') {
    primary = (
      <>
        {hasRelease('V2') && (
          <Button onClick={() => navigate('/monitoring')}>
            <RadioTower />
            Go to rechecks
          </Button>
        )}
        <PermButton perm="approveSource" variant="primary" onClick={() => setConfirm('close')}>
          <CheckCircle2 />
          Close task
        </PermButton>
      </>
    )
  }

  return (
    <Card className="self-start xl:sticky xl:top-[84px]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-[12px] text-muted">{task.id}</p>
          <h2 className="text-[16px] font-semibold leading-snug text-ink">{task.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} channel={task.channel} />
            {issue && <SeverityBadge severity={issue.severity} />}
            <Badge tone="outline">{CHANNEL_LABELS[task.channel]}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close task details">
          <X />
        </Button>
      </div>
      <div className="space-y-5 px-5 py-5">
        <FlowStepper status={task.status} channel={task.channel} />

        <div className={cn('rounded-lg border px-4 py-3', ai?.outcome ? (ai.outcome === 'changed' ? 'border-[#c6e8d8] bg-success-soft' : ai.outcome === 'unchanged' ? 'border-[#f2c9ce] bg-danger-soft' : 'border-[#f1dcb2] bg-warning-soft') : 'border-line bg-subtle')}>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
            <Sparkles className="size-3.5" />
            AI answer status
          </p>
          {ai?.outcome ? (
            <>
              <p className="mt-1 text-[13.5px] font-medium text-ink">
                Recheck {ai.wave}: {OUTCOME_TEXT[ai.outcome].label}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">Observed change; causation not established.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[13.5px] font-medium text-ink">{task.status === 'closed' ? 'Not observed — closed without a recheck' : 'Not verified — awaiting recheck'}</p>
              <p className="mt-0.5 text-[12px] text-muted">{task.opportunityId ? 'Recording this update changes a source snapshot only. It never rewrites recorded AI answers or marks discovery as solved.' : 'Completing this task updates a source BrightNest controls; it doesn\'t mark the AI answer as fixed.'}</p>
            </>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div>
            <dt className="text-[12px] text-muted">Assignee</dt>
            <dd className="font-medium text-ink">{assignee?.name}</dd>
            <dd className="text-[12px] text-muted">{assignee?.title}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Due</dt>
            <dd className="font-medium text-ink">{fmtDate(task.dueAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[12px] text-muted">Controlled channel</dt>
            <dd className="font-medium text-ink">{CHANNEL_LABELS[task.channel]}</dd>
            <dd className="text-[12px] text-muted">
              {task.target} · {CHANNEL_HINT[task.channel]}
            </dd>
          </div>
          {task.assetKinds.length > 0 && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">Attached content</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {task.assetKinds.map((k) => {
                  const st = assetState(task.locationId, k)
                  return (
                    <Link key={k} to={`/geo-readiness/${task.locationId}?tab=${k}`} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12.5px] text-ink hover:bg-subtle">
                      {k === 'jsonld' ? <Code2 className="size-3.5" /> : <FileText className="size-3.5" />}
                      {k === 'jsonld' ? 'JSON-LD' : 'Fact sheet'}
                      <Badge tone={st.status === 'approved' ? 'success' : 'neutral'}>{st.stale ? 'Facts changed' : st.status === 'approved' ? 'Approved' : 'Draft'}</Badge>
                    </Link>
                  )
                })}
              </dd>
            </div>
          )}
          {task.approvedBy && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">Approved</dt>
              <dd className="text-ink">
                {task.approvedBy} · {fmtDateTime(task.approvedAt!)}
              </dd>
            </div>
          )}
          {task.opportunityId && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">Discovery opportunity</dt>
              <dd>
                <Link to={`/discovery/${task.opportunityId}`} className="font-medium text-brand hover:underline">
                  {loc.name} · being found in AI search
                </Link>
                <span className="text-muted"> · separate from accuracy issues</span>
              </dd>
            </div>
          )}
          {issue && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">Issue</dt>
              <dd>
                <Link to={`/issues/${issue.id}`} className="font-medium text-brand hover:underline">
                  {issue.title}
                </Link>
                <span className="text-muted"> · {loc.name}</span>
              </dd>
            </div>
          )}
          {task.evidence.length > 0 && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">Evidence</dt>
              <dd className="mt-1 space-y-0.5 rounded-lg border border-line bg-subtle px-3 py-2 text-[12.5px]">
                {task.evidence.map((e) => (
                  <p key={e.label}>
                    <span className="text-muted">{e.label}: </span>
                    <span className="text-ink">{e.value}</span>
                  </p>
                ))}
              </dd>
            </div>
          )}
          {task.notes && (
            <div className="col-span-2">
              <dt className="text-[12px] text-muted">{task.channel === 'external_request' ? 'Request draft' : 'Notes'}</dt>
              <dd className="text-body">{task.notes}</dd>
            </div>
          )}
        </dl>

        {primary && <div className="flex flex-wrap gap-2">{primary}</div>}
        {task.status === 'prepared' && <p className="text-[12.5px] text-warning">Content is prepared and waiting for business approval{unapprovedAssets.length ? ' — approving also approves the attached content' : ''}.</p>}
        {task.channel === 'external_request' && task.status !== 'closed' && <p className="text-[12px] text-muted">External site: BrightNest can request a correction; the site owner decides whether to change it.</p>}
        {role === 'brand' && <p className="text-[12px] text-brand">ProManage records task progress; you approve changes to your business information.</p>}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Activity</p>
          <ol className="relative space-y-3 border-l border-line pl-4">
            {task.activity.map((a) => (
              <li key={a.id} className="relative">
                <span className={cn('absolute -left-[21px] top-1 grid size-2.5 place-items-center rounded-full ring-2 ring-white', a.kind === 'approval' ? 'bg-teal' : a.kind === 'comment' ? 'bg-[#94a3b8]' : a.kind === 'system' ? 'bg-warning' : 'bg-brand')} />
                <p className="text-[13px] text-ink">
                  {a.kind === 'comment' && <MessageSquare className="mr-1 inline size-3.5 text-muted" />}
                  {a.text}
                </p>
                <p className="text-[11.5px] text-muted">
                  {a.actor} · {fmtDateTime(a.at)}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" className="min-h-[40px]" aria-label="Comment" />
            <Button
              variant="secondary"
              className="self-end"
              disabled={!comment.trim()}
              onClick={() => {
                addTaskComment(task.id, comment.trim())
                setComment('')
                toast.success('Comment added')
              }}
            >
              Post
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={confirm === 'approve'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Approve this change?"
        description={`Business approval for the ${CHANNEL_LABELS[task.channel].toLowerCase()} change${task.assetKinds.length ? ' and attached content' : ''}. Approval is recorded in the audit trail; nothing is published automatically.`}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                approveTask(task.id)
                setConfirm(null)
                toast.success('Change approved', { description: 'Next: implement on the source and mark it updated.' })
              }}
            >
              <Check />
              Approve
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === 'evidence'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={task.channel === 'external_request' ? 'Record that the request was sent' : 'Record the source update'}
        description="Simulated publication: nothing is pushed to a live site. Evidence is required and stays on the task."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={evidence.trim().length < 8}
              onClick={() => {
                recordDiscoveryUpdate(task.id, evidence.trim())
                setConfirm(null)
                toast.success('Update recorded (simulated)', { description: 'Awaiting the next matched AI check. Original answers are unchanged.' })
              }}
            >
              Record update
            </Button>
          </>
        }
      >
        <Label htmlFor="pub-evidence">Evidence</Label>
        <Textarea id="pub-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={task.channel === 'external_request' ? 'e.g. Correction request emailed to listings@directory.example on 22 Oct' : 'e.g. Published by Kavya Nair on 22 Oct — CMS revision #482, brightnest.example/centers/whitefield'} />
        <p className="mt-1 text-[12px] text-muted">At least 8 characters: who, when and where (simulated).</p>
      </Dialog>
      <Dialog
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Close this task?"
        description={ai?.outcome ? `Latest recheck outcome: ${OUTCOME_TEXT[ai.outcome].label}.` : 'No recheck has been observed. The task will close with the AI answer recorded as “not observed”.'}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setTaskStatus(task.id, 'closed', ai?.outcome ? `recheck ${ai.wave}: ${ai.outcome}` : 'closed without recheck')
                setConfirm(null)
                toast.success('Task closed')
              }}
            >
              Close task
            </Button>
          </>
        }
      />
    </Card>
  )
}

export default function TasksPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tasks, inScope, hasRelease } = useStore()
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const scoped = useMemo(() => tasks.filter((t) => inScope(t.locationId)), [tasks, inScope])
  const list = scoped.filter((t) => filter === 'all' || t.status === filter)
  const selected = scoped.find((t) => t.id === id)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tasks & Publishing"
        subtitle="Fix the information BrightNest controls. AI answers are only re-evaluated by a recheck."
        actions={
          <Button
            disabled={!scoped.length}
            onClick={() => {
              exportTasksCsv(scoped)
              toast.success('Tasks CSV downloaded')
            }}
          >
            <Download />
            Export tasks
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          ariaLabel="Filter by status"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all' as const, label: `All (${scoped.length})` }, ...TASK_FLOW.map((s) => ({ value: s, label: `${taskStatusLabel(s, "owned_website").replace(" (simulated)", "")} (${scoped.filter((t) => t.status === s).length})` }))]}
        />
      </div>
      <div className={cn('grid grid-cols-1 gap-6', selected && 'xl:grid-cols-[minmax(0,1fr)_440px]')}>
        <Card className="self-start">
          {scoped.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck />}
              title="No correction tasks yet"
              description="Confirm a discrepancy, then create a task from the issue to assign it to the source owner."
              action={
                hasRelease('V1') && (
                  <Button variant="primary" asChild>
                    <Link to="/issues">Open issue inbox</Link>
                  </Button>
                )
              }
            />
          ) : list.length === 0 ? (
            <EmptyState icon={<ClipboardCheck />} title="No tasks in this status" action={<Button size="sm" onClick={() => setFilter('all')}>Show all</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((t) => {
                const loc = LOCATION_BY_ID[t.locationId]
                const active = t.id === selected?.id
                return (
                  <li key={t.id}>
                    <button onClick={() => navigate(`/tasks/${t.id}`)} className={cn('flex w-full items-center gap-4 px-5 py-4 text-left transition-colors', active ? 'bg-brand-soft' : 'hover:bg-subtle')}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-muted">
                          {t.id} · {loc?.name}
                        </p>
                        <p className="truncate text-[14px] font-medium text-ink">{t.title}</p>
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          {PEOPLE.find((p) => p.id === t.assigneeId)?.name} · due {fmtDate(t.dueAt)} · {CHANNEL_LABELS[t.channel]}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <TaskStatusBadge status={t.status} channel={t.channel} />
                        {t.assetKinds.length > 0 && <span className="text-[11.5px] text-muted">{t.assetKinds.map((k) => (k === 'jsonld' ? 'JSON-LD' : 'Fact sheet')).join(' + ')}</span>}
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        {selected && <TaskDetail key={selected.id} task={selected} onClose={() => navigate('/tasks')} />}
        {id && !selected && (
          <EmptyState icon={<ClipboardCheck />} title="Task not found" action={<Button size="sm" onClick={() => navigate('/tasks')}>All tasks</Button>} />
        )}
      </div>
    </div>
  )
}
