import { getSubscription } from '@/lib/subscription'
import { withApiErrors } from '@/lib/api-errors'
import { requireApiScope } from '@/lib/api-scopes'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateApiKey, checkRateLimit, setRateLimitHeaders } from '@/lib/rate-limit'

// GET /api/v1/usage — current API usage stats for the API key's tenant
export const GET = withApiErrors(async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req.headers.get('authorization'))
  requireApiScope(authResult, 'api:read')
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

  const [count24h, count7d, count30d, llmStats30d, topEndpoints, subscription] = await Promise.all([
    db.usageEvent.count({ where: { tenantId: authResult.tenantId, kind: 'api_call', createdAt: { gte: last24h } } }),
    db.usageEvent.count({ where: { tenantId: authResult.tenantId, kind: 'api_call', createdAt: { gte: last7d } } }),
    db.usageEvent.count({ where: { tenantId: authResult.tenantId, kind: 'api_call', createdAt: { gte: last30d } } }),
    db.usageEvent.aggregate({ where: { tenantId: authResult.tenantId, kind: 'provider_call', tokenSource: { not: 'reserved_upper_bound' }, createdAt: { gte: last30d } }, _sum: { inputTokens: true, outputTokens: true } }),
    db.usageEvent.groupBy({ by: ['endpoint'], where: { tenantId: authResult.tenantId, kind: 'api_call', createdAt: { gte: last7d } }, _count: true, orderBy: { _count: { endpoint: 'desc' } }, take: 10 }),
    getSubscription(authResult.tenantId),
  ])
  const plan = subscription.plan
  const apiLimit = subscription.apiCallsLimit

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

      inputTokens: llmStats30d._sum.inputTokens ?? 0,
      outputTokens: llmStats30d._sum.outputTokens ?? 0,
    },
    topEndpoints: topEndpoints.map(e => ({ action: e.endpoint, count: e._count })),
    rateLimit: {
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
      limit: rateLimit.limit,
    },
  })
  setRateLimitHeaders(res, rateLimit)
  return res
})
