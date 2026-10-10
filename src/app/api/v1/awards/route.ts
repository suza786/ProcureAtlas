import { validatedSearch } from '@/lib/api-validation'
import type { Prisma } from '@prisma/client'
import { pagination } from '@/lib/api-validation'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/awards — public API: search awards
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:awards', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const searchParams = validatedSearch(req)
  const market = searchParams.get('market')
  const sector = searchParams.get('sector')
  const supplierOrgId = searchParams.get('supplierOrgId')
  const { limit } = pagination(searchParams, 20, 100)
  const { offset } = pagination(searchParams)

  const where: Prisma.AwardWhereInput = {}
  if (market || sector) {
    where.tender = { ...(market ? { market } : {}), ...(sector ? { sector } : {}) }
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
})
