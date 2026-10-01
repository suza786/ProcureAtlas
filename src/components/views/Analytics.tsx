'use client'

import { useEffect, useState } from 'react'
import { formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BarChart3, TrendingUp, Clock, Cpu, Shield, Award } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, AreaChart, Area,
} from 'recharts'

interface AnalyticsData {
  current: {
    activePursuits: number
    biddingPursuits: number
    submittedPursuits: number
    wonPursuits: number
    lostPursuits: number
    pipelineValueUSD: number
    wonValueUSD: number
    winRate: number
    activeAlerts: number
    llmCalls30d: number
    llmCost30d: number
  }
  trends: {
    winRate: Array<{ month: string; winRate: number; won: number; lost: number }>
    pipelineValue: Array<{ month: string; value: number; won: number }>
    llmUsage: Array<{ month: string; calls: number; cost: number }>
    evidenceCoverage: Array<{ month: string; coverage: number; count: number }>
    bidCycleTime: Array<{ month: string; days: number; wordCount: number }>
  }
  snapshots: number
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading analytics...</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">Failed to load.</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-slate-700" />
          Advanced Analytics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tenant-level analytics dashboard with win-rate trends, pipeline velocity, and LLM usage over 6 months.
        </p>
      </div>

      {/* Current metrics tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricTile icon={TrendingUp} label="Active Pursuits" value={data.current.activePursuits.toString()} tone="sky" />
        <MetricTile icon={Award} label="Win Rate" value={`${data.current.winRate}%`} tone="emerald" />
        <MetricTile icon={TrendingUp} label="Pipeline Value" value={formatUSD(data.current.pipelineValueUSD)} tone="violet" />
        <MetricTile icon={Award} label="Won Value" value={formatUSD(data.current.wonValueUSD)} tone="emerald" />
        <MetricTile icon={Cpu} label="LLM Calls (30d)" value={data.current.llmCalls30d.toString()} tone="violet" />
        <MetricTile icon={Cpu} label="LLM Cost (30d)" value={`$${data.current.llmCost30d.toFixed(4)}`} tone="amber" />
      </div>

      {/* Win Rate Trend */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-600" />
          Win Rate Trend (6 months)
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trends.winRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="winRate" stroke="#10b981" strokeWidth={2} name="Win Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline Value Trend */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-600" />
          Pipeline Value Trend (USD K)
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trends.pipelineValue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} name="Pipeline Value" />
              <Area type="monotone" dataKey="won" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Won Value" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LLM Usage + Evidence Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-violet-600" />
            LLM Usage Trend
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trends.llmUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="API Calls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            Evidence Coverage Trend
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends.evidenceCoverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Line type="monotone" dataKey="coverage" stroke="#10b981" strokeWidth={2} name="Coverage %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bid Cycle Time */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-600" />
          Avg Bid Cycle Time & Proposal Word Count
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trends.bidCycleTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line yAxisId="left" type="monotone" dataKey="days" stroke="#0ea5e9" strokeWidth={2} name="Cycle Days" />
              <Line yAxisId="right" type="monotone" dataKey="wordCount" stroke="#f59e0b" strokeWidth={2} name="Word Count" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly snapshot table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Monthly Snapshots ({data.snapshots})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Month</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Active</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Bidding</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Won</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Lost</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Pipeline</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Win Rate</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">LLM Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.trends.winRate.map((snap, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{snap.month}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{data.trends.pipelineValue[i]?.value ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{data.trends.bidCycleTime[i]?.days ?? '—'}d</td>
                  <td className="px-3 py-2.5 text-xs text-emerald-700 font-medium text-right">{snap.won}</td>
                  <td className="px-3 py-2.5 text-xs text-rose-700 text-right">{snap.lost}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 text-right">{formatUSD((data.trends.pipelineValue[i]?.value ?? 0) * 1000)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 text-right">{snap.winRate}%</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 text-right">${data.trends.llmUsage[i]?.cost.toFixed(4) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricTile({ icon: Icon, label, value, tone }: {
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
