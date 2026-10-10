import { describe, expect, it } from 'vitest'
import { discoverQuery, DISCOVER_PAGE_SIZE } from '@/lib/discover-query'

describe('Discover request contract', () => {
  it('always sends all status explicitly, so the server does not default to active', () => {
    const params = new URLSearchParams(discoverQuery({ market: 'all', sector: 'all', status: 'all', search: '' }))
    expect(params.get('status')).toBe('all')
    expect(params.get('offset')).toBe('0')
    expect(params.has('market')).toBe(false)
  })
  it('sends the next page and preserves filters and encoded search', () => {
    const params = new URLSearchParams(discoverQuery({ market: 'BD', sector: 'IT', status: 'awarded', search: 'A&B' }, DISCOVER_PAGE_SIZE))
    expect(Object.fromEntries(params)).toEqual({ status: 'awarded', limit: '50', offset: '50', market: 'BD', sector: 'IT', search: 'A&B' })
  })
})
