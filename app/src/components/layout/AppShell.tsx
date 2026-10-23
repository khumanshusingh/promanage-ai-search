import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as DM from '@radix-ui/react-dropdown-menu'
import { BarChart3, Building2, Check, ChevronDown, ClipboardCheck, FileText, Inbox, LayoutDashboard, LineChart, ListChecks, Menu, MapPin, MessagesSquare, PhoneCall, RadioTower, ScanSearch, SlidersHorizontal, Sparkles, Star, UserRound, X } from 'lucide-react'
import { useBrandViews } from '@/lib/brandStatus'
import { useDiscovery } from '@/lib/useDiscovery'
import { toast } from 'sonner'
import type { DemoChapter, Release } from '@/data/types'
import { ORG, PEOPLE, ROLE_PERSON } from '@/data/seed'
import { useStore } from '@/store/AppStore'
import { cn } from '@/lib/utils'
import { PresenterPanel } from './PresenterPanel'

type NavItem = { to: string; label: string; icon: ReactNode; release?: Release }

/** Brand: business decisions only. No technical destinations in any phase. */
const BRAND_NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: <LayoutDashboard /> },
  { to: '/locations', label: 'My Locations', icon: <MapPin /> },
  { to: '/attention', label: 'Needs My Attention', icon: <Inbox /> },
  { to: '/progress', label: 'Progress', icon: <ListChecks /> },
  { to: '/reports', label: 'Reports', icon: <FileText /> },
]

/** ProManage: full operational workspace. */
const PROMANAGE_NAV: NavItem[] = [
  { to: '/overview', label: 'Client Overview', icon: <LayoutDashboard /> },
  { to: '/audits', label: 'Audit Operations', icon: <ScanSearch /> },
  { to: '/issues', label: 'Investigations', icon: <Inbox /> },
  { to: '/locations', label: 'Data Sources & Listings', icon: <MapPin /> },
  { to: '/geo-readiness', label: 'GEO Readiness', icon: <Sparkles />, release: 'V1' },
  { to: '/tasks', label: 'Tasks & Publishing', icon: <ClipboardCheck />, release: 'V1' },
  { to: '/monitoring', label: 'Monitoring', icon: <RadioTower />, release: 'V2' },
  { to: '/reports', label: 'Reports', icon: <FileText /> },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-teal text-white">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M10 23V9h7.2a5 5 0 0 1 0 10H14" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
        Pro<span className="text-teal-ink">Manage</span>
      </span>
    </div>
  )
}

const PRODUCTS = [
  { name: 'Merlin AI', tagline: 'A chatbot that speaks your brand', icon: <MessagesSquare /> },
  { name: 'Midas AI', tagline: 'Turn calls into opportunities', icon: <PhoneCall /> },
  { name: 'Monitor AI', tagline: 'See where you stand', icon: <LineChart /> },
  { name: 'Marvel AI', tagline: 'Get more reviews, more easily', icon: <Star /> },
]

