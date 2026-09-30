'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { CommandCenter } from '@/components/views/CommandCenter'
import { Discover } from '@/components/views/Discover'
import { TenderDigitalTwin } from '@/components/views/TenderDigitalTwin'
import { CompanyBrain } from '@/components/views/CompanyBrain'
import { Pursuits } from '@/components/views/Pursuits'
import { BidRoom } from '@/components/views/BidRoom'
import { ComplianceMatrix } from '@/components/views/ComplianceMatrix'
import { SignIn } from '@/components/views/SignIn'
import { AuditLog } from '@/components/views/AuditLog'
import { Extractions } from '@/components/views/Extractions'
import { Connectors } from '@/components/views/Connectors'
import { Settings } from '@/components/views/Settings'

export default function Home() {
  const view = useAppStore((s) => s.view)
  const auth = useAppStore((s) => s.auth)
  const setAuth = useAppStore((s) => s.setAuth)
  const goCommand = useAppStore((s) => s.goCommand)

  // Check auth state on initial load
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        if (me.authenticated) {
          setAuth({ authenticated: true, user: me.user })
        }
        // If not authenticated, we stay in demo mode (no forced sign-in for sandbox exploration)
      })
      .catch(() => {
        // Ignore — stay in demo mode
      })
  }, [setAuth])

  // Sign-in view is full-screen (no sidebar)
  if (view.type === 'sign-in') {
    return <SignIn />
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
        </main>
      </div>
    </div>
  )
}
