import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Compass } from 'lucide-react'
import { AppStoreProvider, useStore } from '@/store/AppStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { ComingSoon } from '@/components/domain'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import OverviewPage from '@/pages/Overview'
import AuditsPage from '@/pages/Audits'
import NewAuditPage from '@/pages/NewAudit'
import AuditResultsPage from '@/pages/AuditResults'
import LocationsPage from '@/pages/Locations'
import LocationAnswersPage from '@/pages/LocationAnswers'
import IssuesPage from '@/pages/Issues'
import TasksPage from '@/pages/Tasks'
import MonitoringPage from '@/pages/Monitoring'
import ReportsPage from '@/pages/Reports'
import GeoReadinessPage from '@/pages/GeoReadiness'
import IssueSourcesPage from '@/pages/IssueSources'
import ListingRecordPage from '@/pages/ListingRecord'
import BrandOverview from '@/pages/brand/BrandOverview'
import BrandIssuePage, { BrandAttentionList } from '@/pages/brand/BrandAttention'
import BrandProgress from '@/pages/brand/BrandProgress'
import BrandLocations, { BrandLocationDetail } from '@/pages/brand/BrandLocations'
import BrandAuditResults from '@/pages/brand/BrandAuditResults'
import BrandInfoUpdates from '@/pages/brand/BrandInfoUpdates'
import BrandReports from '@/pages/brand/BrandReports'
import BrandDiscoveryPage from '@/pages/brand/BrandDiscovery'
import DetectPage from '@/pages/brand/Detect'
import ImprovePage from '@/pages/brand/Improve'
import MeasurePage from '@/pages/brand/Measure'
import DiscoveryInvestigationPage from '@/pages/DiscoveryInvestigation'
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'

/** Same route, role-appropriate screen. Both roles read the same records. */
function ByRole({ brand, promanage }: { brand: ReactNode; promanage: ReactNode }) {
  const { role } = useStore()
  return <>{role === 'brand' ? brand : promanage}</>
}

