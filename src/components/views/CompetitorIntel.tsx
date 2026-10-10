'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'
import { formatCurrencyAmount } from '@/lib/financial-calculations'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatUSD, formatDate, marketColor, sectorColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Target,
  Search,
  ArrowRight,
  TrendingUp,
  Award,
  Globe,
  Building2,
} from 'lucide-react'
import { DeferredBarChart } from '@/components/charts/deferred-charts'

interface CompetitorItem {
  id: string
  name: string
  country: string | null
  city: string | null
  website: string | null
  isCompetitor: boolean
  isPartner: boolean
  stats: {
    totalAwards: number
    totalAwardValueUSD: number
    averageAwardValueUSD: number | null
    normalizedCount: number
    unnormalizedCount: number
    sectorsWon: Array<[string, number]>
    topBuyers: Array<[string, number]>
  }
  recentAwards: Array<{ id: string; tender: { title: string; sector: string; market: string; valueUSD: number | null }; contractValue: number | null; currency: string; valueUSD: number | null; awardedAt: string }>
}

interface CompetitorDetail {
  id: string
  name: string
  country: string | null
  city: string | null
  website: string | null
  isCompetitor: boolean
  isPartner: boolean
  stats: {
    totalAwards: number
    totalAwardValueUSD: number
    averageAwardValueUSD: number | null
    normalizedCount: number
    unnormalizedCount: number
    firstAwardAt: string | null
    lastAwardAt: string | null
  }
  topBuyers: Array<{ name: string; country: string | null; awardCount: number; totalValue: number }>
  sectorBreakdown: Array<{ sector: string; count: number; totalValue: number }>
  marketBreakdown: Array<{ market: string; count: number; totalValue: number }>
  winTrend: Array<{ year: string; count: number; totalValue: number }>
  awardHistory: Array<{
    id: string
    tender: { id: string; title: string; sector: string; market: string; country: string; valueUSD: number | null; buyer: { organization: { name: string } } | null }
    contractValue: number | null
    valueUSD: number | null
    currency: string
    awardedAt: string
    contractNo: string | null
  }>
}

