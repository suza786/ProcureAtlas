'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'

interface EvidenceOption { id: string; title: string; category: string; verified: boolean; issuedAt: string | null; expiresAt: string | null }
interface Fact { id: string; companyId: string; organizationId: string | null; kind: string; value: string; amount: number | null; currency: string | null; evidenceId: string; supported: boolean }
const empty = { id: '', organizationId: '', kind: 'sector', value: '', amount: '', currency: 'USD', evidenceId: '' }
const kinds = [{ value: 'sector', label: 'Sector' }, { value: 'certification', label: 'Certification' }, { value: 'turnover', label: 'Annual turnover' }, { value: 'jv_history', label: 'Prior JV partner ID' }, { value: 'project_sector', label: 'Project sector' }]
const evidenceCategories: Record<string, string[]> = { sector: ['catalogue', 'project', 'reference', 'past_win', 'proposal_library', 'facility', 'equipment'], certification: ['certification'], turnover: ['financial'], jv_history: ['partnership', 'project', 'reference'], project_sector: ['project', 'reference', 'past_win'] }

export function CapabilityEditor({ companyId, evidence }: { companyId: string; evidence: EvidenceOption[] }) {
  const { t } = useTranslation()

  const role = useAppStore(state => state.auth.user?.role)
  const canEdit = ['owner', 'admin', 'manager', 'contributor'].includes(role ?? '')
  const [facts, setFacts] = useState<Fact[]>([])
  const [form, setForm] = useState(empty)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/company/capabilities?companyId=${encodeURIComponent(companyId)}&limit=20&offset=${offset}`)
      const data = await res.json()
      if (!Array.isArray(data.items)) throw new Error('Unexpected capability response')
      setFacts(data.items); setHasMore(data.hasMore === true); setError(null); setLoaded(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load capabilities') }
  }, [companyId, offset])
  useEffect(() => { void load() }, [load])
  const currentEvidence = evidence.filter(item => item.verified && evidenceCategories[form.kind]?.includes(item.category) && (!item.expiresAt || new Date(item.expiresAt) > new Date()) && (!item.issuedAt || new Date(item.issuedAt) <= new Date()))
  const save = async () => {
    setBusy(true); setError(null)
    try {
      const payload = { companyId, organizationId: form.organizationId.trim() || null, kind: form.kind, value: form.value.trim(), amount: form.kind === 'turnover' ? Number(form.amount) : null, currency: form.kind === 'turnover' ? form.currency : null, evidenceId: form.evidenceId, ...(form.id ? { id: form.id } : {}) }
      await apiFetch('/api/company/capabilities', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setForm(empty); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save capability') }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true)
    try { await apiFetch(`/api/company/capabilities?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); if (form.id === id) setForm(empty); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove capability') }
    finally { setBusy(false) }
  }
  const inputClass = 'w-full rounded-md border border-border px-2 py-1.5 text-sm'
  return <section className="rounded-lg border border-border bg-card p-4 space-y-3" aria-labelledby="capability-heading">
    <h2 id="capability-heading" className="text-sm font-semibold text-foreground">{t("Evidence-backed capabilities")}</h2>
    <p className="text-xs text-muted-foreground">Record explicit facts for matching. Only verified, current evidence of the correct type contributes to scores. Turnover must match the evidence’s reviewed annual turnover amount and currency. Supplier facts are private to your tenant. JV values use the actual partner organization or company ID. Capacity comparisons currently use recorded USD turnover.</p>
    {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error} <button onClick={() => void load()} className="underline">{t("Retry")}</button></p>}
    {!loaded && !error && <p className="text-xs text-muted-foreground">{t("Loading capabilities…")}</p>}
    {loaded && facts.length === 0 && <p className="text-xs text-muted-foreground">{t("No capability facts recorded on this page.")}</p>}
    {facts.map(fact => <div key={fact.id} className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-xs">
      <span className="font-medium">{kinds.find(kind => kind.value === fact.kind)?.label}: {fact.value}{fact.kind === 'turnover' ? ` · ${fact.amount} ${fact.currency}` : ''}</span>
      <span className="text-muted-foreground">{fact.organizationId ? `Supplier ${fact.organizationId}` : 'Your company'}</span>
      <span className={fact.supported ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>{fact.supported ? 'Supported' : 'Not supported by current verified evidence'}</span>
      {canEdit && <><button disabled={busy} onClick={() => setForm({ id: fact.id, organizationId: fact.organizationId ?? '', kind: fact.kind, value: fact.value, amount: fact.amount == null ? '' : String(fact.amount), currency: fact.currency ?? 'USD', evidenceId: fact.evidenceId })} className="ml-auto underline">{t("Edit")}</button><button disabled={busy} onClick={() => void remove(fact.id)} className="text-rose-700 underline dark:text-rose-300">{t("Delete")}</button></>}
    </div>)}
    <div className="flex items-center gap-3 text-xs"><button disabled={!offset || busy} onClick={() => setOffset(value => Math.max(0, value - 20))} className="underline disabled:opacity-40">{t("Previous")}</button><span>{t("Page")}{' '}{offset / 20 + 1}</span><button disabled={!hasMore || busy} onClick={() => setOffset(value => value + 20)} className="underline disabled:opacity-40">{t("Next")}</button></div>
    {canEdit && <form onSubmit={event => { event.preventDefault(); void save() }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="text-xs text-foreground">{t("Fact type")}<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value, evidenceId: '' })} className={inputClass}>{kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
      <label className="text-xs text-foreground">{t("Value")}<input required maxLength={500} value={form.value} onChange={event => setForm({ ...form, value: event.target.value })} className={inputClass} placeholder={form.kind === 'jv_history' ? 'Actual prior partner ID' : 'Exact sector or certification name'} /></label>
      <label className="text-xs text-foreground">{t("Supplier organization ID (optional)")}<input maxLength={200} value={form.organizationId} onChange={event => setForm({ ...form, organizationId: event.target.value })} className={inputClass} placeholder={t("Leave empty for your company")} /></label>
      <label className="text-xs text-foreground">{t("Supporting evidence")}<select required value={form.evidenceId} onChange={event => setForm({ ...form, evidenceId: event.target.value })} className={inputClass}><option value="">{t("Choose verified current evidence")}</option>{currentEvidence.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {form.kind === 'turnover' && <><label className="text-xs text-foreground">{t("Annual turnover amount")}<input type="number" required min={0} step="any" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className={inputClass} /></label><label className="text-xs text-foreground">{t("Currency")}<input required maxLength={3} pattern="[A-Z]{3}" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value.toUpperCase() })} className={inputClass} /></label></>}
      <div className="flex items-center gap-3 md:col-span-2"><button disabled={busy || !currentEvidence.length} type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{busy ? t("Saving…") : form.id ? 'Update fact' : 'Add fact'}</button>{form.id && <button type="button" className="text-xs underline" onClick={() => setForm(empty)}>{t("Cancel edit")}</button>}{!currentEvidence.length && <span className="text-xs text-amber-700 dark:text-amber-300">{t("Add and verify supporting evidence first.")}</span>}</div>
    </form>}
    {!canEdit && <p className="text-xs text-muted-foreground">{t("A contributor or higher role is required to edit facts.")}</p>}
  </section>
}
