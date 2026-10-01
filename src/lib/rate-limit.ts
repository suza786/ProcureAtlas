// ProcureAtlas AI — Phase 5 Rate Limiting Middleware
//
// Token bucket rate limiting per API key (or IP hash for unauthenticated).
// Returns 429 with Retry-After header when rate limit exceeded.
// Limits are tier-based: free (100/hr), intelligence (1K/hr), pursuit_pro (5K/hr), team (25K/hr), enterprise (100K/hr).

import { db } from './db'
import { getCurrentTenant } from './tenant'

const TIER_LIMITS: Record<string, { requestsPerHour: number; burst: number }> = {
  free: { requestsPerHour: 100, burst: 20 },
  intelligence: { requestsPerHour: 1000, burst: 50 },
  pursuit_pro: { requestsPerHour: 5000, burst: 100 },
  team: { requestsPerHour: 25000, burst: 200 },
  enterprise: { requestsPerHour: 100000, burst: 500 },
}

const REFILL_RATE_PER_SECOND = (tier: string): number => {
  const limit = TIER_LIMITS[tier]
  return limit ? limit.requestsPerHour / 3600 : 0.03
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number | null
  limit: number
}

/**
 * Check rate limit for an API key or IP.
 * Uses token bucket algorithm with lazy refill.
 */
export async function checkRateLimit(
  identifier: string,
  bucketKey: string,
  tier: string = 'free'
): Promise<RateLimitResult> {
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const maxTokens = limits.burst
  const refillPerSecond = REFILL_RATE_PER_SECOND(tier)

  const now = new Date()
  const existing = await db.rateLimitBucket.findUnique({
    where: {
      identifier_bucketKey: { identifier, bucketKey },
    },
  })

  let tokens: number
  let lastRefilledAt: Date

  if (existing) {
    // Lazy refill
    const elapsedSeconds = (now.getTime() - existing.lastRefilledAt.getTime()) / 1000
    tokens = Math.min(maxTokens, existing.tokens + elapsedSeconds * refillPerSecond)
    lastRefilledAt = now
  } else {
    tokens = maxTokens
    lastRefilledAt = now
  }

  if (tokens >= 1) {
    // Allow and consume token
    tokens -= 1
    await db.rateLimitBucket.upsert({
      where: {
        identifier_bucketKey: { identifier, bucketKey },
      },
      update: { tokens, lastRefilledAt },
      create: { identifier, bucketKey, tokens, lastRefilledAt },
    })

    const resetAt = new Date(now.getTime() + ((maxTokens - tokens) / refillPerSecond) * 1000)
    return {
      allowed: true,
      remaining: Math.floor(tokens),
      resetAt,
      retryAfterSeconds: null,
      limit: limits.requestsPerHour,
    }
  } else {
    // Rate limited
    const retryAfterSeconds = Math.ceil((1 - tokens) / refillPerSecond)
    await db.rateLimitBucket.upsert({
      where: {
        identifier_bucketKey: { identifier, bucketKey },
      },
      update: { tokens, lastRefilledAt },
      create: { identifier, bucketKey, tokens: 0, lastRefilledAt },
    })

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now.getTime() + retryAfterSeconds * 1000),
      retryAfterSeconds,
      limit: limits.requestsPerHour,
    }
  }
}

/**
 * Validate an API key from the Authorization header.
 * Returns the tenant context or null if invalid.
 */
export async function validateApiKey(authHeader: string | null): Promise<{
  valid: boolean
  tenantId?: string
  apiKeyId?: string
  scopes?: string[]
  tier?: string
  identifier?: string
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false }
  }

  const rawKey = authHeader.slice(7)
  if (!rawKey.startsWith('pak_')) {
    return { valid: false }
  }

  const prefix = rawKey.slice(0, 12)
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: prefix, revokedAt: null },
    take: 5,
  })

  // Fetch tenant plan separately
  const tenantIds = [...new Set(candidates.map(k => k.tenantId).filter(Boolean))] as string[]
  const tenants = tenantIds.length > 0 ? await db.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, plan: true },
  }) : []
  const tenantMap = new Map(tenants.map(t => [t.id, t.plan]))

  const bcrypt = await import('bcryptjs')
  for (const k of candidates) {
    if (k.expiresAt && k.expiresAt < new Date()) continue
    if (bcrypt.compareSync(rawKey, k.keyHash)) {
      await db.apiKey.update({
        where: { id: k.id },
        data: { lastUsedAt: new Date() },
      })
      return {
        valid: true,
        tenantId: k.tenantId ?? undefined,
        apiKeyId: k.id,
        scopes: k.scopes.split(' '),
        tier: (k.tenantId && tenantMap.get(k.tenantId)) ?? 'free',
        identifier: prefix,
      }
    }
  }

  return { valid: false }
}

/**
 * Set rate limit headers on a response.
 */
export function setRateLimitHeaders(
  res: Response,
  result: RateLimitResult
): void {
  res.headers.set('X-RateLimit-Limit', result.limit.toString())
  res.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  res.headers.set('X-RateLimit-Reset', result.resetAt.toISOString())
  if (result.retryAfterSeconds) {
    res.headers.set('Retry-After', result.retryAfterSeconds.toString())
  }
}
