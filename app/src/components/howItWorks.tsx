import { BadgeCheck, Building2, CheckCircle2, FileText, Globe, ListChecks, MapPin, MessageSquareText, ScanSearch, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
  Start-screen explainer: a minimal, illustrated walk through Detect → Improve → Measure.
  Purely illustrative (no live data); the mini visuals mirror the real screens.
*/

function Step({ n, title, tag, accent, children, caption }: { n: number; title: string; tag: string; accent: string; children: ReactNode; caption: string }) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-line bg-surface/90 p-4 shadow-card backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={cn('grid size-6 place-items-center rounded-full text-[11.5px] font-semibold text-white', accent)}>{n}</span>
        <p className="text-[14.5px] font-semibold text-ink">{title}</p>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[10.5px] text-muted">{tag}</span>
      </div>
      <div className="mt-3 flex-1 rounded-xl border border-line bg-gradient-to-b from-[#f8faff] to-white p-3">{children}</div>
      <p className="mt-3 text-[13px] leading-relaxed text-body">{caption}</p>
    </div>
  )
}

const Bar = ({ w, tone = 'bg-[#e6ebf3]' }: { w: string; tone?: string }) => <span className={cn('block h-1.5 rounded-full', tone)} style={{ width: w }} />

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-6 sm:px-8 sm:py-8">
      {/* soft grid + glow, Stripe-style */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-[#e9eef7]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hiw-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <radialGradient id="hiw-glow" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#2a5efe" stopOpacity="0.10" />
            <stop offset="55%" stopColor="#00c1d5" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hiw-grid)" />
        <rect width="100%" height="100%" fill="url(#hiw-glow)" />
      </svg>

      <div className="relative">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-brand">How AI Visibility works</p>
        <h2 id="how-it-works" className="mt-1.5 max-w-[640px] text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">From what AI tells parents to what your centres publish</h2>
        <p className="mt-1.5 max-w-[640px] text-[14px] text-body">Three steps, one loop. ProManage does the investigation and the technical work; you review and approve.</p>

        <div className="relative mt-6">
          {/* connector line behind the cards (desktop) */}
          <div aria-hidden className="absolute left-[8%] right-[8%] top-[38px] hidden h-px bg-gradient-to-r from-brand via-teal to-[#7c5cff] opacity-50 md:block" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Step n={1} title="Detect" tag="MVP" accent="bg-brand" caption="We ask AI the questions parents ask, for every centre, and show where you’re missing or described wrongly.">
              <div className="flex items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <MessageSquareText className="size-3.5" />
                </span>
                <span className="rounded-lg rounded-tl-sm bg-brand px-2.5 py-1.5 text-[12px] text-white">Best Montessori preschools in Whitefield?</span>
              </div>
              <div className="mt-2.5 space-y-1.5 rounded-lg border border-line bg-white p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  <ScanSearch className="size-3.5" />
                  Sampled AI answer
                </p>
                <Bar w="88%" />
                <Bar w="72%" />
                <Bar w="80%" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-full border border-[#bfeef3] bg-teal-soft px-2 py-0.5 text-[10.5px] font-medium text-teal-ink">Your centre not mentioned</span>
                  <span className="rounded-full border border-[#f2c9ce] bg-danger-soft px-2 py-0.5 text-[10.5px] font-medium text-danger">Wrong: “No Saturday tours”</span>
                </div>
              </div>
            </Step>

            <Step n={2} title="Improve" tag="V1" accent="bg-teal" caption="ProManage prepares fixes from your verified data: page content, Q&As, listings and requests to other sites. You approve once.">
              <ul className="space-y-1.5">
                {[
                  { icon: <Globe className="size-3.5" />, label: 'Centre page', note: 'Q&A added', done: true },
                  { icon: <MapPin className="size-3.5" />, label: 'Google Business Profile', note: 'Montessori listed', done: true },
                  { icon: <FileText className="size-3.5" />, label: 'Independent directory', note: 'Request drafted', done: false },
                ].map((r) => (
                  <li key={r.label} className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px]">
                    <span className="text-muted">{r.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', r.done ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{r.note}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-brand-soft/70 px-2.5 py-1.5">
                <span className="text-[11px] text-body">3 changes ready</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[10.5px] font-medium text-white">
                  <ShieldCheck className="size-3" />
                  Approve
                </span>
              </div>
            </Step>

            <Step n={3} title="Measure" tag="V2" accent="bg-[#7c5cff]" caption="When you’re ready, run a follow-up check with the same questions and centres, and compare before and after.">
              <div className="flex items-end justify-center gap-5 px-2 pt-1">
                {[
                  { label: 'Before', h: 46, tone: 'bg-[#d5dce7]' },
                  { label: 'After', h: 70, tone: 'bg-gradient-to-t from-brand to-[#7c5cff]' },
                ].map((b) => (
                  <div key={b.label} className="flex flex-col items-center gap-1">
                    <span className={cn('block w-10 rounded-t-md', b.tone)} style={{ height: b.h }} />
                    <span className="text-[10.5px] text-muted">{b.label}</span>
                  </div>
                ))}
                <span className="mb-6 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-medium text-success">
                  <TrendingUp className="size-3" />
                  more mentions
                </span>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
                <CheckCircle2 className="size-3.5 text-success" />
                Follow-up check · same questions, same centres
              </p>
            </Step>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-line bg-white/80 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Sparkles className="size-3.5 text-teal-ink" />
            Powered by what ProManage already manages for your centres
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { icon: <BadgeCheck className="size-3.5" />, label: 'Verified business facts' },
              { icon: <MapPin className="size-3.5" />, label: 'Listings' },
              { icon: <Star className="size-3.5" />, label: 'Genuine reviews' },
              { icon: <Building2 className="size-3.5" />, label: 'Location data' },
              { icon: <ListChecks className="size-3.5" />, label: 'Local content' },
            ].map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-body">
                <span className="text-brand">{c.icon}</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
