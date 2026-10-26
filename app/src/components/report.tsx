import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileDown, Loader2, RotateCcw } from 'lucide-react'
import { useStore } from '@/store/AppStore'
import { useReportSnapshot } from '@/lib/useReportSnapshot'
import { formatScore } from '@/lib/reportMetrics'
import type { ReportEdition } from '@/lib/reportPdf'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { cn, fmtDate } from '@/lib/utils'

type Status = { kind: 'idle' } | { kind: 'generating' } | { kind: 'done'; filename: string; pages: number } | { kind: 'error'; message: string }

/** Download the Executive AI Visibility Report (PRD v9) for one completed baseline audit. Read-only: it never changes app data. */
export function ReportDialog({ open, onOpenChange, auditId: initialAuditId }: { open: boolean; onOpenChange: (o: boolean) => void; auditId: string }) {
  const { audits, logEvent } = useStore()
  const navigate = useNavigate()
  const [auditId, setAuditId] = useState(initialAuditId)
  const [edition, setEdition] = useState<ReportEdition>('executive')
  const [scope, setScope] = useState<string[] | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const busy = useRef(false)
  useEffect(() => {
    if (open) {
      setAuditId(initialAuditId)
      setScope(null)
      setStatus({ kind: 'idle' })
    }
  }, [open, initialAuditId])
  const full = useReportSnapshot(auditId)
  const snap = useReportSnapshot(auditId, scope ?? undefined)
  if (!full || !snap) return null
  const selected = scope ?? full.locations.map((l) => l.id)

  const generate = async () => {
    if (busy.current) return // rapid clicks produce one download
    busy.current = true
    setStatus({ kind: 'generating' })
    logEvent(`executive_report_export_started · ${snap.auditId} · ${edition} · ${snap.locations.length} centres`)
    try {
      const w = window as unknown as { __pmFailNextReport?: boolean }
      if (w.__pmFailNextReport) {
        w.__pmFailNextReport = false
        throw new Error('Simulated generation failure (test hook)')
      }
      const { renderReportPdf } = await import('@/lib/reportPdf')
      const { blob, filename, pages } = renderReportPdf(snap, edition)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setStatus({ kind: 'done', filename, pages })
      logEvent(`executive_report_download_completed · ${snap.auditId} · ${edition} · ${pages} pages`)
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
      logEvent(`executive_report_export_failed · ${snap.auditId} · ${edition}`)
    } finally {
      busy.current = false
    }
  }

  const done = status.kind === 'done'
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-[640px]"
      title="Download AI Visibility Report"
      description="A leadership-ready PDF built from this check: scope, Discoverability and Accuracy scores, centre-level results, the questions tested and their limitations."
      footer={
        <>
          <span className="mr-auto self-center text-[12.5px] text-muted">Includes simulated audit data and the specific questions evaluated.</span>
          <Button onClick={() => onOpenChange(false)}>{done ? 'Close' : 'Cancel'}</Button>
          <Button variant="primary" onClick={generate} disabled={status.kind === 'generating' || !selected.length}>
            {status.kind === 'generating' ? <Loader2 className="animate-spin" /> : <FileDown />}
            {status.kind === 'generating' ? 'Generating PDF…' : done ? 'Download again' : status.kind === 'error' ? 'Retry' : 'Download PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-subtle/60 px-4 py-3 text-[13px] text-body">
          <p className="font-medium text-ink">
            {snap.brandName} · {snap.auditTitle} · {fmtDate(snap.auditedAt)}
          </p>
          <p className="mt-0.5">
            {snap.locations.length} centre{snap.locations.length === 1 ? '' : 's'} · {snap.questionTemplates.length} questions per centre · {snap.sampledAnswers} sampled answers · {snap.surfaceLabel} · baseline check only
          </p>
          <p className="mt-0.5">
            Discoverability {formatScore(snap.discovery)} ({snap.discovery.numerator} of {snap.discovery.denominator}) · Information accuracy {formatScore(snap.accuracy)} ({snap.accuracy.numerator} of {snap.accuracy.denominator} verified claims)
          </p>
        </div>

        {audits.length > 1 && (
          <label className="block text-[13px] text-body">
            <span className="mb-1 block font-medium text-ink">Check</span>
            <select className="h-9 w-full rounded-md border border-line bg-surface px-2 text-[13.5px]" value={auditId} onChange={(e) => { setAuditId(e.target.value); setScope(null); setStatus({ kind: 'idle' }) }} aria-label="Check to report on">
              {[...audits].reverse().map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {fmtDate(a.createdAt)} · {a.locationIds.length} centres{a.id === initialAuditId ? ' (latest)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Report</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              ['executive', 'Executive summary', `Usually 2 pages: scores, key findings, every centre and the questions tested.`],
              ['detailed', 'Detailed report', `Executive summary plus every question and original AI answer (${snap.sampledAnswers} samples) and the methodology.`],
            ] as const).map(([v, label, hint]) => (
              <label key={v} className={cn('flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 text-[13px]', edition === v ? 'border-brand bg-brand-soft/50' : 'border-line')}>
                <input type="radio" name="edition" value={v} checked={edition === v} onChange={() => { setEdition(v); setStatus({ kind: 'idle' }); logEvent(`report_edition_selected · ${v}`) }} className="mt-0.5 accent-[var(--brand,#2554d6)]" />
                <span>
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block text-body">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <details className="rounded-xl border border-line px-3 py-2 text-[13px]">
          <summary className="cursor-pointer font-medium text-ink">
            Centres included · {selected.length} of {full.locations.length}
          </summary>
          <p className="mt-1 text-[12.5px] text-muted">All figures are recalculated for the centres you include.</p>
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {full.locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-ink">
                <Checkbox checked={selected.includes(l.id)} onCheckedChange={(v) => { const next = v ? [...selected, l.id] : selected.filter((x) => x !== l.id); setScope(next.length === full.locations.length ? null : next); setStatus({ kind: 'idle' }) }} aria-label={`Include ${l.name}`} />
                {l.neighborhood}
              </label>
            ))}
          </div>
          {!selected.length && <p className="mt-1 text-[12.5px] text-danger">Include at least one centre.</p>}
        </details>

        {status.kind === 'done' && (
          <div className="rounded-xl border border-[#c6e8d8] bg-success-soft px-4 py-3 text-[13px]" role="status">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <CheckCircle2 className="size-4 text-success" />
              PDF downloaded · {status.pages} page{status.pages === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 break-all text-body">{status.filename}</p>
            <button
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
              onClick={() => { logEvent(`v1_preview_opened_from_report · ${snap.auditId}`); onOpenChange(false); navigate('/improve') }}
            >
              Want to address the findings? Explore Improve
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
        {status.kind === 'error' && (
          <div className="rounded-xl border border-[#f2c9ce] bg-danger-soft px-4 py-3 text-[13px]" role="alert">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <RotateCcw className="size-4 text-danger" />
              The PDF couldn’t be generated. Your check and results are unchanged.
            </p>
            <p className="mt-0.5 text-body">{status.message}. Try again with Retry.</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
