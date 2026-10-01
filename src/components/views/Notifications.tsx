'use client'

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
  alert: 'text-rose-600 bg-rose-500/10',
  deadline: 'text-amber-600 bg-amber-500/10',
  amendment: 'text-amber-600 bg-amber-500/10',
  extraction_ready: 'text-violet-600 bg-violet-500/10',
  approval_request: 'text-sky-600 bg-sky-500/10',
  system: 'text-slate-600 bg-slate-500/10',
}

export function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrefs, setShowPrefs] = useState(false)

  const load = () => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    load()
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const unreadCount = items.filter(n => !n.readAt).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-slate-700" />
            Notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'All caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
          <button onClick={() => setShowPrefs(true)} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <SettingsIcon className="h-3.5 w-3.5" /> Preferences
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(n => {
              const Icon = TYPE_ICONS[n.type] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => !n.readAt && markRead(n.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50',
                    !n.readAt && 'bg-sky-500/5'
                  )}
                >
                  <div className={cn('rounded-md p-1.5 shrink-0', SEVERITY_COLORS[n.type] ?? 'text-slate-600 bg-slate-500/10')}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm', n.readAt ? 'font-normal text-slate-600' : 'font-medium text-slate-900')}>{n.title}</p>
                      {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(n.createdAt)}</p>
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
  const [prefs, setPrefs] = useState<Array<{ channel: string; eventType: string; enabled: boolean; minSeverity: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => { setPrefs(d.items ?? []); setLoading(false) })
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
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: prefs }),
    })
    setSaving(false)
    onClose()
  }

  const channels = ['in_app', 'email', 'slack', 'teams']
  const eventTypes = ['alert', 'deadline', 'amendment', 'extraction_ready', 'approval_request', 'system', 'webhook_delivery']

  return (
    <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Notification Preferences</h2>
        <p className="text-xs text-slate-500 mb-4">Configure which notifications you receive on each channel. Email/Slack/Teams delivery requires production configuration.</p>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Event Type</th>
                  {channels.map(c => <th key={c} className="text-center py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{c.replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {eventTypes.map(et => (
                  <tr key={et} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700 font-medium">{et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
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
                            <span className={cn('h-3.5 w-3.5 rounded-full bg-white transition-transform', enabled ? 'translate-x-4' : 'translate-x-1')} />
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

        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
          <button onClick={save} disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5">Cancel</button>
        </div>
      </div>
    </div>
  )
}
