import type { PublicationAttempt, Task, TargetPermission } from '@/data/types'

/*
  Simulated connector boundary (PRD v7 §6). Permission is modelled per target, never globally.
  Nothing here calls a real API; every outcome is deterministic and labelled simulated.
*/

export const PERMISSION_LABEL: Record<TargetPermission, string> = {
  connected_authorized: 'Connected · ProManage can publish after your approval',
  connected_read_only: 'Connected · read only',
  requires_site_admin: 'Needs your site admin',
  third_party_unmanaged: 'Independent site · request only',
  unsupported: 'Not supported',
}

export const STATE_LABEL: Record<PublicationAttempt['state'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'blue' }> = {
  success: { label: 'Updated (simulated)', tone: 'success' },
  pending: { label: 'Pending', tone: 'blue' },
  failed: { label: 'Failed — ProManage follow-up', tone: 'danger' },
  blocked: { label: 'Needs access', tone: 'warning' },
  manual_handoff: { label: 'External handoff', tone: 'warning' },
}

/** Seeded connector failures used to demonstrate partial publication honestly (first attempt only). */
const SEEDED_FAILURES: Record<string, string> = {
  'marathahalli:managed_listing': 'Listing connector credential expired (simulated). ProManage must re-authorise access before retrying.',
}

export function targetPermission(t: Pick<Task, 'channel' | 'recommendationId' | 'locationId'>): { permission: TargetPermission; reason: string } {
  if (t.channel === 'external_request') return { permission: 'third_party_unmanaged', reason: 'Independent site — ProManage can send a correction request; the site owner decides.' }
  if (t.channel === 'verification') return { permission: 'unsupported', reason: 'Business-fact verification is a Brand decision, not a publication.' }
  if (t.recommendationId === 'rec-freshness-sitemap') return { permission: 'requires_site_admin', reason: 'Sitemap and crawler settings need your site administrator; ProManage won’t change them automatically.' }
  if (t.channel === 'managed_listing') return { permission: 'connected_authorized', reason: 'Managed through ProManage Listing Management (simulated connector).' }
  return { permission: 'connected_authorized', reason: 'Centre page connected to ProManage’s CMS integration (simulated).' }
}

/** Deterministic outcome for one attempt. `attemptNo` starts at 1. */
export function simulateAttempt(t: Pick<Task, 'channel' | 'recommendationId' | 'locationId'>, attemptNo: number): Pick<PublicationAttempt, 'state' | 'detail' | 'permission'> {
  const { permission, reason } = targetPermission(t)
  if (permission === 'third_party_unmanaged') return { permission, state: 'manual_handoff', detail: 'Correction request prepared and sent by ProManage (simulated). Not marked updated until the site owner changes it.' }
  if (permission === 'requires_site_admin') return { permission, state: 'blocked', detail: reason }
  if (permission !== 'connected_authorized') return { permission, state: 'blocked', detail: reason }
  const fail = SEEDED_FAILURES[`${t.locationId}:${t.channel}`]
  if (fail && attemptNo === 1) return { permission, state: 'failed', detail: fail }
  return { permission, state: 'success', detail: `Demo: simulated publication via ProManage connector${attemptNo > 1 ? ' (retried after access was re-validated, same approval scope)' : ''}.` }
}

export type AggregateState = 'not_started' | 'success' | 'partial' | 'failed' | 'awaiting_access'

export function aggregate(attempts: PublicationAttempt[], taskIds: string[]): AggregateState {
  const latest = taskIds.map((id) => attempts.filter((a) => a.taskId === id).pop()).filter(Boolean) as PublicationAttempt[]
  if (!latest.length) return 'not_started'
  const ok = latest.filter((a) => a.state === 'success').length
  if (ok === latest.length) return 'success'
  if (ok > 0) return 'partial'
  if (latest.some((a) => a.state === 'failed')) return 'failed'
  return 'awaiting_access'
}

export const AGGREGATE_LABEL: Record<AggregateState, string> = {
  not_started: 'Not started',
  success: 'Connected sources updated; AI check pending',
  partial: 'Partially updated — some changes need ProManage follow-up',
  failed: 'Update failed — ProManage follow-up',
  awaiting_access: 'Waiting on external owners or access',
}
