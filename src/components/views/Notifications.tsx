'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Bell,
  CheckCheck,
  Settings as SettingsIcon,
  AlertCircle,
  Clock,
  Cpu,
  Shield,
  FileText,
} from 'lucide-react'

interface NotificationItem {
  id: string
  tenantId: string
  userId: string | null
  type: string
  title: string
  message: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  alert: AlertCircle,
  deadline: Clock,
  amendment: FileText,
  extraction_ready: Cpu,
  approval_request: Shield,
  system: Bell,
}

const SEVERITY_COLORS: Record<string, string> = {
  alert: 'text-rose-600 bg-rose-500/10 dark:text-rose-300',
  deadline: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  amendment: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  extraction_ready: 'text-violet-600 bg-violet-500/10 dark:text-violet-300',
  approval_request: 'text-sky-600 bg-sky-500/10 dark:text-sky-300',
  system: 'text-muted-foreground bg-slate-500/10',
}

export function Notifications() {
  const { t, formatDateTime } = useTranslation()

  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrefs, setShowPrefs] = useState(false)

  const load = () => {
    apiFetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    try { await apiFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }); load() }
    catch { /* Shared API notice displays the failure. */ }
  }

  const markRead = async (id: string) => {
    try { await apiFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load() }
    catch { /* Shared API notice displays the failure. */ }
  }

  const unreadCount = items.filter(n => !n.readAt).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-foreground" />
            {t("Notifications")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'All caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              <CheckCheck className="h-3.5 w-3.5" /> {t("Mark all read")}</button>
          )}
          <button onClick={() => setShowPrefs(true)} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <SettingsIcon className="h-3.5 w-3.5" /> {t("Preferences")}</button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading notifications...")}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("No notifications.")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(n => {
              const Icon = TYPE_ICONS[n.type] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => !n.readAt && markRead(n.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted',
                    !n.readAt && 'bg-sky-500/5'
                  )}
                >
                  <div className={cn('rounded-md p-1.5 shrink-0', SEVERITY_COLORS[n.type] ?? 'text-muted-foreground bg-slate-500/10')}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm', n.readAt ? 'font-normal text-muted-foreground' : 'font-medium text-foreground')}>{n.title}</p>
                      {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(n.createdAt)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showPrefs && <NotificationPrefsModal onClose={() => setShowPrefs(false)} />}
    </div>
  )
}

function NotificationPrefsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()

  const [prefs, setPrefs] = useState<Array<{ channel: string; eventType: string; enabled: boolean; minSeverity: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => { setPrefs(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (channel: string, eventType: string) => {
    setPrefs(prefs.map(p =>
      p.channel === channel && p.eventType === eventType
        ? { ...p, enabled: !p.enabled }
        : p
    ))
  }

  const save = async () => {
    setSaving(true)
    try { await apiFetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: prefs }),
    })
    onClose()
    } catch { /* Shared API notice displays the failure. */ }
    finally { setSaving(false) }
  }

  const channels = ['in_app', 'email', 'slack', 'teams']
  const eventTypes = ['alert', 'deadline', 'amendment', 'extraction_ready', 'approval_request', 'system', 'webhook_delivery']

  return (
    <div className="fixed inset-0 bg-slate-950/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-card p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-foreground mb-1">{t("Notification Preferences")}</h2>
        <p className="text-xs text-muted-foreground mb-4">Configure which notifications you receive on each channel. Email/Slack/Teams delivery requires production configuration.</p>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("Event Type")}</th>
                  {channels.map(c => <th key={c} className="text-center py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{c.replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {eventTypes.map(et => (
                  <tr key={et} className="border-b border-border">
                    <td className="py-2 text-foreground font-medium">{et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                    {channels.map(ch => {
                      const pref = prefs.find(p => p.channel === ch && p.eventType === et)
                      const enabled = pref?.enabled ?? true
                      return (
                        <td key={ch} className="text-center py-2">
                          <button
                            onClick={() => toggle(ch, et)}
                            className={cn(
                              'inline-flex h-5 w-9 items-center rounded-full transition-colors',
                              enabled ? 'bg-emerald-500' : 'bg-slate-300'
                            )}
                          >
                            <span className={cn('h-3.5 w-3.5 rounded-full bg-card transition-transform', enabled ? 'translate-x-4' : 'translate-x-1')} />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <button onClick={save} disabled={saving} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">{t("Cancel")}</button>
        </div>
      </div>
    </div>
  )
}
