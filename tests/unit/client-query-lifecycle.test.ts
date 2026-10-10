import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Execute the actual hook effects without a DOM test dependency. This exercises
// transport timers, cancellation and stale completion, not React's renderer.
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  request: vi.fn(),
  auth: { authenticated: true, user: { tenantSlug: 'tenant-a', email: 'user-a', role: 'owner' } },
}))
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | void) => { harness.effects.push(effect) },
  useState: (initial: unknown) => { const setter = vi.fn(); harness.setters.push(setter); return [initial, setter] },
}))
vi.mock('@/lib/store', () => ({ useAppStore: Object.assign((select: (state: unknown) => unknown) => select({ auth: harness.auth }), { subscribe: vi.fn() }) }))
vi.mock('@/lib/api-client', () => ({ apiRequest: harness.request, apiErrorMessage: (error: Error) => error.message }))
import { useApiQuery } from '@/hooks/use-api-query'

function Mount(url: string, debounceMs = 300) {
  harness.effects = []; harness.setters = []
  useApiQuery(url, { debounceMs })
  const stateSetter = harness.setters[1]
  const removeListener = harness.effects[0]()
  const cancel = harness.effects[1]()
  return { stateSetter, cancel: () => { cancel?.(); removeListener?.() } }
}

describe('client query request lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers(); harness.request.mockReset()
    vi.stubGlobal('window', new EventTarget())
    harness.auth = { authenticated: true, user: { tenantSlug: 'tenant-a', email: Math.random().toString(), role: 'owner' } }
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('waits 300ms and cancels a superseded search before transport starts', async () => {
    harness.request.mockResolvedValue({ items: [] })
    const first = Mount('/api/buyers?search=ab')
    await vi.advanceTimersByTimeAsync(299)
    expect(harness.request).not.toHaveBeenCalled()
    first.cancel()
    const second = Mount('/api/buyers?search=abc')
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.request).toHaveBeenCalledTimes(1)
    expect(harness.request.mock.calls[0][0]).toBe('/api/buyers?search=abc')
    second.cancel()
  })

  it('aborts superseded transport and ignores late success even if transport ignores abort', async () => {
    let resolveOld!: (data: unknown) => void
    harness.request.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ items: ['new'] })
    const old = Mount('/api/buyers?search=old')
    await vi.advanceTimersByTimeAsync(300)
    const signal = harness.request.mock.calls[0][1].signal as AbortSignal
    old.cancel()
    const next = Mount('/api/buyers?search=new')
    await vi.advanceTimersByTimeAsync(300)
    resolveOld({ items: ['old'] }); await Promise.resolve()
    expect(signal.aborted).toBe(true)
    expect(old.stateSetter).toHaveBeenCalledTimes(1) // loading only
    expect(next.stateSetter).toHaveBeenLastCalledWith(expect.objectContaining({ data: { items: ['new'] }, error: null, loading: false }))
    next.cancel()
  })

  it('exposes failures and clears them on a successful retry', async () => {
    harness.request.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ items: [] })
    const first = Mount('/api/buyers?search=retry')
    await vi.advanceTimersByTimeAsync(300)
    expect(first.stateSetter).toHaveBeenLastCalledWith(expect.objectContaining({ data: null, error: 'Unavailable', loading: false }))
    first.cancel()
    const retry = Mount('/api/buyers?search=retry')
    await vi.advanceTimersByTimeAsync(300)
    expect(retry.stateSetter).toHaveBeenLastCalledWith(expect.objectContaining({ error: null, loading: false }))
    retry.cancel()
  })

  it('reuses a cached result only until a successful mutation', async () => {
    harness.request.mockResolvedValue({ items: ['fresh'] })
    const first = Mount('/api/buyers?search=cache')
    await vi.advanceTimersByTimeAsync(300)
    first.cancel()
    const cached = Mount('/api/buyers?search=cache')
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.request).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new CustomEvent('api-request-state', { detail: { method: 'PATCH', error: null } }))
    cached.cancel()
    const refreshed = Mount('/api/buyers?search=cache')
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.request).toHaveBeenCalledTimes(2)
    refreshed.cancel()
  })

  it('fetches again after switching tenant instead of displaying another tenant cache', async () => {
    harness.request.mockResolvedValueOnce({ items: ['tenant-a'] }).mockResolvedValueOnce({ items: ['tenant-b'] })
    const first = Mount('/api/buyers?search=tenant')
    await vi.advanceTimersByTimeAsync(300)
    first.cancel()
    harness.auth = { ...harness.auth, user: { ...harness.auth.user, tenantSlug: 'tenant-b' } }
    const second = Mount('/api/buyers?search=tenant')
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.request).toHaveBeenCalledTimes(2)
    expect(second.stateSetter).toHaveBeenLastCalledWith(expect.objectContaining({ data: { items: ['tenant-b'] } }))
    second.cancel()
  })

  it('invalidates cached views when a mutation happens while every query view is unmounted', async () => {
    harness.request.mockResolvedValue({ items: ['fresh'] })
    const first = Mount('/api/buyers?search=unmounted')
    await vi.advanceTimersByTimeAsync(300)
    first.cancel()
    window.dispatchEvent(new CustomEvent('api-request-state', { detail: { method: 'POST', error: null } }))
    const next = Mount('/api/buyers?search=unmounted')
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.request).toHaveBeenCalledTimes(2)
    next.cancel()
  })
})

