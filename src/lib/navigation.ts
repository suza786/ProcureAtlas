import type { View } from './store'

export interface DiscoverFilters { market: string; sector: string; search: string; status: string }
export const defaultDiscoverFilters: DiscoverFilters = { market: 'all', sector: 'all', search: '', status: 'active' }
const modules = new Set(['command', 'discover', 'company', 'pursuits', 'audit', 'extractions', 'connectors', 'settings', 'sign-in', 'buyer-intel', 'award-intel', 'competitor-intel', 'partner-finder', 'admin', 'billing', 'proposals', 'approvals', 'webhooks', 'notifications', 'financials', 'developer', 'analytics', 'markets'])
const detailKeys: Record<string, string> = { tender: 'tenderId', 'bid-room': 'pursuitId', compliance: 'pursuitId', 'buyer-detail': 'organizationId', 'competitor-detail': 'organizationId', 'proposal-editor': 'proposalId' }
export function validNavigationId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
}
export function readNavigation(search: string): { view: View; discoverFilters: DiscoverFilters } {
  const params = new URLSearchParams(search)
  const type = params.get('view') ?? 'command'
  const key = detailKeys[type]
  let view: View = { type: 'command' }
  if (params.has('accountToken')) view = { type: 'sign-in' }
  else if (key && validNavigationId(params.get(key))) view = { type, [key]: params.get(key) } as View
  else if (modules.has(type)) view = { type } as View
  const bounded = (key: string, fallback: string, max = 80) => (params.get(key) ?? fallback).slice(0, max)
  return { view, discoverFilters: { market: bounded('market', 'all'), sector: bounded('sector', 'all'), search: bounded('search', '', 500), status: bounded('status', 'active') } }
}
export function navigationUrl(current: string, view: View, filters: DiscoverFilters): string {
  const url = new URL(current, 'http://navigation.local')
  const detailKey = detailKeys[view.type]
  if (detailKey && !validNavigationId((view as unknown as Record<string, unknown>)[detailKey])) view = { type: 'command' }
  for (const key of ['view', 'tenderId', 'pursuitId', 'organizationId', 'proposalId', 'market', 'sector', 'search', 'status']) url.searchParams.delete(key)
  if (view.type !== 'sign-in') url.searchParams.delete('accountToken')
  if (view.type !== 'command') url.searchParams.set('view', view.type)
  const key = detailKeys[view.type]
  if (key) url.searchParams.set(key, (view as unknown as Record<string, string>)[key])
  for (const key of Object.keys(defaultDiscoverFilters) as Array<keyof DiscoverFilters>) {
    if (filters[key] !== defaultDiscoverFilters[key]) url.searchParams.set(key, filters[key])
  }
  return `/${url.search}${url.hash}`
}
