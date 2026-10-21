import { useCallback, useMemo } from 'react'
import type { DiscoveryOpportunity, DiscoveryRecheck, DiscoveryStatus, Observation, Task } from '@/data/types'
import { useStore } from '@/store/AppStore'
import { compareDiscovery, deriveOpportunities, discoveryMetrics, eligibilityFor, isUnbranded, readinessFindings, anyUpdateRecordedAt, type FindingWithDraft } from './discovery'

/** Shared discovery selectors. Both roles read the same derived records. */
export function useDiscovery() {
  const { audits, latestAudit, observationsFor, promptsById, discoveryEligibility, discovery, factEdits, tasks, release, rechecksFor, hasRelease } = useStore()

  const ctx = useMemo(() => ({ prompts: promptsById, eligibility: discoveryEligibility, factEdits, records: discovery, tasks, release }), [promptsById, discoveryEligibility, factEdits, discovery, tasks, release])

  const base = useMemo(() => audits.flatMap((a) => deriveOpportunities(a, observationsFor(a.id, 0), ctx)), [audits, observationsFor, ctx])

  const eligibleSet = useCallback(
    (opp: DiscoveryOpportunity) => new Set(observationsFor(opp.auditId, 0).filter((o) => o.locationId === opp.locationId && isUnbranded(o, promptsById) && eligibilityFor(o.locationId, promptsById[o.promptId], discoveryEligibility, factEdits).status === 'eligible').map((o) => o.promptId)),
    [observationsFor, promptsById, discoveryEligibility, factEdits],
  )

  /** Matched comparison against the latest follow-up wave (V2 only). */
  const recheckFor = useCallback(
    (opp: DiscoveryOpportunity): DiscoveryRecheck | null => {
      if (!hasRelease('V2')) return null
      const waves = rechecksFor(opp.auditId)
      const last = waves[waves.length - 1]
      if (!last) return null
      return compareDiscovery(opp, observationsFor(opp.auditId, 0), observationsFor(opp.auditId, last.wave), last, eligibleSet(opp), anyUpdateRecordedAt(discovery[opp.id], tasks))
    },
    [hasRelease, rechecksFor, observationsFor, eligibleSet, discovery, tasks],
  )

  const opportunities = useMemo(
    () =>
      base.map((o) => {
        if (o.status !== 'awaiting_recheck') return o
        const rc = recheckFor(o)
        return rc?.afterUpdates ? { ...o, status: 'rechecked' as DiscoveryStatus } : o
      }),
    [base, recheckFor],
  )

  const byId = useMemo(() => Object.fromEntries(opportunities.map((o) => [o.id, o])), [opportunities])
  const latest = useMemo(() => opportunities.filter((o) => o.auditId === latestAudit?.id), [opportunities, latestAudit])

  const findingsFor = useCallback((opp: DiscoveryOpportunity): FindingWithDraft[] => {
    const inv = discovery[opp.id]?.investigation
    if (!inv?.checkedAt) return []
    return readinessFindings(opp, factEdits, inv.checkedAt)
  }, [discovery, factEdits])

  const tasksFor = useCallback((opp: DiscoveryOpportunity): Task[] => tasks.filter((t) => t.opportunityId === opp.id), [tasks])

  const observationsOf = useCallback(
    (opp: Pick<DiscoveryOpportunity, 'auditId' | 'locationId'>, wave = 0): Observation[] => observationsFor(opp.auditId, wave).filter((o) => o.locationId === opp.locationId && isUnbranded(o, promptsById)),
    [observationsFor, promptsById],
  )

  const eligibility = useCallback((locationId: string, promptId: string) => eligibilityFor(locationId, promptsById[promptId], discoveryEligibility, factEdits), [promptsById, discoveryEligibility, factEdits])

  const metricsFor = useCallback((auditId: string, wave = 0) => discoveryMetrics(observationsFor(auditId, wave), ctx), [observationsFor, ctx])

  return { opportunities, latest, byId, findingsFor, tasksFor, observationsOf, eligibility, eligibleSet, recheckFor, metricsFor, record: (id: string) => discovery[id] }
}

/** The Brand needs to act: confirm a service ProManage asked about, or decide on suggested improvements. */
export function brandNeedsAction(opp: DiscoveryOpportunity, confirmRequested: boolean) {
  return opp.status === 'awaiting_approval' || (confirmRequested && (opp.status === 'eligibility_review' || opp.status === 'observed' || opp.status === 'investigating'))
}
