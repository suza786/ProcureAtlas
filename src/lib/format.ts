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

export interface DateFormatOptions { locale?: 'en' | 'bn'; timeZone?: string }
function parseDate(date: Date | string | number): Date {
  if (date instanceof Date) return date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(date)) return new Date(date.replace(' ', 'T') + 'Z')
  return new Date(date)
}
export function formatDate(date: Date | string | number | null | undefined, options: DateFormatOptions = {}): string {
  if (date == null || date === '') return '—'
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleDateString(options.locale === 'bn' ? 'bn-BD' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: options.timeZone ?? 'UTC' })
}

export function formatDateTime(date: Date | string | number | null | undefined, options: DateFormatOptions = {}): string {
  if (date == null || date === '') return '—'
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString(options.locale === 'bn' ? 'bn-BD' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: options.timeZone ?? 'UTC',
    timeZoneName: 'short',
  })
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (!Number.isFinite(d.getTime())) return null
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
    BD: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    SG: 'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300',
    WB: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
    ADB: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
    UN: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300',
    EU: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300',
    US: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300',
  }
  return map[market] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function sectorColor(sector: string): string {
  const map: Record<string, string> = {
    Cyber: 'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300',
    IT: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
    Consulting: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300',
    Construction: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
    Health: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    Engineering: 'bg-slate-500/10 text-foreground border-slate-500/30',
  }
  return map[sector] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    discovering: 'bg-slate-500/10 text-foreground border-slate-500/30',
    qualifying: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
    bidding: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
    submitted: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300',
    won: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    lost: 'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300',
    no_bid: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
  }
  return map[stage] ?? 'bg-gray-500/10 text-gray-700 border-gray-500/30'
}

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'bg-rose-600 text-white',
    high: 'bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:text-rose-300',
    medium: 'bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:text-amber-300',
    low: 'bg-sky-500/15 text-sky-700 border border-sky-500/30 dark:text-sky-300',
  }
  return map[severity] ?? 'bg-gray-500/15 text-gray-700 border border-gray-500/30'
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-300'
  if (score >= 50) return 'text-amber-600 dark:text-amber-300'
  if (score >= 25) return 'text-orange-600 dark:text-orange-300'
  return 'text-rose-600 dark:text-rose-300'
}

export function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 25) return 'bg-orange-500'
  return 'bg-rose-500'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    compliant: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    partial: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
    gap: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
    not_applicable: 'bg-gray-500/15 text-gray-700 border-gray-500/30',
  }
  return map[status] ?? 'bg-gray-500/15 text-gray-700 border-gray-500/30'
}
