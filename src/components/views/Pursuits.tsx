'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'

import { useAppStore } from '@/lib/store'
import {
  formatUSD,
  formatDate,
  daysUntil,
  marketLabel,
  marketColor,
  stageColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Target,
  ArrowRight,
  Plus,
  TrendingUp,
} from 'lucide-react'

interface PursuitListItem {
  id: string
  stage: string
  bidDecision: string | null
  decisionReason: string | null
  priority: string
  estimatedValueUSD: number | null
  winProbability: number | null
  createdAt: string
  updatedAt: string
  tender: {
    id: string
    title: string
    market: string
    sector: string
    country: string
    submissionDeadline: string | null
    valueUSD: number | null
    buyer: string | null
  }
  company: { id: string; name: string }
  bid: { id: string; status: string; submissionReady: boolean; taskCount: number; tasks: Array<{ id: string; title: string; status: string }> } | null
  counts: { compliance: number; tasks: number; approvals: number }
}

const PIPELINE_COLUMNS = [
  { id: 'discovering', label: 'Discovering', color: 'slate' },
  { id: 'qualifying', label: 'Qualifying', color: 'sky' },
  { id: 'bidding', label: 'Bidding', color: 'amber' },
  { id: 'submitted', label: 'Submitted', color: 'violet' },
  { id: 'won', label: 'Won', color: 'emerald' },
  { id: 'lost', label: 'Lost / No-Bid', color: 'rose' },
] as const

export function Pursuits() {
  const { t, formatDateTime } = useTranslation()

  const openBidRoom = useAppStore((s) => s.openBidRoom)

  const { data, loading, error, refetch } = useApiQuery<{ items: PursuitListItem[] }>('/api/pursuits')
  const items = data?.items ?? []

  if (error) return <div role="alert" className="p-6 text-sm text-rose-700">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>
  if (loading) return <div className="p-6 text-sm text-slate-500">{t("Loading pursuits...")}</div>

  const totalValue = items.reduce((acc, p) => acc + (p.estimatedValueUSD ?? 0), 0)
  const wonCount = items.filter(p => p.stage === 'won').length
  const lostCount = items.filter(p => p.stage === 'lost' || p.stage === 'no_bid').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-slate-700" />
            {t("Pursuits Pipeline")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} total · {formatUSD(totalValue)} pipeline value · {wonCount}W / {lostCount}L
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          onClick={() => useAppStore.getState().goDiscover()}
        >
          <Plus className="h-3.5 w-3.5" /> {t("New Pursuit")}</button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
        {PIPELINE_COLUMNS.map(col => {
          const colItems = items.filter(p =>
            col.id === 'lost'
              ? p.stage === 'lost' || p.stage === 'no_bid'
              : p.stage === col.id
          )
          const colValue = colItems.reduce((acc, p) => acc + (p.estimatedValueUSD ?? 0), 0)
          return (
            <div key={col.id} className="rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col min-w-[14rem]">
              <div className="px-3 py-2.5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">{col.label}</h3>
                  <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 rounded bg-white">{colItems.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{formatUSD(colValue)}</p>
                )}
              </div>
              <div className="flex-1 p-2 space-y-2 max-h-[28rem] overflow-y-auto">
                {colItems.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-slate-400">{t("No pursuits")}</div>
                ) : (
                  colItems.map(p => {
                    const days = daysUntil(p.tender.submissionDeadline)
                    return (
                      <button
                        key={p.id}
                        onClick={() => openBidRoom(p.id)}
                            className="w-full text-left rounded-md border border-slate-200 bg-white p-2.5 hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={cn('text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', marketColor(p.tender.market))}>
                            {marketLabel(p.tender.market)}
                          </span>
                          {p.priority === 'strategic' && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700">strategic</span>
                          )}
                          {p.priority === 'high' && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">high</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-900 line-clamp-2">{p.tender.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                          <span>{formatUSD(p.estimatedValueUSD ?? p.tender.valueUSD)}</span>
                          {p.bid && <span>· {p.bid.taskCount} tasks</span>}
                          <span>· {p.counts.compliance} req</span>
                        </div>
                        {p.tender.submissionDeadline && days !== null && days >= 0 && (
                          <div className="mt-1.5 text-[10px] flex items-center gap-1">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded font-medium',
                              days <= 7 ? 'bg-rose-500/15 text-rose-700' :
                              days <= 14 ? 'bg-amber-500/15 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            )}>
                              {days}d to deadline
                            </span>
                          </div>
                        )}
                        {p.winProbability !== null && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                              <span className="flex items-center gap-0.5">
                                <TrendingUp className="h-2.5 w-2.5" />
                                {t("Win prob.")}</span>
                              <span className="font-medium text-slate-700">{Math.round(p.winProbability * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${p.winProbability * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* List view */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t("All Pursuits")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Tender")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Market")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Stage")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Decision")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">{t("Value")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Deadline")}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(p => {
                const days = daysUntil(p.tender.submissionDeadline)
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 max-w-md">
                      <button type="button" onClick={() => openBidRoom(p.id)} className="text-left text-sm font-medium text-slate-900 line-clamp-1 hover:underline focus-visible:outline focus-visible:outline-2">{p.tender.title}</button>
                      <p className="text-xs text-slate-500 mt-0.5">{p.tender.buyer ?? 'Unknown buyer'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(p.tender.market))}>
                        {marketLabel(p.tender.market)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border', stageColor(p.stage))}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {p.bidDecision && p.bidDecision !== 'pending' ? (
                        <span className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          p.bidDecision === 'bid' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
                        )}>
                          {p.bidDecision}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">pending</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-900">{formatUSD(p.estimatedValueUSD ?? p.tender.valueUSD)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {p.tender.submissionDeadline ? (
                        <div>
                          <p>{formatDateTime(p.tender.submissionDeadline)}</p>
                          {days !== null && days >= 0 && <p className="text-[10px] text-slate-400">{days}d remaining</p>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-3"><ArrowRight className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
