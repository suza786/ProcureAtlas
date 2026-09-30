'use client'

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

export default function Home() {
  const view = useAppStore((s) => s.view)

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
        </main>
      </div>
    </div>
  )
}
