'use client'
import { useTranslation } from '@/hooks/use-translation'

import { useEffect, useState } from 'react'
import { apiFetch, apiErrorMessage } from '@/lib/api-client'
type Job = { id: string; kind: string; status: string; attempts: number; maxAttempts: number; error: string | null; availableAt: string }
export function OutboxJobs() {
  const { t } = useTranslation()

  const [jobs,setJobs]=useState<Job[]>([]), [status,setStatus]=useState('failed')
  const [busy,setBusy]=useState(false), [error,setError]=useState('')
  async function load(selected=status) {
    setBusy(true);setError('')
    try { const response=await apiFetch(`/api/jobs?status=${selected}&limit=20`);const data=await response.json();setJobs(data.items??[]) }
    catch(cause){setError(apiErrorMessage(cause))}finally{setBusy(false)}
  }
  useEffect(()=>{void load('failed')},[])
  async function retry(id:string) {
    setBusy(true);setError('')
    try {await apiFetch(`/api/jobs/${id}/retry`,{method:'POST'});await load()}
    catch(cause){setError(apiErrorMessage(cause));setBusy(false)}
  }
  return <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t("Background jobs")}</h2><div className="flex gap-2"><label className="text-sm">{t("Status")}<select aria-label={t("Job status")} disabled={busy} value={status} onChange={e=>{setStatus(e.target.value);void load(e.target.value)}} className="ml-2 rounded border p-2">{['failed','pending','running','retrying','completed','all'].map(s=><option key={s}>{s}</option>)}</select></label><button disabled={busy} onClick={()=>void load()} className="rounded border px-3 py-2 text-sm">{busy?'Loading…':'Refresh'}</button></div></div>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {!busy&&!error&&!jobs.length&&<p role="status" className="mt-3 text-sm text-slate-500">{t("No jobs with this status.")}</p>}
    <ul className="mt-3 divide-y divide-slate-200" aria-busy={busy}>{jobs.map(job=><li key={job.id} className="py-3 text-sm"><div className="flex items-center justify-between gap-3"><div><span className="font-medium">{job.kind}</span><span className="ml-2 text-slate-600">{job.status} · {job.attempts}/{job.maxAttempts} attempts</span></div>{job.status==='failed'&&<button disabled={busy} onClick={()=>void retry(job.id)} className="rounded border px-3 py-1.5">{t("Retry")}</button>}</div><p className="mt-1 break-all text-xs text-slate-500">{job.id}</p>{job.error&&<p className="mt-1 break-words text-rose-700">{job.error}</p>}{job.status==='retrying'&&<p className="mt-1 text-xs text-slate-600">{t("Next attempt:")}{' '}{new Date(job.availableAt).toLocaleString()}</p>}</li>)}</ul>
  </section>
}
