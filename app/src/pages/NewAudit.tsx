import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, Download, FileUp, Info, Loader2, MapPin, MessageSquareText, Pencil, Play, Plus, Search, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { actorName, useStore } from '@/store/AppStore'
import { CATEGORY_LABELS, FIELD_LABELS, FIELD_ORDER, fillPrompt, LOCATIONS, LOCATION_BY_ID, PILOT_IDS, SURFACE } from '@/data/seed'
import type { AuditMode, CsvImportSummary, PromptCategory, PromptTemplate } from '@/data/types'
import { CSV_COLUMNS, CSV_TEMPLATE, MAX_CSV_BYTES, validateCsv, type CsvParseResult } from '@/lib/csvImport'
import { downloadText } from '@/lib/geoMarkup'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { Segmented } from '@/components/ui/misc'
import { runSimulatedAudit, RUN_STAGES, type RunProgress } from '@/services/mockAuditService'
import { PageHeader, PermButton, VerificationBadge } from '@/components/domain'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, Progress } from '@/components/ui/misc'
import { cn, fmtDate } from '@/lib/utils'

const MAX_LOCATIONS = 10
const STEPS = ['Locations', 'Prompts', 'Review & run']

function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step
        const active = i === step
        return (
          <li key={s} className="flex items-center gap-2">
            <button
              onClick={() => done && onJump(i)}
              disabled={!done}
              className={cn('flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition-colors', active ? 'bg-brand-soft text-brand' : done ? 'text-ink hover:bg-subtle' : 'text-muted')}
              aria-current={active ? 'step' : undefined}
            >
              <span className={cn('grid size-6 place-items-center rounded-full text-[12px] font-semibold', active ? 'bg-brand text-white' : done ? 'bg-teal text-white' : 'bg-[#e9eef4] text-muted')}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}

