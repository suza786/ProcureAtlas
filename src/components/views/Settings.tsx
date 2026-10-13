'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { MfaSettings } from '@/components/account/MfaSettings'
import { AppearanceSettings } from '@/components/account/AppearanceSettings'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Settings as SettingsIcon,
  KeyRound,
  Plus,
  Copy,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Shield,
} from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface CurrentUser {
  authenticated: boolean
  user?: {
    email: string
    name: string | null
    role: string
    tenantSlug: string
    mfaEnabled: boolean
  }
}

export function Settings() {
  const { t, formatDate } = useTranslation()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<{ name: string; scopes: string[] }>({ name: '', scopes: ['mcp:read'] })
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const setAuth = useAppStore((s) => s.setAuth)
  const goSignIn = useAppStore((s) => s.goSignIn)

  const load = () => {
    Promise.all([
      apiFetch('/api/api-keys').then(r => r.json()),
      apiFetch('/api/auth/me').then(r => r.json()),
    ])
      .then(([k, m]) => {
        setKeys(k.items ?? [])
        setMe(m)
        if (m.authenticated) {
          setAuth({ authenticated: true, user: m.user })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createKey = async () => {
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKey),
      })
      const data = await res.json()
      if (res.ok) {
        setCreatedKey(data.key)
        setShowCreate(false)
        setNewKey({ name: '', scopes: ['mcp:read'] })
        load()
      }
    } catch { /* Shared API notice displays the failure. */ } finally {
      setSubmitting(false)
    }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    try { await apiFetch(`/api/api-keys?id=${id}`, { method: 'DELETE' }); load() }
    catch { /* Shared API notice displays the failure. */ }
  }

  const signOut = async () => {
    try { await apiFetch('/api/auth/sign-out', { method: 'POST' })
    setAuth({ authenticated: false, user: null })
    goSignIn()
    } catch { /* Shared API notice displays the failure. */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-foreground" />
          {t("Settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Manage your account, API keys, and MCP access.")}</p>
      </div>

      <AppearanceSettings />

      {/* Account section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          {t("Account")}</h2>
        {loading ? (
          <div className="text-xs text-muted-foreground">{t("Loading...")}</div>
        ) : me?.authenticated && me.user ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label={t("Email")} value={me.user.email} />
              <Field label={t("Name")} value={me.user.name ?? '—'} />
              <Field label={t("Role")} value={me.user.role} />
              <Field label={t("Tenant")} value={me.user.tenantSlug} />
            </div>
            <button
              onClick={signOut}
              className="mt-3 text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 dark:text-rose-300 dark:hover:text-rose-300"
            >
              <Shield className="h-3.5 w-3.5" /> {t("Sign out")}</button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            <p>{t("You are exploring in demo mode (not authenticated).")}</p>
            <button
              onClick={goSignIn}
              className="mt-2 text-sky-700 hover:text-sky-900 font-medium dark:text-sky-300 dark:hover:text-sky-300"
            >{t("Sign in →")}</button>
          </div>
        )}
      </div>

      {me?.authenticated && me.user && <MfaSettings enabled={me.user.mfaEnabled} />}

      {/* API Keys section */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            {t("API Keys")}</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> {t("New key")}</button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="border-b border-border p-4 bg-muted">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("Name")}</label>
                <input
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  placeholder={t("e.g. MCP integration key")}
                  className="w-full text-sm border border-border rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("Scopes")}</label>
                <div className="space-y-1.5">
                  {['mcp:read', 'api:read', 'api:write'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={newKey.scopes.includes(s)}
                        onChange={(e) => {
                          if (e.target.checked) setNewKey({ ...newKey, scopes: [...newKey.scopes, s] })
                          else setNewKey({ ...newKey, scopes: newKey.scopes.filter(x => x !== s) })
                        }}
                      />
                      <code className="text-foreground">{s}</code>
                      <span className="text-muted-foreground">
                        {s === 'mcp:read' ? '— MCP tool calls (read-only)' : s === 'api:read' ? '— REST API read access' : '— REST API write access'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createKey}
                  disabled={submitting || !newKey.name || newKey.scopes.length === 0}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  {t("Create key")}</button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5"
                >{t("Cancel")}</button>
              </div>
            </div>
          </div>
        )}

        {/* Created key reveal */}
        {createdKey && (
          <div className="border-b border-border p-4 bg-emerald-500/5">
            <div className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-300" />
              <div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{t("API key created")}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5 dark:text-emerald-300">{t("Copy this key now — it will not be shown again.")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-950 text-emerald-400 p-2 rounded font-mono break-all">
                {createdKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdKey)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted"
              >
                {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-300" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >{t("Dismiss")}</button>
          </div>
        )}

        {/* Keys list */}
        <div className="divide-y divide-border">
          {keys.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">{t("No API keys yet. Create one to use the MCP server.")}</div>
          ) : (
            keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{k.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <code className="bg-muted px-1 py-0.5 rounded">{k.keyPrefix}...</code>
                    {k.scopes.map(s => (
                      <span key={s} className="px-1 py-0.5 rounded bg-violet-500/10 text-violet-700 font-medium dark:text-violet-300">{s}</span>
                    ))}
                    {k.lastUsedAt && <span>· Last used {formatDate(k.lastUsedAt)}</span>}
                    {k.expiresAt && <span>· Expires {formatDate(k.expiresAt)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="text-muted-foreground hover:text-rose-600 p-1 dark:hover:text-rose-300"
                  title={t("Revoke")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MCP Server info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">{t("MCP Server")}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          The ProcureAtlas MCP server exposes read-only tools (tenders.search, tenders.get, company.brain, etc.) over HTTP+SSE.
          Use an API key with <code className="text-[10px] bg-muted px-1 py-0.5 rounded">mcp:read</code> scope as the Bearer token.
        </p>
        <div className="rounded-md bg-slate-950 text-slate-100 p-3 text-[10px] font-mono overflow-x-auto">
          <div># Health check</div>
          <div>curl http://localhost:3001/health</div>
          <div className="mt-2"># List tools (requires API key)</div>
          <div>curl -X POST http://localhost:3001/ \</div>
          <div>  -H "Authorization: Bearer pak_YOUR_KEY" \</div>
          <div>  -H "Content-Type: application/json" \</div>
          <div>  -d '{"{"}"jsonrpc":"2.0","id":1,"method":"tools/list"{"}"}'</div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{value}</dd>
    </div>
  )
}
