'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  formatUSD,
  formatDate,
  daysUntil,
  deadlineUrgency,
  marketLabel,
  marketColor,
  severityColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  Target,
  Gavel,
  AlertTriangle,
  Clock,
  Trophy,
  Activity,
  ArrowRight,
} from 'lucide-react'
import { DeferredBarChart, DeferredDonutChart } from '@/components/charts/deferred-charts'

interface DashboardData {
  tenant: { name: string; plan: string; region: string }
  company: { id: string; name: string; country: string; annualTurnoverUSD: number | null } | null
  kpis: {
    activeTenderCount: number
    activePursuits: number
    biddingPursuits: number
    totalPipelineValue: number
    wonCount: number
    lostCount: number
    criticalAlerts: number
    winRate: number
  }
  deadlinesThisWeek: Array<{
    id: string
    title: string
    market: string
    valueUSD: number | null
    submissionDeadline: string
    days: number
  }>
  pipelineDistribution: Record<string, number>
  recentPursuits: Array<{
    id: string
    stage: string
    priority: string
    bidDecision: string | null
    tender: { title: string; submissionDeadline: string | null; valueUSD: number | null; market: string }
    estimatedValueUSD: number | null
  }>
  alerts: Array<{
    id: string
    type: string
    severity: string
    title: string
    message: string
    dueAt: string | null
  }>
  recentAwards: Array<{
    supplier: string
    supplierCountry: string | null
    contractValue: number | null
    currency: string
    awardedAt: string
    tender: { title: string; market: string; sector: string }
  }>
}

const STAGE_COLORS: Record<string, string> = {
  discovering: '#94a3b8',
  qualifying: '#0ea5e9',
  bidding: '#f59e0b',
  submitted: '#8b5cf6',
  won: '#10b981',
  lost: '#ef4444',
  no_bid: '#cbd5e1',
}

