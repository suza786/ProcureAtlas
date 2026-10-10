import { describe, expect, it } from 'vitest'
import { searchResultView, parseSearchResults } from '@/lib/global-search'

describe('global search destinations', () => {
  it('opens the actual returned entity', () => {
    expect(searchResultView({ type: 'tender', id: 't1', title: 'Bridge', subtitle: '' })).toEqual({ type: 'tender', tenderId: 't1' })
    expect(searchResultView({ type: 'award', id: 'a1', tenderId: 't1', title: 'Bridge', subtitle: '' })).toEqual({ type: 'tender', tenderId: 't1' })
    expect(searchResultView({ type: 'pursuit', id: 'p1', title: 'Bid', subtitle: '' })).toEqual({ type: 'bid-room', pursuitId: 'p1' })
    expect(searchResultView({ type: 'supplier', id: 's1', title: 'Supplier', subtitle: '' })).toEqual({ type: 'competitor-detail', organizationId: 's1' })
  })
  it('rejects malformed results before rendering or navigation', () => {
    expect(parseSearchResults({ results: [{ type: 'tender', id: '../secret', title: 'Bad', subtitle: '' }] })).toEqual([])
    expect(() => parseSearchResults({ results: 'bad' })).toThrow()
  })
})
