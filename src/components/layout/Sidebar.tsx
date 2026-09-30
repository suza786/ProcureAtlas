'use client'

import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Radar,
  Brain,
  Target,
  FileCheck2,
  Gavel,
  Bell,
  Settings,
  Search,
  Shield,
  Cpu,
  Globe,
} from 'lucide-react'

const navItems = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard, action: 'goCommand' as const },
  { id: 'discover', label: 'Discover', icon: Radar, action: 'goDiscover' as const },
  { id: 'company', label: 'Company Brain', icon: Brain, action: 'goCompany' as const },
  { id: 'pursuits', label: 'Pursuits', icon: Target, action: 'goPursuits' as const },
  { id: 'compliance', label: 'Compliance Matrix', icon: FileCheck2, action: 'goPursuits' as const },
  { id: 'extractions', label: 'LLM Review Queue', icon: Cpu, action: 'goExtractions' as const },
  { id: 'connectors', label: 'Connectors', icon: Globe, action: 'goConnectors' as const },
  { id: 'audit', label: 'Audit Log', icon: Shield, action: 'goAudit' as const },
  { id: 'alerts', label: 'Alerts', icon: Bell, action: 'goCommand' as const },
] as const

export function Sidebar() {
  const view = useAppStore((s) => s.view)
  const auth = useAppStore((s) => s.auth)
  const goCommand = useAppStore((s) => s.goCommand)
  const goDiscover = useAppStore((s) => s.goDiscover)
  const goCompany = useAppStore((s) => s.goCompany)
  const goPursuits = useAppStore((s) => s.goPursuits)
  const goAudit = useAppStore((s) => s.goAudit)
  const goExtractions = useAppStore((s) => s.goExtractions)
  const goConnectors = useAppStore((s) => s.goConnectors)
  const goSettings = useAppStore((s) => s.goSettings)

  const actionMap = { goCommand, goDiscover, goCompany, goPursuits, goAudit, goExtractions, goConnectors, goSettings }

  const isActive = (id: string) => {
    if (id === 'command' && view.type === 'command') return true
    if (id === 'discover' && (view.type === 'discover' || view.type === 'tender')) return true
    if (id === 'company' && view.type === 'company') return true
    if (id === 'pursuits' && (view.type === 'pursuits' || view.type === 'bid-room' || view.type === 'compliance')) return true
    if (id === 'extractions' && view.type === 'extractions') return true
    if (id === 'connectors' && view.type === 'connectors') return true
    if (id === 'audit' && view.type === 'audit') return true
    return false
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white text-xs font-bold">
          PA
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-slate-900">ProcureAtlas</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">AI Intelligence · Phase 2</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.id)
            return (
              <li key={item.id}>
                <button
                  onClick={() => actionMap[item.action]()}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Intelligence (Phase 3)
        </div>
        <ul className="space-y-0.5">
          {[
            { label: 'Buyer Intel', icon: Search },
            { label: 'Award Intel', icon: Gavel },
            { label: 'Competitor Intel', icon: Target },
            { label: 'Partner / JV', icon: Brain },
          ].map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label}>
                <button
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-not-allowed"
                  title="Coming in Phase 3"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-wider text-slate-400">soon</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          System
        </div>
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={goSettings}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                view.type === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">Settings & API Keys</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="rounded-md bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white',
              auth.authenticated ? 'bg-emerald-500' : 'bg-slate-400'
            )}>
              {auth.user?.name?.[0] ?? 'D'}
            </div>
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {auth.user?.name ?? 'Demo Mode'}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {auth.authenticated ? auth.user?.role : 'Not signed in'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
