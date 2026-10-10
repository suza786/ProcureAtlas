import { describe, expect, it, vi } from 'vitest'
import { ClientQueryCache } from '@/lib/client-query-cache'

describe('tenant scoped client query cache', () => {
  it('never reuses results after switching identity or invalidating a mutation', () => {
    const cache = new ClientQueryCache(100, 2)
    cache.setScope('tenant-a:user-a')
    cache.write('/api/buyers', { items: ['private-a'] })
    expect(cache.read('/api/buyers')).toEqual({ items: ['private-a'] })
    cache.setScope('tenant-a:user-b')
    expect(cache.read('/api/buyers')).toBeUndefined()
    cache.write('/api/buyers', { items: ['private-b'] })
    cache.clear()
    expect(cache.read('/api/buyers')).toBeUndefined()
  })

  it('expires entries and bounds retained results', () => {
    vi.useFakeTimers()
    const cache = new ClientQueryCache(100, 2)
    cache.write('a', 1); cache.write('b', 2); cache.write('c', 3)
    expect(cache.read('a')).toBeUndefined()
    expect(cache.read('b')).toBe(2)
    vi.advanceTimersByTime(101)
    expect(cache.read('c')).toBeUndefined()
    vi.useRealTimers()
  })

  it('rejects results from requests started before scope change or mutation', () => {
    const cache = new ClientQueryCache()
    const before = cache.version
    cache.clear()
    cache.write('old', { private: true }, before)
    expect(cache.read('old')).toBeUndefined()
    const current = cache.version
    cache.setScope('new-user')
    cache.write('old-user', { private: true }, current)
    expect(cache.read('old-user')).toBeUndefined()
  })
})
