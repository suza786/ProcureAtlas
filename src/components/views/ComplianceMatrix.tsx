'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  formatDate,
  statusColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  FileCheck2,
  Shield,
  Link2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react'

interface ComplianceItem {
  id: string
  status: string
  evidenceValid: boolean
  notes: string | null
  evidenceText: string | null
  confidence: number
  owner: string | null
  dueAt: string | null
  requirement: {
    id: string
    criterion: string
    category: string
    isMandatory: boolean
    threshold: string | null
    operator: string | null
    sourceDoc: string | null
    sourcePage: number | null
    sourceClause: string | null
    extractedText: string | null
  }
  evidence: { id: string; title: string; category: string } | null
}

interface ComplianceMatrixData {
  pursuitId: string
  tenderTitle: string
  tenderId: string
  items: ComplianceItem[]
  summary: {
    total: number
    compliant: number
    partial: number
    gap: number
    not_applicable: number
    coveragePct: number
  }
}

export function ComplianceMatrix({ pursuitId }: { pursuitId: string }) {
  const { t } = useTranslation()

  const [data, setData] = useState<ComplianceMatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'compliant' | 'partial' | 'gap' | 'not_applicable'>('all')
  const goPursuits = useAppStore((s) => s.goPursuits)

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/pursuits/${pursuitId}/compliance`)
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Unable to load compliance')
        return result
      })
      .then(result => { if (!cancelled) setData(result) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pursuitId])
  if (loading || (data && data.pursuitId !== pursuitId)) return <div className="p-6 text-sm text-slate-500">{t("Loading Compliance Matrix...")}</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">{t("Pursuit not found.")}</div>

  const filteredItems = filter === 'all' ? data.items : data.items.filter(i => i.status === filter)

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={goPursuits}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("Back to Pursuits")}</button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <FileCheck2 className="h-6 w-6 text-emerald-600" />
          {t("Compliance Matrix")}</h1>
        <p className="text-sm text-slate-500 mt-1">{data.tenderTitle}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label={t("Total Requirements")} value={data.summary.total} tone="slate" icon={FileCheck2} />
        <SummaryTile label={t("Compliant")} value={data.summary.compliant} tone="emerald" icon={CheckCircle2} />
        <SummaryTile label={t("Partial")} value={data.summary.partial} tone="amber" icon={Circle} />
        <SummaryTile label={t("Gap")} value={data.summary.gap} tone="rose" icon={XCircle} />
        <SummaryTile label={t("Coverage")} value={`${data.summary.coveragePct}%`} tone="violet" icon={Shield} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'compliant', 'partial', 'gap', 'not_applicable'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
              filter === f
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {f === 'all' ? 'All' : f === 'not_applicable' ? 'N/A' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Matrix table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Requirement")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Category")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Mandatory")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Threshold")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Source")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Evidence")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t("No items match this filter.")}</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm font-medium text-slate-900">{item.requirement.criterion}</p>
                      {item.requirement.extractedText && (
                        <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">
                          &ldquo;{item.requirement.extractedText}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.requirement.category}
                      </span>
                      {item.status === 'compliant' && !item.evidenceValid && <p className="text-xs text-rose-600 mt-1">{t("Evidence needs verification or renewal.")}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {item.requirement.isMandatory ? (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">mandatory</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">optional</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {item.requirement.operator && <span className="text-slate-400">{item.requirement.operator} </span>}
                      {item.requirement.threshold ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-[10px] text-slate-500">
                      {item.requirement.sourceDoc && <div>{item.requirement.sourceDoc}</div>}
                      {item.requirement.sourcePage && <div>p.{item.requirement.sourcePage}</div>}
                      {item.requirement.sourceClause && <div>§ {item.requirement.sourceClause}</div>}
                      {!item.requirement.sourceDoc && !item.requirement.sourcePage && !item.requirement.sourceClause && <span>—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {item.evidence ? (
                        <div className="flex items-start gap-1.5">
                          <Link2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="text-slate-700">{item.evidence.title}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {t("No evidence")}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border', statusColor(item.status))}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <strong className="text-slate-900">{t("Principle:")}</strong> Evidence before AI.
        Statuses and links reflect saved compliance records. Evidence warnings identify records that need review.
      </div>
    </div>
  )
}

function SummaryTile({ label, value, tone, icon: Icon }: {
  label: string
  value: number | string
  tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'violet'
  icon: React.ElementType
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    slate: 'text-slate-600 bg-slate-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
