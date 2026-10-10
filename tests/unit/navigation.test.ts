import { describe, expect, it } from 'vitest'
import { readNavigation, navigationUrl } from '@/lib/navigation'

describe('shareable navigation', () => {
  it('restores details and discover filters', () => {
    const state = readNavigation('?view=tender&tenderId=tender-123&market=BD&search=bridge')
    expect(state.view).toEqual({ type: 'tender', tenderId: 'tender-123' })
    expect(state.discoverFilters).toMatchObject({ market: 'BD', search: 'bridge' })
  })
  it('fails safely for unknown modules and unsafe detail IDs', () => {
    expect(readNavigation('?view=evil').view).toEqual({ type: 'command' })
    expect(readNavigation('?view=bid-room&pursuitId=../secret').view).toEqual({ type: 'command' })
    expect(readNavigation('?view=tender').view).toEqual({ type: 'command' })
  })
  it('preserves unrelated parameters, removes stale details, and consumes account tokens outside sign-in', () => {
    const url = navigationUrl('/?accountToken=secret&utm_source=mail&tenderId=old', { type: 'discover' }, { market: 'BD', sector: 'all', status: 'active', search: '' })
    expect(url).toContain('utm_source=mail')
    expect(url).not.toContain('accountToken')
    expect(url).not.toContain('tenderId')
    expect(readNavigation(url.slice(url.indexOf('?'))).view).toEqual({ type: 'discover' })
  })
  it('gives account actions priority on initial restoration', () => {
    expect(readNavigation('?accountToken=secret&view=company').view).toEqual({ type: 'sign-in' })
  })
})
