'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'
import { WorkflowDialog } from '@/components/ui/workflow-dialog'

import { useEffect, useState, useRef } from 'react'
import { SaveQueue } from '@/lib/proposal-save-queue'
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

interface ProposalSectionSummary {
  id: string; status: string; sectionType: string; title: string; wordCount: number; evidenceCount: number; hasGaps: boolean
}
interface ProposalSectionDetail extends ProposalSectionSummary { order: number; content: string | null; revision: number }
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
  sections: ProposalSectionSummary[]
  versionCount: number
  approvalCount: number
}

interface ProposalDetail extends Omit<ProposalItem, 'sections' | 'versionCount' | 'approvalCount'> {
  sections: ProposalSectionDetail[]
  revision: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/15 text-foreground',
  in_review: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  submitted: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  withdrawn: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export function Proposals() {
  const { t, formatDate } = useTranslation()

  const [items, setItems] = useState<ProposalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const openProposalEditor = useAppStore((s) => s.openProposalEditor)
  const goPursuits = useAppStore((s) => s.goPursuits)

  const load = () => {
    apiFetch('/api/proposals')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-foreground" />
            {t("Proposal Studio")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-assisted proposal drafting grounded in approved evidence. Every section links to evidence or flags gaps.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> {t("New Proposal")}</button>
      </div>

      {/* Create modal */}
      {showCreate && <CreateProposalModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); openProposalEditor(id) }} />}

