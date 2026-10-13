'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'
import { discoverQuery, DISCOVER_PAGE_SIZE } from '@/lib/discover-query'

import { useState, useMemo } from 'react'
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
  const { t, formatDateTime } = useTranslation()

  const filters = useAppStore((s) => s.discoverFilters)
  const setFilters = useAppStore((s) => s.setDiscoverFilters)
  const openTender = useAppStore((s) => s.openTender)
  const filterKey = JSON.stringify(filters)
  const [page, setPage] = useState({ filterKey, offset: 0 })
  const offset = page.filterKey === filterKey ? page.offset : 0

  const { data, loading, error, refetch } = useApiQuery<TendersResponse>(
    `/api/tenders?${discoverQuery(filters, offset)}`, { debounceMs: 300 }
  )

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("Tender Radar")}</h1>
          <p className="text-sm text-muted-foreground">
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
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-border'
            )}
          >
            {m === 'all' ? t("All Markets") : marketLabel(m)}
            {marketCounts[m] !== undefined && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                filters.market === m ? 'bg-card/20' : 'bg-muted'
              )}>
                {marketCounts[m]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {t("Filters")}</div>
        <select
          aria-label={t("Sector")} value={filters.sector}
          onChange={(e) => setFilters({ sector: e.target.value })}
          className="text-xs rounded-md border border-border bg-card px-2 py-1.5 outline-none focus:border-slate-400"
        >
          {SECTORS.map(s => <option key={s} value={s}>{s === 'all' ? t("All Sectors") : s}</option>)}
        </select>
        <select
          aria-label={t("Tender status")} value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="text-xs rounded-md border border-border bg-card px-2 py-1.5 outline-none focus:border-slate-400"
        >
          <option value="all">{t("All Status")}</option>
          <option value="active">{t("Active")}</option>
          <option value="awarded">{t("Awarded")}</option>
          <option value="closed">{t("Closed")}</option>
        </select>
        <input
          type="text"
          aria-label={t("Search tenders")} value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder={t("Search title, buyer, description...")}
          className="flex-1 min-w-[12rem] text-xs rounded-md border border-border bg-card px-2 py-1.5 outline-none focus:border-slate-400"
        />
        {(filters.search || filters.sector !== 'all' || filters.status !== 'all' || filters.market !== 'all') && (
          <button
            onClick={() => setFilters({ market: 'all', sector: 'all', status: 'active', search: '' })}
            className="text-xs text-muted-foreground hover:text-rose-600 flex items-center gap-1 dark:hover:text-rose-300"
          >
            <X className="h-3 w-3" /> {t("Clear")}</button>
        )}
      </div>

      {/* Tender table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading opportunities...")}</div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-600 dark:text-rose-300">{error} <button className="ml-2 underline" onClick={refetch}>{t("Retry")}</button></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <Radar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("No opportunities match your filters.")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Opportunity")}</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Market")}</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Sector")}</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("Value")}</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Deadline")}</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Req.")}</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((t) => {
                  const urgency = deadlineUrgency(t.submissionDeadline)
                  const days = daysUntil(t.submissionDeadline)
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-muted cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 max-w-md">
                        <button type="button" onClick={() => openTender(t.id)} className="text-left text-sm font-medium text-foreground line-clamp-1 hover:underline focus-visible:outline focus-visible:outline-2">{t.title}</button>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.buyer ?? 'Unknown buyer'} · {t.sourcePortal}
                          {t.amendmentCount > 0 && (
                            <span className="ml-2 text-amber-700 font-medium dark:text-amber-300">· {t.amendmentCount} amendment(s)</span>
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
                        <span className="text-sm font-semibold text-foreground">{formatUSD(t.valueUSD)}</span>
                        {t.currency !== 'USD' && (
                          <span className="block text-[10px] text-muted-foreground">{formatUSD(t.estimatedValue)} {t.currency}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {t.submissionDeadline ? (
                          <div className="flex flex-col">
                            <span className={cn(
                              'text-xs font-semibold',
                              urgency === 'critical' ? 'text-rose-600 dark:text-rose-300' :
                              urgency === 'high' ? 'text-amber-600 dark:text-amber-300' :
                              'text-foreground'
                            )}>
                              {days !== null && days >= 0 ? `${days}d` : 'closed'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(t.submissionDeadline)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium text-foreground">{t.requirementCount}</span>
                      </td>
                      <td className="px-2 py-3">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && data && data.total > DISCOVER_PAGE_SIZE && (
        <nav aria-label={t("Opportunity pages")} className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{offset + 1}–{Math.min(offset + data.items.length, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setPage({ filterKey, offset: Math.max(0, offset - DISCOVER_PAGE_SIZE) })} className="rounded border px-3 py-1 disabled:opacity-40">{t("Previous")}</button>
            <button disabled={offset + DISCOVER_PAGE_SIZE >= data.total} onClick={() => setPage({ filterKey, offset: offset + DISCOVER_PAGE_SIZE })} className="rounded border px-3 py-1 disabled:opacity-40">{t("Next")}</button>
          </div>
        </nav>
      )}
    </div>
  )
}
