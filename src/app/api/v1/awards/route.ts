import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/awards — public API: search awards
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:awards', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const { searchParams } = new URL(req.url)
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const supplierOrgId = searchParams.get('supplierOrgId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const where: Record<string, unknown> = {}
  if (market || sector) {
    where.tender = {}
    if (market) where.tender.market = market
    if (sector) where.tender.sector = sector
  }
  if (supplierOrgId) where.supplierOrgId = supplierOrgId

  const [items, total] = await Promise.all([
    db.award.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, country: true } },
        tender: { select: { id: true, title: true, market: true, sector: true, valueUSD: true } },
      },
      orderBy: { awardedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.award.count({ where }),
  ])

  const res = NextResponse.json({ total, limit, offset, count: items.length, items })
  setRateLimitHeaders(res, rateLimit)
  return res
}
