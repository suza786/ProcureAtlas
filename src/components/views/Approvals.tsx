'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { WorkflowDialog } from '@/components/ui/workflow-dialog'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDate, formatDateTime, formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Settings,
} from 'lucide-react'

interface ApprovalItem {
  id: string
  triggerType: string
  stepOrder: number
  requestedBy: string
  approverRole: string | null
  decision: string
  reason: string | null
  slaDueAt: string | null
  decidedAt: string | null
  escalatedAt: string | null
  createdAt: string
  isOverdue: boolean
  pursuit: { id: string; stage: string; tender: { title: string; market: string; submissionDeadline: string | null; valueUSD: number | null } }
  approver: { email: string; name: string | null } | null
  proposal: { id: string; title: string } | null
}

const TRIGGER_LABELS: Record<string, string> = {
  bid_decision: 'Bid / No-Bid',
  submission: 'Submission',
  pricing: 'Pricing',
  legal: 'Legal',
  evidence_verification: 'Evidence Verification',
}

export function Approvals() {
  const { t, formatDateTime, formatDate } = useTranslation()

  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [actioning, setActioning] = useState<string | null>(null)
  const [showChains, setShowChains] = useState(false)

  const load = () => {
    apiFetch(`/api/approvals?status=${filter === 'all' ? '' : filter}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const decide = async (id: string, decision: string) => {
    const reason = decision === 'approved' ? '' : prompt(`Reason for ${decision}:`) ?? ''
    setActioning(id)
    try { await apiFetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    })
    load()
    } catch { /* Shared API notice displays the failure. */ }
    finally { setActioning(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-foreground" />
            {t("Approvals")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            No consequential action is taken without explicit human authorization. SLA-tracked with escalation.
          </p>
        </div>
        <button
          onClick={() => setShowChains(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <Settings className="h-3.5 w-3.5" /> {t("Approval Chains")}</button>
      </div>

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading approvals...")}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No {filter} approvals.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(a => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {TRIGGER_LABELS[a.triggerType] ?? a.triggerType}
                      </span>
                      <span className={cn(
                        'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                        a.decision === 'pending' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                        a.decision === 'approved' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                        a.decision === 'rejected' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' :
                        'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      )}>
                        {a.decision.replace('_', ' ')}
                      </span>
                      {a.isOverdue && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-600 text-white flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> overdue
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{t("Step")}{' '}{a.stepOrder}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1 truncate">{a.pursuit.tender.title}</p>
                    {a.reason && <p className="text-xs text-muted-foreground mt-0.5">{a.reason}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{t("Requested by")}{' '}{a.requestedBy}</span>
                      {a.approverRole && <span>· Requires: {a.approverRole}</span>}
                      {a.approver && <span>· Decided by {a.approver.email}</span>}
                      <span>· {formatDateTime(a.createdAt)}</span>
                      {a.slaDueAt && a.decision === 'pending' && (
                        <span className={cn(a.isOverdue ? 'text-rose-600 font-medium dark:text-rose-300' : '')}>
                          · SLA: {formatDate(a.slaDueAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {a.decision === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => decide(a.id, 'approved')}
                        disabled={actioning === a.id}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actioning === a.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                        {t("Approve")}</button>
                      <button
                        onClick={() => decide(a.id, 'rejected')}
                        disabled={actioning === a.id}
                        className="flex items-center gap-1 rounded-md border border-rose-500/30 text-rose-700 px-2 py-1 text-[10px] font-medium hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        <XCircle className="h-2.5 w-2.5" /> {t("Reject")}</button>
                      <button
                        onClick={() => decide(a.id, 'changes_requested')}
                        disabled={actioning === a.id}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1"
                      >
                        {t("Changes")}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showChains && <ApprovalChainsModal onClose={() => setShowChains(false)} />}
    </div>
  )
}

function ApprovalChainsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()

  const [chains, setChains] = useState<Array<{ id: string; name: string; triggerType: string; slaHours: number; isActive: boolean; stepCount: number; steps?: Array<{ order: number; role: string; approverEmail?: string }> }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/approval-chains')
      .then(r => r.json())
      .then(d => { setChains(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <WorkflowDialog title={t("Approval Chain Configuration")} description="Review the configured approval steps and response deadlines." onClose={onClose} wide>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
        ) : chains.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No approval chains configured. Default chains are used for bid decision and submission.")}</p>
        ) : (
          <div className="space-y-3">
            {chains.map(c => (
              <div key={c.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[c.triggerType] ?? c.triggerType} · SLA: {c.slaHours}h · {c.stepCount} step(s)</p>
                  </div>
                  <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', c.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-muted-foreground')}>
                    {c.isActive ? 'active' : 'inactive'}
                  </span>
                </div>
                {c.steps && c.steps.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    {c.steps.map((s, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {i + 1}. {s.role}{s.approverEmail ? ` (${s.approverEmail})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 text-xs text-muted-foreground hover:text-foreground">{t("Close")}</button>
    </WorkflowDialog>
  )
}
