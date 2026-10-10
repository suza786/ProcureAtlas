import type { View } from './store'
import { validNavigationId } from './navigation'

export interface SearchResult {
  type: 'tender' | 'buyer' | 'supplier' | 'award' | 'company' | 'pursuit'
  id: string
  title: string
  subtitle: string
  tenderId?: string
}
export function searchResultView(result: SearchResult): View | null {
  if (!validNavigationId(result.id)) return null
  switch (result.type) {
    case 'tender': return { type: 'tender', tenderId: result.id }
    case 'buyer': return { type: 'buyer-detail', organizationId: result.id }
    case 'supplier': return { type: 'competitor-detail', organizationId: result.id }
    case 'company': return { type: 'company' }
    case 'pursuit': return { type: 'bid-room', pursuitId: result.id }
    case 'award': return validNavigationId(result.tenderId) ? { type: 'tender', tenderId: result.tenderId } : null
    default: return null
  }
}
export function parseSearchResults(payload: unknown): SearchResult[] {
  if (!payload || typeof payload !== 'object' || !('results' in payload) || !Array.isArray(payload.results)) throw new Error('Unexpected search response')
  return payload.results.filter((result): result is SearchResult => !!result && typeof result === 'object' && typeof result.title === 'string' && typeof result.subtitle === 'string' && searchResultView(result) !== null)
}
