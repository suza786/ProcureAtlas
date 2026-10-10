// ProcureAtlas AI — Client-side view routing store (Phase 2)
// Modules remain on `/`; query parameters restore shareable client navigation.

import { create } from 'zustand'
import { defaultDiscoverFilters, navigationUrl, readNavigation } from './navigation'

export type View =
  | { type: 'command' }
  | { type: 'discover' }
  | { type: 'tender'; tenderId: string }
  | { type: 'company' }
  | { type: 'pursuits' }
  | { type: 'bid-room'; pursuitId: string }
  | { type: 'compliance'; pursuitId: string }
  | { type: 'audit' }
  | { type: 'extractions' }
  | { type: 'connectors' }
  | { type: 'settings' }
  | { type: 'sign-in' }
  | { type: 'buyer-intel' }
  | { type: 'buyer-detail'; organizationId: string }
  | { type: 'award-intel' }
  | { type: 'competitor-intel' }
  | { type: 'competitor-detail'; organizationId: string }
  | { type: 'partner-finder' }
  | { type: 'admin' }
  | { type: 'billing' }
  | { type: 'proposals' }
  | { type: 'proposal-editor'; proposalId: string }
  | { type: 'approvals' }
  | { type: 'webhooks' }
  | { type: 'notifications' }
  | { type: 'financials' }
  | { type: 'developer' }
  | { type: 'analytics' }
  | { type: 'markets' }

interface DiscoverFilters {
  market: string
  sector: string
  search: string
  status: string
}

interface AuthState {
  authenticated: boolean
  user: { email: string; name: string | null; role: string; tenantSlug: string } | null
}

interface AppState {
  view: View
  setView: (view: View) => void

  discoverFilters: DiscoverFilters
  setDiscoverFilters: (f: Partial<DiscoverFilters>) => void

  auth: AuthState
  setAuth: (auth: AuthState) => void

  // navigation helpers
  openTender: (tenderId: string) => void
  openBidRoom: (pursuitId: string) => void
  openCompliance: (pursuitId: string) => void
  goCommand: () => void
  goDiscover: () => void
  goCompany: () => void
  goPursuits: () => void
  goAudit: () => void
  goExtractions: () => void
  goConnectors: () => void
  goSettings: () => void
  goSignIn: () => void
  goBuyerIntel: () => void
  openBuyerDetail: (organizationId: string) => void
  goAwardIntel: () => void
  goCompetitorIntel: () => void
  openCompetitorDetail: (organizationId: string) => void
  goPartnerFinder: () => void
  goAdmin: () => void
  goBilling: () => void
  goProposals: () => void
  openProposalEditor: (proposalId: string) => void
  goApprovals: () => void
  goWebhooks: () => void
  goNotifications: () => void
  goFinancials: () => void
  goDeveloper: () => void
  goAnalytics: () => void
  goMarkets: () => void
  locale: 'en' | 'bn'
  setLocale: (locale: 'en' | 'bn') => void
  timeZone: string
  setTimeZone: (timeZone: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  view: { type: 'command' },
  setView: (view) => {
    const safeView = readNavigation(navigationUrl('/', view, get().discoverFilters).split('?')[1] ?? '').view
    writeNavigation(safeView, get().discoverFilters)
    set({ view: safeView })
  },

  discoverFilters: { ...defaultDiscoverFilters },
  setDiscoverFilters: (f) => {
    const discoverFilters = { ...get().discoverFilters, ...f }
    writeNavigation(get().view, discoverFilters)
    set({ discoverFilters })
  },

  auth: { authenticated: false, user: null },
  setAuth: (auth) => set({ auth }),

  openTender: (tenderId) => get().setView({ type: 'tender', tenderId }),
  openBidRoom: (pursuitId) => get().setView({ type: 'bid-room', pursuitId }),
  openCompliance: (pursuitId) => get().setView({ type: 'compliance', pursuitId }),
  goCommand: () => get().setView({ type: 'command' }),
  goDiscover: () => get().setView({ type: 'discover' }),
  goCompany: () => get().setView({ type: 'company' }),
  goPursuits: () => get().setView({ type: 'pursuits' }),
  goAudit: () => get().setView({ type: 'audit' }),
  goExtractions: () => get().setView({ type: 'extractions' }),
  goConnectors: () => get().setView({ type: 'connectors' }),
  goSettings: () => get().setView({ type: 'settings' }),
  goSignIn: () => get().setView({ type: 'sign-in' }),
  goBuyerIntel: () => get().setView({ type: 'buyer-intel' }),
  openBuyerDetail: (organizationId) => get().setView({ type: 'buyer-detail', organizationId }),
  goAwardIntel: () => get().setView({ type: 'award-intel' }),
  goCompetitorIntel: () => get().setView({ type: 'competitor-intel' }),
  openCompetitorDetail: (organizationId) => get().setView({ type: 'competitor-detail', organizationId }),
  goPartnerFinder: () => get().setView({ type: 'partner-finder' }),
  goAdmin: () => get().setView({ type: 'admin' }),
  goBilling: () => get().setView({ type: 'billing' }),
  goProposals: () => get().setView({ type: 'proposals' }),
  openProposalEditor: (proposalId) => get().setView({ type: 'proposal-editor', proposalId }),
  goApprovals: () => get().setView({ type: 'approvals' }),
  goWebhooks: () => get().setView({ type: 'webhooks' }),
  goNotifications: () => get().setView({ type: 'notifications' }),
  goFinancials: () => get().setView({ type: 'financials' }),
  goDeveloper: () => get().setView({ type: 'developer' }),
  goAnalytics: () => get().setView({ type: 'analytics' }),
  goMarkets: () => get().setView({ type: 'markets' }),
  locale: 'en',
  setLocale: (locale) => { savePreference('locale', locale); updateDocumentLocale(locale); set({ locale }) },
  timeZone: 'Asia/Dhaka',
  setTimeZone: (timeZone) => { try { new Intl.DateTimeFormat('en', { timeZone }); savePreference('timeZone', timeZone); set({ timeZone }) } catch {} },
}))

function savePreference(key: string, value: string) {
  if (typeof window !== 'undefined') { try { window.localStorage.setItem('procureatlas.' + key, value) } catch {} }
}
function updateDocumentLocale(locale: 'en' | 'bn') {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}
function writeNavigation(view: View, filters: DiscoverFilters) {
  if (typeof window === 'undefined') return
  const target = navigationUrl(window.location.href, view, filters)
  if (target !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(window.history.state, '', target)
}
/** Restore directly, so Back/Forward never adds history entries. */
export function bindUrlNavigation(): () => void {
  if (typeof window === 'undefined') return () => {}
  const restore = () => useAppStore.setState(readNavigation(window.location.search))
  restore()
  try {
    const locale = window.localStorage.getItem('procureatlas.locale')
    if (locale === 'en' || locale === 'bn') useAppStore.setState({ locale })
    const timeZone = window.localStorage.getItem('procureatlas.timeZone')
    if (timeZone) { new Intl.DateTimeFormat('en', { timeZone }); useAppStore.setState({ timeZone }) }
  } catch {}
  updateDocumentLocale(useAppStore.getState().locale)
  window.addEventListener('popstate', restore)
  return () => window.removeEventListener('popstate', restore)
}
