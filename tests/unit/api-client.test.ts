import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, apiRequest, validApiPayload } from '@/lib/api-client'

afterEach(() => vi.unstubAllGlobals())

describe('browser API boundary', () => {
  it('accepts observed analytics with unknown provider costs and rejects malformed history', () => {
    const analytics = { current: { activePursuits: 1, llmCalls30d: 2, llmCost30d: null }, metadata: { timezone: 'UTC' }, history: [], trends: { winRate: [], pipelineValue: [], llmUsage: [], evidenceCoverage: [], bidCycleTime: [] } }
    expect(validApiPayload('/api/analytics', analytics)).toBe(true)
    expect(validApiPayload('/api/analytics', { ...analytics, history: {} })).toBe(false)
  })
  it('preserves a sign-in credential error instead of calling it an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Invalid credentials' }, { status: 401 })))
    await expect(apiFetch('/api/auth/sign-in', { method: 'POST' })).rejects.toThrow('Invalid credentials')
  })
  it.each([
    [401, 'session has expired'], [403, 'permission'], [404, 'not found'], [409, 'Changed concurrently'],
  ])('rejects HTTP %s before returning a response', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Changed concurrently' }, { status })))
    await expect(apiFetch('/api/pursuits')).rejects.toThrow(message as string)
  })

  it('rejects malformed JSON and a successful error-shaped payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>error</html>')))
    await expect(apiFetch('/api/pursuits')).rejects.toThrow('invalid JSON')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'No access' })))
    await expect(apiFetch('/api/pursuits')).rejects.toThrow('unexpected response')
  })

  it('rejects missing list containers instead of showing an empty success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ total: 0 })))
    await expect(apiFetch('/api/pursuits')).rejects.toThrow('unexpected response')
  })

  it('rejects missing required detail containers', () => {
    expect(validApiPayload('/api/pursuits/one', { pursuit: {} })).toBe(false)
    expect(validApiPayload('/api/company', { id: 'one' })).toBe(false)
    expect(validApiPayload('/api/buyers/one', { stats: {} })).toBe(false)
  })

  it('checks mutation payloads even when callers do not parse JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Failed to save' })))
    await expect(apiFetch('/api/notifications', { method: 'PATCH' })).rejects.toThrow('unexpected response')
  })

  it('rejects incomplete creation payloads before navigating or closing the form', () => {
    expect(validApiPayload('/api/pursuits', {}, 'POST')).toBe(false)
    expect(validApiPayload('/api/api-keys', { id: 'one' }, 'POST')).toBe(false)
    expect(validApiPayload('/api/api-keys', { id: 'one', key: 'test-key' }, 'POST')).toBe(true)
  })

  it('publishes a recoverable failure and clears the matching request on success', async () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const states: Array<{ url: string; error: string | null }> = []
    target.addEventListener('api-request-state', event => states.push((event as CustomEvent).detail))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ error: 'Failure' }, { status: 500 })).mockResolvedValueOnce(Response.json({ items: [] })))
    await expect(apiFetch('/api/pursuits')).rejects.toThrow('Failure')
    await apiFetch('/api/pursuits')
    expect(states.map(state => [state.url, state.error])).toEqual([['/api/pursuits', 'Failure'], ['/api/pursuits', null]])
  })

  it('accepts valid empty lists and custom response validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ items: [] }))))
    await expect(apiRequest('/api/pursuits')).resolves.toEqual({ items: [] })
    await expect(apiRequest('/api/pursuits', undefined, value => typeof value === 'string')).rejects.toThrow('unexpected response')
  })

  it('preserves cancellation instead of reporting a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')))
    await expect(apiFetch('/api/pursuits')).rejects.toHaveProperty('name', 'AbortError')
  })
})
