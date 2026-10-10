'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { developerRequest } from '@/lib/developer-request'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Code2,
  Key,
  Terminal,
  BookOpen,
  Activity,
  Copy,
  CheckCircle2,
  Loader2,
  Download,
} from 'lucide-react'

interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export function Developer() {
  const { t } = useTranslation()

  const [tab, setTab] = useState<'docs' | 'keys' | 'explorer' | 'usage'>('docs')
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadKeys = () => {
    apiFetch('/api/api-keys')
      .then(r => r.json())
      .then(d => { setKeys(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadKeys() }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Code2 className="h-6 w-6 text-slate-700" />
          {t("Developer Portal")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Public API marketplace, interactive explorer, and documentation. Versioned REST API at <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">/api/v1/*</code>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: 'docs', label: 'API Docs', icon: BookOpen },
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'explorer', label: 'Interactive Explorer', icon: Terminal },
          { id: 'usage', label: 'Usage Stats', icon: Activity },
        ].map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
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

      {tab === 'docs' && <ApiDocs />}
      {tab === 'keys' && <ApiKeys keys={keys} loading={loading} onChanged={loadKeys} />}
      {tab === 'explorer' && <ApiExplorer />}
      {tab === 'usage' && <UsageStats />}
    </div>
  )
}

// ============================================================
// API Documentation
// ============================================================

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/tenders', desc: 'Search tenders with filters (market, sector, status, q)', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/tenders/:id', desc: 'Get tender by ID with full digital twin', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/awards', desc: 'Search awards with filters', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/buyers', desc: 'List buyer organizations', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/suppliers', desc: 'List supplier organizations with profiles', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/pursuits', desc: 'List pursuits for your tenant', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/company', desc: 'Get your company brain (evidence graph)', scope: 'api:read' },
  { method: 'POST', path: '/api/v1/embeddings', desc: 'Generate embeddings for semantic search', scope: 'api:write' },
  { method: 'GET', path: '/api/v1/embeddings?q=', desc: 'Semantic search across cached embeddings', scope: 'api:read' },
  { method: 'POST', path: '/api/v1/exports', desc: 'Create data export (JSON/CSV)', scope: 'api:write' },
  { method: 'GET', path: '/api/v1/exports', desc: 'List export jobs', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/exports/:id/download', desc: 'Download a completed export before its 24 hour expiry', scope: 'api:read' },
  { method: 'GET', path: '/api/v1/usage', desc: 'Get API usage statistics', scope: 'api:read' },
  { method: 'POST', path: '/api/v1/webhooks/ingest', desc: 'Inbound webhook from external sources', scope: 'none' },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-sky-500/15 text-sky-700',
  POST: 'bg-emerald-500/15 text-emerald-700',
  PATCH: 'bg-amber-500/15 text-amber-700',
  DELETE: 'bg-rose-500/15 text-rose-700',
}

function ApiDocs() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {/* Quick start */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">{t("Quick Start")}</h2>
        <p className="text-xs text-slate-600 mb-3">The public API uses Bearer keys with api:read or api:write scopes. Create a key in the API Keys tab. Inbound webhooks use their configured signature authentication.</p>
        <div className="rounded-md bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto">
          <div className="text-slate-400"># List tenders</div>
          <div>curl -X GET <span className="text-sky-400">"https://your-domain.com/api/v1/tenders?market=BD&limit=5"</span> \</div>
          <div className="ml-4">-H <span className="text-emerald-400">"Authorization: Bearer pak_YOUR_API_KEY"</span></div>
          <div className="mt-2 text-slate-400"># Response includes rate limit headers</div>
          <div className="text-slate-500"># X-RateLimit-Limit: 200</div>
          <div className="text-slate-500"># X-RateLimit-Remaining: 198</div>
          <div className="text-slate-500"># X-RateLimit-Reset: 2026-10-01T12:00:00Z</div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Endpoints ({ENDPOINTS.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {ENDPOINTS.map((ep, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <span className={cn('text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded w-12 text-center', METHOD_COLORS[ep.method])}>
                {ep.method}
              </span>
              <code className="text-xs font-mono text-slate-900 flex-1">{ep.path}</code>
              <span className="text-[10px] text-slate-500 truncate">{ep.desc}</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 shrink-0">
                {ep.scope}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rate limits */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Rate Limits by Plan")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
          {[
            { plan: 'Free', limit: '100/hr', burst: '20' },
            { plan: 'Intelligence', limit: '1K/hr', burst: '50' },
            { plan: 'Pursuit Pro', limit: '5K/hr', burst: '100' },
            { plan: 'Team', limit: '25K/hr', burst: '200' },
            { plan: 'Enterprise', limit: '100K/hr', burst: '500' },
          ].map(t => (
            <div key={t.plan} className="rounded-md border border-slate-200 p-2 text-center">
              <p className="font-semibold text-slate-900">{t.plan}</p>
              <p className="text-sm text-slate-700 mt-0.5">{t.limit}</p>
              <p className="text-[10px] text-slate-500">burst: {t.burst}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Rate limits use token bucket algorithm. 429 response includes Retry-After header.</p>
      </div>

      {/* Code examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-900 mb-2">{t("TypeScript Example")}</h3>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[10px] font-mono overflow-x-auto">
{`const response = await fetch(
  process.env.PA_BASE_URL + '/api/v1/tenders?market=BD&limit=10',
  { headers: { Authorization: 'Bearer ' + process.env.PA_API_KEY } }
);
if (!response.ok) throw new Error(await response.text());
const tenders = await response.json();`}
          </pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-900 mb-2">{t("Python Example")}</h3>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[10px] font-mono overflow-x-auto">
{`import json, os, urllib.request

request = urllib.request.Request(
    os.environ['PA_BASE_URL'] + '/api/v1/exports',
    data=json.dumps({'exportType': 'pursuits', 'format': 'csv'}).encode(),
    headers={'Authorization': 'Bearer ' + os.environ['PA_API_KEY'],
             'Content-Type': 'application/json'},
    method='POST'
)
with urllib.request.urlopen(request) as response:
    export = json.load(response)
# GET export['downloadUrl'] with the same Bearer header.`}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// API Keys Management
// ============================================================

function ApiKeys({ keys, loading, onChanged }: { keys: ApiKeyItem[]; loading: boolean; onChanged: () => void }) {
  const { t } = useTranslation()

  const [showCreate, setShowCreate] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const createKey = async (name: string, scopes: string[]) => {
    try { const res = await apiFetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scopes }),
    })
    const data = await res.json()
    if (res.ok) {
      setCreatedKey(data.key)
      setShowCreate(false)
      onChanged()
    }
    } catch { /* Shared API notice displays the failure; keep the form open. */ }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key?')) return
    try { await apiFetch(`/api/api-keys?id=${id}`, { method: 'DELETE' }); onChanged() }
    catch { /* Shared API notice displays the failure. */ }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{keys.length} active API key(s)</p>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
          <Key className="h-3.5 w-3.5" /> {t("New Key")}</button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">{t("Loading...")}</div>
      ) : keys.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">{t("No API keys. Create one to access the public API.")}</div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {keys.map(k => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <Key className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{k.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{k.keyPrefix}...</code>
                  {k.scopes.map(s => <span key={s} className="text-[9px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-700 font-medium">{s}</span>)}
                  {k.lastUsedAt && <span className="text-[10px] text-slate-500">· Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <button onClick={() => revokeKey(k.id)} className="text-slate-400 hover:text-rose-600 text-xs">{t("Revoke")}</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateKeyModal onClose={() => setShowCreate(false)} onCreate={createKey} />
      )}

      {createdKey && (
        <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={() => setCreatedKey(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">{t("API Key Created")}</h2>
            </div>
            <p className="text-xs text-slate-600 mb-2">{t("Copy this key now — it will not be shown again.")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-900 text-emerald-400 p-2 rounded font-mono break-all">{createdKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs">
                {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setCreatedKey(null)} className="mt-3 text-xs text-slate-500 hover:text-slate-900">{t("Dismiss")}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, scopes: string[]) => void }) {
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['api:read'])
  return (
    <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-900 mb-4">{t("Create API Key")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t("Name")}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production API key" className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t("Scopes")}</label>
            <div className="space-y-1">
              {['api:read', 'api:write', 'mcp:read'].map(s => (
                <label key={s} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={scopes.includes(s)} onChange={e => e.target.checked ? setScopes([...scopes, s]) : setScopes(scopes.filter(x => x !== s))} />
                  <code className="text-slate-700">{s}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onCreate(name, scopes)} disabled={!name} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">{t("Create")}</button>
            <button onClick={onClose} className="text-xs text-slate-500 px-3 py-1.5">{t("Cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Interactive API Explorer
// ============================================================

function ApiExplorer() {
  const { t } = useTranslation()

  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0])
  const [params, setParams] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [entityId, setEntityId] = useState('')
  const [body, setBody] = useState('{"texts":["Text to embed"]}')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const download = async (url: string) => {
    const request = developerRequest({ method: 'GET', path: url }, token, '', '', '')
    const res = await fetch(request.url, request.init)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const objectUrl = URL.createObjectURL(await res.blob())
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = res.headers.get('content-type')?.includes('csv') ? 'export.csv' : 'export.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  const runRequest = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    setDownloadUrl(null)
    try {
      const request = developerRequest(selectedEndpoint, token, entityId, params, body)
      if (selectedEndpoint.path.endsWith('/download')) {
        await download(request.url)
        setResponse('Download completed')
        return
      }
      const res = await fetch(request.url, request.init)
      const text = await res.text()
      let display = text
      try {
        const data = JSON.parse(text)
        display = JSON.stringify(data, null, 2)
        if (res.ok && typeof data.downloadUrl === 'string' && /^\/api\/v1\/exports\/[^/?]+\/download$/.test(data.downloadUrl)) setDownloadUrl(data.downloadUrl)
      } catch { /* Keep non-JSON server responses visible. */ }
      setResponse(`HTTP ${res.status}\n${display}`)
      if (!res.ok) setError(`Request failed with HTTP ${res.status}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("Interactive API Explorer")}</h2>
        <p className="text-xs text-slate-500 mb-3">Run a live request using a complete API key. The key stays in memory while this tab is open. Required scope: {selectedEndpoint.scope}.</p>

        <div className="space-y-3">
          <div>
            <label htmlFor="explorer-key" className="block text-xs font-medium text-slate-700 mb-1">{t("Bearer API key")}</label>
            <input id="explorer-key" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={t("Paste your full API key")} className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5" />
            <button className="text-xs underline mt-1" onClick={() => setToken('')}>{t("Clear key")}</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t("Endpoint")}</label>
            <select
              value={`${selectedEndpoint.method} ${selectedEndpoint.path}`}
              onChange={e => {
                const ep = ENDPOINTS.find(ep => `${ep.method} ${ep.path}` === e.target.value)
                if (ep) {
                  setSelectedEndpoint(ep)
                  setBody(ep.path === '/api/v1/exports' ? '{"exportType":"pursuits","format":"json"}' : '{"texts":["Text to embed"]}')
                  setResponse(null)
                  setDownloadUrl(null)
                }
              }}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white"
            >
              {ENDPOINTS.filter(ep => ep.scope !== 'none').map(ep => (
                <option key={`${ep.method} ${ep.path}`} value={`${ep.method} ${ep.path}`}>{ep.method} {ep.path} — {ep.desc}</option>
              ))}
            </select>
          </div>

          {selectedEndpoint.path.includes(':id') && <div>
            <label htmlFor="explorer-id" className="block text-xs font-medium text-slate-700 mb-1">{t("Entity ID")}</label>
            <input id="explorer-id" value={entityId} onChange={e => setEntityId(e.target.value)} placeholder={t("Enter an existing entity ID")} className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5" />
          </div>}
          {selectedEndpoint.method !== 'GET' && <div>
            <label htmlFor="explorer-body" className="block text-xs font-medium text-slate-700 mb-1">{t("JSON request body")}</label>
            <textarea id="explorer-body" value={body} onChange={e => setBody(e.target.value)} rows={5} className="w-full text-sm font-mono border border-slate-200 rounded-md px-3 py-1.5" />
          </div>}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t("Query Parameters (key=value&key=value)")}</label>
            <input
              type="text"
              value={params}
              onChange={e => setParams(e.target.value)}
              placeholder="e.g. market=BD&sector=Cyber&limit=5"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono"
            />
          </div>

          <button
            onClick={runRequest}
            disabled={loading || !token.trim() || (selectedEndpoint.path.includes(':id') && !entityId.trim())}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
            {loading ? 'Running...' : 'Run Request'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700">{error}</div>
      )}

      {response && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-900 mb-2">{t("Response")}</h3>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[10px] font-mono overflow-x-auto max-h-96 overflow-y-auto">{response}</pre>
          {downloadUrl && <button className="mt-3 flex items-center gap-1 text-xs underline" onClick={() => download(downloadUrl).catch(cause => setError(cause.message))}><Download className="h-3.5 w-3.5" />{t("Download export")}</button>}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Usage Stats
// ============================================================

function UsageStats() {
  const { t, formatDate } = useTranslation()

  const [stats, setStats] = useState<{
    subscription: { plan: string; currentPeriodStart: string; currentPeriodEnd: string }
    usage: Array<{ metricType: string; used: number; limit: number; percentage: number }>
    providerCalls: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = () => {
    apiFetch('/api/billing/usage')
      .then(response => response.json())
      .then(data => { setStats(data); setError(null); setLoading(false) })
      .catch(cause => { setError(cause.message); setLoading(false) })
  }
  useEffect(() => { load() }, [])
  if (loading) return <div className="p-8 text-center text-sm text-slate-500">{t("Loading usage stats...")}</div>
  if (!stats) return <div role="alert" className="p-8 text-sm text-rose-700">{error ?? 'Unable to load usage.'} <button className="underline" onClick={load}>{t("Retry")}</button></div>
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("Current Period Usage")}</h2>
        <p className="mt-1 text-xs text-slate-500">Plan: {stats.subscription.plan} · {formatDate(stats.subscription.currentPeriodStart)} to {formatDate(stats.subscription.currentPeriodEnd)}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {stats.usage.map(metric => (
          <div key={metric.metricType} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium capitalize text-slate-500">{metric.metricType.replace(/_/g, ' ')}</p>
            <p className="text-xl font-semibold text-slate-900">{metric.used.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{metric.limit.toLocaleString()} included · {metric.percentage}% used</p>
          </div>
        ))}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">{t("Provider Calls")}</p>
          <p className="text-xl font-semibold text-slate-900">{typeof stats.providerCalls === 'number' ? stats.providerCalls.toLocaleString() : 'Unavailable'}</p>
          <p className="text-xs text-slate-500">{t("Recorded during this billing period")}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">Daily history, endpoint rankings, and live API key rate limits are unavailable in this usage summary.</p>
    </div>
  )
}
