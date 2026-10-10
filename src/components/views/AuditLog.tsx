'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Shield, Filter, Download, Cpu, FileText, LogIn, LogOut, Brain, Upload, Target, KeyRound } from 'lucide-react'

interface AuditItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  user: { email: string; name: string | null } | null
  actorType?: string
  apiKeyId?: string | null
  ipHash: string | null
  userAgent: string | null
  llmModel: string | null
  llmInputTokens: number | null
  llmOutputTokens: number | null
  llmLatencyMs: number | null
  llmCostUsd: number | null
  before: object | null
  after: object | null
  createdAt: string
}

const actorLabel = (item: AuditItem) => item.actorType === 'api_key' || item.apiKeyId
  ? `API key ${item.apiKeyId ?? '(unknown)'}` : item.user?.email ?? 'system'

const ACTION_ICONS: Record<string, React.ElementType> = {
  login_success: LogIn,
  login_failed: LogOut,
  logout: LogOut,
  llm_call_success: Brain,
  llm_call_failed: Brain,
  llm_extraction_triggered: Cpu,
  file_uploaded: Upload,
  evidence_created: FileText,
  pursuit_created: Target,
  api_key_created: KeyRound,
  api_key_revoked: KeyRound,
  connector_triggered: Cpu,
  connector_run_completed: Cpu,
  extraction_approved: Shield,
  extraction_rejected: Shield,
  extraction_edited: Shield,
}

const ACTION_COLORS: Record<string, string> = {
  login_success: 'text-emerald-600 bg-emerald-500/10',
  login_failed: 'text-rose-600 bg-rose-500/10',
  logout: 'text-slate-600 bg-slate-500/10',
  llm_call_success: 'text-violet-600 bg-violet-500/10',
  llm_call_failed: 'text-rose-600 bg-rose-500/10',
  llm_extraction_triggered: 'text-violet-600 bg-violet-500/10',
  file_uploaded: 'text-sky-600 bg-sky-500/10',
  evidence_created: 'text-sky-600 bg-sky-500/10',
  pursuit_created: 'text-amber-600 bg-amber-500/10',
  api_key_created: 'text-slate-600 bg-slate-500/10',
  api_key_revoked: 'text-rose-600 bg-rose-500/10',
  connector_triggered: 'text-violet-600 bg-violet-500/10',
  connector_run_completed: 'text-emerald-600 bg-emerald-500/10',
  extraction_approved: 'text-emerald-600 bg-emerald-500/10',
  extraction_rejected: 'text-rose-600 bg-rose-500/10',
  extraction_edited: 'text-amber-600 bg-amber-500/10',
}

export function AuditLog() {
  const { t, formatDateTime } = useTranslation()

  const [items, setItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [selected, setSelected] = useState<AuditItem | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (actionFilter) params.set('action', actionFilter)
    apiFetch(`/api/audit?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [actionFilter])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-slate-700" />
            {t("Audit Log")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Every tenant action is logged — auth, LLM calls, file uploads, pursuit changes, API key usage.
          </p>
        </div>
        <button
          onClick={() => {
            const csv = ['Timestamp,Action,EntityType,EntityId,User,IP,LLM_Model,Tokens,Cost_USD']
            items.forEach(i => {
              csv.push([
                i.createdAt,
                i.action,
                i.entityType,
                i.entityId ?? '',
                actorLabel(i),
                i.ipHash ?? '',
                i.llmModel ?? '',
                (i.llmInputTokens ?? 0) + (i.llmOutputTokens ?? 0),
                i.llmCostUsd ?? 0,
              ].join(','))
            })
            const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> {t("Export CSV")}</button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <Filter className="h-3.5 w-3.5 text-slate-400 ml-1" />
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. login, llm, file, pursuit, api_key)..."
          className="flex-1 text-xs outline-none bg-transparent"
        />
        {actionFilter && (
          <button
            onClick={() => setActionFilter('')}
            className="text-xs text-slate-500 hover:text-rose-600"
          >{t("Clear")}</button>
        )}
        <span className="text-xs text-slate-500">{items.length} entries</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t("Loading audit log...")}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t("No audit entries match filter.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Timestamp")}</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Action")}</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("Entity")}</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("User")}</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">LLM</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">{t("Cost")}</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const Icon = ACTION_ICONS[item.action] ?? FileText
                  const color = ACTION_COLORS[item.action] ?? 'text-slate-600 bg-slate-500/10'
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn('rounded-md p-1', color)}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-medium text-slate-900">{item.action}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        <span className="font-mono">{item.entityType}</span>
                        {item.entityId && (
                          <span className="text-slate-400 ml-1">/{item.entityId.slice(-8)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{actorLabel(item)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {item.llmModel ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-violet-700">{item.llmModel}</span>
                            <span className="text-[10px] text-slate-500">
                              {(item.llmInputTokens ?? 0) + (item.llmOutputTokens ?? 0)} tok · {item.llmLatencyMs}ms
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right text-slate-600">
                        {item.llmCostUsd ? `$${item.llmCostUsd.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-2 py-2.5"></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">{t("Audit Entry Detail")}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-900 text-xs"
              >{t("Close ✕")}</button>
            </div>

            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Action")}</dt>
                <dd className="font-medium text-slate-900">{selected.action}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Entity")}</dt>
                <dd className="font-mono text-slate-700">{selected.entityType} / {selected.entityId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("User")}</dt>
                <dd className="text-slate-700">{actorLabel(selected)}{selected.user?.name ? ` (${selected.user.name})` : ''}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("Timestamp")}</dt>
                <dd className="text-slate-700">{formatDateTime(selected.createdAt)}</dd>
              </div>
              {selected.ipHash && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("IP Hash")}</dt>
                  <dd className="font-mono text-slate-700">{selected.ipHash}</dd>
                </div>
              )}
              {selected.userAgent && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("User Agent")}</dt>
                  <dd className="text-slate-700 break-all">{selected.userAgent}</dd>
                </div>
              )}
              {selected.llmModel && (
                <>
                  <div className="pt-3 border-t border-slate-100">
                    <dt className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold">{t("LLM Call")}</dt>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><dt className="text-[10px] uppercase text-slate-500">{t("Model")}</dt><dd className="font-medium text-violet-700">{selected.llmModel}</dd></div>
                    <div><dt className="text-[10px] uppercase text-slate-500">{t("Latency")}</dt><dd className="text-slate-700">{selected.llmLatencyMs}ms</dd></div>
                    <div><dt className="text-[10px] uppercase text-slate-500">{t("Input tokens")}</dt><dd className="text-slate-700">{selected.llmInputTokens}</dd></div>
                    <div><dt className="text-[10px] uppercase text-slate-500">{t("Output tokens")}</dt><dd className="text-slate-700">{selected.llmOutputTokens}</dd></div>
                    <div><dt className="text-[10px] uppercase text-slate-500">{t("Cost")}</dt><dd className="text-slate-700">${selected.llmCostUsd?.toFixed(4)}</dd></div>
                  </div>
                </>
              )}
              {selected.after && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t("After")}</dt>
                  <dd>
                    <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] overflow-x-auto">
                      {JSON.stringify(selected.after, null, 2)}
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
