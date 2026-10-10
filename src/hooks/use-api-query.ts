'use client'

import { useEffect, useState } from 'react'
import { apiRequest, apiErrorMessage } from '@/lib/api-client'
import { ClientQueryCache } from '@/lib/client-query-cache'
import { useAppStore } from '@/lib/store'

const cache = new ClientQueryCache()
const invalidationTargets = new WeakSet<EventTarget>()
const successfulMutation = (event: Event) => {
  const detail = (event as CustomEvent<{ method: string; error: string | null }>).detail
  return detail && detail.method !== 'GET' && !detail.error
}
function installMutationInvalidation(target: EventTarget) {
  if (invalidationTargets.has(target)) return
  invalidationTargets.add(target)
  // Keep this listener after a query view unmounts: uploads and other mutations
  // can happen in views that do not use this hook.
  target.addEventListener('api-request-state', event => { if (successfulMutation(event)) cache.clear() })
}
if (typeof window !== 'undefined') installMutationInvalidation(window)
const identity = (auth: ReturnType<typeof useAppStore.getState>['auth']) =>
  auth.authenticated && auth.user ? JSON.stringify([auth.user.tenantSlug, auth.user.email, auth.user.role]) : 'anonymous'

// Clear even while query views are unmounted, including logout followed by a
// login with the same account. No cookies, tokens, keys or secrets enter cache.
useAppStore.subscribe((state, previous) => {
  if (state.auth !== previous.auth) { cache.clear(); cache.setScope(identity(state.auth)) }
})

const safeCachePath = /^\/api\/(tenders|buyers|competitors|awards|partners|markets)(\/[^?]*)?(\?|$)/

export function useApiQuery<T>(url: string, options: { debounceMs?: number; refreshKey?: unknown } = {}) {
  const auth = useAppStore(s => s.auth)
  const scope = identity(auth)
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([scope, url, revision, options.refreshKey])
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string | null }>({ key: '', data: null, loading: true, error: null })

  useEffect(() => {
    installMutationInvalidation(window)
    const invalidate = (event: Event) => {
      if (successfulMutation(event)) setRevision(value => value + 1)
    }
    window.addEventListener('api-request-state', invalidate)
    return () => window.removeEventListener('api-request-state', invalidate)
  }, [])

  useEffect(() => {
    cache.setScope(scope)
    const controller = new AbortController()
    let active = true
    const generation = cache.version
    const cacheable = auth.authenticated && safeCachePath.test(url)
    const cached = cacheable ? cache.read<T>(url) : undefined
    const timer = setTimeout(async () => {
      if (!active || controller.signal.aborted || generation !== cache.version) return
      if (cached !== undefined) { setState({ key, data: cached, loading: false, error: null }); return }
      setState({ key, data: null, loading: true, error: null })
      try {
        const data = await apiRequest<T>(url, { signal: controller.signal })
        if (!active || controller.signal.aborted || generation !== cache.version) return
        if (cacheable) cache.write(url, data, generation)
        setState({ key, data, loading: false, error: null })
      } catch (error) {
        if (!active || controller.signal.aborted || generation !== cache.version) return
        setState({ key, data: null, loading: false, error: apiErrorMessage(error) })
      }
    }, cached === undefined ? (options.debounceMs ?? 0) : 0)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [url, scope, auth, key, options.debounceMs])

  const current = state.key === key ? state : { data: null, loading: true, error: null }
  return { ...current, refetch: () => { cache.remove(url); setRevision(value => value + 1) } }
}
