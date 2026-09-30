'use client'

import { useEffect, useState } from 'react'
import {
  formatUSD,
  formatDate,
  daysUntil,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Brain,
  Award,
  FolderKanban,
  Users,
  FileCheck2,
  AlertTriangle,
  Shield,
  TrendingUp,
  Building2,
  Globe,
  ExternalLink,
  Plus,
  Upload,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface CompanyData {
  id: string
  name: string
  legalName: string | null
  country: string
  city: string | null
  registrationNo: string | null
  taxId: string | null
  website: string | null
  foundedYear: number | null
  employeeCount: number | null
  annualTurnoverUSD: number | null
  description: string | null
  evidence: Array<{
    id: string
    category: string
    title: string
    issuer: string | null
    issuedAt: string | null
    expiresAt: string | null
    verified: boolean
    confidence: number
  }>
  certifications: Array<{
    id: string
    name: string
    issuer: string | null
    issuedAt: string | null
    expiresAt: string | null
    certificateNo: string | null
    verified: boolean
    daysToExpiry: number | null
  }>
  projectReferences: Array<{
    id: string
    title: string
    client: string
    clientType: string | null
    country: string | null
    valueUSD: number | null
    startDate: string | null
    endDate: string | null
    role: string | null
    verified: boolean
  }>
  employees: Array<{
    id: string
    name: string
    role: string | null
    qualifications: string | null
    yearsExperience: number | null
    securityClearance: string | null
  }>
  capabilityMap: Record<string, number>
  expiryBuckets: { expired: number; thirtyDays: number; ninetyDays: number; safe: number }
  stats: {
    evidenceCount: number
    certificationCount: number
    projectReferenceCount: number
    employeeCount: number
    verifiedEvidenceCount: number
  }
}

const EVIDENCE_CATEGORY_LABEL: Record<string, string> = {
  registration: 'Registration',
  financial: 'Financial',
  certification: 'Certification',
  project: 'Project',
  oem: 'OEM Authorization',
  partnership: 'Partnership',
  employee: 'Employee',
  facility: 'Facility',
  equipment: 'Equipment',
  catalogue: 'Catalogue',
  reference: 'Reference',
  proposal_library: 'Proposal Library',
  past_response: 'Past Response',
  past_win: 'Past Win',
  past_loss: 'Past Loss',
}

export function CompanyBrain() {
  const [data, setData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetch('/api/company')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading Company Brain...</div>
  if (!data) return <div className="p-6 text-sm text-rose-600">Company profile not found.</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-slate-700" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{data.name}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">{data.legalName} · {data.country}</p>
        </div>
        {data.expiryBuckets.expired + data.expiryBuckets.thirtyDays > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span className="text-rose-700 font-medium">
              {data.expiryBuckets.expired + data.expiryBuckets.thirtyDays} certification(s) need attention
            </span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile icon={FileCheck2} label="Evidence Items" value={data.stats.evidenceCount} sub={`${data.stats.verifiedEvidenceCount} verified`} tone="emerald" />
        <StatTile icon={Shield} label="Certifications" value={data.stats.certificationCount} sub={`${data.expiryBuckets.expired} expired`} tone="violet" />
        <StatTile icon={FolderKanban} label="Project Refs" value={data.stats.projectReferenceCount} sub="Past performance" tone="sky" />
        <StatTile icon={Users} label="Employees" value={data.stats.employeeCount} sub="On file" tone="amber" />
        <StatTile icon={TrendingUp} label="Annual Turnover" value={formatUSD(data.annualTurnoverUSD)} sub="USD" tone="slate" />
      </div>

      {/* Company metadata */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Company Profile</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <Field icon={Building2} label="Registration No." value={data.registrationNo} />
          <Field icon={FileCheck2} label="Tax ID" value={data.taxId} />
          <Field icon={Globe} label="Website" value={data.website ? (
            <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900 flex items-center gap-1">
              {data.website} <ExternalLink className="h-3 w-3" />
            </a>
          ) : '—'} />
          <Field icon={Building2} label="Founded" value={data.foundedYear ? `${data.foundedYear} (${new Date().getFullYear() - data.foundedYear} years)` : '—'} />
          <Field icon={Users} label="Employees" value={data.employeeCount?.toString() ?? '—'} />
          <Field icon={Building2} label="City" value={data.city ?? '—'} />
          <Field icon={Globe} label="Country" value={data.country} />
          <Field icon={TrendingUp} label="Annual Turnover" value={formatUSD(data.annualTurnoverUSD)} />
        </div>
        {data.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-600 leading-relaxed">{data.description}</p>
          </div>
        )}
      </div>

      {/* Capability map */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Capability Map</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(data.capabilityMap).map(([cat, count]) => (
            <div key={cat} className="rounded-md border border-slate-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{EVIDENCE_CATEGORY_LABEL[cat] ?? cat}</p>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{count}</p>
              <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5">
                <div className="bg-slate-900 h-full rounded-full" style={{ width: `${Math.min(count * 20, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: certifications + projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Certifications with expiry */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-600" />
              Certifications
            </h2>
            <ExpiryBuckets buckets={data.expiryBuckets} />
          </div>
          <div className="divide-y divide-slate-100">
            {data.certifications.map(c => {
              const expired = c.daysToExpiry !== null && c.daysToExpiry < 0
              const soon = c.daysToExpiry !== null && c.daysToExpiry >= 0 && c.daysToExpiry <= 30
              const approaching = c.daysToExpiry !== null && c.daysToExpiry > 30 && c.daysToExpiry <= 90
              return (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.issuer ?? 'Unknown issuer'}
                        {c.certificateNo && ` · #${c.certificateNo}`}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Issued: {formatDate(c.issuedAt)}
                        {c.expiresAt && ` · Expires: ${formatDate(c.expiresAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.verified && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                          verified
                        </span>
                      )}
                      {c.daysToExpiry !== null && (
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          expired ? 'bg-rose-500/15 text-rose-700' :
                          soon ? 'bg-rose-500/15 text-rose-700' :
                          approaching ? 'bg-amber-500/15 text-amber-700' :
                          'bg-emerald-500/15 text-emerald-700'
                        )}>
                          {expired ? `${Math.abs(c.daysToExpiry)}d overdue` : `${c.daysToExpiry}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Project references */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-sky-600" />
              Project References
            </h2>
            <span className="text-xs text-slate-500">{data.projectReferences.length} on file</span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.projectReferences.map(p => (
              <div key={p.id} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{p.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                  <span><strong className="text-slate-700">{p.client}</strong></span>
                  {p.clientType && (
                    <span className={cn(
                      'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                      p.clientType === 'government' ? 'bg-sky-500/15 text-sky-700' :
                      p.clientType === 'multilateral' ? 'bg-violet-500/15 text-violet-700' :
                      'bg-slate-500/15 text-slate-700'
                    )}>
                      {p.clientType}
                    </span>
                  )}
                  {p.country && <span>· {p.country}</span>}
                  {p.role && <span>· {p.role}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                  {p.startDate && <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>}
                  {p.valueUSD !== null && <span>· {formatUSD(p.valueUSD)}</span>}
                  {p.verified && <span className="text-emerald-600 font-medium">· verified</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence list */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              Evidence Library
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Every factual company claim is linked to verifiable evidence.</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" /> Add Evidence
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Category</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Issuer</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Issued</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Expires</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.evidence.map(e => {
                const expired = e.expiresAt && daysUntil(e.expiresAt) !== null && daysUntil(e.expiresAt)! < 0
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{e.title}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {EVIDENCE_CATEGORY_LABEL[e.category] ?? e.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{e.issuer ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(e.issuedAt)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(e.expiresAt)}</td>
                    <td className="px-3 py-2.5">
                      {e.verified ? (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">verified</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">pending</span>
                      )}
                      {expired && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">expired</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employees */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            Key Personnel
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {data.employees.map(emp => (
            <div key={emp.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.role}</p>
                </div>
              </div>
              {emp.qualifications && (
                <p className="text-xs text-slate-600 mt-2">
                  <span className="text-slate-400">Qualifications:</span> {emp.qualifications}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                {emp.yearsExperience && <span>{emp.yearsExperience}y exp</span>}
                {emp.securityClearance && <span>· {emp.securityClearance}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false)
            // Reload data
            fetch('/api/company').then(r => r.json()).then(d => setData(d))
          }}
        />
      )}
    </div>
  )
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('certification')
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async () => {
    if (!file || !title) {
      setError('File and title are required.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      // Step 1: upload file
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'evidence')
      const uploadRes = await fetch('/api/uploads', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        setError(uploadData.error ?? 'Upload failed')
        return
      }
      // Step 2: create evidence linked to file
      const evRes = await fetch('/api/company/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title,
          issuer: issuer || undefined,
          expiresAt: expiresAt || undefined,
          fileUploadId: uploadData.id,
        }),
      })
      if (!evRes.ok) {
        const evData = await evRes.json()
        setError(evData.error ?? 'Evidence creation failed')
        return
      }
      setSuccess('Evidence uploaded and linked successfully.')
      setTimeout(() => onUploaded(), 1200)
    } catch (e) {
      setError('Network error: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Add Evidence</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ISO 27001:2022 Certification"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400 bg-white"
            >
              {Object.entries(EVIDENCE_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Issuer</label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="e.g. BSI, Microsoft, RJSC"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">File * (PDF, PNG, JPG, TXT, DOCX, XLSX — max 25 MB)</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"
                className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-900 file:text-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer"
              />
            </div>
            {file && (
              <p className="text-[10px] text-slate-500 mt-1">
                {file.name} — {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-500/5 border border-rose-500/30 rounded-md p-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-700 bg-emerald-500/5 border border-emerald-500/30 rounded-md p-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> {success}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={submit}
              disabled={uploading || !file || !title}
              className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5"
            >Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  tone: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'slate'
}) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    slate: 'text-slate-600 bg-slate-500/10',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <div className={cn('rounded-md p-1', toneMap[tone])}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ExpiryBuckets({ buckets }: { buckets: { expired: number; thirtyDays: number; ninetyDays: number; safe: number } }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {buckets.expired > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 font-medium">{buckets.expired} expired</span>
      )}
      {buckets.thirtyDays > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 font-medium">{buckets.thirtyDays} ≤30d</span>
      )}
      {buckets.ninetyDays > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 font-medium">{buckets.ninetyDays} ≤90d</span>
      )}
      {buckets.safe > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-medium">{buckets.safe} safe</span>
      )}
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
        <p className="text-sm text-slate-900 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  )
}
