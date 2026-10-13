'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { AccountAccess } from '@/components/account/AccountAccess'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export function SignIn() {
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [accountToken, setAccountToken] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [otp, setOtp] = useState('')
  const setAuth = useAppStore((s) => s.setAuth)
  const goCommand = useAppStore((s) => s.goCommand)
  useEffect(() => { const token = new URL(window.location.href).searchParams.get('accountToken'); if (token) setAccountToken(token) }, [])
  const backToSignIn = () => {
    const url = new URL(window.location.href); url.searchParams.delete('accountToken'); window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    setAccountToken(undefined); setRecovery(false); setPassword(''); setOtp(''); setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mfaRequired ? { otp } : {}) }),
      })
      const data = await res.json()
      if (data.mfaRequired) { setMfaRequired(true); return }
      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed')
        return
      }
      // Fetch user info
      const meRes = await apiFetch('/api/auth/me')
      const me = await meRes.json()
      if (me.authenticated) {
        setAuth({ authenticated: true, user: me.user })
        goCommand()
      }
    } catch (e) {
      setError((e as Error).message)
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
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold mb-3">
            PA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ProcureAtlas AI</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("Global Tender Intelligence & Bid Operations")}</p>
        </div>

        {recovery || accountToken ? <AccountAccess token={accountToken} onBack={backToSignIn} /> : <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-1">{t("Sign in")}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t("Sign in to your team's workspace.")}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("Email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  aria-label={t("Email")}
                  autoComplete="username"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t("Password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  aria-label={t("Password")}
                  autoComplete="current-password"
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {mfaRequired && <label className="block text-sm">{t("Authenticator code")}<input aria-label={t("Authenticator code")} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value)} className="w-full rounded border p-2 mt-1" /></label>}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors',
                loading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Signing in...' : t("Sign in")}
            </button>
          </form>
          <button type="button" onClick={() => { setRecovery(true); setPassword(''); setOtp(''); setError(null) }} className="mt-3 text-sm text-foreground underline">{t("Forgot your password?")}</button>

          {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && <div className="mt-4 pt-4 border-t border-border">
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">{t("Demo credentials")}</p>
              <ul className="space-y-0.5">
                <li><code className="bg-card px-1 rounded">owner@atlas-demo.com</code> / <code className="bg-card px-1 rounded">demo1234</code> {' '}{t("— Owner")}</li>
                <li><code className="bg-card px-1 rounded">manager@atlas-demo.com</code> / <code className="bg-card px-1 rounded">demo1234</code> {' '}{t("— Manager")}</li>
                <li><code className="bg-card px-1 rounded">contributor@atlas-demo.com</code> / <code className="bg-card px-1 rounded">demo1234</code> {' '}{t("— Contributor")}</li>
              </ul>
            </div>

            <button
              onClick={handleSkip}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("Skip — explore in demo mode (read-only)")}</button>
          </div>}
        </div>}

        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          <span>Account lockout after 5 failed attempts · Session TTL 7 days · Audit logged</span>
        </div>
      </div>
    </div>
  )
}
