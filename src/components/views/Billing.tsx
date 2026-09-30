'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatUSD, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  CreditCard,
  TrendingUp,
  Cpu,
  HardDrive,
  FileText,
  Target,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface UsageItem {
  metricType: string
  used: number
  limit: number
  percentage: number
}

interface BillingData {
  subscription: {
    id: string
    plan: string
    status: string
    billingCycle: string
    seatsIncluded: number
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  }
  usage: UsageItem[]
  invoices: Array<{
    id: string
    invoiceNumber: string
    amount: number
    currency: string
    status: string
    periodStart: string
    periodEnd: string
    paidAt: string | null
    createdAt: string
  }>
}

const PLANS = [
  { id: 'free', name: 'Free', priceBDT: 0, priceUSD: 0, seats: 1, tenders: 10, pursuits: 1, apiCalls: 100, llmTokens: 5000 },
  { id: 'solo', name: 'Solo', priceBDT: 2990, priceUSD: 49, seats: 1, tenders: 50, pursuits: 5, apiCalls: 1000, llmTokens: 50000 },
  { id: 'professional', name: 'Professional', priceBDT: 9900, priceUSD: 149, seats: 3, tenders: 200, pursuits: 20, apiCalls: 5000, llmTokens: 200000 },
  { id: 'bid_team', name: 'Bid Team', priceBDT: 29900, priceUSD: 399, seats: 10, tenders: 1000, pursuits: 100, apiCalls: 25000, llmTokens: 1000000 },
  { id: 'enterprise', name: 'Enterprise', priceBDT: -1, priceUSD: -1, seats: 50, tenders: 10000, pursuits: 1000, apiCalls: 100000, llmTokens: 5000000 },
]

const METRIC_ICONS: Record<string, React.ElementType> = {
  api_calls: Cpu,
  llm_tokens: Cpu,
  tenders_tracked: FileText,
  pursuits: Target,
  file_uploads: HardDrive,
}

export function Billing() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)

  const load = () => {
    fetch('/api/billing/usage')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const changePlan = async (plan: string) => {
    if (plan === 'enterprise') {
      alert('Enterprise plan requires custom setup. Please contact sales@procureatlas.ai')
      return
    }
    setChangingPlan(plan)
    await fetch('/api/billing/subscription', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    load()
    setChangingPlan(null)
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading billing data...</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">Failed to load.</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-slate-700" />
          Billing & Usage
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Current plan, usage metrics, and plan selection. Stripe + SSLCommerz integration is scaffolded for production.
        </p>
      </div>

      {/* Current plan */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Current Plan</p>
            <p className="text-2xl font-semibold text-slate-900 capitalize">{data.subscription.plan}</p>
            <p className="text-xs text-slate-500 mt-1">
              {data.subscription.billingCycle} billing · {data.subscription.seatsIncluded} seat(s) ·
              Status: <span className="font-medium text-emerald-700">{data.subscription.status}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: {formatDate(data.subscription.currentPeriodStart)} → {formatDate(data.subscription.currentPeriodEnd)}
            </p>
          </div>
          {data.subscription.cancelAtPeriodEnd && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
              cancels at period end
            </span>
          )}
        </div>
      </div>

      {/* Usage meters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-violet-600" />
          Current Period Usage
        </h2>
        <div className="space-y-3">
          {data.usage.map((u) => {
            const Icon = METRIC_ICONS[u.metricType] ?? FileText
            const pct = Math.min(u.percentage, 100)
            const isOver = u.percentage > 80
            return (
              <div key={u.metricType}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">{u.metricType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </div>
                  <span className={cn('font-medium', isOver ? 'text-rose-600' : 'text-slate-700')}>
                    {u.used.toLocaleString()} / {u.limit.toLocaleString()} ({u.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isOver ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan selection */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLANS.map((p) => {
            const isCurrent = data.subscription.plan === p.id
            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg border p-3 text-center',
                  isCurrent ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                )}
              >
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.priceUSD === -1 ? 'Custom' : `$${p.priceUSD}/mo`}
                </p>
                <p className="text-[10px] text-slate-400">
                  {p.priceBDT === -1 ? '' : p.priceBDT === 0 ? 'Free' : `৳${p.priceBDT}/mo`}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5 text-left">
                  <p>{p.seats} seat(s)</p>
                  <p>{p.tenders} tenders</p>
                  <p>{p.pursuits} pursuits</p>
                  <p>{p.apiCalls.toLocaleString()} API calls</p>
                  <p>{p.llmTokens.toLocaleString()} LLM tokens</p>
                </div>
                {isCurrent ? (
                  <div className="mt-2 text-xs font-medium text-emerald-700 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Current
                  </div>
                ) : (
                  <button
                    onClick={() => changePlan(p.id)}
                    disabled={changingPlan !== null}
                    className="mt-2 w-full rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {changingPlan === p.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                    Switch to {p.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {data.invoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No invoices yet. Invoices are generated at the end of each billing period.
            </div>
          ) : (
            data.invoices.map((inv) => (
              <div key={inv.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">{formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                    inv.status === 'paid' ? 'bg-emerald-500/15 text-emerald-700' :
                    inv.status === 'pending' ? 'bg-amber-500/15 text-amber-700' :
                    'bg-slate-500/15 text-slate-600'
                  )}>
                    {inv.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{formatUSD(inv.amount)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Phase 3 — Billing scaffold.</p>
            <p className="mt-1">
              Plan management and usage metering are live. Stripe (international) and SSLCommerz (Bangladesh)
              payment integration is scaffolded — production deploy requires API keys and webhook configuration.
              Switching plans updates the subscription record; no actual payment is processed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
