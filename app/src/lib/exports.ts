import type { Audit, Issue, Observation, PromptTemplate, Review, Task } from '@/data/types'
import { CHANNEL_LABELS, LOCATION_BY_ID, PEOPLE, SURFACES } from '@/data/seed'
import { TASK_STATUS_LABEL } from '@/store/AppStore'
import { outcomeOf } from './metrics'
import { downloadCsv, type CsvRow } from './csv'

const OUTCOME_LABEL = { mismatch: 'Factual mismatch (flagged)', unverifiable: 'Unverifiable / cannot evaluate', omission: 'Not mentioned in sample', clear: 'No issues found in sample' }

export function observationRows(obs: Observation[], prompts: Record<string, PromptTemplate>, reviews: Record<string, Review>, issues: Issue[], tasks: Task[]): CsvRow[] {
  return obs.map((o) => {
    const loc = LOCATION_BY_ID[o.locationId]
    const p = prompts[o.promptId]
    const issue = issues.find((i) => i.observationId === o.id && i.reviewKey === o.id)
    const task = issue ? tasks.find((t) => t.issueId === issue.id) : undefined
    return {
      observation_id: o.id,
      audit_id: o.auditId,
      wave: o.wave === 0 ? 'baseline' : `recheck ${o.wave}`,
      surface: SURFACES[o.surface].label,
      sampled_at: o.sampledAt,
      location: loc?.name,
      region: loc?.region,
      record_verification_status: loc?.verificationStatus,
      record_last_verified: loc?.lastVerifiedAt,
      prompt_id: o.promptId,
      prompt_type: p?.includeInDiscoveryMetric ? 'unbranded discovery' : 'branded fact',
      query: o.query,
      location_mentioned: p?.includeInDiscoveryMetric ? (o.mentioned ? 'yes' : 'no') : 'n/a (branded)',
      brand_mentioned: p?.includeInDiscoveryMetric ? (o.mentionedBrand ? 'yes' : 'no') : 'n/a (branded)',
      other_branch_named: o.otherBranchName ?? '',
      claims: o.extractedClaims.map((c) => `${c.label}: "${c.value}" → ${c.evaluation}${c.expected ? ` (record: ${c.expected})` : ''}`).join(' | '),
      outcome: OUTCOME_LABEL[outcomeOf(o, prompts)],
      review_status: reviews[o.id]?.status ?? 'unreviewed',
      issue_id: issue?.id ?? '',
      task_id: task?.id ?? '',
      task_status: task ? TASK_STATUS_LABEL[task.status] : '',
      task_assignee: task ? PEOPLE.find((x) => x.id === task.assigneeId)?.name : '',
      citations: o.citations.map((c) => c.url).join(' '),
      simulated: 'true',
    }
  })
}

export function exportAuditCsv(audit: Audit, obs: Observation[], prompts: Record<string, PromptTemplate>, reviews: Record<string, Review>, issues: Issue[], tasks: Task[], suffix = '') {
  downloadCsv(`brightnest-ai-visibility-${audit.id}${suffix}.csv`, observationRows(obs, prompts, reviews, issues, tasks), [
    `# ProManage AI Visibility — ${audit.name} (${audit.id})`,
    '# SIMULATED DEMO DATA — fictional brand; not real AI search results',
  ])
}

export function exportTasksCsv(tasks: Task[]) {
  downloadCsv(
    'brightnest-correction-tasks.csv',
    tasks.map((t) => ({
      task_id: t.id,
      title: t.title,
      issue_id: t.issueId ?? '',
      location: LOCATION_BY_ID[t.locationId]?.name ?? '',
      assignee: PEOPLE.find((p) => p.id === t.assigneeId)?.name,
      channel: CHANNEL_LABELS[t.channel],
      target: t.target,
      attached_content: t.assetKinds.join(' '),
      status: TASK_STATUS_LABEL[t.status],
      approved_by: t.approvedBy ?? '',
      due: t.dueAt,
      created: t.createdAt,
      ai_answer_verified_fixed: 'not established — requires recheck',
      simulated: 'true',
    })),
    ['# SIMULATED DEMO DATA — no external listings or websites were changed'],
  )
}
