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
  Building2,
  Handshake,
  CreditCard,
  FileText,
  Webhook,
  Calculator,
} from 'lucide-react'

const navItems = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard, action: 'goCommand' as const },
  { id: 'discover', label: 'Discover', icon: Radar, action: 'goDiscover' as const },
  { id: 'company', label: 'Company Brain', icon: Brain, action: 'goCompany' as const },
  { id: 'pursuits', label: 'Pursuits', icon: Target, action: 'goPursuits' as const },
  { id: 'compliance', label: 'Compliance Matrix', icon: FileCheck2, action: 'goPursuits' as const },
  { id: 'proposals', label: 'Proposal Studio', icon: FileText, action: 'goProposals' as const },
  { id: 'approvals', label: 'Approvals', icon: Shield, action: 'goApprovals' as const },
  { id: 'extractions', label: 'LLM Review Queue', icon: Cpu, action: 'goExtractions' as const },
  { id: 'connectors', label: 'Connectors', icon: Globe, action: 'goConnectors' as const },
  { id: 'audit', label: 'Audit Log', icon: Shield, action: 'goAudit' as const },
  { id: 'alerts', label: 'Alerts', icon: Bell, action: 'goCommand' as const },
] as const

const intelligenceItems = [
  { id: 'buyer-intel', label: 'Buyer Intelligence', icon: Building2, action: 'goBuyerIntel' as const },
  { id: 'award-intel', label: 'Award Intelligence', icon: Gavel, action: 'goAwardIntel' as const },
  { id: 'competitor-intel', label: 'Competitor Intelligence', icon: Target, action: 'goCompetitorIntel' as const },
  { id: 'partner-finder', label: 'Partner / JV Finder', icon: Handshake, action: 'goPartnerFinder' as const },
] as const

const systemItems = [
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, action: 'goWebhooks' as const },
  { id: 'notifications', label: 'Notifications', icon: Bell, action: 'goNotifications' as const },
  { id: 'financials', label: 'Financial Modeling', icon: Calculator, action: 'goFinancials' as const },
  { id: 'admin', label: 'Admin Console', icon: Shield, action: 'goAdmin' as const },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard, action: 'goBilling' as const },
  { id: 'settings', label: 'Settings & API Keys', icon: Settings, action: 'goSettings' as const },
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
  const goBuyerIntel = useAppStore((s) => s.goBuyerIntel)
  const goAwardIntel = useAppStore((s) => s.goAwardIntel)
  const goCompetitorIntel = useAppStore((s) => s.goCompetitorIntel)
  const goPartnerFinder = useAppStore((s) => s.goPartnerFinder)
  const goAdmin = useAppStore((s) => s.goAdmin)
  const goBilling = useAppStore((s) => s.goBilling)
  const goProposals = useAppStore((s) => s.goProposals)
  const goApprovals = useAppStore((s) => s.goApprovals)
  const goWebhooks = useAppStore((s) => s.goWebhooks)
  const goNotifications = useAppStore((s) => s.goNotifications)
  const goFinancials = useAppStore((s) => s.goFinancials)

  const actionMap = { goCommand, goDiscover, goCompany, goPursuits, goAudit, goExtractions, goConnectors, goSettings, goBuyerIntel, goAwardIntel, goCompetitorIntel, goPartnerFinder, goAdmin, goBilling, goProposals, goApprovals, goWebhooks, goNotifications, goFinancials }

  const isActive = (id: string) => {
    if (id === 'command' && view.type === 'command') return true
    if (id === 'discover' && (view.type === 'discover' || view.type === 'tender')) return true
    if (id === 'company' && view.type === 'company') return true
    if (id === 'pursuits' && (view.type === 'pursuits' || view.type === 'bid-room' || view.type === 'compliance')) return true
    if (id === 'extractions' && view.type === 'extractions') return true
    if (id === 'connectors' && view.type === 'connectors') return true
    if (id === 'audit' && view.type === 'audit') return true
    if (id === 'buyer-intel' && (view.type === 'buyer-intel' || view.type === 'buyer-detail')) return true
    if (id === 'award-intel' && view.type === 'award-intel') return true
    if (id === 'competitor-intel' && (view.type === 'competitor-intel' || view.type === 'competitor-detail')) return true
    if (id === 'partner-finder' && view.type === 'partner-finder') return true
    if (id === 'admin' && view.type === 'admin') return true
    if (id === 'billing' && view.type === 'billing') return true
    if (id === 'settings' && view.type === 'settings') return true
    if (id === 'proposals' && (view.type === 'proposals' || view.type === 'proposal-editor')) return true
    if (id === 'approvals' && view.type === 'approvals') return true
    if (id === 'webhooks' && view.type === 'webhooks') return true
    if (id === 'notifications' && view.type === 'notifications') return true
    if (id === 'financials' && view.type === 'financials') return true
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
          <span className="text-[10px] uppercase tracking-wider text-slate-500">AI Intelligence · Phase 4</span>
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
          Intelligence
        </div>
        <ul className="space-y-0.5">
          {intelligenceItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.id)
            return (
              <li key={item.id}>
                <button
                  onClick={() => actionMap[item.action]()}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
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
          System
        </div>
        <ul className="space-y-0.5">
          {systemItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.id)
            return (
              <li key={item.id}>
                <button
                  onClick={() => actionMap[item.action]()}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
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
