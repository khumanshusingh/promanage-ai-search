import type { BusinessFact, FieldKey, Issue } from '@/data/types'
import { LOCATION_BY_ID } from '@/data/seed'
import { buildFacts } from './facts'
import type { RecheckOutcome } from './metrics'
import { outcomeForIssue, revisedFacts } from './aiStatus'
import { useStore } from '@/store/AppStore'

/*
  Brand-facing view of an issue, derived from the shared records (review, verified
  facts, investigation, correction plan, tasks, rechecks). No separate status is stored.
*/

export type BrandStage =
  | 'discovery'
  | 'verify_fact'
  | 'awaiting_ops'
  | 'answer_question'
  | 'confirmed'
  | 'send_to_promanage'
  | 'investigating'
  | 'proposal_ready'
  | 'changes_requested'
  | 'declined'
  | 'no_source_found'
  | 'update_in_progress'
  | 'awaiting_recheck'
  | 'looks_correct'
  | 'still_incorrect'
  | 'inconclusive'
  | 'not_an_issue'
  | 'closed'

export const FIELD_PHRASE: Partial<Record<FieldKey, string>> = {
  hours: 'opening hours',
  phone: 'phone number',
  address: 'address',
  saturdayTours: 'Saturday tour availability',
  operatingStatus: 'open / closed status',
  programs: 'programs offered',
  website: 'website',
  name: 'centre name',
}

export const STAGE: Record<BrandStage, { label: string; tone: 'warning' | 'blue' | 'danger' | 'neutral' | 'teal' | 'success'; cta: string; needsBrand: boolean }> = {
  discovery: { label: 'Not mentioned in selected searches', tone: 'neutral', cta: 'View details', needsBrand: false },
  verify_fact: { label: 'Waiting for your verification', tone: 'warning', cta: 'Verify business information', needsBrand: true },
  awaiting_ops: { label: 'Waiting for your operations team', tone: 'warning', cta: 'Review details', needsBrand: true },
  answer_question: { label: 'Information may be incorrect', tone: 'warning', cta: 'Review details', needsBrand: true },
  confirmed: { label: 'Confirmed incorrect information', tone: 'danger', cta: 'View details', needsBrand: false },
  send_to_promanage: { label: 'Information confirmed', tone: 'danger', cta: 'Send to ProManage for review', needsBrand: true },
  investigating: { label: 'ProManage is investigating', tone: 'blue', cta: 'View progress', needsBrand: false },
  proposal_ready: { label: 'Proposed updates ready', tone: 'warning', cta: 'Review proposed updates', needsBrand: true },
  changes_requested: { label: 'ProManage is revising the plan', tone: 'blue', cta: 'View progress', needsBrand: false },
  declined: { label: 'You declined the proposed updates', tone: 'neutral', cta: 'View details', needsBrand: false },
  no_source_found: { label: 'Sources accurate — monitoring', tone: 'neutral', cta: 'View progress', needsBrand: false },
  update_in_progress: { label: 'Information update in progress', tone: 'blue', cta: 'Track update', needsBrand: false },
  awaiting_recheck: { label: 'Waiting for a follow-up AI check', tone: 'warning', cta: 'View follow-up check status', needsBrand: false },
  looks_correct: { label: 'Looks correct in the latest AI check', tone: 'success', cta: 'View latest evidence', needsBrand: false },
  still_incorrect: { label: 'Still incorrect in the latest AI check', tone: 'danger', cta: 'Request further investigation', needsBrand: true },
  inconclusive: { label: 'Inconclusive — more checks needed', tone: 'warning', cta: 'View latest evidence', needsBrand: false },
  not_an_issue: { label: 'Not an issue', tone: 'neutral', cta: 'View details', needsBrand: false },
  closed: { label: 'Closed', tone: 'success', cta: 'View details', needsBrand: false },
}

export interface BrandView {
  issue: Issue
  stage: BrandStage
  fact?: BusinessFact
  title: string
  explanation: string
  factDim: 'Needs verification' | 'Verified' | 'Disputed' | 'Not an issue'
  sourceDim: 'Not started' | 'In progress' | 'Completed' | 'Correction requested' | 'Not controllable' | 'Not needed'
  aiDim: 'Not rechecked' | 'Still incorrect' | 'Looks correct' | 'Inconclusive'
  outcome: RecheckOutcome | null
  recheckWave: number
}

/** Issues the Brand sees: answer-level findings, not ProManage's source-level working items. */
export const isBrandIssue = (i: Issue) => i.category !== 'source_inconsistency'

