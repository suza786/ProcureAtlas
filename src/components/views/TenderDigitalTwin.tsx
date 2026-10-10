'use client'
import { useTranslation } from '@/hooks/use-translation'


import { apiFetch } from '@/lib/api-client'

import type { ScoringResult } from '@/lib/scoring'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  formatUSD,
  formatDate,
  formatDateTime,
  daysUntil,
  deadlineUrgency,
  marketLabel,
  marketColor,
  sectorColor,
  scoreColor,
  scoreBg,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ExternalLink,
  FileText,
  AlertCircle,
  Calendar,
  Building2,
  Gavel,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Target,
  Download,
  Sparkles,
  Loader2,
  Brain,
} from 'lucide-react'

interface TenderDetail {
  id: string
  externalId: string | null
  sourcePortal: string
  sourceUrl: string
  title: string
  titleLocal: string | null
  description: string | null
  country: string
  market: string
  sector: string
  procurementMethod: string | null
  noticeType: string | null
  currency: string
  estimatedValue: number | null
  valueUSD: number | null
  publishedAt: string | null
  submissionDeadline: string | null
  questionDeadline: string | null
  bidValidityDays: number | null
  tenderSecurityPct: number | null
  performanceSecurityPct: number | null
  status: string
  awardStatus: string | null
  contactPerson: string | null
  contactEmail: string | null
  preBidMeetingAt: string | null
  siteVisitAt: string | null
  confidence: number
  extractedAt: string
  buyer: { name: string; country: string | null; city: string | null; website: string | null } | null
  lots: Array<{ id: string; title: string; description: string | null; estimatedValue: number | null; currency: string }>
  requirements: Array<{
    id: string
    category: string
    criterion: string
    operator: string | null
    threshold: string | null
    description: string | null
    isMandatory: boolean
    source: { doc: string | null; page: number | null; clause: string | null; extractedText: string | null }
    confidence: number
  }>
  documents: Array<{ id: string; name: string; docType: string | null; sourceUrl: string | null; uploadedAt: string | null }>
  amendments: Array<{ id: string; amendmentNo: number; title: string; description: string; publishedAt: string; affectsDeadline: boolean; newDeadline: string | null; sourceUrl: string | null }>
  awards: Array<{ id: string; supplier: string; supplierCountry: string | null; contractValue: number | null; currency: string; awardedAt: string; contractNo: string | null; sourceUrl: string | null }>
}


const CATEGORY_COLOR: Record<string, string> = {
  eligibility: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
  technical: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
  financial: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  legal: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  experience: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  certification: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
  document: 'bg-gray-500/15 text-gray-700 border-gray-500/30',
}

