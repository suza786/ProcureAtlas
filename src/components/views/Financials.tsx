'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatUSD, formatDate } from '@/lib/format'
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
  const [estimates, setEstimates] = useState<BidCostEstimate[]>([])
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'estimates' | 'rates'>('estimates')

  const load = () => {
    Promise.all([
      fetch('/api/bid-cost-estimates').then(r => r.json()),
      fetch('/api/currency-rates').then(r => r.json()),
    ]).then(([est, rts]) => {
      setEstimates(est.items ?? [])
      setRates(rts.items ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-slate-700" />
            Financial Modeling
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bid cost estimation with margin analysis and multi-currency support.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> New Estimate
        </button>
      </div>

      <div className="flex gap-2">
        {(['estimates', 'rates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full border',
              tab === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            )}
          >
            {t === 'estimates' ? `Cost Estimates (${estimates.length})` : `Currency Rates (${rates.length})`}
          </button>
        ))}
      </div>

      {tab === 'estimates' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
          ) : estimates.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No cost estimates. Create one to model bid pricing.</div>
          ) : (
            estimates.map(e => (
              <div key={e.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{e.label}</h3>
                    <p className="text-xs text-slate-500">{e.pursuit.tender.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatUSD(e.proposedPrice)}</p>
                    <p className="text-[10px] text-slate-500">Proposed Price ({e.currency})</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Cost</p>
                    <p className="text-sm font-semibold text-slate-900">{formatUSD(e.totalCost)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Profit</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatUSD(e.profitAmount)}</p>
                    <p className="text-[10px] text-emerald-600">{e.marginPct}% margin</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Contingency</p>
                    <p className="text-sm font-semibold text-amber-700">{e.contingencyPct}%</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">vs Tender Value</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {e.pursuit.tender.valueUSD ? `${Math.round((e.proposedPrice / e.pursuit.tender.valueUSD) * 100)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Cost breakdown bar */}
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Cost Breakdown</p>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                    {e.laborCost > 0 && <div className="bg-sky-500" style={{ width: `${(e.laborCost / e.totalCost) * 100}%` }} title={`Labor: ${formatUSD(e.laborCost)}`} />}
                    {e.materialsCost > 0 && <div className="bg-violet-500" style={{ width: `${(e.materialsCost / e.totalCost) * 100}%` }} title={`Materials: ${formatUSD(e.materialsCost)}`} />}
                    {e.subcontractorCost > 0 && <div className="bg-amber-500" style={{ width: `${(e.subcontractorCost / e.totalCost) * 100}%` }} title={`Subcontractor: ${formatUSD(e.subcontractorCost)}`} />}
                    {e.overheadCost > 0 && <div className="bg-rose-500" style={{ width: `${(e.overheadCost / e.totalCost) * 100}%` }} title={`Overhead: ${formatUSD(e.overheadCost)}`} />}
                    {e.travelCost > 0 && <div className="bg-emerald-500" style={{ width: `${(e.travelCost / e.totalCost) * 100}%` }} title={`Travel: ${formatUSD(e.travelCost)}`} />}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Labor {formatUSD(e.laborCost)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> Materials {formatUSD(e.materialsCost)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Subcontractor {formatUSD(e.subcontractorCost)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Overhead {formatUSD(e.overheadCost)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Travel {formatUSD(e.travelCost)}</span>
                  </div>
                </div>

                {e.hedgingNotes && (
                  <div className="mt-2 rounded-md bg-amber-50 border border-amber-500/20 p-2 text-xs text-amber-800">
                    <strong>Hedging:</strong> {e.hedgingNotes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'rates' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-900">Currency Rates</h2>
            <span className="text-xs text-slate-500 ml-auto">Base: USD</span>
          </div>
          {rates.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No currency rates configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Currency</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Rate (per USD)</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rates.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{r.quoteCurrency}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900">{r.rate.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{r.source}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(r.rateDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateEstimateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function CreateEstimateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    fetch('/api/pursuits').then(r => r.json()).then(d => setPursuits(d.items ?? []))
  }, [])

  const subtotal = form.laborCost + form.materialsCost + form.subcontractorCost + form.overheadCost + form.travelCost
  const contingency = subtotal * (form.contingencyPct / 100)
  const totalCost = subtotal + contingency
  const profit = totalCost * (form.marginPct / 100)
  const proposedPrice = totalCost + profit

  const create = async () => {
    if (!form.pursuitId || !form.label) { setError('Select a pursuit and enter a label.'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/bid-cost-estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      onCreated()
    } catch (e) { setError((e as Error).message) } finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-900 mb-4">New Bid Cost Estimate</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Pursuit</label>
            <select value={form.pursuitId} onChange={e => setForm({ ...form, pursuitId: e.target.value })} className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white">
              <option value="">Select...</option>
              {pursuits.map(p => <option key={p.id} value={p.id}>{p.tender.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
            <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Base estimate" className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CostInput label="Labor" value={form.laborCost} onChange={v => setForm({ ...form, laborCost: v })} />
            <CostInput label="Materials" value={form.materialsCost} onChange={v => setForm({ ...form, materialsCost: v })} />
            <CostInput label="Subcontractor" value={form.subcontractorCost} onChange={v => setForm({ ...form, subcontractorCost: v })} />
            <CostInput label="Overhead" value={form.overheadCost} onChange={v => setForm({ ...form, overheadCost: v })} />
            <CostInput label="Travel" value={form.travelCost} onChange={v => setForm({ ...form, travelCost: v })} />
            <CostInput label="Contingency %" value={form.contingencyPct} onChange={v => setForm({ ...form, contingencyPct: v })} />
            <CostInput label="Margin %" value={form.marginPct} onChange={v => setForm({ ...form, marginPct: v })} />
          </div>

          {/* Summary */}
          <div className="rounded-md bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatUSD(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Contingency ({form.contingencyPct}%)</span><span className="font-medium">{formatUSD(contingency)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-700 font-semibold">Total Cost</span><span className="font-bold">{formatUSD(totalCost)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-600">Profit ({form.marginPct}%)</span><span className="font-medium text-emerald-700">{formatUSD(profit)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-1"><span className="text-slate-900 font-bold">Proposed Price</span><span className="text-lg font-bold text-slate-900">{formatUSD(proposedPrice)}</span></div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Hedging Notes (optional)</label>
            <textarea value={form.hedgingNotes} onChange={e => setForm({ ...form, hedgingNotes: e.target.value })} placeholder="e.g. 50% costs in BDT, hedge via forward contract..." rows={2} className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5" />
          </div>

          {error && <p className="text-xs text-rose-700">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={create} disabled={creating} className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create Estimate
            </button>
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CostInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-700 mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full text-sm border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-slate-400"
      />
    </div>
  )
}
