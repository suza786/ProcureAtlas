'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Search, Bell, ChevronRight, Globe } from 'lucide-react'
import { marketLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Topbar() {
  const view = useAppStore((s) => s.view)
  const goCommand = useAppStore((s) => s.goCommand)
  const [query, setQuery] = useState('')

  const crumbs: { label: string; onClick?: () => void }[] = []
  if (view.type === 'command') crumbs.push({ label: 'Command Center' })
  else if (view.type === 'discover') crumbs.push({ label: 'Discover' })
  else if (view.type === 'tender') {
    crumbs.push({ label: 'Discover', onClick: goCommand })
    crumbs.push({ label: 'Tender Digital Twin' })
  }
  else if (view.type === 'company') crumbs.push({ label: 'Company Brain' })
  else if (view.type === 'pursuits') crumbs.push({ label: 'Pursuits' })
  else if (view.type === 'bid-room') {
    crumbs.push({ label: 'Pursuits', onClick: () => useAppStore.getState().goPursuits() })
    crumbs.push({ label: 'Bid Room' })
  }
  else if (view.type === 'compliance') {
    crumbs.push({ label: 'Pursuits', onClick: () => useAppStore.getState().goPursuits() })
    crumbs.push({ label: 'Compliance Matrix' })
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <button
          onClick={goCommand}
          className="text-slate-500 hover:text-slate-900 transition-colors"
        >
          Atlas
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              onClick={c.onClick}
              className={cn(
                'transition-colors',
                c.onClick ? 'text-slate-600 hover:text-slate-900' : 'text-slate-900 font-medium'
              )}
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm w-72">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tenders, buyers, suppliers..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">⌘K</kbd>
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs">
          <Globe className="h-3.5 w-3.5 text-emerald-700" />
          <span className="font-medium text-emerald-700">{marketLabel('BD')}</span>
          <span className="text-emerald-600/70">+6 markets</span>
        </div>

        <button
          onClick={goCommand}
          className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Alerts"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>
      </div>
    </header>
  )
}
