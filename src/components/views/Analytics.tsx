'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { useTranslation } from '@/hooks/use-translation'
import { DeferredLineChart } from '@/components/charts/deferred-charts'

interface Snapshot {
  date: string
  observedAt: string | null
  activePursuits: number
  biddingPursuits: number
  wonPursuits: number
  lostPursuits: number
  pipelineValueUSD: number
  winRate: number
  llmCallsCount: number
  llmInputTokens: number
  llmOutputTokens: number
  llmCostUsd: number | null
}
interface AnalyticsData {
  current: { activePursuits: number; pipelineValueUSD: number; wonValueUSD: number; winRate: number; llmCalls30d: number; llmCost30d: number | null; pendingProviderCalls: number }
  metadata: { timezone: string; historyDays: number; providerUsageWindowDays: number; observedAt: string }
  history: Snapshot[]
  trends: {
    winRate: Array<{ date: string; winRate: number }>
    pipelineValue: Array<{ date: string; value: number; won: number }>
    llmUsage: Array<{ date: string; calls: number; cost: number | null }>
    evidenceCoverage: Array<{ date: string; coverage: number }>
    bidCycleTime: Array<{ date: string; days: number; wordCount: number }>
  }
}

export function Analytics() {
  const { t, locale } = useTranslation()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    apiFetch('/api/analytics').then(async response => {
      if (!response.ok) throw new Error('Analytics request failed')
      const result = await response.json()
      if (!cancelled) setData(result)
    }).catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const formatUSD = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>
  if (error || !data) return <div role="alert" className="p-6 text-sm text-rose-600 dark:text-rose-300">{t('analytics.loadFailed')}</div>
  const chart = (title: string, rows: Array<{ date: string }>, series: Array<{ key: string; label: string; color: string }>, percent = false) => (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      <div className="h-56">
        <DeferredLineChart label={title} rows={rows} series={series} percent={percent} dateLabel={dateLabel} number={number} />
      </div>
    </section>
  )
  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('analytics.title')}</h1>
      <p className="text-sm text-muted-foreground mt-1">{t('analytics.observedDescription')}</p>
      <p className="text-xs text-muted-foreground mt-1">{t('analytics.dailyUtc')} · {t('analytics.latestWindow')} {number(data.metadata.historyDays)} {t('common.days')} · {t('analytics.providerWindow')} {number(data.metadata.providerUsageWindowDays)} {t('common.days')}</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        [t('cc.activePursuits'), number(data.current.activePursuits)],
        [t('cc.winRate'), `${number(data.current.winRate)}%`],
        [t('cc.pipelineValue'), formatUSD(data.current.pipelineValueUSD)],
        [t('analytics.wonValue'), formatUSD(data.current.wonValueUSD)],
        [t('analytics.calls30d'), number(data.current.llmCalls30d)],
        [t('analytics.cost30d'), data.current.llmCost30d === null ? t('analytics.unknown') : formatUSD(data.current.llmCost30d)],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold text-foreground mt-1">{value}</p></div>)}
    </div>
    {data.current.pendingProviderCalls > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{t('analytics.pendingProviderCalls')}: {number(data.current.pendingProviderCalls)}</p>}
    {!data.history.length ? <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{t('analytics.emptyHistory')}</div> : <>
      {chart(t('analytics.winRateTrend'), data.trends.winRate, [{ key: 'winRate', label: t('cc.winRate'), color: '#10b981' }], true)}
      {chart(t('analytics.pipelineValue'), data.trends.pipelineValue, [{ key: 'value', label: t('analytics.pipelineUsdK'), color: '#8b5cf6' }, { key: 'won', label: t('analytics.wonUsdK'), color: '#10b981' }])}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chart(t('analytics.llmUsage'), data.trends.llmUsage, [{ key: 'calls', label: t('analytics.providerCalls'), color: '#8b5cf6' }])}
        {chart(t('analytics.evidenceCoverage'), data.trends.evidenceCoverage, [{ key: 'coverage', label: t('analytics.verifiedCoverage'), color: '#10b981' }], true)}
      </div>
      {chart(t('analytics.bidCycleTime'), data.trends.bidCycleTime, [{ key: 'days', label: t('analytics.cycleDays'), color: '#0ea5e9' }])}
      {chart(t('analytics.proposalWords'), data.trends.bidCycleTime, [{ key: 'wordCount', label: t('analytics.wordCount'), color: '#f59e0b' }])}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <h2 className="text-sm font-semibold text-foreground px-4 py-3">{t('analytics.dailySnapshots')} ({number(data.history.length)})</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-y border-border bg-muted text-left">{['analytics.dateUtc', 'analytics.observedAtUtc', 'analytics.active', 'analytics.bidding', 'analytics.won', 'analytics.lost', 'cc.pipelineValue', 'cc.winRate', 'analytics.providerCalls', 'analytics.tokens', 'analytics.cost'].map(key => <th key={key} className="px-3 py-2 text-xs font-semibold text-muted-foreground">{t(key)}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{data.history.map(s => <tr key={s.date}>
            <td className="px-3 py-2 whitespace-nowrap">{dateLabel(s.date)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{s.observedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(s.observedAt)) : t('analytics.unknown')}</td>
            <td className="px-3 py-2">{number(s.activePursuits)}</td><td className="px-3 py-2">{number(s.biddingPursuits)}</td><td className="px-3 py-2">{number(s.wonPursuits)}</td><td className="px-3 py-2">{number(s.lostPursuits)}</td>
            <td className="px-3 py-2">{formatUSD(s.pipelineValueUSD)}</td><td className="px-3 py-2">{number(s.winRate)}%</td><td className="px-3 py-2">{number(s.llmCallsCount)}</td><td className="px-3 py-2">{number(s.llmInputTokens + s.llmOutputTokens)}</td><td className="px-3 py-2">{s.llmCostUsd === null ? t('analytics.unknown') : formatUSD(s.llmCostUsd)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </>}
  </div>
}
