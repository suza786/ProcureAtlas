'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  formatUSD,
  formatDate,
  daysUntil,
  deadlineUrgency,
  marketLabel,
  marketColor,
  sectorColor,
  scoreColor,
  scoreBg,
  statusColor,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Target,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  FileCheck2,
  Users,
  Shield,
  Gavel,
  Send,
  ListChecks,
} from 'lucide-react'

interface BidRoomData {
  pursuit: {
    id: string
    stage: string
    bidDecision: string | null
    decisionReason: string | null
    priority: string
    estimatedValueUSD: number | null
    winProbability: number | null
    createdAt: string
    updatedAt: string
    tender: {
      id: string
      title: string
      market: string
      sector: string
      country: string
      submissionDeadline: string | null
      valueUSD: number | null
      buyer: string | null
    }
  }
  bid: {
    id: string
    status: string
    submissionReady: boolean
    taskCount: number
    tasks: Array<{ id: string; title: string; assignee: string | null; status: string; priority: string; dueAt: string | null }>
  } | null
  approvals: Array<{ id: string; requestedBy: string; decision: string; reason: string | null; decidedAt: string | null }>
  compliance: {
    total: number
    compliant: number
    partial: number
    gap: number
    not_applicable: number
    items: Array<{
      id: string
      requirementId: string
      requirement: { criterion: string; category: string; isMandatory: boolean; threshold: string | null }
      evidence: { title: string } | null
      status: string
      confidence: number
    }>
  }
  scoring: {
    eligibility: { total: number; band: string; mandatoryPassed: number; mandatoryTotal: number; blocked: boolean }
    opportunityFit: { total: number; band: string }
    submissionReadiness: { total: number; band: string } | null
  } | null
}

const TASK_STATUS_ICON: Record<string, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  in_review: AlertCircle,
  done: CheckCircle2,
  blocked: AlertCircle,
}

