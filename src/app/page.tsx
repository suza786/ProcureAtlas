'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/api-client'
import { bindUrlNavigation, useAppStore } from '@/lib/store'
import { ApiFailureNotice } from '@/components/ApiFailureNotice'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useTranslation } from '@/hooks/use-translation'
const CommandCenter = dynamic(() => import('@/components/views/CommandCenter').then(m => m.CommandCenter), { loading: ViewLoading })
const Discover = dynamic(() => import('@/components/views/Discover').then(m => m.Discover), { loading: ViewLoading })
const TenderDigitalTwin = dynamic(() => import('@/components/views/TenderDigitalTwin').then(m => m.TenderDigitalTwin), { loading: ViewLoading })
const CompanyBrain = dynamic(() => import('@/components/views/CompanyBrain').then(m => m.CompanyBrain), { loading: ViewLoading })
const Pursuits = dynamic(() => import('@/components/views/Pursuits').then(m => m.Pursuits), { loading: ViewLoading })
const BidRoom = dynamic(() => import('@/components/views/BidRoom').then(m => m.BidRoom), { loading: ViewLoading })
const ComplianceMatrix = dynamic(() => import('@/components/views/ComplianceMatrix').then(m => m.ComplianceMatrix), { loading: ViewLoading })
const SignIn = dynamic(() => import('@/components/views/SignIn').then(m => m.SignIn), { loading: ViewLoading })
const AuditLog = dynamic(() => import('@/components/views/AuditLog').then(m => m.AuditLog), { loading: ViewLoading })
const Extractions = dynamic(() => import('@/components/views/Extractions').then(m => m.Extractions), { loading: ViewLoading })
const Connectors = dynamic(() => import('@/components/views/Connectors').then(m => m.Connectors), { loading: ViewLoading })
const Settings = dynamic(() => import('@/components/views/Settings').then(m => m.Settings), { loading: ViewLoading })
const BuyerIntel = dynamic(() => import('@/components/views/BuyerIntel').then(m => m.BuyerIntel), { loading: ViewLoading })
const BuyerDetail = dynamic(() => import('@/components/views/BuyerIntel').then(m => m.BuyerDetail), { loading: ViewLoading })
const AwardIntel = dynamic(() => import('@/components/views/AwardIntel').then(m => m.AwardIntel), { loading: ViewLoading })
const CompetitorIntel = dynamic(() => import('@/components/views/CompetitorIntel').then(m => m.CompetitorIntel), { loading: ViewLoading })
const CompetitorDetail = dynamic(() => import('@/components/views/CompetitorIntel').then(m => m.CompetitorDetail), { loading: ViewLoading })
const PartnerFinder = dynamic(() => import('@/components/views/PartnerFinder').then(m => m.PartnerFinder), { loading: ViewLoading })
const Admin = dynamic(() => import('@/components/views/Admin').then(m => m.Admin), { loading: ViewLoading })
const Billing = dynamic(() => import('@/components/views/Billing').then(m => m.Billing), { loading: ViewLoading })
const Proposals = dynamic(() => import('@/components/views/Proposals').then(m => m.Proposals), { loading: ViewLoading })
const ProposalEditor = dynamic(() => import('@/components/views/Proposals').then(m => m.ProposalEditor), { loading: ViewLoading })
const Approvals = dynamic(() => import('@/components/views/Approvals').then(m => m.Approvals), { loading: ViewLoading })
const Webhooks = dynamic(() => import('@/components/views/Webhooks').then(m => m.Webhooks), { loading: ViewLoading })
const Notifications = dynamic(() => import('@/components/views/Notifications').then(m => m.Notifications), { loading: ViewLoading })
const Financials = dynamic(() => import('@/components/views/Financials').then(m => m.Financials), { loading: ViewLoading })
const Developer = dynamic(() => import('@/components/views/Developer').then(m => m.Developer), { loading: ViewLoading })
const Analytics = dynamic(() => import('@/components/views/Analytics').then(m => m.Analytics), { loading: ViewLoading })
const Markets = dynamic(() => import('@/components/views/Markets').then(m => m.Markets), { loading: ViewLoading })

function ViewLoading() {
  const { t } = useTranslation()
  return <div role="status" className="space-y-3 p-4"><span className="sr-only">{t('shell.loadingModule')}</span><div className="h-8 w-48 animate-pulse rounded bg-accent" /><div className="h-48 animate-pulse rounded bg-muted" /></div>
}

export default function Home() {
  const { t } = useTranslation()
  const view = useAppStore((s) => s.view)
  const setAuth = useAppStore((s) => s.setAuth)

  const mainRef = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  useEffect(() => bindUrlNavigation(), [])
  useEffect(() => {
    if (previousView.current !== view) {
      mainRef.current?.focus({ preventScroll: true })
      mainRef.current?.scrollTo?.(0, 0)
      previousView.current = view
    }
  }, [view])

  // Check auth state on initial load
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has('accountToken')) return
    apiFetch('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        if (me.authenticated) {
          setAuth({ authenticated: true, user: me.user })
        }
      })
      .catch(() => {})
  }, [setAuth])

  // Sign-in view is full-screen (no sidebar)
  if (view.type === 'sign-in') {
    return <SignIn />
  }

  return (
    <div className="flex h-screen bg-muted dark:bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-card focus:p-3">{t('shell.skipContent')}</a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <ApiFailureNotice />
        <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-6">
          {view.type === 'command' && <CommandCenter />}
          {view.type === 'discover' && <Discover />}
          {view.type === 'tender' && <TenderDigitalTwin tenderId={view.tenderId} />}
          {view.type === 'company' && <CompanyBrain />}
          {view.type === 'pursuits' && <Pursuits />}
          {view.type === 'bid-room' && <BidRoom pursuitId={view.pursuitId} />}
          {view.type === 'compliance' && <ComplianceMatrix pursuitId={view.pursuitId} />}
          {view.type === 'audit' && <AuditLog />}
          {view.type === 'extractions' && <Extractions />}
          {view.type === 'connectors' && <Connectors />}
          {view.type === 'settings' && <Settings />}
          {view.type === 'buyer-intel' && <BuyerIntel />}
          {view.type === 'buyer-detail' && <BuyerDetail organizationId={view.organizationId} />}
          {view.type === 'award-intel' && <AwardIntel />}
          {view.type === 'competitor-intel' && <CompetitorIntel />}
          {view.type === 'competitor-detail' && <CompetitorDetail organizationId={view.organizationId} />}
          {view.type === 'partner-finder' && <PartnerFinder />}
          {view.type === 'admin' && <Admin />}
          {view.type === 'billing' && <Billing />}
          {view.type === 'proposals' && <Proposals />}
          {view.type === 'proposal-editor' && <ProposalEditor proposalId={view.proposalId} />}
          {view.type === 'approvals' && <Approvals />}
          {view.type === 'webhooks' && <Webhooks />}
          {view.type === 'notifications' && <Notifications />}
          {view.type === 'financials' && <Financials />}
          {view.type === 'developer' && <Developer />}
          {view.type === 'analytics' && <Analytics />}
          {view.type === 'markets' && <Markets />}
        </main>
      </div>
    </div>
  )
}
