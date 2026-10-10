import { getPlan } from './plans'
import { meterApiRequest } from './usage-meter'
import { getSubscription } from './subscription'
// ProcureAtlas AI — Phase 5 Rate Limiting Middleware
//
// Token bucket rate limiting per API key (or IP hash for unauthenticated).
// Returns 429 with Retry-After header when rate limit exceeded.
// Limits are tier-based: free (100/hr), intelligence (1K/hr), pursuit_pro (5K/hr), team (25K/hr), enterprise (100K/hr).

import { db } from './db'
import { digestApiKey, verifyApiKey } from './api-key-security'

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
  tier: string = 'free',
  customLimits?: { requestsPerHour: number; burst: number }
): Promise<RateLimitResult> {
  const limits = customLimits ?? getPlan(tier).rate
  const maxTokens = limits.burst
  const refillPerSecond = limits.requestsPerHour / 3600

  const now = new Date()

  // Atomic read-modify-write inside a transaction to prevent race-condition
  // token overspend under concurrent requests.
  const outcome = await db.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
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
      tokens -= 1
      await tx.rateLimitBucket.upsert({
        where: {
          identifier_bucketKey: { identifier, bucketKey },
        },
        update: { tokens, lastRefilledAt },
        create: { identifier, bucketKey, tokens, lastRefilledAt },
      })
      return { allowed: true, tokens }
    }

    // Rate limited — persist the (sub-token) remainder so refill math stays accurate
    await tx.rateLimitBucket.upsert({
      where: {
        identifier_bucketKey: { identifier, bucketKey },
      },
      update: { tokens, lastRefilledAt },
      create: { identifier, bucketKey, tokens: 0, lastRefilledAt },
    })
    return { allowed: false, tokens }
  })

  if (outcome.allowed) {
    const resetAt = new Date(now.getTime() + ((maxTokens - outcome.tokens) / refillPerSecond) * 1000)
    return {
      allowed: true,
      remaining: Math.floor(outcome.tokens),
      resetAt,
      retryAfterSeconds: null,
      limit: limits.requestsPerHour,
    }
  }

  const retryAfterSeconds = Math.ceil((1 - outcome.tokens) / refillPerSecond)
  return {
    allowed: false,
    remaining: 0,
    resetAt: new Date(now.getTime() + retryAfterSeconds * 1000),
    retryAfterSeconds,
    limit: limits.requestsPerHour,
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
  if (!/^pak_[a-f0-9]{48}$/.test(rawKey)) {
    return { valid: false }
  }

  const prefix = rawKey.slice(0, 12)
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: prefix, revokedAt: null },
    take: 5,
  })

  for (const k of candidates) {
    if (k.expiresAt && k.expiresAt < new Date()) continue
    if (await verifyApiKey(rawKey, k.keyHash)) {
      const owner = k.userId ? await db.user.findUnique({ where: { id: k.userId }, select: { active: true } }) : null
      if (k.userId && !owner?.active) return { valid: false }
      const now = new Date()
      // Conditional stamp avoids redundant writes across concurrent servers.
      if (!k.lastUsedAt || now.getTime() - k.lastUsedAt.getTime() >= 60000 || !k.keyHash.startsWith('sha256:')) {
        await db.apiKey.updateMany({
          where: { id: k.id, revokedAt: null, OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: new Date(now.getTime() - 60000) } }, { keyHash: { not: { startsWith: 'sha256:' } } }] },
          data: { lastUsedAt: now, keyHash: digestApiKey(rawKey) },
        })
      }
      if (!k.tenantId) return { valid: false }
      const subscription = await getSubscription(k.tenantId)
      await meterApiRequest(k.tenantId, { apiKeyId: k.id })
      return {
        valid: true,
        tenantId: k.tenantId ?? undefined,
        apiKeyId: k.id,
        scopes: k.scopes.split(' '),
        tier: subscription.plan,
        identifier: k.id,
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
