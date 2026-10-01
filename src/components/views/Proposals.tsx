'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDate, formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  FileText,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ProposalItem {
  id: string
  title: string
  status: string
  currentVersion: number
  totalSections: number
  completedSections: number
  evidenceCoverage: number
  wordCount: number
  lastEditedAt: string | null
  lastEditedBy: string | null
  createdAt: string
  updatedAt: string
  pursuit: {
    id: string
    stage: string
    tender: { title: string; market: string; sector: string; submissionDeadline: string | null; valueUSD: number | null }
  }
  sections: Array<{ id: string; status: string; sectionType: string; title: string; wordCount: number; evidenceCount: number; hasGaps: boolean }>
  versionCount: number
  approvalCount: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-700',
  in_review: 'bg-amber-500/15 text-amber-700',
  approved: 'bg-emerald-500/15 text-emerald-700',
  submitted: 'bg-violet-500/15 text-violet-700',
  withdrawn: 'bg-rose-500/15 text-rose-700',
}

export function Proposals() {
  const [items, setItems] = useState<ProposalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const openProposalEditor = useAppStore((s) => s.openProposalEditor)
  const goPursuits = useAppStore((s) => s.goPursuits)

  const load = () => {
    fetch('/api/proposals')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-slate-700" />
            Proposal Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-assisted proposal drafting grounded in approved evidence. Every section links to evidence or flags gaps.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> New Proposal
        </button>
      </div>

      {/* Create modal */}
      {showCreate && <CreateProposalModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); openProposalEditor(id) }} />}

      {/* Proposal list */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading proposals...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-2">No proposals yet.</p>
            <p className="text-xs text-slate-400">Create a proposal from any pursuit in the bidding stage.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => openProposalEditor(p.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className={cn('rounded-md p-2 shrink-0', STATUS_COLORS[p.status] ?? 'bg-slate-500/15 text-slate-700')}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.title}</p>
                  <p className="text-xs text-slate-500 truncate">{p.pursuit.tender.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_COLORS[p.status])}>{p.status}</span>
                    <span>v{p.currentVersion}</span>
                    <span>{p.completedSections}/{p.totalSections} sections</span>
                    <span>{p.wordCount} words</span>
                    <span className={cn('flex items-center gap-0.5', p.evidenceCoverage > 0.5 ? 'text-emerald-600' : 'text-amber-600')}>
                      <CheckCircle2 className="h-2.5 w-2.5" /> {Math.round(p.evidenceCoverage * 100)}% evidence
                    </span>
                    {p.lastEditedAt && <span>· Edited {formatDate(p.lastEditedAt)}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateProposalModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [pursuits, setPursuits] = useState<Array<{ id: string; stage: string; tender: { title: string; market: string } }>>([])
  const [selectedPursuitId, setSelectedPursuitId] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pursuits')
      .then(r => r.json())
      .then(d => {
        const bidding = (d.items ?? []).filter((p: { stage: string }) => ['bidding', 'qualifying'].includes(p.stage))
        setPursuits(bidding)
      })
  }, [])

  const create = async () => {
    if (!selectedPursuitId || !title) {
      setError('Select a pursuit and enter a title.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pursuitId: selectedPursuitId, title }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create proposal')
        return
      }
      onCreated(data.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Create Proposal</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Pursuit</label>
            <select
              value={selectedPursuitId}
              onChange={e => setSelectedPursuitId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400 bg-white"
            >
              <option value="">Select a pursuit...</option>
              {pursuits.map(p => (
                <option key={p.id} value={p.id}>{p.tender.title} ({p.stage})</option>
              ))}
            </select>
            {pursuits.length === 0 && (
              <p className="text-[10px] text-slate-500 mt-1">No pursuits in bidding stage. Create one from Pursuits.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Proposal Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Technical Proposal — SOC Platform"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
            />
          </div>
          {error && <p className="text-xs text-rose-700">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={create}
              disabled={creating || !selectedPursuitId || !title}
              className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create with 9 default sections
            </button>
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Proposal Editor
// ============================================================

export function ProposalEditor({ proposalId }: { proposalId: string }) {
  const [proposal, setProposal] = useState<ProposalItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState<{ success: boolean; content?: string; evidenceUsed?: Array<{ evidenceId: string; title: string; snippet: string }>; gaps?: string[]; error?: string; note?: string } | null>(null)
  const goProposals = useAppStore((s) => s.goProposals)

  const load = () => {
    fetch(`/api/proposals/${proposalId}`)
      .then(r => r.json())
      .then(d => {
        setProposal(d)
        if (!activeSectionId && d.sections?.length > 0) {
          setActiveSectionId(d.sections[0].id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [proposalId])

  const saveSection = async (sectionId: string, content: string) => {
    await fetch(`/api/proposals/${proposalId}/sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, status: 'drafting' }),
    })
    load()
  }

  const draftSection = async (sectionId: string) => {
    setDrafting(true)
    setDraftResult(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/draft-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      })
      const data = await res.json()
      setDraftResult(data)
      if (data.success) load()
    } catch (e) {
      setDraftResult({ success: false, error: (e as Error).message })
    } finally {
      setDrafting(false)
    }
  }

  const createVersion = async () => {
    const summary = prompt('Version change summary:', `Version ${(proposal?.currentVersion ?? 0) + 1}`)
    if (!summary) return
    await fetch(`/api/proposals/${proposalId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeSummary: summary }),
    })
    load()
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading proposal...</div>
  if (!proposal) return <div className="p-6 text-sm text-rose-600">Proposal not found.</div>

  const activeSection = proposal.sections?.find((s: { id: string }) => s.id === activeSectionId)

  return (
    <div className="space-y-4">
      <button onClick={goProposals} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to Proposals
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{proposal.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{proposal.pursuit.tender.title}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_COLORS[proposal.status])}>{proposal.status}</span>
            <span>v{proposal.currentVersion}</span>
            <span>{proposal.wordCount} words</span>
            <span>{Math.round(proposal.evidenceCoverage * 100)}% evidence coverage</span>
          </div>
        </div>
        <button
          onClick={createVersion}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Save Version
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Section sidebar */}
        <div className="rounded-lg border border-slate-200 bg-white p-2 max-h-[600px] overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-2 py-1">Sections</p>
          {proposal.sections?.map((s: { id: string; order: number; title: string; status: string; sectionType: string; wordCount: number; evidenceCount: number; hasGaps: boolean }) => (
            <button
              key={s.id}
              onClick={() => { setActiveSectionId(s.id); setDraftResult(null) }}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                activeSectionId === s.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <span className={cn(
                'mt-0.5 h-2 w-2 rounded-full shrink-0',
                s.status === 'approved' ? 'bg-emerald-500' :
                s.status === 'in_review' ? 'bg-amber-500' :
                s.status === 'drafting' ? 'bg-sky-500' :
                'bg-slate-300'
              )} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.title}</p>
                <p className={cn('text-[9px]', activeSectionId === s.id ? 'text-slate-400' : 'text-slate-400')}>
                  {s.wordCount}w · {s.evidenceCount} ev{s.hasGaps ? ' · gaps' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Section editor */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {activeSection && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{activeSection.title}</h3>
                  <p className="text-[10px] text-slate-500">{activeSection.sectionType} · {activeSection.wordCount} words · {activeSection.evidenceCount} evidence linked</p>
                </div>
                <button
                  onClick={() => draftSection(activeSection.id)}
                  disabled={drafting}
                  className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {drafting ? 'Drafting...' : 'AI Draft'}
                </button>
              </div>

              {draftResult && (
                <div className={cn(
                  'rounded-md border p-2.5 text-xs',
                  draftResult.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
                )}>
                  <p className={cn('font-medium', draftResult.success ? 'text-emerald-800' : 'text-rose-800')}>
                    {draftResult.success ? `Draft generated — ${draftResult.evidenceUsed?.length ?? 0} evidence cited, ${draftResult.gaps?.length ?? 0} gaps flagged` : 'Draft failed'}
                  </p>
                  {draftResult.error && <p className="text-rose-700 mt-1">{draftResult.error}</p>}
                  {draftResult.note && <p className="text-slate-600 mt-1">{draftResult.note}</p>}
                  {draftResult.gaps && draftResult.gaps.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-amber-800 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Evidence Gaps:</p>
                      <ul className="mt-1 space-y-0.5 text-amber-700">
                        {draftResult.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <textarea
                key={activeSection.id + (draftResult?.content ?? '')}
                defaultValue={activeSection.content ?? draftResult?.content ?? ''}
                onBlur={(e) => saveSection(activeSection.id, e.target.value)}
                placeholder="Draft this section... Use the AI Draft button for evidence-grounded assistance."
                className="w-full min-h-[400px] text-sm border border-slate-200 rounded-md p-3 outline-none focus:border-slate-400 font-mono"
              />

              <p className="text-[10px] text-slate-400">Content auto-saves on blur. Use AI Draft for evidence-grounded assistance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
