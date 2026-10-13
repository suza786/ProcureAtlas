'use client'
import { useTranslation } from '@/hooks/use-translation'

import { useState } from 'react'
import { apiFetch, apiErrorMessage } from '@/lib/api-client'
export function InviteUser({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()

  const [email,setEmail]=useState(''), [name,setName]=useState(''), [role,setRole]=useState('viewer')
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {
      await apiFetch('/api/admin/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim().toLowerCase(),...(name.trim()?{name:name.trim()}:{}),role})})
      setEmail('');setName('');setRole('viewer');setMessage('Invitation queued for email delivery.');onCreated()
    } catch(cause){setError(apiErrorMessage(cause))} finally{setBusy(false)}
  }
  return <section className="rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">{t("Invite a team member")}</h2>
    <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy={busy}>
      <label className="text-sm">{t("Email")}<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded border border-border p-2 focus:ring-2 focus:ring-slate-500" /></label>
      <label className="text-sm">{t("Name (optional)")}<input maxLength={200} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded border border-border p-2 focus:ring-2 focus:ring-slate-500" /></label>
      <label className="text-sm">{t("Role")}<select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full rounded border border-border p-2 focus:ring-2 focus:ring-slate-500">{['viewer','contributor','manager','admin'].map(r=><option key={r} value={r}>{r}</option>)}</select></label>
      <button disabled={busy} className="self-end rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">{busy?t("Sending…"):t("Send invitation")}</button>
    </form>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}{message&&<p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
  </section>
}
