import { useState, useMemo, useEffect } from 'react'
import {
  Plus, Trash2, Edit, Wallet, Check, X,
  ChevronDown, ChevronUp, Pencil,
  Download, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useApp } from '@/context/AppContext'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'
import type { FinancialBucket, FinancialEntry, FinancialFeeling } from '@trackmind/core'

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calendarMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Returns the current period identifier: ISO date of the most recent period
// start when cycle mode is on, otherwise falls back to YYYY-MM.
function getCurrentPeriodId(preferences: import('@trackmind/core').UserPreferences | null | undefined): string {
  if (preferences?.cycle?.enabled) {
    const history = [...(preferences.cycle.period_history ?? [])].sort()
    if (history.length > 0) return history[history.length - 1]
  }
  return calendarMonthStr()
}

// Label for a period identifier: date range for cycle IDs, month name for YYYY-MM.
function monthLabel(id: string, cycleLength = 28): string {
  // Cycle id: "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const start = new Date(id + 'T00:00:00')
    const end = new Date(id + 'T00:00:00')
    end.setDate(end.getDate() + cycleLength - 1)
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${startLabel} – ${endLabel}`
  }
  // Calendar month: "YYYY-MM"
  const [y, m] = id.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nextColor(existing: FinancialBucket[]): string {
  const used = new Set(existing.map(b => b.color))
  return PALETTE.find(c => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length]
}

// ─── Feeling constants ────────────────────────────────────────────────────────

const FEELINGS: { value: FinancialFeeling; emoji: string; label: string }[] = [
  { value: 'happy',   emoji: '😊', label: 'Happy'   },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'sad',     emoji: '😢', label: 'Sad'     },
]

function feelingEmoji(entry: FinancialEntry): string {
  if (entry.feeling) return FEELINGS.find(f => f.value === entry.feeling)?.emoji ?? '😐'
  return '😐'
}

// All entries are expenses — amount is always stored as a positive number.
// Legacy entries with negative amounts are treated as their absolute value.
function entryAmount(rawAbs: number): number {
  return Math.abs(rawAbs)
}

function bucketTotal(b: FinancialBucket): number {
  if (b.entries?.length) return b.entries.reduce((s: number, e: FinancialEntry) => s + Math.abs(e.amount), 0)
  return Math.abs(b.amount ?? 0)
}

// Sum of amounts per feeling for a bucket
function feelingTotals(b: FinancialBucket): Record<FinancialFeeling, number> {
  const result: Record<FinancialFeeling, number> = { happy: 0, neutral: 0, sad: 0 }
  for (const e of b.entries ?? []) {
    const f: FinancialFeeling = e.feeling ?? (e.amount >= 0 ? 'happy' : 'sad')
    result[f] += Math.abs(e.amount)
  }
  return result
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1_000_000
    ? `${(abs / 1_000_000).toFixed(2)}M`
    : abs >= 1_000
      ? `${(abs / 1_000).toFixed(2)}k`
      : abs.toFixed(2)
  return (n < 0 ? '-$' : '$') + s
}

// ─── Excel export ─────────────────────────────────────────────────────────────

function exportToExcel(buckets: FinancialBucket[], periodId: string, cycleLength = 28) {
  const wb = XLSX.utils.book_new()
  const label = monthLabel(periodId, cycleLength)

  // ── Summary sheet ──
  const summaryData: (string | number)[][] = [
    [`Financial Summary — ${label}`],
    [],
    ['Bucket', 'Total', 'Credits', 'Debits', 'Entries'],
  ]

  let grandTotal = 0
  let grandCredits = 0
  let grandDebits = 0
  let grandEntries = 0

  for (const b of buckets) {
    const entries = b.entries ?? []
    const total   = bucketTotal(b)
    const credits = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
    const debits  = entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0)
    summaryData.push([b.name, total, credits, Math.abs(debits), entries.length])
    grandTotal   += total
    grandCredits += credits
    grandDebits  += debits
    grandEntries += entries.length
  }

  summaryData.push([])
  summaryData.push(['TOTAL', grandTotal, grandCredits, Math.abs(grandDebits), grandEntries])

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ── One sheet per bucket ──
  for (const b of buckets) {
    const entries = [...(b.entries ?? [])].sort((a, e) => a.date.localeCompare(e.date))
    const sheetData: (string | number)[][] = [
      [`${b.name} — ${label}`],
      [],
      ['Date', 'Description', 'Amount', 'Running Total'],
    ]

    let running = 0
    for (const e of entries) {
      running += e.amount
      const d = new Date(e.date + 'T00:00:00')
      sheetData.push([
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        e.description,
        e.amount,
        running,
      ])
    }

    sheetData.push([])
    sheetData.push(['', 'Total', bucketTotal(b), ''])

    const sheet = XLSX.utils.aoa_to_sheet(sheetData)
    sheet['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }]
    // Sanitise bucket name for sheet name (Excel limit: 31 chars, no special chars)
    const sheetName = b.name.replace(/[\\\/\*\?\[\]:]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, sheet, sheetName || 'Bucket')
  }

  XLSX.writeFile(wb, `TrackMind_Financial_${periodId}.xlsx`)
}

// ─── Entries panel ────────────────────────────────────────────────────────────

function EntriesPanel({
  bucket,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: {
  bucket: FinancialBucket
  onAddEntry: (id: string, e: FinancialEntry) => void
  onEditEntry: (bucketId: string, entryId: string, updated: Partial<FinancialEntry>) => void
  onDeleteEntry: (bucketId: string, entryId: string) => void
}) {
  // Add-form state
  const [desc, setDesc] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [feeling, setFeeling] = useState<FinancialFeeling>('happy')
  const [date, setDate] = useState(todayStr)

  // Inline-edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editFeeling, setEditFeeling] = useState<FinancialFeeling>('happy')
  const [editDate, setEditDate] = useState('')

  const startEdit = (e: FinancialEntry) => {
    setEditId(e.id)
    setEditDesc(e.description)
    setEditAmountStr(String(Math.abs(e.amount)))
    setEditFeeling(e.feeling ?? (e.amount >= 0 ? 'happy' : 'sad'))
    setEditDate(e.date)
  }

  const commitEdit = () => {
    if (!editId) return
    const raw = parseFloat(editAmountStr)
    if (!editDesc.trim() || isNaN(raw) || raw <= 0) return
    onEditEntry(bucket.id, editId, {
      description: editDesc.trim(),
      amount: entryAmount(raw),
      feeling: editFeeling,
      date: editDate,
    })
    setEditId(null)
  }

  const cancelEdit = () => setEditId(null)

  const handleAdd = () => {
    const raw = parseFloat(amountStr)
    if (!desc.trim() || isNaN(raw) || raw <= 0) return
    onAddEntry(bucket.id, {
      id: uuidv4(),
      description: desc.trim(),
      amount: entryAmount(raw),
      feeling,
      date,
      created_at: new Date().toISOString(),
    })
    setDesc('')
    setAmountStr('')
    setDate(todayStr())
  }

  // Reusable feeling picker (3 emoji buttons)
  const FeelingPicker = ({ value, onChange }: { value: FinancialFeeling; onChange: (f: FinancialFeeling) => void }) => (
    <div className="flex gap-1 shrink-0">
      {FEELINGS.map(f => (
        <button key={f.value} type="button" title={f.label}
          onClick={() => onChange(f.value)}
          className={cn(
            'h-8 w-9 rounded border text-base transition-colors',
            value === f.value
              ? 'bg-accent border-foreground/30'
              : 'border-border hover:bg-accent/50'
          )}>
          {f.emoji}
        </button>
      ))}
    </div>
  )

  const sorted = [...(bucket.entries ?? [])].sort((a: FinancialEntry, b: FinancialEntry) => b.date.localeCompare(a.date))

  return (
    <div className="border-t mt-3 pt-3 space-y-2">
      {sorted.length > 0 ? (
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {sorted.map((e: FinancialEntry) => editId === e.id ? (
            /* ── Inline edit row ── */
            <div key={e.id} className="space-y-1.5 px-2 py-2 rounded bg-accent/40 text-xs">
              <div className="flex gap-1">
                <FeelingPicker value={editFeeling} onChange={setEditFeeling} />
                <Input value={editDesc} onChange={ev => setEditDesc(ev.target.value)}
                  onKeyDown={ev => { if (ev.key === 'Enter') commitEdit(); if (ev.key === 'Escape') cancelEdit() }}
                  className="h-8 text-xs flex-1" autoFocus />
              </div>
              <div className="flex gap-1">
                <Input type="number" value={editAmountStr} onChange={ev => setEditAmountStr(ev.target.value)}
                  onKeyDown={ev => { if (ev.key === 'Enter') commitEdit(); if (ev.key === 'Escape') cancelEdit() }}
                  className="h-8 text-xs w-28 shrink-0" min={0} />
                <Input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)}
                  className="h-8 text-xs flex-1" />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 shrink-0" onClick={commitEdit}
                  title="Save"><Check className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={cancelEdit}
                  title="Cancel"><X className="h-3 w-3" /></Button>
              </div>
            </div>
          ) : (
            /* ── Read-only row ── */
            <div key={e.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-accent/50 group">
              {/* Feeling emoji */}
              <span className="text-base leading-none shrink-0">{feelingEmoji(e)}</span>
              <span className="text-muted-foreground w-14 shrink-0">
                {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="flex-1 truncate">{e.description}</span>
              <span className="font-mono font-medium shrink-0">
                {fmt(Math.abs(e.amount))}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => startEdit(e)} title="Edit">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDeleteEntry(bucket.id, e.id)} title="Delete">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2 italic">No entries yet</p>
      )}

      <div className="pt-1 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Add entry</p>
        <div className="flex gap-1">
          <FeelingPicker value={feeling} onChange={setFeeling} />
          <Input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} className="h-8 text-xs flex-1" />
        </div>
        <div className="flex gap-1">
          <Input type="number" placeholder="Amount" value={amountStr} onChange={e => setAmountStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} className="h-8 text-xs w-28 shrink-0" min={0} />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs flex-1" />
          <Button size="sm" className="h-8 shrink-0" onClick={handleAdd}
            disabled={!desc.trim() || !amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bucket card ──────────────────────────────────────────────────────────────

function BucketCard({ bucket, pct, posTotal, onAddEntry, onEditEntry, onDeleteEntry, onRename, onDelete }: {
  bucket: FinancialBucket
  pct: number
  posTotal: number
  onAddEntry: (id: string, e: FinancialEntry) => void
  onEditEntry: (bucketId: string, entryId: string, updated: Partial<FinancialEntry>) => void
  onDeleteEntry: (bucketId: string, entryId: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(bucket.name)

  const total   = bucketTotal(bucket)
  const entries = bucket.entries ?? []
  const fTotals = feelingTotals(bucket)

  const commitName = () => { if (nameVal.trim()) onRename(bucket.id, nameVal.trim()); setEditingName(false) }

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: bucket.color }} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <Input value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={commitName}
                onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                className="h-7 text-sm" autoFocus />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={commitName}>
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <h3 className="font-semibold truncate flex-1">{bucket.name}</h3>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
              onClick={() => { setNameVal(bucket.name); setEditingName(true) }} title="Rename">
              <Edit className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(bucket.id)} title="Delete">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <p className={cn('text-2xl font-bold tabular-nums mb-1', total < 0 && 'text-destructive')}>
          {fmt(total)}
        </p>

        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
            {FEELINGS.map(f => fTotals[f.value] > 0 && (
              <span key={f.value}>{f.emoji} {fmt(fTotals[f.value])}</span>
            ))}
            <span>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
          </div>
        )}

        {posTotal > 0 && total > 0 && (
          <div className="space-y-0.5 mb-3">
            <Progress value={pct} className="h-1" />
            <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% of total</p>
          </div>
        )}

        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide entries' : `Entries${entries.length > 0 ? ` (${entries.length})` : ''}`}
        </button>

        {expanded && (
          <EntriesPanel bucket={bucket} onAddEntry={onAddEntry} onEditEntry={onEditEntry} onDeleteEntry={onDeleteEntry} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Add bucket row ───────────────────────────────────────────────────────────

function AddBucketRow({ existing, onAdd }: { existing: FinancialBucket[]; onAdd: (b: FinancialBucket) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const handleAdd = () => {
    if (!name.trim()) return
    const now = new Date().toISOString()
    onAdd({ id: uuidv4(), name: name.trim(), color: nextColor(existing), entries: [], created_at: now, updated_at: now })
    setName('')
    setOpen(false)
  }
  if (!open) return (
    <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4" />Add bucket
    </Button>
  )
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 flex gap-2">
        <Input placeholder="Bucket name" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setOpen(false) }}
          autoFocus className="flex-1" />
        <Button size="sm" onClick={handleAdd} disabled={!name.trim()}>Create</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </CardContent>
    </Card>
  )
}

// ─── Setup wizard ─────────────────────────────────────────────────────────────

function SetupWizard({ onDone }: { onDone: (buckets: FinancialBucket[]) => void }) {
  const [step, setStep] = useState<'count' | 'names'>('count')
  const [count, setCount] = useState(3)
  const [names, setNames] = useState<string[]>(() => Array(3).fill(''))

  const handleCountChange = (n: number) => {
    const c = Math.max(1, Math.min(20, n))
    setCount(c)
    setNames(prev => { const u = [...prev]; while (u.length < c) u.push(''); return u.slice(0, c) })
  }

  const allNamed = names.every(n => n.trim().length > 0)
  const handleCreate = () => {
    const now = new Date().toISOString()
    onDone(names.map((name, i) => ({ id: uuidv4(), name: name.trim(), color: PALETTE[i % PALETTE.length], entries: [], created_at: now, updated_at: now })))
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Set up Financial Tracker</h1>
        <p className="text-muted-foreground max-w-sm">Organise your money into named buckets — savings, expenses, investments.</p>
      </div>

      {step === 'count' ? (
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">How many buckets?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={() => handleCountChange(count - 1)} disabled={count <= 1}><ChevronDown className="h-4 w-4" /></Button>
              <span className="text-4xl font-bold w-12 text-center">{count}</span>
              <Button variant="outline" size="icon" onClick={() => handleCountChange(count + 1)} disabled={count >= 20}><ChevronUp className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">You can add more later</p>
            <Button className="w-full" onClick={() => setStep('names')}>Next — Name your buckets</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Name each bucket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {names.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <Input placeholder={`Bucket ${i + 1}`} value={name}
                  onChange={e => { const u = [...names]; u[i] = e.target.value; setNames(u) }}
                  onKeyDown={e => { if (e.key === 'Enter' && allNamed) handleCreate() }}
                  autoFocus={i === 0} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('count')}>Back</Button>
              <Button className="flex-1" disabled={!allNamed} onClick={handleCreate}>Create buckets</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function FinancialView() {
  const { preferences, savePreferences } = useApp()
  const [closingMonth, setClosingMonth] = useState(false)

  const buckets: FinancialBucket[] = useMemo(
    () => (preferences?.financial_buckets ?? []).map(b => ({ ...b, entries: b.entries ?? [] })),
    [preferences?.financial_buckets]
  )

  const totals     = useMemo(() => buckets.map(bucketTotal), [buckets])
  const grandTotal = useMemo(() => totals.reduce((s, t) => s + t, 0), [totals])
  const posTotal   = useMemo(() => totals.filter(t => t > 0).reduce((s, t) => s + t, 0), [totals])

  // ── Period tracking (cycle-aware) ─────────────────────────────────────────────
  // "current" is the cycle start date when cycle mode is on, or YYYY-MM otherwise.
  const cycleLength = preferences?.cycle?.average_cycle_length ?? 28
  const current = getCurrentPeriodId(preferences)
  const storedMonth = preferences?.financial_current_month ?? current
  const isNewMonth = storedMonth !== current && buckets.some(b => (b.entries ?? []).length > 0)

  // On first load with existing buckets, record the current period if not set
  useEffect(() => {
    if (!preferences) return
    if (!preferences.financial_current_month && buckets.length > 0) {
      savePreferences({ ...preferences, financial_current_month: current })
    }
  }, [preferences]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (updated: FinancialBucket[], newMonth?: string) => {
    if (!preferences) return
    await savePreferences({
      ...preferences,
      financial_buckets: updated,
      financial_current_month: newMonth ?? preferences.financial_current_month ?? current,
    })
  }

  // ── Close month: export Excel → clear entries → start new period ──────────────
  const handleCloseMonth = async (monthToClose = storedMonth) => {
    setClosingMonth(true)
    try {
      exportToExcel(buckets, monthToClose, cycleLength)
      // Clear all entries from all buckets, keep structure intact
      const cleared = buckets.map(b => ({ ...b, entries: [], amount: 0, updated_at: new Date().toISOString() }))
      await save(cleared, current)
    } finally {
      setClosingMonth(false)
    }
  }

  const updateBucket = (id: string, patch: Partial<FinancialBucket>) => {
    save(buckets.map(b => b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b))
  }

  const handleAddEntry = (bucketId: string, entry: FinancialEntry) => {
    const b = buckets.find(b => b.id === bucketId)
    if (!b) return
    updateBucket(bucketId, { entries: [...(b.entries ?? []), entry] })
  }

  const handleEditEntry = (bucketId: string, entryId: string, updated: Partial<FinancialEntry>) => {
    const b = buckets.find(b => b.id === bucketId)
    if (!b) return
    updateBucket(bucketId, {
      entries: (b.entries ?? []).map(e => e.id === entryId ? { ...e, ...updated } : e),
    })
  }

  const handleDeleteEntry = (bucketId: string, entryId: string) => {
    const b = buckets.find(b => b.id === bucketId)
    if (!b) return
    updateBucket(bucketId, { entries: (b.entries ?? []).filter((e: FinancialEntry) => e.id !== entryId) })
  }

  if (buckets.length === 0) {
    return <SetupWizard onDone={b => save(b, current)} />
  }

  return (
    <div className="space-y-6">
      {/* ── New-month banner ───────────────────────────────────────────────────── */}
      {isNewMonth && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">A new month has started</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {monthLabel(storedMonth, cycleLength)} data is ready to export. Click <strong>Close Month</strong> to download
              the Excel report and start {monthLabel(current, cycleLength)} with a clean slate.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => handleCloseMonth(storedMonth)}
            disabled={closingMonth}
          >
            <Download className="h-3.5 w-3.5" />
            {closingMonth ? 'Exporting…' : 'Close Month'}
          </Button>
        </div>
      )}

      {/* ── Summary header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total · {monthLabel(storedMonth, cycleLength)}
                </p>
                <p className={cn('text-3xl font-bold tabular-nums', grandTotal < 0 && 'text-destructive')}>
                  {fmt(grandTotal)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-sm text-muted-foreground">Buckets</p>
              <p className="text-3xl font-bold">{buckets.length}</p>
              <p className="text-xs text-muted-foreground">
                {buckets.filter((_, i) => totals[i] > 0).length} with positive balance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Manual close-month button (always available) */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => handleCloseMonth(storedMonth)}
          disabled={closingMonth}
          title={`Export ${monthLabel(storedMonth, cycleLength)} to Excel and start a new period`}
        >
          <Download className="h-4 w-4" />
          {closingMonth ? 'Exporting…' : 'Close Month'}
        </Button>
      </div>

      {/* ── Distribution bar ───────────────────────────────────────────────────── */}
      {posTotal > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Distribution</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {buckets.map((b, i) => totals[i] > 0 ? (
              <div key={b.id} style={{ width: `${(totals[i] / posTotal) * 100}%`, backgroundColor: b.color }}
                title={`${b.name}: ${fmt(totals[i])}`} />
            ) : null)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {buckets.map((b, i) => totals[i] > 0 && (
              <span key={b.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bucket cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map((b, i) => (
          <BucketCard
            key={b.id}
            bucket={b}
            pct={posTotal > 0 && totals[i] > 0 ? (totals[i] / posTotal) * 100 : 0}
            posTotal={posTotal}
            onAddEntry={handleAddEntry}
            onEditEntry={handleEditEntry}
            onDeleteEntry={handleDeleteEntry}
            onRename={(id, name) => updateBucket(id, { name })}
            onDelete={id => { if (confirm('Delete this bucket and all its entries?')) save(buckets.filter(b => b.id !== id)) }}
          />
        ))}
      </div>

      {/* ── Add bucket ─────────────────────────────────────────────────────────── */}
      <AddBucketRow existing={buckets} onAdd={b => save([...buckets, b])} />
    </div>
  )
}

export default FinancialView