export function BidRoom({ pursuitId }: { pursuitId: string }) {
  const [data, setData] = useState<BidRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const goPursuits = useAppStore((s) => s.goPursuits)
  const openCompliance = useAppStore((s) => s.openCompliance)
  const openTender = useAppStore((s) => s.openTender)

  useEffect(() => {
    fetch(`/api/pursuits`)
      .then(r => r.json())
      .then(async (res) => {
        const found = (res.items ?? []).find((p: { id: string }) => p.id === pursuitId)
        if (!found) { setLoading(false); return }
        // Fetch scoring for this tender
        const scoringRes = await fetch(`/api/scoring/${found.tender.id}`).then(r => r.json()).catch(() => null)
        setData({
          pursuit: found,
          bid: found.bid ?? null,
          approvals: [],
          compliance: { total: 0, compliant: 0, partial: 0, gap: 0, not_applicable: 0, items: [] },
          scoring: scoringRes,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pursuitId])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading Bid Room...</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">Pursuit not found.</div>

  const p = data.pursuit
  const deadline = p.tender.submissionDeadline
  const days = deadline ? daysUntil(deadline) : null
  const urgency = deadlineUrgency(deadline)

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={goPursuits}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Pursuits
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(p.tender.market))}>
            {marketLabel(p.tender.market)}
          </span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(p.tender.sector))}>
            {p.tender.sector}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
            {p.stage}
          </span>
          {p.priority === 'strategic' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700">strategic</span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.tender.title}</h1>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Buyer: <strong className="text-slate-700">{p.tender.buyer ?? '—'}</strong></span>
          <span>Estimated value: <strong className="text-slate-700">{formatUSD(p.estimatedValueUSD ?? p.tender.valueUSD)}</strong></span>
          <button
            onClick={() => openTender(p.tender.id)}
            className="text-sky-700 hover:text-sky-900 flex items-center gap-1"
          >
            <Target className="h-3 w-3" /> View Tender Digital Twin
          </button>
        </div>
      </div>

      {/* Deadline + scores row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Deadline */}
        <div className={cn(
          'rounded-lg border p-4',
          urgency === 'critical' ? 'bg-rose-500/5 border-rose-500/30' :
          urgency === 'high' ? 'bg-amber-500/5 border-amber-500/30' :
          'bg-white border-slate-200'
        )}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Submission Deadline</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{days !== null ? `${days}d` : '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(deadline)}</p>
        </div>

        {/* Eligibility score */}
        {data.scoring && (
          <>
            <ScoreTile label="Eligibility" score={data.scoring.eligibility.total} band={data.scoring.eligibility.band} sub={`${data.scoring.eligibility.mandatoryPassed}/${data.scoring.eligibility.mandatoryTotal} mandatory`} blocked={data.scoring.eligibility.blocked} />
            <ScoreTile label="Opportunity Fit" score={data.scoring.opportunityFit.total} band={data.scoring.opportunityFit.band} sub="Strategic relevance" />
            <ScoreTile label="Submission Readiness" score={data.scoring.submissionReadiness?.total ?? 0} band={data.scoring.submissionReadiness?.band ?? 'low'} sub={data.scoring.submissionReadiness ? "Operational readiness" : "No bid yet"} />
          </>
        )}
      </div>

      {/* Two-column: tasks + compliance summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-sky-600" />
              Bid Tasks
            </h2>
            <span className="text-xs text-slate-500">{data.bid?.tasks.length ?? 0}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {(!data.bid || data.bid.tasks.length === 0) ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No bid tasks defined.{' '}
                <button className="text-sky-700 hover:text-sky-900">Add tasks</button>
              </div>
            ) : (
              data.bid.tasks.map(t => {
                const Icon = TASK_STATUS_ICON[t.status] ?? Circle
                return (
                  <div key={t.id} className="px-4 py-3 flex items-start gap-2">
                    <Icon className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      t.status === 'done' ? 'text-emerald-600' :
                      t.status === 'in_progress' ? 'text-amber-600' :
                      t.status === 'blocked' ? 'text-rose-600' :
                      'text-slate-300'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        {t.assignee && <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {t.assignee}</span>}
                        {t.dueAt && <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {formatDate(t.dueAt)}</span>}
                        {t.priority === 'high' && <span className="text-amber-700 font-medium">· high priority</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Compliance summary */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              Compliance Coverage
            </h2>
            <button
              onClick={() => openCompliance(pursuitId)}
              className="text-xs text-sky-700 hover:text-sky-900"
            >
              Open matrix →
            </button>
          </div>
          <div className="p-4">
            {data.scoring?.submissionReadiness ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <CoverageTile label="Compliant" value={data.compliance.compliant} tone="emerald" />
                  <CoverageTile label="Partial" value={data.compliance.partial} tone="amber" />
                  <CoverageTile label="Gap" value={data.compliance.gap} tone="rose" />
                  <CoverageTile label="N/A" value={data.compliance.not_applicable} tone="slate" />
                </div>
                <p className="text-xs text-slate-500">
                  Phase 1 note: detailed compliance items will populate from the pursuit's requirements × evidence mapping.
                  Open the Compliance Matrix to view full breakdown.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No bid yet — compliance items will appear here once a bid is created.</p>
            )}
          </div>
        </div>
      </div>

      {/* Approvals */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            Approvals
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">No consequential action is taken without explicit human authorization.</p>
        </div>
        <div className="p-4 space-y-2">
          {data.approvals.length === 0 ? (
            <div className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">Bid Submission Approval</p>
                <p className="text-xs text-slate-500">Required before any tender submission. Phase 2 will enforce e-signature.</p>
              </div>
              <button
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 flex items-center gap-1.5"
                title="Phase 2: enforce approval flow with e-signature"
              >
                <Send className="h-3.5 w-3.5" /> Request Approval
              </button>
            </div>
          ) : (
            data.approvals.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-md border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.reason ?? 'Approval request'}</p>
                  <p className="text-xs text-slate-500">Requested by {a.requestedBy}</p>
                </div>
                <span className={cn(
                  'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                  a.decision === 'approved' ? 'bg-emerald-500/15 text-emerald-700' :
                  a.decision === 'rejected' ? 'bg-rose-500/15 text-rose-700' :
                  'bg-amber-500/15 text-amber-700'
                )}>
                  {a.decision}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Decision record */}
      {p.bidDecision && p.bidDecision !== 'pending' && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Gavel className="h-4 w-4 text-slate-600" />
            Bid Decision Record
          </h2>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-sm font-semibold px-2 py-1 rounded',
              p.bidDecision === 'bid' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
            )}>
              {p.bidDecision === 'bid' ? 'BID' : 'NO-BID'}
            </span>
            <p className="text-xs text-slate-600">{p.decisionReason ?? 'No reason recorded.'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreTile({ label, score, band, sub, blocked }: {
  label: string
  score: number
  band: string
  sub?: string
  blocked?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <div className="flex items-end gap-1 mt-1">
        <span className={cn('text-2xl font-bold', scoreColor(score))}>{score}</span>
        <span className="text-xs text-slate-400 mb-1">/100</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5">
        <div className={cn('h-full rounded-full', scoreBg(score))} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-1.5">{sub}</p>
      {blocked && <p className="text-[10px] text-rose-700 mt-0.5 font-medium">blocked</p>}
    </div>
  )
}

function CoverageTile({ label, value, tone }: {
  label: string
  value: number
  tone: 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const toneMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    rose: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
    slate: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
  }
  return (
    <div className={cn('rounded-md border p-2 text-center', toneMap[tone])}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[9px] uppercase tracking-wider font-semibold">{label}</p>
    </div>
  )
}
