import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Issue, Observation, ReviewEvidence } from '@/data/types'
import { FIELD_LABELS, LOCATION_BY_ID, PEOPLE, SURFACES } from '@/data/seed'
import { factId } from './facts'
import { useStore } from '@/store/AppStore'

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

/** Immutable evidence snapshot saved with a review decision. */
export function evidenceFor(obs: Observation, claimId?: string): ReviewEvidence {
  const c = obs.extractedClaims.find((x) => x.id === claimId) ?? obs.extractedClaims.find((x) => x.evaluation !== 'match') ?? obs.extractedClaims[0]
  return {
    claim: c ? `${c.label}: “${c.value}”` : obs.mentioned ? 'Mentioned' : 'Not mentioned',
    field: c?.label ?? 'Mention',
    verifiedValue: c?.expected ?? null,
    query: obs.query,
    sampledAt: obs.sampledAt,
    surface: SURFACES[obs.surface].label,
    citations: obs.citations.length ? obs.citations.map((x) => x.url).join(', ') : 'No citations — source unknown',
  }
}

export function useIssueActions() {
  const { createTask, tasks, requestVerification, runRecheck, can, hasRelease } = useStore()
  const navigate = useNavigate()

  /** Route a fact to the centre for confirmation: request on the fact + a verification task owned by the region. */
  const assignVerification = (issue: Issue) => {
    const loc = LOCATION_BY_ID[issue.locationId]
    if (issue.field) requestVerification(factId(issue.locationId, issue.field))
    const existing = tasks.find((t) => t.issueId === issue.id && t.channel === 'verification' && t.status !== 'closed')
    if (existing) {
      toast('Verification already assigned', { description: existing.id, action: { label: 'Open', onClick: () => navigate(`/tasks/${existing.id}`) } })
      return existing
    }
    if (!can('createTask') || !hasRelease('V1')) {
      toast.success('Verification requested', { description: `Sent to ${loc.sourceOwner}. Awaiting source-of-truth verification.` })
      return undefined
    }
    const regional = PEOPLE.find((p) => p.role === 'regional' && p.region === loc.region)
    const field = issue.field ? FIELD_LABELS[issue.field].toLowerCase() : 'details'
    const t = createTask({
      issueId: issue.id,
      locationId: issue.locationId,
      title: issue.entityConfusion ? `Confirm address vs ${issue.entityConfusion} — ${loc.neighborhood}` : `Verify ${field} with the centre — ${loc.neighborhood}`,
      assigneeId: regional?.id ?? 'u-kavya',
      channel: 'verification',
      target: 'ProManage master record — centre confirmation',
      dueAt: plusDays(3),
      notes: issue.summary,
      field: issue.field,
      evidence: [
        { label: 'Issue', value: issue.title },
        { label: 'Sample summary', value: issue.summary },
      ],
    })
    toast.success('Verification assigned', { description: `${t.id} · ${regional?.name ?? 'Kavya Nair'}`, action: { label: 'Open', onClick: () => navigate(`/tasks/${t.id}`) } })
    return t
  }

  const runMatchedRecheck = async (auditId: string) => {
    await new Promise((r) => setTimeout(r, 900))
    const r = runRecheck(auditId)
    toast.success(`Matched recheck ${r.wave} sampled`, { description: 'Same prompts, locations, surface and rules. New observations recorded; originals unchanged.' })
    return r
  }

  return { assignVerification, runMatchedRecheck }
}
