'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export function SignIn() {
  const [email, setEmail] = useState('owner@atlas-demo.com')
  const [password, setPassword] = useState('demo1234')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAuth = useAppStore((s) => s.setAuth)
  const goCommand = useAppStore((s) => s.goCommand)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed')
        return
      }
      // Fetch user info
      const meRes = await fetch('/api/auth/me')
      const me = await meRes.json()
      if (me.authenticated) {
        setAuth({ authenticated: true, user: me.user })
        goCommand()
      }
    } catch (e) {
      setError('Network error: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    // Demo mode — explore without auth (read-only)
    setAuth({ authenticated: false, user: null })
    goCommand()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white text-lg font-bold mb-3">
            PA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">ProcureAtlas AI</h1>
          <p className="text-sm text-slate-500 mt-1">Global Tender Intelligence & Bid Operations</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h2>
          <p className="text-xs text-slate-500 mb-4">
            Phase 2 authentication with bcrypt-hashed credentials and session cookies.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors',
                loading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Demo credentials</p>
              <ul className="space-y-0.5">
                <li><code className="bg-white px-1 rounded">owner@atlas-demo.com</code> / <code className="bg-white px-1 rounded">demo1234</code> — Owner</li>
                <li><code className="bg-white px-1 rounded">manager@atlas-demo.com</code> / <code className="bg-white px-1 rounded">demo1234</code> — Manager</li>
                <li><code className="bg-white px-1 rounded">contributor@atlas-demo.com</code> / <code className="bg-white px-1 rounded">demo1234</code> — Contributor</li>
              </ul>
            </div>

            <button
              onClick={handleSkip}
              className="mt-3 w-full text-xs text-slate-500 hover:text-slate-900 transition-colors"
            >
              Skip — explore in demo mode (read-only)
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="h-3 w-3" />
          <span>Account lockout after 5 failed attempts · Session TTL 7 days · Audit logged</span>
        </div>
      </div>
    </div>
  )
}
