'use client'

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
  const [tab, setTab] = useState<'users' | 'system'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [system, setSystem] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadUsers = () => {
    fetch('/api/admin/users')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Forbidden')))
      .then(d => { setUsers(d.items ?? []); setLoading(false) })
      .catch(() => { setUsers([]); setLoading(false) })
  }

  const loadSystem = () => {
    fetch('/api/admin/system')
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
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockAccount: true }),
    })
    loadUsers()
    setActionLoading(null)
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Deactivate this user? All sessions will be revoked.')) return
    setActionLoading(id)
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    loadUsers()
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-slate-700" />
          Admin Console
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tenant management, user administration, and system health monitoring.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
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
                tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'users' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Manager+ role required to view users. Sign in as owner@atlas-demo.com.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">User</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">MFA</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last Login</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{u.name ?? u.email}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          u.role === 'owner' ? 'bg-violet-500/15 text-violet-700' :
                          u.role === 'admin' ? 'bg-rose-500/15 text-rose-700' :
                          u.role === 'manager' ? 'bg-amber-500/15 text-amber-700' :
                          u.role === 'contributor' ? 'bg-sky-500/15 text-sky-700' :
                          'bg-slate-500/15 text-slate-600'
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {u.mfaEnabled ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-xs text-slate-400">off</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}
                        {u.lastLoginIp && <p className="text-[10px] text-slate-400">{u.lastLoginIp}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {u.isLocked ? (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 flex items-center gap-1 w-fit">
                            <Lock className="h-3 w-3" /> locked
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 flex items-center gap-1 w-fit">
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
                              className="text-slate-400 hover:text-emerald-600 p-1"
                              title="Unlock account"
                            >
                              {actionLoading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {u.role !== 'owner' && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              disabled={actionLoading === u.id}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Deactivate user"
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
            <StatTile icon={Users} label="Users" value={system.stats.users} tone="sky" />
            <StatTile icon={Activity} label="Pursuits" value={system.stats.pursuits} tone="violet" />
            <StatTile icon={AlertCircle} label="Active Alerts" value={system.stats.activeAlerts} tone="rose" />
            <StatTile icon={KeyRound} label="API Keys" value={system.stats.apiKeys} tone="amber" />
          </div>

          {/* LLM usage */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-violet-600" />
              LLM Usage (Last 30 Days)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">API Calls</p>
                <p className="text-lg font-semibold text-slate-900">{system.llmUsage.callsLast30Days}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Input Tokens</p>
                <p className="text-lg font-semibold text-slate-900">{system.llmUsage.inputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Output Tokens</p>
                <p className="text-lg font-semibold text-slate-900">{system.llmUsage.outputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cost (USD)</p>
                <p className="text-lg font-semibold text-slate-900">${system.llmUsage.costUsd.toFixed(4)}</p>
              </div>
            </div>
          </div>

          {/* Storage + counts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <HardDrive className="h-4 w-4 text-sky-600" />
                Storage & Data
              </h2>
              <div className="space-y-2 text-sm">
                <Row label="File uploads" value={system.stats.fileUploads.toString()} />
                <Row label="Storage used" value={`${system.storage.totalMb} MB`} />
                <Row label="Total tenders" value={system.stats.tenders.toString()} />
                <Row label="LLM extractions" value={system.stats.llmExtractions.toString()} />
                <Row label="Audit entries" value={system.stats.auditEntries.toString()} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-emerald-600" />
                Recent Connector Runs
              </h2>
              <div className="space-y-2">
                {system.recentConnectorRuns.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> :
                     r.status === 'partial' ? <AlertCircle className="h-3 w-3 text-amber-600" /> :
                     <AlertCircle className="h-3 w-3 text-rose-600" />}
                    <span className="font-medium text-slate-700">{r.sourceCode}</span>
                    <span className="text-slate-500">{r.itemsFetched} fetched, {r.itemsCreated} created</span>
                    <span className="text-slate-400 ml-auto">{formatDate(r.startedAt)}</span>
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
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}
