'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'

export function ApiFailureNotice() {
  const [errors, setErrors] = useState<Record<string, { error: string; method: string }>>({})
  const goSignIn = useAppStore(state => state.goSignIn)
  useEffect(() => {
    const listener = (event: Event) => {
      const { url, method, error } = (event as CustomEvent<{ url: string; method: string; error: string | null }>).detail
      setErrors(current => {
        const next = { ...current }
        const key = `${method}:${url}`
        if (error) next[key] = { error, method }
        else delete next[key]
        return next
      })
    }
    window.addEventListener('api-request-state', listener)
    return () => window.removeEventListener('api-request-state', listener)
  }, [])
  const entries = Object.entries(errors)
  if (!entries.length) return null
  return <div role="alert" className="fixed right-4 top-16 z-[100] max-w-lg rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 shadow-lg">
    {entries.map(([url, item]) => <p key={url}>{item.error} {item.method !== 'GET' ? 'Check the latest state before retrying this action.' : 'Data below may be unavailable or outdated.'}</p>)}
    <button type="button" className="mt-2 underline" onClick={() => window.location.reload()}>Reload and retry</button>
    {entries.some(([, item]) => item.error.includes('sign in')) && <button type="button" className="ml-4 underline" onClick={goSignIn}>Sign in</button>}
    <button type="button" className="ml-4 underline" onClick={() => setErrors({})}>Dismiss</button>
  </div>
}
