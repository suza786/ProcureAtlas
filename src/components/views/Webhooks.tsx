'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { OutboxJobs } from '@/components/account/OutboxJobs'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  AlertCircle,
} from 'lucide-react'

interface WebhookEndpoint {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggeredAt: string | null
  lastResponseCode: number | null
  lastSuccessAt: string | null
  consecutiveFailures: number
  deliveryCount: number
  createdAt: string
}

interface DeliveryItem {
  id: string
  eventType: string
  status: string
  attemptCount: number
  maxAttempts: number
  nextRetryAt: string | null
  responseCode: number | null
  responseBody: string | null
  errorMessage: string | null
  deliveredAt: string | null
  createdAt: string
  endpoint: { name: string; url: string }
  signature: string
  payloadSize: number
}

const VALID_EVENTS = [
  'tender.published', 'tender.amended', 'award.published',
  'pursuit.stage_changed', 'evidence.expiring', 'approval.requested',
  'proposal.submitted', 'pursuit.created', 'approval.decided',
  'proposal.in_review', 'proposal.approved', 'proposal.withdrawn',
]

export function Webhooks() {
  const { t, formatDateTime } = useTranslation()

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'endpoints' | 'deliveries'>('endpoints')

  const load = () => {
    Promise.all([
      apiFetch('/api/webhooks').then(r => r.json()),
      apiFetch('/api/webhooks/deliveries?limit=20').then(r => r.json()),
    ]).then(([eps, dels]) => {
      setEndpoints(eps.items ?? [])
      setDeliveries(dels.items ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const deleteEndpoint = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return
    try { await apiFetch(`/api/webhooks?id=${id}`, { method: 'DELETE' }); load() }
    catch { /* Shared API notice displays the failure. */ }
  }

  const testEndpoint = async (endpointId: string) => {
    try { await apiFetch('/api/webhooks/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId, eventType: 'test.event', payload: { message: 'Test delivery from ProcureAtlas' } }),
    })
    load()
    } catch { /* Shared API notice displays the failure. */ }
  }

  return (
    <div className="space-y-4">
      <OutboxJobs />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Webhook className="h-6 w-6 text-foreground" />
            {t("Webhooks")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outbound event delivery with HMAC-SHA256 signed payloads and retry with exponential backoff.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> {t("New Endpoint")}</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['endpoints', 'deliveries'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              tab === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
            )}
          >
            {t === 'endpoints' ? `Endpoints (${endpoints.length})` : `Delivery Log (${deliveries.length})`}
          </button>
        ))}
      </div>

      {tab === 'endpoints' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading...")}</div>
          ) : endpoints.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("No webhook endpoints. Create one to receive event deliveries.")}</div>
          ) : (
            endpoints.map(e => (
              <div key={e.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{e.name}</h3>
                      <span className={cn('text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', e.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-muted-foreground')}>
                        {e.isActive ? 'active' : 'inactive'}
                      </span>
                      {e.consecutiveFailures > 0 && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          {e.consecutiveFailures} failures
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {e.events.map(ev => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 font-medium dark:text-violet-300">{ev}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>{e.deliveryCount} deliveries</span>
                      {e.lastTriggeredAt && <span>· Last: {formatDateTime(e.lastTriggeredAt)}</span>}
                      {e.lastResponseCode && <span>· HTTP {e.lastResponseCode}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => testEndpoint(e.id)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted"
                    >
                      <Send className="h-2.5 w-2.5" /> {t("Test")}</button>
                    <button
                      onClick={() => deleteEndpoint(e.id)}
                      className="text-muted-foreground hover:text-rose-600 p-1 dark:hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {deliveries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("No deliveries yet.")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Event")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Endpoint")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Status")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Attempts")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">HTTP</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Time")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map(d => (
                    <tr key={d.id} className="hover:bg-muted">
                      <td className="px-4 py-2.5 text-xs font-medium text-foreground">{d.eventType}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.endpoint.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          d.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                          d.status === 'failed' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' :
                          d.status === 'retrying' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                          'bg-slate-500/15 text-muted-foreground'
                        )}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.attemptCount}/{d.maxAttempts}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.responseCode ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateWebhookModal
          onClose={() => setShowCreate(false)}
          onCreated={(secret) => { setShowCreate(false); setCreatedSecret(secret); load() }}
        />
      )}

      {/* Secret reveal */}
      {createdSecret && (
        <div className="fixed inset-0 bg-slate-950/30 z-50 flex items-center justify-center p-4" onClick={() => setCreatedSecret(null)}>
          <div className="w-full max-w-md rounded-lg bg-card p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <h2 className="text-sm font-semibold text-foreground">{t("Webhook Secret Created")}</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{t("Copy this signing secret now — it will not be shown again.")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-950 text-emerald-400 p-2 rounded font-mono break-all">{createdSecret}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(createdSecret); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
              >
                {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-300" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{t("Verify signatures using:")}{' '}<code className="bg-muted px-1 rounded">X-ProcureAtlas-Signature: sha256=...</code></p>
            <button onClick={() => setCreatedSecret(null)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">{t("Dismiss")}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateWebhookModal({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string) => void }) {
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['tender.published'])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name || !url || selectedEvents.length === 0) {
      setError('Name, URL, and at least one event required.')
      return
    }
    setCreating(true)
    try {
      const res = await apiFetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, events: selectedEvents }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed')
        return
      }
      onCreated(data.secret)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("Create Webhook Endpoint")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Name")}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t("e.g. Slack notification")} className="w-full text-sm border border-border rounded-md px-3 py-1.5 outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">URL</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full text-sm border border-border rounded-md px-3 py-1.5 outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Events")}</label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {VALID_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev)}
                    onChange={e => {
                      if (e.target.checked) setSelectedEvents([...selectedEvents, ev])
                      else setSelectedEvents(selectedEvents.filter(x => x !== ev))
                    }}
                  />
                  <code className="text-foreground">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={create} disabled={creating} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {t("Create")}</button>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">{t("Cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