export function TenderDigitalTwin({ tenderId }: { tenderId: string }) {
  const { t, formatDateTime } = useTranslation()

  const [tender, setTender] = useState<TenderDetail | null>(null)
  const [scoring, setScoring] = useState<ScoringResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'amendments' | 'awards' | 'scoring' | 'extraction'>('overview')
  const [extracting, setExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<{ success: boolean; itemCount: number; extractionId: string; error?: string; note?: string } | null>(null)
  const openTender = useAppStore((s) => s.openTender)
  const goDiscover = useAppStore((s) => s.goDiscover)
  const goPursuits = useAppStore((s) => s.goPursuits)

  useEffect(() => {
    let cancelled = false
    // Defer setLoading to avoid synchronous setState in effect
    Promise.resolve().then(() => !cancelled && setLoading(true))
    Promise.all([
      apiFetch(`/api/tenders/${tenderId}`).then(r => r.json()),
      apiFetch(`/api/scoring/${tenderId}`).then(r => r.json()),
    ])
      .then(([t, s]) => { if (!cancelled) { setTender(t); setScoring(s); setLoading(false) } })
      .catch(e => { if (!cancelled) { console.error(e); setLoading(false) } })
    return () => { cancelled = true }
  }, [tenderId])

  if (loading) return <div className="p-6 text-sm text-slate-500">{t("Loading tender digital twin...")}</div>
  if (!tender) return <div className="p-6 text-sm text-rose-600">{t("Tender not found.")}</div>

  const deadlineDays = daysUntil(tender.submissionDeadline)
  const urgency = deadlineUrgency(tender.submissionDeadline)

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={goDiscover}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("Back to Discover")}</button>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', marketColor(tender.market))}>
            {marketLabel(tender.market)}
          </span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', sectorColor(tender.sector))}>
            {tender.sector}
          </span>
          {tender.procurementMethod && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{tender.procurementMethod}</span>
          )}
          {tender.noticeType && (
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{tender.noticeType}</span>
          )}
          {tender.status !== 'active' && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              {tender.status}
            </span>
          )}
          {tender.amendments.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {tender.amendments.length} amendment(s)
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tender.title}</h1>
        {tender.titleLocal && (
          <p className="text-sm text-slate-500" lang="bn">{tender.titleLocal}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{t("Source:")}{' '}<strong className="text-slate-700">{tender.sourcePortal}</strong></span>
          <span>{t("External ID:")}{' '}<code className="bg-slate-100 px-1 py-0.5 rounded">{tender.externalId ?? '—'}</code></span>
          <span>{t("Confidence:")}{' '}<strong className="text-slate-700">{Math.round(tender.confidence * 100)}%</strong></span>
          <a
            href={tender.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sky-700 hover:text-sky-900"
          >
            {t("View on portal")}<ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Score strip */}
      {scoring && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ScoreCard
            label={t("Eligibility Score")}
            score={scoring.eligibility.total}
            band={scoring.eligibility.band}
            subtext={`${scoring.eligibility.mandatoryPassed}/${scoring.eligibility.mandatoryTotal} mandatory requirements met`}
            blocked={scoring.eligibility.blocked}
            blockedReason={scoring.eligibility.blockedReason}
          />
          <ScoreCard
            label={t("Opportunity Fit")}
            score={scoring.opportunityFit.total}
            band={scoring.opportunityFit.band}
            subtext="Strategic relevance to your company"
          />
          <ScoreCard
            label={t("Submission Readiness")}
            score={scoring.submissionReadiness?.total ?? 0}
            band={scoring.submissionReadiness?.band ?? 'low'}
            subtext={scoring.submissionReadiness ? "Operational bid readiness" : "No pursuit created yet"}
          />
        </div>
      )}

      {/* Deadline banner */}
      {tender.submissionDeadline && tender.status === 'active' && (
        <div className={cn(
          'rounded-lg p-4 border',
          urgency === 'critical' ? 'bg-rose-500/5 border-rose-500/30' :
          urgency === 'high' ? 'bg-amber-500/5 border-amber-500/30' :
          'bg-sky-500/5 border-sky-500/30'
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-12 w-14 flex-col items-center justify-center rounded-md text-xs font-semibold',
              urgency === 'critical' ? 'bg-rose-500 text-white' :
              urgency === 'high' ? 'bg-amber-500 text-white' :
              'bg-sky-500 text-white'
            )}>
              <span className="text-xl leading-none">{deadlineDays}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-80">days left</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{t("Submission Deadline")}</p>
              <p className="text-xs text-slate-600">{formatDateTime(tender.submissionDeadline)}</p>
            </div>
            {tender.questionDeadline && (
              <div className="text-right text-xs text-slate-600">
                <p className="font-medium">{t("Question deadline")}</p>
                <p>{formatDateTime(tender.questionDeadline)}</p>
                <p className="text-[10px] text-slate-400">({daysUntil(tender.questionDeadline)}d)</p>
              </div>
            )}
            {scoring?.pursuitId ? (
              <button
                onClick={() => useAppStore.getState().openBidRoom(scoring.pursuitId!)}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Target className="h-3.5 w-3.5" /> {t("Open Bid Room")}</button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch('/api/pursuits', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tenderId: tender.id }),
                    })
                    const p = await res.json()
                    if (!res.ok) throw new Error(p.error ?? 'Unable to create pursuit')
                    useAppStore.getState().openBidRoom(p.id)
                  } catch (error) { toast.error(error instanceof Error ? error.message : t("Unable to create pursuit")) }
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Target className="h-3.5 w-3.5" /> {t("Create Pursuit")}</button>
            )}
            <button
              onClick={async () => {
                setExtracting(true)
                setExtractionResult(null)
                try {
                  const res = await apiFetch(`/api/tenders/${tender.id}/extract-requirements`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  })
                  const data = await res.json()
                  setExtractionResult({
                    success: data.success,
                    itemCount: data.items?.length ?? 0,
                    extractionId: data.extractionId,
                    error: data.error,
                    note: data.note,
                  })
                  setActiveTab('extraction')
                } catch (e) {
                  setExtractionResult({
                    success: false,
                    itemCount: 0,
                    extractionId: '',
                    error: (e as Error).message,
                  })
                } finally {
                  setExtracting(false)
                }
              }}
              disabled={extracting}
              className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Trigger LLM extraction. Output is pending human review — nothing is written to the Requirement table until approved."
            >
              {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {extracting ? t("Extracting...") : t("Extract Requirements (LLM)")}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: FileText },
          { id: 'requirements', label: `Requirements (${tender.requirements.length})`, icon: CheckCircle2 },
          { id: 'extraction', label: 'LLM Extraction', icon: Sparkles },
          { id: 'amendments', label: `Amendments (${tender.amendments.length})`, icon: AlertCircle },
          { id: 'awards', label: `Awards (${tender.awards.length})`, icon: Gavel },
          { id: 'scoring', label: 'Scoring Detail', icon: Target },
        ].map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === t.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {activeTab === 'overview' && <OverviewTab tender={tender} />}
        {activeTab === 'requirements' && <RequirementsTab tender={tender} />}
        {activeTab === 'extraction' && <ExtractionTab tenderId={tender.id} result={extractionResult} extracting={extracting} onNavigateToQueue={() => useAppStore.getState().goExtractions()} />}
        {activeTab === 'amendments' && <AmendmentsTab tender={tender} />}
        {activeTab === 'awards' && <AwardsTab tender={tender} />}
        {activeTab === 'scoring' && scoring && <ScoringTab scoring={scoring} />}
      </div>
    </div>
  )
}

