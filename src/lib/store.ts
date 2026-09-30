// ProcureAtlas AI — Client-side view routing store (Phase 2)
// MVP constraint: only `/` is externally visible. All module navigation is client-side via Zustand.

import { create } from 'zustand'

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
}

export const useAppStore = create<AppState>((set) => ({
  view: { type: 'command' },
  setView: (view) => set({ view }),

  discoverFilters: { market: 'all', sector: 'all', search: '', status: 'active' },
  setDiscoverFilters: (f) =>
    set((s) => ({ discoverFilters: { ...s.discoverFilters, ...f } })),

  auth: { authenticated: false, user: null },
  setAuth: (auth) => set({ auth }),

  openTender: (tenderId) => set({ view: { type: 'tender', tenderId } }),
  openBidRoom: (pursuitId) => set({ view: { type: 'bid-room', pursuitId } }),
  openCompliance: (pursuitId) => set({ view: { type: 'compliance', pursuitId } }),
  goCommand: () => set({ view: { type: 'command' } }),
  goDiscover: () => set({ view: { type: 'discover' } }),
  goCompany: () => set({ view: { type: 'company' } }),
  goPursuits: () => set({ view: { type: 'pursuits' } }),
  goAudit: () => set({ view: { type: 'audit' } }),
  goExtractions: () => set({ view: { type: 'extractions' } }),
  goConnectors: () => set({ view: { type: 'connectors' } }),
  goSettings: () => set({ view: { type: 'settings' } }),
  goSignIn: () => set({ view: { type: 'sign-in' } }),
}))
