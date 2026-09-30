// ProcureAtlas AI — Client-side view routing store
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

interface DiscoverFilters {
  market: string
  sector: string
  search: string
  status: string
}

interface AppState {
  view: View
  setView: (view: View) => void

  discoverFilters: DiscoverFilters
  setDiscoverFilters: (f: Partial<DiscoverFilters>) => void

  // navigation helpers
  openTender: (tenderId: string) => void
  openBidRoom: (pursuitId: string) => void
  openCompliance: (pursuitId: string) => void
  goCommand: () => void
  goDiscover: () => void
  goCompany: () => void
  goPursuits: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: { type: 'command' },
  setView: (view) => set({ view }),

  discoverFilters: { market: 'all', sector: 'all', search: '', status: 'active' },
  setDiscoverFilters: (f) =>
    set((s) => ({ discoverFilters: { ...s.discoverFilters, ...f } })),

  openTender: (tenderId) => set({ view: { type: 'tender', tenderId } }),
  openBidRoom: (pursuitId) => set({ view: { type: 'bid-room', pursuitId } }),
  openCompliance: (pursuitId) => set({ view: { type: 'compliance', pursuitId } }),
  goCommand: () => set({ view: { type: 'command' } }),
  goDiscover: () => set({ view: { type: 'discover' } }),
  goCompany: () => set({ view: { type: 'company' } }),
  goPursuits: () => set({ view: { type: 'pursuits' } }),
}))
