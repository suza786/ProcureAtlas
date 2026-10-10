import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/buyers — public API: list buyers
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:buyers', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const buyers = await db.organization.findMany({
    where: { orgType: 'buyer' },
    select: { id: true, name: true, country: true, city: true, website: true, sourcePortal: true, externalId: true },
    take: 100,
    orderBy: { name: 'asc' },
  })

  const res = NextResponse.json({ count: buyers.length, items: buyers })
  setRateLimitHeaders(res, rateLimit)
  return res
})