function CompletenessPanel({ locationId }: { locationId: string | null }) {
  if (!locationId) {
    return <EmptyState icon={<MapPin />} title="Select a center" description="Choose a row to see verified-record completeness." className="py-10" />
  }
  const loc = LOCATION_BY_ID[locationId]
  const fields = FIELD_ORDER.map((k) => ({ k, f: loc.verifiedFields[k] }))
  const complete = fields.filter((x) => x.f.status === 'verified').length
  return (
    <div>
      <div className="border-b border-line px-5 py-4">
        <p className="text-[12px] font-medium text-muted">Verified record</p>
        <p className="mt-0.5 text-[15px] font-semibold text-ink">{loc.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerificationBadge status={loc.verificationStatus} />
          <span className="text-[12px] text-muted">Last verified {fmtDate(loc.lastVerifiedAt)}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={(complete / fields.length) * 100} tone="teal" />
          <span className="tabular shrink-0 text-[12px] font-medium text-body">
            {complete}/{fields.length} fields
          </span>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {fields.map(({ k, f }) => (
          <li key={k} className="flex items-start justify-between gap-3 px-5 py-2.5">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">{FIELD_LABELS[k]}</p>
              <p className={cn('truncate text-[12px]', f.value ? 'text-muted' : 'italic text-[#9aa6b6]')}>{f.value ?? f.note ?? 'No verified value'}</p>
            </div>
            {f.status === 'verified' ? (
              <Badge tone="success">
                <Check />
                Verified
              </Badge>
            ) : (
              <Badge tone="warning">
                <CircleDashed />
                Cannot evaluate
              </Badge>
            )}
          </li>
        ))}
      </ul>
      {complete < fields.length && <p className="border-t border-line bg-warning-soft/60 px-5 py-3 text-[12px] leading-snug text-warning">AI claims about incomplete fields are marked “Cannot evaluate” — never automatically incorrect.</p>}
    </div>
  )
}

function LocationsStep({ selected, setSelected, error }: { selected: string[]; setSelected: (ids: string[]) => void; error?: string }) {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('all')
  const [status, setStatus] = useState('all')
  const [focus, setFocus] = useState<string | null>(selected[0] ?? null)
  const cities = useMemo(() => [...new Set(LOCATIONS.map((l) => l.city))], [])
  const filtered = LOCATIONS.filter(
    (l) =>
      (city === 'all' || l.city === city) &&
      (status === 'all' || l.verificationStatus === status) &&
      (!q || `${l.name} ${l.neighborhood} ${l.city}`.toLowerCase().includes(q.toLowerCase())),
  )
  const toggle = (id: string) => {
    setFocus(id)
    if (selected.includes(id)) return setSelected(selected.filter((x) => x !== id))
    if (selected.length >= MAX_LOCATIONS) {
      toast.warning(`Up to ${MAX_LOCATIONS} centers per pilot audit`, { description: 'Deselect a center to add another.' })
      return
    }
    setSelected([...selected, id])
  }
  const selectVisible = () => {
    const merged = [...selected]
    for (const l of filtered) {
      if (merged.length >= MAX_LOCATIONS) break
      if (!merged.includes(l.id)) merged.push(l.id)
    }
    setSelected(merged)
    if (filtered.length + selected.length > MAX_LOCATIONS) toast.info(`Selection capped at ${MAX_LOCATIONS} centers`)
  }
  const incomplete = selected.map((id) => LOCATION_BY_ID[id]).filter((l) => l.verificationStatus !== 'verified')

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input placeholder="Search centers or neighborhoods" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search centers" />
          </div>
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city" className="w-40">
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by record status" className="w-48">
            <option value="all">All record statuses</option>
            <option value="verified">Verified</option>
            <option value="needs_verification">Needs verification</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-5 py-2">
          <p className="text-[13px] text-body">
            <span className="tabular font-semibold text-ink">{selected.length}</span> of {MAX_LOCATIONS} selected · {filtered.length} of {LOCATIONS.length} centers shown
          </p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSelected(PILOT_IDS)}>
              Bengaluru pilot set
            </Button>
            <Button variant="ghost" size="sm" onClick={selectVisible} disabled={selected.length >= MAX_LOCATIONS}>
              Select visible
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={!selected.length}>
              Clear
            </Button>
          </div>
        </div>
        <div className="scrollbar-thin max-h-[468px] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={<Search />} title="No centers match" description="Try a different neighborhood or clear filters." action={<Button size="sm" onClick={() => { setQ(''); setCity('all'); setStatus('all') }}>Clear filters</Button>} />
          ) : (
            <ul role="listbox" aria-multiselectable aria-label="Centers">
              {filtered.map((l) => {
                const on = selected.includes(l.id)
                return (
                  <li
                    key={l.id}
                    role="option"
                    aria-selected={on}
                    className={cn('flex cursor-pointer items-center gap-3 border-b border-line px-5 py-2.5 transition-colors last:border-b-0', on ? 'bg-[#f5f8ff]' : 'hover:bg-subtle', focus === l.id && 'shadow-[inset_3px_0_0_var(--brand-blue)]')}
                    onClick={() => toggle(l.id)}
                  >
                    <Checkbox checked={on} onCheckedChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                        {l.name}
                        {l.isPilot && <Badge tone="teal">Pilot</Badge>}
                      </p>
                      <p className="text-[12px] text-muted">
                        {l.city} · {l.region}
                      </p>
                    </div>
                    <VerificationBadge status={l.verificationStatus} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {error && (
          <div className="border-t border-line px-5 py-3">
            <FieldError>{error}</FieldError>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        {incomplete.length > 0 && (
          <div className="rounded-xl border border-[#f1dcb2] bg-warning-soft p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
              <AlertTriangle className="size-4" />
              {incomplete.length} selected {incomplete.length === 1 ? 'center has' : 'centers have'} incomplete records
            </p>
            <ul className="mt-2 space-y-1">
              {incomplete.map((l) => (
                <li key={l.id}>
                  <button className="text-left text-[12.5px] text-body hover:text-ink hover:underline" onClick={() => setFocus(l.id)}>
                    {l.neighborhood}:{' '}
                    {FIELD_ORDER.filter((k) => l.verifiedFields[k].status !== 'verified')
                      .map((k) => FIELD_LABELS[k].toLowerCase())
                      .join(', ')}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-warning">We won't fabricate a truth value — related claims will show “Cannot evaluate”.</p>
          </div>
        )}
        <Card>
          <CompletenessPanel locationId={focus} />
        </Card>
      </div>
    </div>
  )
}

const CATEGORIES: PromptCategory[] = ['discovery', 'services', 'reputation', 'branded']

function PromptDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial: PromptTemplate | null; onSave: (p: PromptTemplate) => void }) {
  const { role } = useStore()
  const [text, setText] = useState('')
  const [category, setCategory] = useState<PromptCategory>('discovery')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setText(initial?.text ?? '')
      setCategory(initial?.category ?? 'discovery')
      setTouched(false)
    }
  }, [open, initial])
  const branded = category === 'branded'
  const error = !text.trim()
    ? 'Enter a prompt.'
    : text.trim().length < 12
      ? 'Prompts should be at least 12 characters.'
      : !text.includes('{neighborhood}')
        ? 'Include {neighborhood} so the prompt can be localised per center.'
        : branded && !/brightnest/i.test(text)
          ? 'Branded fact prompts must name BrightNest.'
          : !branded && /brightnest/i.test(text)
            ? 'Unbranded prompts must not name BrightNest — they measure discovery.'
            : null

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit custom prompt' : 'Add custom prompt'}
      description="Use {neighborhood} and optionally {city} as placeholders."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true)
              if (error) return
              onSave({
                id: initial?.id ?? `px${Date.now().toString(36)}`,
                text: text.trim(),
                category,
                intent: branded ? 'branded_fact' : 'unbranded_discovery',
                includeInDiscoveryMetric: !branded,
                custom: true,
                provenance: initial?.provenance ?? `Custom · added by ${actorName(role)}`,
              })
            }}
          >
            {initial ? 'Save changes' : 'Add prompt'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="prompt-cat">Category</Label>
          <Select id="prompt-cat" value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
                {c === 'branded' ? ' (excluded from mention rate)' : ' (unbranded)'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="prompt-text" hint={`${text.length}/140`}>
            Prompt
          </Label>
          <Textarea id="prompt-text" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} invalid={touched && !!error} placeholder={branded ? 'Is BrightNest {neighborhood} open during summer break?' : 'Preschools with transport near {neighborhood}'} />
          <FieldError>{touched ? error : null}</FieldError>
        </div>
        {text.includes('{neighborhood}') && (
          <div className="rounded-lg border border-line bg-subtle px-3 py-2.5 text-[13px]">
            <span className="text-muted">Preview · </span>
            <span className="text-ink">{fillPrompt(text, LOCATION_BY_ID.whitefield)}</span>
          </div>
        )}
      </div>
    </Dialog>
  )
}

