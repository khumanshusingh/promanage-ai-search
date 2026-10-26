import { useMemo } from 'react'
import { LOCATION_BY_ID, ORG, SURFACES } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { useDiscovery } from './useDiscovery'
import { FIELD_PHRASE, useBrandViews } from './brandStatus'
import { buildReportSnapshot, type FlaggedFinding, type ReportInput, type ReportRow, type ReportSnapshot } from './reportMetrics'

/** Adapts the selected audit's baseline records (never follow-up waves) into the shared report model. */
export function useReportInput(auditId: string | undefined): ReportInput | null {
  const { audits, observationsFor, promptsById } = useStore()
  const disc = useDiscovery()
  const { views } = useBrandViews()
  return useMemo(() => {
    const audit = audits.find((a) => a.id === auditId)
    if (!audit) return null
    const obs = observationsFor(audit.id, 0)
    const rows: ReportRow[] = obs.map((o) => {
      const p = promptsById[o.promptId]
      const discovery = !!p?.includeInDiscoveryMetric
      const el = discovery ? disc.eligibility(o.locationId, o.promptId) : null
      return {
        locationId: o.locationId,
        questionId: o.promptId,
        question: o.query,
        category: discovery ? 'discovery' : 'factual',
        sampledAt: o.sampledAt,
        answer: o.answerText,
        citations: o.citations,
        mentioned: discovery ? o.mentioned : undefined,
        eligibility: el?.status,
        relevanceBasis: el?.basis,
        intent: p?.category,
        claims: discovery ? [] : o.extractedClaims.map((c) => ({ label: c.label, value: c.value, expected: c.expected, evaluation: c.evaluation })),
      }
    })
    const flagged: FlaggedFinding[] = views
      .filter((v) => v.issue.auditId === audit.id && v.stage !== 'not_an_issue')
      .map((v) => {
        const o = obs.find((x) => x.id === v.issue.observationId)
        const claim = o?.extractedClaims.find((c) => c.id === v.issue.claimId)?.value
        const verified = v.fact?.verificationStatus === 'verified'
        const status = v.issue.entityConfusion ? 'confusion' : claim && v.issue.field ? (verified ? 'confirmed' : 'verify') : 'review'
        return {
          id: v.issue.id,
          locationId: v.issue.locationId,
          question: o?.query ?? '',
          status,
          severity: v.issue.severity,
          fieldPhrase: v.issue.field ? (FIELD_PHRASE[v.issue.field] ?? v.issue.field) : 'information',
          aiSaid: claim,
          record: verified ? v.fact!.value : null,
          mixedUpWith: v.issue.entityConfusion,
        }
      })
    return {
      brandId: ORG.id,
      brandName: ORG.name,
      totalLocations: ORG.totalLocationCount,
      auditId: audit.id,
      auditTitle: audit.name,
      auditedAt: audit.createdAt,
      surfaceLabel: `Demo AI search (${SURFACES.A.short})`,
      simulated: audit.simulated,
      locations: audit.locationIds.filter((id) => LOCATION_BY_ID[id]).map((id) => ({ id, name: LOCATION_BY_ID[id].name, neighborhood: LOCATION_BY_ID[id].neighborhood, city: LOCATION_BY_ID[id].city })),
      questionTemplates: audit.promptIds
        .map((id) => promptsById[id])
        .filter(Boolean)
        .map((p) => ({ id: p.id, template: p.text.replace(/\{neighborhood\}/g, '{centre area}').replace(/\{city\}/g, '{city}'), category: p.includeInDiscoveryMetric ? ('discovery' as const) : ('factual' as const) })),
      rows,
      flagged,
    }
  }, [audits, auditId, observationsFor, promptsById, disc, views])
}

export function useReportSnapshot(auditId: string | undefined, scopeLocationIds?: string[]): ReportSnapshot | null {
  const input = useReportInput(auditId)
  const key = scopeLocationIds?.join(',') ?? ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (input ? buildReportSnapshot(input, scopeLocationIds) : null), [input, key])
}
