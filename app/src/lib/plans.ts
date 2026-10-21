import type { FactEdit, Issue, PlanItem, SourceRecord } from '@/data/types'
import { channelTarget, FIELD_LABELS, LOCATION_BY_ID } from '@/data/seed'
import { effectiveLocation } from './facts'

const PHRASE: Record<string, string> = { hours: 'opening hours', phone: 'phone number', address: 'address', saturdayTours: 'Saturday tour information', operatingStatus: 'open / closed status', programs: 'programmes offered' }

/** Draft a plain-language accuracy correction plan from the source comparison. Owners and limits are explicit. */
export function suggestPlan(issue: Issue, sources: SourceRecord[], factEdits: Record<string, FactEdit>) {
  const loc = LOCATION_BY_ID[issue.locationId]
  const verified = issue.field ? effectiveLocation(issue.locationId, factEdits).verifiedFields[issue.field].value : null
  const phrase = issue.field ? (PHRASE[issue.field] ?? FIELD_LABELS[issue.field].toLowerCase()) : 'information'
  const bad = (ch: SourceRecord['channel']) => sources.find((s) => s.channel === ch && issue.field && !s.inaccessible && s.values[issue.field] != null && s.values[issue.field] !== verified)
  const items: PlanItem[] = []
  const where: string[] = []
  if (bad('owned_website')) {
    where.push('your official website')
    items.push({ id: 'web', kind: 'owned_website', title: 'Update the official centre page', owner: 'BrightNest website team', detail: channelTarget('owned_website', issue.locationId) })
    items.push({ id: 'struct', kind: 'structured_info', title: 'Prepare search-readable store information', owner: 'ProManage', detail: 'Verified fact sheet and structured data for the centre page' })
  }
  if (bad('managed_listing')) {
    where.push('your Google Business Profile')
    items.push({ id: 'listing', kind: 'managed_listing', title: 'Update your Google Business Profile', owner: 'ProManage Listing Management', detail: channelTarget('managed_listing', issue.locationId) })
  }
  const dir = bad('external_directory')
  if (dir) {
    where.push(`an independent directory (${dir.label})`)
    items.push({ id: 'dir', kind: 'external_request', title: `Request a correction from ${dir.label}`, owner: 'ProManage', detail: channelTarget('external_request', issue.locationId) })
  }
  const why = where.length
    ? `An AI answer gave the wrong ${phrase} for ${loc.name}. We found inconsistent ${phrase} on ${where.join(' and ')}.`
    : `An AI answer gave the wrong ${phrase} for ${loc.name}. The sources we checked match your information.`
  return { items, why }
}