/** Brand deep links into technical screens land on the matching Brand view instead of a dead end. */
function BrandRedirect({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  const params = useParams()
  return <Navigate to={to(params)} replace />
}

function ProManageOnly({ title, back }: { title: string; back: { to: string; label: string } }) {
  return (
    <EmptyState
      icon={<Lock />}
      title={`${title} is handled by ProManage`}
      description="This technical view is part of ProManage’s workspace. You’ll see the outcome in your Progress and Business Information Updates."
      action={
        <Button variant="primary" asChild>
          <Link to={back.to}>{back.label}</Link>
        </Button>
      }
    />
  )
}

function V1Gate({ children, title }: { children: React.ReactNode; title: string }) {
  const { hasRelease } = useStore()
  if (hasRelease('V1')) return <>{children}</>
  return (
    <ComingSoon
      feature="issues-tasks"
      title={title}
      description="Triage the discrepancies that matter, assign corrections to the people who own each source, and track them through to a recheck."
      bullets={[
        'Evidence-driven issue inbox with a severity rubric',
        'GEO Readiness: verified facts, JSON-LD and fact sheets from approved data',
        'Side-by-side comparison of sampled answer and verified record',
        'Correction tasks with approval before any source change',
        'Updating a source never marks an AI answer as fixed',
      ]}
    />
  )
}

function V2Gate({ children }: { children: React.ReactNode }) {
  const { hasRelease } = useStore()
  if (hasRelease('V2')) return <>{children}</>
  return (
    <ComingSoon
      feature="monitoring"
      title="Monitoring & rechecks"
      description="Make improvements measurable and repeatable with matched-cohort rechecks — same locations, prompts, surface and evaluation rules."
      bullets={[
        'Weekly monitoring schedule for your audited cohort',
        'On-demand recheck with visible denominators',
        'Changed / unchanged / uncertain outcomes per issue',
        'Deduplicated alert queue and executive progress report',
      ]}
    />
  )
}

function NotFound() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="This page doesn't exist or has moved."
      action={
        <Button variant="primary" asChild>
          <Link to="/overview">Go to overview</Link>
        </Button>
      }
    />
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <TooltipProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<ByRole brand={<Navigate to="/detect" replace />} promanage={<Navigate to="/overview" replace />} />} />
              {/* v7 Brand workspace: three cumulative chapters. Internal ProManage routes below stay intact. */}
              <Route path="/detect" element={<DetectPage />} />
              <Route path="/improve" element={<ImprovePage />} />
              <Route path="/measure" element={<MeasurePage />} />
              <Route path="/overview" element={<ByRole brand={<BrandOverview />} promanage={<OverviewPage />} />} />
              <Route path="/audits" element={<AuditsPage />} />
              <Route path="/audits/new" element={<ByRole brand={<BrandRedirect to={() => '/overview?request=1'} />} promanage={<NewAuditPage />} />} />
              <Route path="/audits/:id" element={<ByRole brand={<BrandAuditResults />} promanage={<AuditResultsPage />} />} />
              <Route path="/locations" element={<ByRole brand={<BrandLocations />} promanage={<LocationsPage />} />} />
              <Route path="/locations/:id/answers" element={<ByRole brand={<BrandLocationDetail />} promanage={<LocationAnswersPage />} />} />
              <Route path="/attention" element={<ByRole brand={<BrandAttentionList />} promanage={<Navigate to="/issues" replace />} />} />
              <Route path="/attention/discovery/:id" element={<ByRole brand={<BrandDiscoveryPage />} promanage={<BrandRedirect to={(p) => `/discovery/${p.id}`} />} />} />
              <Route path="/discovery/:id" element={<ByRole brand={<BrandRedirect to={(p) => `/attention/discovery/${p.id}`} />} promanage={<DiscoveryInvestigationPage />} />} />
              <Route path="/attention/:id" element={<ByRole brand={<BrandIssuePage />} promanage={<BrandRedirect to={(p) => `/issues/${p.id}`} />} />} />
              <Route path="/progress" element={<ByRole brand={<BrandProgress />} promanage={<Navigate to="/tasks" replace />} />} />
              <Route path="/issues" element={<ByRole brand={<Navigate to="/attention" replace />} promanage={<IssuesPage />} />} />
              <Route path="/issues/:id" element={<ByRole brand={<BrandRedirect to={(p) => `/attention/${p.id}`} />} promanage={<V1Gate title="Investigation"><IssuesPage /></V1Gate>} />} />
              <Route path="/issues/:id/sources" element={<ByRole brand={<BrandRedirect to={(p) => `/attention/${p.id}`} />} promanage={<V1Gate title="Source comparison"><IssueSourcesPage /></V1Gate>} />} />
              <Route path="/listings/:locationId" element={<ByRole brand={<ProManageOnly title="Listing management" back={{ to: '/locations', label: 'My Locations' }} />} promanage={<V1Gate title="Managed listing"><ListingRecordPage /></V1Gate>} />} />
              <Route path="/tasks" element={<ByRole brand={<Navigate to="/progress" replace />} promanage={<V1Gate title="Tasks & Publishing"><TasksPage /></V1Gate>} />} />
              <Route path="/tasks/:id" element={<ByRole brand={<Navigate to="/progress" replace />} promanage={<V1Gate title="Tasks & Publishing"><TasksPage /></V1Gate>} />} />
              <Route path="/geo-readiness" element={<ByRole brand={<Navigate to="/locations" replace />} promanage={<V1Gate title="GEO Readiness"><GeoReadinessPage /></V1Gate>} />} />
              <Route path="/geo-readiness/:locationId" element={<ByRole brand={<V1Gate title="Business Information Updates"><BrandInfoUpdates /></V1Gate>} promanage={<V1Gate title="GEO Readiness"><GeoReadinessPage /></V1Gate>} />} />
              <Route path="/monitoring" element={<ByRole brand={<Navigate to="/progress" replace />} promanage={<V2Gate><MonitoringPage /></V2Gate>} />} />
              <Route path="/reports" element={<ByRole brand={<BrandReports />} promanage={<ReportsPage />} />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{ className: 'font-sans', style: { borderRadius: 10, border: '1px solid var(--border)' } }} />
      </TooltipProvider>
    </AppStoreProvider>
  )
}