export function useBrandViews() {
  const { issues, reviews, factEdits, investigations, plans, tasks, dispositions, hasRelease, rechecksFor, observationsFor, promptsById } = useStore()

  const view = (issue: Issue): BrandView => {
    const loc = LOCATION_BY_ID[issue.locationId]
    const facts = buildFacts(issue.locationId, factEdits)
    const fact = issue.field ? facts.find((f) => f.key === issue.field) : undefined
    const phrase = issue.field ? (FIELD_PHRASE[issue.field] ?? issue.field) : 'details'
    const review = reviews[issue.reviewKey]
    const inv = investigations[issue.id]
    const plan = plans[issue.id] && plans[issue.id].round === (inv?.round ?? 1) ? plans[issue.id] : undefined
    const planTasks = plan?.status === 'approved' ? tasks.filter((t) => plan.taskIds.includes(t.id)) : tasks.filter((t) => t.issueId === issue.id && t.channel !== 'verification')
    const rechecks = rechecksFor(issue.auditId)
    const latest = rechecks[rechecks.length - 1]
    const outcome = hasRelease('V2') && latest ? outcomeForIssue(issue, observationsFor(issue.auditId, 0), observationsFor(issue.auditId, latest.wave), promptsById, revisedFacts(latest)) : null
    const aiDim: BrandView['aiDim'] = !outcome ? 'Not rechecked' : outcome === 'changed' ? 'Looks correct' : outcome === 'unchanged' ? 'Still incorrect' : 'Inconclusive'
    const done = (st: string) => ['awaiting_recheck', 'closed'].includes(st)
    // A sent request to an independent site is as far as BrightNest can go; it doesn't block the follow-up check.
    const settled = (t: { status: string; channel: string }) => done(t.status) || (t.channel === 'external_request' && t.status === 'source_updated')
    const sourceDim: BrandView['sourceDim'] =
      inv && inv.status !== 'in_progress' && !plan
        ? 'Not controllable'
        : planTasks.length === 0
          ? 'Not started'
          : planTasks.every((t) => done(t.status))
            ? 'Completed'
            : planTasks.every(settled)
              ? 'Correction requested'
              : 'In progress'
    const factOk = !issue.field || fact?.verificationStatus === 'verified'
    const factDim: BrandView['factDim'] = review?.status === 'not_issue' ? 'Not an issue' : !factOk ? 'Needs verification' : 'Verified'

    let stage: BrandStage
    if (issue.category === 'discovery_gap') stage = 'discovery'
    else if (review?.status === 'not_issue') stage = 'not_an_issue'
    else if (dispositions[issue.id]?.status === 'closed') stage = 'closed'
    else if (!factOk) stage = fact?.requested || fact?.verificationStatus === 'pending_approval' || review?.status === 'investigating' ? 'awaiting_ops' : 'verify_fact'
    else if (review?.status !== 'confirmed') stage = review?.status === 'investigating' ? 'awaiting_ops' : 'answer_question'
    else if (!hasRelease('V1')) stage = 'confirmed'
    else if (planTasks.some((t) => t.status === 'prepared')) stage = 'proposal_ready'
    else if (!inv) stage = 'send_to_promanage'
    else if (inv.status === 'in_progress') {
      stage = !plan ? 'investigating' : plan.status === 'awaiting_brand_approval' ? 'proposal_ready' : plan.status === 'changes_requested' || plan.status === 'draft' ? 'changes_requested' : plan.status === 'declined' ? 'declined' : 'update_in_progress'
    } else if (plan?.status === 'awaiting_brand_approval') stage = 'proposal_ready'
    else if (plan?.status === 'changes_requested' || plan?.status === 'draft') stage = 'changes_requested'
    else if (plan?.status === 'declined') stage = 'declined'
    else if (plan?.status === 'approved' && !planTasks.every(settled)) stage = 'update_in_progress'
    else if (!outcome) stage = plan ? 'awaiting_recheck' : 'no_source_found'
    else stage = outcome === 'changed' ? 'looks_correct' : outcome === 'unchanged' ? 'still_incorrect' : 'inconclusive'

    const sensitive = issue.category === 'unsupported_claim'
    const title = issue.category === 'discovery_gap'
      ? `${loc.name} — not mentioned in selected searches`
      : sensitive
        ? `${loc.name} — a claim needs checking`
        : `${loc.name} — ${phrase} ${stage === 'looks_correct' ? 'looked correct in the latest check' : review?.status === 'confirmed' ? 'incorrect in an AI answer' : 'may be incorrect'}`
    const explanation = issue.category === 'discovery_gap'
      ? 'Your centre wasn’t named in the selected unbranded AI answers. This is a visibility observation, not an error.'
      : sensitive
        ? 'An AI answer makes a claim about your centre that isn’t in your approved business information.'
        : issue.entityConfusion
          ? `An AI answer may be mixing this centre up with BrightNest ${issue.entityConfusion}.`
          : !factOk
            ? `An AI answer mentions your centre’s ${phrase}, but your team hasn’t confirmed the correct ${phrase} yet.`
            : `An AI answer gives different ${phrase} from the information your team has approved.`
    return { issue, stage, fact, title, explanation, factDim, sourceDim, aiDim, outcome, recheckWave: latest?.wave ?? 0 }
  }

  const views = issues.filter(isBrandIssue).map(view)
  return { view, views }
}
