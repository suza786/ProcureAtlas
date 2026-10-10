export const DISCOVER_PAGE_SIZE = 50

export function discoverQuery(filters: { market: string; sector: string; status: string; search: string }, offset = 0) {
  const params = new URLSearchParams({ status: filters.status, limit: String(DISCOVER_PAGE_SIZE), offset: String(offset) })
  if (filters.market !== 'all') params.set('market', filters.market)
  if (filters.sector !== 'all') params.set('sector', filters.sector)
  if (filters.search) params.set('search', filters.search)
  return params.toString()
}
