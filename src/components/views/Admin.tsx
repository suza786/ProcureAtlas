'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { InviteUser } from '@/components/account/InviteUser'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDateTime, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Shield,
  Users,
  Activity,
  Cpu,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Trash2,
  KeyRound,
  Loader2,
} from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  mfaEnabled: boolean
  failedLoginCount: number
  lockedUntil: string | null
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
  isLocked: boolean
}

interface SystemData {
  tenant: { id: string; slug: string }
  stats: {
    users: number
    pursuits: number
    tenders: number
    activeAlerts: number
    auditEntries: number
    llmExtractions: number
    fileUploads: number
    apiKeys: number
  }
  llmUsage: {
    callsLast30Days: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
  storage: { totalKb: number; totalMb: number }
  recentConnectorRuns: Array<{
    id: string
    sourceCode: string
    status: string
    startedAt: string
    completedAt: string | null
    itemsFetched: number
    itemsCreated: number
    errorMessage: string | null
  }>
}

export function Admin() {
  const { t, formatDateTime, formatDate } = useTranslation()

  const [tab, setTab] = useState<'users' | 'system'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [system, setSystem] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadUsers = () => {
    apiFetch('/api/admin/users')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Forbidden')))
      .then(d => { setUsers(d.items ?? []); setLoading(false) })
      .catch(() => { setUsers([]); setLoading(false) })
  }

  const loadSystem = () => {
    apiFetch('/api/admin/system')
      .then(r => r.json())
      .then(d => { setSystem(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'users') loadUsers()
    else loadSystem()
  }, [tab])

  const unlockUser = async (id: string) => {
    setActionLoading(id)
    try { await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockAccount: true }),
    })
    loadUsers()
    } catch { /* Shared API notice displays the failure. */ }
    finally { setActionLoading(null) }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Deactivate this user? All sessions will be revoked.')) return
    setActionLoading(id)
    try { await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    loadUsers()
    } catch { /* Shared API notice displays the failure. */ }
    finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-foreground" />
          {t("Admin Console")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tenant management, user administration, and system health monitoring.
        </p>
      </div>

      {tab === 'users' && <InviteUser onCreated={loadUsers} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'system', label: 'System Health', icon: Activity },
        ].map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'users' | 'system')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'users' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading users...")}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Manager+ role required to view users. Sign in as owner@atlas-demo.com.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("User")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Role")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">MFA</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Last Login")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Status")}</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{u.name ?? u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          u.role === 'owner' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' :
                          u.role === 'admin' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' :
                          u.role === 'manager' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                          u.role === 'contributor' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' :
                          'bg-slate-500/15 text-muted-foreground'
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {u.mfaEnabled ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <span className="text-xs text-muted-foreground">off</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}
                        {u.lastLoginIp && <p className="text-[10px] text-muted-foreground">{u.lastLoginIp}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {u.isLocked ? (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 flex items-center gap-1 w-fit dark:text-rose-300">
                            <Lock className="h-3 w-3" /> locked
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 flex items-center gap-1 w-fit dark:text-emerald-300">
                            <Unlock className="h-3 w-3" /> active
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          {u.isLocked && (
                            <button
                              onClick={() => unlockUser(u.id)}
                              disabled={actionLoading === u.id}
                              className="text-muted-foreground hover:text-emerald-600 p-1 dark:hover:text-emerald-300"
                              title={t("Unlock account")}
                            >
                              {actionLoading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {u.role !== 'owner' && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              disabled={actionLoading === u.id}
                              className="text-muted-foreground hover:text-rose-600 p-1 dark:hover:text-rose-300"
                              title={t("Deactivate user")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'system' && system && (
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={Users} label={t("Users")} value={system.stats.users} tone="sky" />
            <StatTile icon={Activity} label={t("Pursuits")} value={system.stats.pursuits} tone="violet" />
            <StatTile icon={AlertCircle} label={t("Active Alerts")} value={system.stats.activeAlerts} tone="rose" />
            <StatTile icon={KeyRound} label={t("API Keys")} value={system.stats.apiKeys} tone="amber" />
          </div>

          {/* LLM usage */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              {t("LLM Usage (Last 30 Days)")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("API Calls")}</p>
                <p className="text-lg font-semibold text-foreground">{system.llmUsage.callsLast30Days}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("Input Tokens")}</p>
                <p className="text-lg font-semibold text-foreground">{system.llmUsage.inputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("Output Tokens")}</p>
                <p className="text-lg font-semibold text-foreground">{system.llmUsage.outputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("Cost (USD)")}</p>
                <p className="text-lg font-semibold text-foreground">${system.llmUsage.costUsd.toFixed(4)}</p>
              </div>
            </div>
          </div>

          {/* Storage + counts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <HardDrive className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                {t("Storage & Data")}</h2>
              <div className="space-y-2 text-sm">
                <Row label={t("File uploads")} value={system.stats.fileUploads.toString()} />
                <Row label={t("Storage used")} value={`${system.storage.totalMb} MB`} />
                <Row label={t("Total tenders")} value={system.stats.tenders.toString()} />
                <Row label={t("LLM extractions")} value={system.stats.llmExtractions.toString()} />
                <Row label={t("Audit entries")} value={system.stats.auditEntries.toString()} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                {t("Recent Connector Runs")}</h2>
              <div className="space-y-2">
                {system.recentConnectorRuns.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-300" /> :
                     r.status === 'partial' ? <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-300" /> :
                     <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-300" />}
                    <span className="font-medium text-foreground">{r.sourceCode}</span>
                    <span className="text-muted-foreground">{r.itemsFetched} fetched, {r.itemsCreated} created</span>
                    <span className="text-muted-foreground ml-auto">{formatDate(r.startedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ icon: Icon, label, value, tone }: {
  icon: React.ElementType
  label: string
  value: number
  tone: 'sky' | 'violet' | 'rose' | 'amber'
}) {
  const toneMap: Record<string, string> = {
    sky: 'text-sky-600 bg-sky-500/10 dark:text-sky-300',
    violet: 'text-violet-600 bg-violet-500/10 dark:text-violet-300',
    rose: 'text-rose-600 bg-rose-500/10 dark:text-rose-300',
    amber: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  }
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
