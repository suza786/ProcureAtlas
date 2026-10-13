'use client'
import { useTranslation } from '@/hooks/use-translation'

import { useState } from 'react'
import { apiFetch, apiErrorMessage } from '@/lib/api-client'

const inputClass = 'mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
export function AccountAccess({ token, onBack }: { token?: string; onBack: () => void }) {
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (token && (password !== confirmation || new TextEncoder().encode(password).length > 72)) { setError('Passwords must match and contain at most 72 UTF-8 bytes.'); return }
    if (token && !/^[a-f0-9]{64}$/.test(token)) { setError('This account link is invalid. Request a new link.'); return }
    setBusy(true)
    try {
      const response = await apiFetch('/api/auth/recovery', { method: token ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token ? { token, password } : { email: email.trim().toLowerCase() }) })
      const data = await response.json()
      if (token) {
        const url = new URL(window.location.href); url.searchParams.delete('accountToken'); window.history.replaceState(null, '', url.pathname + url.search + url.hash)
        setPassword(''); setConfirmation(''); setDone(true); setMessage('Your password is ready. Sign in to continue.')
      } else { setMessage(data.message ?? 'If this account is active, a recovery email will be sent.'); setEmail('') }
    } catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-foreground">{token ? t("Choose your password") : t("Reset your password")}</h2>
    <p className="mt-1 mb-4 text-sm text-muted-foreground">{token ? t("Use at least 12 characters. Your account link can be used once.") : t("Enter your account email to receive a recovery link.")}</p>
    {!done && <form onSubmit={submit} className="space-y-3" aria-busy={busy}>
      {token ? <><label className="block text-sm">{t("New password")}<input className={inputClass} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">{t("Confirm password")}<input className={inputClass} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></> : <label className="block text-sm">{t("Email")}<input className={inputClass} type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">{busy ? t("Saving…") : token ? t("Set password") : t("Send recovery link")}</button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
    <button type="button" disabled={busy} onClick={onBack} className="mt-4 text-sm font-medium text-foreground underline">{t("Back to sign in")}</button>
  </section>
}