      {/* Proposal list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading proposals...")}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">{t("No proposals yet.")}</p>
            <p className="text-xs text-muted-foreground">{t("Create a proposal from any pursuit in the bidding stage.")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((p) => (
              <button
                key={p.id}
                onClick={() => openProposalEditor(p.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted"
              >
                <div className={cn('rounded-md p-2 shrink-0', STATUS_COLORS[p.status] ?? 'bg-slate-500/15 text-foreground')}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.pursuit.tender.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_COLORS[p.status])}>{p.status}</span>
                    <span>v{p.currentVersion}</span>
                    <span>{p.completedSections}/{p.totalSections} sections</span>
                    <span>{p.wordCount} words</span>
                    <span className={cn('flex items-center gap-0.5', p.evidenceCoverage > 0.5 ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300')}>
                      <CheckCircle2 className="h-2.5 w-2.5" /> {Math.round(p.evidenceCoverage * 100)}% evidence
                    </span>
                    {p.lastEditedAt && <span>· Edited {formatDate(p.lastEditedAt)}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateProposalModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()

  const [pursuits, setPursuits] = useState<Array<{ id: string; stage: string; tender: { title: string; market: string } }>>([])
  const [selectedPursuitId, setSelectedPursuitId] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/pursuits')
      .then(r => r.json())
      .then(d => {
        const bidding = (d.items ?? []).filter((p: { stage: string }) => ['bidding', 'qualifying'].includes(p.stage))
        setPursuits(bidding)
      })
      .catch(cause => setError(cause.message))
  }, [])

  const create = async () => {
    if (!selectedPursuitId || !title) {
      setError('Select a pursuit and enter a title.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await apiFetch('/api/proposals', {
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
    <WorkflowDialog title={t("Create Proposal")} description="Choose a pursuit and enter a title to start your proposal." onClose={onClose} busy={creating}>
        <div className="space-y-3">
          <div>
            <label htmlFor="proposal-pursuit" className="block text-xs font-medium text-foreground mb-1">{t("Pursuit")}</label>
            <select
              id="proposal-pursuit"
              value={selectedPursuitId}
              onChange={e => setSelectedPursuitId(e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 outline-none focus:border-slate-400 bg-card"
            >
              <option value="">{t("Select a pursuit...")}</option>
              {pursuits.map(p => (
                <option key={p.id} value={p.id}>{p.tender.title} ({p.stage})</option>
              ))}
            </select>
            {pursuits.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{t("No pursuits in bidding stage. Create one from Pursuits.")}</p>
            )}
          </div>
          <div>
            <label htmlFor="proposal-title" className="block text-xs font-medium text-foreground mb-1">{t("Proposal Title")}</label>
            <input
              id="proposal-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Technical Proposal — SOC Platform"
              className="w-full text-sm border border-border rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
            />
          </div>
          {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={create}
              disabled={creating || !selectedPursuitId || !title}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {t("Create with 9 default sections")}</button>
            <button disabled={creating} onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">{t("Cancel")}</button>
          </div>
        </div>
    </WorkflowDialog>
  )
}

// ============================================================
// Proposal Editor
// ============================================================

export function ProposalEditor({ proposalId }: { proposalId: string }) {
  const { t } = useTranslation()

  const [proposal, setProposal] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState<{ success: boolean; content?: string; evidenceUsed?: Array<{ evidenceId: string; title: string; snippet: string }>; gaps?: string[]; error?: string; note?: string } | null>(null)
  const goProposals = useAppStore((s) => s.goProposals)
  const auth = useAppStore(s => s.auth)
  const canReview = auth.authenticated && ['manager','admin','owner'].includes(auth.user?.role ?? '')

  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const dirty = useRef<Record<string, string>>({})
  const current = useRef<ProposalDetail | null>(null)
  const queue = useRef(new SaveQueue())
  const operation = useRef(false)
  const generation = useRef(0)
  const load = async () => {
    const requestGeneration = generation.current
    try {
      const response = await apiFetch('/api/proposals/' + proposalId)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not load proposal')
      if (generation.current !== requestGeneration) return
      current.current = data; setProposal(data)
      setActiveSectionId(previous => previous ?? data.sections?.[0]?.id ?? null)
    } catch (error) { if (generation.current === requestGeneration) setSaveError((error as Error).message) }
    finally { if (generation.current === requestGeneration) setLoading(false) }
  }
  useEffect(() => {
    generation.current++; current.current = null; dirty.current = {}; setDrafts({}); queue.current = new SaveQueue(); setProposal(null); setActiveSectionId(null); setDraftResult(null); setSaveError(null); setPendingSaves(0); operation.current = false; setDrafting(false); setLoading(true)
    void load()
    return () => { generation.current++ }
  }, [proposalId])

  const saveSection = async (sectionId: string, content: string, status = 'drafting') => {
    const editorGeneration = generation.current
    setPendingSaves(count => count + 1)
    try {
      return await queue.current.enqueue(async () => {
        if (generation.current !== editorGeneration) return
        const section = current.current?.sections.find(row => row.id === sectionId)
        if (!section) throw new Error('Section is no longer available')
        if (status === 'drafting' && section.content === content) {
          if (dirty.current[sectionId] === content) {
            delete dirty.current[sectionId]
            setDrafts(previous => { const next = { ...previous }; delete next[sectionId]; return next })
          }
          return
        }
        const response = await apiFetch('/api/proposals/' + proposalId + '/sections/' + sectionId, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, status, expectedRevision: section.revision }),
        })
        const updated = await response.json()
        if (!response.ok) throw new Error(updated.error ?? 'Save failed')
        if (generation.current !== editorGeneration) return
        if (current.current) {
          current.current = { ...current.current, ...updated.proposal, revision: updated.proposalRevision, sections: current.current.sections.map(row => row.id === sectionId ? updated : row) }
          setProposal(current.current)
        }
        if (dirty.current[sectionId] === content) {
          delete dirty.current[sectionId]
          setDrafts(previous => { const next = { ...previous }; delete next[sectionId]; return next })
        }
        setSaveError(null)
      })
    } catch (error) { if (generation.current === editorGeneration) setSaveError((error as Error).message); throw error }
    finally { if (generation.current === editorGeneration) setPendingSaves(count => Math.max(0, count - 1)) }
  }
  const flushSaves = async () => {
    for (const [sectionId, content] of Object.entries(dirty.current)) await saveSection(sectionId, content)
    await queue.current.flush()
  }
  const draftSection = async (sectionId: string) => {
    if (operation.current) return
    const operationGeneration = generation.current
    operation.current = true; setDrafting(true); setDraftResult(null)
    try {
      await flushSaves()
      if (generation.current !== operationGeneration) return
      const section = current.current?.sections.find(row => row.id === sectionId)
      const response = await apiFetch('/api/proposals/' + proposalId + '/draft-section', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, expectedRevision: section?.revision }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Draft failed')
      if (generation.current !== operationGeneration) return
      setDraftResult(data)
      if (data.success) await load()
    } catch (error) { if (generation.current === operationGeneration) setDraftResult({ success: false, error: (error as Error).message }) }
    finally { if (generation.current === operationGeneration) { operation.current = false; setDrafting(false) } }
  }
  const createVersion = async () => {
    if (operation.current) return
    const summary = prompt('Version change summary:', 'New version')
    if (!summary) return
    const operationGeneration = generation.current
    operation.current = true; setDrafting(true)
    try {
      await flushSaves()
      if (generation.current !== operationGeneration) return
      const response = await apiFetch('/api/proposals/' + proposalId + '/versions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeSummary: summary, expectedRevision: current.current?.revision }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not save version')
      if (generation.current === operationGeneration) await load()
    } catch (error) { if (generation.current === operationGeneration) setSaveError((error as Error).message) }
    finally { if (generation.current === operationGeneration) { operation.current = false; setDrafting(false) } }
  }
  const reviewSection = async (sectionId: string) => {
    if (operation.current) return
    const operationGeneration = generation.current
    operation.current = true; setDrafting(true)
    try { await flushSaves(); if (generation.current !== operationGeneration) return; await saveSection(sectionId, current.current?.sections.find(row => row.id === sectionId)?.content ?? '', 'approved'); if (generation.current === operationGeneration) await load() }
    catch (error) { if (generation.current === operationGeneration) setSaveError((error as Error).message) }
    finally { if (generation.current === operationGeneration) { operation.current = false; setDrafting(false) } }
  }

  const updateStatus = async (status: 'in_review' | 'submitted') => {
    if (operation.current) return
    const operationGeneration = generation.current
    operation.current = true; setDrafting(true)
    try {
      await flushSaves()
      if (generation.current !== operationGeneration) return
      const response = await apiFetch('/api/proposals/' + proposalId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedRevision: current.current?.revision }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not update proposal')
      if (generation.current === operationGeneration) await load()
    } catch (error) { if (generation.current === operationGeneration) setSaveError((error as Error).message) }
    finally { if (generation.current === operationGeneration) { operation.current = false; setDrafting(false) } }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("Loading proposal...")}</div>
  if (!proposal) return <div className="p-6 text-sm text-rose-600 dark:text-rose-300">{t("Proposal not found.")}</div>

  const activeSection = proposal.sections?.find((s: { id: string }) => s.id === activeSectionId)

  return (
    <div className="space-y-4">
      <button onClick={goProposals} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" /> {t("Back to Proposals")}</button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{proposal.pursuit.tender.title}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_COLORS[proposal.status])}>{proposal.status}</span>
            <span>v{proposal.currentVersion}</span>
            <span>{proposal.wordCount} words</span>
            <span>{Math.round(proposal.evidenceCoverage * 100)}% evidence coverage</span>
          </div>
        </div>
        <button
          onClick={createVersion}
          disabled={drafting}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          {t("Save Version")}</button>
        {proposal.status === 'draft' && <button disabled={drafting} onClick={() => { void updateStatus('in_review') }} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t("Send for review")}</button>}
        {canReview && proposal.status === 'approved' && <button disabled={drafting} onClick={() => { void updateStatus('submitted') }} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{t("Record submission")}</button>}
      </div>

      <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {pendingSaves > 0 ? t("Saving changes...") : Object.keys(drafts).length ? t("Unsaved changes") : t("Changes saved")}
        {saveError && <p role="alert" className="text-rose-700 dark:text-rose-300">{saveError} <button className="underline" onClick={() => { void flushSaves().catch(() => {}) }}>{t("Retry save")}</button> · <button className="underline" onClick={() => { void load() }}>{t("Reload latest (keeps local edits)")}</button></p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Section sidebar */}
        <div className="rounded-lg border border-border bg-card p-2 max-h-[600px] overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">{t("Sections")}</p>
          {proposal.sections?.map((s: { id: string; order: number; title: string; status: string; sectionType: string; wordCount: number; evidenceCount: number; hasGaps: boolean }) => (
            <button
              key={s.id}
              onClick={() => { setActiveSectionId(s.id); setDraftResult(null) }}
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                activeSectionId === s.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
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
                <p className={cn('text-[9px]', activeSectionId === s.id ? 'text-muted-foreground' : 'text-muted-foreground')}>
                  {s.wordCount}w · {s.evidenceCount} ev{s.hasGaps ? ' · gaps' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Section editor */}
        <div className="rounded-lg border border-border bg-card p-4">
          {activeSection && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{activeSection.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{activeSection.sectionType} · {activeSection.wordCount} words · {activeSection.evidenceCount} evidence linked</p>
                </div>
                <button
                  onClick={() => draftSection(activeSection.id)}
                  disabled={drafting || ['submitted','withdrawn'].includes(proposal.status)}
                  className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-300"
                >
                  {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {drafting ? t("Drafting...") : t("AI Draft")}
                </button>
              </div>

              {draftResult && (
                <div className={cn(
                  'rounded-md border p-2.5 text-xs',
                  draftResult.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
                )}>
                  <p className={cn('font-medium', draftResult.success ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300')}>
                    {draftResult.success ? `Draft generated — ${draftResult.evidenceUsed?.length ?? 0} evidence cited, ${draftResult.gaps?.length ?? 0} gaps flagged` : t("Draft failed")}
                  </p>
                  {draftResult.error && <p className="text-rose-700 mt-1 dark:text-rose-300">{draftResult.error}</p>}
                  {draftResult.note && <p className="text-muted-foreground mt-1">{draftResult.note}</p>}
                  {draftResult.gaps && draftResult.gaps.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-amber-800 flex items-center gap-1 dark:text-amber-300"><AlertCircle className="h-3 w-3" /> {' '}{t("Evidence Gaps:")}</p>
                      <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
                        {draftResult.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <textarea
                aria-label={activeSection.title}
                disabled={drafting || ['submitted','withdrawn'].includes(proposal.status)}
                value={drafts[activeSection.id] ?? activeSection.content ?? ''}
                onChange={event => { dirty.current[activeSection.id] = event.target.value; setDrafts(previous => ({ ...previous, [activeSection.id]: event.target.value })) }}
                onBlur={event => { if (dirty.current[activeSection.id] !== undefined) void saveSection(activeSection.id, event.target.value).catch(() => {}) }}
                placeholder={t("Draft this section... Use the AI Draft button for evidence-grounded assistance.")}
                className="w-full min-h-[400px] text-sm border border-border rounded-md p-3 outline-none focus:border-slate-400 font-mono"
              />

              {canReview && <button disabled={drafting || ['submitted','withdrawn'].includes(proposal.status)} onClick={() => { void reviewSection(activeSection.id) }} className="rounded border px-3 py-1 text-xs disabled:opacity-50">{t("Approve reviewed section")}</button>}
              <p className="text-[10px] text-muted-foreground">{t("Content auto-saves on blur. Use AI Draft for evidence-grounded assistance.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