/** AI Visibility ships as a module inside Monitor AI; sibling products are listed but not part of this demo. */
function ProductSwitcher() {
  return (
    <DM.Root>
      <DM.Trigger className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-gradient-to-br from-[#eef4ff] to-white px-3 py-2.5 text-left hover:border-[#c9d6ee]" aria-label="Switch product">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#3b6cff] to-[#5aa0ff] text-white [&_svg]:size-[17px]">
          <LineChart />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[14px] font-semibold text-ink">Monitor AI</span>
          <span className="block truncate text-[11.5px] text-muted">Search visibility</span>
        </span>
        <ChevronDown className="size-4 text-muted" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" sideOffset={6} className="z-50 w-[248px] animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
          <DM.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">ProManage products</DM.Label>
          {PRODUCTS.map((p) => (
            <MenuItem key={p.name} checked={p.name === 'Monitor AI'} onSelect={p.name === 'Monitor AI' ? undefined : () => toast(`${p.name} isn’t part of this demo`)}>
              <span className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:text-muted">
                {p.icon}
                <span className="leading-tight">
                  <span className="block text-ink">{p.name}</span>
                  <span className="block text-[11.5px] text-muted">{p.tagline}</span>
                </span>
              </span>
            </MenuItem>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRelease, issues, inScope, tasks, role, investigations, plans, checkRequests } = useStore()
  const disc = useDiscovery()
  const brand = role === 'brand'
  const NAV = brand ? BRAND_NAV : PROMANAGE_NAV
  const openIssues = issues.filter((i) => inScope(i.locationId)).length
  const openTasks = tasks.filter((t) => t.status !== 'closed').length
  const pmQueue = Object.values(investigations).filter((i) => i.status === 'in_progress').length + Object.values(plans).filter((p) => p.status === 'changes_requested').length + checkRequests.filter((r) => r.status === 'requested').length
  const counts: Record<string, number | undefined> = brand
    ? { '/attention': Object.values(plans).filter((p) => p.status === 'awaiting_brand_approval').length + disc.latest.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length || undefined }
    : { '/issues': openIssues || undefined, '/tasks': openTasks || undefined, '/overview': pmQueue || undefined }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[60px] items-center border-b border-line px-5">
        <Wordmark />
      </div>
      <div className="px-3 pt-4">
        <ProductSwitcher />
        <div className="mt-3 space-y-0.5">
          <span className="flex h-9 cursor-default items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-[#98a4b5] [&_svg]:size-[17px]" title="Existing Monitor AI module — not part of this demo">
            <BarChart3 />
            <span className="flex-1">Search Rankings</span>
          </span>
        </div>
        <p className="mt-4 flex items-center gap-2 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a97a9]">
          AI Visibility
          <span className="rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal text-brand">New</span>
          {!brand && <span className="ml-auto text-[10.5px] font-medium normal-case tracking-normal">Ops</span>}
        </p>
      </div>
      {brand ? (
        <ChapterNav onNavigate={onNavigate} awaiting={counts['/attention']} />
      ) : (
      <nav className="flex-1 space-y-0.5 px-3" aria-label="AI Visibility">
        {NAV.map((item) => {
          const locked = item.release && !hasRelease(item.release)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors duration-150 [&_svg]:size-[17px]',
                  isActive ? 'bg-brand-soft text-brand' : 'text-body hover:bg-[#f1f4f9] hover:text-ink',
                  locked && !isActive && 'text-[#98a4b5]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r-full bg-brand" />}
                  {item.icon}
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {locked ? (
                    <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-body ring-1 ring-line">Later phase</span>
                  ) : counts[item.to] ? (
                    <span className="tabular rounded-full bg-[#eef2f7] px-1.5 text-[11.5px] font-semibold text-body">{counts[item.to]}</span>
                  ) : null}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
      )}
    </div>
  )
}

const CHAPTERS: { to: string; n: DemoChapter; label: string; tag: Release; icon: ReactNode; blurb: string }[] = [
  { to: '/detect', n: 1, label: 'Detect', tag: 'MVP', icon: <ScanSearch />, blurb: 'What AI says about your centres' },
  { to: '/improve', n: 2, label: 'Improve', tag: 'V1', icon: <Sparkles />, blurb: 'Review & authorize changes' },
  { to: '/measure', n: 3, label: 'Measure', tag: 'V2', icon: <ListChecks />, blurb: 'What AI said afterward' },
]

/** Three always-clickable chapters; the first click on a chapter unlocks it cumulatively (never approves anything). */
function ChapterNav({ onNavigate, awaiting }: { onNavigate?: () => void; awaiting?: number }) {
  const { hasRelease } = useStore()
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="AI Visibility chapters">
      {CHAPTERS.map((c) => {
        const unlocked = hasRelease(c.tag)
        return (
          <NavLink
            key={c.to}
            to={c.to}
            onClick={onNavigate}
            className={({ isActive }) => cn('group relative flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors duration-150 [&_svg]:mt-0.5 [&_svg]:size-[17px]', isActive ? 'bg-brand-soft text-brand' : 'text-body hover:bg-[#f1f4f9] hover:text-ink')}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute -left-3 top-2 h-7 w-[3px] rounded-r-full bg-brand" />}
                {c.icon}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                    <span className="tabular text-muted">0{c.n} ·</span> {c.label}
                    <span className={cn('rounded px-1 py-px text-[10px] font-semibold', unlocked ? 'bg-teal-soft text-teal-ink' : 'bg-subtle text-muted ring-1 ring-line')}>{c.tag}</span>
                  </span>
                  <span className="block text-[11.5px] font-normal text-muted">{unlocked ? c.blurb : 'Click to unlock'}</span>
                </span>
                {c.n === 2 && unlocked && awaiting ? <span className="tabular mt-0.5 rounded-full bg-[#eef2f7] px-1.5 text-[11.5px] font-semibold text-body">{awaiting}</span> : null}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function MenuItem({ children, onSelect, checked, disabled }: { children: ReactNode; onSelect?: () => void; checked?: boolean; disabled?: boolean }) {
  return (
    <DM.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-body outline-none data-[disabled]:cursor-default data-[highlighted]:bg-subtle data-[disabled]:opacity-60 data-[highlighted]:text-ink"
    >
      <span className="flex-1">{children}</span>
      {checked && <Check className="size-4 text-brand" />}
    </DM.Item>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { role } = useStore()
  const navigate = useNavigate()
  const person = PEOPLE.find((p) => p.id === ROLE_PERSON[role])!
  const initials = person.name.split(' ').map((s) => s[0]).join('')

  return (
    <header className="no-print sticky top-0 z-30 flex h-[60px] items-center gap-2 sm:gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6">
      <button className="rounded-md p-1.5 text-body hover:bg-subtle lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <div className="hidden sm:block lg:hidden">
        <Wordmark />
      </div>

      <DM.Root>
        <DM.Trigger className="hidden items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left hover:bg-subtle md:flex">
          <span className="grid size-6 place-items-center rounded-md bg-[#fff4e5] text-[11px] font-bold text-[#b45f06]">BN</span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-ink">{ORG.name}</span>
            <span className="block text-[11px] text-muted">{ORG.totalLocationCount} locations · Demo</span>
          </span>
          <ChevronDown className="size-4 text-muted" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="start" sideOffset={6} className="z-50 w-64 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
            <DM.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Accounts</DM.Label>
            <MenuItem checked onSelect={() => navigate('/locations')}>
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-muted" />
                {ORG.name}
              </span>
            </MenuItem>
          </DM.Content>
        </DM.Portal>
      </DM.Root>

      <div className="flex-1" />
      <button
        onClick={() => window.dispatchEvent(new Event('presenter:toggle'))}
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
        aria-label="Presenter controls (⌘ .)"
        title="Presenter controls (⌘ .)"
      >
        <SlidersHorizontal className="size-4" />
      </button>

      <DM.Root>
        <DM.Trigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-subtle" aria-label="Account menu">
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-[13px] font-semibold text-ink">{person.name}</span>
            <span className="block text-[11px] text-muted">{role === 'brand' ? 'Brand' : 'ProManage'}</span>
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-brand text-[12px] font-semibold text-white">{initials}</span>
          <ChevronDown className="hidden size-4 text-muted sm:block" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={6} className="z-50 w-72 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
            <div className="flex items-center gap-2.5 border-b border-line px-2.5 pb-2.5 pt-1.5">
              <UserRound className="size-4 text-muted" />
              <div className="leading-tight">
                <p className="text-[13px] font-semibold text-ink">{person.name}</p>
                <p className="text-[12px] text-muted">
                  {person.title}
                  {person.region ? ` · ${person.region}` : ''}
                </p>
              </div>
            </div>
            <MenuItem onSelect={() => window.dispatchEvent(new Event('presenter:toggle'))}>
              <span className="block text-ink">Demo settings</span>
              <span className="block text-[11.5px] text-muted">Reset demo · internal workspace</span>
            </MenuItem>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
    </header>
  )
}

/** Brand scope, simulated label and independent Discovery / Accuracy / approval counts, with a path back to the standard check. */
function BrandStatusBar() {
  const { role, latestAudit, hasRelease, plans, issues, selectedGoalId, goals, selectGoal } = useStore()
  const { views } = useBrandViews()
  const disc = useDiscovery()
  if (role !== 'brand' || !latestAudit) return null
  // Opportunities = eligible questions where the centre wasn't mentioned (awaiting-confirmation ones aren't counted).
  const opps = disc.latest.reduce((n, o) => n + o.targetPromptIds.filter((p) => disc.eligibility(o.locationId, p).status === 'eligible').length, 0)
  const acc = views.filter((v) => v.issue.auditId === latestAudit.id && v.stage !== 'not_an_issue').length
  const awaiting = issues.filter((i) => i.auditId === latestAudit.id && plans[i.id]?.status === 'awaiting_brand_approval').length + disc.latest.filter((o) => disc.record(o.id)?.plan?.status === 'awaiting_brand_approval').length
  const goal = goals.find((g) => g.id === selectedGoalId)
  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-surface/70 px-4 py-2 text-[12.5px] text-body sm:px-6 lg:px-8">
      <span className="font-medium text-ink">{goal ? `Focused: “${goal.anchorQuestion}”` : 'All locations · All findings · Latest standard check'}</span>
      {goal && (
        <button className="font-medium text-brand hover:underline" onClick={() => selectGoal(null)}>
          Back to standard check
        </button>
      )}
      <span className="rounded-full bg-teal-soft px-2 py-0.5 font-medium text-teal-ink">{opps} discovery opportunities</span>
      <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">{acc} accuracy findings</span>
      {hasRelease('V1') && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">{awaiting} need your approval</span>}
      <span className="ml-auto flex flex-wrap items-center gap-3">
        <NavLink className="hover:text-ink hover:underline" to="/detect#locations">Choose locations</NavLink>
        <NavLink className="hover:text-ink hover:underline" to={`/audits/${latestAudit.id}`}>View evidence</NavLink>
        <NavLink className="hover:text-ink hover:underline" to="/reports">Download report</NavLink>
        {hasRelease('V1') && <NavLink className="hover:text-ink hover:underline" to="/improve#history">Approval history</NavLink>}
        <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-line">Simulated prototype</span>
      </span>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[232px] border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-[#0f1b2d]/35" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] animate-slide-in-right border-r border-line bg-surface">
            <button className="absolute right-3 top-4 rounded-md p-1 text-muted hover:bg-subtle" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-[232px] print:pl-0">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <BrandStatusBar />
        <PresenterPanel />
        <main className="print-full mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
        <footer className="no-print border-t border-line px-4 py-4 text-center text-[12px] text-muted sm:px-6 lg:px-8">
          Concept prototype by Khumanshu Singh for a ProManage product roadmap assignment · fictional brand and simulated data · not an official ProManage product
        </footer>
      </div>
    </div>
  )
}
