import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/usage — current API usage stats for the API key's tenant
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  if (!authResult.valid || !authResult.tenantId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(authResult.identifier!, 'api:v1:usage', authResult.tier)
  if (!rateLimit.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    setRateLimitHeaders(res, rateLimit)
    return res
  }

  // Compute API usage for last 24h, 7d, 30d
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [count24h, count7d, count30d, llmStats30d, topEndpoints] = await Promise.all([
    db.auditLog.count({
      where: { tenantId: authResult.tenantId, action: { contains: 'api_v1_' }, createdAt: { gte: last24h } },
    }),
    db.auditLog.count({
      where: { tenantId: authResult.tenantId, action: { contains: 'api_v1_' }, createdAt: { gte: last7d } },
    }),
    db.auditLog.count({
      where: { tenantId: authResult.tenantId, action: { contains: 'api_v1_' }, createdAt: { gte: last30d } },
    }),
    db.auditLog.aggregate({
      where: { tenantId: authResult.tenantId, action: { contains: 'api_v1_' }, createdAt: { gte: last30d } },
      _sum: { llmCostUsd: true, llmInputTokens: true, llmOutputTokens: true },
    }),
    db.auditLog.groupBy({
      by: ['action'],
      where: { tenantId: authResult.tenantId, action: { contains: 'api_v1_' }, createdAt: { gte: last7d } },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
  ])

  // Get subscription limits
  const subscription = await db.subscription.findUnique({
    where: { tenantId: authResult.tenantId },
    select: { plan: true, apiCallsLimit: true, llmTokensLimit: true },
  })

  const plan = subscription?.plan ?? authResult.tier ?? 'free'
  const apiLimit = subscription?.apiCallsLimit ?? 100

  const res = NextResponse.json({
    plan,
    tier: authResult.tier,
    usage: {
      last24h: count24h,
      last7d: count7d,
      last30d: count30d,
      apiCallsLimit: apiLimit,
      utilizationPct: apiLimit > 0 ? Math.round((count30d / apiLimit) * 100 * 100) / 100 : 0,
    },
    llmUsage30d: {
      totalCostUsd: llmStats30d._sum.llmCostUsd ?? 0,
      inputTokens: llmStats30d._sum.llmInputTokens ?? 0,
      outputTokens: llmStats30d._sum.llmOutputTokens ?? 0,
    },
    topEndpoints: topEndpoints.map(e => ({ action: e.action, count: e._count })),
    rateLimit: {
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
      limit: rateLimit.limit,
    },
  })
  setRateLimitHeaders(res, rateLimit)
  return res
}
