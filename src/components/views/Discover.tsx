'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import {
  formatUSD,
  formatDate,
  daysUntil,
  deadlineUrgency,
  marketLabel,
  marketColor,
  sectorColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ArrowRight, Filter, X, Radar } from 'lucide-react'

interface TenderListItem {
  id: string
  externalId: string | null
  sourcePortal: string
  sourceUrl: string
  title: string
  titleLocal: string | null
  country: string
  market: string
  sector: string
  procurementMethod: string | null
  noticeType: string | null
  currency: string
  estimatedValue: number | null
  valueUSD: number | null
  publishedAt: string | null
  submissionDeadline: string | null
  questionDeadline: string | null
  status: string
  buyer: string | null
  requirementCount: number
  amendmentCount: number
  lotCount: number
  confidence: number
}

interface TendersResponse {
  total: number
  limit: number
  offset: number
  items: TenderListItem[]
}

const MARKETS = ['all', 'BD', 'SG', 'WB', 'ADB', 'UN', 'EU', 'US']
const SECTORS = ['all', 'Cyber', 'IT', 'Consulting', 'Construction', 'Health', 'Engineering', 'Goods', 'Services']

export function Discover() {
  const [data, setData] = useState<TendersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filters = useAppStore((s) => s.discoverFilters)
  const setFilters = useAppStore((s) => s.setDiscoverFilters)
  const openTender = useAppStore((s) => s.openTender)

  useEffect(() => {
    let cancelled = false
    // Defer setLoading to avoid synchronous setState in effect (react-hooks/set-state-in-effect)
    Promise.resolve().then(() => !cancelled && setLoading(true))
    const params = new URLSearchParams()
    if (filters.market !== 'all') params.set('market', filters.market)
    if (filters.sector !== 'all') params.set('sector', filters.sector)
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)
    fetch(`/api/tenders?${params.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed')))
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [filters])

  // Compute market counts for the chips at top
  const marketCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    data.items.forEach(t => { counts[t.market] = (counts[t.market] ?? 0) + 1 })
    return counts
  }, [data])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tender Radar</h1>
          <p className="text-sm text-slate-500">
            Live aggregation across {MARKETS.length - 1} markets · {data?.total ?? 0} opportunities matching
          </p>
        </div>
      </div>

      {/* Market filter chips */}
      <div className="flex flex-wrap gap-2">
        {MARKETS.map(m => (
          <button
            key={m}
            onClick={() => setFilters({ market: m })}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
              filters.market === m
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {m === 'all' ? 'All Markets' : marketLabel(m)}
            {marketCounts[m] !== undefined && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                filters.market === m ? 'bg-white/20' : 'bg-slate-100'
              )}>
                {marketCounts[m]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        <select
          value={filters.sector}
          onChange={(e) => setFilters({ sector: e.target.value })}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-slate-400"
        >
          {SECTORS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sectors' : s}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-slate-400"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="awarded">Awarded</option>
          <option value="closed">Closed</option>
        </select>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Search title, buyer, description..."
          className="flex-1 min-w-[12rem] text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-slate-400"
        />
        {(filters.search || filters.sector !== 'all' || filters.status !== 'all' || filters.market !== 'all') && (
          <button
            onClick={() => setFilters({ market: 'all', sector: 'all', status: 'active', search: '' })}
            className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Tender table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading opportunities...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">Error: {error}</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <Radar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No opportunities match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opportunity</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Market</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sector</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Value</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Deadline</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Req.</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((t) => {
                  const urgency = deadlineUrgency(t.submissionDeadline)
                  const days = daysUntil(t.submissionDeadline)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openTender(t.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 max-w-md">
                        <p className="text-sm font-medium text-slate-900 line-clamp-1">{t.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.buyer ?? 'Unknown buyer'} · {t.sourcePortal}
                          {t.amendmentCount > 0 && (
                            <span className="ml-2 text-amber-700 font-medium">· {t.amendmentCount} amendment(s)</span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(t.market))}>
                          {marketLabel(t.market)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(t.sector))}>
                          {t.sector}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-semibold text-slate-900">{formatUSD(t.valueUSD)}</span>
                        {t.currency !== 'USD' && (
                          <span className="block text-[10px] text-slate-500">{formatUSD(t.estimatedValue)} {t.currency}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {t.submissionDeadline ? (
                          <div className="flex flex-col">
                            <span className={cn(
                              'text-xs font-semibold',
                              urgency === 'critical' ? 'text-rose-600' :
                              urgency === 'high' ? 'text-amber-600' :
                              'text-slate-700'
                            )}>
                              {days !== null && days >= 0 ? `${days}d` : 'closed'}
                            </span>
                            <span className="text-[10px] text-slate-500">{formatDate(t.submissionDeadline)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium text-slate-700">{t.requirementCount}</span>
                      </td>
                      <td className="px-2 py-3">
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
