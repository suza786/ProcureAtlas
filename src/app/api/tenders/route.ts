import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { getCurrentTenant } from '@/lib/tenant'
import { pagination } from '@/lib/api-validation'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tenders — list tenders with filters
// Query params: market, sector, status, search, limit, offset
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const ctx = await getCurrentTenant()
  const searchParams = validatedSearch(req)
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const status = searchParams.get('status') ?? 'active'
  const search = searchParams.get('search')
  const { limit } = pagination(searchParams, 50, 100)
  const { offset } = pagination(searchParams)

  const where: Prisma.TenderWhereInput = {}
  if (market && market !== 'all') where.market = market
  if (sector && sector !== 'all') where.sector = sector
  if (status && status !== 'all') where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { titleLocal: { contains: search } },
    ]
  }

  const [tenders, total] = await Promise.all([
    db.tender.findMany({
      where,
      include: {
        buyer: { include: { organization: true } },
        _count: { select: { requirements: true, amendments: true, lots: true } },
      },
      orderBy: { submissionDeadline: 'asc' },
      take: limit,
      skip: offset,
    }),
    db.tender.count({ where }),
  ])

  return NextResponse.json({
    total,
    limit,
    offset,
    items: tenders.map(t => ({
      id: t.id,
      externalId: t.externalId,
      sourcePortal: t.sourcePortal,
      sourceUrl: t.sourceUrl,
      title: t.title,
      titleLocal: t.titleLocal,
      country: t.country,
      market: t.market,
      sector: t.sector,
      procurementMethod: t.procurementMethod,
      noticeType: t.noticeType,
      currency: t.currency,
      estimatedValue: t.estimatedValue,
      valueUSD: t.valueUSD,
      publishedAt: t.publishedAt,
      submissionDeadline: t.submissionDeadline,
      questionDeadline: t.questionDeadline,
      status: t.status,
      buyer: t.buyer?.organization?.name ?? null,
      requirementCount: t._count.requirements,
      amendmentCount: t._count.amendments,
      lotCount: t._count.lots,
      confidence: t.confidence,
    })),
  })
})
