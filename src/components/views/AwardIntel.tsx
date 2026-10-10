'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'
import { formatCurrencyAmount } from '@/lib/financial-calculations'
import { useState } from 'react'
import { formatUSD, formatDate, marketLabel, marketColor, sectorColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Gavel,
  TrendingUp,
  PieChart,
  BarChart3,
  Globe,
} from 'lucide-react'
import { DeferredBarChart, DeferredDonutChart } from '@/components/charts/deferred-charts'

interface AwardData {
  total: number
  totalValueUSD: number
  averageValueUSD: number | null
  normalizedCount: number
  unnormalizedCount: number
  distinctWinnerCount: number
  byMarket: Array<{ market: string; count: number; totalValue: number }>
  bySector: Array<{ sector: string; count: number; totalValue: number }>
  marketShare: Array<{ id: string; name: string; country: string | null; awardCount: number; totalValue: number }>
  items: Array<{
    id: string
    supplier: { id: string; name: string; country: string | null }
    tender: { id: string; title: string; market: string; sector: string; country: string; valueUSD: number | null; buyer: { organization: { name: string } } | null }
    contractValue: number | null
    valueUSD: number | null
    currency: string
    awardedAt: string
    contractNo: string | null
    sourceUrl: string | null
  }>
}

const MARKET_COLORS: Record<string, string> = {
  BD: '#10b981', SG: '#f43f5e', WB: '#0ea5e9', ADB: '#f59e0b',
  UN: '#6366f1', EU: '#8b5cf6', US: '#3b82f6',
}

export function AwardIntel() {
  const { t, formatDate } = useTranslation()

  const [marketFilter, setMarketFilter] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')

  const params = new URLSearchParams()
  if (marketFilter) params.set('market', marketFilter)
  if (sectorFilter) params.set('sector', sectorFilter)
  const { data, loading, error, refetch } = useApiQuery<AwardData>(`/api/awards?${params}`)

  if (loading) return <div className="p-6 text-sm text-slate-500">{t("Loading award intelligence...")}</div>
  if (error) return <div role="alert" className="p-6 text-sm text-rose-600">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>
  if (!data) return <div className="p-6 text-sm text-rose-600">{t("Failed to load.")}</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Gavel className="h-6 w-6 text-slate-700" />
          {t("Award Intelligence")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Award tracking across markets · winner analysis · contract value benchmarking · market share.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={Gavel} label={t("Total Awards")} value={data.total.toString()} tone="emerald" />
        <KpiTile icon={TrendingUp} label={t("Known Value (USD)")} value={data.normalizedCount ? formatUSD(data.totalValueUSD) : t("Unknown")} tone="violet" />
        <KpiTile icon={BarChart3} label={t("Known Avg (USD)")} value={data.averageValueUSD == null ? t("Unknown") : formatUSD(data.averageValueUSD)} tone="sky" />
        <KpiTile icon={PieChart} label={t("Distinct Winners")} value={data.distinctWinnerCount.toString()} tone="amber" />
      </div>

      <p className="text-xs text-slate-500">USD values cover {data.normalizedCount} of {data.total} awards; {data.unnormalizedCount} without a known USD value are excluded from value totals, averages and shares.</p>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          aria-label={t("Award market")} value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5"
        >
          <option value="">{t("All Markets")}</option>
          {['BD', 'SG', 'WB', 'ADB', 'UN', 'EU', 'US'].map(m => <option key={m} value={m}>{marketLabel(m)}</option>)}
        </select>
        <select
          aria-label={t("Award sector")} value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5"
        >
          <option value="">{t("All Sectors")}</option>
          {['Cyber', 'IT', 'Consulting', 'Construction', 'Health', 'Engineering'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Awards by Market")}</h2>
          <div className="h-56">
            <DeferredBarChart label={t("Awards by Market")} data={data.byMarket.map(m => ({ market: marketLabel(m.market), count: m.count, value: Math.round(m.totalValue / 1000) }))} xKey="market" series={[{ key: "count", label: t("Awards"), color: "#0f172a" }]} tickSize={10} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Share of Known Award Value (USD K)")}</h2>
          <div className="h-56">
            <DeferredDonutChart label={t("Share of Known Award Value (USD K)")} data={[...data.marketShare.slice(0, 6).map(s => ({ name: s.name, value: s.totalValue / 1000 })), ...(data.marketShare.length > 6 ? [{ name: t("Other suppliers"), value: data.marketShare.slice(6).reduce((sum, s) => sum + s.totalValue, 0) / 1000 }] : [])]} colors={Object.values(MARKET_COLORS)} outerRadius={70} innerRadius={35} legendSize={10} valueFormatter={value => `$${value}K`} valueLabel={t("Value")} />
          </div>
        </div>
      </div>

      {/* Market share table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            {t("Top Suppliers by Award Value")}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {data.marketShare.slice(0, 10).map((s, i) => {
            const pct = data.totalValueUSD > 0 ? (s.totalValue / data.totalValueUSD) * 100 : 0
            return (
              <div key={s.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                    <span className="text-[10px] text-slate-500">{s.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{s.awardCount} award(s)</span>
                    <span className="text-sm font-semibold text-slate-900">{formatUSD(s.totalValue)}</span>
                    <span className="text-xs text-slate-500 w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 ml-6">
                  <div className="bg-violet-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Award list */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t("Recent Awards")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Tender")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Supplier")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Market")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Sector")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">{t("Value")}</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Awarded")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 max-w-xs">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.tender.title}</p>
                    <p className="text-xs text-slate-500">{a.tender.buyer?.organization?.name ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{a.supplier.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(a.tender.market))}>
                      {marketLabel(a.tender.market)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(a.tender.sector))}>{a.tender.sector}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900">{formatCurrencyAmount(a.contractValue, a.currency)}<div className="text-[10px] font-normal text-slate-500">{a.valueUSD == null ? 'USD unknown' : `${formatUSD(a.valueUSD)} normalized`}</div></td>
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

function KpiTile({ icon: Icon, label, value, tone }: {
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
