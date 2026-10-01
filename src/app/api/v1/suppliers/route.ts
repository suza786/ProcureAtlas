import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/suppliers — public API: list suppliers
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:suppliers', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const suppliers = await db.organization.findMany({
    where: { orgType: 'supplier' },
    include: {
      supplierProfile: { select: { totalAwards: true, totalAwardValueUSD: true, isCompetitor: true, isPartner: true } },
    },
    take: 100,
    orderBy: { name: 'asc' },
  })

  const res = NextResponse.json({
    count: suppliers.length,
    items: suppliers.map(s => ({
      id: s.id, name: s.name, country: s.country, city: s.city, website: s.website,
      sourcePortal: s.sourcePortal, externalId: s.externalId,
      profile: s.supplierProfile,
    })),
  })
  setRateLimitHeaders(res, rateLimit)
  return res
}
