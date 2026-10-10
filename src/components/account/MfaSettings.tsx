'use client'
import { useTranslation } from '@/hooks/use-translation'

import { useState } from 'react'
import { apiFetch, apiErrorMessage } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'

export function MfaSettings({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()

  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const setAuth = useAppStore(s => s.setAuth)
  const goSignIn = useAppStore(s => s.goSignIn)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const action = enabled ? 'disable' : setup ? 'enable' : 'setup'
      const response = await apiFetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, password, ...(action !== 'setup' ? { code } : {}) }) })
      const data = await response.json()
      if (action === 'setup') { setSetup({ secret: data.secret, uri: data.uri }); setCode('') }
      else { setPassword(''); setCode(''); setSetup(null); setSignedOut(true); setAuth({ authenticated: false, user: null }) }
    } catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setBusy(false) }
  }
  if (signedOut) return <section className="rounded-lg border border-slate-200 bg-white p-4"><p role="status" className="text-sm">{t("Authenticator settings updated. Your sessions and API keys were revoked.")}</p><button onClick={goSignIn} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">{t("Sign in again")}</button></section>
  return <section className="rounded-lg border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold">{t("Authenticator verification")}</h2>
    <p className="mt-1 text-sm text-slate-600">{enabled ? t("Enabled. Enter your password and authenticator code to disable it. This signs you out and revokes your API keys.") : t("Add a six-digit authenticator code to protect your account.")}</p>
    <form onSubmit={submit} className="mt-3 space-y-3 max-w-md" aria-busy={busy}>
      <label className="block text-sm">{t("Current password")}<input type="password" required autoComplete="current-password" maxLength={72} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 focus:ring-2 focus:ring-slate-500" /></label>
      {setup && <div className="rounded bg-slate-50 p-3 text-sm"><p>{t("In your authenticator app, add this account with the setup key. Finish within 10 minutes.")}</p><code className="mt-2 block break-all select-all font-semibold">{setup.secret}</code><a href={setup.uri} className="mt-2 inline-block underline">{t("Open authenticator app")}</a><p className="mt-2 text-xs text-slate-600">{t("Changing this setting signs you out and revokes your API keys.")}</p></div>}
      {(setup || enabled) && <label className="block text-sm">{t("Authenticator code")}<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 focus:ring-2 focus:ring-slate-500" /></label>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button disabled={busy} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">{busy ? t("Saving…") : enabled ? t("Disable authenticator") : setup ? t("Enable authenticator") : t("Set up authenticator")}</button>
      {setup && <button type="button" disabled={busy} onClick={() => { setSetup(null); setCode(''); setPassword('') }} className="ml-3 text-sm underline">{t("Cancel setup")}</button>}
    </form>
  </section>
}
