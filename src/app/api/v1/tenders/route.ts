import type { Prisma } from '@prisma/client'
import { validatedSearch } from '@/lib/api-validation'
import { pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/auth'

// GET /api/v1/tenders — public API: search tenders
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:tenders', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const searchParams = validatedSearch(req)
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const status = searchParams.get('status') ?? 'active'
  const search = searchParams.get('q')
  const { limit } = pagination(searchParams, 20, 100)
  const { offset } = pagination(searchParams)

  const where: Prisma.TenderWhereInput = {}
  if (market) where.market = market
  if (sector) where.sector = sector
  if (status) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const [items, total] = await Promise.all([
    db.tender.findMany({
      where,
      select: {
        id: true, title: true, titleLocal: true, country: true, market: true, sector: true,
        procurementMethod: true, noticeType: true, currency: true, estimatedValue: true, valueUSD: true,
        publishedAt: true, submissionDeadline: true, questionDeadline: true,
        status: true, sourcePortal: true, sourceUrl: true, confidence: true,
        buyer: { select: { organization: { select: { name: true, country: true, website: true } } } },
      },
      orderBy: { submissionDeadline: 'asc' },
      take: limit,
      skip: offset,
    }),
    db.tender.count({ where }),
  ])

  // Log API usage
  await logAction({
    tenantId: authResult.tenantId ?? 'unknown',
    apiKeyId: authResult.apiKeyId,
    action: 'api_v1_tenders_list',
    entityType: 'api',
    afterJson: { market, sector, status, limit, offset, resultCount: items.length },
    llmModel: undefined,
    request: req,
  })

  const res = NextResponse.json({
    total,
    limit,
    offset,
    count: items.length,
    items,
  })
  setRateLimitHeaders(res, rateLimit)
  return res
})