export function CommandCenter() {
  const { t, formatDateTime, formatDate } = useTranslation()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const openTender = useAppStore((s) => s.openTender)
  const openBidRoom = useAppStore((s) => s.openBidRoom)
  const goPursuits = useAppStore((s) => s.goPursuits)
  const goDiscover = useAppStore((s) => s.goDiscover)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/dashboard')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed')))
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <CommandCenterSkeleton />
  if (error || !data) {
    return (
      <div className="p-6 text-sm text-rose-700">
        {t("Failed to load dashboard:")}{error}
      </div>
    )
  }

  const pipelineData = Object.entries(data.pipelineDistribution)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, fill: STAGE_COLORS[k] ?? '#94a3b8' }))

  const marketValueData = (() => {
    // Aggregate recent pursuits + tenders by market for the bar chart
    const byMarket: Record<string, number> = {}
    data.recentPursuits.forEach(p => {
      const m = p.tender.market
      byMarket[m] = (byMarket[m] ?? 0) + (p.estimatedValueUSD ?? p.tender.valueUSD ?? 0)
    })
    return Object.entries(byMarket).map(([k, v]) => ({ market: marketLabel(k), value: Math.round(v / 1000) }))
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("Command Center")}</h1>
        <p className="text-sm text-slate-500">
          {data.tenant.name} · {data.tenant.plan} plan · {data.company?.name ?? 'No company profile'}
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiTile
          label={t("Active Tenders")}
          value={data.kpis.activeTenderCount.toString()}
          icon={Activity}
          tone="emerald"
          subtitle="Across 7 markets"
          onClick={goDiscover}
        />
        <KpiTile
          label={t("Active Pursuits")}
          value={data.kpis.activePursuits.toString()}
          icon={Target}
          tone="sky"
          subtitle={`${data.kpis.biddingPursuits} in active bidding`}
          onClick={goPursuits}
        />
        <KpiTile
          label={t("Pipeline Value")}
          value={formatUSD(data.kpis.totalPipelineValue)}
          icon={TrendingUp}
          tone="violet"
          subtitle="Estimated"
        />
        <KpiTile
          label={t("Win Rate")}
          value={`${data.kpis.winRate}%`}
          icon={Trophy}
          tone="emerald"
          subtitle={`${data.kpis.wonCount}W / ${data.kpis.lostCount}L`}
        />
        <KpiTile
          label={t("Critical Alerts")}
          value={data.kpis.criticalAlerts.toString()}
          icon={AlertTriangle}
          tone="rose"
          subtitle="Needs attention"
        />
        <KpiTile
          label={t("Deadlines (7d)")}
          value={data.deadlinesThisWeek.length.toString()}
          icon={Clock}
          tone="amber"
          subtitle="This week"
        />
        <KpiTile
          label={t("Recent Awards")}
          value={data.recentAwards.length.toString()}
          icon={Gavel}
          tone="slate"
          subtitle="In intelligence"
        />
      </div>

      {/* Main grid: deadlines + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deadlines this week */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("Deadlines — Next 7 Days")}</h2>
            <button onClick={goDiscover} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              {t("View all")}<ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.deadlinesThisWeek.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {t("No deadlines in the next 7 days.")}</div>
            ) : (
              data.deadlinesThisWeek.map((d) => {
                const urgency = deadlineUrgency(d.submissionDeadline)
                return (
                  <button
                    key={d.id}
                    onClick={() => openTender(d.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className={cn(
                      'flex h-10 w-12 flex-col items-center justify-center rounded-md text-xs font-semibold',
                      urgency === 'critical' ? 'bg-rose-500 text-white' :
                      urgency === 'high' ? 'bg-amber-500 text-white' :
                      'bg-slate-100 text-slate-700'
                    )}>
                      <span className="text-base leading-none">{d.days}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">{t("days")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(d.market))}>
                          {marketLabel(d.market)}
                        </span>
                        <span className="text-xs text-slate-500">{formatUSD(d.valueUSD)}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{formatDateTime(d.submissionDeadline)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Active alerts */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("Active Alerts")}</h2>
            <span className="text-xs text-slate-500">{data.alerts.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
            {data.alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">{t("No active alerts.")}</div>
            ) : (
              data.alerts.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={cn('text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5', severityColor(a.severity))}>
                      {a.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.message}</p>
                      {a.dueAt && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {t("Due")}{formatDateTime(a.dueAt)} ({daysUntil(a.dueAt)}d)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Charts: pipeline + market value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Pipeline Distribution")}</h2>
          <div className="h-64">
            <DeferredDonutChart label={t("Pipeline Distribution")} data={pipelineData} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Pipeline Value by Market (USD K)")}</h2>
          <div className="h-64">
            {marketValueData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                {t("No pursuit data yet.")}</div>
            ) : (
              <DeferredBarChart label={t("Pipeline Value by Market (USD K)")} data={marketValueData} xKey="market" series={[{ key: "value", label: t("Pipeline Value"), color: "#0f172a" }]} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} valueFormatter={value => `$${value}K`} />
            )}
          </div>
        </div>
      </div>

      {/* Recent pursuits + Recent awards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("Recent Pursuits")}</h2>
            <button onClick={goPursuits} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              {t("View all")}<ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentPursuits.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">{t("No pursuits yet.")}</div>
            ) : (
              data.recentPursuits.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openBidRoom(p.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className={cn(
                    'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0',
                    p.stage === 'bidding' ? 'bg-amber-500/15 text-amber-700' :
                    p.stage === 'qualifying' ? 'bg-sky-500/15 text-sky-700' :
                    p.stage === 'discovering' ? 'bg-slate-500/15 text-slate-700' :
                    'bg-gray-500/15 text-gray-700'
                  )}>
                    {p.stage}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.tender.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(p.tender.market))}>
                        {marketLabel(p.tender.market)}
                      </span>
                      <span className="text-xs text-slate-500">{formatUSD(p.estimatedValueUSD ?? p.tender.valueUSD)}</span>
                      {p.tender.submissionDeadline && (
                        <span className="text-xs text-slate-400">·</span>
                      )}
                      {p.tender.submissionDeadline && (
                        <span className="text-xs text-slate-500">{t("Due")}{' '}{formatDateTime(p.tender.submissionDeadline)}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("Recent Awards (Intelligence)")}</h2>
            <span className="text-xs text-slate-500">Award Intel · Phase 3</span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentAwards.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">{t("No award intelligence yet.")}</div>
            ) : (
              data.recentAwards.map((a, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.tender.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(a.tender.market))}>
                      {marketLabel(a.tender.market)}
                    </span>
                    <span className="text-xs text-slate-600">{t("Awarded to")}{' '}<strong>{a.supplier}</strong></span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-700">{formatUSD(a.contractValue)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(a.awardedAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer note about Phase 1 scope */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-900">Phase 1 MVP.</strong> All scores and KPIs are deterministic and computed from seeded demo data.
          Live procurement source connectors, AI extraction, authentication, and file upload are scaffolded for Phase 2+.
          See <code className="text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">PROJECT_STATE.md</code> for the authoritative status.
        </p>
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  subtitle,
  onClick,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'slate'
  subtitle?: string
  onClick?: () => void
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    slate: 'text-slate-600 bg-slate-500/10',
  }
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all',
        onClick && 'hover:border-slate-300 hover:shadow-sm cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <span className="text-xl font-semibold text-slate-900">{value}</span>
      {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
    </button>
  )
}

function CommandCenterSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-96 bg-slate-100 rounded-lg" />
        <div className="h-96 bg-slate-100 rounded-lg" />
      </div>
    </div>
  )
}