function PromptsStep({ selected, setSelected, locationIds, error }: { selected: string[]; setSelected: (ids: string[]) => void; locationIds: string[]; error?: string }) {
  const { prompts, saveCustomPrompt, deleteCustomPrompt, can } = useStore()
  const [previewLoc, setPreviewLoc] = useState(locationIds[0] ?? 'whitefield')
  const [dialog, setDialog] = useState<{ open: boolean; initial: PromptTemplate | null }>({ open: false, initial: null })
  const loc = LOCATION_BY_ID[previewLoc] ?? LOCATION_BY_ID.whitefield
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const discovery = selected.filter((id) => prompts.find((p) => p.id === id)?.includeInDiscoveryMetric).length
  const branded = selected.length - discovery

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-[13px] text-body">
            <span className="tabular font-semibold text-ink">{selected.length}</span> prompts selected · <span className="tabular">{discovery}</span> unbranded discovery · <span className="tabular">{branded}</span> branded facts
          </p>
          <div className="flex items-center gap-2">
            <Select id="preview-loc" value={previewLoc} onChange={(e) => setPreviewLoc(e.target.value)} className="w-52" aria-label="Preview with location">
              {(locationIds.length ? locationIds : ['whitefield']).map((id) => (
                <option key={id} value={id}>
                  Preview: {LOCATION_BY_ID[id].neighborhood}
                </option>
              ))}
            </Select>
            <PermButton perm="editPrompts" size="md" onClick={() => setDialog({ open: true, initial: null })}>
              <Plus />
              Custom prompt
            </PermButton>
          </div>
        </div>
        {CATEGORIES.map((cat) => {
          const list = prompts.filter((p) => p.category === cat)
          if (!list.length) return null
          return (
            <div key={cat} className="border-b border-line last:border-b-0">
              <div className="flex items-center justify-between bg-subtle px-5 py-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">{CATEGORY_LABELS[cat]}</p>
                <Badge tone={cat === 'branded' ? 'outline' : 'teal'}>{cat === 'branded' ? 'Factual accuracy' : 'Counts toward mention rate'}</Badge>
              </div>
              <ul>
                {list.map((p) => {
                  const on = selected.includes(p.id)
                  return (
                    <li key={p.id} className={cn('flex items-start gap-3 px-5 py-3 transition-colors', on ? 'bg-[#f7f9ff]' : 'hover:bg-subtle')}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} className="mt-0.5" aria-label={`Include prompt: ${p.text}`} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => toggle(p.id)}>
                        <p className="text-[13.5px] font-medium text-ink">
                          {p.text}
                          {p.custom && (
                            <Badge tone="blue" className="ml-2 align-middle">
                              Custom
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted">“{fillPrompt(p.text, loc)}”</p>
                        <p className="mt-0.5 text-[11.5px] text-[#97a3b4]">{p.provenance ?? 'ProManage template library · v1'}</p>
                      </button>
                      {p.custom && can('editPrompts') && (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit prompt" onClick={() => setDialog({ open: true, initial: p })}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete prompt"
                            onClick={() => {
                              deleteCustomPrompt(p.id)
                              setSelected(selected.filter((x) => x !== p.id))
                              toast('Custom prompt removed')
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        {error && (
          <div className="border-t border-line px-5 py-3">
            <FieldError>{error}</FieldError>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Info className="size-4 text-brand" />
            Two separate measures
          </p>
          <dl className="mt-3 space-y-3 text-[12.5px] leading-snug">
            <div>
              <dt className="font-medium text-ink">Unbranded discovery ({discovery})</dt>
              <dd className="text-muted">Does a sampled answer mention the right BrightNest center when parents don't name it? Feeds the mention rate.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Branded facts ({branded})</dt>
              <dd className="text-muted">When BrightNest is named, are hours, phone, address and services correct? Not included in the mention rate.</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">Recommended pilot mix</p>
          <p className="mt-1 text-[12.5px] text-muted">5 unbranded + 3 branded prompts keeps the first review manageable (80 observations for 10 centers).</p>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => setSelected(prompts.filter((p) => p.defaultSelected).map((p) => p.id))}>
            Use recommended 8
          </Button>
        </Card>
      </div>
      <PromptDialog
        open={dialog.open}
        initial={dialog.initial}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        onSave={(p) => {
          saveCustomPrompt(p)
          if (!selected.includes(p.id)) setSelected([...selected, p.id])
          setDialog({ open: false, initial: null })
          toast.success(dialog.initial ? 'Prompt updated' : 'Custom prompt added', { description: 'Included in this audit.' })
        }}
      />
    </div>
  )
}

function RunPanel({ progress }: { progress: RunProgress }) {
  const idx = RUN_STAGES.findIndex((s) => s.id === progress.stage)
  const pct = progress.stage === 'preparing' ? 4 : progress.stage === 'running' ? 8 + (progress.completed / progress.total) * 72 : progress.stage === 'extracting' ? 90 : 100
  return (
    <Card className="mx-auto max-w-[640px] p-8" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-semibold text-ink">Running audit</p>
      </div>
      <p className="mt-1 text-[13px] text-muted">Sampling AI answers for every center and prompt, then checking claims against verified records.</p>
      <Progress value={pct} className="mt-6 h-2" />
      <p className="tabular mt-2 text-right text-[12.5px] text-muted">
        {progress.completed} / {progress.total} observations
      </p>
      <ol className="mt-4 space-y-3">
        {RUN_STAGES.map((s, i) => {
          const done = i < idx || progress.stage === 'complete'
          const active = i === idx && progress.stage !== 'complete'
          return (
            <li key={s.id} className="flex items-start gap-3">
              <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', done ? 'bg-teal text-white' : active ? 'bg-brand-soft text-brand' : 'bg-[#eef2f7] text-[#9aa6b6]')}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <div>
                <p className={cn('text-[13.5px] font-medium', done || active ? 'text-ink' : 'text-muted')}>{s.label}</p>
                <p className="text-[12.5px] text-muted">{s.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function CsvImportPanel({ onUse }: { onUse: (ids: string[], summary: CsvImportSummary) => void }) {
  const [file, setFile] = useState<{ name: string; result: CsvParseResult } | null>(null)
  const [reading, setReading] = useState(false)
  const valid = file?.result.rows.filter((r) => !r.errors.length) ?? []
  const matched = valid.filter((r) => r.matchId)

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (!/\.csv$/i.test(f.name)) {
      setFile({ name: f.name, result: { ok: false, fatal: 'Only .csv files are supported.', rows: [] } })
      return
    }
    if (f.size > MAX_CSV_BYTES) {
      setFile({ name: f.name, result: validateCsv('', f.size) })
      return
    }
    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setFile({ name: f.name, result: validateCsv(String(reader.result ?? ''), f.size) })
      setReading(false)
    }
    reader.onerror = () => {
      setFile({ name: f.name, result: { ok: false, fatal: 'The file could not be read.', rows: [] } })
      setReading(false)
    }
    reader.readAsText(f)
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#b9c6d6] bg-subtle px-4 py-2.5 text-[13.5px] font-medium text-ink hover:border-brand hover:bg-brand-soft focus-within:ring-2 focus-within:ring-brand">
            <FileUp className="size-4 text-brand" />
            {file ? 'Choose another file' : 'Choose CSV file'}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <Button variant="ghost" onClick={() => { downloadText('brightnest-locations-template.csv', CSV_TEMPLATE, 'text/csv'); toast.success('Template downloaded', { description: 'Includes valid, unmatched and invalid example rows.' }) }}>
            <Download />
            Download template
          </Button>
          <p className="ml-auto text-[12px] text-muted">Read in your browser only · max {MAX_CSV_BYTES / 1000} KB</p>
        </div>
        {reading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-[13px] text-muted"><Loader2 className="size-4 animate-spin" />Validating…</div>
        ) : !file ? (
          <EmptyState icon={<FileUp />} title="Import a location list" description={`Columns: ${CSV_COLUMNS.join(', ')}. Rows are matched to existing BrightNest locations; nothing is uploaded or synced.`} />
        ) : !file.result.ok ? (
          <div className="px-5 py-6">
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-danger"><AlertTriangle className="size-4" />{file.name} couldn't be used</p>
            <p className="mt-1 text-[13px] text-body">{file.result.fatal}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-5 py-2 text-[12.5px]">
              <span className="font-medium text-ink">{file.name}</span>
              <Badge tone="neutral">{file.result.rows.length} rows</Badge>
              <Badge tone="success">{valid.length} valid</Badge>
              {file.result.rows.length - valid.length > 0 && <Badge tone="danger">{file.result.rows.length - valid.length} invalid</Badge>}
              <Badge tone="teal">{matched.length} matched</Badge>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Line</Th>
                  <Th>Location</Th>
                  <Th>Validation</Th>
                  <Th>Match</Th>
                </tr>
              </thead>
              <tbody>
                {file.result.rows.map((r) => (
                  <Tr key={r.line}>
                    <Td className="tabular text-muted">{r.line}</Td>
                    <Td>
                      <p className="font-medium text-ink">{r.values.location_name || <span className="italic text-muted">(no name)</span>}</p>
                      <p className="text-[12px] text-muted">{[r.values.neighborhood, r.values.city].filter(Boolean).join(', ')}</p>
                    </Td>
                    <Td className="max-w-[280px]">
                      {r.errors.length ? (
                        <ul className="space-y-0.5 text-[12.5px] text-danger">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                      ) : (
                        <Badge tone="success"><Check />Valid</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[300px]">
                      {r.matchId ? (
                        <>
                          <p className="text-[13px] text-ink">{LOCATION_BY_ID[r.matchId].name}</p>
                          {r.diffs.length > 0 && (
                            <p className="text-[12px] text-warning">
                              {r.diffs.length} value{r.diffs.length > 1 ? 's' : ''} differ from the verified record ({r.diffs.map((d) => d.field).join(', ')}) — CSV not used as truth
                            </p>
                          )}
                        </>
                      ) : r.errors.length ? (
                        <span className="text-[12.5px] text-muted">—</span>
                      ) : (
                        <span className="text-[12.5px] text-muted">No matching location in this account</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              <p className="text-[12.5px] text-muted">Only matched, valid rows can be audited (up to {MAX_LOCATIONS}).</p>
              <Button
                variant="primary"
                disabled={!matched.length}
                onClick={() => {
                  const ids = [...new Set(matched.map((r) => r.matchId!))].slice(0, MAX_LOCATIONS)
                  onUse(ids, { fileName: file.name, totalRows: file.result.rows.length, validRows: valid.length, matchedRows: matched.length })
                  toast.success(`${ids.length} matched centers selected`, { description: 'Audited against their verified ProManage records.' })
                }}
              >
                Use {Math.min(matched.length, MAX_LOCATIONS)} matched centers
              </Button>
            </div>
          </>
        )}
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Info className="size-4 text-brand" />How imported rows are used</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-body">
            <li>Rows are matched to existing locations by neighborhood and city.</li>
            <li>CSV values never become verified facts. Differences are flagged for the customer to confirm.</li>
            <li>Unmatched rows can't be audited until the location exists in the account.</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

export default function NewAuditPage() {
  const { prompts, promptsById, createAudit, can, role, checkRequests, completeCheckRequest } = useStore()
  const [search] = useSearchParams()
  const request = checkRequests.find((r) => r.id === search.get('request'))
  const assisted = can('assistedAudit')
  const [mode, setMode] = useState<AuditMode>(role === 'promanage' ? 'assisted' : 'self-serve')
  const [source, setSource] = useState<'account' | 'csv'>('account')
  const [csvSummary, setCsvSummary] = useState<CsvImportSummary | undefined>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [locationIds, setLocationIds] = useState<string[]>(PILOT_IDS)
  const [promptIds, setPromptIds] = useState<string[]>(prompts.filter((p) => p.defaultSelected).map((p) => p.id))
  const [name, setName] = useState(role === 'promanage' ? 'Executive AI Visibility Baseline Audit — Bengaluru pilot' : 'Bengaluru pilot — baseline')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const cancel = useRef({ cancelled: false })
  useEffect(() => () => void (cancel.current.cancelled = true), [])

  const validPromptIds = promptIds.filter((id) => promptsById[id])
  const total = locationIds.length * validPromptIds.length
  const disc = validPromptIds.filter((id) => promptsById[id].includeInDiscoveryMetric).length

  const next = () => {
    if (step === 0 && locationIds.length === 0) return setErrors({ locations: 'Select at least one center to continue.' })
    if (step === 1 && validPromptIds.length === 0) return setErrors({ prompts: 'Select at least one prompt to continue.' })
    setErrors({})
    setStep((s) => s + 1)
  }

  const run = async () => {
    const e: Record<string, string> = {}
    if (!locationIds.length) e.run = 'No centers selected — go back to Locations and choose at least one.'
    else if (!validPromptIds.length) e.run = 'No prompts selected — go back to Prompts and choose at least one.'
    if (!name.trim()) e.name = 'Give the audit a name so it is easy to find later.'
    if (Object.keys(e).length) return setErrors(e)
    setErrors({})
    cancel.current = { cancelled: false }
    const ok = await runSimulatedAudit(total, setProgress, cancel.current)
    if (!ok) return
    const audit = createAudit({ name: name.trim(), locationIds, promptIds: validPromptIds, mode, csvImport: source === 'csv' ? csvSummary : undefined })
    if (request) completeCheckRequest(request.id, audit.id)
    toast.success('Audit complete', { description: `${audit.id} · ${total} observations ready for review` })
    setTimeout(() => navigate(`/audits/${audit.id}`), 500)
  }

  if (!can('runAudit')) {
    return (
      <EmptyState
        icon={<MessageSquareText />}
        title="Audits are configured by Marketing or ProManage CSM"
        description="Your role can review results for your assigned centers."
        action={
          <Button asChild>
            <Link to="/audits">View audits</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <Link to="/audits" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Audits
          </Link>
        }
        title="New audit"
        subtitle="Choose centers and prompts, then sample AI answers."
        actions={!progress && <Stepper step={step} onJump={setStep} />}
      />

      {progress ? (
        <RunPanel progress={progress} />
      ) : (
        <>
          {step === 0 && request && (
            <div className="mb-4 rounded-xl border border-brand-line bg-brand-soft px-4 py-3 text-[13.5px] text-ink">
              <span className="font-medium">Brand request {request.id}</span>: first visibility check{request.note ? ` — “${request.note}”` : ''}. Running this audit completes the request and shows results to the Brand.
            </div>
          )}
          {step === 0 && assisted && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3">
              <Users className="size-4 text-brand" />
              <p className="text-[13px] text-ink">
                <span className="font-medium">Assisted audit</span> — ProManage-led setup for an executive baseline report.
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Segmented ariaLabel="Audit mode" size="sm" value={mode} onChange={setMode} options={[{ value: 'assisted', label: 'Assisted' }, { value: 'self-serve', label: 'Self-serve' }]} />
                <Segmented ariaLabel="Location source" size="sm" value={source} onChange={setSource} options={[{ value: 'account', label: 'Choose from account' }, { value: 'csv', label: 'Import CSV' }]} />
              </div>
            </div>
          )}
          {step === 0 && (assisted && source === 'csv' ? (
            <CsvImportPanel
              onUse={(ids, summary) => {
                setLocationIds(ids)
                setCsvSummary(summary)
                setSource('account')
                setErrors({})
              }}
            />
          ) : (
            <LocationsStep selected={locationIds} setSelected={(ids) => { setLocationIds(ids); setErrors({}) }} error={errors.locations} />
          ))}
          {step === 1 && <PromptsStep selected={promptIds} setSelected={(ids) => { setPromptIds(ids); setErrors({}) }} locationIds={locationIds} error={errors.prompts} />}
          {step === 2 && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Card className="p-6">
                <div className="max-w-md">
                  <Label htmlFor="audit-name">Audit name</Label>
                  <Input id="audit-name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
                  <FieldError>{errors.name}</FieldError>
                </div>
                <div className="mt-6 grid grid-cols-1 items-center gap-3 rounded-xl border border-line bg-subtle p-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.2fr]">
                  {[
                    { n: locationIds.length, l: 'centers' },
                    { op: '×' },
                    { n: validPromptIds.length, l: 'prompts' },
                    { op: '×' },
                    { n: 1, l: 'AI surface' },
                    { op: '=' },
                    { n: total, l: 'observations', strong: true },
                  ].map((x, i) =>
                    'op' in x ? (
                      <span key={i} className="hidden text-center text-[18px] text-muted sm:block">
                        {x.op}
                      </span>
                    ) : (
                      <div key={i} className={cn('rounded-lg bg-white px-3 py-2.5 text-center ring-1 ring-line', x.strong && 'ring-brand-line bg-brand-soft')}>
                        <p className={cn('tabular text-[22px] font-semibold leading-tight', x.strong ? 'text-brand' : 'text-ink')}>{x.n}</p>
                        <p className="text-[12px] text-muted">{x.l}</p>
                      </div>
                    ),
                  )}
                </div>
                <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Unbranded discovery observations</dt>
                    <dd className="tabular font-medium text-ink">{locationIds.length * disc}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Branded factual observations</dt>
                    <dd className="tabular font-medium text-ink">{locationIds.length * (validPromptIds.length - disc)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Surface</dt>
                    <dd className="font-medium text-ink">{SURFACE}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Mode</dt>
                    <dd className="font-medium text-ink">
                      {mode === 'assisted' ? 'Assisted (ProManage-led)' : 'Self-serve'}
                      {source === 'csv' || csvSummary ? ` · from ${csvSummary?.fileName}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Evaluation rules</dt>
                    <dd className="font-medium text-ink">Rules v1 · exact match against verified fields</dd>
                  </div>
                </dl>
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
                  <Button onClick={() => setStep(1)}>
                    <ArrowLeft />
                    Back
                  </Button>
                  <Button variant="primary" size="lg" onClick={run}>
                    <Play />
                    Run audit
                  </Button>
                </div>
                <FieldError>{errors.run}</FieldError>
              </Card>
              <div className="space-y-4">
                <div className="rounded-xl border border-[#f1dcb2] bg-warning-soft p-5">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-warning">
                    <AlertTriangle className="size-4" />
                    Before you run
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-body">
                    <li>Provider output varies between runs; one sample per prompt is indicative, not definitive.</li>
                    <li>API results may not match what people see in consumer AI products.</li>
                  </ul>
                </div>
                <Card className="p-5">
                  <p className="text-[13px] font-semibold text-ink">Selected centers</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {locationIds.map((id) => (
                      <Badge key={id} tone="outline">
                        {LOCATION_BY_ID[id].neighborhood}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
          {step < 2 && (
            <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <p className="text-[13px] text-muted">
                <span className="tabular font-medium text-ink">{locationIds.length}</span> centers × <span className="tabular font-medium text-ink">{validPromptIds.length}</span> prompts ={' '}
                <span className="tabular font-semibold text-brand">{total}</span> observations
              </p>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button onClick={() => setStep(step - 1)}>
                    <ArrowLeft />
                    Back
                  </Button>
                )}
                <Button variant="primary" onClick={next}>
                  Continue
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
