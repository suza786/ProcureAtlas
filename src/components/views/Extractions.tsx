'use client'

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
  const [items, setItems] = useState<ExtractionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selected, setSelected] = useState<ExtractionItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedItems, setEditedItems] = useState<ExtractionItem['items']>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const openTender = useAppStore((s) => s.openTender)

  const load = () => {
    setLoading(true)
    fetch(`/api/extractions?reviewStatus=${filter}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const openReview = (item: ExtractionItem) => {
    setSelected(item)
    setEditedItems(item.items.map(i => ({ ...i })))
    setNotes('')
    setEditing(false)
  }

  const submitReview = async (decision: 'approved' | 'rejected' | 'edited') => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/extractions/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes,
          editedItems: decision === 'edited' ? editedItems : undefined,
        }),
      })
      if (res.ok) {
        setSelected(null)
        load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-600" />
          LLM Extraction Review Queue
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every LLM extraction is pending human review until approved. Nothing reaches the Requirement table without explicit approval.
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
              filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Queue */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading extractions...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Brain className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No {filter} extractions.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => openReview(item)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className={cn(
                  'rounded-md p-1.5 shrink-0',
                  item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                  item.status === 'failed' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-slate-500/10 text-slate-600'
                )}>
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{item.taskType}</span>
                    <span className={cn(
                      'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                      item.reviewStatus === 'pending' ? 'bg-amber-500/15 text-amber-700' :
                      item.reviewStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-700' :
                      item.reviewStatus === 'rejected' ? 'bg-rose-500/15 text-rose-700' :
                      'bg-slate-500/15 text-slate-700'
                    )}>
                      {item.reviewStatus}
                    </span>
                    {item.model && (
                      <span className="text-[10px] text-violet-700 font-medium">{item.model}</span>
                    )}
                  </div>
                  {item.tender && (
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {item.tender.title}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span>{formatDateTime(item.createdAt)}</span>
                    <span>·</span>
                    <span>{item.items.length} items extracted</span>
                    {item.latencyMs && <span>·</span>}
                    {item.latencyMs && <span>{item.latencyMs}ms</span>}
                    {item.costUsd && <span>·</span>}
                    {item.costUsd && <span>${item.costUsd.toFixed(4)}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Review drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl bg-white h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Review Extraction</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-900 text-xs"
              >Close ✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Task type" value={selected.taskType} />
                <Field label="Model" value={selected.model ?? '—'} />
                <Field label="Status" value={selected.status} />
                <Field label="Review status" value={selected.reviewStatus} />
                <Field label="Latency" value={selected.latencyMs ? `${selected.latencyMs}ms` : '—'} />
                <Field label="Cost" value={selected.costUsd ? `$${selected.costUsd.toFixed(4)}` : '—'} />
                <Field label="Input tokens" value={selected.inputTokens?.toString() ?? '—'} />
                <Field label="Output tokens" value={selected.outputTokens?.toString() ?? '—'} />
              </div>

              {selected.tender && (
                <button
                  onClick={() => { openTender(selected.tender!.id); setSelected(null) }}
                  className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" /> {selected.tender.title}
                </button>
              )}

              {selected.errorMessage && (
                <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all">{selected.errorMessage}</span>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Extracted Items ({selected.items.length})
                  </h3>
                  {selected.reviewStatus === 'pending' && (
                    <button
                      onClick={() => setEditing(!editing)}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      <Edit3 className="h-3 w-3" /> {editing ? 'Stop editing' : 'Edit before approve'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {editedItems.map((item, i) => (
                    <div key={i} className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                        {item.isMandatory ? (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">mandatory</span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">optional</span>
                        )}
                        <span className="text-[10px] text-slate-500 ml-auto">Confidence: {Math.round(item.confidence * 100)}%</span>
                      </div>

                      {editing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.criterion}
                            onChange={(e) => {
                              const next = [...editedItems]
                              next[i] = { ...next[i], criterion: e.target.value }
                              setEditedItems(next)
                            }}
                            className="w-full text-sm font-medium border border-slate-200 rounded px-2 py-1 outline-none focus:border-slate-400"
                          />
                          <input
                            type="text"
                            value={item.threshold ?? ''}
                            onChange={(e) => {
                              const next = [...editedItems]
                              next[i] = { ...next[i], threshold: e.target.value }
                              setEditedItems(next)
                            }}
                            placeholder="Threshold"
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-slate-400"
                          />
                          <textarea
                            value={item.sourceSnippet}
                            onChange={(e) => {
                              const next = [...editedItems]
                              next[i] = { ...next[i], sourceSnippet: e.target.value }
                              setEditedItems(next)
                            }}
                            className="w-full text-xs italic border border-slate-200 rounded px-2 py-1 outline-none focus:border-slate-400"
                            rows={2}
                          />
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={item.isMandatory}
                              onChange={(e) => {
                                const next = [...editedItems]
                                next[i] = { ...next[i], isMandatory: e.target.checked }
                                setEditedItems(next)
                              }}
                            />
                            Mandatory
                          </label>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-900">{item.criterion}</p>
                          {item.threshold && (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {item.operator} <strong>{item.threshold}</strong>
                            </p>
                          )}
                          <p className="text-xs text-slate-500 italic mt-1.5 leading-relaxed">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Review notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes for the audit trail..."
                    className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-slate-400"
                    rows={3}
                  />
                </div>
              )}

              {/* Actions */}
              {selected.reviewStatus === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => submitReview('approved')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve & create requirements
                  </button>
                  {editing && (
                    <button
                      onClick={() => submitReview('edited')}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Submit edited
                    </button>
                  )}
                  <button
                    onClick={() => submitReview('rejected')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md border border-rose-500/30 text-rose-700 px-3 py-2 text-xs font-medium hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}

              {selected.reviewStatus !== 'pending' && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-medium text-slate-700">Reviewed by {selected.reviewedBy?.email ?? '—'} on {selected.reviewedAt ? formatDateTime(selected.reviewedAt) : '—'}</p>
                  {selected.reviewNotes && <p className="text-slate-600 mt-1">{selected.reviewNotes}</p>}
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
      <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value}</dd>
    </div>
  )
}
