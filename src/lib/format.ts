// Formatting utilities for ProcureAtlas AI

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) return '—'
  const symbols: Record<string, string> = { USD: '$', BDT: '৳', SGD: 'S$', EUR: '€' }
  const symbol = symbols[currency] ?? ''
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(0)}K`
  return `${symbol}${value.toLocaleString()}`
}

export function formatUSD(value: number | null | undefined): string {
  return formatCurrency(value, 'USD')
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  const ms = d.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function deadlineUrgency(date: Date | string | null | undefined): 'critical' | 'high' | 'medium' | 'low' | 'none' {
  const days = daysUntil(date)
  if (days === null) return 'none'
  if (days < 0) return 'none'
  if (days <= 7) return 'critical'
  if (days <= 14) return 'high'
  if (days <= 30) return 'medium'
  return 'low'
}

export function marketLabel(market: string): string {
  const map: Record<string, string> = {
    BD: 'Bangladesh',
    SG: 'Singapore',
    WB: 'World Bank',
    ADB: 'ADB',
    UN: 'United Nations',
    EU: 'EU TED',
    US: 'USA (SAM.gov)',
  }
  return map[market] ?? market
}

export function marketColor(market: string): string {
  const map: Record<string, string> = {
    BD: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    SG: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
    WB: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    ADB: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    UN: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30',
    EU: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    US: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  }
  return map[market] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function sectorColor(sector: string): string {
  const map: Record<string, string> = {
    Cyber: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
    IT: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    Consulting: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    Construction: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    Health: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    Engineering: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
  }
  return map[sector] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    discovering: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
    qualifying: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    bidding: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    submitted: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    won: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    lost: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
    no_bid: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
  }
  return map[stage] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'bg-rose-600 text-white',
    high: 'bg-rose-500/15 text-rose-700 border border-rose-500/30',
    medium: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
    low: 'bg-sky-500/15 text-sky-700 border border-sky-500/30',
  }
  return map[severity] ?? 'bg-gray-500/15 text-gray-700 border border-gray-500/30'
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  if (score >= 25) return 'text-orange-600'
  return 'text-rose-600'
}

export function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 25) return 'bg-orange-500'
  return 'bg-rose-500'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    compliant: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    partial: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
    gap: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
    not_applicable: 'bg-gray-500/15 text-gray-700 border-gray-500/30',
  }
  return map[status] ?? 'bg-gray-500/15 text-gray-700 border-gray-500/30'
}
