import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, Role } from '@/data/types'
import { PILOT_IDS } from '@/data/seed'
import { useStore, RELEASE_RANK } from '@/store/AppStore'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'
import { Switch } from '../ui/switch'

/*
  Presenter-only controls (release gate, role, data reset). Hidden from the
  product UI; toggle with ⌘/Ctrl + . or open with ?presenter in the URL.
*/

const KEY = 'promanage-presenter-open'

const RELEASES: { r: Release; weeks: string }[] = [
  { r: 'MVP', weeks: 'Weeks 1–4' },
  { r: 'V1', weeks: 'Weeks 5–8' },
  { r: 'V2', weeks: 'Weeks 9–12' },
]

const ROLES: { id: Role; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'promanage', label: 'ProManage' },
]

function readOpen() {
  try {
    return new URLSearchParams(window.location.search).has('presenter') || localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function PresenterPanel() {
  const { release, setRelease, role, setRole, audits, createAudit, resetDemo, showSimLabels, setShowSimLabels } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(readOpen)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '.' || e.code === 'Period')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onToggle = () => setOpen((o) => !o)
    window.addEventListener('keydown', onKey)
    window.addEventListener('presenter:toggle', onToggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('presenter:toggle', onToggle)
    }
  }, [])

  if (!open) return null

  const seg = (active: boolean) => cn('flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors', active ? 'bg-white text-ink shadow-card ring-1 ring-line' : 'text-muted hover:text-ink')

  return (
    <div className="no-print fixed bottom-4 left-4 z-[60] w-[300px] animate-pop-in rounded-xl border border-line bg-surface shadow-pop lg:left-[248px]" role="region" aria-label="Presenter controls">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[12.5px] font-semibold text-ink">Presenter controls</p>
        <div className="flex items-center gap-2">
          <kbd className="rounded border border-line bg-subtle px-1.5 text-[10.5px] text-muted">⌘ .</kbd>
          <button onClick={() => setOpen(false)} className="rounded p-0.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Hide presenter controls">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="space-y-4 px-4 py-3.5">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Release</p>
          <div role="radiogroup" aria-label="Release" className="flex gap-0.5 rounded-lg border border-line bg-subtle p-0.5">
            {RELEASES.map(({ r, weeks }) => (
              <button
                key={r}
                role="radio"
                aria-checked={release === r}
                className={seg(release === r)}
                onClick={() => {
                  if (r === release) return
                  setRelease(r)
                  toast(`${r} features ${RELEASE_RANK[r] > 0 ? 'enabled' : 'only'}`, { description: weeks })
                }}
              >
                <span className="block leading-tight">{r}</span>
                <span className="block text-[10px] font-normal leading-tight text-muted">{weeks}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Signed in as</p>
          <div role="radiogroup" aria-label="Role" className="flex gap-0.5 rounded-lg border border-line bg-subtle p-0.5">
            {ROLES.map((r) => (
              <button key={r.id} role="radio" aria-checked={role === r.id} className={seg(role === r.id)} onClick={() => setRole(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-[12.5px] text-body">
          <span>
            <span className="block font-medium text-ink">Simulation labels</span>
            <span className="block text-[11.5px] text-muted">Mark sampled data as simulated across the UI</span>
          </span>
          <Switch checked={showSimLabels} onCheckedChange={setShowSimLabels} aria-label="Show simulation labels" />
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={audits.length > 0}
            onClick={() => {
              const a = createAudit({ name: 'Bengaluru pilot — baseline', locationIds: PILOT_IDS, promptIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], mode: role === 'promanage' ? 'assisted' : 'self-serve' })
              navigate(`/audits/${a.id}`)
            }}
          >
            <Download />
            Load pilot audit
          </Button>
          <Button size="sm" className="flex-1" onClick={() => setConfirmReset(true)}>
            <RotateCcw />
            Reset data
          </Button>
        </div>
      </div>
      <Dialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all data?"
        description="Clears audits, reviews, tasks and rechecks saved in this browser and returns to the first-run state."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo()
                setConfirmReset(false)
                navigate('/overview')
                toast.success('Data reset')
              }}
            >
              Reset
            </Button>
          </>
        }
      />
    </div>
  )
}
