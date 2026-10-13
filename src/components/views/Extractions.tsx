'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Brain,
  CheckCircle2,
  XCircle,
  Edit3,
  Loader2,
  AlertCircle,
  Cpu,
  FileText,
  ArrowRight,
} from 'lucide-react'

interface ExtractionItem {
  id: string
  taskType: string
  status: string
  reviewStatus: string
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  costUsd: number | null
  errorMessage: string | null
  items: Array<{
    category: string
    criterion: string
    operator: string | null
    threshold: string | null
    thresholdAmount?: number
    thresholdCurrency?: string
    thresholdUnit?: string
    evaluationMetric?: string
    isMandatory: boolean
    sourceSnippet: string
    confidence: number
  }>
  tender: { id: string; title: string; market: string } | null
  requestedBy: { email: string; name: string | null } | null
  reviewedBy: { email: string; name: string | null } | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
}

export function Extractions() {
  const { t, formatDateTime } = useTranslation()

  const [items, setItems] = useState<ExtractionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selected, setSelected] = useState<ExtractionItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedItems, setEditedItems] = useState<ExtractionItem['items']>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({})
  const [hasEdits, setHasEdits] = useState(false)
  const openTender = useAppStore((s) => s.openTender)

  const load = () => {
    setLoading(true)
    apiFetch(`/api/extractions?reviewStatus=${filter}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const openReview = (item: ExtractionItem) => {
    setSelected(item)
    setEditedItems(item.items.map(i => ({ ...i })))
    setAmountInputs(Object.fromEntries(item.items.map((value, index) => [index, value.thresholdAmount === undefined ? '' : String(value.thresholdAmount)])))
    setHasEdits(false)
    setReviewError(null)
    setNotes('')
    setEditing(false)
  }

  const updateItem = (index: number, change: Partial<ExtractionItem['items'][number]>) => {
    setEditedItems(previous => previous.map((item, position) => position === index ? { ...item, ...change } : item))
    setHasEdits(true)
  }

  const submitReview = async (decision: 'approved' | 'rejected' | 'edited') => {
    if (!selected) return
    setReviewError(null)
    setSubmitting(true)
    try {
      const reviewedItems = decision === 'edited' ? editedItems.map((item, index) => {
        const rawAmount = (amountInputs[index] ?? '').trim()
        if (rawAmount && (!/^\d+(?:\.\d+)?$/.test(rawAmount) || !Number.isFinite(Number(rawAmount)) || Number(rawAmount) > 1e12)) {
          throw new Error(`Item ${index + 1}: enter an amount between 0 and 1,000,000,000,000 using digits and a decimal point, or leave it blank.`)
        }
        return { category: item.category, criterion: item.criterion, operator: item.operator, threshold: item.threshold,
          isMandatory: item.isMandatory, sourceSnippet: item.sourceSnippet, confidence: item.confidence,
          ...(rawAmount ? { thresholdAmount: Number(rawAmount) } : {}),
          ...(item.thresholdCurrency?.trim() ? { thresholdCurrency: item.thresholdCurrency.trim().toUpperCase() } : {}),
          ...(item.thresholdUnit?.trim() ? { thresholdUnit: item.thresholdUnit.trim() } : {}),
          ...(item.evaluationMetric?.trim() ? { evaluationMetric: item.evaluationMetric.trim() } : {}),
        }
      }) : undefined
      const res = await apiFetch(`/api/extractions/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes,
          editedItems: reviewedItems,
        }),
      })
      if (res.ok) {
        setSelected(null)
        load()
      } else {
        const error = await res.json()
        throw new Error(error.error ?? 'Could not save the extraction review')
      }
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Could not save the extraction review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-600 dark:text-violet-300" />
          {t("LLM Extraction Review Queue")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every LLM extraction is pending human review until approved. Reviewed requirements stay private to your workspace.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-border'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Queue */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading extractions...")}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No {filter} extractions.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => openReview(item)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <div className={cn(
                  'rounded-md p-1.5 shrink-0',
                  item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' :
                  item.status === 'failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' :
                  'bg-slate-500/10 text-muted-foreground'
                )}>
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{item.taskType}</span>
                    <span className={cn(
                      'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                      item.reviewStatus === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                      item.reviewStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                      item.reviewStatus === 'rejected' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' :
                      'bg-slate-500/15 text-foreground'
                    )}>
                      {item.reviewStatus}
                    </span>
                    {item.model && (
                      <span className="text-[10px] text-violet-700 font-medium dark:text-violet-300">{item.model}</span>
                    )}
                  </div>
                  {item.tender && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.tender.title}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(item.createdAt)}</span>
                    <span>·</span>
                    <span>{item.items.length} items extracted</span>
                    {item.latencyMs && <span>·</span>}
                    {item.latencyMs && <span>{item.latencyMs}ms</span>}
                    {item.costUsd && <span>·</span>}
                    {item.costUsd && <span>${item.costUsd.toFixed(4)}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Review drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-950/30 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl bg-card h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{t("Review Extraction")}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >{t("Close ✕")}</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label={t("Task type")} value={selected.taskType} />
                <Field label={t("Model")} value={selected.model ?? '—'} />
                <Field label={t("Status")} value={selected.status} />
                <Field label={t("Review status")} value={selected.reviewStatus} />
                <Field label={t("Latency")} value={selected.latencyMs ? `${selected.latencyMs}ms` : '—'} />
                <Field label={t("Cost")} value={selected.costUsd ? `$${selected.costUsd.toFixed(4)}` : '—'} />
                <Field label={t("Input tokens")} value={selected.inputTokens?.toString() ?? '—'} />
                <Field label={t("Output tokens")} value={selected.outputTokens?.toString() ?? '—'} />
              </div>

              {selected.tender && (
                <button
                  onClick={() => { openTender(selected.tender!.id); setSelected(null) }}
                  className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 dark:text-sky-300 dark:hover:text-sky-300"
                >
                  <FileText className="h-3 w-3" /> {selected.tender.title}
                </button>
              )}

              {selected.errorMessage && (
                <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all">{selected.errorMessage}</span>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Extracted Items ({selected.items.length})
                  </h3>
                  {selected.reviewStatus === 'pending' && (
                    <button
                      onClick={() => setEditing(!editing)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Edit3 className="h-3 w-3" /> {editing ? 'Stop editing' : 'Edit before approve'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {editedItems.map((item, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.category}
                        </span>
                        {item.isMandatory ? (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">mandatory</span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">optional</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{t("Confidence:")}{' '}{Math.round(item.confidence * 100)}%</span>
                      </div>

                      {editing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            aria-label={`Item ${i + 1} criterion`}
                            value={item.criterion}
                            onChange={(e) => updateItem(i, { criterion: e.target.value })}
                            className="w-full text-sm font-medium border border-border rounded px-2 py-1 outline-none focus:border-slate-400"
                          />
                          <input
                            type="text"
                            aria-label={`Item ${i + 1} original threshold text`}
                            value={item.threshold ?? ''}
                            onChange={(e) => updateItem(i, { threshold: e.target.value })}
                            placeholder={t("Threshold")}
                            className="w-full text-xs border border-border rounded px-2 py-1 outline-none focus:border-slate-400"
                          />
                          <fieldset className="rounded border border-border p-2 space-y-2">
                            <legend className="px-1 text-xs font-medium text-foreground">{t("Structured threshold (optional)")}</legend>
                            <p id={`threshold-help-${i}`} className="text-xs text-muted-foreground">Verify these values against the source. The metric and unit must match verified company evidence; monetary amounts require a currency. Blank amounts remain unknown.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-describedby={`threshold-help-${i}`}>
                              <label className="text-xs text-foreground">{t("Metric")}<input type="text" value={item.evaluationMetric ?? ''} placeholder="annual_turnover" onChange={event => updateItem(i, { evaluationMetric: event.target.value })} className="mt-1 w-full rounded border border-border px-2 py-1" />
                              </label>
                              <label className="text-xs text-foreground">{t("Comparison")}<select value={item.operator ?? ''} onChange={event => updateItem(i, { operator: event.target.value || null })} className="mt-1 w-full rounded border border-border bg-card px-2 py-1">
                                  <option value="">{t("Unknown")}</option>
                                  {['>=', '<=', '==', '>', '<'].map(operator => <option key={operator} value={operator}>{operator}</option>)}
                                  {item.operator && !['>=', '<=', '==', '>', '<'].includes(item.operator) && <option value={item.operator}>{item.operator} {' '}{t("(text rule)")}</option>}
                                </select>
                              </label>
                              <label className="text-xs text-foreground">{t("Amount")}<input type="text" inputMode="decimal" value={amountInputs[i] ?? ''} placeholder={t("Leave blank if unknown")} onChange={event => { setAmountInputs(previous => ({ ...previous, [i]: event.target.value })); setHasEdits(true) }} className="mt-1 w-full rounded border border-border px-2 py-1" />
                              </label>
                              <label className="text-xs text-foreground">{t("Currency")}<input type="text" maxLength={3} value={item.thresholdCurrency ?? ''} placeholder="USD" onChange={event => updateItem(i, { thresholdCurrency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded border border-border px-2 py-1" />
                              </label>
                              <label className="text-xs text-foreground">{t("Unit")}<input type="text" value={item.thresholdUnit ?? ''} placeholder={t("money, years or count")} onChange={event => updateItem(i, { thresholdUnit: event.target.value })} className="mt-1 w-full rounded border border-border px-2 py-1" />
                              </label>
                            </div>
                          </fieldset>
                          <textarea
                            aria-label={`Item ${i + 1} source snippet`}
                            value={item.sourceSnippet}
                            onChange={(e) => updateItem(i, { sourceSnippet: e.target.value })}
                            className="w-full text-xs italic border border-border rounded px-2 py-1 outline-none focus:border-slate-400"
                            rows={2}
                          />
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={item.isMandatory}
                              onChange={(e) => updateItem(i, { isMandatory: e.target.checked })}
                            />
                            {t("Mandatory")}</label>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">{item.criterion}</p>
                          {item.threshold && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.operator} <strong>{item.threshold}</strong>
                            </p>
                          )}
                          {(item.evaluationMetric || item.thresholdAmount !== undefined) && (
                            <p className="text-xs text-muted-foreground mt-1">{t("Structured threshold:")}{' '}{item.evaluationMetric ?? 'Unknown metric'} {item.operator ?? ''} {hasEdits ? amountInputs[i] || 'Unknown amount' : item.thresholdAmount ?? 'Unknown amount'} {item.thresholdCurrency ?? ''} {item.thresholdUnit ?? 'Unknown unit'}</p>
                          )}
                          <p className="text-xs text-muted-foreground italic mt-1.5 leading-relaxed">
                            &ldquo;{item.sourceSnippet}&rdquo;
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Review notes */}
              {selected.reviewStatus === 'pending' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{t("Review notes (optional)")}</label>
                  <textarea
                    aria-label={t("Review notes")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("Add notes for the audit trail...")}
                    className="w-full text-sm border border-border rounded-md px-3 py-2 outline-none focus:border-slate-400"
                    rows={3}
                  />
                </div>
              )}

              {/* Actions */}
              {reviewError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{reviewError}</p>}
              {selected.reviewStatus === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => submitReview(hasEdits ? 'edited' : 'approved')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {hasEdits ? 'Approve edited requirements' : 'Approve reviewed requirements'}
                  </button>
                  {editing && (
                    <button
                      onClick={() => submitReview('edited')}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> {t("Submit edited")}</button>
                  )}
                  <button
                    onClick={() => submitReview('rejected')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md border border-rose-500/30 text-rose-700 px-3 py-2 text-xs font-medium hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> {t("Reject")}</button>
                </div>
              )}

              {selected.reviewStatus !== 'pending' && (
                <div className="rounded-md border border-border bg-muted p-3 text-xs">
                  <p className="font-medium text-foreground">{t("Reviewed by")}{' '}{selected.reviewedBy?.email ?? '—'} on {selected.reviewedAt ? formatDateTime(selected.reviewedAt) : '—'}</p>
                  {selected.reviewNotes && <p className="text-muted-foreground mt-1">{selected.reviewNotes}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{value}</dd>
    </div>
  )
}
