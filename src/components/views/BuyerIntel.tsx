'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatUSD, formatDate, marketColor, sectorColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Building2,
  Search,
  ArrowRight,
  TrendingUp,
  Award,
  Users,
  Globe,
} from 'lucide-react'

interface BuyerItem {
  id: string
  name: string
  country: string | null
  city: string | null
  website: string | null
  totalTenders: number
  totalAwards: number
  totalAwardValueUSD: number
  incumbentCount: number
  topSectors: Array<[string, number]>
  recentAwards: Array<{ supplier: string; supplierCountry: string | null; contractValue: number | null; awardedAt: string }>
}

export function BuyerIntel() {
  const [items, setItems] = useState<BuyerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const openBuyerDetail = useAppStore((s) => s.openBuyerDetail)

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    fetch(`/api/buyers?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-slate-700" />
          Buyer Intelligence
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Buyer profiles with award history, incumbent mapping, and spend analytics across covered markets.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <Search className="h-3.5 w-3.5 text-slate-400 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search buyers by name, city, or country..."
          className="flex-1 text-xs outline-none bg-transparent"
        />
        <span className="text-xs text-slate-500">{items.length} buyers</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading buyers...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No buyers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Buyer</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Tenders</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Awards</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Total Award Value</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Incumbents</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top Sectors</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => openBuyerDetail(b.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">{[b.city, b.country].filter(Boolean).join(', ')}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-slate-700">{b.totalTenders}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-700">{b.totalAwards}</td>
                    <td className="px-3 py-3 text-right text-sm font-medium text-slate-900">{formatUSD(b.totalAwardValueUSD)}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-700">{b.incumbentCount}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {b.topSectors.slice(0, 3).map(([sector, count]) => (
                          <span key={sector} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(sector))}>
                            {sector} ({count})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3"><ArrowRight className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function BuyerDetail({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<ReturnType<typeof getDataType> | null>(null)
  const [loading, setLoading] = useState(true)
  const goBuyerIntel = useAppStore((s) => s.goBuyerIntel)
  const openTender = useAppStore((s) => s.openTender)

  useEffect(() => {
    fetch(`/api/buyers/${organizationId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [organizationId])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading buyer profile...</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">Buyer not found.</div>

  return (
    <div className="space-y-4">
      <button onClick={goBuyerIntel} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to Buyers
      </button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{data.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {[data.city, data.country].filter(Boolean).join(', ')} · {data.sourcePortal}
          {data.website && <span> · <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900">{data.website}</a></span>}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={TrendingUp} label="Total Tenders" value={data.stats.totalTenders.toString()} tone="sky" />
        <StatTile icon={Award} label="Total Awards" value={data.stats.totalAwards.toString()} tone="emerald" />
        <StatTile icon={TrendingUp} label="Total Award Value" value={formatUSD(data.stats.totalAwardValueUSD)} tone="violet" />
        <StatTile icon={Users} label="Incumbents" value={data.stats.incumbentCount.toString()} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incumbents */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              Incumbent Suppliers
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {data.incumbents.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No incumbent data.</div>
            ) : (
              data.incumbents.map((inc) => (
                <div key={inc.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{inc.name}</p>
                    <p className="text-xs text-slate-500">{inc.country} · {inc.awardCount} award(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatUSD(inc.totalValue)}</p>
                    {inc.lastAwardAt && <p className="text-[10px] text-slate-500">Last: {formatDate(inc.lastAwardAt)}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sector preferences */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-600" />
              Sector Preferences
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {data.sectorPreferences.map(([sector, count]) => (
              <div key={sector} className="flex items-center justify-between">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(sector))}>{sector}</span>
                <span className="text-sm text-slate-700 font-medium">{count} tender(s)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent tenders */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent Tenders</h2>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {data.recentTenders.map((t) => (
            <button
              key={t.id}
              onClick={() => openTender(t.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(t.sector))}>{t.sector}</span>
                  <span className="text-xs text-slate-500">{formatUSD(t.valueUSD)}</span>
                  {t.submissionDeadline && <span className="text-xs text-slate-400">· Due {formatDate(t.submissionDeadline)}</span>}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Award history */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Award History</h2>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {data.awardHistory.map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{a.tender.title}</p>
                <p className="text-xs text-slate-500">Awarded to <strong>{a.supplier.name}</strong> ({a.supplier.country})</p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-sm font-semibold text-slate-900">{formatUSD(a.contractValue)}</p>
                <p className="text-[10px] text-slate-500">{formatDate(a.awardedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Type helper for the detail view
function getDataType() {
  return {
    id: '', name: '', country: null, city: null, website: null, sourcePortal: '', externalId: null,
    stats: { totalTenders: 0, totalAwards: 0, totalAwardValueUSD: 0, averageAwardValueUSD: 0, totalTenderValueUSD: 0, averageTenderValueUSD: 0, incumbentCount: 0 },
    sectorPreferences: [] as Array<[string, number]>,
    incumbents: [] as Array<{ id: string; name: string; country: string | null; awardCount: number; totalValue: number; lastAwardAt: string | null }>,
    recentTenders: [] as Array<{ id: string; title: string; sector: string; market: string; valueUSD: number | null; status: string; publishedAt: string | null; submissionDeadline: string | null; requirementCount: number; amendmentCount: number }>,
    awardHistory: [] as Array<{ id: string; supplier: { name: string; country: string | null }; tender: { title: string; sector: string; market: string }; contractValue: number | null; currency: string; awardedAt: string; contractNo: string | null }>,
  }
}

function StatTile({ icon: Icon, label, value, tone }: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'slate'
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    slate: 'text-slate-600 bg-slate-500/10',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