export function CompetitorIntel() {
  const { t } = useTranslation()

  const [search, setSearch] = useState('')
  const openCompetitorDetail = useAppStore((s) => s.openCompetitorDetail)

  const { data, loading, error, refetch } = useApiQuery<{ items: CompetitorItem[] }>(
    `/api/competitors?${new URLSearchParams(search ? { search } : {})}`, { debounceMs: 300 }
  )
  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Target className="h-6 w-6 text-slate-700" />
          {t("Competitor Intelligence")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Supplier profiles with award history, win rates, sector breakdowns, and buyer relationships.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <Search className="h-3.5 w-3.5 text-slate-400 ml-1" />
        <input
          type="search"
          aria-label={t("Search competitors")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search competitors by name or country...")}
          className="flex-1 text-xs outline-none bg-transparent"
        />
        <span className="text-xs text-slate-500">{items.length} suppliers</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {error ? (
          <div role="alert" className="p-8 text-sm text-rose-700">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>
        ) : loading ? (
          <div className="col-span-2 p-8 text-center text-sm text-slate-500">{t("Loading competitors...")}</div>
        ) : items.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-sm text-slate-500">{t("No competitors found.")}</div>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              onClick={() => openCompetitorDetail(c.id)}
              className="text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-500">{[c.city, c.country].filter(Boolean).join(', ')}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {c.isCompetitor && (
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">competitor</span>
                  )}
                  {c.isPartner && (
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">partner</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Awards")}</p>
                  <p className="text-sm font-semibold text-slate-900">{c.stats.totalAwards}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Total Value")}</p>
                  <p className="text-sm font-semibold text-slate-900">{c.stats.normalizedCount ? formatUSD(c.stats.totalAwardValueUSD) : t("Unknown")}</p>
                  {c.stats.unnormalizedCount > 0 && <p className="text-xs text-slate-500">{c.stats.unnormalizedCount} without FX</p>}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Avg Value")}</p>
                  <p className="text-sm font-semibold text-slate-900">{formatUSD(c.stats.averageAwardValueUSD)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {c.stats.sectorsWon.slice(0, 3).map(([sector, count]) => (
                  <span key={sector} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(sector))}>
                    {sector} ({count})
                  </span>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{t("Top Buyers")}</p>
                <div className="space-y-0.5">
                  {c.stats.topBuyers.slice(0, 3).map(([buyer, count]) => (
                    <div key={buyer} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate">{buyer}</span>
                      <span className="text-slate-500 ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export function CompetitorDetail({ organizationId }: { organizationId: string }) {
  const { t, formatDate } = useTranslation()

  const goCompetitorIntel = useAppStore((s) => s.goCompetitorIntel)

  const { data, loading, error, refetch } = useApiQuery<CompetitorDetail>(`/api/competitors/${organizationId}`)

  if (loading) return <div className="p-6 text-sm text-slate-500">{t("Loading competitor profile...")}</div>
  if (error) return <div role="alert" className="p-6 text-sm text-rose-700">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>
  if (!data) return <div className="p-6 text-sm text-rose-600">{t("Competitor not found.")}</div>

  return (
    <div className="space-y-4">
      <button onClick={goCompetitorIntel} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" /> {t("Back to Competitors")}</button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{data.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {[data.city, data.country].filter(Boolean).join(', ')}
            {data.website && <span> · <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900">{data.website}</a></span>}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {data.isCompetitor && <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">competitor</span>}
          {data.isPartner && <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">partner</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Award} label={t("Total Awards")} value={data.stats.totalAwards.toString()} tone="emerald" />
        <StatTile icon={TrendingUp} label={t("Total Value")} value={data.stats.normalizedCount ? formatUSD(data.stats.totalAwardValueUSD) : t("Unknown")} tone="violet" />
        <StatTile icon={TrendingUp} label={t("Avg Value")} value={formatUSD(data.stats.averageAwardValueUSD)} tone="sky" />
        <StatTile icon={Building2} label={t("Active Since")} value={data.stats.firstAwardAt ? formatDate(data.stats.firstAwardAt) : '—'} tone="amber" />
      </div>

      {/* Win trend chart */}
      {data.winTrend.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Win Trend by Year")}</h2>
          <div className="h-48">
            <DeferredBarChart label={t("Win Trend by Year")} data={data.winTrend.map(item => ({ year: item.year, awards: item.count, value: Math.round(item.totalValue / 1000) }))} xKey="year" series={[{ key: "awards", label: t("Awards"), color: "#0f172a" }]} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top buyers */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sky-600" />
              {t("Top Buyers")}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.topBuyers.map((b, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.country} · {b.awardCount} award(s)</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatUSD(b.totalValue)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sector breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="h-4 w-4 text-violet-600" />
              {t("Sector Breakdown")}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.sectorBreakdown.map((s) => (
              <div key={s.sector} className="px-4 py-2.5 flex items-center justify-between">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(s.sector))}>{s.sector}</span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatUSD(s.totalValue)}</p>
                  <p className="text-[10px] text-slate-500">{s.count} award(s)</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Award history */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Award History ({data.awardHistory.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Tender")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Buyer")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Market")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">{t("Value")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Awarded")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.awardHistory.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 max-w-xs truncate">{a.tender.title}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{a.tender.buyer?.organization?.name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(a.tender.market))}>
                      {a.tender.market}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900">{a.valueUSD == null ? 'Unknown USD value' : formatUSD(a.valueUSD)}<p className="text-xs font-normal text-slate-500">{formatCurrencyAmount(a.contractValue, a.currency)}</p></td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(a.awardedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, tone }: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'emerald' | 'sky' | 'violet' | 'amber'
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
