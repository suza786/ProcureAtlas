'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Globe,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  ShieldCheck,
} from 'lucide-react'

interface ConnectorInfo {
  code: string
  name: string
  country: string
  url: string
  legalStatus: string
  isLiveEnabled: boolean
  description: string
  recentRuns: Array<{
    id: string
    runType: string
    status: string
    startedAt: string
    completedAt: string | null
    itemsFetched: number
    itemsCreated: number
    itemsUpdated: number
    itemsSkipped: number
    errorMessage: string | null
  }>
}

export function Connectors() {
  const { t, formatDateTime } = useTranslation()

  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ source: string; result: unknown } | null>(null)

  const load = () => {
    apiFetch('/api/connectors')
      .then(r => r.json())
      .then(d => { setConnectors(d.connectors ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const triggerRun = async (sourceCode: string) => {
    setRunning(sourceCode)
    setLastResult(null)
    try {
      const res = await apiFetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCode, runType: 'manual', limit: 10 }),
      })
      const data = await res.json()
      setLastResult({ source: sourceCode, result: data })
      load() // refresh runs
    } catch { /* Shared API notice displays the failure. */ } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Globe className="h-6 w-6 text-slate-700" />
          {t("Data Source Connectors")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-source ingestion with audit-logged runs. Live fetching requires legal sign-off per <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">DATA_SOURCE_LEGAL_REGISTER.md</code>.
        </p>
      </div>

      {/* Last run result */}
      {lastResult && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700 mb-1">{t("Last run:")}{' '}{lastResult.source}</p>
          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] overflow-x-auto">
            {JSON.stringify(lastResult.result, null, 2)}
          </pre>
        </div>
      )}

      {/* Connectors grid */}
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">{t("Loading connectors...")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectors.map((c) => (
            <div key={c.code} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-700">
                      {c.url}
                    </a>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                    c.legalStatus === 'verified' ? 'bg-emerald-500/15 text-emerald-700' :
                    c.legalStatus === 'under_review' ? 'bg-amber-500/15 text-amber-700' :
                    'bg-rose-500/15 text-rose-700'
                  )}>
                    {c.legalStatus.replace('_', ' ')}
                  </span>
                  {c.isLiveEnabled ? (
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 flex items-center gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> live
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-600">mock</span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-3 leading-relaxed">{c.description}</p>

              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => triggerRun(c.code)}
                  disabled={running === c.code}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    c.code === 'cptu_bd'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                    running === c.code && 'opacity-70'
                  )}
                  title={c.code === 'cptu_bd' ? 'Run connector (mock data)' : 'Connector not yet implemented'}
                >
                  {running === c.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {running === c.code ? 'Running...' : 'Run now'}
                </button>
                <span className="text-[10px] text-slate-400">
                  {c.recentRuns.length} recent run{c.recentRuns.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Recent runs */}
              {c.recentRuns.length > 0 && (
                <div className="border-t border-slate-100 pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">{t("Recent runs")}</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {c.recentRuns.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-[10px]">
                        {r.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> :
                         r.status === 'partial' ? <AlertCircle className="h-3 w-3 text-amber-600" /> :
                         r.status === 'failed' ? <AlertCircle className="h-3 w-3 text-rose-600" /> :
                         <Clock className="h-3 w-3 text-slate-400" />}
                        <span className="text-slate-600">{formatDateTime(r.startedAt)}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-700 font-medium">{r.itemsFetched} fetched</span>
                        <span className="text-emerald-700">+{r.itemsCreated}</span>
                        <span className="text-sky-700">~{r.itemsUpdated}</span>
                        <span className="text-slate-500">-{r.itemsSkipped}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status banner */}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Phase 2 — Connector skeletons only.</p>
            <p className="mt-1">
              All connectors return mock data. Live fetching requires (1) legal sign-off on the source's
              entry in <code className="text-[10px] bg-amber-500/10 px-1 py-0.5 rounded">DATA_SOURCE_LEGAL_REGISTER.md</code>,
              (2) confirmation that the source publishes an official API or permitted feed, and
              (3) rate-limit-compliant client implementation. The CPTU connector skeleton is fully
              implemented with a deterministic mock fetcher ready to be swapped for live fetching.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
