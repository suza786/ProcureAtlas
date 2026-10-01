import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/pursuits — public API: list pursuits for the API key's tenant
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid || !authResult.tenantId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:pursuits', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  const pursuits = await db.pursuit.findMany({
    where: { tenantId: authResult.tenantId },
    include: {
      tender: { select: { id: true, title: true, market: true, sector: true, submissionDeadline: true, valueUSD: true } },
      company: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const res = NextResponse.json({
    count: pursuits.length,
    items: pursuits.map(p => ({
      id: p.id, stage: p.stage, bidDecision: p.bidDecision, priority: p.priority,
      estimatedValueUSD: p.estimatedValueUSD, winProbability: p.winProbability,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      tender: p.tender, company: p.company,
    })),
  })
  setRateLimitHeaders(res, rateLimit)
  return res
}
