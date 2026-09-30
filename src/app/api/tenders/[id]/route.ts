import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tenders/[id] — Tender Digital Twin payload
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const tender = await db.tender.findUnique({
    where: { id },
    include: {
      buyer: { include: { organization: true } },
      lots: { include: { _count: { select: { requirements: true } } } },
      requirements: true,
      documents: true,
      amendments: { orderBy: { amendmentNo: 'asc' } },
      awards: { include: { supplier: true } },
      alerts: { where: { tenantId: { not: undefined } }, take: 5 },
    },
  })

  if (!tender) {
    return NextResponse.json({ error: 'Tender not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: tender.id,
    externalId: tender.externalId,
    sourcePortal: tender.sourcePortal,
    sourceUrl: tender.sourceUrl,
    title: tender.title,
    titleLocal: tender.titleLocal,
    description: tender.description,
    country: tender.country,
    market: tender.market,
    sector: tender.sector,
    procurementMethod: tender.procurementMethod,
    noticeType: tender.noticeType,
    currency: tender.currency,
    estimatedValue: tender.estimatedValue,
    valueUSD: tender.valueUSD,
    publishedAt: tender.publishedAt,
    submissionDeadline: tender.submissionDeadline,
    questionDeadline: tender.questionDeadline,
    bidValidityDays: tender.bidValidityDays,
    tenderSecurityPct: tender.tenderSecurityPct,
    performanceSecurityPct: tender.performanceSecurityPct,
    status: tender.status,
    awardStatus: tender.awardStatus,
    contactPerson: tender.contactPerson,
    contactEmail: tender.contactEmail,
    preBidMeetingAt: tender.preBidMeetingAt,
    siteVisitAt: tender.siteVisitAt,
    confidence: tender.confidence,
    extractedAt: tender.extractedAt,
    buyer: tender.buyer?.organization ?? null,
    lots: tender.lots,
    requirements: tender.requirements.map(r => ({
      id: r.id,
      category: r.category,
      criterion: r.criterion,
      operator: r.operator,
      threshold: r.threshold,
      description: r.description,
      isMandatory: r.isMandatory,
      source: {
        doc: r.sourceDoc,
        page: r.sourcePage,
        clause: r.sourceClause,
        extractedText: r.extractedText,
      },
      confidence: r.confidence,
    })),
    documents: tender.documents,
    amendments: tender.amendments,
    awards: tender.awards.map(a => ({
      id: a.id,
      supplier: a.supplier.name,
      supplierCountry: a.supplier.country,
      contractValue: a.contractValue,
      currency: a.currency,
      awardedAt: a.awardedAt,
      contractNo: a.contractNo,
      sourceUrl: a.sourceUrl,
    })),
  })
}
