'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useApiQuery } from '@/hooks/use-api-query'

import { useState } from 'react'
import { formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Users,
  Handshake,
  ArrowRight,
  TrendingUp,
  Globe,
  Shield,
  Loader2,
} from 'lucide-react'

interface PartnerSuggestion {
  id: string
  name: string
  country: string | null
  city: string | null
  website: string | null
  matchScore: number
  band: 'high' | 'medium' | 'low'
  dimensions: Array<{ name: string; weight: number; score: number; reason: string }>
  complementaryCapabilities: string[]
  geographicOverlap: string[]
  derivedSectors: string[]
}

interface PartnerData {
  tenantCompany: { id: string; name: string; country: string; sectors: string[] }
  suggestions: PartnerSuggestion[]
  total: number
}

export function PartnerFinder() {
  const { t } = useTranslation()

  const [selected, setSelected] = useState<PartnerSuggestion | null>(null)

  const { data, loading, error, refetch } = useApiQuery<PartnerData>('/api/partners')

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("Computing partner suggestions...")}</div>
  if (error) return <div role="alert" className="p-6 text-sm text-rose-700 dark:text-rose-300">{error} <button onClick={refetch} className="underline">{t("Retry")}</button></div>
  if (!data) return <div className="p-6 text-sm text-rose-600 dark:text-rose-300">{t("Failed to load.")}</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Handshake className="h-6 w-6 text-foreground" />
          {t("Partner / JV Finder")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-assisted matching of complementary companies for consortium / JV / OEM partnerships.
          Every suggestion includes a deterministic match score with explainable dimensions.
        </p>
      </div>

      {/* Tenant company card */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {data.tenantCompany.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{data.tenantCompany.name}</p>
            <p className="text-xs text-muted-foreground">{data.tenantCompany.country} · Sectors: {data.tenantCompany.sectors.join(', ')}</p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{data.suggestions.length} partner suggestions</span>
        </div>
      </div>

      {/* Suggestions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.suggestions.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-sm text-muted-foreground">{t("No partner suggestions available.")}</div>
        ) : (
          data.suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="text-left rounded-lg border border-border bg-card p-4 hover:border-border hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{[s.city, s.country].filter(Boolean).join(', ')}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn(
                    'text-2xl font-bold',
                    s.band === 'high' ? 'text-emerald-600 dark:text-emerald-300' :
                    s.band === 'medium' ? 'text-amber-600 dark:text-amber-300' :
                    'text-muted-foreground'
                  )}>
                    {s.matchScore}
                  </span>
                  <span className={cn(
                    'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                    s.band === 'high' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                    s.band === 'medium' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                    'bg-slate-500/15 text-muted-foreground'
                  )}>
                    {s.band} match
                  </span>
                </div>
              </div>

              {/* Complementary capabilities */}
              {s.complementaryCapabilities.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t("Complementary Sectors")}</p>
                  <div className="flex flex-wrap gap-1">
                    {s.complementaryCapabilities.map((c) => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 font-medium dark:text-violet-300">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top reasons */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t("Top Match Reasons")}</p>
                <div className="space-y-0.5">
                  {s.dimensions.slice(0, 2).map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium text-foreground">{Math.round(d.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-950/30 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md bg-card h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{t("Partner Detail")}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">{t("Close ✕")}</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{[selected.city, selected.country].filter(Boolean).join(', ')}</p>
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700 hover:text-sky-900 mt-1 inline-block dark:text-sky-300 dark:hover:text-sky-300">
                    {selected.website}
                  </a>
                )}
              </div>

              <div className="rounded-md border border-border p-3 text-center">
                <p className="text-3xl font-bold text-foreground">{selected.matchScore}</p>
                <p className="text-xs text-muted-foreground">{t("Match Score")}</p>
                <span className={cn(
                  'inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                  selected.band === 'high' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  selected.band === 'medium' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  'bg-slate-500/15 text-muted-foreground'
                )}>
                  {selected.band} match
                </span>
              </div>

              {/* Dimensions */}
              <div>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("Match Dimensions")}</h4>
                <div className="space-y-2">
                  {selected.dimensions.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{d.name}</span>
                        <span className="text-muted-foreground">weight {d.weight} · {Math.round(d.score * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1 mt-1">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${d.score * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{d.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complementary capabilities */}
              {selected.complementaryCapabilities.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("Complementary Capabilities")}</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.complementaryCapabilities.map((c) => (
                      <span key={c} className="text-xs px-2 py-1 rounded bg-violet-500/10 text-violet-700 font-medium dark:text-violet-300">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic overlap */}
              {selected.geographicOverlap.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("Geographic Overlap")}</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.geographicOverlap.map((g) => (
                      <span key={g} className="text-xs px-2 py-1 rounded bg-sky-500/10 text-sky-700 font-medium dark:text-sky-300">{g}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Phase 3 Note</p>
                Match scores are computed deterministically using tag, keyword, and capability matching.
                Production with pgvector will use cosine similarity over embeddings.
                Contact / engagement actions require explicit human authorization.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
