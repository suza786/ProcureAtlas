'use client'
import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Bell, ChevronRight, Menu } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
const labelKeys: Record<string, string> = { 'buyer-intel': 'nav.buyerIntel', 'buyer-detail': 'nav.buyerIntel', 'award-intel': 'nav.awardIntel', 'competitor-intel': 'nav.competitorIntel', 'competitor-detail': 'nav.competitorIntel', 'partner-finder': 'nav.partnerFinder', 'bid-room': 'shell.bidRoom', tender: 'shell.tender', 'proposal-editor': 'nav.proposals', 'sign-in': 'shell.signIn' }
export function Topbar() {
  const view = useAppStore(s => s.view)
  const timeZone = useAppStore(s => s.timeZone)
  const { t, locale } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const parent = view.type === 'tender' ? 'discover' : ['bid-room', 'compliance'].includes(view.type) ? 'pursuits' : null
  return <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:gap-4 md:px-6">
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetTrigger asChild><button aria-label={t('shell.openMenu')} className="rounded-md p-2 hover:bg-muted md:hidden"><Menu className="h-5 w-5" /></button></SheetTrigger>
      <SheetContent side="left" className="gap-0 p-0" onCloseAutoFocus={(event) => { if (document.activeElement?.id === 'main-content') event.preventDefault() }}>
        <SheetTitle className="sr-only">{t('shell.modules')}</SheetTitle><SheetDescription className="sr-only">{t('shell.chooseModule')}</SheetDescription>
        <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
      </SheetContent>
    </Sheet>
    <nav aria-label={t('shell.breadcrumb')} className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
      <button onClick={() => useAppStore.getState().goCommand()} className="text-muted-foreground hover:text-foreground">Atlas</button>
      {parent && <><ChevronRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" /><button onClick={() => useAppStore.getState().setView({ type: parent })} className="text-muted-foreground hover:text-foreground">{t('nav.' + parent)}</button></>}
      <ChevronRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" /><span aria-current="page" className="truncate font-medium">{t(labelKeys[view.type] ?? 'nav.' + view.type)}</span>
    </nav>
    <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
      <GlobalSearch />
      <select aria-label={t('shell.timeZone')} title={timeZone} value={timeZone} onChange={event => useAppStore.getState().setTimeZone(event.target.value)} className="w-16 shrink-0 rounded-md border border-border bg-card px-1 py-1.5 text-xs md:w-32">
        {['UTC', 'Asia/Dhaka', 'Asia/Singapore', 'Europe/Brussels', 'America/New_York'].map(zone => <option key={zone} value={zone}>{zone}</option>)}
        {!['UTC', 'Asia/Dhaka', 'Asia/Singapore', 'Europe/Brussels', 'America/New_York'].includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
      </select>
      <button aria-label={t('shell.switchLanguage')} onClick={() => useAppStore.getState().setLocale(locale === 'en' ? 'bn' : 'en')} className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted">{locale === 'en' ? 'EN' : 'বাংলা'}</button>
      <button aria-label={t('nav.notifications')} onClick={() => useAppStore.getState().goNotifications()} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted"><Bell className="h-4 w-4" /></button>
    </div>
  </header>
}
