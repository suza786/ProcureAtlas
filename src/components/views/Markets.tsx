'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Globe, Building2, Shield, Languages, DollarSign, Database, ExternalLink } from 'lucide-react'

interface MarketItem {
  id: string
  code: string
  name: string
  region: string
  primaryLanguage: string
  currency: string
  portalUrl: string | null
  portalName: string | null
  connectorStatus: string
  legalStatus: string
  dataResidency: string
  isActive: boolean
  lastReviewedAt: string | null
  notes: string | null
}

const REGION_LABELS: Record<string, string> = {
  south_asia: 'South Asia',
  southeast_asia: 'Southeast Asia',
  oceania: 'Oceania',
  europe: 'Europe',
  north_america: 'North America',
  middle_east: 'Middle East',
  africa: 'Africa',
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ms: 'Malay',
  id: 'Bahasa Indonesia',
  fil: 'Filipino',
  hi: 'Hindi',
  vi: 'Vietnamese',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  bn: 'Bangla',
}

const CONNECTOR_COLORS: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  beta: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  in_development: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  planned: 'bg-slate-500/15 text-muted-foreground',
  blocked: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const LEGAL_COLORS: Record<string, string> = {
  verified: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  under_review: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  prohibited: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export function Markets() {
  const { t } = useTranslation()

  const [regionFilter, setRegionFilter] = useState('all')

  const { data, loading, error, refetch } = useApiQuery<{ items: MarketItem[] }>('/api/markets')
  const items = data?.items ?? []

  const regions = [...new Set(items.map(m => m.region))]
  const filtered = regionFilter === 'all' ? items : items.filter(m => m.region === regionFilter)

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Globe className="h-6 w-6 text-foreground" />
          {t("Expansion Markets")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global procurement market catalog with connector status, legal compliance, and data residency rules.
        </p>
      </div>

      {/* Region filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRegionFilter('all')}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-full border',
            regionFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
          )}
        >
          All Regions ({items.length})
        </button>
        {regions.map(r => (
          <button
            key={r}
            onClick={() => setRegionFilter(r)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              regionFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
            )}
          >
            {REGION_LABELS[r] ?? r} ({items.filter(m => m.region === r).length})
          </button>
        ))}
      </div>

      {/* Market cards */}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading markets...")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                  <p className="text-[10px] text-muted-foreground">{REGION_LABELS[m.region] ?? m.region}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', CONNECTOR_COLORS[m.connectorStatus] ?? 'bg-slate-500/15 text-muted-foreground')}>
                    {m.connectorStatus.replace(/_/g, ' ')}
                  </span>
                  <span className={cn('text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', LEGAL_COLORS[m.legalStatus] ?? 'bg-slate-500/15 text-muted-foreground')}>
                    {m.legalStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Portal */}
              {m.portalName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  {m.portalUrl ? (
                    <a href={m.portalUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900 flex items-center gap-0.5 dark:text-sky-300 dark:hover:text-sky-300">
                      {m.portalName} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : m.portalName}
                </div>
              )}

              {/* Attributes */}
              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div className="flex items-center gap-1">
                  <Languages className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("Lang:")}</span>
                  <span className="font-medium text-foreground">{LANG_LABELS[m.primaryLanguage] ?? m.primaryLanguage}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("Currency:")}</span>
                  <span className="font-medium text-foreground">{m.currency}</span>
                </div>
                <div className="flex items-center gap-1 col-span-2">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("Data residency:")}</span>
                  <span className={cn(
                    'font-medium',
                    m.dataResidency === 'in_region' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                  )}>
                    {m.dataResidency === 'in_region' ? 'In-region (required)' : 'Global'}
                  </span>
                </div>
              </div>

              {m.lastReviewedAt && (
                <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                  {t("Last reviewed:")}{new Date(m.lastReviewedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status summary */}
      <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Phase 6 — Expansion Markets</p>
        <p>
          {items.length} markets registered. {items.filter(m => m.connectorStatus === 'live').length} live,{' '}
          {items.filter(m => m.connectorStatus === 'in_development').length} in development,{' '}
          {items.filter(m => m.connectorStatus === 'planned').length} planned.{' '}
          {items.filter(m => m.legalStatus === 'verified').length} legally verified,{' '}
          {items.filter(m => m.dataResidency === 'in_region').length} require in-region data residency.
          Live connectors require legal sign-off per DATA_SOURCE_LEGAL_REGISTER.md.
        </p>
      </div>
    </div>
  )
}
