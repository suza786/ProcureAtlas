'use client'
import { useTranslation } from '@/hooks/use-translation'


import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { calculateBidPrice, formatCurrencyAmount } from '@/lib/financial-calculations'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Calculator,
  Plus,
  TrendingUp,
  DollarSign,
  Loader2,
  Trash2,
  Globe,
} from 'lucide-react'

interface BidCostEstimate {
  id: string
  pursuitId: string
  label: string
  currency: string
  laborCost: number
  materialsCost: number
  subcontractorCost: number
  overheadCost: number
  travelCost: number
  contingencyPct: number
  totalCost: number
  marginPct: number
  proposedPrice: number
  profitAmount: number
  notes: string | null
  hedgingNotes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  tenderValuePct: number | null
  actualMarginPct: number | null
  markupPct: number | null
  fxExplanation: string
  pursuit: { id: string; tender: { title: string; market: string; valueUSD: number | null; currency: string } }
}

interface CurrencyRate {
  id: string
  baseCurrency: string
  quoteCurrency: string
  rate: number
  source: string
  rateDate: string
}

export function Financials() {
  const { t, formatDate } = useTranslation()

  const [estimates, setEstimates] = useState<BidCostEstimate[]>([])
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'estimates' | 'rates'>('estimates')

  const load = () => {
    Promise.all([
      apiFetch('/api/bid-cost-estimates').then(r => r.json()),
      apiFetch('/api/currency-rates').then(r => r.json()),
    ]).then(([est, rts]) => {
      setEstimates(est.items ?? [])
      setRates(rts.items ?? [])
    }).catch(e => setLoadError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-foreground" />
            {t("Financial Modeling")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Bid cost estimation with margin analysis and multi-currency support.")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> {t("New Estimate")}</button>
      </div>

      {loadError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>}
      <div className="flex gap-2">
        {(['estimates', 'rates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              tab === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
            )}
          >
            {t === 'estimates' ? `Cost Estimates (${estimates.length})` : `Currency Rates (${rates.length})`}
          </button>
        ))}
      </div>

      {tab === 'estimates' && !loadError && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("Loading...")}</div>
          ) : estimates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("No cost estimates. Create one to model bid pricing.")}</div>
          ) : (
            estimates.map(e => (
              <div key={e.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{e.label}</h3>
                    <p className="text-xs text-muted-foreground">{e.pursuit.tender.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{formatCurrencyAmount(e.proposedPrice, e.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">Proposed Price ({e.currency})</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("Total Cost")}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrencyAmount(e.totalCost, e.currency)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/40">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold dark:text-emerald-300">{t("Profit")}</p>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrencyAmount(e.profitAmount, e.currency)}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-300">{e.actualMarginPct == null ? t("Unknown") : e.actualMarginPct.toFixed(1)}% margin; {e.markupPct == null ? t("Unknown") : e.markupPct.toFixed(1)}% markup</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2 dark:bg-amber-950/40">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold dark:text-amber-300">{t("Contingency")}</p>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{e.contingencyPct}%</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("vs Tender Value")}</p>
                    <p title={e.fxExplanation} className="text-sm font-semibold text-foreground">
                      {e.tenderValuePct != null ? `${Math.round(e.tenderValuePct)}%` : t("Unknown")}
                    </p>
                  </div>
                </div>

                {/* Cost breakdown bar */}
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t("Cost Breakdown")}</p>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {e.laborCost > 0 && <div className="bg-sky-500" style={{ width: `${(e.laborCost / e.totalCost) * 100}%` }} title={`Labor: ${formatCurrencyAmount(e.laborCost, e.currency)}`} />}
                    {e.materialsCost > 0 && <div className="bg-violet-500" style={{ width: `${(e.materialsCost / e.totalCost) * 100}%` }} title={`Materials: ${formatCurrencyAmount(e.materialsCost, e.currency)}`} />}
                    {e.subcontractorCost > 0 && <div className="bg-amber-500" style={{ width: `${(e.subcontractorCost / e.totalCost) * 100}%` }} title={`Subcontractor: ${formatCurrencyAmount(e.subcontractorCost, e.currency)}`} />}
                    {e.overheadCost > 0 && <div className="bg-rose-500" style={{ width: `${(e.overheadCost / e.totalCost) * 100}%` }} title={`Overhead: ${formatCurrencyAmount(e.overheadCost, e.currency)}`} />}
                    {e.travelCost > 0 && <div className="bg-emerald-500" style={{ width: `${(e.travelCost / e.totalCost) * 100}%` }} title={`Travel: ${formatCurrencyAmount(e.travelCost, e.currency)}`} />}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> {' '}{t("Labor")}{' '}{formatCurrencyAmount(e.laborCost, e.currency)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> {' '}{t("Materials")}{' '}{formatCurrencyAmount(e.materialsCost, e.currency)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {' '}{t("Subcontractor")}{' '}{formatCurrencyAmount(e.subcontractorCost, e.currency)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> {' '}{t("Overhead")}{' '}{formatCurrencyAmount(e.overheadCost, e.currency)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {' '}{t("Travel")}{' '}{formatCurrencyAmount(e.travelCost, e.currency)}</span>
                  </div>
                </div>

                {e.hedgingNotes && (
                  <div className="mt-2 rounded-md bg-amber-50 border border-amber-500/20 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <strong>{t("Hedging:")}</strong> {e.hedgingNotes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'rates' && !loadError && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            <h2 className="text-sm font-semibold text-foreground">{t("Currency Rates")}</h2>
            <span className="text-xs text-muted-foreground ml-auto">{t("Dated currency pairs")}</span>
          </div>
          {rates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("No currency rates configured.")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Currency")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("Rate (quote per base)")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Source")}</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rates.map(r => (
                    <tr key={r.id} className="hover:bg-muted">
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">{r.baseCurrency}/{r.quoteCurrency}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground">{r.rate.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.source}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(r.rateDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateEstimateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setLoading(true); setLoadError(null); load() }} />}
    </div>
  )
}

function CreateEstimateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()

  const [pursuits, setPursuits] = useState<Array<{ id: string; tender: { title: string } }>>([])
  const [form, setForm] = useState({
    pursuitId: '',
    label: '',
    currency: 'USD',
    laborCost: 50000,
    materialsCost: 10000,
    subcontractorCost: 0,
    overheadCost: 15000,
    travelCost: 5000,
    contingencyPct: 10,
    marginPct: 20,
    hedgingNotes: '',
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/pursuits').then(r => r.json()).then(d => setPursuits(d.items ?? [])).catch(e => setError(e.message))
  }, [])

  let calculationError: string | null = null
  let pricing = { subtotal: 0, contingency: 0, totalCost: 0, profitAmount: 0, proposedPrice: 0, markupPct: 0 }
  try { pricing = calculateBidPrice([form.laborCost, form.materialsCost, form.subcontractorCost, form.overheadCost, form.travelCost], form.contingencyPct, form.marginPct) }
  catch (e) { calculationError = (e as Error).message }
  const { subtotal, contingency, totalCost, profitAmount: profit, proposedPrice } = pricing

  const create = async () => {
    if (calculationError) { setError(calculationError); return }
    if (!form.pursuitId || !form.label) { setError('Select a pursuit and enter a label.'); return }
    setCreating(true)
    try {
      const res = await apiFetch('/api/bid-cost-estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      onCreated()
    } catch (e) { setError((e as Error).message) } finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-card p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-foreground mb-4">{t("New Bid Cost Estimate")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Pursuit")}</label>
            <select value={form.pursuitId} onChange={e => setForm({ ...form, pursuitId: e.target.value })} className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-card">
              <option value="">{t("Select...")}</option>
              {pursuits.map(p => <option key={p.id} value={p.id}>{p.tender.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Label")}</label>
            <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder={t("e.g. Base estimate")} className="w-full text-sm border border-border rounded-md px-3 py-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Currency")}</label>
            <input value={form.currency} maxLength={3} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="w-full text-sm border border-border rounded-md px-3 py-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CostInput label={t("Labor")} value={form.laborCost} onChange={v => setForm({ ...form, laborCost: v })} />
            <CostInput label={t("Materials")} value={form.materialsCost} onChange={v => setForm({ ...form, materialsCost: v })} />
            <CostInput label={t("Subcontractor")} value={form.subcontractorCost} onChange={v => setForm({ ...form, subcontractorCost: v })} />
            <CostInput label={t("Overhead")} value={form.overheadCost} onChange={v => setForm({ ...form, overheadCost: v })} />
            <CostInput label={t("Travel")} value={form.travelCost} onChange={v => setForm({ ...form, travelCost: v })} />
            <CostInput label={t("Contingency %")} value={form.contingencyPct} onChange={v => setForm({ ...form, contingencyPct: v })} />
            <CostInput label={t("Margin %")} value={form.marginPct} onChange={v => setForm({ ...form, marginPct: v })} />
          </div>

          {/* Summary */}
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("Subtotal")}</span><span className="font-medium">{formatCurrencyAmount(subtotal, form.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Contingency ({form.contingencyPct}%)</span><span className="font-medium">{formatCurrencyAmount(contingency, form.currency)}</span></div>
            <div className="flex justify-between border-t border-border pt-1"><span className="text-foreground font-semibold">{t("Total Cost")}</span><span className="font-bold">{formatCurrencyAmount(totalCost, form.currency)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-600 dark:text-emerald-300">Profit ({form.marginPct}% margin; {pricing.markupPct.toFixed(1)}% markup)</span><span className="font-medium text-emerald-700 dark:text-emerald-300">{formatCurrencyAmount(profit, form.currency)}</span></div>
            <div className="flex justify-between border-t border-border pt-1"><span className="text-foreground font-bold">{t("Proposed Price")}</span><span className="text-lg font-bold text-foreground">{formatCurrencyAmount(proposedPrice, form.currency)}</span></div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{t("Hedging Notes (optional)")}</label>
            <textarea value={form.hedgingNotes} onChange={e => setForm({ ...form, hedgingNotes: e.target.value })} placeholder="e.g. 50% costs in BDT, hedge via forward contract..." rows={2} className="w-full text-sm border border-border rounded-md px-3 py-1.5" />
          </div>

          {calculationError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{calculationError}</p>}
          {error && <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={create} disabled={creating || Boolean(calculationError)} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t("Create Estimate")}</button>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">{t("Cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CostInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-foreground mb-0.5">{label}</label>
      <input
        type="number"
        min={0}
        max={label === 'Margin %' ? 99.99 : label === 'Contingency %' ? 100 : undefined}
        step="any"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full text-sm border border-border rounded-md px-2 py-1 outline-none focus:border-slate-400"
      />
    </div>
  )
}