function ScoreCard({
  label, score, band, subtext, blocked, blockedReason,
}: {
  label: string
  score: number
  band: string
  subtext: string
  blocked?: boolean
  blockedReason?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</span>
        <span className={cn(
          'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
          blocked ? 'bg-rose-500/15 text-rose-700' :
          band === 'high' ? 'bg-emerald-500/15 text-emerald-700' :
          band === 'medium' ? 'bg-amber-500/15 text-amber-700' :
          'bg-slate-500/15 text-slate-700'
        )}>
          {blocked ? 'blocked' : band}
        </span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className={cn('text-3xl font-bold', scoreColor(score))}>{score}</span>
        <span className="text-sm text-slate-400 mb-1">/100</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', scoreBg(score))} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-2">{subtext}</p>
      {blocked && blockedReason && (
        <p className="text-xs text-rose-700 mt-1 flex items-start gap-1">
          <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{blockedReason}</span>
        </p>
      )}
    </div>
  )
}

function OverviewTab({ tender }: { tender: TenderDetail }) {
  const { t, formatDate, formatDateTime } = useTranslation()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{t("Description")}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{tender.description ?? 'No description available.'}</p>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{t("Buyer")}</h3>
          {tender.buyer ? (
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">{tender.buyer.name}</p>
                <p className="text-xs text-slate-500">
                  {[tender.buyer.city, tender.buyer.country].filter(Boolean).join(', ')}
                </p>
                {tender.buyer.website && (
                  <a href={tender.buyer.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 mt-1">
                    {tender.buyer.website} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">{t("Unknown buyer.")}</p>}
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{t("Contact")}</h3>
          <div className="text-xs text-slate-700 space-y-1">
            <p>{tender.contactPerson ?? '—'}</p>
            {tender.contactEmail && <p className="text-sky-700">{tender.contactEmail}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{t("Financial")}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label={t("Estimated Value")} value={`${formatUSD(tender.valueUSD)}`} sub={tender.currency !== 'USD' ? `${formatUSD(tender.estimatedValue)} ${tender.currency}` : undefined} />
            <Stat label={t("Tender Security")} value={tender.tenderSecurityPct !== null ? `${tender.tenderSecurityPct}%` : '—'} />
            <Stat label={t("Performance Security")} value={tender.performanceSecurityPct !== null ? `${tender.performanceSecurityPct}%` : '—'} />
            <Stat label={t("Bid Validity")} value={tender.bidValidityDays !== null ? `${tender.bidValidityDays} days` : '—'} />
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{t("Timeline")}</h3>
          <div className="space-y-1.5 text-xs">
            <TimelineRow icon={Calendar} label={t("Published")} value={formatDate(tender.publishedAt)} />
            {tender.preBidMeetingAt && (
              <TimelineRow icon={Building2} label={t("Pre-bid meeting")} value={formatDateTime(tender.preBidMeetingAt)} />
            )}
            {tender.questionDeadline && (
              <TimelineRow icon={AlertCircle} label={t("Question deadline")} value={formatDateTime(tender.questionDeadline)} />
            )}
            <TimelineRow icon={Clock} label={t("Submission deadline")} value={formatDateTime(tender.submissionDeadline)} highlight={deadlineUrgency(tender.submissionDeadline) === 'critical'} />
          </div>
        </div>

        {tender.lots.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Lots ({tender.lots.length})</h3>
            <div className="space-y-2">
              {tender.lots.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium text-slate-900">{l.title}</p>
                    {l.description && <p className="text-slate-500 mt-0.5">{l.description}</p>}
                  </div>
                  <span className="font-semibold text-slate-700">{formatUSD(l.estimatedValue)} <span className="text-[10px] text-slate-500">{l.currency}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tender.documents.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Documents ({tender.documents.length})</h3>
            <div className="space-y-1">
              {tender.documents.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">{d.name}</span>
                  {d.docType && <span className="text-[10px] text-slate-500">· {d.docType}</span>}
                  {d.sourceUrl && (
                    <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sky-700 hover:text-sky-900 flex items-center gap-1">
                      <Download className="h-3 w-3" /> {t("Open")}</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RequirementsTab({ tender }: { tender: TenderDetail }) {
  const { t } = useTranslation()

  if (tender.requirements.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-500">{t("No structured requirements extracted yet.")}</div>
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          Every requirement retains its source: document, page, clause, and extracted text. Hover for the original clause.
        </p>
      </div>
      {tender.requirements.map(r => (
        <div key={r.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-0.5">
              {r.isMandatory ? (
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700">{t("Mandatory")}</span>
              ) : (
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t("Optional")}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', CATEGORY_COLOR[r.category] ?? 'bg-gray-500/15 text-gray-700')}>
                  {r.category}
                </span>
                <p className="text-sm font-medium text-slate-900">{r.criterion}</p>
                {r.threshold && (
                  <span className="text-xs text-slate-500">
                    {r.operator} <strong className="text-slate-700">{r.threshold}</strong>
                  </span>
                )}
              </div>
              {r.source.extractedText && (
                <p className="text-xs text-slate-600 mt-1.5 italic leading-relaxed">
                  &ldquo;{r.source.extractedText}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                {r.source.doc && <span>{r.source.doc}</span>}
                {r.source.page && <span>p.{r.source.page}</span>}
                {r.source.clause && <span>§ {r.source.clause}</span>}
                <span>· Confidence: {Math.round(r.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AmendmentsTab({ tender }: { tender: TenderDetail }) {
  const { t, formatDate, formatDateTime } = useTranslation()

  if (tender.amendments.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-500">{t("No amendments published.")}</div>
  }
  return (
    <div className="space-y-3">
      {tender.amendments.map(a => (
        <div key={a.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
              Amendment #{a.amendmentNo}
            </span>
            <span className="text-xs text-slate-500">{formatDate(a.publishedAt)}</span>
            {a.affectsDeadline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {t("Affects deadline")}</span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">{a.title}</p>
          <p className="text-xs text-slate-600 mt-1">{a.description}</p>
          {a.newDeadline && (
            <p className="text-xs text-rose-700 mt-1 font-medium">{t("New deadline:")}{' '}{formatDateTime(a.newDeadline)}</p>
          )}
          {a.sourceUrl && (
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 mt-2">
              {t("View source")}<ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function AwardsTab({ tender }: { tender: TenderDetail }) {
  const { t, formatDate } = useTranslation()

  if (tender.awards.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-500">{t("No award information published.")}</div>
  }
  return (
    <div className="space-y-3">
      {tender.awards.map(a => (
        <div key={a.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{a.supplier}</p>
              {a.supplierCountry && <p className="text-xs text-slate-500 mt-0.5">{a.supplierCountry}</p>}
              {a.contractNo && <p className="text-xs text-slate-500">Contract # {a.contractNo}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{formatUSD(a.contractValue)}</p>
              <p className="text-[10px] text-slate-500">{a.currency}</p>
              <p className="text-xs text-slate-500 mt-1">{formatDate(a.awardedAt)}</p>
            </div>
          </div>
          {a.sourceUrl && (
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 mt-2">
              {t("View award notice")}<ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function ScoringTab({ scoring }: { scoring: ScoringResult }) {
  const { t, formatDateTime } = useTranslation()

  return (
    <div className="space-y-6">
      <ScoreSection title={t("Eligibility Score")} score={scoring.eligibility} />
      <ScoreSection title={t("Opportunity Fit Score")} score={scoring.opportunityFit} />
      {scoring.submissionReadiness && <ScoreSection title={t("Submission Readiness Score")} score={scoring.submissionReadiness} />}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <strong className="text-slate-900">{t("Engine:")}</strong> {scoring.engine} · Generated {formatDateTime(scoring.generatedAt)}.
        All scores are deterministic. LLM extraction is not invoked for scoring.
      </div>
    </div>
  )
}

function ScoreSection({ title, score }: {
  title: string
  score: { total: number; band: string; components: Array<{ criterion: string; weight: number; score: number; status: string; reason: string }> }
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', scoreColor(score.total))}>{score.total}</span>
          <span className="text-xs text-slate-400">/100</span>
          <span className={cn(
            'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
            score.band === 'high' ? 'bg-emerald-500/15 text-emerald-700' :
            score.band === 'medium' ? 'bg-amber-500/15 text-amber-700' :
            score.band === 'blocked' ? 'bg-rose-500/15 text-rose-700' :
            'bg-slate-500/15 text-slate-700'
          )}>{score.band}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {score.components.map((c, i) => (
          <div key={i} className="flex items-start gap-3 rounded-md border border-slate-100 p-2">
            <div className={cn(
              'mt-0.5 h-2 w-2 rounded-full shrink-0',
              c.status === 'pass' ? 'bg-emerald-500' :
              c.status === 'partial' ? 'bg-amber-500' :
              c.status === 'fail' ? 'bg-rose-500' :
              'bg-slate-300'
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-900">{c.criterion}</p>
                <span className="text-[10px] text-slate-500">
                  weight {c.weight} · score {Math.round(c.score * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{c.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-100 p-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

function TimelineRow({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3.5 w-3.5', highlight ? 'text-rose-600' : 'text-slate-400')} />
      <span className="text-slate-500">{label}:</span>
      <span className={cn('font-medium', highlight ? 'text-rose-700' : 'text-slate-900')}>{value}</span>
    </div>
  )
}

function ExtractionTab({
  tenderId,
  result,
  extracting,
  onNavigateToQueue,
}: {
  tenderId: string
  result: { success: boolean; itemCount: number; extractionId: string; error?: string; note?: string } | null
  extracting: boolean
  onNavigateToQueue: () => void
}) {
  const { t } = useTranslation()

  const goExtractions = useAppStore((s) => s.goExtractions)
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
        <div className="flex items-start gap-2">
          <Brain className="h-4 w-4 text-violet-700 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-violet-900">{t("LLM Requirement Extraction")}</p>
            <p className="text-violet-700 mt-1 leading-relaxed">
              Trigger an LLM call to extract structured requirements from the tender description.
              The LLM is sandboxed: untrusted tender text is wrapped in &lt;UNTRUSTED_DATA&gt; blocks,
              output is validated against a strict Zod schema, every extracted item must include a
              verbatim sourceSnippet, and the result is queued for <strong>{t("human review")}</strong> —
              reviewed requirements stay private to your workspace.
            </p>
          </div>
        </div>
      </div>

      {extracting && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          Calling LLM (glm-4.6)... this may take a few seconds.
        </div>
      )}

      {result && !extracting && (
        <div className={cn(
          'rounded-md border p-3 text-xs',
          result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
        )}>
          <div className="flex items-start gap-2">
            {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className={cn('font-semibold', result.success ? 'text-emerald-800' : 'text-rose-800')}>
                {result.success ? `Extraction complete — ${result.itemCount} items extracted` : t("Extraction failed")}
              </p>
              {result.error && <p className="text-rose-700 mt-1">{result.error}</p>}
              {result.note && <p className="text-slate-700 mt-1">{result.note}</p>}
              {result.success && result.extractionId && (
                <button
                  onClick={goExtractions}
                  className="mt-2 text-violet-700 hover:text-violet-900 font-medium flex items-center gap-1"
                >
                  {t("Review in queue →")}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !extracting && (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-violet-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">{t("No extraction run yet for this tender.")}</p>
          <p className="text-xs text-slate-400">Click "Extract Requirements (LLM)" above to trigger an extraction.</p>
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">{t("Guardrails in force")}</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Backend-only LLM invocation (never client-side)</li>
          <li>Input sanitization — control chars stripped, length capped at 32k chars</li>
          <li>Prompt-injection resistance — tender text wrapped as data, not instructions</li>
          <li>Strict Zod schema validation on output</li>
          <li>Every extracted item must include a sourceSnippet (verbatim quote)</li>
          <li>Confidence threshold: items below 0.7 are flagged for manual review</li>
          <li>Full audit log: model, tokens, latency, cost, prompt hash</li>
          <li>{t("Reviewed requirements are private workspace annotations")}</li>
        </ul>
      </div>
    </div>
  )
}
